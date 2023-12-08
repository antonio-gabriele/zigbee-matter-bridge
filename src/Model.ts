import { SerialPortOptions } from "zigbee-herdsman/dist/adapter/tstype";

export interface ConfigureReportingItem extends ConfigureReportingItemSpecification {
  attribute: number;
}

export interface ConfigureReportingItemSpecification {
  minimumReportInterval: number;
  maximumReportInterval: number;
  reportableChange: number;
}

export interface ConfigurationZigbee {
  adapter?: 'zstack' | 'deconz' | 'zigate' | 'ezsp' | 'auto',
  baudRate: number,
  path: string,
  rtscts: boolean,
  network: any;
}

export interface Configuration {
  zigbee: ConfigurationZigbee;
}

interface ConfigureReportingItemType {
  [identifier: number]: Partial<ConfigureReportingItemSpecification>
};

interface TransformationType {
  [identifier: number]: (payload: any) => any
};

export interface DefinitionType {
  [identifier: number]: Definition
};

export interface Definition {
  rd_at_tr?: TransformationType, // Read Attribute/Report Attribute Trasformation
  ex_cm_tr?: TransformationType, // Execute Command Transformation
  cr?: ConfigureReportingItemType, //Configure Server Reporting Setup
}