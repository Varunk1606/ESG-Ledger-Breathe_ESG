/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum SourceType {
  SAP_FUEL_PROCUREMENT = "sap_fuel_procurement",
  UTILITY_ELECTRICITY = "utility_electricity",
  CORP_TRAVEL = "corp_travel"
}

export enum RecordStatus {
  PENDING = "pending",
  APPROVED = "approved",
  FAILED = "failed",
  FLAGGED = "flagged" // Suspicious
}

export enum ScopeType {
  SCOPE_1 = "Scope 1", // Direct emissions (e.g. combusting fuel, SAP gas/diesel)
  SCOPE_2 = "Scope 2", // Indirect emissions (e.g. purchased electricity)
  SCOPE_3 = "Scope 3"  // Value chain (e.g. travel, purchased goods)
}

export interface Tenant {
  id: string;
  name: string;
  region: string;
  currency: string;
}

// Raw SAP shape
export interface RawSAPRecord {
  id: string;
  BELNR: string;       // Document Number
  BUDAT: string;       // Posting Date (e.g. "DD.MM.YYYY" or "YYYY-MM-DD")
  MATNR: string;       // Material ID / Fuel ID (e.g. MAT-F-100, MAT-P-302)
  MENGE: string;       // Fuel Quantity (string to mimic untyped flat export)
  MEINS: string;       // SAP Unit (e.g. L, GAL, TO, KG)
  WRBTR: string;       // Original transaction cost
  WAERS: string;       // Currency (e.g. EUR, USD, GBP)
  WERK: string;        // Plant/Facility Code (e.g. PL01, PL02)
}

// Raw Utility Electricity shape
export interface RawUtilityRecord {
  id: string;
  METER_ID: string;      // Meter ID
  ZIP_CODE: string;      // Zip code / subregion code
  SERVICE_START: string; // Service period start
  SERVICE_END: string;   // Service period end
  USAGE_KWH: string;     // Utility raw consumption
  RATE_CHG: string;      // Rate schedule (e.g. TOU-A, COM-E19)
  CHARGES_USD: string;   // Cost component
  INVOICE_NUM: string;   // Invoice identifier
}

// Raw Travel shape
export interface RawTravelRecord {
  id: string;
  TRIP_ID: string;
  EMPLOYEE_ID: string;
  TRAVEL_TYPE: "FLIGHT" | "HOTEL" | "GROUND";
  START_DATE: string;    // Start/Check-In Date
  END_DATE: string;      // End/Check-Out Date
  
  // Flights
  DEPART_ARP?: string;   // Exit airport, e.g. "SFO"
  ARRIVE_ARP?: string;   // Entry airport, e.g. "JFK"
  CABIN_CLASS?: "ECONOMY" | "BUSINESS" | "FIRST";
  
  // Hotels
  NIGHTS?: string;
  COUNTRY?: string;      // Country code, e.g. "DE", "FR", "US"
  CITY?: string;
  
  // Ground
  FUEL_TYPE?: "ELECTRIC" | "DIESEL" | "GASOLINE" | "HYBRID";
  DISTANCE_KM?: string;  // Sometimes missing
  COST_USD: string;
}

export interface Anomaly {
  type: "CRITICAL" | "WARNING";
  code: string;
  description: string;
}

export interface AuditTrailEntry {
  userId: string;
  userName: string;
  timestamp: string;
  fieldName: string;
  previousValue: string;
  newValue: string;
}

export interface NormalizedESGRecord {
  id: string;
  tenantId: string;
  sourceType: SourceType;
  rawPayload: RawSAPRecord | RawUtilityRecord | RawTravelRecord;
  status: RecordStatus;
  
  // Normalization fields
  scope: ScopeType;
  scopeCategory: string; // e.g. "Scope 3 Category 6 (Business Travel)"
  
  // Activity metrics normalized
  activityValue: number; // e.g., liters of gas, kilowatt hours, flight kms
  activityUnit: string;  // Normalized Unit (e.g., L, kWh, km, room-night)
  
  // Emission calculations
  co2eKg: number;        // Calculated carbon footprint in kg CO2e
  emissionFactorUsed: number; // e.g., kg CO2e per unit
  emissionFactorSrc: string;  // e.g., "DEFRA 2025", "eGRID v14", "GHG Protocol"
  
  // Financial metrics normalized
  costUSD: number;
  
  // Metadata for auditing
  plantOrLocation: string; // Resolved name/site
  servicePeriodMonth: string; // Calendar Month resolved for pro-rata (YYYY-MM)
  ingestedAt: string;
  approvedAt?: string;
  approvedBy?: string;
  
  // Anomaly reporting
  anomalies: Anomaly[];
  
  // Logging changes
  auditTrail: AuditTrailEntry[];
}

export interface PlantMapping {
  code: string;
  name: string;
  region: string;
  gridFactorKgKwh: number; // Scope 2 grid intensity coefficient
}

export interface AirportCoordinate {
  code: string;
  name: string;
  lat: number;
  lon: number;
}
