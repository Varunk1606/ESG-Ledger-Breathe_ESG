# DATA MODEL SPECIFICATION (MODEL.md)

This document outlines the architectural data model and accounting methodologies utilized in the **ESG Ledger Platform** to ingest, normalize, and audit core resource transactions.

---

## 1. Relational Entity Schema

### Corporate Tenant
Manages strict data boundaries for multi-tenancy. No organization can inspect or modify rows belonging to another organizational entity.
* `id` (string, PK): Unique UUID or slug representing the client (e.g., `tenant-acme-global`).
* `name` (string): Corporate legal name.
* `region` (string): Geographic grouping representing regulatory jurisdiction.
* `defaultCurrency` (string): Base unit of currency for financial aggregates (e.g., `USD`).

### Ingestion Source Record
Acts as the immutable legal record container. It references raw SAP, electric utilities, or business travel invoices exactly as they were delivered to preserve source-of-truth lineages.
* `id` (string, PK): Unique record identifier generated dynamically (e.g., `sap-01` or `manual-sap-8349`).
* `tenantId` (string, FK): Relates the row to a corporate landlord boundary.
* `sourceType` (enum): Type of resource pipeline (`sap_fuel_procurement`, `utility_electricity`, `corp_travel`).
* `rawPayload` (JSON): The raw un-normalized structure containing original units, currencies, and foreign codes from SAP (IDocs), CSV bills, or API dumps.
* `status` (enum): Analytical state of the record (`pending`, `approved`, `flagged`, `failed`).
* `ingestedAt` (timestamp): Exact moment the record hit the platform.

### Normalized ESG Ledger
Evaluated dynamically by normalizers on ingestion or raw payload alteration. It serves as the query target for quarterly and annual emissions accounting compliance reports.
* `id` (string, PK, matches Ingestion Source ID): Matches the physical raw wrapper.
* `scope` (enum): Carbon classification (`Scope 1`, `Scope 2`, `Scope 3`).
* `scopeCategory` (string): Detailed GHG category grouping (e.g., `Scope 3 Category 6 - Business Hotel Stays`).
* `activityValue` (numeric): Resolved activity level (e.g., liters combusted, electrical kilowatt-hours consumed).
* `activityUnit` (string): Normalized SI unit used globally (e.g., `L`, `kWh`, `km`, `room-night`).
* `co2eKg` (numeric): Absolute GHG impact computed as `Activity Value × Normalizer Emission Factor`.
* `emissionFactorUsed` (numeric): Metric multiplier applied during calculation.
* `emissionFactorSrc` (string): Citation representing calculation validation (e.g., `eGRID ZIP Code Mapping (US-ERCOT)`, `DEFRA Vehicles 2025`).
* `costUSD` (numeric): Normalized expense value converted at posting exchange rates.
* `plantOrLocation` (string): Physical location or site mapped from codes or coordinates.
* `servicePeriodMonth` (string): Mapped billing/posting calendar month (format: `YYYY-MM`) used to allocate emissions.
* `approvedAt` (timestamp, optional): Date the record was locked.
* `approvedBy` (string, optional): Lead auditor signature representing active digital lock.

---

## 2. Multi-Tenancy Boundary Rules
1. **Physical Ledger Filtration**: Every API request mandates a `tenantId` query parameter. All analytical aggregations and database fetches run on filtered subsets which limits exposure.
2. **Dynamic Lookups**: Facility configurations (plant profiles, localized electrical grid zip coefficients) are queried relative to tenant context, allowing unique regional emission calculations per client.

---

## 3. GHG Protocol Classifications Mapped
The platform groups records strictly according to the **Greenhouse Gas (GHG) Protocol Corporate Standard**:

1. **Scope 1 (Direct Emissions)**: Combustion of stationary fuel.
   * *Sources*: SAP material lines flagged `MAT-F-100` (Diesel) and `MAT-F-200` (Natural Gas).
   * *Normalizer*: Converts raw gallons (`GAL`) to liters (`L`) and applies high-density DEFRA coefficients (e.g., 2.68 kg CO2e per Litre of diesel).
2. **Scope 2 (Indirect Emissions)**: Purchased electricity.
   * *Sources*: Utilities electric invoices containing usage meters (`USAGE_KWH`).
   * *Normalizer*: Queries specific substation ZIP code profiles (e.g., `75001` Texas ERCOT vs `02002` Paris Nuclear Subgrid) to apply regional grid-specific weight factors.
3. **Scope 3 (Value Chain Emissions)**: Indirect upstream carbon footprints.
   * *Scope 3 Category 1 (Purchased Goods and Services)*: SAP procurement rows representing structural steel plates or aluminum extrusions.
   * *Scope 3 Category 6 (Business Travel)*: Concur flights, car rentals, and hotel reservations.
     * Flight great-circle segment distances are computed via the haversine equations on airport long/lat coordinates. Economy flights receive standard factors (`0.15 kg/km`) while Business (`0.43 kg/km`) and First-class (`0.60 kg/km`) are assigned higher footprints.
     * Hotel stabilities are mapped against country-specific averages to reflect coal vs low-carbon energy grids (e.g., India stays are rated higher than nuclear-powered France stays).

---

## 4. Source-Of-Truth Preservation & Audit Trails

To guarantee reliable audit reports:
* **The original raw payload is absolute and immutable**. Any corrections made by an analyst do not change the physical ingested payload structure. Rather, edits are recorded inside an **Audit Trail** and standard recalculations are re-run dynamically to overwrite current normalized targets.
* An `AuditTrailEntry` is appended to the ledger container for every adjustment:
  ```json
  {
    "userId": "analyst-01",
    "userName": "Varun ESG Lead Auditor",
    "timestamp": "2026-05-29T07:39:10Z",
    "fieldName": "MENGE",
    "previousValue": "ERR_UNITS_VAL",
    "newValue": "4200"
  }
  ```
* Once an entry's status shifts to `APPROVED`, its values are physically **locked**. The API blocks edits on approved records, protecting compliance databases against historical tampering.
