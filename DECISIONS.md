# ARCHITECTURAL DECISIONS (DECISIONS.md)

This document records the design decisions and scope limitations selected during the development of our ESG Normalization and Audit Ledger System.

---

## 1. Scope Boundaries: Handled vs. Ignored

### SAP Fuel & Procurement
* **What we handled**: Flat-file CSV reporting extracts representing SAP General Ledger transfers. This is highly realistic because general ledger line items (from screens like FBL3N) are the primary way corporate finance teams export spending data. We handled German standard abbreviations and alternate BUDAT dates, unit translations (converting gallons to liters, and tonnage to kg), plant code site profile mappings, and extreme quantity outlier detections.
* **What we ignored**: Live RFC / BAPI connections or complex IDoc (Intermediate Document) XML parsing engines. In the real world, connecting to internal SAP ERP architectures is extremely slow and expensive. Finance departments overwhelmingly rely on automated secure FTP file transfers containing flat CSV dumps. We chose to represent this highly pragmatic reality.

### Electricity Utilities
* **What we handled**: Multi-month electric billing invoicing. We resolved regional grid factors based on location zip profiles, and implemented **automatic temporal overlap warning systems**. If two utility records are loaded for the same physical meter mapping with overlapping service dates, the platform displays a custom billing double-counting warning to the analyst.
* **What we ignored**: Parsing dirty PDF utility bills. Scanned bill PDFs vary drastically across local service zones. We assumed facilities departments pull structured commercial consumption reports from supplier portals (such as PG&E commercial XML or CSV utilities reports), which maps directly into our clean JSON payloads.

### Corporate Travel Platform
* **What we handled**: Travel booking classifications (Flight legs, Hotel night reservations, Ground transportation). We implemented **great-circle haversine navigation models** using an airport coordinates dictionary to derive missing segment distances when only airport IATA codes are provided. We mapped cabin seating class multipliers (Economy vs. First Class) and fuel types for car rentals (EV spent vs Gasoline).
* **What we ignored**: Multi-leg flight connections on a single booking sequence. We assume travel platforms decompose journeys into separate destination leg arrays prior to delivering standard transactions to our systems.

---

## 2. Resolved Ambiguities

### Ambiguity: "Empty travel distances"
* *Decision*: When `DISTANCE_KM` is omitted but travel platforms supply flight destination codes (such as SFO -> JFK), we use the distance from airport longitude/latitude coordinates. If an airport resides outside our standard pre-seeded database, the system flags a warning and defaults to an EPA finance expenditure conversion calculation ($ Spend × 0.28 kg/USD). This guarantees the audit engine never crashes.

### Ambiguity: "Irregular date formats"
* *Decision*: To handle varied formats (German `DD.MM.YYYY`, SAP flat-file `YYYYMMDD`, and ISO-8601 strings), we engineered a resilient multi-regex parsing utility `parseIrregularDate`. It successfully standardizes different dates to prevent system crashes.

---

## 3. Product Manager Inquire Questions

If we could interview our PM, we would clarify:
1. **Prorating Methodology**: *"When an electric utility invoice crosses boundaries (e.g. May 12 to June 10), should we prorate usage on a daily basis (as currently implemented) or allocate the entire footprint to the calendar month in which the service ended?"*
2. **Auditor Hierarchy**: *"Should we support multiple levels of verification? For example, an analyst drafts changes, but only a senior certified ESG officer can lock record approvals?"*
3. **Foreign Exchange API**: *"Do you want a live connection to open-exchange rates, or should we continue to maintain monthly static exchange rates in our normalization schemas?"*
