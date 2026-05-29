# Carbon Ledger and Audit Review Dashboard

An enterprise-grade, multi-tenant ESG carbon accounting platform that automates ingestion, unit normalization, validation, and analyst reviews for high-entropy ERP transactional records, utility electricity bills, and corporate travel sync streams.

---

## 🚀 Key Architectural Artifacts

This repository is built following rigid regulatory standards for greenhouse gas (GHG) auditing systems. Please review these files for deep architectural breakdowns:

1. **[`MODEL.md`](./MODEL.md) — Data Model Schema & Carbon Accounting Architecture**: Describes the unified multi-tenant ledger, pro-rata calendar month splittings, coordinate geography math, and immutable audit logs.
2. **[`SOURCES.md`](./SOURCES.md) — Real-world Data Formats**: Details the SAP ERP MM/FI interfaces handled, regional utility billing constraints, and Concur/Navan business travel API extraction points.
3. **[`DECISIONS.md`](./DECISIONS.md) — Decisions & Scope Bounds**: Documents the design tradeoffs, ambiguities resolved, and questions reserved for the Product Manager.
4. **[`TRADEOFFS.md`](./TRADEOFFS.md) — Architectural Tradeoffs**: Highlights three core features deliberately bypassed (such as dynamic utility pricing meshes and supplier portals) and why.

---

## 🛠️ The Tech Stack

- **Frontend**: React 19, Tailwind CSS, Lucide icons, native drag-and-drop mechanics.
- **Backend**: Node.js/TypeScript Full-Stack server utilizing Express, TSX, and bundled high-performance ESM builds using `esbuild`.
- **AI Integrations**: Server-side Google Gemini (`gemini-3.5-flash`) integrations for anomaly checking and auditor reasoning reviews. Handles local heuristic fallback patterns gracefully when API secrets are unconfigured.
- **Type Safety**: Fully typed data models using TypeScript standard nested schemas.

---

## 🎯 Features & Core Ingest Engines

### 1. SAP Fuel & Procurement (Scope 1 Direct / Scope 3 Value Chain)
- **Problem**: SAP registers purchases in arbitrary, country-specific transactional records (e.g., German field headers like `Menge` or `MEINS`, and complex plant indicators like `WERKS`).
- **Solution**: Normalizes volumes (from US barrels `BBL`, gallons `GAL`, tonnes `TON`, or `KG`) into standardized metric weights using material-specific densities and yields, generating authentic Scope 1 emissions factors.

### 2. Utility Electricity Billing (Scope 2 Location-Based Indirect)
- **Problem**: Utility invoices rarely snap neatly to commercial calendar limits, running instead on offset dates (e.g., February 12 to March 14).
- **Solution**: Evaluates the cycle bounds and runs a **monthly pro-rata weight distribution** algorithm. It splits the active usage (`kWh`) and carbon footprint into dominant accounting periods while matching regional grid carbon intensity maps (e.g. California `PL02` vs Germany `PL01`).

### 3. Corporate Travel Integration (Scope 3 Category 6 Business Travel)
- **Problem**: Corporate travel systems like Concur provide traveler itinerary segments (e.g., `SFO -> FRA`) with distinct service multipliers without providing actual spatial mileage.
- **Solution**: Resolves geography pairs using great-circle haversine trigonometry math, applies DEFRA cabin class multipliers (e.g., Business class at 2.9x, First class at 4x), and evaluates room-nights for regional hotel stats.

---

## 💼 User Workflows

### 🔍 Interactive Audit Desk
1. **Multi-Tenancy Partitioning**: Toggle dynamically between **Global Holdings Inc.** and **EcoTech Materials** via the header dashboard dropdown. Real analytical partitioning isolates records inside standard workspace scopes.
2. **Dynamic Indicators**: Observe real-time statistics updating instantly across Scope 1, Scope 2, and Scope 3 emissions tonnage.
3. **Double-Click Inspection**: Select any transaction row to toggle the **Audit Verification Panel** on the right side of the screen.
4. **Correction Engine**: Correct unit typos (e.g., scale conversion anomalies), modify the reporting period, provide an auditor's comment, and seal/lock the row to create a secure, immutable audit trail.
5. **AI Gemini Advisor**: Click **"Analyze with Gemini AI Auditor"** to read real-time audits on high price alerts, extreme usage spikes, or flight budget anomalies directly sourced from the server-side model.

### 📥 Ingestion Sandbox
1. Switch to the **"File Drops & Manual Ingestion"** tab.
2. Drag and drop flat files, or choose from pre-arranged realistic ERP presets.
3. Edit the raw mock string in the code text box to test fail-safes (e.g. entering negative fuel volumes, 0-distance flights, or extreme electricity loads).
4. Click **"Normalize and Log transaction"** to see rows parse and feed into the audit table immediately.

---

## 💻 Local Development

### 1. Prerequisites
- Node.js (v18+ recommended)
- NPM

### 2. Environment Variables
Copy or declare variables listed in `.env`:
```env
# Optional: To unlock the complete live Gemini auditing capabilities:
GEMINI_API_KEY="your-google-ai-studio-api-key"
```

### 3. Installation & Run
Install dependencies from package.json:
```bash
npm install
```

Boot up the concurrent development server (tsx server.ts is bound to Port 3000):
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.
