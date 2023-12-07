import { DefinitionType, ConfigureReportingItemSpecification } from "./Model";

export var DefaultConfigureReportingItem: ConfigureReportingItemSpecification = { maximumReportInterval: 300, minimumReportInterval: 1, reportableChange: 1 };

//Here we must use base 10 number by convention. No hex notation!!!

export var Definitions: DefinitionType = {
  6:
  {
    cr: {
      0: {}
    },
    rd_at_tr: {
      0: (value: any) => !!value // It must be boolean
    }
  },
  8:
  {
    cr: {
      0: {}
    },
    ex_cm_tr: {
      0: (payload: any) => Object.assign(payload, { transtime: payload.transitionTime })
    }
  },
  15:
  {
    cr: {
      85: {},
      111: {}
    }
  },
  1026:
  {
    cr: {
      0: { reportableChange: 5 }
    }
  },
  1029:
  {
    cr: {
      0: {}
    },
  },
  1030:
  {
    cr: {
      0: {}
    },
  },
  2820:
  {
    cr: {
      0: {}
    },
  },
};