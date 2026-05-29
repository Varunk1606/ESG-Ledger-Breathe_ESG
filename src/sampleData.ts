/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { RawSAPRecord, RawUtilityRecord, RawTravelRecord } from "./types.js";

export const SAMPLE_TENANTS = [
  { id: "tenant-acme-global", name: "Acme Corp (Global Operations)", region: "Global/US-EU", currency: "USD" },
  { id: "tenant-acme-europe", name: "Acme EMEA Holding Gmbh", region: "EU/DE-FR", currency: "EUR" }
];

export const RAW_SAP_SAMPLE: RawSAPRecord[] = [
  {
    id: "sap-01",
    BELNR: "100200340",
    BUDAT: "21.05.2026",
    MATNR: "MAT-F-100", // Diesel
    MENGE: "8,500",
    MEINS: "L",
    WRBTR: "9,520.00",
    WAERS: "EUR",
    WERK: "PL01" // Frankfurt Assembly
  },
  {
    id: "sap-02",
    BELNR: "100200341",
    BUDAT: "14.05.2026",
    MATNR: "MAT-F-100", // Diesel
    MENGE: "2,200",
    MEINS: "GAL", // Inconsistent Unit (Gallons)
    WRBTR: "6,800.00",
    WAERS: "USD",
    WERK: "PL02" // Texas Data Center
  },
  {
    id: "sap-03",
    BELNR: "100200342",
    BUDAT: "18.05.2026",
    MATNR: "MAT-F-100",
    MENGE: "800",
    MEINS: "L",
    WRBTR: "1,120.00",
    WAERS: "EUR",
    WERK: "PL03" // UNMAPPED PLANT (Failure warning)
  },
  {
    id: "sap-04",
    BELNR: "100200343",
    BUDAT: "05.05.2026",
    MATNR: "MAT-F-100",
    MENGE: "115,000", // Outlier limit breach (>40k liters)
    MEINS: "L",
    WRBTR: "135,000.00",
    WAERS: "EUR",
    WERK: "PL01"
  },
  {
    id: "sap-05",
    BELNR: "100200344",
    BUDAT: "10.05.2026",
    MATNR: "MAT-F-100",
    MENGE: "ERR_UNITS_VAL", // Invalid numerical volume (Critical Failure)
    MEINS: "L",
    WRBTR: "1,200.00",
    WAERS: "EUR",
    WERK: "PL01"
  },
  {
    id: "sap-06",
    BELNR: "420001092",
    BUDAT: "20260515", // Alternate SAP Date string BUDAT style (YYYYMMDD)
    MATNR: "MAT-P-302", // Steel Plates (Scope 3 Category 1)
    MENGE: "24,000",
    MEINS: "KG",
    WRBTR: "48,200.00",
    WAERS: "EUR",
    WERK: "PL01"
  },
  {
    id: "sap-07",
    BELNR: "100200355",
    BUDAT: "28.05.2026",
    MATNR: "MAT-F-200", // Natural Gas
    MENGE: "4,100",
    MEINS: "M3",
    WRBTR: "5,400.00",
    WAERS: "EUR",
    WERK: "PL04" // Paris Fulfillment Center (Low emission factor context)
  }
];

export const RAW_UTILITY_SAMPLE: RawUtilityRecord[] = [
  {
    id: "util-01",
    METER_ID: "MTR-CHIC-55A",
    ZIP_CODE: "60601",
    SERVICE_START: "2026-04-10",
    SERVICE_END: "2026-05-10",
    USAGE_KWH: "18,400",
    RATE_CHG: "COM-MID-A",
    CHARGES_USD: "2,350.00",
    INVOICE_NUM: "INV-UTIL-199"
  },
  // Double-billing warning overlaps: Same meter, overlapping billing intervals
  {
    id: "util-02",
    METER_ID: "MTR-AUST-77X",
    ZIP_CODE: "75001",
    SERVICE_START: "2026-05-01",
    SERVICE_END: "2026-05-31",
    USAGE_KWH: "64,200",
    RATE_CHG: "E19-TX-A",
    CHARGES_USD: "7,400.00",
    INVOICE_NUM: "INV-TX-344"
  },
  {
    id: "util-03",
    METER_ID: "MTR-AUST-77X",
    ZIP_CODE: "75001",
    SERVICE_START: "2026-05-15", // Overlaps with the interval 2026-05-15 to 2026-05-31!
    SERVICE_END: "2026-06-15",
    USAGE_KWH: "58,100",
    RATE_CHG: "E19-TX-A",
    CHARGES_USD: "6,820.00",
    INVOICE_NUM: "INV-TX-504"
  },
  {
    id: "util-04",
    METER_ID: "MTR-PAR-22Q",
    ZIP_CODE: "02002", // Low carbon nuclear subgrid
    SERVICE_START: "2026-05-01",
    SERVICE_END: "2026-05-31",
    USAGE_KWH: "110,000", // Large volume, but low grid factor
    RATE_CHG: "FR-ENG-COM",
    CHARGES_USD: "12,900.00",
    INVOICE_NUM: "INV-FR-022"
  },
  {
    id: "util-05",
    METER_ID: "MTR-FRNK-02P",
    ZIP_CODE: "01001",
    SERVICE_START: "2026-05-01",
    SERVICE_END: "2026-05-31",
    USAGE_KWH: "-230", // Negative usage electrical error (Critical failure)
    RATE_CHG: "DE-COMM",
    CHARGES_USD: "-50.00",
    INVOICE_NUM: "INV-DE-55"
  }
];

