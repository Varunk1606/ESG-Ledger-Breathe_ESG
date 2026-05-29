/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  NormalizedESGRecord, 
  SourceType, 
  RecordStatus, 
  ScopeType, 
  RawSAPRecord, 
  RawUtilityRecord, 
  RawTravelRecord,
  Anomaly,
  PlantMapping,
  AirportCoordinate
} from "./types.js"; // Standard typescript extension import

// Plant to location mapping
export const PLANT_DATABASE: Record<string, PlantMapping> = {
  "PL01": { code: "PL01", name: "Frankfurt Assembly Plant (EU-DE)", region: "DE", gridFactorKgKwh: 0.35 },
  "PL02": { code: "PL02", name: "Austin Data Center & Office (US-TX)", region: "US", gridFactorKgKwh: 0.44 },
  "PL04": { code: "PL04", name: "Paris Fulfillment Center (EU-FR)", region: "FR", gridFactorKgKwh: 0.06 }
};

// Airport locations
export const AIRPORT_DATABASE: Record<string, AirportCoordinate> = {
  SFO: { code: "SFO", name: "San Francisco International Airport", lat: 37.619, lon: -122.375 },
  JFK: { code: "JFK", name: "John F. Kennedy International Airport", lat: 40.640, lon: -73.779 },
  LHR: { code: "LHR", name: "London Heathrow Airport", lat: 51.470, lon: -0.454 },
  CDG: { code: "CDG", name: "Charles de Gaulle Airport (Paris)", lat: 49.010, lon: 2.550 },
  BLR: { code: "BLR", name: "Kempegowda International Airport (Bangalore)", lat: 13.199, lon: 77.707 },
  DXB: { code: "DXB", name: "Dubai International Airport", lat: 25.253, lon: 55.364 },
  SIN: { code: "SIN", name: "Singapore Changi Airport", lat: 1.364, lon: 103.991 },
  NRT: { code: "NRT", name: "Narita International Airport (Tokyo)", lat: 35.772, lon: 140.393 }
};

// Regional subgrid emission intensities (kg CO2e per kWh)
export const UTILITY_SUBGRID_FACTORS: Record<string, { desc: string; factor: number }> = {
  "94103": { desc: "US-WECC (Pacific / Green Zone)", factor: 0.22 },
  "75001": { desc: "US-ERCOT (Texas Grid / High Fossil)", factor: 0.44 },
  "60601": { desc: "US-SRMW (Midwest Grid)", factor: 0.38 },
  "10001": { desc: "US-NPCC (New York)", factor: 0.18 },
  "01001": { desc: "EU-DE-Frankfurt Grid", factor: 0.35 },
  "02002": { desc: "EU-FR-Paris Grid (Low Carbon)", factor: 0.06 }
};

// Exchange rates (Default base USD)
export const EX_RATES: Record<string, number> = {
  USD: 1.0,
  EUR: 1.12,
  GBP: 1.28
};

// Fuel emission factors
export const MATERIAL_DATABASE = {
  "MAT-F-100": { name: "Diesel Fuel (Commercial)", scope: ScopeType.SCOPE_1, cat: "Stationary Combustion", factor: 2.68, unit: "L" },
  "MAT-F-200": { name: "Natural Gas (Heating)", scope: ScopeType.SCOPE_1, cat: "Stationary Combustion", factor: 2.05, unit: "M3" },
  "MAT-P-302": { name: "Steel Structural Plates", scope: ScopeType.SCOPE_3, cat: "Purchased Goods (Cat 1)", factor: 1.85, unit: "KG" },
  "MAT-P-110": { name: "Extruded Aluminium Core", scope: ScopeType.SCOPE_3, cat: "Purchased Goods (Cat 1)", factor: 0.45, unit: "KG" }
};

// Haversine calculation
export function calculateGarmentDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return Math.round(R * c);
}

// Date parsing for irregular date strings
export function parseIrregularDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const trimmed = dateStr.trim();
  
  // DD.MM.YYYY (German billing format standard)
  const deMatch = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (deMatch) {
    return new Date(parseInt(deMatch[3]), parseInt(deMatch[2]) - 1, parseInt(deMatch[1]));
  }
  
  // YYYYMMDD (SAP flat file raw style)
  const sapMatch = trimmed.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (sapMatch) {
    return new Date(parseInt(sapMatch[1]), parseInt(sapMatch[2]) - 1, parseInt(sapMatch[3]));
  }
  
  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    return parsed;
  }
  return null;
}

