import { Aggregator, DeviceTypeDefinition, DeviceTypes } from "@project-chip/matter-node.js/device";
import { BridgedDevice } from "./BridgedDevice";
import { Controller } from "zigbee-herdsman";
import { Device, Endpoint } from "zigbee-herdsman/dist/controller/model";
import { DeviceInterviewPayload, MessagePayload, PermitJoinChangedPayload } from "zigbee-herdsman/dist/controller/events";
import { DefaultConfigureReportingItem, Definitions } from "./Definitions";
import Cluster from "zigbee-herdsman/dist/zcl/definition/cluster";
import { ClusterId } from "@project-chip/matter-node.js/datatype";
import { IdentifyCluster, OnOff } from "@project-chip/matter-node.js/cluster";
import { Configuration, ConfigureReportingItem } from "./Model";

interface DetectorResponse {
  deviceTypeDefinition: DeviceTypeDefinition,
  rank: number,
  uncoveredClusters: number[]
}

export class Supervisor {
  private mapping: Map<string, BridgedDevice> = new Map<string, BridgedDevice>();
  private connection: Controller | undefined;
  private permitJoinDeviceFactory: BridgedDevice | undefined;
  constructor(private configuration: Configuration, private aggregator: Aggregator) { }

  async Start() {
    this.connection = new Controller({
      serialPort: {
        adapter: this.configuration.zigbee.adapter,
        baudRate: this.configuration.zigbee.baudRate,
        path: this.configuration.zigbee.path,
        rtscts: this.configuration.zigbee.rtscts
      },
      databasePath: "./working/database",
      network: {
        panID: 1234,
        channelList: [11],
        networkKey: [0x01, 0x03, 0x05, 0x07, 0x09, 0x0B, 0x0D, 0x0F, 0x00, 0x02, 0x04, 0x06, 0x08, 0x0A, 0x0C, 0x0D],
      },
      adapter: {
        disableLED: false
      },
      backupPath: "./working/backup",
      acceptJoiningDeviceHandler: async () => true,
      databaseBackupPath: "./working/database.backup",
    });
    this.connection.addListener("deviceInterview", async (payload: DeviceInterviewPayload) => await this.DeviceInterview(payload));
    this.connection.addListener("message", async (payload: MessagePayload) => this.Message(payload));
    this.connection.addListener("permitJoinChanged", async (payload: PermitJoinChangedPayload) => this.PermitJoinChanged(payload));
    await this.connection.start();
    this.PermitJoin();
    var devices = await this.connection.getDevices();
    for (const device of devices) {
      //this.DeviceInterview1(device);
      for (const endpoint of device.endpoints) {
        this.Analyze(endpoint, endpoint.inputClusters);
      }
    }
  }

  Message(payload: MessagePayload) {
    if (payload.type === "attributeReport" || payload.type === "readResponse") {
      let endpoint = payload.endpoint;
      let cluster = Cluster[payload.cluster];
      if (!cluster) {
        return;
      }
      let key = `${endpoint.deviceIeeeAddress}:${endpoint.ID}:${cluster.ID}`;
      if (!key) {
        return;
      }
      let deviceFactory = this.mapping.get(key);
      if (!deviceFactory) {
        return;
      }
      let mCluster = deviceFactory.getClusterServerById(ClusterId(cluster.ID));
      if (!mCluster) {
        return;
      }
      let attributes = Object.getOwnPropertyNames(payload.data);
      for (let attribute of attributes) {
        if (mCluster.isAttributeSupportedByName(attribute)) {
          let value = (<any>payload.data)[attribute];
          let attribute1 = mCluster.attributes[attribute];
          let key = `${cluster.ID}.${attribute1.id}`;
          let fn = Definitions[cluster.ID]?.rd_at_tr?.[attribute1.id];
          value = fn ? fn(value) : value;
          attribute1.setLocal(value);
          console.log(`${deviceFactory.uniqueId}\\${key}\\${attribute} = ${value}`);
        }
      }
    }
  }

  private async PermitJoinChanged(payload: PermitJoinChangedPayload) {
    this.permitJoinDeviceFactory?.getClusterServer(OnOff.Cluster)?.setOnOffAttribute(payload.permitted);
  }

  private async DeviceInterview(payload: DeviceInterviewPayload) {
    if (payload.status !== "successful") {
      return;
    }
    var device = payload.device;
    await this.DeviceInterview1(device);
  }

