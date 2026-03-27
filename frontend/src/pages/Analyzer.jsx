import { useState, useRef, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import Papa from "papaparse";
import ForceGraph2D from "react-force-graph-2d";
import logo from "../assets/logo/CRAB_LOGO.png";
import CsvDataTable from "../components/CsvDataTable";

const API_BASE = import.meta.env.VITE_DJANGO_API || "http://127.0.0.1:8000";
const AI_API = "http://localhost:8001";

// ════════════════════════════════════════════════════════
//  STEP INDICATOR — Refined Neo-Brutalist
// ════════════════════════════════════════════════════════
function StepBar({ currentStep, steps }) {
  return (
    <div className="w-full bg-white border-b-2 border-black px-6 py-0 flex items-center justify-between">
      <Link to="/" className="flex items-center gap-3 mr-6 py-3 shrink-0">
        <img src={logo} alt="CRAB" className="h-7 w-auto" />
        <span className="font-heading text-[8px] uppercase tracking-tight hidden md:block">CRAB</span>
      </Link>
      <div className="flex items-center flex-1">
        {steps.map((step, idx) => {
          const stepNum = idx + 1;
          const isActive = stepNum === currentStep;
          const isDone = stepNum < currentStep;
          return (
            <div key={stepNum} className="flex items-center flex-1 last:flex-none">
              <div className={`flex items-center gap-2 px-3 py-3 transition-all duration-200 ${
                isActive ? "bg-black text-white" :
                isDone ? "text-crab-accent" :
                "text-black/20"
              }`}>
                <span className="font-mono text-[10px] font-black">
                  {isDone ? "✓" : `0${stepNum}`}
                </span>
                <span className={`font-mono text-[9px] uppercase hidden lg:inline ${isDone ? "font-black" : ""}`}>{step}</span>
              </div>
              {idx < steps.length - 1 && (
                <div className={`flex-1 h-px mx-1 transition-colors ${isDone ? "bg-crab-accent" : "bg-black/10"}`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════
//  MAIN ANALYZER COMPONENT
// ════════════════════════════════════════════════════════
export default function Analyzer() {
  const STEPS = ["INGEST", "CONVERT", "RELATIONSHIPS", "ANALYTICS", "AI CHAT"];

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
  const graphContainerRef = useRef(null);
  const [graphDimensions, setGraphDimensions] = useState({ width: 800, height: 420 });

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

  // Measure graph container for proper sizing
  useEffect(() => {
    if (currentStep === 3 && graphContainerRef.current) {
      const obs = new ResizeObserver((entries) => {
        for (const entry of entries) {
          setGraphDimensions({
            width: entry.contentRect.width,
            height: entry.contentRect.height
          });
        }
      });
      obs.observe(graphContainerRef.current);
      return () => obs.disconnect();
    }
  }, [currentStep, discoveryLoading]);

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
    setCurrentStep(2);
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

        const nodes = result.entities.map(id => ({ id, name: id, val: 5 }));
        const links = (result.relationships || []).map(rel => ({
          source: rel["Entity A"],
          target: rel["Entity B"],
          label: rel["Relationship"],
          color: rel["Relationship"] === "MANY : MANY" ? "#FF3B30" :
                 rel["Relationship"] === "1 : 1" ? "#22c55e" : "#1a1a1a"
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
  //  STEP 5: AI CHAT
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
    <div className="flex flex-col h-screen bg-white text-[#1a1a1a] font-sans selection:bg-crab-accent selection:text-white overflow-hidden">
      <StepBar currentStep={currentStep} steps={STEPS} />

      <div className="flex-1 overflow-y-auto">

        {/* ══════ STEP 1: INGEST ══════ */}
        {currentStep === 1 && (
          <div className="flex-1 flex flex-col items-center justify-center min-h-[calc(100vh-52px)] px-6">
            <div className="max-w-xl w-full animate-fade-in">
              <div className="text-center mb-16">
                <p className="font-mono text-[10px] uppercase tracking-[0.5em] text-black/30 mb-6">Step 01</p>
                <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tight leading-none">
                  Ingest Data
                </h1>
                <p className="font-mono text-xs text-black/40 mt-4 uppercase tracking-widest">Upload CSV, SQL, or DB files</p>
              </div>

              {loading ? (
                <div className="p-16 bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] text-center">
                  <div className="flex items-center justify-center gap-3">
                    <div className="w-2 h-2 bg-black animate-bounce" style={{animationDelay: '0ms'}}></div>
                    <div className="w-2 h-2 bg-black animate-bounce" style={{animationDelay: '150ms'}}></div>
                    <div className="w-2 h-2 bg-black animate-bounce" style={{animationDelay: '300ms'}}></div>
                  </div>
                  <p className="font-mono text-[10px] uppercase mt-4 text-black/30">Parsing files...</p>
                </div>
              ) : (
                <div onClick={() => fileInputRef.current.click()} className="group relative p-16 bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] transition-all cursor-pointer text-center">
                  <div className="w-12 h-12 border-2 border-black mx-auto mb-6 flex items-center justify-center group-hover:bg-crab-accent group-hover:border-crab-accent group-hover:text-white transition-colors">
                    <span className="text-2xl">↑</span>
                  </div>
                  <h2 className="text-lg font-black uppercase tracking-tight mb-2">Drop Files Here</h2>
                  <p className="font-mono text-[10px] text-black/30 uppercase tracking-widest">.csv  .sql  .db  .sqlite</p>
                </div>
              )}
              <input type="file" ref={fileInputRef} className="hidden" accept=".csv,.db,.sqlite,.sql" multiple onChange={handleFileChange} />
            </div>
          </div>
        )}

        {/* ══════ STEP 2: CONVERT + BACKUP ══════ */}
        {currentStep === 2 && (
          <div className="max-w-5xl mx-auto w-full py-10 px-6 space-y-10 animate-fade-in">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b-2 border-black/5 pb-8">
              <div className="flex items-center gap-6">
                <div className="w-16 h-16 border-2 border-crab-accent/20 p-2 shrink-0">
                  <img src={logo} alt="CRAB" className="w-full h-full object-contain" />
                </div>
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.5em] text-crab-accent mb-2">Step 02</p>
                  <h2 className="text-3xl font-black uppercase tracking-tight">Datasets Loaded</h2>
                  <p className="font-mono text-xs text-black/40 mt-1 uppercase leading-none">{tables.length} table(s) found across {rawFiles.length} file(s)</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {tables.map(t => {
                const info = filesData[t]?.info;
                const isConverted = info?.converted;
                const isSelected = selectedTable === t;
                return (
                  <button 
                    key={t} 
                    onClick={() => loadLocalTable(t)} 
                    className={`group p-5 text-left border-2 transition-all relative ${
                      isSelected 
                        ? "bg-white border-crab-accent shadow-[4px_4px_0px_0px_rgba(255,59,48,1)] translate-x-[-2px] translate-y-[-2px]" 
                        : "bg-white border-black/10 hover:border-black/40 shadow-none"
                    }`}
                  >
                    {isSelected && <div className="absolute top-0 left-0 w-full h-1 bg-crab-accent" />}
                    <p className={`font-mono text-[10px] font-black uppercase truncate ${isSelected ? "text-crab-accent font-black" : "text-black/70"}`}>
                      {info?.name || t}
                    </p>
                    <div className="flex items-center gap-2 mt-3 text-[8px] uppercase font-mono tracking-widest text-black/30">
                      <span className={isSelected ? "text-crab-accent/60" : ""}>{info?.type}</span>
                      <span>•</span>
                      <span className={isSelected ? "text-crab-accent/60" : ""}>{info?.size}</span>
                      {isConverted && (
                        <span className="ml-auto bg-crab-accent text-white px-2 py-0.5 font-black text-[7px] leading-none">
                          CSV_SYNCED
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {tableData.length > 0 && (
              <div className="border-2 border-black bg-white">
                <div className="p-3 border-b border-black/10 flex items-center justify-between">
                  <h3 className="font-mono text-[10px] font-black uppercase">Preview: {filesData[selectedTable]?.info?.name || selectedTable}</h3>
                  <span className="font-mono text-[8px] text-black/30 uppercase">{tableData.length} rows</span>
                </div>
                <div className="max-h-[280px] overflow-auto">
                  <CsvDataTable data={tableData.slice(0, 30)} columns={tableColumns} />
                </div>
              </div>
            )}

            <div className="flex gap-3 items-center border-t border-black/10 pt-6">
              <button onClick={handleBackup} disabled={backupLoading || backupDone} className={`brutalist-btn-secondary !py-3 !w-auto px-8 text-[10px] font-black ${backupDone ? "!bg-black !text-white" : ""}`}>
                {backupDone ? "✓ BACKED UP" : backupLoading ? "SAVING..." : "BACKUP"}
              </button>
              <button onClick={advanceFromStep2} className="brutalist-btn-primary !py-3 !w-auto px-10 text-[10px] font-heading">
                DISCOVER RELATIONSHIPS →
              </button>
            </div>
          </div>
        )}

        {/* ══════ STEP 3: RELATIONSHIPS ══════ */}
        {currentStep === 3 && (
          <div className="max-w-6xl mx-auto w-full py-8 px-6 space-y-6 animate-fade-in">
            {discoveryLoading ? (
              <div className="flex flex-col items-center justify-center min-h-[60vh]">
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-6">
                    <div className="w-3 h-3 bg-crab-accent animate-bounce" style={{animationDelay: '0ms'}}></div>
                    <div className="w-3 h-3 bg-crab-accent animate-bounce" style={{animationDelay: '150ms'}}></div>
                    <div className="w-3 h-3 bg-crab-accent animate-bounce" style={{animationDelay: '300ms'}}></div>
                  </div>
                  <h2 className="text-2xl font-black uppercase tracking-tight mb-2">Detecting Relationships</h2>
                  <p className="font-mono text-[10px] text-black/30 uppercase tracking-widest">Bidirectional Inclusion Dependency Algorithm</p>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-end justify-between">
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.5em] text-black/30 mb-2">Step 03</p>
                    <h2 className="text-3xl font-black uppercase tracking-tight">Entity-Relationship Map</h2>
                    <p className="font-mono text-xs text-black/40 mt-1 uppercase">{relationships.length} relationship(s) · {graphData.nodes.length} entities</p>
                  </div>
                </div>

                {/* Relationship Summary Cards */}
                {relationships.length > 0 && (
                  <div className="grid grid-cols-3 gap-0 border-2 border-black divide-x-2 divide-black">
                    {(() => {
                      const oneToOne = relationships.filter(r => r.Relationship === "1 : 1");
                      const oneToMany = relationships.filter(r => r.Relationship === "1 : MANY");
                      const manyToMany = relationships.filter(r => r.Relationship === "MANY : MANY");
                      return (
                        <>
                          <div className="p-4 bg-white">
                            <div className="flex items-center gap-2 mb-3">
                              <div className="w-2 h-2 bg-green-500"></div>
                              <h3 className="font-mono text-[10px] font-black uppercase">1 : 1</h3>
                              <span className="ml-auto font-mono text-lg font-black">{oneToOne.length}</span>
                            </div>
                            {oneToOne.map((r, i) => (
                              <p key={i} className="font-mono text-[9px] text-black/50 mb-0.5">{r["Entity A"]} ↔ {r["Entity B"]}</p>
                            ))}
                          </div>
                          <div className="p-4 bg-white">
                            <div className="flex items-center gap-2 mb-3">
                              <div className="w-2 h-2 bg-black"></div>
                              <h3 className="font-mono text-[10px] font-black uppercase">1 : MANY</h3>
                              <span className="ml-auto font-mono text-lg font-black">{oneToMany.length}</span>
                            </div>
                            {oneToMany.map((r, i) => (
                              <p key={i} className="font-mono text-[9px] text-black/50 mb-0.5">{r["Entity A"]} → {r["Entity B"]}</p>
                            ))}
                          </div>
                          <div className="p-4 bg-white">
                            <div className="flex items-center gap-2 mb-3">
                              <div className="w-2 h-2 bg-crab-accent"></div>
                              <h3 className="font-mono text-[10px] font-black uppercase">M : M</h3>
                              <span className="ml-auto font-mono text-lg font-black">{manyToMany.length}</span>
                            </div>
                            {manyToMany.map((r, i) => (
                              <div key={i} className="mb-1">
                                <p className="font-mono text-[9px] text-black/50">{r["Entity A"]} ⇌ {r["Entity B"]}</p>
                              </div>
                            ))}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                )}

                {/* ERD Graph — CONTAINED */}
                <div className="border-2 border-black bg-white relative">
                  <div className="px-4 py-2 border-b border-black/10 flex items-center justify-between">
                    <span className="font-mono text-[10px] font-black uppercase">Topology Graph</span>
                    <div className="flex items-center gap-4 font-mono text-[8px] text-black/30">
                      <span className="flex items-center gap-1"><span className="w-2 h-2 bg-green-500 inline-block"></span> 1:1</span>
                      <span className="flex items-center gap-1"><span className="w-2 h-2 bg-black inline-block"></span> 1:M</span>
                      <span className="flex items-center gap-1"><span className="w-2 h-2 bg-crab-accent inline-block"></span> M:M</span>
                    </div>
                  </div>
                  <div ref={graphContainerRef} className="graph-container" style={{ height: "420px" }}>
                    {graphData.nodes.length > 0 ? (
                      <ForceGraph2D
                        graphData={graphData}
                        width={graphDimensions.width}
                        height={graphDimensions.height}
                        nodeLabel="name"
                        nodeColor={() => "#1a1a1a"}
                        linkColor={link => link.color || "#1a1a1a"}
                        linkWidth={2}
                        linkLabel="label"
                        linkDirectionalArrowLength={6}
                        linkDirectionalArrowRelPos={1}
                        backgroundColor="#ffffff"
                        nodeCanvasObject={(node, ctx, globalScale) => {
                          const label = node.name;
                          const fontSize = 11 / globalScale;
                          ctx.font = `800 ${fontSize}px 'Inter', sans-serif`;
                          const textWidth = ctx.measureText(label).width;
                          const pad = fontSize * 0.6;
                          const bw = textWidth + pad * 2;
                          const bh = fontSize + pad;
                          // Black rectangle node
                          ctx.fillStyle = '#1a1a1a';
                          ctx.fillRect(node.x - bw / 2, node.y - bh / 2, bw, bh);
                          // White text
                          ctx.textAlign = 'center';
                          ctx.textBaseline = 'middle';
                          ctx.fillStyle = '#ffffff';
                          ctx.fillText(label, node.x, node.y);
                        }}
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <span className="font-mono text-sm text-black/10 uppercase">No connections detected</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* AI Summary */}
                {aiSummary && (
                  <div className="p-5 bg-black text-white border-2 border-black">
                    <h3 className="font-mono text-[10px] font-black uppercase mb-3 text-crab-accent">AI Architecture Summary</h3>
                    <p className="font-mono text-xs leading-relaxed whitespace-pre-wrap text-white/80">{aiSummary}</p>
                  </div>
                )}

                <div className="flex justify-end border-t border-black/10 pt-6">
                  <button onClick={handleProfile} disabled={profileLoading} className="brutalist-btn-primary !py-3 !w-auto px-10 text-[10px] font-heading">
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
              <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.5em] text-black/30 mb-2">Step 04</p>
                  <h2 className="text-3xl font-black uppercase tracking-tight">Data Quality</h2>
                  <p className="font-mono text-xs text-black/40 mt-1 uppercase">Session {sessionId?.slice(0, 8)} · {profileData.summary.total_tables} tables</p>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-0 border-2 border-black divide-x divide-black transition-all">
                  {[
                    { label: "TABLES", value: profileData.summary.total_tables, accent: false },
                    { label: "ROWS", value: profileData.summary.total_rows.toLocaleString(), accent: false },
                    { label: "COLUMNS", value: profileData.summary.total_columns, accent: false },
                    { label: "COMPLETE", value: `${profileData.summary.overall_completeness}%`, accent: true },
                    { label: "DEPTH", value: `D${profileData.summary.depth_code}`, accent: true },
                  ].map((card, i) => (
                    <div key={i} className={`p-5 bg-white relative overflow-hidden group`}>
                      {card.accent && <div className="absolute top-0 left-0 w-full h-1.5 bg-crab-accent" />}
                      <p className="font-mono text-[8px] uppercase text-black/40 tracking-widest">{card.label}</p>
                      <p className={`font-mono text-2xl font-black mt-2 ${card.accent ? "text-crab-accent" : "text-black"}`}>
                        {card.value}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Per-Table Profiles */}
                {Object.entries(profileData.tables).map(([tName, tData]) => (
                  <div key={tName} className="bg-white border-2 border-black relative group transition-all hover:-translate-y-1 hover:shadow-[4px_4px_0px_0px_rgba(255,59,48,1)] overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-crab-accent opacity-20 group-hover:opacity-100 transition-opacity" />
                    <div className="p-4 border-b border-black/10 flex items-center justify-between">
                      <h3 className="font-mono text-[10px] font-black uppercase text-black/80">{tName}</h3>
                      <div className="flex items-center gap-4 font-mono text-[9px] uppercase text-black/30">
                        <span>{tData.row_count} rows</span>
                        <span>{tData.column_count} cols</span>
                        <span className={`font-black tracking-tighter ${tData.completeness >= 90 ? "text-green-500" : tData.completeness >= 70 ? "text-yellow-500" : "text-crab-accent"}`}>
                          {tData.completeness}%
                        </span>
                      </div>
                    </div>
                    {/* Completeness Bar */}
                    <div className="px-4 pt-2 pb-1">
                      <div className="w-full h-1.5 bg-black/5">
                        <div className={`h-full transition-all ${tData.completeness >= 90 ? "bg-green-500" : tData.completeness >= 70 ? "bg-yellow-500" : "bg-crab-accent"}`} style={{ width: `${tData.completeness}%` }} />
                      </div>
                    </div>
                    {/* Column Grid */}
                    <div className="p-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                      {tData.columns.map((col, i) => (
                        <div key={i} className="p-3 border border-black/10 hover:border-black transition-colors">
                          <p className="font-mono text-[9px] font-black uppercase truncate">{col.name}</p>
                          <p className="font-mono text-[10px] text-black/40 mt-0.5">{col.dtype}</p>
                          <div className="flex justify-between mt-2 text-[8px] font-mono text-black/25 uppercase">
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
                    <button onClick={() => { setCurrentStep(5); setMessages([{ role: "assistant", content: `Pipeline complete. I have access to ${profileData.summary.total_tables} table(s) with ${profileData.summary.total_rows} rows. Ask me anything about your data.` }]); }} className="brutalist-btn-primary !py-4 !w-auto px-16 text-sm font-heading shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                      UNLOCK AI AGENT
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT: Chat Sidebar (Step 5 only) */}
            {currentStep === 5 && (
              <aside className="w-2/5 bg-white border-l-2 border-black h-full flex flex-col">
                <div className="p-4 border-b-2 border-black">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="font-mono text-sm font-black uppercase">CRAB Agent</h2>
                      <p className="text-[8px] font-mono text-black/30 uppercase mt-0.5">6-Node LangGraph · Router → Analyst | Plotter | Stats</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-green-500 animate-pulse"></div>
                      <span className="font-mono text-[8px] text-black/30 uppercase">Live</span>
                    </div>
                  </div>
                </div>

                <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
                  {messages.map((msg, idx) => (
                    <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[90%] ${
                        msg.role === "user" 
                          ? "bg-black text-white border-2 border-black" 
                          : "bg-white text-[#1a1a1a] border-2 border-black/20"
                      }`}>
                        <div className="p-3">
                          <p className="font-mono text-[11px] whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                        </div>
                        {msg.images && msg.images.length > 0 && (
                          <div className="border-t border-black/10">
                            {msg.images.map((img, imgIdx) => (
                              <div key={imgIdx} className="p-2">
                                <div className="border border-black/10 overflow-hidden">
                                  <div className="px-2 py-1 bg-black flex items-center gap-1.5">
                                    <div className="w-1.5 h-1.5 bg-red-500 rounded-full"></div>
                                    <div className="w-1.5 h-1.5 bg-yellow-500 rounded-full"></div>
                                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                                    <span className="font-mono text-[7px] text-white/40 ml-1">chart.png</span>
                                  </div>
                                  <img src={`data:image/png;base64,${img}`} alt="Chart" className="w-full" />
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
                      <div className="p-3 bg-white border-2 border-black/20">
                        <div className="flex items-center gap-2">
                          <div className="flex gap-1">
                            <div className="w-1.5 h-1.5 bg-black rounded-full animate-bounce" style={{animationDelay: '0ms'}}></div>
                            <div className="w-1.5 h-1.5 bg-black rounded-full animate-bounce" style={{animationDelay: '150ms'}}></div>
                            <div className="w-1.5 h-1.5 bg-black rounded-full animate-bounce" style={{animationDelay: '300ms'}}></div>
                          </div>
                          <span className="font-mono text-[9px] uppercase text-black/30">Routing</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Quick Actions */}
                {messages.length <= 1 && (
                  <div className="px-4 py-3 border-t border-black/10">
                    <p className="text-[8px] font-mono text-black/20 uppercase mb-2">Quick Actions</p>
                    <div className="flex flex-wrap gap-1.5">
                      {quickActions.map((qa, i) => (
                        <button key={i} onClick={() => { setChatInput(qa); }} className="px-2 py-1 border border-black/20 text-[8px] font-mono uppercase hover:bg-black hover:text-white hover:border-black transition-colors">
                          {qa}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="p-3 border-t-2 border-black">
                  <form onSubmit={handleSendMessage} className="relative">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="Ask anything about your data..."
                      className="w-full p-3 pr-10 border-2 border-black font-mono text-xs focus:outline-none focus:border-crab-accent transition-colors"
                      disabled={chatLoading}
                    />
                    <button type="submit" disabled={chatLoading} className="absolute right-3 top-1/2 -translate-y-1/2 text-lg hover:text-crab-accent transition-colors">➔</button>
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