// Calendar Month formatting helper (e.g., "YYYY-MM")
export function formatDateToMonthString(date: Date): string {
  const years = date.getFullYear();
  const months = String(date.getMonth() + 1).padStart(2, '0');
  return `${years}-${months}`;
}

export function normalizeSAP(raw: RawSAPRecord, tenantId: string): NormalizedESGRecord {
  const anomalies: Anomaly[] = [];
  let status = RecordStatus.PENDING;
  
  // Budget values
  const docNum = raw.BELNR || "MISSING";
  const rawDate = raw.BUDAT || "";
  const materialCode = raw.MATNR || "";
  const rawQty = raw.MENGE || "";
  const rawUnit = raw.MEINS || "";
  const rawCost = raw.WRBTR || "";
  const origCurr = raw.WAERS ? raw.WAERS.trim().toUpperCase() : "EUR";
  const plantCode = raw.WERK || "";
  
  // Parse numeric values
  const qtyNumeric = parseFloat(rawQty.replace(/,/g, ''));
  const costNumeric = parseFloat(rawCost.replace(/,/g, ''));
  
  const parsedDate = parseIrregularDate(rawDate);
  const servicePeriodMonth = parsedDate ? formatDateToMonthString(parsedDate) : "1970-01";
  
  if (!rawDate || !parsedDate) {
    anomalies.push({ type: "CRITICAL", code: "INVALID_DATE", description: `Incoherent posting date standard: "${rawDate}"` });
    status = RecordStatus.FAILED;
  }
  
  if (isNaN(qtyNumeric) || qtyNumeric <= 0) {
    anomalies.push({ type: "CRITICAL", code: "INVALID_QTY", description: `Combustible volume parsed as invalid or non-positive: "${rawQty}"` });
    status = RecordStatus.FAILED;
  }
  
  // Cost normalizations
  let costUSD = 0;
  const fxScalar = EX_RATES[origCurr] || 1.12; // default EUR-to-USD rate
  if (!isNaN(costNumeric)) {
    costUSD = Math.round(costNumeric * fxScalar * 100) / 100;
  } else {
    anomalies.push({ type: "WARNING", code: "INVALID_COST", description: `Original finance posting cost looks corrupt: "${rawCost}"` });
  }
  
  // Plant lookup table checks
  const plantProfile = PLANT_DATABASE[plantCode];
  let siteName = plantCode ? `SAP Plant: ${plantCode}` : "Unspecified Facility";
  if (!plantProfile && plantCode) {
    anomalies.push({ type: "WARNING", code: "UNRESOLVED_PLANT", description: `Corporate SAP Plant ID "${plantCode}" lacks mapping schema.` });
  } else if (plantProfile) {
    siteName = plantProfile.name;
  }
  
  // Fuel emission mapping
  let normValue = qtyNumeric;
  let normUnit = rawUnit;
  let computedKgCO2e = 0;
  let scope = ScopeType.SCOPE_3;
  let scopeDesc = "Scope 3 Category 1 - Purchased Goods & Services";
  let efFactor = 0;
  let efSrc = "Corporate General ESG coefficients";
  
  const matInfo = MATERIAL_DATABASE[materialCode as keyof typeof MATERIAL_DATABASE];
  if (!matInfo) {
    anomalies.push({ type: "WARNING", code: "MAT_UNMAPPED", description: `Material code "${materialCode}" is unknown. Carbon estimated via default cargo factor.` });
    computedKgCO2e = isNaN(qtyNumeric) ? 0 : qtyNumeric * 0.5; // fallback
    efFactor = 0.5;
    efSrc = "GHG Generic Fallback";
  } else {
    scope = matInfo.scope;
    scopeDesc = `${matInfo.scope} - ${matInfo.cat}`;
    efFactor = matInfo.factor;
    efSrc = `DEFRA Carbon Database / GHG ${matInfo.cat}`;
    
    // Normalize gallons to liters or tonnage to kg if they mismatch the emission engine
    const cleanUnit = rawUnit.toUpperCase().trim();
    if (matInfo.unit === "L") {
      if (cleanUnit === "GAL" || cleanUnit === "G") {
        normValue = Math.round(qtyNumeric * 3.78541 * 100) / 100;
        normUnit = "L";
      } else if (cleanUnit === "LIT" || cleanUnit === "L") {
        normValue = qtyNumeric;
        normUnit = "L";
      } else {
        anomalies.push({ type: "WARNING", code: "UNIT_MISMATCH", description: `SAP system listed raw unit "${rawUnit}" for diesel. Converting natively.` });
      }
    } else if (matInfo.unit === "KG") {
      if (cleanUnit === "TO" || cleanUnit === "TON" || cleanUnit === "T") {
        normValue = qtyNumeric * 1000;
        normUnit = "KG";
      } else if (cleanUnit === "KG") {
        normValue = qtyNumeric;
        normUnit = "KG";
      }
    }
    
    if (!isNaN(normValue)) {
      computedKgCO2e = Math.round(normValue * efFactor * 100) / 100;
    }
  }
  
  // Anomaly outlier rule: extreme purchases over 40,000 liters or costs over $250,000 flag as suspicious audit targets
  if (status !== RecordStatus.FAILED && (costUSD > 250000 || (scope === ScopeType.SCOPE_1 && normValue > 40000))) {
    anomalies.push({ type: "WARNING", code: "OUTLIER_THRESHOLD", description: "Outsized purchase entry exceeds typical facilities audit limits." });
    status = RecordStatus.FLAGGED;
  }
  
  return {
    id: raw.id,
    tenantId,
    sourceType: SourceType.SAP_FUEL_PROCUREMENT,
    rawPayload: raw,
    status,
    scope,
    scopeCategory: scopeDesc,
    activityValue: normValue || 0,
    activityUnit: normUnit || "U",
    co2eKg: computedKgCO2e,
    emissionFactorUsed: efFactor,
    emissionFactorSrc: efSrc,
    costUSD,
    plantOrLocation: siteName,
    servicePeriodMonth,
    ingestedAt: new Date().toISOString(),
    anomalies,
    auditTrail: []
  };
}

