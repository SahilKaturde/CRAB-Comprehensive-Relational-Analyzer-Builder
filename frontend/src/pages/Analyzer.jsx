import { useState, useRef, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import Papa from "papaparse";
import ForceGraph2D from "react-force-graph-2d";
import logo from "../assets/logo/CRAB_LOGO.png";
import CsvDataTable from "../components/CsvDataTable";

const API_BASE = import.meta.env.VITE_DJANGO_API || "http://127.0.0.1:8000";
const AI_API = "http://localhost:8001";

// ════════════════════════════════════════════════════════
//  STEP INDICATOR — Neo-Brutalist
// ════════════════════════════════════════════════════════
function StepBar({ currentStep, steps }) {
  return (
    <div className="w-full bg-white border-b-4 border-black px-8 py-3 flex items-center justify-between">
      <div className="flex items-center gap-0 flex-1">
        {steps.map((step, idx) => {
          const stepNum = idx + 1;
          const isActive = stepNum === currentStep;
          const isDone = stepNum < currentStep;
          return (
            <div key={stepNum} className="flex items-center flex-1 last:flex-none">
              <div className={`flex items-center gap-2 px-4 py-2 transition-all ${
                isActive ? "bg-black text-white" :
                isDone ? "bg-black/10 text-black" :
                "text-gray-300"
              }`}>
                <span className={`font-mono text-[11px] font-black ${isActive ? "tracking-wide" : ""}`}>
                  {isDone ? "✓" : `0${stepNum}`}
                </span>
                <span className="font-mono text-[10px] uppercase hidden md:inline">{step}</span>
              </div>
              {idx < steps.length - 1 && (
                <div className={`flex-1 h-[2px] mx-1 ${isDone ? "bg-black" : "bg-gray-200"}`} />
              )}
            </div>
          );
        })}
      </div>
      <Link to="/" className="font-mono text-[10px] uppercase font-black border-b-2 border-black hover:text-crab-accent ml-4">← DASH</Link>
    </div>
  );
}

// ════════════════════════════════════════════════════════
//  MAIN ANALYZER COMPONENT
// ════════════════════════════════════════════════════════
export default function Analyzer() {
  const STEPS = ["INGEST", "CONVERT + BACKUP", "RELATIONSHIPS", "ANALYTICS", "AI CHAT"];

  // --- PIPELINE STATE ---
  const [currentStep, setCurrentStep] = useState(1);
  const [filesData, setFilesData] = useState({});
  const [rawFiles, setRawFiles] = useState([]);
  const [tables, setTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState("");
  const [tableData, setTableData] = useState([]);
  const [tableColumns, setTableColumns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupDone, setBackupDone] = useState(false);

  // --- STEP 3: RELATIONSHIPS ---
  const [sessionId, setSessionId] = useState("");
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [relationships, setRelationships] = useState([]);
  const [aiSummary, setAiSummary] = useState("");
  const [discoveryLoading, setDiscoveryLoading] = useState(false);

  // --- STEP 4: ANALYTICS ---
  const [profileData, setProfileData] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);

  // --- STEP 5: CHAT ---
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  const fileInputRef = useRef(null);
  const scrollRef = useRef(null);

  // Initialize SQL.js
  const [SQL, setSQL] = useState(null);
  useEffect(() => {
    window.initSqlJs({
      locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.12.0/${file}`
    }).then(sql => setSQL(sql));
  }, []);

  // Auto-scroll chat
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, chatLoading]);

  // ════════════════════════════════════════════════════════
  //  STEP 1: INGEST
  // ════════════════════════════════════════════════════════
  const handleFileChange = async (e) => {
    const uploadedFiles = Array.from(e.target.files);
    if (uploadedFiles.length === 0 || !SQL) return;

    setRawFiles(uploadedFiles);
    setLoading(true);
    let newTables = [];
    let newFilesData = {};

    for (const fileItem of uploadedFiles) {
      const fileExt = fileItem.name.split('.').pop().toLowerCase();
      const info = {
        name: fileItem.name,
        size: (fileItem.size / 1024).toFixed(2) + " KB",
        type: fileExt.toUpperCase()
      };

      if (fileExt === "csv") {
        await new Promise((resolve) => {
          Papa.parse(fileItem, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
              if (results.data && results.data.length > 0) {
                const headers = Object.keys(results.data[0]).map(key => ({
                  header: key,
                  accessorKey: key
                }));
                newFilesData[fileItem.name] = { data: results.data, columns: headers, info };
                newTables.push(fileItem.name);
              }
              resolve();
            }
          });
        });
      } else if (fileExt === "db" || fileExt === "sqlite") {
        await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => {
            const Uints = new Uint8Array(reader.result);
            const newDb = new SQL.Database(Uints);
            const res = newDb.exec("SELECT name FROM sqlite_master WHERE type='table';");
            if (res.length > 0) {
              const tableNames = res[0].values.map(v => v[0]);
              tableNames.forEach(tName => {
                const tableKey = `${fileItem.name}:${tName}`;
                const tRes = newDb.exec(`SELECT * FROM "${tName}" LIMIT 500;`);
                if (tRes.length > 0) {
                  const columns = tRes[0].columns;
                  const values = tRes[0].values;
                  const formattedData = values.map(row => {
                    const obj = {};
                    columns.forEach((col, idx) => { obj[col] = row[idx]; });
                    return obj;
                  });
                  newFilesData[tableKey] = {
                    data: formattedData,
                    columns: columns.map(c => ({ header: c, accessorKey: c })),
                    info: { ...info, name: tName, origin: fileItem.name, converted: true }
                  };
                  newTables.push(tableKey);
                }
              });
            }
            resolve();
          };
          reader.readAsArrayBuffer(fileItem);
        });
      } else if (fileExt === "sql") {
        await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => {
            const script = reader.result;
            const newDb = new SQL.Database();
            try {
              newDb.run(script);
              const res = newDb.exec("SELECT name FROM sqlite_master WHERE type='table';");
              if (res.length > 0) {
                const tableNames = res[0].values.map(v => v[0]);
                tableNames.forEach(tName => {
                  const tableKey = `${fileItem.name}:${tName}`;
                  const tRes = newDb.exec(`SELECT * FROM "${tName}" LIMIT 500;`);
                  if (tRes.length > 0) {
                    const columns = tRes[0].columns;
                    const values = tRes[0].values;
                    const formattedData = values.map(row => {
                      const obj = {};
                      columns.forEach((col, idx) => { obj[col] = row[idx]; });
                      return obj;
                    });
                    newFilesData[tableKey] = {
                      data: formattedData,
                      columns: columns.map(c => ({ header: c, accessorKey: c })),
                      info: { ...info, name: tName, origin: fileItem.name, converted: true }
                    };
                    newTables.push(tableKey);
                  }
                });
              }
            } catch (err) { console.error("SQL parse error:", err); }
            resolve();
          };
          reader.readAsText(fileItem);
        });
      }
    }

    setTables(newTables);
    setFilesData(newFilesData);
    if (newTables.length > 0) {
      const first = newTables[0];
      setSelectedTable(first);
      setTableData(newFilesData[first].data);
      setTableColumns(newFilesData[first].columns);
    }
    setLoading(false);
    setCurrentStep(2); // Auto-advance
  };

  const loadLocalTable = (tableKey) => {
    const source = filesData[tableKey];
    if (source) {
      setSelectedTable(tableKey);
      setTableData(source.data);
      setTableColumns(source.columns);
    }
  };

  // ════════════════════════════════════════════════════════
  //  STEP 2: BACKUP
  // ════════════════════════════════════════════════════════
  const handleBackup = async () => {
    setBackupLoading(true);
    try {
      const token = localStorage.getItem("access");
      const res = await fetch(`${API_BASE}/api/backup/start/`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ backup_type: "FULL" })
      });
      if (res.ok) {
        setBackupDone(true);
      }
    } catch (err) {
      console.error("Backup error:", err);
    } finally {
      setBackupLoading(false);
    }
  };

  const advanceFromStep2 = () => {
    setCurrentStep(3);
    handleDiscovery();
  };

  // ════════════════════════════════════════════════════════
  //  STEP 3: RELATIONSHIP DISCOVERY
  // ════════════════════════════════════════════════════════
  const handleDiscovery = async () => {
    if (rawFiles.length === 0) return;
    setDiscoveryLoading(true);

    const formData = new FormData();
    rawFiles.forEach(f => formData.append("files", f));

    try {
      const res = await fetch(`${AI_API}/ai/relationships`, {
        method: "POST",
        body: formData
      });
      if (res.ok) {
        const result = await res.json();
        setSessionId(result.session_id);
        setRelationships(result.relationships || []);
        setAiSummary(result.summary || "");

        // Build graph data
        const nodes = result.entities.map(id => ({ id, name: id, val: 5 }));
        const links = (result.relationships || []).map(rel => ({
          source: rel["Entity A"],
          target: rel["Entity B"],
          label: rel["Relationship"],
          color: rel["Relationship"] === "MANY : MANY" ? "#ff3b30" :
                 rel["Relationship"] === "1 : 1" ? "#34c759" : "#1a1a1a"
        }));
        setGraphData({ nodes, links });
      }
    } catch (err) {
      console.error("Discovery failed:", err);
    } finally {
      setDiscoveryLoading(false);
    }
  };

  // ════════════════════════════════════════════════════════
  //  STEP 4: DATA ANALYTICS / PROFILING
  // ════════════════════════════════════════════════════════
  const handleProfile = async () => {
    if (!sessionId) return;
    setProfileLoading(true);
    try {
      const res = await fetch(`${AI_API}/ai/profile?session_id=${sessionId}`, {
        method: "POST"
      });
      if (res.ok) {
        const data = await res.json();
        setProfileData(data);
        setCurrentStep(4);
      }
    } catch (err) {
      console.error("Profiling failed:", err);
    } finally {
      setProfileLoading(false);
    }
  };

  // ════════════════════════════════════════════════════════
  //  STEP 5: AI CHAT (with chart image support)
  // ════════════════════════════════════════════════════════
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!chatInput.trim() || chatLoading) return;

    const userMsg = chatInput;
    setChatInput("");
    setMessages(prev => [...prev, { role: "user", content: userMsg }]);
    setChatLoading(true);

    try {
      const res = await fetch(`${AI_API}/ai/chat?query=${encodeURIComponent(userMsg)}&session_id=${sessionId}`, {
        method: "POST"
      });
      if (!res.ok) throw new Error("Agent failed.");
      const data = await res.json();
      // Build response with optional images
      const aiMsg = {
        role: "assistant",
        content: data.response,
        images: data.images || []
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (err) {
      setMessages(prev => [...prev, { role: "assistant", content: "Error: " + err.message, images: [] }]);
    } finally {
      setChatLoading(false);
    }
  };

  const quickActions = [
    "Show me a summary of all tables",
    "Plot a bar chart of the data",
    "What correlations exist?",
    "Show distribution of values"
  ];

  // ════════════════════════════════════════════════════════
  //  RENDER
  // ════════════════════════════════════════════════════════
  return (
    <div className="flex flex-col h-screen bg-[#f4f4f0] text-[#1a1a1a] font-sans selection:bg-crab-accent selection:text-white overflow-hidden">
      {/* TOP: Step Progress Bar */}
      <StepBar currentStep={currentStep} steps={STEPS} />

      {/* MAIN CONTENT */}
      <div className="flex-1 overflow-y-auto">

        {/* ══════ STEP 1: INGEST ══════ */}
        {currentStep === 1 && (
          <div className="max-w-3xl mx-auto w-full mt-24 px-6">
            <div className="mb-16">
              <h1 className="text-5xl font-black uppercase tracking-tight leading-none">Ingest<br/>Your Data</h1>
              <p className="font-mono text-sm text-gray-400 mt-4 uppercase">Step 01 — Upload CSV, SQL, or DB files to begin the pipeline</p>
            </div>

            {loading ? (
              <div className="p-16 bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] text-center">
                <div className="flex items-center justify-center gap-3">
                  <div className="w-3 h-3 bg-black animate-bounce" style={{animationDelay: '0ms'}}></div>
                  <div className="w-3 h-3 bg-black animate-bounce" style={{animationDelay: '150ms'}}></div>
                  <div className="w-3 h-3 bg-black animate-bounce" style={{animationDelay: '300ms'}}></div>
                </div>
                <p className="font-mono text-xs uppercase mt-4 text-gray-400">Parsing files...</p>
              </div>
            ) : (
              <div onClick={() => fileInputRef.current.click()} className="group relative p-16 bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-1 hover:translate-y-1 transition-all cursor-pointer text-center">
                <div className="w-16 h-16 border-4 border-black mx-auto mb-6 flex items-center justify-center">
                  <span className="text-3xl">↑</span>
                </div>
                <h2 className="text-2xl font-black uppercase tracking-tight mb-2">Drop Files Here</h2>
                <p className="font-mono text-xs text-gray-400 uppercase tracking-widest">.csv  .sql  .db  .sqlite</p>
              </div>
            )}
            <input type="file" ref={fileInputRef} className="hidden" accept=".csv,.db,.sqlite,.sql" multiple onChange={handleFileChange} />
          </div>
        )}

        {/* ══════ STEP 2: CONVERT + BACKUP ══════ */}
        {currentStep === 2 && (
          <div className="max-w-5xl mx-auto w-full mt-12 px-6 space-y-8">
            <div>
              <h2 className="text-3xl font-black uppercase tracking-tight">Datasets Loaded</h2>
              <p className="font-mono text-xs text-gray-400 mt-1 uppercase">{tables.length} table(s) resolved from {rawFiles.length} file(s)</p>
            </div>

            {/* Table list with conversion status */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {tables.map(t => {
                const info = filesData[t]?.info;
                const isConverted = info?.converted;
                return (
                  <button key={t} onClick={() => loadLocalTable(t)} className={`p-4 text-left border-2 border-black transition-all ${selectedTable === t ? "bg-crab-accent text-white shadow-none translate-x-1 translate-y-1" : "bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"}`}>
                    <p className="font-mono text-[10px] font-black uppercase truncate">{info?.name || t}</p>
                    <div className={`flex items-center gap-2 mt-2 text-[8px] uppercase ${selectedTable === t ? "text-white/70" : "text-gray-400"}`}>
                      <span>{info?.type}</span>
                      <span>•</span>
                      <span>{info?.size}</span>
                      {isConverted && <span className="ml-auto bg-green-500 text-white px-1.5 py-0.5 font-black text-[7px]">CONVERTED → CSV</span>}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Data Preview */}
            {tableData.length > 0 && (
              <div className="border-4 border-black bg-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
                <div className="p-4 border-b-2 border-black bg-[#f9f9f9]">
                  <h3 className="font-heading text-xs uppercase">Preview: {filesData[selectedTable]?.info?.name || selectedTable}</h3>
                </div>
                <div className="max-h-[300px] overflow-auto">
                  <CsvDataTable data={tableData.slice(0, 30)} columns={tableColumns} />
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-4 items-center border-t-4 border-black pt-6">
              <button onClick={handleBackup} disabled={backupLoading || backupDone} className={`brutalist-btn-secondary !py-3 !w-auto px-8 text-[10px] font-black ${backupDone ? "!bg-green-500 !text-white !border-green-700" : ""}`}>
                {backupDone ? "✓ BACKUP SAVED" : backupLoading ? "BACKING UP..." : "MAKE BACKUP"}
              </button>
              <button onClick={advanceFromStep2} className="brutalist-btn-primary !py-3 !w-auto px-12 text-xs font-heading">
                DISCOVER RELATIONSHIPS →
              </button>
            </div>
          </div>
        )}

        {/* ══════ STEP 3: RELATIONSHIPS ══════ */}
        {currentStep === 3 && (
          <div className="max-w-6xl mx-auto w-full mt-8 px-6 space-y-8">
            {discoveryLoading ? (
              <div className="p-20 bg-white border-4 border-black shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] text-center">
                <h2 className="text-3xl font-black animate-pulse uppercase tracking-[8px]">Detecting Relationships...</h2>
                <p className="font-mono text-xs text-gray-400 mt-4 uppercase">Running Bidirectional Inclusion Dependency Algorithm</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-heading text-2xl uppercase">Entity-Relationship Map</h2>
                    <p className="font-mono text-xs text-gray-400 uppercase">{relationships.length} relationship(s) detected across {graphData.nodes.length} entities</p>
                  </div>
                </div>

                {/* Relationship Cards */}
                {relationships.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {(() => {
                      const oneToOne = relationships.filter(r => r.Relationship === "1 : 1");
                      const oneToMany = relationships.filter(r => r.Relationship === "1 : MANY");
                      const manyToMany = relationships.filter(r => r.Relationship === "MANY : MANY");
                      return (
                        <>
                          <div className="p-4 bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                            <h3 className="font-heading text-[10px] uppercase text-green-600 mb-3">1:1 Relationships</h3>
                            {oneToOne.length > 0 ? oneToOne.map((r, i) => (
                              <p key={i} className="font-mono text-[10px] mb-1">{r["Entity A"]} ↔ {r["Entity B"]}</p>
                            )) : <p className="font-mono text-[10px] text-gray-300 italic">None</p>}
                          </div>
                          <div className="p-4 bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                            <h3 className="font-heading text-[10px] uppercase mb-3">1:MANY Relationships</h3>
                            {oneToMany.length > 0 ? oneToMany.map((r, i) => (
                              <p key={i} className="font-mono text-[10px] mb-1">{r["Entity A"]} → {r["Entity B"]}</p>
                            )) : <p className="font-mono text-[10px] text-gray-300 italic">None</p>}
                          </div>
                          <div className="p-4 bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                            <h3 className="font-heading text-[10px] uppercase text-red-500 mb-3">M:M Relationships</h3>
                            {manyToMany.length > 0 ? manyToMany.map((r, i) => (
                              <div key={i} className="mb-2">
                                <p className="font-mono text-[10px] font-black">{r["Entity A"]} ⇌ {r["Entity B"]}</p>
                                <p className="font-mono text-[8px] text-gray-400">{r["Connecting Key"]}</p>
                              </div>
                            )) : <p className="font-mono text-[10px] text-gray-300 italic">None</p>}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                )}

                {/* ERD Graph */}
                <div className="border-4 border-black bg-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] relative" style={{ height: "450px" }}>
                  <div className="absolute top-4 left-4 z-10 bg-white/90 backdrop-blur-sm px-3 py-2 border-2 border-black">
                    <span className="font-heading text-[10px] uppercase">Topology Graph</span>
                  </div>
                  {graphData.nodes.length > 0 ? (
                    <ForceGraph2D
                      graphData={graphData}
                      nodeLabel="name"
                      nodeColor={() => "#4da6ff"}
                      linkColor={link => link.color || "#1a1a1a"}
                      linkWidth={2}
                      linkLabel="label"
                      linkDirectionalArrowLength={6}
                      linkDirectionalArrowRelPos={1}
                      backgroundColor="#f4f4f0"
                      nodeCanvasObject={(node, ctx, globalScale) => {
                        const label = node.name;
                        const fontSize = 12 / globalScale;
                        ctx.font = `bold ${fontSize}px 'Inter', sans-serif`;
                        const textWidth = ctx.measureText(label).width;
                        const bckgDimensions = [textWidth, fontSize].map(n => n + fontSize * 0.5);
                        ctx.fillStyle = 'rgba(255,255,255,0.95)';
                        ctx.fillRect(node.x - bckgDimensions[0] / 2, node.y - bckgDimensions[1] / 2, ...bckgDimensions);
                        ctx.lineWidth = 1.5 / globalScale;
                        ctx.strokeStyle = '#000';
                        ctx.strokeRect(node.x - bckgDimensions[0] / 2, node.y - bckgDimensions[1] / 2, ...bckgDimensions);
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.fillStyle = '#1a1a1a';
                        ctx.fillText(label, node.x, node.y);
                      }}
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full opacity-10">
                      <span className="font-heading text-3xl uppercase">No Connections</span>
                    </div>
                  )}
                </div>

                {/* AI Summary */}
                {aiSummary && (
                  <div className="p-6 bg-[#1a1a1a] text-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(255,59,48,1)]">
                    <h3 className="font-heading text-sm uppercase mb-3 text-crab-accent">AI Architecture Summary</h3>
                    <p className="font-mono text-xs leading-relaxed whitespace-pre-wrap">{aiSummary}</p>
                  </div>
                )}

                <div className="flex justify-end border-t-4 border-black pt-6">
                  <button onClick={handleProfile} disabled={profileLoading} className="brutalist-btn-primary !py-3 !w-auto px-12 text-xs font-heading">
                    {profileLoading ? "PROFILING..." : "RUN DATA ANALYTICS →"}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ══════ STEP 4 & 5: ANALYTICS + CHAT ══════ */}
        {(currentStep === 4 || currentStep === 5) && profileData && (
          <div className="flex h-full">
            {/* LEFT: Analytics Panel */}
            <div className={`${currentStep === 5 ? "w-3/5" : "w-full"} overflow-y-auto p-6 lg:p-8 transition-all`}>
              <div className="max-w-5xl mx-auto space-y-8">
                <div>
                  <h2 className="text-3xl font-black uppercase tracking-tight">Data Quality</h2>
                  <p className="font-mono text-xs text-gray-400 mt-1 uppercase">Session {sessionId?.slice(0, 8)} — {profileData.summary.total_tables} tables profiled</p>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {[
                    { label: "TABLES", value: profileData.summary.total_tables, accent: false },
                    { label: "ROWS", value: profileData.summary.total_rows.toLocaleString(), accent: false },
                    { label: "COLUMNS", value: profileData.summary.total_columns, accent: false },
                    { label: "COMPLETE", value: `${profileData.summary.overall_completeness}%`, accent: true },
                    { label: "DEPTH", value: `D${profileData.summary.depth_code}`, accent: true },
                  ].map((card, i) => (
                    <div key={i} className={`p-4 border-2 border-black ${card.accent ? "bg-black text-white" : "bg-white"}`}>
                      <p className={`font-mono text-[8px] uppercase ${card.accent ? "text-gray-500" : "text-gray-400"}`}>{card.label}</p>
                      <p className="font-mono text-2xl font-black mt-1">{card.value}</p>
                    </div>
                  ))}
                </div>

                {/* Per-Table Profiles */}
                {Object.entries(profileData.tables).map(([tName, tData]) => (
                  <div key={tName} className="bg-white border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                    <div className="p-4 border-b-2 border-black bg-[#f9f9f9] flex items-center justify-between">
                      <h3 className="font-heading text-sm uppercase">{tName}</h3>
                      <div className="flex items-center gap-4 font-mono text-[10px] uppercase text-gray-400">
                        <span>{tData.row_count} rows</span>
                        <span>{tData.column_count} cols</span>
                        <span className={`font-black ${tData.completeness >= 90 ? "text-green-500" : tData.completeness >= 70 ? "text-yellow-500" : "text-red-500"}`}>
                          {tData.completeness}% complete
                        </span>
                      </div>
                    </div>
                    {/* Completeness Bar */}
                    <div className="px-4 pt-3 pb-1">
                      <div className="w-full h-3 bg-gray-200 border border-black">
                        <div className={`h-full transition-all ${tData.completeness >= 90 ? "bg-green-500" : tData.completeness >= 70 ? "bg-yellow-500" : "bg-red-500"}`} style={{ width: `${tData.completeness}%` }} />
                      </div>
                    </div>
                    {/* Column Grid */}
                    <div className="p-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      {tData.columns.map((col, i) => (
                        <div key={i} className="p-3 border border-gray-200 hover:border-black transition-colors">
                          <p className="font-mono text-[10px] font-black uppercase truncate text-crab-accent">{col.name}</p>
                          <p className="font-mono text-xs mt-1">{col.dtype}</p>
                          <div className="flex justify-between mt-2 text-[8px] font-mono text-gray-400 uppercase">
                            <span>{col.null_pct}% null</span>
                            <span>{col.unique_count} uniq</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                {/* Unlock Chat Button */}
                {currentStep === 4 && (
                  <div className="flex justify-center pt-4 pb-12">
                    <button onClick={() => { setCurrentStep(5); setMessages([{ role: "assistant", content: `Pipeline complete. I have access to ${profileData.summary.total_tables} table(s) with ${profileData.summary.total_rows} rows. Ask me anything about your data.` }]); }} className="brutalist-btn-primary !py-4 !w-auto px-16 text-sm font-heading shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
                      🔓 UNLOCK AI CHAT AGENT
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT: Chat Sidebar (Step 5 only) */}
            {currentStep === 5 && (
              <aside className="w-2/5 bg-white border-l-4 border-black h-full flex flex-col shadow-[-8px_0px_0px_0px_rgba(0,0,0,1)] z-10">
                <div className="p-5 border-b-4 border-black bg-[#f9f9f9]">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="font-heading text-lg uppercase tracking-tighter">CRAB Agent</h2>
                      <p className="text-[8px] font-mono text-gray-400 uppercase">6-Node LangGraph • Router → Analyst | Plotter | Stats</p>
                    </div>
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-green-500 animate-pulse" title="Agent Active"></div>
                      <div className="w-2 h-2 bg-blue-500" title="Checkpointed"></div>
                    </div>
                  </div>
                </div>

                <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-[#fcfcfc]">
                  {messages.map((msg, idx) => (
                    <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[95%] border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] ${
                        msg.role === "user" ? "bg-crab-accent text-white" : "bg-white text-[#1a1a1a]"
                      }`}>
                        <div className="p-3">
                          <p className="font-mono text-xs whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                        </div>
                        {/* Render chart images if present */}
                        {msg.images && msg.images.length > 0 && (
                          <div className="border-t border-gray-200">
                            {msg.images.map((img, imgIdx) => (
                              <div key={imgIdx} className="p-2">
                                <div className="border-2 border-black bg-white">
                                  <div className="px-2 py-1 bg-[#1a1a1a] flex items-center gap-2">
                                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                                    <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                    <span className="font-mono text-[8px] text-gray-400 ml-2">chart_{idx}_{imgIdx}.png</span>
                                  </div>
                                  <img src={`data:image/png;base64,${img}`} alt="Generated Chart" className="w-full" />
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {chatLoading && (
                    <div className="flex justify-start">
                      <div className="p-3 bg-gray-100 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                        <div className="flex items-center gap-3">
                          <div className="flex gap-1">
                            <div className="w-2 h-2 bg-crab-accent rounded-full animate-bounce" style={{animationDelay: '0ms'}}></div>
                            <div className="w-2 h-2 bg-crab-accent rounded-full animate-bounce" style={{animationDelay: '150ms'}}></div>
                            <div className="w-2 h-2 bg-crab-accent rounded-full animate-bounce" style={{animationDelay: '300ms'}}></div>
                          </div>
                          <span className="font-mono text-[10px] uppercase font-black">Agent routing...</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Quick Actions */}
                {messages.length <= 1 && (
                  <div className="px-4 py-3 border-t-2 border-gray-100 bg-[#f9f9f9]">
                    <p className="text-[8px] font-mono text-gray-400 uppercase mb-2">Quick Actions</p>
                    <div className="flex flex-wrap gap-2">
                      {quickActions.map((qa, i) => (
                        <button key={i} onClick={() => { setChatInput(qa); }} className="px-2 py-1 border border-black text-[8px] font-mono uppercase hover:bg-crab-accent hover:text-white hover:border-crab-accent transition-colors">
                          {qa}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="p-4 border-t-4 border-black bg-white">
                  <form onSubmit={handleSendMessage} className="relative">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="Ask anything, request charts, analyze data..."
                      className="w-full p-3 pr-10 border-4 border-black font-mono text-xs focus:outline-none focus:border-crab-accent"
                      disabled={chatLoading}
                    />
                    <button type="submit" disabled={chatLoading} className="absolute right-3 top-1/2 -translate-y-1/2 text-xl hover:text-crab-accent transition-colors">➔</button>
                  </form>
                </div>
              </aside>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