export const RAW_TRAVEL_SAMPLE: RawTravelRecord[] = [
  {
    id: "trv-01",
    TRIP_ID: "TRP-9092",
    EMPLOYEE_ID: "EMP-411",
    TRAVEL_TYPE: "FLIGHT",
    START_DATE: "2026-05-10",
    END_DATE: "2026-05-10",
    DEPART_ARP: "SFO",
    ARRIVE_ARP: "JFK",
    CABIN_CLASS: "ECONOMY",
    COST_USD: "450.00"
    // Distance missing, must calculate Great-Circle via airport lookup tables
  },
  {
    id: "trv-02",
    TRIP_ID: "TRP-9093",
    EMPLOYEE_ID: "EMP-012",
    TRAVEL_TYPE: "FLIGHT",
    START_DATE: "2026-05-15",
    END_DATE: "2026-05-16",
    DEPART_ARP: "SFO",
    ARRIVE_ARP: "LHR", // London
    CABIN_CLASS: "FIRST", // Class multiplier: high emission rate
    COST_USD: "8,400.00"
  },
  {
    id: "trv-03",
    TRIP_ID: "TRP-9094",
    EMPLOYEE_ID: "EMP-388",
    TRAVEL_TYPE: "HOTEL",
    START_DATE: "2026-05-01",
    END_DATE: "2026-05-08",
    NIGHTS: "7",
    COUNTRY: "FR", // Low hotel night coefficient
    CITY: "Paris",
    COST_USD: "1,400.00"
  },
  {
    id: "trv-04",
    TRIP_ID: "TRP-9095",
    EMPLOYEE_ID: "EMP-388",
    TRAVEL_TYPE: "HOTEL",
    START_DATE: "2026-05-08",
    END_DATE: "2026-05-12",
    NIGHTS: "4",
    COUNTRY: "IN", // High hotel night coefficient (Coal-heavy grid energy matrix)
    CITY: "Bangalore",
    COST_USD: "560.00"
  },
  {
    id: "trv-05",
    TRIP_ID: "TRP-9096",
    EMPLOYEE_ID: "EMP-502",
    TRAVEL_TYPE: "GROUND",
    START_DATE: "2026-05-20",
    END_DATE: "2026-05-22",
    FUEL_TYPE: "ELECTRIC", // Electric Vehicle efficiency multiplier
    DISTANCE_KM: "450",
    COST_USD: "120.00"
  },
  {
    id: "trv-06",
    TRIP_ID: "TRP-9097",
    EMPLOYEE_ID: "EMP-502",
    TRAVEL_TYPE: "GROUND",
    START_DATE: "2026-05-24",
    END_DATE: "2026-05-25",
    FUEL_TYPE: "GASOLINE",
    COST_USD: "190.00"
    // Distance missing, triggers expenditure carbon proxy warnings
  },
  {
    id: "trv-07",
    TRIP_ID: "TRP-9098",
    EMPLOYEE_ID: "EMP-101",
    TRAVEL_TYPE: "FLIGHT",
    START_DATE: "2026-05-28",
    END_DATE: "2026-05-28",
    DEPART_ARP: "SFO",
    ARRIVE_ARP: "XXX", // Invalid Airport code (Triggers coordinate failure & fallback)
    CABIN_CLASS: "ECONOMY",
    COST_USD: "550.00"
  }
];