export function normalizeUtility(raw: RawUtilityRecord, tenantId: string): NormalizedESGRecord {
  const anomalies: Anomaly[] = [];
  let status = RecordStatus.PENDING;
  
  const meterId = raw.METER_ID || "MISSING";
  const startStr = raw.SERVICE_START || "";
  const endStr = raw.SERVICE_END || "";
  const rawKwh = raw.USAGE_KWH || "";
  const rawCost = raw.CHARGES_USD || "";
  const zipCode = raw.ZIP_CODE || "Default Grid";
  
  const parsedStart = parseIrregularDate(startStr);
  const parsedEnd = parseIrregularDate(endStr);
  const usageNumeric = parseFloat(rawKwh.replace(/,/g, ''));
  const chargesNumeric = parseFloat(rawCost.replace(/,/g, ''));
  
  let servicePeriodMonth = "1970-01";
  let costUSD = 0;
  
  if (!parsedStart || !parsedEnd || parsedStart >= parsedEnd) {
    anomalies.push({ type: "CRITICAL", code: "INVALID_PERIOD", description: `Unresolvable utility invoicing coverage dates: "${startStr}" to "${endStr}"` });
    status = RecordStatus.FAILED;
  } else {
    servicePeriodMonth = formatDateToMonthString(parsedStart); // Default to start month
  }
  
  if (isNaN(usageNumeric) || usageNumeric < 0) {
    anomalies.push({ type: "CRITICAL", code: "INVALID_KWH", description: `Electricity total USAGE_KWH is corrupt or negative: "${rawKwh}"` });
    status = RecordStatus.FAILED;
  }
  
  if (!isNaN(chargesNumeric)) {
    costUSD = chargesNumeric;
  } else {
    anomalies.push({ type: "WARNING", code: "INVALID_CHARGE", description: `Electricity financial spend is blank: "${rawCost}"` });
  }
  
  // Grid factor lookups
  const gridProfile = UTILITY_SUBGRID_FACTORS[zipCode];
  const gridFactor = gridProfile ? gridProfile.factor : 0.38; // Default to mid density US average
  const gridSrc = gridProfile ? `eGRID ZIP Code Mapping (${gridProfile.desc})` : "US-EPA eGRID National Default Zone";
  const locationResolved = gridProfile ? `Utility Substation: ${gridProfile.desc}` : `Meter Site (ZIP: ${zipCode})`;
  
  let totalKgCO2e = 0;
  if (!isNaN(usageNumeric)) {
    totalKgCO2e = Math.round(usageNumeric * gridFactor * 100) / 100;
  }
  
  // General anomalies: spikes
  if (status !== RecordStatus.FAILED && usageNumeric > 150000) {
    anomalies.push({ type: "WARNING", code: "OUTLIER_KWH", description: "Facilities electricity spike. Exceeds standard baseline consumption envelopes." });
    status = RecordStatus.FLAGGED;
  }
  
  return {
    id: raw.id,
    tenantId,
    sourceType: SourceType.UTILITY_ELECTRICITY,
    rawPayload: raw,
    status,
    scope: ScopeType.SCOPE_2,
    scopeCategory: "Scope 2 - Purchased Electricity Grid",
    activityValue: usageNumeric || 0,
    activityUnit: "kWh",
    co2eKg: totalKgCO2e,
    emissionFactorUsed: gridFactor,
    emissionFactorSrc: gridSrc,
    costUSD,
    plantOrLocation: locationResolved,
    servicePeriodMonth, // Month resolved
    ingestedAt: new Date().toISOString(),
    anomalies,
    auditTrail: []
  };
}

