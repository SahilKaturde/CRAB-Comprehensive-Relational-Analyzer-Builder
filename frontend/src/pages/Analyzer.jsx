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
//  MARKDOWN RENDERER — NEO-BRUTALIST PARSING
// ════════════════════════════════════════════════════════
const MarkdownRenderer = ({ content }) => {
  // Simple regex-based markdown parser for bold, lists, and tables
  let html = content;

  // 1. Tables (Extract and format)
  const tableRegex = /\|(.+)\|[\n\r]\s*\|(?:[:\s-]+\|)+\s*[\n\r]((?:\|.+|[\n\r])*)/g;
  html = html.replace(tableRegex, (match, headerRow, body) => {
    const headers = headerRow.split('|').filter(h => h.trim()).map(h => h.trim());
    const bodyRows = body.split('\n').filter(r => r.trim()).map(row => {
      return row.split('|').filter(c => c.trim()).map(c => c.trim());
    });

    return `
      <div class="my-4 border-2 border-black overflow-hidden shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)]">
        <table class="w-full text-[11px] font-mono">
          <thead class="bg-crab-accent/5 border-b-2 border-black">
            <tr>
              ${headers.map(h => `<th class="p-2 border-r border-black last:border-r-0 text-left uppercase">${h}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${bodyRows.map(row => `
              <tr class="border-b border-black last:border-b-0">
                ${row.map(cell => `<td class="p-2 border-r border-black last:border-r-0">${cell}</td>`).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  });

  // 2. Bold text (**text**)
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  
  // 3. Newlines to <br/>
  html = html.replace(/\n/g, '<br/>');

  return (
    <div 
      className="markdown-content" 
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

// ════════════════════════════════════════════════════════
//  MAIN ANALYZER COMPONENT
// ════════════════════════════════════════════════════════
export default function Analyzer() {
  const STEPS = ["INGEST", "CONVERT", "RELATIONSHIPS", "ANALYTICS", "AI CHAT"];

  const fileInputRef = useRef(null);
  const scrollRef = useRef(null);
  const graphContainerRef = useRef(null);
  const [graphDimensions, setGraphDimensions] = useState({ width: 800, height: 420 });

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
  const [leftTab, setLeftTab] = useState("analytics"); // "datasets" | "relationships" | "analytics"

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
    const shouldObserve = (currentStep === 3 || (currentStep === 5 && leftTab === "relationships"));
    if (shouldObserve && graphContainerRef.current) {
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
  }, [currentStep, discoveryLoading, leftTab]);

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

        {/* ══════ STEP 4: ANALYTICS (before chat unlocked) ══════ */}
        {currentStep === 4 && profileData && (
          <div className="max-w-5xl mx-auto w-full overflow-y-auto p-6 lg:p-8 animate-fade-in">
            <div className="space-y-6">
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
                  <div className="px-4 pt-2 pb-1">
                    <div className="w-full h-1.5 bg-black/5">
                      <div className={`h-full transition-all ${tData.completeness >= 90 ? "bg-green-500" : tData.completeness >= 70 ? "bg-yellow-500" : "bg-crab-accent"}`} style={{ width: `${tData.completeness}%` }} />
                    </div>
                  </div>
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
              <div className="flex justify-center pt-4 pb-12">
                <button onClick={() => { setCurrentStep(5); setLeftTab("analytics"); setMessages(prev => prev.length === 0 ? [{ role: "assistant", content: `Pipeline complete. I have access to ${profileData.summary.total_tables} table(s) with ${profileData.summary.total_rows} rows. Ask me anything about your data.` }] : prev); }} className="brutalist-btn-primary !py-4 !w-auto px-16 text-sm font-heading shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                  UNLOCK AI AGENT
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ══════ STEP 5: SPLIT VIEW — LEFT TABS + RIGHT CHAT ══════ */}
        {currentStep === 5 && (
          <div className="flex h-full">

            {/* ═══ LEFT PANEL: Switchable Tabs ═══ */}
            <div className="flex-1 flex flex-col overflow-hidden border-r-2 border-black">
              
              {/* Tab Bar */}
              <div className="flex border-b-2 border-black bg-white shrink-0">
                {[
                  { key: "datasets", label: "DATASETS", icon: "◫" },
                  { key: "relationships", label: "ERD", icon: "◈" },
                  { key: "analytics", label: "ANALYTICS", icon: "▤" },
                ].map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setLeftTab(tab.key)}
                    className={`flex-1 py-4 px-4 font-mono text-[9px] uppercase tracking-widest transition-all border-r border-black/10 last:border-r-0 relative group ${
                      leftTab === tab.key
                        ? "bg-crab-accent text-white font-black"
                        : "bg-[#f9f9f9] text-black/40 hover:text-black hover:bg-black/5"
                    }`}
                  >
                    {leftTab === tab.key && (
                      <div className="absolute inset-0 border-t-4 border-white/20"></div>
                    )}
                    <span className={`mr-1.5 ${leftTab === tab.key ? "text-black" : "text-crab-accent/40 group-hover:text-crab-accent"}`}>{tab.icon}</span>
                    <span className={leftTab === tab.key ? "text-black" : ""}>{tab.label}</span>
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <div className="flex-1 overflow-y-auto bg-[#ffffff]">

                {/* ─── DATASETS TAB ─── */}
                {leftTab === "datasets" && (
                  <div className="max-w-5xl mx-auto p-6 space-y-6 animate-fade-in">
                    <div className="flex items-center gap-6 pb-4 border-b border-black/5">
                      <div className="w-12 h-12 border-2 border-crab-accent/20 p-1.5 shrink-0">
                        <img src={logo} alt="CRAB" className="w-full h-full object-contain" />
                      </div>
                      <div>
                        <p className="font-mono text-[10px] uppercase tracking-[0.5em] text-crab-accent mb-1">Datasets</p>
                        <h2 className="text-xl font-black uppercase tracking-tight">{tables.length} Table(s) Loaded</h2>
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
                                : "bg-white border-black/10 hover:border-black/40 shadow-none hover:bg-black/5"
                            }`}
                          >
                            {isSelected && <div className="absolute top-0 left-0 w-full h-1 bg-crab-accent" />}
                            <p className={`font-mono text-[10px] font-black uppercase truncate ${isSelected ? "text-crab-accent" : "text-black/70"}`}>
                              {info?.name || t}
                            </p>
                            <div className="flex items-center gap-2 mt-3 text-[8px] uppercase font-mono tracking-widest text-black/30">
                              <span className={isSelected ? "text-crab-accent/60" : ""}>{info?.type}</span>
                              <span>•</span>
                              <span className={isSelected ? "text-crab-accent/60" : ""}>{info?.size}</span>
                              {isConverted && (
                                <span className="ml-auto bg-crab-accent text-white px-2 py-0.5 font-black text-[7px] leading-none">CSV_SYNCED</span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {tableData.length > 0 && (
                      <div className="border-2 border-black bg-white shadow-[6px_6px_0px_0px_rgba(0,0,0,0.05)]">
                        <div className="p-3 border-b-2 border-black flex items-center justify-between bg-[#f9f9f9]">
                          <h3 className="font-mono text-[10px] font-black uppercase">Preview: {filesData[selectedTable]?.info?.name || selectedTable}</h3>
                          <span className="font-mono text-[8px] text-black/30 uppercase">{tableData.length} rows</span>
                        </div>
                        <div className="max-h-[320px] overflow-auto">
                          <CsvDataTable data={tableData.slice(0, 30)} columns={tableColumns} />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ─── RELATIONSHIPS TAB ─── */}
                {leftTab === "relationships" && (
                  <div className="max-w-5xl mx-auto p-6 space-y-6 animate-fade-in">
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-[0.5em] text-crab-accent mb-2">Relationships</p>
                      <h2 className="text-xl font-black uppercase tracking-tight">Entity-Relationship Map</h2>
                      <p className="font-mono text-xs text-black/40 mt-1 uppercase">{relationships.length} relationship(s) · {graphData.nodes.length} entities</p>
                    </div>

                    {/* Relationship Summary Cards */}
                    {relationships.length > 0 && (
                      <div className="grid grid-cols-3 gap-0 border-2 border-black divide-x-2 divide-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                        {(() => {
                          const oneToOne = relationships.filter(r => r.Relationship === "1 : 1");
                          const oneToMany = relationships.filter(r => r.Relationship === "1 : MANY");
                          const manyToMany = relationships.filter(r => r.Relationship === "MANY : MANY");
                          return (
                            <>
                              <div className="p-4 bg-white">
                                <div className="flex items-center gap-2 mb-3">
                                  <div className="w-2.5 h-2.5 bg-green-500"></div>
                                  <h3 className="font-mono text-[10px] font-black uppercase">1 : 1</h3>
                                  <span className="ml-auto font-mono text-lg font-black text-green-500">{oneToOne.length}</span>
                                </div>
                                {oneToOne.map((r, i) => (
                                  <p key={i} className="font-mono text-[9px] text-black/50 mb-0.5">{r["Entity A"]} ↔ {r["Entity B"]}</p>
                                ))}
                              </div>
                              <div className="p-4 bg-white">
                                <div className="flex items-center gap-2 mb-3">
                                  <div className="w-2.5 h-2.5 bg-black"></div>
                                  <h3 className="font-mono text-[10px] font-black uppercase">1 : MANY</h3>
                                  <span className="ml-auto font-mono text-lg font-black text-black">{oneToMany.length}</span>
                                </div>
                                {oneToMany.map((r, i) => (
                                  <p key={i} className="font-mono text-[9px] text-black/50 mb-0.5">{r["Entity A"]} → {r["Entity B"]}</p>
                                ))}
                              </div>
                              <div className="p-4 bg-white">
                                <div className="flex items-center gap-2 mb-3">
                                  <div className="w-2.5 h-2.5 bg-crab-accent"></div>
                                  <h3 className="font-mono text-[10px] font-black uppercase">M : M</h3>
                                  <span className="ml-auto font-mono text-lg font-black text-crab-accent">{manyToMany.length}</span>
                                </div>
                                {manyToMany.map((r, i) => (
                                  <p key={i} className="font-mono text-[9px] text-black/50 mb-0.5">{r["Entity A"]} ⇌ {r["Entity B"]}</p>
                                ))}
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    )}

                    {/* ERD Graph */}
                    <div className="border-2 border-black bg-white relative shadow-[6px_6px_0px_0px_rgba(0,0,0,0.05)]">
                      <div className="px-4 py-2 border-b-2 border-black bg-[#f9f9f9] flex items-center justify-between">
                        <span className="font-mono text-[10px] font-black uppercase">Topology Graph</span>
                        <div className="flex items-center gap-4 font-mono text-[8px] text-black/30">
                          <span className="flex items-center gap-1"><span className="w-2 h-2 bg-green-500 inline-block"></span> 1:1</span>
                          <span className="flex items-center gap-1"><span className="w-2 h-2 bg-black inline-block"></span> 1:M</span>
                          <span className="flex items-center gap-1"><span className="w-2 h-2 bg-crab-accent inline-block"></span> M:M</span>
                        </div>
                      </div>
                      <div ref={graphContainerRef} className="graph-container" style={{ height: "380px" }}>
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
                              ctx.fillStyle = '#1a1a1a';
                              ctx.fillRect(node.x - bw / 2, node.y - bh / 2, bw, bh);
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
                      <div className="p-6 bg-[#1a1a1a] text-white border-2 border-black relative overflow-hidden group">
                        <div className="absolute top-0 left-0 w-1.5 h-full bg-crab-accent"></div>
                        <h3 className="font-mono text-[10px] font-black uppercase mb-3 text-crab-accent flex items-center gap-2">
                          <span className="w-2 h-2 bg-crab-accent"></span>
                          AI Architecture Summary
                        </h3>
                        <p className="font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-white/70 italic">{aiSummary}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* ─── ANALYTICS TAB ─── */}
                {leftTab === "analytics" && profileData && (
                  <div className="max-w-5xl mx-auto p-6 space-y-6 animate-fade-in">
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-[0.5em] text-crab-accent mb-2">Analytics</p>
                      <h2 className="text-xl font-black uppercase tracking-tight">Data Quality</h2>
                      <p className="font-mono text-xs text-black/40 mt-1 uppercase">Session {sessionId?.slice(0, 8)} · {profileData.summary.total_tables} tables</p>
                    </div>

                    {/* Summary Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-0 border-2 border-black divide-x divide-black transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                      {[
                        { label: "TABLES", value: profileData.summary.total_tables, accent: false },
                        { label: "ROWS", value: profileData.summary.total_rows.toLocaleString(), accent: false },
                        { label: "COLUMNS", value: profileData.summary.total_columns, accent: false },
                        { label: "COMPLETE", value: `${profileData.summary.overall_completeness}%`, accent: true },
                        { label: "DEPTH", value: `D${profileData.summary.depth_code}`, accent: true },
                      ].map((card, i) => (
                        <div key={i} className={`p-4 bg-white relative overflow-hidden`}>
                          {card.accent && <div className="absolute top-0 left-0 w-full h-1.5 bg-crab-accent" />}
                          <p className="font-mono text-[8px] uppercase text-black/40 tracking-widest">{card.label}</p>
                          <p className={`font-mono text-xl font-black mt-1 ${card.accent ? "text-crab-accent" : "text-black"}`}>
                            {card.value}
                          </p>
                        </div>
                      ))}
                    </div>

                    {/* Per-Table Profiles */}
                    {Object.entries(profileData.tables).map(([tName, tData]) => (
                      <div key={tName} className="bg-white border-2 border-black relative group transition-all hover:-translate-y-0.5 hover:shadow-[4px_4px_0px_0px_rgba(255,59,48,0.1)] overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-crab-accent opacity-10 group-hover:opacity-100 transition-opacity" />
                        <div className="p-4 border-b border-black/10 flex items-center justify-between bg-[#fcfcfc]">
                          <h3 className="font-mono text-[10px] font-black uppercase text-black/80">{tName}</h3>
                          <div className="flex items-center gap-4 font-mono text-[9px] uppercase text-black/30">
                            <span>{tData.row_count} rows</span>
                            <span>{tData.column_count} cols</span>
                            <span className={`font-black tracking-tighter ${tData.completeness >= 90 ? "text-green-500" : tData.completeness >= 70 ? "text-yellow-500" : "text-crab-accent"}`}>
                              {tData.completeness}%
                            </span>
                          </div>
                        </div>
                        <div className="px-4 pt-2 pb-1">
                          <div className="w-full h-1.5 bg-black/5">
                            <div className={`h-full transition-all ${tData.completeness >= 90 ? "bg-green-500" : tData.completeness >= 70 ? "bg-yellow-500" : "bg-crab-accent"}`} style={{ width: `${tData.completeness}%` }} />
                          </div>
                        </div>
                        <div className="p-4 grid grid-cols-2 md:grid-cols-3 gap-2">
                          {tData.columns.map((col, i) => (
                            <div key={i} className="p-3 border border-black/10 hover:border-black transition-colors bg-white">
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
                  </div>
                )}
              </div>
            </div>

            {/* ═══ RIGHT: PERSISTENT CHAT SIDEBAR ═══ */}
            <aside className="w-[475px] shrink-0 bg-[#f9f9f9] h-full flex flex-col border-l-2 border-black">
              <div className="p-4 border-b-2 border-black bg-white relative">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-crab-accent shadow-[2px_0_4px_rgba(255,59,48,0.2)]"></div>
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-mono text-sm font-black uppercase tracking-tight">CRAB Agent</h2>
                    <p className="text-[8px] font-mono text-black/40 uppercase mt-0.5 flex items-center gap-1.5">
                      <span className="w-1 h-1 bg-crab-accent"></span>
                      Intelligent Relational Assistant
                    </p>
                  </div>
                  <div className="flex items-center gap-2 px-2 py-1 bg-green-500/5 border border-green-500/20">
                    <div className="w-1.5 h-1.5 bg-green-500 animate-pulse rounded-full"></div>
                    <span className="font-mono text-[8px] text-green-600 font-black uppercase tracking-widest">Active</span>
                  </div>
                </div>
              </div>

              <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((msg, idx) => (
                  <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[92%] transition-all duration-300 ${
                      msg.role === "user"
                        ? "bg-black text-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(255,59,48,1)]"
                        : "bg-white text-[#1a1a1a] border-2 border-black relative overflow-hidden"
                    }`}>
                      {msg.role === "assistant" && (
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-crab-accent/30"></div>
                      )}
                      <div className="p-3.5">
                        <div className="font-mono text-sm whitespace-pre-wrap leading-relaxed antialiased">
                          <MarkdownRenderer content={msg.content} />
                        </div>
                      </div>
                      {msg.images && msg.images.length > 0 && (
                        <div className="border-t-2 border-black bg-black/5">
                          {msg.images.map((img, imgIdx) => (
                            <div key={imgIdx} className="p-2.5">
                              <div className="border-2 border-black overflow-hidden bg-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                                <div className="px-2 py-1.5 bg-black flex items-center justify-between">
                                  <div className="flex items-center gap-1.5">
                                    <div className="w-1.5 h-1.5 bg-red-500 rounded-full"></div>
                                    <div className="w-1.5 h-1.5 bg-yellow-500 rounded-full"></div>
                                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                                    <span className="font-mono text-[7px] text-white/50 ml-1 uppercase tracking-tighter">visualization.png</span>
                                  </div>
                                  <span className="font-mono text-[7px] text-crab-accent font-black">CRAB_UI</span>
                                </div>
                                <img src={`data:image/png;base64,${img}`} alt="Chart" className="w-full grayscale-0 hover:grayscale-0 transition-all duration-500" />
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
                    <div className="p-3 bg-white border-2 border-black shadow-[3px_3px_0px_0px_rgba(255,59,48,0.2)]">
                      <div className="flex items-center gap-3">
                        <div className="flex gap-1.5">
                          <div className="w-1.5 h-1.5 bg-crab-accent rounded-full animate-[bounce_1s_infinite_0ms]"></div>
                          <div className="w-1.5 h-1.5 bg-crab-accent rounded-full animate-[bounce_1s_infinite_200ms]"></div>
                          <div className="w-1.5 h-1.5 bg-crab-accent rounded-full animate-[bounce_1s_infinite_400ms]"></div>
                        </div>
                        <span className="font-mono text-[9px] uppercase text-black/50 font-black tracking-widest">Analyzing</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Quick Actions */}
              {messages.length <= 1 && (
                <div className="px-4 py-4 border-t-2 border-black bg-white/50 backdrop-blur-sm">
                  <p className="text-[9px] font-mono text-black/30 uppercase mb-3 font-black tracking-widest">Recommended Queries</p>
                  <div className="flex flex-wrap gap-2">
                    {quickActions.map((qa, i) => (
                      <button 
                        key={i} 
                        onClick={() => { setChatInput(qa); }} 
                        className="px-3 py-1.5 border-2 border-black/10 bg-white text-[9px] font-mono uppercase hover:bg-black hover:text-white hover:border-black transition-all hover:-translate-y-0.5 hover:shadow-[3px_3px_0px_0px_rgba(255,59,48,1)]"
                      >
                        {qa}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="p-4 border-t-2 border-black bg-white">
                <form onSubmit={handleSendMessage} className="relative group">
                  <div className="absolute -inset-0.5 bg-crab-accent opacity-0 group-focus-within:opacity-10 transition-opacity pointer-events-none"></div>
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Describe the insight you need..."
                    className="w-full p-4 pr-12 border-2 border-black font-mono text-[11px] focus:outline-none focus:border-crab-accent focus:shadow-[4px_4px_0px_0px_rgba(255,59,48,1)] transition-all bg-[#ffffff] relative z-10"
                    disabled={chatLoading}
                  />
                  <button 
                    type="submit" 
                    disabled={chatLoading || !chatInput.trim()} 
                    className={`absolute right-4 top-1/2 -translate-y-1/2 text-xl transition-all ${
                      chatInput.trim() ? "text-crab-accent scale-110" : "text-black/10"
                    }`}
                  >
                    ➔
                  </button>
                </form>
                <p className="text-[7px] font-mono text-black/30 uppercase mt-3 text-center tracking-widest">Powered by LangGraph Agentic Engine</p>
              </div>
            </aside>
          </div>
        )}

      </div>
    </div>
  );
}
