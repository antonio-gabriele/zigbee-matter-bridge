import {
  AllClustersMap,
  ClusterServer,
  ClusterServerHandlers,
  Identify,
  OnOff,
  createDefaultGroupsClusterServer,
  createDefaultIdentifyClusterServer,
  createDefaultScenesClusterServer
} from "@project-chip/matter-node.js/cluster";
import { extendPublicHandlerMethods } from "@project-chip/matter-node.js/util";
import { Aggregator, Device, DeviceTypeDefinition, WrapCommandHandler } from "@project-chip/matter-node.js/device";
import { ClusterId } from "@project-chip/matter-node.js/datatype";
import { Endpoint } from "zigbee-herdsman/dist/controller/model";
import { Definitions } from "./Definitions";

type BaseDeviceCommands = {
  identify: ClusterServerHandlers<typeof Identify.Cluster>["identify"];
};

function delay() {
  return new Promise(resolve => setTimeout(resolve, 1000));
}

export class BridgedDevice extends extendPublicHandlerMethods<typeof Device, BaseDeviceCommands>(Device) {

  public uniqueId: string;
  constructor(name: string, private product: string, deviceTypeDefinition: DeviceTypeDefinition, uniqueId: string | null = null) {
    super(deviceTypeDefinition);
    this.name = name;
    this.uniqueId = uniqueId ?? name.replaceAll(" ", "_").toLocaleLowerCase();;
    this.addClusterServer(
      createDefaultIdentifyClusterServer({
        identify: async data => await this._executeHandler("identify", data),
      }),
    );
    this.addClusterServer(createDefaultGroupsClusterServer());
    this.addClusterServer(createDefaultScenesClusterServer());
  }

  addClusterServerGeneric(clusterId: number, endpoint: Endpoint) {
    let cluster = AllClustersMap[ClusterId(clusterId)];
    let commands: any = {};
    for (let [key, command] of Object.entries(cluster.commands)) {
      console.log(`Adding commands ${key}`);
      commands[key] = async (obj: any) => {
        let request = obj.request;
        let commandId = (<any>command).requestId;
        let definition = Definitions[cluster.id];
        let fn = definition.ex_cm_tr ? definition.ex_cm_tr[commandId] : null;
        request = fn ? fn(request) : request;
        console.log(`Executing command ${key} ${commandId}`);
        await endpoint.command(cluster.id, commandId, request);
        await delay();
      };
    }
    let attributes: any = {};
    let commandHandler = WrapCommandHandler(commands, this.commandHandler);
    for (let [key, attribute] of Object.entries(cluster.attributes)) {
      attributes[key] = (<any>attribute).default;
    }
    this.addClusterServer(ClusterServer(cluster, attributes, <any>commandHandler));
  }

  addOnOffServer(onOffClusterHandler: ClusterServerHandlers<typeof OnOff.Base>) {
    this.addClusterServer(
      ClusterServer(OnOff.Cluster,
        {
          onOff: false,
        },
        WrapCommandHandler(onOffClusterHandler, this.commandHandler)));
  }

  addBridgedDevice(aggregator: Aggregator) {
    if (this.id !== undefined && aggregator.getChildEndpoint(this.id) !== undefined) {
      aggregator.removeBridgedDevice(this);
    }
    aggregator.addBridgedDevice(this, {
      nodeLabel: this.name,
      productName: this.product,
      productLabel: this.name,
      serialNumber: this.uniqueId,
      reachable: true,
    });
  }

}