export function normalizeTravel(raw: RawTravelRecord, tenantId: string): NormalizedESGRecord {
  const anomalies: Anomaly[] = [];
  let status = RecordStatus.PENDING;
  
  const tripType = raw.TRAVEL_TYPE || "GROUND";
  const startStr = raw.START_DATE || "";
  const endStr = raw.END_DATE || "";
  const chargesNumeric = parseFloat((raw.COST_USD || "0").replace(/,/g, ''));
  
  const parsedStart = parseIrregularDate(startStr);
  const servicePeriodMonth = parsedStart ? formatDateToMonthString(parsedStart) : "1970-01";
  
  if (!parsedStart) {
    anomalies.push({ type: "CRITICAL", code: "INV_TRAVEL_DATE", description: `Incomplete booking timestamp: "${startStr}"` });
    status = RecordStatus.FAILED;
  }
  
  let costUSD = isNaN(chargesNumeric) ? 0 : chargesNumeric;
  let normValue = 0;
  let normUnit = "km";
  let computedKgCO2e = 0;
  let efFactor = 0;
  let efSrc = "DEFRA 2025 Standard Travel Scales";
  let gridLocStr = "Corporate Travel Network";
  let categoryStr = "Scope 3 Category 6 - Business Travel";
  
  if (tripType === "FLIGHT") {
    const origArp = raw.DEPART_ARP || "";
    const destArp = raw.ARRIVE_ARP || "";
    const seatClass = raw.CABIN_CLASS || "ECONOMY";
    
    const coord1 = AIRPORT_DATABASE[origArp];
    const coord2 = AIRPORT_DATABASE[destArp];
    
    if (!origArp || !destArp) {
      anomalies.push({ type: "CRITICAL", code: "MISSING_AIRPORTS", description: "Flight leg lacks Departure or Destination codes." });
      status = RecordStatus.FAILED;
    } else if (!coord1 || !coord2) {
      anomalies.push({ type: "WARNING", code: "UNKNOWN_AIRPORTS", description: `Unmapped airport pair S-IATA (${origArp} -> ${destArp}). Reverting to financial cost proxy.` });
      // financial approximation fallback: 0.25 kg CO2e per dollar spent
      normValue = costUSD;
      normUnit = "USD_PROXY";
      efFactor = 0.28;
      computedKgCO2e = Math.round(costUSD * efFactor * 100) / 100;
      efSrc = "EPA Expenditure Carbon Model";
      gridLocStr = `Flight sector: ${origArp} -> ${destArp}`;
    } else {
      // Calculate haversine great circle
      const dist = calculateGarmentDistance(coord1.lat, coord1.lon, coord2.lat, coord2.lon);
      normValue = dist;
      normUnit = "km";
      gridLocStr = `${coord1.name} (${origArp}) to ${coord2.name} (${destArp})`;
      
      // Class modifiers
      if (seatClass === "FIRST") {
        efFactor = 0.60;
      } else if (seatClass === "BUSINESS") {
        efFactor = 0.43;
      } else {
        efFactor = 0.15; // default economy
      }
      
      computedKgCO2e = Math.round(dist * efFactor * 100) / 100;
      efSrc = `GHG Protocol Air-Travel Factor (Cabin: ${seatClass})`;
      
      // Extreme flight check (distance > 15,000 km in one segment is unusual, or SFO to LHR is ~8600km)
      if (dist > 15000) {
        anomalies.push({ type: "WARNING", code: "EXTREME_DISTANCE", description: "Extreme intercontinental flight distance exceeds typical route checks." });
        status = RecordStatus.FLAGGED;
      }
    }
    
  } else if (tripType === "HOTEL") {
    const nightCount = parseInt(raw.NIGHTS || "1");
    const country = (raw.COUNTRY || "US").toUpperCase().trim();
    
    normValue = isNaN(nightCount) ? 1 : nightCount;
    normUnit = "room-night";
    categoryStr = "Scope 3 Category 6 - Business Hotel Stays";
    gridLocStr = `Hotel Reservation: ${raw.CITY || "Commercial Hub"}, ${country}`;
    
    // Country average night coefficients
    const HOTEL_COUNTRY_FACTORS: Record<string, number> = {
      "US": 18.5,
      "DE": 12.0,
      "FR": 6.2, // Nuclear electric grid
      "IN": 24.5,
      "UK": 11.2
    };
    
    efFactor = HOTEL_COUNTRY_FACTORS[country] || 15.0; // average
    computedKgCO2e = Math.round(normValue * efFactor * 100) / 100;
    efSrc = `GHG Protocol Hotel Footprint Benchmark Database (${country})`;
    
    if (isNaN(nightCount) || nightCount <= 0) {
      anomalies.push({ type: "CRITICAL", code: "INVALID_NIGHTS", description: `Hotel night duration is missing or non-positive: "${raw.NIGHTS}"` });
      status = RecordStatus.FAILED;
    }
    
  } else {
    // GROUND TRANSPORT
    const fuelType = (raw.FUEL_TYPE || "GASOLINE").toUpperCase().trim();
    const rawDist = raw.DISTANCE_KM || "";
    const distNumeric = parseFloat(rawDist.replace(/,/g, ''));
    
    normUnit = "km";
    categoryStr = "Scope 3 Category 6 - Ground Transport";
    gridLocStr = `Road Logistics: Ground Car Rental (${fuelType})`;
    
    const GROUND_FACTORS: Record<string, number> = {
      "DIESEL": 0.17,
      "GASOLINE": 0.16,
      "HYBRID": 0.09,
      "ELECTRIC": 0.04
    };
    
    efFactor = GROUND_FACTORS[fuelType] || 0.16;
    efSrc = `DEFRA Vehicle Databases (Engine: ${fuelType})`;
    
    if (isNaN(distNumeric) || distNumeric <= 0) {
      // Revert to spend proxy
      anomalies.push({ type: "WARNING", code: "NO_GROUND_DIST", description: "Mileage counts omitted. Approximating emissions spend proxy." });
      normValue = costUSD;
      normUnit = "USD_PROXY";
      efFactor = 0.22;
      computedKgCO2e = Math.round(costUSD * efFactor * 100) / 100;
      efSrc = "DEFRA Spend Fuel Interpolation Model";
    } else {
      normValue = distNumeric;
      computedKgCO2e = Math.round(distNumeric * efFactor * 100) / 100;
    }
  }
  
  return {
    id: raw.id,
    tenantId,
    sourceType: SourceType.CORP_TRAVEL,
    rawPayload: raw,
    status,
    scope: ScopeType.SCOPE_3,
    scopeCategory: categoryStr,
    activityValue: normValue,
    activityUnit: normUnit,
    co2eKg: computedKgCO2e,
    emissionFactorUsed: efFactor,
    emissionFactorSrc: efSrc,
    costUSD,
    plantOrLocation: gridLocStr,
    servicePeriodMonth,
    ingestedAt: new Date().toISOString(),
    anomalies,
    auditTrail: []
  };
}
