# ENTERPRISE DATA SOURCES STUDY (SOURCES.md)

This document maps our pre-seeded data structures directly to real-world corporate platforms.

---

## Source 1: SAP fuel & procurement general ledger exports

### Real-World Research & Formats
We researched standard SAP financial reports (such as General Ledger Line Item Exports via transaction `FBL3N` or Custom Procurement ABAP reports). In these setups:
* Column headers are often represented in standard German abbreviations (e.g., `BELNR` for posting document identifier, `BUDAT` for posting date, `MENGE` for quantity, `MEINS` for base unit of measure, `WRBTR` for document transaction costs, `WAERS` for currency, and `WERK` for plant code).
* Quantities often contain raw string comma groupings and alternate date formats depending on localized settings (e.g., `21.05.2026` or date strings such as `20260515`).
* Unit values can be inconsistent (some plants post diesel in Liters `L`, while US facilities use Gallons `GAL`).

### Why Our Sample Data Looks This Way
Our pre-seeded rows mimic these exact formats:
* `sap-01` incorporates classic German accounting terminology (`BELNR: "100200340", BUDAT: "21.05.2026", MATNR: "MAT-F-100", MENGE: "8,500", MEINS: "L"`) indicating realistic general ledger exports.
* `sap-02` tests our unit normalizer by using Gallons (`MEINS: "GAL"`) on US Plant `PL02`.
* `sap-05` provides a flawed non-numeric posting quantity to demonstrate parse failure handling.
* `sap-06` uses condensed SAP date strings (`BUDAT: "20260515"`) representing flat-file dump outputs.

### What Would Break in Production
* **System Language Configurations**: SAP configurations vary globally. If an international subsidiary customizes a report, German headers (`MENGE`, `BUDAT`) might change to English (`QTY`, `DATE`), breaking fixed regex normalizers. Real deployments require mapped schema templates per facility.
* **Cost Allocation Elements**: In large businesses, a single general ledger posting of diesel might cover fuel split across five facilities. Simple plant-to-location mappings (`WERK`) then become too basic, requiring advanced allocation keys.

---

## Source 2: Commercial electric utilities

### Real-World Research & Formats
We researched commercial electric portal CSV exports and PG&E "Green Button Commercial Data". 
* Multi-month commercial electrical invoices do not align nicely with standard calendar months, containing irregular service date periods (e.g., May 11 to June 10).
* Accounts often have distinct, complex rate schedule schedules (Time of Use rates like `COM-MID-A` or peak demand contracts like `E19-TX-A`).
* Double-billing issues occur when accounts load overlapping service dates for the same electrical meter ID.

### Why Our Sample Data Looks This Way
* `util-01` represents Chicago operations across irregular calendar dates (April 10 to May 10). The normalizer must dynamically split consumption to build accurate monthly carbon aggregates.
* `util-02` and `util-03` represent an intentional temporal overlap warning on Meter `MTR-AUST-77X` in Austin, TX, allowing lead auditors to immediately flag double-billing errors and protect carbon reporting integrity.
* `util-05` simulates a faulty negative electricity usage entry, triggering system validation failures.

### What Would Break in Production
* **Aggressive Meter Multiplying Variables**: Multi-megawatt industrial meters often require multiplying factors (e.g., raw meter reading must be multiplied by 40 to evaluate true consumption). Missing these factors in manual exports could lead to reporting underestimations of up to 4,000%.
* **Meter Replacement Events**: If a physical electrical meter breaks and is replaced mid-billing cycle, service overlap rules could trigger a false warning.

---

## Source 3: Corporate travel platform API (Concur/Navan)

### Real-World Research & Formats
We studied automated Concur Business Travel JSON and Navan API extracts:
* Category attributes (Flight vs. Hotel vs. Ground) require different emission factors.
* Flight mileage values are often missing; systems only receive departure and destination airport codes (e.g. `SFO -> CDG`), requiring great-circle distance (haversine) calculations.
* Seating configurations (Economy vs. First Class) drastically alter carbon allocation shares according to the GHG Protocol.
* Stays in different countries carry different emission coefficients based on regional grid carbon intensities.

### Why Our Sample Data Looks This Way
* `trv-01` reports economy transport SFO to JFK with missing mileage, validating our great-circle coordinates database.
* `trv-02` sets up a first class flight to London with zero distance, illustrating how cabin multipliers (`0.60 kg/km` travel factor) impact total emissions.
* `trv-03` and `trv-04` compare hotel stays of similar costs located in France (`FR`) vs. India (`IN`). Due to France's low-carbon nuclear grid, India stabilities generate a much larger footprint, highlighting regional energy differences.

### What Would Break in Production
* **Multi-Leg Flight Complexity**: A single booking can cover multiple flights (SFO -> JFK -> LHR -> SFO). If travel systems combine these into a single trip summary without splitting individual legs, simple haversine distance calculations will fail.
* **Unlisted Airport Codes**: Smaller local airfields may lack listed coordinate profiles, which would lead to great-circle calculation errors in production.
