import { CommissioningServer, MatterServer } from "@project-chip/matter-node.js"
import { VendorId } from "@project-chip/matter-node.js/datatype";
import { Aggregator, DeviceTypes } from "@project-chip/matter-node.js/device";
import { QrCode } from "@project-chip/matter-node.js/schema";
import { StorageBackendDisk, StorageManager } from "@project-chip/matter-node.js/storage";
import { Time } from "@project-chip/matter-node.js/time";
import {
    getParameter,
    requireMinNodeVersion,
} from "@project-chip/matter-node.js/util";
import { Format, Level, Logger } from "@project-chip/matter-node.js/log";
import { Supervisor } from "./Supervisor";
import { readFile } from "fs/promises";
import { Configuration } from "./Model";

requireMinNodeVersion(16);
Logger.defaultLogLevel = Level.INFO;
Logger.format = Format.PLAIN;

const storageLocation = getParameter("store") ?? "./working/matter";
const storage = new StorageBackendDisk(storageLocation, false);

export class Bridge {
    private matterServer: MatterServer | undefined;

    async start() {
        const configurationJson = await readFile("configuration.json", {
            encoding: 'utf8'
        });
        const configuration : Configuration = JSON.parse(configurationJson);
        const storageManager = new StorageManager(storage);
        await storageManager.initialize();
        const deviceStorage = storageManager.createContext("Device");
        const deviceName = "Home Secure Bridge";
        const productName = `Home Secure Bridge`;
        const deviceType = DeviceTypes.AGGREGATOR.code;
        const vendorName = "matter-node.js";
        const passcode = deviceStorage.get("passcode", 20202021);
        const discriminator = deviceStorage.get("discriminator", 3840);
        const vendorId = deviceStorage.get("vendorid", 0xfff1);
        const productId = deviceStorage.get("productid", 0x8001);
        const netInterface = getParameter("netinterface");
        const uniqueId = deviceStorage.get("uniqueid", Time.nowMs());
        deviceStorage.set("passcode", passcode);
        deviceStorage.set("discriminator", discriminator);
        deviceStorage.set("vendorid", vendorId);
        deviceStorage.set("productid", productId);
        deviceStorage.set("uniqueid", uniqueId);
        this.matterServer = new MatterServer(storageManager, { mdnsInterface: netInterface });
        const commissioningServer = new CommissioningServer({
            port : 5540,
            deviceName,
            deviceType,
            passcode,
            discriminator,
            basicInformation: {
                vendorName,
                vendorId: VendorId(vendorId),
                nodeLabel: productName,
                productName,
                productLabel: productName,
                productId,
                serialNumber: `node-matter-${uniqueId}`,
            },
        });
        const aggregator = new Aggregator();
        const managerOfZigbee = new Supervisor(configuration, aggregator);
        await managerOfZigbee.Start();
        commissioningServer.addDevice(aggregator);
        await this.matterServer.addCommissioningServer(commissioningServer);
        await this.matterServer.start();
        if (!commissioningServer.isCommissioned()) {
            const pairingData = commissioningServer.getPairingCode();
            const { qrPairingCode, manualPairingCode } = pairingData;
            console.log(QrCode.get(qrPairingCode));
            console.log(
                `QR Code URL: https://project-chip.github.io/connectedhomeip/qrcode.html?data=${qrPairingCode}`,
            );
            console.log(`Manual pairing code: ${manualPairingCode}`);
        } else {
            console.log("Device is already commissioned. Waiting for controllers to connect ...");
        }
    }

    async stop() {
        await this.matterServer?.close();
        await storage.close();
    }
}

const managerOfBridge = new Bridge();

(async () => await managerOfBridge.start())();
process.on("SIGINT", async () => {
    await managerOfBridge.stop();
    process.exit(0);
});