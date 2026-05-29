/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, FormEvent } from "react";
import { 
  Search, 
  Filter, 
  AlertTriangle, 
  RefreshCw, 
  FileText, 
  Globe, 
  DollarSign, 
  Calendar, 
  Settings, 
  Plane, 
  Hotel, 
  Car, 
  Edit3, 
  CheckCircle2, 
  XCircle, 
  ChevronRight, 
  Info, 
  Sparkles, 
  Database, 
  UserCheck, 
  ArrowUpRight, 
  HelpCircle,
  Clock,
  ShieldAlert,
  FileCheck2,
  MapPin,
  ChevronDown,
  Landmark
} from "lucide-react";

import { 
  SourceType, 
  RecordStatus, 
  ScopeType, 
  NormalizedESGRecord, 
  Tenant, 
  AuditTrailEntry,
  RawTravelRecord
} from "./types.js";

export default function App() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string>("");
  const [records, setRecords] = useState<NormalizedESGRecord[]>([]);
  const [activeTab, setActiveTab] = useState<"records" | "reporting" | "anomalies" | "audit-logs" | "ai-helper">("records");
  
  // Filters
  const [filterType, setFilterType] = useState<string>("ALL");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [searchTerm, setSearchTerm] = useState<string>("50"); // seeded search empty to list limit or simple placeholder
  const [searchQuery, setSearchQuery] = useState<string>("");
  
  // Modals & Details
  const [detailedRecord, setDetailedRecord] = useState<NormalizedESGRecord | null>(null);
  const [editingRecord, setEditingRecord] = useState<NormalizedESGRecord | null>(null);
  const [editPayload, setEditPayload] = useState<any>({});
  const [editorName, setEditorName] = useState<string>("Varun ESG Auditor");
  
  // State helpers
  const [loading, setLoading] = useState<boolean>(true);
  const [aiReport, setAiReport] = useState<string>("");
  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");

  useEffect(() => {
    fetchTenants();
  }, []);

  useEffect(() => {
    fetchRecords();
  }, [selectedTenantId, filterType, filterStatus, searchQuery]);

  async function fetchTenants() {
    try {
      const res = await fetch("/api/tenants");
      const data = await res.json();
      setTenants(data);
      if (data.length > 0) {
        // Default to first tenant
        setSelectedTenantId(data[0].id);
      }
    } catch (e) {
      console.error(e);
      setErrorMsg("Failed to retrieve client multi-tenant databases.");
    }
  }

  async function fetchRecords() {
    setLoading(true);
    setErrorMsg("");
    try {
      let url = `/api/records?`;
      if (selectedTenantId) url += `tenantId=${selectedTenantId}&`;
      if (filterType !== "ALL") url += `type=${filterType}&`;
      if (filterStatus !== "ALL") url += `status=${filterStatus}&`;
      if (searchQuery) url += `search=${encodeURIComponent(searchQuery)}&`;
      
      const res = await fetch(url);
      const data = await res.json();
      setRecords(data);
    } catch (e) {
      console.error(e);
      setErrorMsg("Error communicating with normalizer REST API.");
    } finally {
      setLoading(false);
    }
  }

  // Action: Approve
  async function handleApprove(id: string) {
    try {
      const res = await fetch(`/api/records/${id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approvedBy: editorName })
      });
      const result = await res.json();
      if (result.success) {
        setSuccessMsg(`Ledger entry ${id} approved and audit locked.`);
        setTimeout(() => setSuccessMsg(""), 4000);
        
        // Refresh local views
        setRecords(prev => prev.map(r => r.id === id ? { ...r, status: RecordStatus.APPROVED, approvedBy: editorName, approvedAt: new Date().toISOString() } : r));
        if (detailedRecord?.id === id) {
          setDetailedRecord(prev => prev ? { ...prev, status: RecordStatus.APPROVED, approvedBy: editorName, approvedAt: new Date().toISOString() } : null);
        }
      } else {
        setErrorMsg(result.error || "Approval failed.");
      }
    } catch (e) {
      console.error(e);
      setErrorMsg("Server mismatch during approval execution.");
    }
  }

  // Action: Reset seeding
  async function handleResetDB() {
    if (!confirm("Are you sure you want to purge and reset all normalized metrics? All manual adjustments will be cleared.")) return;
    setLoading(true);
    try {
      const res = await fetch("/api/records/reset", { method: "POST" });
      const result = await res.json();
      if (result.success) {
        setSuccessMsg("ESG database seeding completed successfully.");
        setTimeout(() => setSuccessMsg(""), 4000);
        fetchRecords();
      }
    } catch (e) {
      console.error(e);
      setErrorMsg("Reset failed.");
    } finally {
      setLoading(false);
    }
  }

  // Action: Initiate Edit Modal
  function openEditModal(record: NormalizedESGRecord) {
    setEditingRecord(record);
    // Clone raw fields
    setEditPayload({ ...record.rawPayload });
  }

  // Action: Submit Corrective Adjustment
  async function handleSaveEdit() {
    if (!editingRecord) return;
    try {
      const res = await fetch(`/api/records/${editingRecord.id}/edit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          updatedPayload: editPayload,
          editorName: editorName
        })
      });
      const result = await res.json();
      if (result.success) {
        setSuccessMsg(`Source-of-truth adjustments for ${editingRecord.id} saved. Footprint re-calculated.`);
        setTimeout(() => setSuccessMsg(""), 4000);
        
        // Update local arrays
        setRecords(prev => prev.map(r => r.id === editingRecord.id ? result.record : r));
        if (detailedRecord?.id === editingRecord.id) {
          setDetailedRecord(result.record);
        }
        setEditingRecord(null);
      } else {
        setErrorMsg(result.error || "Save adjustment failed.");
      }
    } catch (e) {
      console.error(e);
      setErrorMsg("Error rewriting ledger record.");
    }
  }

  // Action: AI compliance summary
  async function runAICountingAudit() {
    setAiLoading(true);
    setAiReport("");
    try {
      const res = await fetch("/api/ai-audit", { method: "POST" });
      const data = await res.json();
      if (data.report) {
        setAiReport(data.report);
      } else {
        setErrorMsg(data.error || "AI evaluator down.");
      }
    } catch (e) {
      console.error(e);
      setErrorMsg("Gemini agent timeout.");
    } finally {
      setAiLoading(false);
    }
  }

  // Math aggregates
  const totalCarbonKg = records.reduce((sum, r) => r.status !== RecordStatus.FAILED ? sum + r.co2eKg : sum, 0);
  const totalSpendUSD = records.reduce((sum, r) => sum + r.costUSD, 0);
  const approvedCount = records.filter(r => r.status === RecordStatus.APPROVED).length;
  const flaggedCount = records.filter(r => r.status === RecordStatus.FLAGGED).length;
  const failedCount = records.filter(r => r.status === RecordStatus.FAILED).length;
  const pendingCount = records.filter(r => r.status === RecordStatus.PENDING).length;

  const currentTenantName = tenants.find(t => t.id === selectedTenantId)?.name || "Corporate Account";

  // Ingestion Drawer state
  const [showDirectIngest, setShowDirectIngest] = useState(false);
  const [ingestSource, setIngestSource] = useState<SourceType>(SourceType.SAP_FUEL_PROCUREMENT);
  const [ingestPayload, setIngestPayload] = useState<any>({});

  // Direct manual mock upload handler
  async function handleDirectIngestSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch("/api/records/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: selectedTenantId,
          sourceType: ingestSource,
          payload: ingestPayload
        })
      });
      const result = await res.json();
      if (result.success) {
        setSuccessMsg(`Raw transaction ingested. Id: ${result.record.id}`);
        setTimeout(() => setSuccessMsg(""), 4000);
        setShowDirectIngest(false);
        setIngestPayload({});
        fetchRecords();
      } else {
        alert(result.error);
      }
    } catch (e) {
      console.error(e);
      alert("Ingestion pipeline failed.");
    }
  }

  // Set default raw shapes when toggling ingest source
  useEffect(() => {
    if (ingestSource === SourceType.SAP_FUEL_PROCUREMENT) {
      setIngestPayload({
        BELNR: "500124901",
        BUDAT: "28.05.2026",
        MATNR: "MAT-F-100",
        MENGE: "4,200",
        MEINS: "L",
        WRBTR: "5,800.00",
        WAERS: "EUR",
        WERK: "PL01"
      });
    } else if (ingestSource === SourceType.UTILITY_ELECTRICITY) {
      setIngestPayload({
        METER_ID: "MTR-CHIC-55A",
        ZIP_CODE: "60601",
        SERVICE_START: "2026-05-11",
        SERVICE_END: "2026-06-11",
        USAGE_KWH: "15,200",
        RATE_CHG: "COM-MID-A",
        CHARGES_USD: "1,980.00",
        INVOICE_NUM: "INV-UTIL-201"
      });
    } else {
      setIngestPayload({
        TRIP_ID: "TRP-9099",
        EMPLOYEE_ID: "EMP-211",
        TRAVEL_TYPE: "FLIGHT",
        START_DATE: "2026-05-18",
        END_DATE: "2026-05-18",
        DEPART_ARP: "SFO",
        ARRIVE_ARP: "CDG",
        CABIN_CLASS: "ECONOMY",
        COST_USD: "950.00"
      });
    }
  }, [ingestSource]);

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black text-slate-200 flex flex-col font-sans relative overflow-x-hidden">
      {/* Background Decorative Elements for Frosted Glass Effect */}
      <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none z-0"></div>
      <div className="absolute bottom-[-10%] left-[-5%] w-[450px] h-[450px] bg-emerald-500/5 rounded-full blur-[100px] pointer-events-none z-0"></div>
      <div className="absolute top-1/3 left-1/4 w-[300px] h-[300px] bg-purple-500/5 rounded-full blur-[130px] pointer-events-none z-0"></div>

      {/* Top Banner Global System Information */}
      <header className="bg-slate-950/40 backdrop-blur-xl border-b border-white/10 sticky top-0 z-30 shadow-lg shadow-black/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            
            {/* Platform Brand */}
            <div className="flex items-center space-x-3">
              <div className="bg-indigo-600/20 p-2 rounded-lg text-white border border-indigo-500/35 shadow-lg shadow-indigo-500/10">
                <Database className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <h1 className="text-lg font-bold font-display text-white tracking-tight flex items-center gap-1.5">
                  ESG Ledger Hub
                  <span className="bg-indigo-500/25 text-indigo-200 border border-indigo-500/30 text-[9px] px-1.5 py-0.5 rounded-full font-sans uppercase font-bold tracking-wider">Frosted Glass</span>
                </h1>
                <p className="text-[10px] text-slate-400 font-mono">Scope 1/2/3 Corporate Compliance Ledger</p>
              </div>
            </div>

            {/* Tenancy mapping selectors */}
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 bg-white/5 p-1.5 rounded-lg border border-white/10">
                <span className="text-xs font-semibold text-slate-400 px-2 font-mono uppercase">Client:</span>
                <select 
                  className="bg-transparent text-xs text-white font-semibold focus:outline-none pr-6 cursor-pointer"
                  value={selectedTenantId}
                  onChange={(e) => {
                    setSelectedTenantId(e.target.value);
                    setDetailedRecord(null);
                  }}
                >
                  {tenants.map(t => (
                    <option key={t.id} value={t.id} className="bg-slate-900 text-slate-200 font-sans">{t.name}</option>
                  ))}
                </select>
              </div>

              {/* Auditor Digital Signature */}
              <div className="hidden md:flex items-center space-x-2 border-l border-white/10 pl-4">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <input 
                  type="text" 
                  value={editorName}
                  onChange={(e) => setEditorName(e.target.value)}
                  className="text-xs font-medium text-slate-200 bg-transparent border-b border-transparent hover:border-white/20 focus:border-indigo-400 focus:outline-none w-32 font-mono"
                  placeholder="Auditor Signature (Edit)"
                />
              </div>

              <button 
                onClick={handleResetDB}
                className="bg-white/5 hover:bg-white/10 text-slate-200 p-2 rounded-lg border border-white/10 transition-colors"
                title="Reset Database to original seeding"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>

          </div>
        </div>
      </header>

      {/* Main Container Layout */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col space-y-6 relative z-10">
        
        {/* State Indicators & Feedback */}
        {successMsg && (
          <div className="bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 px-4 py-3 rounded-xl flex items-center space-x-2 text-xs font-medium shadow-lg backdrop-blur-md transition-opacity">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}
        {errorMsg && (
          <div className="bg-red-500/10 border border-red-500/25 text-red-300 px-4 py-3 rounded-xl flex items-center space-x-2 text-xs font-medium shadow-lg backdrop-blur-md">
            <XCircle className="h-4 w-4 text-red-400 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Big Executive Scoreboards: Aggregated Normalizations */}
        <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
          
          <div className="bg-white/5 backdrop-blur-md p-5 rounded-2xl border border-white/10 shadow-xl shadow-black/10 flex flex-col justify-between">
            <span className="text-[11px] font-bold text-slate-400 font-mono uppercase tracking-wider">Total Carbon Emissions</span>
            <div className="mt-2 flex items-baseline space-x-1">
              <span className="text-3xl font-bold font-display text-white tracking-tight">
                {(totalCarbonKg / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })}
              </span>
              <span className="text-xs font-semibold text-slate-300 font-mono">t CO₂e</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">Sum of active carbon footprints</p>
          </div>

          <div className="bg-white/5 backdrop-blur-md p-5 rounded-2xl border border-white/10 shadow-xl shadow-black/10 flex flex-col justify-between">
            <span className="text-[11px] font-bold text-slate-400 font-mono uppercase tracking-wider">Audited Financials</span>
            <div className="mt-2 flex items-baseline space-x-1">
              <span className="text-3xl font-bold font-display text-white tracking-tight">
                ${totalSpendUSD.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
              <span className="text-xs font-semibold text-slate-300 font-mono">USD</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">Normalized currency conversions</p>
          </div>

          <div className="bg-white/5 backdrop-blur-md p-5 rounded-2xl border border-white/10 shadow-xl shadow-black/10 flex flex-col justify-between">
            <span className="text-[11px] font-bold text-slate-400 font-mono uppercase tracking-wider">Compliance Approvals</span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-3xl font-bold font-display text-white tracking-tight">
                {approvedCount} <span className="text-sm font-normal text-slate-400">/ {records.length}</span>
              </span>
              <span className="bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 px-2.5 py-0.5 rounded text-[10px] font-bold font-mono">
                {records.length > 0 ? Math.round((approvedCount / records.length) * 100) : 0}% locked
              </span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">Pending and Flagged columns require review</p>
          </div>

          <div className="bg-white/5 backdrop-blur-md p-5 rounded-2xl border border-white/10 shadow-xl shadow-black/10 flex flex-col justify-between">
            <span className="text-[11px] font-bold text-slate-400 font-mono uppercase tracking-wider">Platform Flags & Failures</span>
            <div className="mt-2 flex items-center space-x-4">
              <div className="flex items-center space-x-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400"></span>
                <span className="text-sm font-bold text-amber-200">{flaggedCount} Flagged</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-red-400"></span>
                <span className="text-sm font-bold text-red-200">{failedCount} Failed</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-slate-500"></span>
                <span className="text-sm font-bold text-slate-300">{pendingCount} Pending</span>
              </div>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">Automatic indicators run inside ingestion engine</p>
          </div>

        </section>

        {/* Navigation Tabs and Quick Filters */}
        <div className="bg-slate-900/30 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
          
          <div className="flex flex-col sm:flex-row justify-between border-b border-white/10 bg-white/[0.02]">
            {/* View selectors */}
            <div className="flex border-b border-white/5 sm:border-b-0 overflow-x-auto">
              <button 
                onClick={() => setActiveTab("records")}
                className={`px-5 py-4 text-xs font-bold tracking-tight border-b-2 font-display flex items-center space-x-1.5 transition-colors whitespace-nowrap ${activeTab === "records" ? "border-indigo-400 text-white bg-white/10" : "border-transparent text-slate-400 hover:text-white"}`}
              >
                <FileText className="h-4 w-4" />
                <span>Pre-Audit Registers</span>
              </button>
              <button 
                onClick={() => setActiveTab("reporting")}
                className={`px-5 py-4 text-xs font-bold tracking-tight border-b-2 font-display flex items-center space-x-1.5 transition-colors whitespace-nowrap ${activeTab === "reporting" ? "border-indigo-400 text-white bg-white/10" : "border-transparent text-slate-400 hover:text-white"}`}
              >
                <Globe className="h-4 w-4" />
                <span>Analytical Dashboard</span>
              </button>
              <button 
                onClick={() => setActiveTab("anomalies")}
                className={`px-5 py-4 text-xs font-bold tracking-tight border-b-2 font-display flex items-center space-x-1.5 transition-colors whitespace-nowrap ${activeTab === "anomalies" ? "border-indigo-400 text-white bg-white/10" : "border-transparent text-slate-400 hover:text-white"} ${flaggedCount > 0 || failedCount > 0 ? "text-amber-400" : ""}`}
              >
                <ShieldAlert className="h-4 w-4" />
                <span>Anomaly & QA Center</span>
                {(flaggedCount + failedCount) > 0 && (
                  <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                    {flaggedCount + failedCount}
                  </span>
                )}
              </button>
              <button 
                onClick={() => setActiveTab("audit-logs")}
                className={`px-5 py-4 text-xs font-bold tracking-tight border-b-2 font-display flex items-center space-x-1.5 transition-colors whitespace-nowrap ${activeTab === "audit-logs" ? "border-indigo-400 text-white bg-white/10" : "border-transparent text-slate-400 hover:text-white"}`}
              >
                <Clock className="h-4 w-4" />
                <span>Auditing Trails</span>
              </button>
              <button 
                onClick={() => {
                  setActiveTab("ai-helper");
                  if (!aiReport) { runAICountingAudit(); }
                }}
                className={`px-5 py-4 text-xs font-bold tracking-tight border-b-2 font-display flex items-center space-x-1.5 transition-colors whitespace-nowrap ${activeTab === "ai-helper" ? "border-indigo-400 text-indigo-200 bg-white/15 font-semibold" : "border-transparent text-slate-400 hover:text-indigo-400"}`}
              >
                <Sparkles className="h-4 w-4 text-indigo-400" />
                <span>AI Auditor Assistant</span>
              </button>
            </div>

            {/* Ingestion button trigger */}
            <div className="p-3 bg-white/[0.01] flex items-center justify-end">
              <button 
                onClick={() => setShowDirectIngest(!showDirectIngest)}
                className="bg-white/10 hover:bg-white/15 text-white border border-white/10 text-xs font-bold px-4.5 py-2.5 rounded-xl flex items-center space-x-2 transition-colors cursor-pointer"
              >
                <Database className="h-3.5 w-3.5 text-emerald-400" />
                <span>Ingest Source Record</span>
              </button>
            </div>

          </div>

          {/* Collapsible raw data Ingestion Console */}
          {showDirectIngest && (
            <div className="p-6 bg-white/5 border-b border-white/10 backdrop-blur-md">
              <div className="max-w-2xl mx-auto">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-sm font-bold font-display text-white">Direct Compliance Ingestion Pipeline</h3>
                  <button 
                    onClick={() => setShowDirectIngest(false)}
                    className="text-slate-400 hover:text-slate-200 text-xs font-bold font-mono"
                  >
                    Cancel
                  </button>
                </div>
                
                <form onSubmit={handleDirectIngestSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-300 uppercase font-mono mb-1">Source Pipeline</label>
                      <select 
                        className="w-full bg-slate-900/60 border border-white/10 text-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-indigo-400"
                        value={ingestSource}
                        onChange={(e) => setIngestSource(e.target.value as SourceType)}
                      >
                        <option value={SourceType.SAP_FUEL_PROCUREMENT} className="bg-slate-900 text-slate-200">SAP Export (Fuel & Procurement)</option>
                        <option value={SourceType.UTILITY_ELECTRICITY} className="bg-slate-900 text-slate-200">Commercial Electrical Utility Export</option>
                        <option value={SourceType.CORP_TRAVEL} className="bg-slate-900 text-slate-200 font-sans">Corporate Travel Platform (Concur API)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-300 uppercase font-mono mb-1">Tenant Profile Assignment</label>
                      <select 
                        className="w-full bg-slate-900/60 border border-white/10 text-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-indigo-400"
                        value={selectedTenantId}
                        onChange={(e) => setSelectedTenantId(e.target.value)}
                      >
                        {tenants.map(t => (
                          <option key={t.id} value={t.id} className="bg-slate-900 text-slate-200">{t.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="bg-slate-950/40 p-4 rounded-xl border border-white/5 space-y-3">
                    <span className="text-[10px] font-bold text-slate-400 font-mono uppercase block mb-1">Raw Payload Details (Adjust for Normalizer)</span>
                    
                    {ingestSource === SourceType.SAP_FUEL_PROCUREMENT && (
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                        <div>
                          <label className="block text-[10px] text-slate-400">BELNR (Doc Num)</label>
                          <input type="text" className="w-full bg-slate-900/40 text-white border border-white/10 p-1.5 rounded text-xs focus:border-indigo-400 focus:outline-none" value={ingestPayload.BELNR || ""} onChange={(e) => setIngestPayload({...ingestPayload, BELNR: e.target.value})} />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-400">BUDAT (Date)</label>
                          <input type="text" className="w-full bg-slate-900/40 text-white border border-white/10 p-1.5 rounded text-xs focus:border-indigo-400 focus:outline-none" value={ingestPayload.BUDAT || ""} onChange={(e) => setIngestPayload({...ingestPayload, BUDAT: e.target.value})} />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-400">MATNR (Material)</label>
                          <select className="w-full bg-slate-900/50 text-white border border-white/10 p-1 rounded text-xs focus:border-indigo-400 focus:outline-none" value={ingestPayload.MATNR || ""} onChange={(e) => setIngestPayload({...ingestPayload, MATNR: e.target.value})}>
                            <option value="MAT-F-100" className="bg-slate-900 text-slate-200">MAT-F-100 (Diesel)</option>
                            <option value="MAT-F-200" className="bg-slate-900 text-slate-200">MAT-F-200 (Natural Gas)</option>
                            <option value="MAT-P-302" className="bg-slate-900 text-slate-200">MAT-P-302 (Steel Procurement)</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-400">MENGE (Qty)</label>
                          <input type="text" className="w-full bg-slate-900/40 text-white border border-white/10 p-1.5 rounded text-xs font-mono focus:border-indigo-400 focus:outline-none" value={ingestPayload.MENGE || ""} onChange={(e) => setIngestPayload({...ingestPayload, MENGE: e.target.value})} />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-400">MEINS (Unit)</label>
                          <input type="text" className="w-full bg-slate-900/40 text-white border border-white/10 p-1.5 rounded text-xs focus:border-indigo-400 focus:outline-none" value={ingestPayload.MEINS || ""} onChange={(e) => setIngestPayload({...ingestPayload, MEINS: e.target.value})} />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-400">WRBTR (Cost)</label>
                          <input type="text" className="w-full bg-slate-900/40 text-white border border-white/10 p-1.5 rounded text-xs focus:border-indigo-400 focus:outline-none" value={ingestPayload.WRBTR || ""} onChange={(e) => setIngestPayload({...ingestPayload, WRBTR: e.target.value})} />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-400">WAERS (Curr)</label>
                          <input type="text" className="w-full bg-slate-900/40 text-white border border-white/10 p-1.5 rounded text-xs focus:border-indigo-400 focus:outline-none" value={ingestPayload.WAERS || ""} onChange={(e) => setIngestPayload({...ingestPayload, WAERS: e.target.value})} />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-400">WERK (Plant)</label>
                          <input type="text" className="w-full bg-slate-900/40 text-white border border-white/10 p-1.5 rounded text-xs focus:border-indigo-400 focus:outline-none" value={ingestPayload.WERK || ""} onChange={(e) => setIngestPayload({...ingestPayload, WERK: e.target.value})} />
                        </div>
                      </div>
                    )}

                    {ingestSource === SourceType.UTILITY_ELECTRICITY && (
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                        <div>
                          <label className="block text-[10px] text-slate-400">METER_ID</label>
                          <input type="text" className="w-full bg-slate-900/40 text-white border border-white/10 p-1.5 rounded text-xs focus:border-indigo-400 focus:outline-none" value={ingestPayload.METER_ID || ""} onChange={(e) => setIngestPayload({...ingestPayload, METER_ID: e.target.value})} />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-400">ZIP_CODE (Grid)</label>
                          <input type="text" className="w-full bg-slate-900/40 text-white border border-white/10 p-1.5 rounded text-xs focus:border-indigo-400 focus:outline-none" value={ingestPayload.ZIP_CODE || ""} onChange={(e) => setIngestPayload({...ingestPayload, ZIP_CODE: e.target.value})} />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-400">SERVICE_START</label>
                          <input type="date" className="w-full bg-slate-900/40 text-white border border-white/10 p-1 rounded text-xs focus:border-indigo-400 focus:outline-none" value={ingestPayload.SERVICE_START || ""} onChange={(e) => setIngestPayload({...ingestPayload, SERVICE_START: e.target.value})} />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-400">SERVICE_END</label>
                          <input type="date" className="w-full bg-slate-900/40 text-white border border-white/10 p-1 rounded text-xs focus:border-indigo-400 focus:outline-none" value={ingestPayload.SERVICE_END || ""} onChange={(e) => setIngestPayload({...ingestPayload, SERVICE_END: e.target.value})} />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-400">USAGE_KWH</label>
                          <input type="text" className="w-full bg-slate-900/40 text-white border border-white/10 p-1.5 rounded text-xs focus:border-indigo-400 focus:outline-none" value={ingestPayload.USAGE_KWH || ""} onChange={(e) => setIngestPayload({...ingestPayload, USAGE_KWH: e.target.value})} />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-400">CHARGES_USD</label>
                          <input type="text" className="w-full bg-slate-900/40 text-white border border-white/10 p-1.5 rounded text-xs focus:border-indigo-400 focus:outline-none" value={ingestPayload.CHARGES_USD || ""} onChange={(e) => setIngestPayload({...ingestPayload, CHARGES_USD: e.target.value})} />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-400">MTR RATE CODE</label>
                          <input type="text" className="w-full bg-slate-900/40 text-white border border-white/10 p-1.5 rounded text-xs focus:border-indigo-400 focus:outline-none" value={ingestPayload.RATE_CHG || ""} onChange={(e) => setIngestPayload({...ingestPayload, RATE_CHG: e.target.value})} />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-400">INVOICE_NUM</label>
                          <input type="text" className="w-full bg-slate-900/40 text-white border border-white/10 p-1.5 rounded text-xs focus:border-indigo-400 focus:outline-none" value={ingestPayload.INVOICE_NUM || ""} onChange={(e) => setIngestPayload({...ingestPayload, INVOICE_NUM: e.target.value})} />
                        </div>
                      </div>
                    )}

                    {ingestSource === SourceType.CORP_TRAVEL && (
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                        <div>
                          <label className="block text-[10px] text-slate-400">TRAVEL TYPE</label>
                          <select className="w-full bg-slate-900/50 text-white border border-white/10 p-1 rounded text-xs focus:border-indigo-400 focus:outline-none" value={ingestPayload.TRAVEL_TYPE || "FLIGHT"} onChange={(e) => setIngestPayload({...ingestPayload, TRAVEL_TYPE: e.target.value})}>
                            <option value="FLIGHT" className="bg-slate-900 text-slate-200">FLIGHT</option>
                            <option value="HOTEL" className="bg-slate-900 text-slate-200">HOTEL</option>
                            <option value="GROUND" className="bg-slate-900 text-slate-200">GROUND</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-400">TRIP_ID</label>
                          <input type="text" className="w-full bg-slate-900/40 text-white border border-white/10 p-1.5 rounded text-xs focus:border-indigo-400 focus:outline-none" value={ingestPayload.TRIP_ID || ""} onChange={(e) => setIngestPayload({...ingestPayload, TRIP_ID: e.target.value})} />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-400">START DATE</label>
                          <input type="text" className="w-full bg-slate-900/40 text-white border border-white/10 p-1.5 rounded text-xs focus:border-indigo-400 focus:outline-none" value={ingestPayload.START_DATE || ""} onChange={(e) => setIngestPayload({...ingestPayload, START_DATE: e.target.value})} />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-400">COST (USD)</label>
                          <input type="text" className="w-full bg-slate-900/40 text-white border border-white/10 p-1.5 rounded text-xs focus:border-indigo-400 focus:outline-none" value={ingestPayload.COST_USD || ""} onChange={(e) => setIngestPayload({...ingestPayload, COST_USD: e.target.value})} />
                        </div>

                        {ingestPayload.TRAVEL_TYPE === "FLIGHT" && (
                          <>
                            <div>
                              <label className="block text-[10px] text-slate-400">DEPART (IATA)</label>
                              <input type="text" className="w-full bg-slate-900/40 text-white border border-white/10 p-1.5 rounded text-xs font-mono uppercase focus:border-indigo-400 focus:outline-none" placeholder="e.g. SFO" value={ingestPayload.DEPART_ARP || ""} onChange={(e) => setIngestPayload({...ingestPayload, DEPART_ARP: e.target.value})} />
                            </div>
                            <div>
                              <label className="block text-[10px] text-slate-400">ARRIVE (IATA)</label>
                              <input type="text" className="w-full bg-slate-900/40 text-white border border-white/10 p-1.5 rounded text-xs font-mono uppercase focus:border-indigo-400 focus:outline-none" placeholder="e.g. JFK" value={ingestPayload.ARRIVE_ARP || ""} onChange={(e) => setIngestPayload({...ingestPayload, ARRIVE_ARP: e.target.value})} />
                            </div>
                            <div>
                              <label className="block text-[10px] text-slate-400">CABIN CLASS</label>
                              <select className="w-full bg-slate-900/50 text-white border border-white/10 p-1 rounded text-xs focus:border-indigo-400 focus:outline-none" value={ingestPayload.CABIN_CLASS || "ECONOMY"} onChange={(e) => setIngestPayload({...ingestPayload, CABIN_CLASS: e.target.value})}>
                                <option value="ECONOMY" className="bg-slate-900 text-slate-200">ECONOMY</option>
                                <option value="BUSINESS" className="bg-slate-900 text-slate-200">BUSINESS</option>
                                <option value="FIRST" className="bg-slate-900 text-slate-200">FIRST</option>
                              </select>
                            </div>
                          </>
                        )}

                        {ingestPayload.TRAVEL_TYPE === "HOTEL" && (
                          <>
                            <div>
                              <label className="block text-[10px] text-slate-400">NIGHTS</label>
                              <input type="text" className="w-full bg-slate-900/40 text-white border border-white/10 p-1.5 rounded text-xs font-mono focus:border-indigo-400 focus:outline-none" value={ingestPayload.NIGHTS || ""} onChange={(e) => setIngestPayload({...ingestPayload, NIGHTS: e.target.value})} />
                            </div>
                            <div>
                              <label className="block text-[10px] text-slate-400">COUNTRY (DE/US/FR)</label>
                              <input type="text" className="w-full bg-slate-900/40 text-white border border-white/10 p-1.5 rounded text-xs font-mono uppercase focus:border-indigo-400 focus:outline-none" value={ingestPayload.COUNTRY || ""} onChange={(e) => setIngestPayload({...ingestPayload, COUNTRY: e.target.value})} />
                            </div>
                          </>
                        )}

                        {ingestPayload.TRAVEL_TYPE === "GROUND" && (
                          <>
                            <div>
                              <label className="block text-[10px] text-slate-400">FUEL TYPE</label>
                              <select className="w-full bg-slate-900/50 text-white border border-white/10 p-1 rounded text-xs focus:border-indigo-400 focus:outline-none" value={ingestPayload.FUEL_TYPE || "GASOLINE"} onChange={(e) => setIngestPayload({...ingestPayload, FUEL_TYPE: e.target.value})}>
                                <option value="GASOLINE" className="bg-slate-900 text-slate-200">GASOLINE</option>
                                <option value="DIESEL" className="bg-slate-900 text-slate-200">DIESEL</option>
                                <option value="HYBRID" className="bg-slate-900 text-slate-200">HYBRID</option>
                                <option value="ELECTRIC" className="bg-slate-900 text-slate-200">ELECTRIC</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-[10px] text-slate-400">DISTANCE (KM)</label>
                              <input type="text" className="w-full bg-slate-900/40 text-white border border-white/10 p-1.5 rounded text-xs focus:border-indigo-400 focus:outline-none" value={ingestPayload.DISTANCE_KM || ""} onChange={(e) => setIngestPayload({...ingestPayload, DISTANCE_KM: e.target.value})} />
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex justify-end">
                    <button 
                      type="submit"
                      className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs py-2 px-5 rounded-xl block transition-all shadow-md shadow-indigo-500/10 cursor-pointer"
                    >
                      Process & Normalize Record
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* TABLE PLATFORM VIEW */}
          {activeTab === "records" && (
            <div className="p-6">
              
              {/* Dynamic filter panel */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center space-x-2 bg-white/5 border border-white/10 p-1.5 rounded-xl">
                    <span className="text-[10px] font-bold text-slate-400 font-mono uppercase px-2">Type</span>
                    <select 
                      className="bg-transparent text-xs text-white font-medium focus:outline-none pr-4 cursor-pointer"
                      value={filterType}
                      onChange={(e) => setFilterType(e.target.value)}
                    >
                      <option value="ALL" className="bg-slate-900 text-slate-200">All Sources</option>
                      <option value={SourceType.SAP_FUEL_PROCUREMENT} className="bg-slate-900 text-slate-200 font-sans">SAP Fuel & Procurement</option>
                      <option value={SourceType.UTILITY_ELECTRICITY} className="bg-slate-900 text-slate-200 font-sans">Utility Electricity</option>
                      <option value={SourceType.CORP_TRAVEL} className="bg-slate-900 text-slate-200 font-sans">Corporate Travel</option>
                    </select>
                  </div>

                  <div className="flex items-center space-x-2 bg-white/5 border border-white/10 p-1.5 rounded-xl">
                    <span className="text-[10px] font-bold text-slate-400 font-mono uppercase px-2">Indicators</span>
                    <select 
                      className="bg-transparent text-xs text-white font-medium focus:outline-none pr-4 cursor-pointer"
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                    >
                      <option value="ALL" className="bg-slate-900 text-slate-200">All Statuses</option>
                      <option value={RecordStatus.PENDING} className="bg-slate-900 text-slate-200">Pending audit</option>
                      <option value={RecordStatus.APPROVED} className="bg-slate-900 text-slate-200">Approved & Locked</option>
                      <option value={RecordStatus.FLAGGED} className="bg-slate-900 text-slate-200">Flagged Suspicious</option>
                      <option value={RecordStatus.FAILED} className="bg-slate-900 text-slate-200">System Parse Failure</option>
                    </select>
                  </div>
                </div>

                {/* Instant text searching */}
                <div className="relative w-full md:w-80">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Search className="h-4 w-4" />
                  </span>
                  <input 
                    type="text" 
                    placeholder="Search by ID, Invoice, Meter, Class..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-9 pr-4 text-xs font-medium text-slate-200 placeholder-slate-400 focus:outline-none focus:border-indigo-400"
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      if (e.target.value.length === 0 || e.target.value.length > 2) {
                        setSearchQuery(e.target.value);
                      }
                    }}
                  />
                  {searchTerm.length > 0 && (
                    <button 
                      onClick={() => { setSearchTerm(""); setSearchQuery(""); }}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-200 font-mono text-[10px]"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Data table representation */}
              {loading ? (
                <div className="flex flex-col items-center justify-center py-20 space-y-3">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-400"></div>
                  <span className="text-xs text-slate-300 font-medium font-mono">Re-calculating and indexing records...</span>
                </div>
              ) : records.length === 0 ? (
                <div className="text-center py-20 text-slate-400">
                  <HelpCircle className="h-8 w-8 mx-auto mb-2 text-slate-500" />
                  <p className="text-xs font-semibold">No records match the active query.</p>
                  <p className="text-[10px] mt-1">Try resetting the database or expanding filters.</p>
                </div>
              ) : (
                <div className="overflow-x-auto border border-white/10 rounded-xl bg-slate-950/20">
                  <table className="min-w-full divide-y divide-white/10">
                    <thead className="bg-white/[0.04] font-mono text-[10px] tracking-wider text-slate-400 uppercase font-bold border-b border-white/10">
                      <tr>
                        <th scope="col" className="px-4 py-3 text-left">Record ID</th>
                        <th scope="col" className="px-4 py-3 text-left">Source type</th>
                        <th scope="col" className="px-4 py-3 text-left">Scope / Classification</th>
                        <th scope="col" className="px-4 py-3 text-left">Facility/Site</th>
                        <th scope="col" className="px-4 py-3 text-right">Activity level</th>
                        <th scope="col" className="px-4 py-3 text-right">Computed Footprint</th>
                        <th scope="col" className="px-4 py-3 text-left pl-6">Auditor Check</th>
                        <th scope="col" className="px-4 py-3 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-transparent divide-y divide-white/5 text-xs font-medium text-slate-300">
                      {records.map((r) => {
                        let icon = <Database className="h-3.5 w-3.5" />;
                        if (r.sourceType === SourceType.SAP_FUEL_PROCUREMENT) {
                          icon = <Landmark className="h-3.5 w-3.5 text-blue-400" />;
                        } else if (r.sourceType === SourceType.UTILITY_ELECTRICITY) {
                          icon = <Clock className="h-3.5 w-3.5 text-amber-400" />;
                        } else {
                          const payload = r.rawPayload as RawTravelRecord;
                          if (payload.TRAVEL_TYPE === "FLIGHT") icon = <Plane className="h-3.5 w-3.5 text-purple-400" />;
                          else if (payload.TRAVEL_TYPE === "HOTEL") icon = <Hotel className="h-3.5 w-3.5 text-emerald-400" />;
                          else icon = <Car className="h-3.5 w-3.5 text-slate-400" />;
                        }

                        // Status pill styling
                        let statusPill = (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white/10 text-slate-300 border border-white/10">
                            <span>Pending</span>
                          </span>
                        );
                        if (r.status === RecordStatus.APPROVED) {
                          statusPill = (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
                              <UserCheck className="h-2.5 w-2.5 text-emerald-400" />
                              <span>Approved</span>
                            </span>
                          );
                        } else if (r.status === RecordStatus.FLAGGED) {
                          statusPill = (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/25 animate-pulse">
                              <AlertTriangle className="h-2.5 w-2.5 text-amber-400" />
                              <span>Flagged</span>
                            </span>
                          );
                        } else if (r.status === RecordStatus.FAILED) {
                          statusPill = (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-500/15 text-red-300 border border-red-500/25">
                              <XCircle className="h-2.5 w-2.5 text-red-400" />
                              <span>Failed</span>
                            </span>
                          );
                        }

                        return (
                          <tr key={r.id} className="hover:bg-white/5 transition-colors border-b border-white/5">
                            <td className="px-4 py-3.5 font-mono text-slate-100 font-bold whitespace-nowrap">{r.id}</td>
                            <td className="px-4 py-3.5 text-slate-300 whitespace-nowrap">
                              <div className="flex items-center space-x-1.5">
                                {icon}
                                <span className="capitalize">{r.sourceType.replace(/_/g, ' ')}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3.5 font-semibold text-slate-200">{r.scopeCategory}</td>
                            <td className="px-4 py-3.5 text-slate-300 max-w-[180px] truncate" title={r.plantOrLocation}>{r.plantOrLocation}</td>
                            <td className="px-4 py-3.5 text-right font-mono text-slate-200 whitespace-nowrap">
                              {r.status === RecordStatus.FAILED ? (
                                <span className="text-red-400 font-semibold italic">Unparseable</span>
                              ) : (
                                <>
                                  <span className="font-semibold text-slate-100">{r.activityValue.toLocaleString(undefined, { maxFractionDigits: 1 })}</span>{" "}
                                  <span className="text-[10px] text-slate-400">{r.activityUnit}</span>
                                </>
                              )}
                            </td>
                            <td className="px-4 py-3.5 text-right font-mono text-white font-bold whitespace-nowrap">
                              {r.status === RecordStatus.FAILED ? (
                                <span className="text-red-400">0.0</span>
                              ) : (
                                <>
                                  <span>{Math.round(r.co2eKg).toLocaleString()}</span>{" "}
                                  <span className="text-[9px] text-slate-400">kg</span>
                                </>
                              )}
                            </td>
                            <td className="px-4 py-3.5 pl-6 whitespace-nowrap">{statusPill}</td>
                            <td className="px-4 py-3.5 text-center whitespace-nowrap space-x-1.5">
                              <button 
                                onClick={() => setDetailedRecord(r)}
                                className="text-slate-300 hover:text-white px-2 py-1 rounded text-[11px] font-semibold hover:bg-white/10 transition-colors"
                              >
                                Detail
                              </button>
                              {r.status !== RecordStatus.APPROVED && r.status !== RecordStatus.FAILED && (
                                <button 
                                  onClick={() => handleApprove(r.id)}
                                  className="text-emerald-300 hover:text-white px-2.5 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-[11px] font-bold transition-colors cursor-pointer"
                                >
                                  Approve
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* REPORTING VIEW USING ADVANCED GRAPH MODALITIES */}
          {activeTab === "reporting" && (
            <div className="p-6 space-y-8">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-base font-bold font-display text-white leading-tight">ESG Compliance Normalization Report</h3>
                  <p className="text-xs text-slate-300 font-medium">Visual representations of calendarized monthly prorated scopes and regional electric grid intensities.</p>
                </div>
                <div className="text-xs font-bold font-mono text-slate-300 bg-white/5 px-3 py-1.5 rounded-lg border border-white/10">
                  As of: 2026-05 (Pre-Audit)
                </div>
              </div>

              {/* Grid chart rows */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Custom bar chart: Carbon emissions by Scope (Scope 1 vs 2 vs 3) */}
                <div className="bg-white/5 p-5 rounded-2xl border border-white/10 shadow-xl shadow-black/10">
                  <h4 className="text-xs font-bold font-display text-white uppercase tracking-wider mb-4 font-mono">Emissions Carbon Share (KG CO₂e)</h4>
                  
                  {(() => {
                    const scopes = { "Scope 1": 0, "Scope 2": 0, "Scope 3": 0 };
                    records.forEach(r => {
                      if (r.status !== RecordStatus.FAILED) {
                        scopes[r.co2eKg > 0 ? r.scope : "Scope 1"] = (scopes[r.co2eKg > 0 ? r.scope : "Scope 1"] || 0) + r.co2eKg;
                      }
                    });
                    const max = Math.max(scopes["Scope 1"], scopes["Scope 2"], scopes["Scope 3"], 1);
                    return (
                      <div className="space-y-4">
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs font-semibold">
                            <span className="flex items-center space-x-1"><span className="h-3 w-3 bg-indigo-500 rounded-sm"></span> <span className="text-slate-200">Scope 1 (Direct Fuel)</span></span>
                            <span className="font-mono text-white">{Math.round(scopes["Scope 1"]).toLocaleString()} kg</span>
                          </div>
                          <div className="h-6 w-full bg-slate-950/40 rounded-lg overflow-hidden border border-white/5">
                            <div className="h-full bg-indigo-500 transition-all duration-500" style={{ width: `${(scopes["Scope 1"] / max) * 100}%` }}></div>
                          </div>
                          <p className="text-[10px] text-slate-400">Direct stationary combustion (SAP diesel and natural gas)</p>
                        </div>

                        <div className="space-y-1">
                          <div className="flex justify-between text-xs font-semibold">
                            <span className="flex items-center space-x-1"><span className="h-3 w-3 bg-amber-400 rounded-sm"></span> <span className="text-slate-200">Scope 2 (Electricity Grid)</span></span>
                            <span className="font-mono text-white">{Math.round(scopes["Scope 2"]).toLocaleString()} kg</span>
                          </div>
                          <div className="h-6 w-full bg-slate-950/40 rounded-lg overflow-hidden border border-white/5">
                            <div className="h-full bg-amber-400 transition-all duration-500" style={{ width: `${(scopes["Scope 2"] / max) * 100}%` }}></div>
                          </div>
                          <p className="text-[10px] text-slate-400">Indirect emissions from facilities billing meters</p>
                        </div>

                        <div className="space-y-1">
                          <div className="flex justify-between text-xs font-semibold">
                            <span className="flex items-center space-x-1"><span className="h-3 w-3 bg-purple-500 rounded-sm"></span> <span className="text-slate-200">Scope 3 (Value Chain / Travel)</span></span>
                            <span className="font-mono text-white">{Math.round(scopes["Scope 3"]).toLocaleString()} kg</span>
                          </div>
                          <div className="h-6 w-full bg-slate-950/40 rounded-lg overflow-hidden border border-white/5">
                            <div className="h-full bg-purple-500 transition-all duration-500" style={{ width: `${(scopes["Scope 3"] / max) * 100}%` }}></div>
                          </div>
                          <p className="text-[10px] text-slate-400">Flights (computed distances), procurement steel, and hotel room nights</p>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Subgrid facility intensities comparative visualization */}
                <div className="bg-white/5 p-5 rounded-2xl border border-white/10 flex flex-col justify-between shadow-xl shadow-black/10">
                  <div>
                    <h4 className="text-xs font-bold font-display text-white uppercase tracking-wider mb-2 font-mono">Location intensity coefficient benchmark</h4>
                    <p className="text-[11px] text-slate-400 mb-4">Highlights the carbon efficiency differences of regional power grids where corporate assets operate.</p>
                  </div>
                  
                  <div className="space-y-3.5">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-semibold text-slate-200">France fulfillment (Paris Nuclear Subgrid)</span>
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-xs font-bold text-emerald-400">0.06 <span className="text-[9px] font-normal text-slate-400">kg/kWh</span></span>
                        <div className="w-16 h-2 bg-slate-950/40 rounded-full overflow-hidden border border-white/5"><div className="h-full bg-emerald-500 w-[14%]"></div></div>
                      </div>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-xs font-semibold text-slate-200">California operations (WECC West Coast)</span>
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-xs font-bold text-emerald-400">0.22 <span className="text-[9px] font-normal text-slate-400">kg/kWh</span></span>
                        <div className="w-16 h-2 bg-slate-950/40 rounded-full overflow-hidden border border-white/5"><div className="h-full bg-emerald-400 w-[50%]"></div></div>
                      </div>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-xs font-semibold text-slate-200">Germany operations (Frankfurt Fossil Grid)</span>
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-xs font-bold text-amber-400">0.35 <span className="text-[9px] font-normal text-slate-400">kg/kWh</span></span>
                        <div className="w-16 h-2 bg-slate-950/40 rounded-full overflow-hidden border border-white/5"><div className="h-full bg-amber-400 w-[80%]"></div></div>
                      </div>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-xs font-semibold text-slate-200">Texas Data Center (ERCOT Fuel Heavy Grid)</span>
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-xs font-bold text-red-400">0.44 <span className="text-[9px] font-normal text-slate-400">kg/kWh</span></span>
                        <div className="w-16 h-2 bg-slate-950/40 rounded-full overflow-hidden border border-white/5"><div className="h-full bg-red-400 w-[100%]"></div></div>
                      </div>
                    </div>
                  </div>

                  <p className="text-[10px] text-slate-300 bg-white/5 p-2.5 rounded-lg border border-white/15 mt-4">
                    <strong>Auditor Audit Alert:</strong> Ingesting operations without specified subgrids defaults to generic values, introducing minor reporting errors.
                  </p>
                </div>

              </div>

              {/* Monthly Allocation Calendarization Analysis (Scope 2 pro-rating) */}
              <div className="bg-white/5 p-5 rounded-2xl border border-white/10 shadow-xl shadow-black/10">
                <h4 className="text-xs font-bold font-display text-white uppercase tracking-wider mb-4 font-mono">Calendar monthly carbon indices (t CO₂e)</h4>
                
                {(() => {
                  const months: Record<string, number> = {};
                  records.forEach(r => {
                    if (r.status !== RecordStatus.FAILED) {
                      const m = r.servicePeriodMonth || "2026-05";
                      months[m] = (months[m] || 0) + (r.co2eKg / 1000);
                    }
                  });
                  const sorted = Object.keys(months).sort();
                  return (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {sorted.map(m => (
                        <div key={m} className="bg-slate-900/40 border border-white/5 p-4 rounded-xl text-center shadow-inner">
                          <span className="text-[10px] font-bold text-slate-400 uppercase font-mono">{m}</span>
                          <p className="text-2xl font-bold font-display text-white mt-1">
                            {months[m].toLocaleString(undefined, { maximumFractionDigits: 1 })}
                          </p>
                          <span className="text-[9px] text-slate-400 font-mono font-medium">Normalized Volume (t CO₂e)</span>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>

            </div>
          )}

          {/* ANOMALY & QA VIEW */}
          {activeTab === "anomalies" && (
            <div className="p-6 space-y-6">
              
              <div className="flex justify-between items-center border-b border-white/10 pb-4">
                <div>
                  <h3 className="text-base font-bold font-display text-white">Platform discrepancy & anomaly detector</h3>
                  <p className="text-xs text-slate-300 font-medium">Automatic compliance audits covering meter double-billing overlaps, unit translations, and expenditure-proxies.</p>
                </div>
                <span className="bg-red-500/20 text-red-300 border border-red-500/30 text-xs px-3 py-1 font-bold font-mono rounded-lg">
                  {flaggedCount + failedCount} active unresolved items
                </span>
              </div>

              {/* Loop through actual validation errors discovered */}
              {(() => {
                const duplicates = records.filter(r => r.status === RecordStatus.FLAGGED || r.status === RecordStatus.FAILED);
                if (duplicates.length === 0) {
                  return (
                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-8 text-center text-emerald-300 max-w-xl mx-auto">
                      <CheckCircle2 className="h-10 w-10 text-emerald-400 mx-auto mb-3" />
                      <h4 className="text-sm font-bold font-display">Pre-Audit Registers are completely clean</h4>
                      <p className="text-xs mt-1">All SAP, Utility utilities, and travel billing invoices are normalized. No overlaps, unmapped locations, or unparseable units reside on the platform.</p>
                    </div>
                  );
                }

                return (
                  <div className="grid grid-cols-1 gap-4">
                    {duplicates.map(r => (
                      <div 
                        key={r.id} 
                        className={`p-5 rounded-2xl border flex flex-col md:flex-row justify-between md:items-center gap-4 transition-colors ${r.status === RecordStatus.FAILED ? "bg-red-500/10 border-red-500/20" : "bg-amber-500/10 border-amber-500/20"}`}
                      >
                        <div className="space-y-2 flex-1">
                          <div className="flex items-center space-x-2">
                            <span className="font-mono text-xs font-bold text-white bg-slate-950 border border-white/15 px-2 py-0.5 rounded shadow-2xs">{r.id}</span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase font-mono tracking-wider">[{r.sourceType.replace(/_/g, ' ')}]</span>
                            
                            {r.status === RecordStatus.FAILED ? (
                              <span className="bg-red-500/20 text-red-300 border border-red-500/25 text-[9px] font-bold px-1.5 py-0.5 rounded-full font-mono uppercase">System Parse Failure</span>
                            ) : (
                              <span className="bg-amber-500/20 text-amber-300 border border-amber-500/25 text-[9px] font-bold px-1.5 py-0.5 rounded-full font-mono uppercase">Auditing Flag</span>
                            )}
                          </div>

                          {/* List actual flagged anomaly descriptions */}
                          <div className="space-y-1.5">
                            {r.anomalies.map((an, idx) => (
                              <div key={idx} className="flex items-start space-x-2 text-xs">
                                <AlertTriangle className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
                                <div>
                                  <span className="font-bold underline text-slate-200">{an.code}:</span>{" "}
                                  <span className="text-slate-300 font-medium">{an.description}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Interactive corrective shortcut buttons */}
                        <div className="flex items-center space-x-2 flex-shrink-0">
                          <button 
                            onClick={() => openEditModal(r)}
                            className="bg-white/10 hover:bg-white/15 border border-white/10 text-white text-xs px-3.5 py-2 rounded-xl font-bold tracking-tight shadow-3xs flex items-center space-x-1.5 transition-all cursor-pointer"
                          >
                            <Edit3 className="h-3.5 w-3.5 text-indigo-300" />
                            <span>Correct Inputs</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}

            </div>
          )}

          {/* HISTORIC AUDITING TRAILS */}
          {activeTab === "audit-logs" && (
            <div className="p-6">
              <div className="border-b border-white/10 pb-4 mb-6">
                <h3 className="text-base font-bold font-display text-white">Compliance Digital Signature Logs</h3>
                <p className="text-xs text-slate-300 font-medium">Traceable record alterations. Pre-locked edits automatically generate permanent compliance timestamps.</p>
              </div>

              {(() => {
                // Collect and flat map all editing entries
                const allEdits: { recordId: string; entry: AuditTrailEntry }[] = [];
                records.forEach(r => {
                  r.auditTrail.forEach(t => {
                    allEdits.push({ recordId: r.id, entry: t });
                  });
                });

                if (allEdits.length === 0) {
                  return (
                    <div className="text-center py-20 text-slate-400">
                      <Clock className="h-10 w-10 mx-auto mb-2 text-slate-500" />
                      <p className="text-xs font-semibold">No record adjustments have been executed yet.</p>
                      <p className="text-[10px] mt-1">Manual edits are logged dynamically for multi-tenant transparency.</p>
                    </div>
                  );
                }

                // Sort chronological desc
                const sortedEdits = allEdits.sort((a,b) => new Date(b.entry.timestamp).getTime() - new Date(a.entry.timestamp).getTime());

                return (
                  <div className="space-y-3">
                    {sortedEdits.map((log, idx) => (
                      <div key={idx} className="bg-white/5 border border-white/10 p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-md">
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2">
                            <span className="font-mono text-xs font-bold text-white">Record: {log.recordId}</span>
                            <span className="bg-white/10 text-slate-200 text-[10px] font-bold font-mono px-1.5 py-0.5 rounded border border-white/5">
                              {log.entry.fieldName}
                            </span>
                          </div>
                          
                          <p className="text-xs text-slate-300 font-medium flex-wrap">
                            Rewrote field <span className="font-bold underline text-white">{log.entry.fieldName}</span> from{" "}
                            <span className="font-bold font-mono bg-white/5 text-slate-300 px-1 border border-white/5">"{log.entry.previousValue}"</span> to{" "}
                            <span className="font-bold font-mono bg-emerald-500/10 text-emerald-300 px-1 border border-emerald-500/20">"{log.entry.newValue}"</span>
                          </p>
                        </div>

                        <div className="text-right sm:text-right flex flex-col justify-center">
                          <span className="text-xs font-bold text-white">{log.entry.userName}</span>
                          <span className="text-[10px] text-slate-400 font-mono mt-0.5">{new Date(log.entry.timestamp).toLocaleString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}

            </div>
          )}

          {/* AI COMPLIANCE AUDITOR HELPER */}
          {activeTab === "ai-helper" && (
            <div className="p-6 space-y-6">
              
              <div className="flex justify-between items-center pb-4 border-b border-white/10">
                <div className="space-y-1">
                  <h3 className="text-base font-bold font-display text-indigo-400 flex items-center space-x-2">
                    <Sparkles className="h-5 w-5 text-indigo-400 animate-pulse" />
                    <span>Gemini AI compliance auditor assistant</span>
                  </h3>
                  <p className="text-xs text-slate-300 font-medium">Instant environmental reasoning checks evaluating outstanding plant discrepancies, airline classes and tariff calculations.</p>
                </div>

                <button 
                  onClick={runAICountingAudit}
                  disabled={aiLoading}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center space-x-2 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <RefreshCw className={`h-4 w-4 ${aiLoading ? 'animate-spin' : ''}`} />
                  <span>{aiLoading ? "Evaluating ledger..." : "Re-Evaluate platform"}</span>
                </button>
              </div>

              {aiLoading ? (
                <div className="flex flex-col items-center justify-center py-20 space-y-3 max-w-xl mx-auto">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-400"></div>
                  <span className="text-xs text-slate-300 font-semibold font-mono">Gemini Auditor running cross-tenant diagnostic analysis...</span>
                </div>
              ) : aiReport ? (
                <div className="bg-slate-950/40 border border-white/10 rounded-2xl p-6 shadow-xl overflow-y-auto max-h-[500px]">
                  
                  {/* Clean custom markdown rendering inside container */}
                  <div className="prose prose-xs max-w-none text-xs text-slate-300 leading-relaxed font-mono space-y-4">
                    {aiReport.split('\n').map((line, idx) => {
                      if (line.startsWith('###')) {
                        return <h4 key={idx} className="text-sm font-bold font-display text-orange-400 mt-4 leading-normal">{line.replace('###', '')}</h4>;
                      }
                      if (line.startsWith('##')) {
                        return <h3 key={idx} className="text-base font-bold font-display text-indigo-300 mt-6 border-b border-white/10 pb-1">{line.replace('##', '')}</h3>;
                      }
                      if (line.startsWith('*') || line.startsWith('-')) {
                        return <li key={idx} className="ml-4 list-disc font-medium text-slate-300">{line.substring(2)}</li>;
                      }
                      return <p key={idx} className="font-medium text-slate-200">{line}</p>;
                    })}
                  </div>

                </div>
              ) : (
                <div className="text-center py-20 text-slate-400">
                  <Sparkles className="h-10 w-10 mx-auto mb-2 text-indigo-400" />
                  <p className="text-xs font-semibold">Compliance report evaluation not run.</p>
                  <p className="text-[10px] mt-1">Press "Re-Evaluate platform" to run Gemini audit evaluations.</p>
                </div>
              )}

            </div>
          )}

        </div>

      </main>

      {/* DETAIL MODAL DRAWER */}
      {detailedRecord && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex justify-end transition-opacity">
          
          <div className="w-full max-w-lg bg-slate-900/90 backdrop-blur-xl border-l border-white/15 h-full shadow-2xl flex flex-col justify-between p-6">
            <div className="space-y-6 overflow-y-auto flex-1 pr-2">
              
              {/* Header */}
              <div className="flex justify-between items-center border-b border-white/10 pb-4">
                <div>
                  <span className="font-mono text-xs font-bold text-slate-400 block uppercase">ESG Ledger Row Inspection</span>
                  <p className="text-lg font-bold text-white font-display mt-0.5">{detailedRecord.id}</p>
                </div>
                <button 
                  onClick={() => setDetailedRecord(null)}
                  className="text-slate-400 hover:text-white font-semibold transition-colors cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Scope & Norm footprint values */}
              <div className="grid grid-cols-2 gap-4 bg-white/5 border border-white/10 p-4 rounded-xl">
                <div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase font-mono tracking-wider">Carbon Footprint</span>
                  <div className="flex items-baseline space-x-1 mt-1">
                    <span className="text-xl font-bold font-display text-white">
                      {Math.round(detailedRecord.co2eKg).toLocaleString()}
                    </span>
                    <span className="text-[10px] font-bold font-mono text-slate-400">kg CO₂e</span>
                  </div>
                </div>
                <div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase font-mono tracking-wider">Financial Expense</span>
                  <div className="flex items-baseline space-x-1 mt-1">
                    <span className="text-xl font-bold font-display text-white">
                      ${detailedRecord.costUSD.toLocaleString()}
                    </span>
                    <span className="text-[10px] font-bold font-mono text-slate-400">USD</span>
                  </div>
                </div>
              </div>

              {/* Status information */}
              <div className="space-y-3">
                <span className="text-[10px] font-bold text-slate-400 uppercase font-mono block">Normalization Indices</span>
                <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-xs font-medium">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Classification:</span>
                    <span className="text-white font-bold">{detailedRecord.scope}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Target Site:</span>
                    <span className="text-white font-bold">{detailedRecord.plantOrLocation}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Active Engine Factor:</span>
                    <span className="text-slate-200 font-mono font-bold">{detailedRecord.emissionFactorUsed}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Factor Source Citation:</span>
                    <span className="text-slate-200 font-semibold">{detailedRecord.emissionFactorSrc}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Service Calendar Month:</span>
                    <span className="text-slate-200 font-mono font-bold">{detailedRecord.servicePeriodMonth}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Source Registry State:</span>
                    <span className="text-white capitalize font-bold">{detailedRecord.status}</span>
                  </div>
                </div>
              </div>

              {/* Discrepancies Alerts checks */}
              {detailedRecord.anomalies.length > 0 && (
                <div className="space-y-2 bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl">
                  <span className="text-[10px] font-bold text-amber-300 uppercase font-mono block">Platform QA discrepancy alerts</span>
                  <div className="space-y-1.5">
                    {detailedRecord.anomalies.map((an, idx) => (
                      <div key={idx} className="flex items-start space-x-2 text-xs">
                        <AlertTriangle className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
                        <span className="text-amber-300 font-medium">{an.description}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* SOURCE OF TRUTH: Raw Payload mapping */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase font-mono block">Ingested Real-World Payload JSON</span>
                <div className="p-3 bg-slate-950/60 border border-white/10 rounded-xl max-h-40 overflow-y-auto">
                   <pre className="text-[10px] text-emerald-400 font-mono overflow-x-auto">
                    {JSON.stringify(detailedRecord.rawPayload, null, 2)}
                  </pre>
                </div>
                <span className="text-[9px] text-slate-400 font-medium block">
                  Original raw payload is immutable. Changes recalculate Footprints.
                </span>
              </div>

              {/* Audit history */}
              {detailedRecord.auditTrail.length > 0 && (
                <div className="space-y-2.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase font-mono block">Alteration Chronology Check</span>
                  <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                    {detailedRecord.auditTrail.map((at, idx) => (
                      <div key={idx} className="bg-white/5 border border-white/5 p-2.5 rounded-lg text-[11px] font-medium text-slate-300">
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-bold text-slate-200 bg-white/10 px-1 border border-white/5">Field: {at.fieldName}</span>
                          <span className="text-[9px] text-slate-400 font-mono">{new Date(at.timestamp).toLocaleDateString()}</span>
                        </div>
                        <p className="text-slate-300">
                          Changed "{at.previousValue}" to "{at.newValue}" by <span className="font-bold underline text-white">{at.userName}</span>
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>

            {/* Modal Bottom Actions */}
            <div className="border-t border-white/10 pt-4 flex space-x-3 mt-6">
              {detailedRecord.status !== RecordStatus.APPROVED && (
                <button 
                  onClick={() => {
                    setDetailedRecord(null);
                    openEditModal(detailedRecord);
                  }}
                  className="bg-white/10 hover:bg-white/15 border border-white/10 text-white text-xs font-bold py-2.5 px-4 rounded-xl flex-1 transition-colors cursor-pointer"
                >
                  Execute Adjustments
                </button>
              )}
              {detailedRecord.status !== RecordStatus.APPROVED && detailedRecord.status !== RecordStatus.FAILED && (
                <button 
                  onClick={() => handleApprove(detailedRecord.id)}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold py-2.5 px-4 rounded-xl flex-1 transition-colors cursor-pointer"
                >
                  Approve and Lock
                </button>
              )}
            </div>

          </div>
        </div>
      )}

      {/* CORRECTIVE ADJUSTMENTS ACTION MODEL */}
      {editingRecord && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900/90 backdrop-blur-xl rounded-2xl border border-white/15 max-w-md w-full shadow-2xl overflow-hidden">
            
            <div className="p-6 border-b border-white/10">
              <h3 className="text-sm font-bold font-mono tracking-tight uppercase text-slate-400 block">Edit source-of-truth invoice inputs</h3>
              <p className="text-md font-bold font-display text-white mt-1">Record ID: {editingRecord.id}</p>
            </div>

            <div className="p-6 space-y-4 max-h-[400px] overflow-y-auto">
              <span className="text-[10px] font-bold text-slate-400 uppercase font-mono block mb-2">Configure Target Variables</span>
              
              {/* Dynamic adjustment forms based on sourceType */}
              {editingRecord.sourceType === SourceType.SAP_FUEL_PROCUREMENT && (
                <div className="space-y-3 text-xs font-semibold">
                  <div>
                    <label className="block text-slate-300 mb-1">MENGE (SAP combustible volume quantity)</label>
                    <input 
                      type="text" 
                      className="w-full border border-white/10 bg-slate-950/60 rounded-lg p-2 font-mono text-white" 
                      value={editPayload.MENGE || ""} 
                      onChange={(e) => setEditPayload({ ...editPayload, MENGE: e.target.value })} 
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-1">MEINS (SAP raw quantity units)</label>
                    <input 
                      type="text" 
                      className="w-full border border-white/10 bg-slate-950/60 rounded-lg p-2 font-mono text-white" 
                      value={editPayload.MEINS || ""} 
                      onChange={(e) => setEditPayload({ ...editPayload, MEINS: e.target.value })} 
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-1">WRBTR (Original currency posting charges)</label>
                    <input 
                      type="text" 
                      className="w-full border border-white/10 bg-slate-950/60 rounded-lg p-2 font-mono text-white" 
                      value={editPayload.WRBTR || ""} 
                      onChange={(e) => setEditPayload({ ...editPayload, WRBTR: e.target.value })} 
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-1">WERK (Corporate SAP Plant ID)</label>
                    <input 
                      type="text" 
                      className="w-full border border-white/10 bg-slate-950/60 rounded-lg p-2 font-mono text-white" 
                      placeholder="e.g. PL01, PL02"
                      value={editPayload.WERK || ""} 
                      onChange={(e) => setEditPayload({ ...editPayload, WERK: e.target.value })} 
                    />
                  </div>
                </div>
              )}

              {editingRecord.sourceType === SourceType.UTILITY_ELECTRICITY && (
                <div className="space-y-3 text-xs font-semibold">
                  <div>
                    <label className="block text-slate-300 mb-1">USAGE_KWH (Electricity invoice meter counts)</label>
                    <input 
                      type="text" 
                      className="w-full border border-white/10 bg-slate-950/60 rounded-lg p-2 font-mono text-white" 
                      value={editPayload.USAGE_KWH || ""} 
                      onChange={(e) => setEditPayload({ ...editPayload, USAGE_KWH: e.target.value })} 
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-1">ZIP_CODE (Subgrid zoning identifier)</label>
                    <input 
                      type="text" 
                      className="w-full border border-white/10 bg-slate-950/60 rounded-lg p-2 font-mono text-white" 
                      value={editPayload.ZIP_CODE || ""} 
                      onChange={(e) => setEditPayload({ ...editPayload, ZIP_CODE: e.target.value })} 
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-1">CHARGES_USD (Spend amount)</label>
                    <input 
                      type="text" 
                      className="w-full border border-white/10 bg-slate-950/60 rounded-lg p-2 font-mono text-white" 
                      value={editPayload.CHARGES_USD || ""} 
                      onChange={(e) => setEditPayload({ ...editPayload, CHARGES_USD: e.target.value })} 
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-1">SERVICE PERIOD INTERVAL</label>
                    <div className="grid grid-cols-2 gap-2 mt-1">
                      <div>
                        <span className="text-[10px] text-slate-400 block font-mono uppercase">Start</span>
                        <input type="text" className="w-full border border-white/10 bg-slate-950/60 p-1.5 rounded font-mono text-white" value={editPayload.SERVICE_START || ""} onChange={(e) => setEditPayload({ ...editPayload, SERVICE_START: e.target.value })} />
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block font-mono uppercase">End</span>
                        <input type="text" className="w-full border border-white/10 bg-slate-950/60 p-1.5 rounded font-mono text-white" value={editPayload.SERVICE_END || ""} onChange={(e) => setEditPayload({ ...editPayload, SERVICE_END: e.target.value })} />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {editingRecord.sourceType === SourceType.CORP_TRAVEL && (
                <div className="space-y-3 text-xs font-semibold">
                  
                  {editPayload.TRAVEL_TYPE === "FLIGHT" && (
                    <>
                      <div>
                        <label className="block text-slate-300 mb-1">DEPART_ARP (Airport Outtake)</label>
                        <input type="text" className="w-full border border-white/10 bg-slate-950/60 rounded-lg p-2 font-mono uppercase text-white" value={editPayload.DEPART_ARP || ""} onChange={(e) => setEditPayload({ ...editPayload, DEPART_ARP: e.target.value })} />
                      </div>
                      <div>
                        <label className="block text-slate-300 mb-1">ARRIVE_ARP (Airport Entry)</label>
                        <input type="text" className="w-full border border-white/10 bg-slate-950/60 rounded-lg p-2 font-mono uppercase text-white" value={editPayload.ARRIVE_ARP || ""} onChange={(e) => setEditPayload({ ...editPayload, ARRIVE_ARP: e.target.value })} />
                      </div>
                      <div>
                        <label className="block text-slate-300 mb-1">CABIN_CLASS (Cabin Allocation Class)</label>
                        <select className="w-full border border-white/10 bg-slate-950 rounded-lg p-2 text-white" value={editPayload.CABIN_CLASS || "ECONOMY"} onChange={(e) => setEditPayload({ ...editPayload, CABIN_CLASS: e.target.value })} style={{ colorScheme: "dark" }}>
                          <option value="ECONOMY">ECONOMY</option>
                          <option value="BUSINESS">BUSINESS</option>
                          <option value="FIRST">FIRST</option>
                        </select>
                      </div>
                    </>
                  )}

                  {editPayload.TRAVEL_TYPE === "HOTEL" && (
                    <>
                      <div>
                        <label className="block text-slate-300 mb-1">NIGHTS (Room durations)</label>
                        <input type="text" className="w-full border border-white/10 bg-slate-950/60 rounded-lg p-2 font-mono text-white" value={editPayload.NIGHTS || ""} onChange={(e) => setEditPayload({ ...editPayload, NIGHTS: e.target.value })} />
                      </div>
                      <div>
                        <label className="block text-slate-300 mb-1">COUNTRY (Benchmark grid reference)</label>
                        <input type="text" className="w-full border border-white/10 bg-slate-950/60 rounded-lg p-2 font-mono uppercase text-white" value={editPayload.COUNTRY || ""} onChange={(e) => setEditPayload({ ...editPayload, COUNTRY: e.target.value })} />
                      </div>
                    </>
                  )}

                  {editPayload.TRAVEL_TYPE === "GROUND" && (
                    <>
                      <div>
                        <label className="block text-slate-300 mb-1">DISTANCE_KM (Ground travel trip counts)</label>
                        <input type="text" className="w-full border border-white/10 bg-slate-950/60 rounded-lg p-2 font-mono text-white" value={editPayload.DISTANCE_KM || ""} onChange={(e) => setEditPayload({ ...editPayload, DISTANCE_KM: e.target.value })} />
                      </div>
                      <div>
                        <label className="block text-slate-300 mb-1">FUEL_TYPE (Combustible motor type)</label>
                        <select className="w-full border border-white/10 bg-slate-955 rounded-lg p-2 text-white" value={editPayload.FUEL_TYPE || "GASOLINE"} onChange={(e) => setEditPayload({ ...editPayload, FUEL_TYPE: e.target.value })} index-id="ground-fuel-id" style={{ colorScheme: "dark" }}>
                          <option value="GASOLINE">GASOLINE</option>
                          <option value="DIESEL">DIESEL</option>
                          <option value="HYBRID">HYBRID</option>
                          <option value="ELECTRIC">ELECTRIC</option>
                        </select>
                      </div>
                    </>
                  )}

                  <div>
                    <label className="block text-slate-300 mb-1">COST_USD (Spending)</label>
                    <input type="text" className="w-full border border-white/10 bg-slate-950/60 rounded-lg p-2 font-mono text-white" value={editPayload.COST_USD || ""} onChange={(e) => setEditPayload({ ...editPayload, COST_USD: e.target.value })} />
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 bg-slate-950/40 border-t border-white/10 flex space-x-3">
              <button 
                onClick={() => setEditingRecord(null)}
                className="bg-white/10 hover:bg-white/15 border border-white/10 text-white text-xs font-bold py-2 px-4 rounded-xl flex-1 transition-colors hover:cursor-pointer"
              >
                Discard
              </button>
              <button 
                onClick={handleSaveEdit}
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold py-2 px-4 rounded-xl flex-1 transition-colors hover:cursor-pointer"
              >
                Log Adjustments & Recalculate
              </button>
            </div>

          </div>
        </div>
      )}

      {/* FOOTER */}
      <footer className="bg-slate-950/40 border-t border-white/10 py-6 mt-12 backdrop-blur-xs">
        <div className="max-w-7xl mx-auto px-4 text-center font-mono text-[10px] text-slate-400 space-y-1">
          <p>ESG Ledger Compliance Audit Hub • 2026 Sandbox</p>
          <p>Strict Multi-Tenant Separation • Continuous Temporal Overlap Protection</p>
        </div>
      </footer>
    </div>
  );
}