  private async DeviceInterview1(device: Device) {
    for (const endpoint of device.endpoints) {
      console.log(`Configuration: ${device.ieeeAddr}, ${endpoint.ID}`);
      for (let [cluster1, definition] of Object.entries(Definitions)) {
        let cluster = parseInt(cluster1);
        if (endpoint.inputClusters.indexOf(cluster) === -1) {
          continue;
        }
        try {
          const destination = this.connection!.getDeviceByNetworkAddress(0).getEndpoint(1);
          let missing = !endpoint.binds.filter(bind => bind.cluster.ID === cluster && (<Endpoint>bind.target)?.deviceIeeeAddress === destination.deviceIeeeAddress && (<Endpoint>bind.target)?.ID === 1)?.length;
          if (missing) {
            console.log(`Binding: ${device.ieeeAddr}, ${endpoint.ID}, ${cluster}`);
            await endpoint.bind(cluster, destination);
          }
        } catch { }
        if (definition.cr) {
          let configureServerReporting: ConfigureReportingItem[] = [];
          for (const [attribute, cfg] of Object.entries(definition.cr)) {
            let missing = endpoint.configuredReportings.filter(cr1 => cr1.attribute.ID === parseInt(attribute));
            if (missing) {
              configureServerReporting.push(<ConfigureReportingItem>Object.assign({}, DefaultConfigureReportingItem, { attribute: parseInt(attribute) }, cfg));
            }
          }
          if (configureServerReporting.length) {
            try {
              console.log(`Configure: ${device.ieeeAddr}, ${endpoint.ID}, ${cluster}`);
              await endpoint.configureReporting(cluster, configureServerReporting);
            } catch { }
          }
        }
      }
      this.Analyze(endpoint, endpoint.inputClusters);
    }
  }

  private Analyze(endpoint: Endpoint, inputClusters: number[], index: number = 1) {
    console.log(`Analyzing: ${inputClusters}`);
    var detector = this.Detector(inputClusters);
    if (!detector) {
      return;
    }
    var deviceTypeDefinition = detector.deviceTypeDefinition;
    if (deviceTypeDefinition) {
      //let product = `${endpoint.getDevice().manufacturerName} ${endpoint.getDevice().modelID}`;
      let product = `${endpoint.getDevice().modelID}`;
      const name = `${product} ${endpoint.deviceIeeeAddress.substring(12)}/${endpoint.ID}/${index}`;
      const deviceFactory = new BridgedDevice(name, product, deviceTypeDefinition, `${endpoint.getDevice().ieeeAddr}:${endpoint.ID}:${index}`);
      for (var cluster of deviceTypeDefinition.requiredServerClusters.map(c => c.valueOf())) {
        deviceFactory.addClusterServerGeneric(cluster, endpoint);
        const key = `${endpoint.deviceIeeeAddress}:${endpoint.ID}:${cluster}`;
        this.mapping.set(key, deviceFactory);
        console.log(`Adding: ${endpoint.deviceIeeeAddress}, ${endpoint.ID}, ${cluster} on ${name} of type ${deviceTypeDefinition.name}`);
      }
      deviceFactory.addBridgedDevice(this.aggregator);
    }
    this.Analyze(endpoint, detector.uncoveredClusters, ++index);
  }

  Detector(serverClusters: number[]): DetectorResponse | undefined {
    serverClusters = serverClusters.filter(item => item !== IdentifyCluster.id);
    var map: DetectorResponse[] = [];
    for (let [_, deviceTypeDefinition] of Object.entries(DeviceTypes)) {
      const requiredServerClusters = deviceTypeDefinition.requiredServerClusters.map(item => item.valueOf()).filter(item => item !== IdentifyCluster.id);
      if (requiredServerClusters.length === 0) {
        continue;
      }
      if (requiredServerClusters.filter(item => serverClusters.indexOf(item) < 0).length) {
        continue;
      }
      let uncoveredClusters = serverClusters.filter(item => requiredServerClusters.indexOf(item) < 0);
      const optionalServerClusters = deviceTypeDefinition.optionalServerClusters.map(item => item.valueOf()).filter(item => item !== IdentifyCluster.id);
      uncoveredClusters = uncoveredClusters.filter(item => optionalServerClusters.indexOf(item) < 0);
      map.push({
        deviceTypeDefinition,
        rank: requiredServerClusters.length - uncoveredClusters.length,
        uncoveredClusters
      });
    }
    return map.sort((a, b) => b.rank - a.rank).at(0);
  }

  private PermitJoin() {
    this.permitJoinDeviceFactory = new BridgedDevice("Apri rete", "AG", DeviceTypes.ON_OFF_LIGHT);
    console.log(`Adding: ${this.permitJoinDeviceFactory.name} -> OnOff`);
    this.permitJoinDeviceFactory.addOnOffServer({
      on: async () => {
        await this.connection?.permitJoin(true, undefined, 200);
        this.permitJoinDeviceFactory?.getClusterServer(OnOff.Cluster)?.setOnOffAttribute(true);
      },
      off: async () => {
        await this.connection?.permitJoin(false);
        this.permitJoinDeviceFactory?.getClusterServer(OnOff.Cluster)?.setOnOffAttribute(false);
      },
      toggle: async () => { }
    });
    this.permitJoinDeviceFactory.addBridgedDevice(this.aggregator);
  }
}