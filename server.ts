/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

import { 
  SourceType, 
  RecordStatus, 
  ScopeType, 
  NormalizedESGRecord, 
  Tenant, 
  AuditTrailEntry,
  RawSAPRecord,
  RawUtilityRecord,
  RawTravelRecord
} from "./src/types.js";

import { 
  normalizeSAP, 
  normalizeUtility, 
  normalizeTravel 
} from "./src/normalizer.js";

import { 
  SAMPLE_TENANTS, 
  RAW_SAP_SAMPLE, 
  RAW_UTILITY_SAMPLE, 
  RAW_TRAVEL_SAMPLE 
} from "./src/sampleData.js";

const PORT = 3000;
const DB_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DB_DIR, "db.json");

// Lazy Gemini API Initializer to prevent crashing if environment token is empty
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (key && key !== "MY_GEMINI_API_KEY") {
      aiClient = new GoogleGenAI({
        apiKey: key,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });
    }
  }
  return aiClient;
}

// Ensure database directory and file structure exists
function initializeDatabase() {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
  
  if (!fs.existsSync(DB_PATH)) {
    console.log("Database file not found. Generating pre-seeded ESG audit registers...");
    
    const records: NormalizedESGRecord[] = [];
    const tenants: Tenant[] = SAMPLE_TENANTS;
    
    // Seat default tenant global
    const tGlobal = tenants[0].id;
    const tEurope = tenants[1].id;
    
    // Classify raw records into global and EU tenants
    RAW_SAP_SAMPLE.forEach((raw, idx) => {
      const activeTenant = idx % 2 === 0 ? tGlobal : tEurope;
      records.push(normalizeSAP(raw, activeTenant));
    });
    
    RAW_UTILITY_SAMPLE.forEach((raw, idx) => {
      const activeTenant = idx % 2 === 0 ? tGlobal : tEurope;
      records.push(normalizeUtility(raw, activeTenant));
    });
    
    RAW_TRAVEL_SAMPLE.forEach((raw, idx) => {
      const activeTenant = idx % 2 === 0 ? tGlobal : tEurope;
      records.push(normalizeTravel(raw, activeTenant));
    });
    
    // Run electrical invoice temporal overlaps audit checks
    const checked = checkElectricityOverlaps(records);
    
    const initialDb = {
      tenants,
      records: checked,
      createdAt: new Date().toISOString()
    };
    
    fs.writeFileSync(DB_PATH, JSON.stringify(initialDb, null, 2), "utf-8");
  }
}

// Load and save functions
function readDb() {
  try {
    initializeDatabase();
    const data = fs.readFileSync(DB_PATH, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    console.error("Failed reading JSON records DB. Rebuilding base state.", error);
    return { tenants: SAMPLE_TENANTS, records: [] };
  }
}

function writeDb(dbState: any) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(dbState, null, 2), "utf-8");
  } catch (error) {
    console.error("Failed writing JSON records DB", error);
  }
}

// Analytical Electricity period overlapping algorithms
function checkElectricityOverlaps(records: NormalizedESGRecord[]): NormalizedESGRecord[] {
  // Clear any existing OVERLAPPING anomalies first
  for (const r of records) {
    if (r.sourceType === SourceType.UTILITY_ELECTRICITY) {
      r.anomalies = r.anomalies.filter(a => a.code !== "OVERLAPPING_BILL_PERIOD");
      if (r.status === RecordStatus.FLAGGED && r.anomalies.length === 0) {
        r.status = RecordStatus.PENDING;
      }
    }
  }

  // Filter pending/flagged utility electricity meters
  const utils = records.filter(r => r.sourceType === SourceType.UTILITY_ELECTRICITY && r.status !== RecordStatus.APPROVED);

  for (let i = 0; i < utils.length; i++) {
    const r1 = utils[i];
    const p1Raw = r1.rawPayload as RawUtilityRecord;
    const s1 = new Date(p1Raw.SERVICE_START);
    const e1 = new Date(p1Raw.SERVICE_END);
    const meter1 = p1Raw.METER_ID;

    if (!s1 || !e1 || isNaN(s1.getTime()) || isNaN(e1.getTime()) || !meter1) continue;

    for (let j = i + 1; j < utils.length; j++) {
      const r2 = utils[j];
      const p2Raw = r2.rawPayload as RawUtilityRecord;
      const s2 = new Date(p2Raw.SERVICE_START);
      const e2 = new Date(p2Raw.SERVICE_END);
      const meter2 = p2Raw.METER_ID;

      if (!s2 || !e2 || isNaN(s2.getTime()) || isNaN(e2.getTime()) || !meter2) continue;

      if (meter1 === meter2) {
        // Temporal Overlap Rule: Start1 < End2 AND Start2 < End1
        if (s1 < e2 && s2 < e1) {
          const desc = `Invoicing service dates overlap with bill ${p2Raw.INVOICE_NUM || r2.id} (${p2Raw.SERVICE_START} to ${p2Raw.SERVICE_END}) on Meter: ${meter1}.`;
          const r1Has = r1.anomalies.some(a => a.code === "OVERLAPPING_BILL_PERIOD");
          if (!r1Has) {
            r1.anomalies.push({ type: "CRITICAL", code: "OVERLAPPING_BILL_PERIOD", description: desc });
            if (r1.status !== RecordStatus.FAILED) {
              r1.status = RecordStatus.FLAGGED;
            }
          }

          const desc2 = `Invoicing service dates overlap with bill ${p1Raw.INVOICE_NUM || r1.id} (${p1Raw.SERVICE_START} to ${p1Raw.SERVICE_END}) on Meter: ${meter1}.`;
          const r2Has = r2.anomalies.some(a => a.code === "OVERLAPPING_BILL_PERIOD");
          if (!r2Has) {
            r2.anomalies.push({ type: "CRITICAL", code: "OVERLAPPING_BILL_PERIOD", description: desc2 });
            if (r2.status !== RecordStatus.FAILED) {
              r2.status = RecordStatus.FLAGGED;
            }
          }
        }
      }
    }
  }

  return records;
}

