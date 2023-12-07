import { DefaultConfigureReportingItem } from "./Definitions";

export interface ConfigureReportingItem extends ConfigureReportingItemSpecification {
  attribute: number;
}

export interface ConfigureReportingItemSpecification {
  minimumReportInterval: number;
  maximumReportInterval: number;
  reportableChange: number;
}

interface ConfigureReportingItemType {
  [identifier: number] : Partial<ConfigureReportingItemSpecification>
};

interface TransformationType {
  [identifier: number] : (payload: any) => any
};

export interface DefinitionType {
  [identifier: number] : Definition
};

export interface Definition {
  rd_at_tr?: TransformationType, // Read Attribute/Report Attribute Trasformation
  ex_cm_tr?: TransformationType, // Execute Command Transformation
  cr?: ConfigureReportingItemType, //Configure Server Reporting Setup
}