async function startServer() {
  const app = express();
  app.use(express.json());

  // Initialize ESG datastore files
  initializeDatabase();

  // API Endpoints: Tenancy listings
  app.get("/api/tenants", (req, res) => {
    const db = readDb();
    res.json(db.tenants);
  });

  // API Endpoints: Ingestion/Registration registers
  app.get("/api/records", (req, res) => {
    const db = readDb();
    const { tenantId, type, status, search } = req.query;
    
    let filtered: NormalizedESGRecord[] = db.records;
    
    if (tenantId) {
      filtered = filtered.filter(r => r.tenantId === tenantId);
    }
    if (type) {
      filtered = filtered.filter(r => r.sourceType === type);
    }
    if (status) {
      filtered = filtered.filter(r => r.status === status);
    }
    if (search) {
      const q = String(search).toLowerCase();
      filtered = filtered.filter(r => 
        r.id.toLowerCase().includes(q) ||
        r.plantOrLocation.toLowerCase().includes(q) ||
        r.scopeCategory.toLowerCase().includes(q) ||
        (r.rawPayload as any).BELNR?.toLowerCase().includes(q) ||
        (r.rawPayload as any).METER_ID?.toLowerCase().includes(q) ||
        (r.rawPayload as any).TRIP_ID?.toLowerCase().includes(q)
      );
    }
    
    res.json(filtered);
  });

  // Reset database endpoint
  app.post("/api/records/reset", (req, res) => {
    if (fs.existsSync(DB_PATH)) {
      fs.unlinkSync(DB_PATH);
    }
    initializeDatabase();
    const db = readDb();
    res.json({ success: true, count: db.records.length });
  });

  // Custom Raw Row Manual Ingestion API
  app.post("/api/records/ingest", (req, res) => {
    const { tenantId, sourceType, payload } = req.body;
    
    if (!tenantId || !sourceType || !payload) {
      return res.status(400).json({ error: "Missing required fields matching corporate tenancy model" });
    }
    
    const db = readDb();
    const newId = `manual-${sourceType.substring(0, 3)}-${Date.now().toString().substring(8)}`;
    const extendedPayload = { id: newId, ...payload };
    
    let normalized: NormalizedESGRecord;
    if (sourceType === SourceType.SAP_FUEL_PROCUREMENT) {
      normalized = normalizeSAP(extendedPayload as RawSAPRecord, tenantId);
    } else if (sourceType === SourceType.UTILITY_ELECTRICITY) {
      normalized = normalizeUtility(extendedPayload as RawUtilityRecord, tenantId);
    } else if (sourceType === SourceType.CORP_TRAVEL) {
      normalized = normalizeTravel(extendedPayload as RawTravelRecord, tenantId);
    } else {
      return res.status(400).json({ error: "Unknown source registry type" });
    }
    
    db.records.unshift(normalized);
    db.records = checkElectricityOverlaps(db.records);
    writeDb(db);
    
    res.json({ success: true, record: normalized });
  });

  // Approve audited row endpoint
  app.post("/api/records/:id/approve", (req, res) => {
    const { id } = req.params;
    const { approvedBy } = req.body;
    
    const db = readDb();
    const idx = db.records.findIndex((r: NormalizedESGRecord) => r.id === id);
    
    if (idx === -1) {
      return res.status(404).json({ error: "Target ESG ledger code not discovered" });
    }
    
    const record = db.records[idx];
    if (record.status === RecordStatus.FAILED) {
      return res.status(400).json({ error: "Cannot approve entries in Failed state. Correct inputs first." });
    }
    
    record.status = RecordStatus.APPROVED;
    record.approvedAt = new Date().toISOString();
    record.approvedBy = approvedBy || "Platform Analyst";
    
    writeDb(db);
    res.json({ success: true, record });
  });

  // Single record editing endpoint, logging source-of-truth actions
  app.post("/api/records/:id/edit", (req, res) => {
    const { id } = req.params;
    const { updatedPayload, editorName } = req.body;
    
    const db = readDb();
    const idx = db.records.findIndex((r: NormalizedESGRecord) => r.id === id);
    if (idx === -1) {
      return res.status(404).json({ error: "Auditing target missing" });
    }
    
    const original = db.records[idx];
    const tenantId = original.tenantId;
    const userRole = editorName || "Platform ESG Auditor";
    
    // Check if approved / locked
    if (original.status === RecordStatus.APPROVED) {
      return res.status(400).json({ error: "This ledger entry is approved and locked. Auditing edits prohibited." });
    }
    
    // Consolidate logs
    const edits: AuditTrailEntry[] = [];
    const timestamp = new Date().toISOString();
    
    // Find fields that changed and add audit trail
    const prevPayload = original.rawPayload as any;
    const newPayload = { ...prevPayload, ...updatedPayload };
    
    Object.keys(updatedPayload).forEach(key => {
      if (prevPayload[key] !== updatedPayload[key]) {
        edits.push({
          userId: "analyst-01",
          userName: userRole,
          timestamp,
          fieldName: key,
          previousValue: String(prevPayload[key] || ""),
          newValue: String(updatedPayload[key] || "")
        });
      }
    });
    
    // Re-run normalizations using updated raw data to recalibrate footprint values
    let reNormalized: NormalizedESGRecord;
    if (original.sourceType === SourceType.SAP_FUEL_PROCUREMENT) {
      reNormalized = normalizeSAP(newPayload, tenantId);
    } else if (original.sourceType === SourceType.UTILITY_ELECTRICITY) {
      reNormalized = normalizeUtility(newPayload, tenantId);
    } else {
      reNormalized = normalizeTravel(newPayload, tenantId);
    }
    
    // Maintain old audit trail and merge new edits
    reNormalized.auditTrail = [...original.auditTrail, ...edits];
    
    // Replace in database
    db.records[idx] = reNormalized;
    db.records = checkElectricityOverlaps(db.records);
    writeDb(db);
    
    res.json({ success: true, record: reNormalized });
  });

  // AI-Powered Automated Audit Assistant relying on server-side Gemini
  app.post("/api/ai-audit", async (req, res) => {
    try {
      const client = getGeminiClient();
      if (!client) {
        return res.status(503).json({ 
          error: "Gemini AI API key unconfigured on server. Audit Assistant requires validation." 
        });
      }
      
      const db = readDb();
      const unapproved = db.records.filter((r: NormalizedESGRecord) => r.status !== RecordStatus.APPROVED);
      
      if (unapproved.length === 0) {
        return res.json({ 
          report: "**Platform Data Sync Clean**: All ingested ledger transactions are currently approved and locked. No pending anomalies discovered." 
        });
      }
      
      // Structure mini summary context for LLM
      const summaryPayload = unapproved.slice(0, 15).map((r: NormalizedESGRecord) => {
        return {
          id: r.id,
          source: r.sourceType,
          scope: r.scope,
          plant: r.plantOrLocation,
          co2eKg: r.co2eKg,
          costUSD: r.costUSD,
          status: r.status,
          anomalies: r.anomalies.map(a => a.description)
        };
      });
      
      const prompt = `
        You are an expert senior environmental accountant and ESG auditor.
        Below is a JSON dump of pending or flagged carbon accounting records from SAP, travel, and utility electricity invoicing networks.
        
        Analyze the discrepancy logs and write a concise, scannable Auditor's Compliance Report.
        Your report must:
        1. Summarize the major risks found (e.g., temporal overlapping bills double-counting US-Texas electricity, unmapped SAP plant codes, size outliers, flight unit discrepancies).
        2. Propose concrete corrections an analyst should make before locking these records.
        3. Keep recommendations strictly technical, realistic, professional, and clear.
        
        Records Payload:
        ${JSON.stringify(summaryPayload, null, 2)}
      `;
      
      const response = await client.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt
      });
      
      res.json({ report: response.text });
    } catch (e: any) {
      console.error("Gemini Audit Endpoint broke", e);
      res.status(500).json({ error: "Gemini AI audit generation failed. Check credentials or formatting." });
    }
  });

  // Vite integration middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`ESG Full-Stack Audit Platform live on http://localhost:${PORT}`);
  });
}

startServer();
