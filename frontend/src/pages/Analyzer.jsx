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
    <div className="w-full bg-white border-b-2 border-black px-6 py-0 flex items-center justify-between shadow-[0_4px_10px_rgba(0,0,0,0.03)] relative z-50">
      <Link to="/" className="flex items-center gap-3 mr-10 py-3 shrink-0 group">
        <div className="p-1 border border-black group-hover:bg-crab-accent transition-colors">
          <img src={logo} alt="CRAB" className="h-7 w-auto group-hover:invert transition-all" />
        </div>
        <span className="font-heading text-sm uppercase tracking-tighter hidden md:block group-hover:text-crab-accent transition-colors">CRAB ENGINE</span>
      </Link>
      <div className="flex items-center flex-1 max-w-4xl">
        {steps.map((step, idx) => {
          const stepNum = idx + 1;
          const isActive = stepNum === currentStep;
          const isDone = stepNum < currentStep;
          return (
            <div key={stepNum} className="flex items-center flex-1 last:flex-none">
              <div className={`flex items-center gap-2.5 px-4 py-4 transition-all duration-300 relative ${
                isActive ? "bg-black text-white" :
                isDone ? "text-crab-accent" :
                "text-black/20"
              }`}>
                {isActive && <div className="absolute top-0 left-0 w-full h-1 bg-crab-accent"></div>}
                <span className="font-mono text-sm font-black tracking-tighter">
                  {isDone ? "✓" : `0${stepNum}`}
                </span>
                <span className={`font-mono text-sm font-bold uppercase hidden lg:inline tracking-widest ${isDone ? "font-black" : ""}`}>{step}</span>
              </div>
              {idx < steps.length - 1 && (
                <div className={`flex-1 h-0.5 mx-2 transition-all duration-500 ${isDone ? "bg-crab-accent" : "bg-black/[0.06]"}`} />
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
  if (!content) return null;

  // 1. Process Tables first
  let html = content.trim();
  const tableRegex = /\|(.+)\|[\n\r]\s*\|(?:[:\s-]+\|)+\s*[\n\r]((?:\|.+|[\n\r])*)/g;
  
  html = html.replace(tableRegex, (match, headerRow, body) => {
    const headers = headerRow.split('|').filter(h => h.trim()).map(h => h.trim());
    const bodyRows = body.split('\n').filter(r => r.trim()).map(row => {
      return row.split('|').filter(c => c.trim()).map(c => c.trim());
    });

    return `
      <div class="mt-2 mb-4 border-2 border-black overflow-hidden shadow-[4px_4px_0px_0px_rgba(0,0,0,0.05)]">
        <table class="w-full text-left font-mono text-sm">
          <thead class="bg-black text-white border-b-2 border-black">
            <tr>
              ${headers.map(h => `<th class="px-3 py-2 border-r border-black/20 last:border-r-0 uppercase font-black">${h}</th>`).join('')}
            </tr>
          </thead>
          <tbody class="bg-white">
            ${bodyRows.map(row => `
              <tr class="border-b border-black last:border-b-0 hover:bg-crab-bg/50 transition-colors">
                ${row.map(cell => `<td class="px-3 py-1.5 border-r border-black/5 last:border-r-0 text-black/80">${cell}</td>`).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  });

  // 2. Handle simple markdown (bold, etc)
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  
  // 3. Handle line breaks (avoiding multiple empty ones pushing content down)
  html = html.replace(/\n{3,}/g, '\n\n'); // Max 2 newlines
  html = html.replace(/\n/g, '<br/>');

  return (
    <div 
      className="markdown-content leading-relaxed" 
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

export default function Analyzer() {
  const STEPS = ["INGEST", "CONVERT", "RELATIONSHIPS", "ANALYTICS", "AI CHAT"];

  const fileInputRef = useRef(null);
  const scrollRef = useRef(null);
  const graphContainerRef = useRef(null);
  const [graphDimensions, setGraphDimensions] = useState({ width: 800, height: 420 });

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

  const [sessionId, setSessionId] = useState("");
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [relationships, setRelationships] = useState([]);
  const [pks, setPks] = useState({});
  const [aiSummary, setAiSummary] = useState("");
  const [discoveryLoading, setDiscoveryLoading] = useState(false);

  const [profileData, setProfileData] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
// --- STEP 5: CHAT ---
const [messages, setMessages] = useState([]);
const [chatInput, setChatInput] = useState("");
const [chatLoading, setChatLoading] = useState(false);
const [leftTab, setLeftTab] = useState("analytics");
const [sidebarWidth, setSidebarWidth] = useState(450);
const isResizing = useRef(false);

const startResizing = useCallback((e) => {
  isResizing.current = true;
  document.addEventListener("mousemove", handleMouseMove);
  document.addEventListener("mouseup", stopResizing);
  document.body.style.cursor = "col-resize";
  document.body.style.userSelect = "none";
}, []);

const stopResizing = useCallback(() => {
  isResizing.current = false;
  document.removeEventListener("mousemove", handleMouseMove);
  document.removeEventListener("mouseup", stopResizing);
  document.body.style.cursor = "default";
  document.body.style.userSelect = "auto";
}, []);

const handleMouseMove = useCallback((e) => {
  if (!isResizing.current) return;
  const newWidth = window.innerWidth - e.clientX;
  if (newWidth > 350 && newWidth < 900) {
    setSidebarWidth(newWidth);
  }
}, []);


  const [SQL, setSQL] = useState(null);
  useEffect(() => {
    window.initSqlJs({
      locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.12.0/${file}`
    }).then(sql => setSQL(sql));
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, chatLoading]);

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
        images: data.images || [],
        exports: data.exports || []
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
    "Find outliers and anomalies",
    "Compare all tables",
    "Export data as CSV"
  ];

  return (
    <div className="flex flex-col h-screen bg-white text-[#1a1a1a] font-sans selection:bg-crab-accent selection:text-white overflow-hidden">
      <StepBar currentStep={currentStep} steps={STEPS} />

      <div className="flex-1 overflow-y-auto">

        {/* ══════ STEP 1: INGEST ══════ */}
        {currentStep === 1 && (
          <div className="flex-1 flex flex-col items-center justify-center min-h-[calc(100vh-56px)] px-6 bg-crab-bg">
            <div className="max-w-3xl w-full animate-fade-in">
              <div className="text-center mb-14">
                <p className="font-mono text-sm uppercase tracking-[0.6em] text-crab-accent font-black mb-5">Phase 01</p>
                <h1 className="text-6xl md:text-7xl font-black uppercase tracking-tighter leading-[0.9] text-crab-text">
                  Ingest<br/>
                  <span className="text-crab-accent">Data</span>
                </h1>
                <p className="font-mono text-base text-black/40 mt-8 uppercase tracking-widest max-w-md mx-auto leading-relaxed">
                  Upload your CSV, SQL, or SQLite database files to begin the architectural analysis.
                </p>
              </div>

              {loading ? (
                <div className="p-20 bg-[#E9F5FF] border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] text-center relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-crab-accent"></div>
                  <div className="flex items-center justify-center gap-4 mb-6">
                    <div className="w-3 h-3 bg-black animate-[bounce_1s_infinite_0ms]"></div>
                    <div className="w-3 h-3 bg-black animate-[bounce_1s_infinite_200ms]"></div>
                    <div className="w-3 h-3 bg-black animate-[bounce_1s_infinite_400ms]"></div>
                  </div>
                  <p className="font-mono text-sm font-black uppercase tracking-[0.3em] text-black/40">Parsing System Buffers</p>
                </div>
              ) : (
                <div 
                  onClick={() => fileInputRef.current.click()} 
                  className="group relative p-20 md:p-28 bg-[#E9F5FF] border-2 border-black shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] hover:shadow-[4px_4px_0px_0px_rgba(255,59,48,1)] hover:translate-x-[4px] hover:translate-y-[4px] transition-all cursor-pointer text-center overflow-hidden"
                >
                  <div className="absolute -right-12 -top-12 w-40 h-48 bg-crab-accent/5 rounded-full group-hover:bg-crab-accent/10 transition-colors"></div>
                  <div className="w-20 h-20 border-2 border-black mx-auto mb-10 flex items-center justify-center group-hover:bg-black group-hover:text-white transition-all transform group-hover:rotate-12 bg-white">
                    <span className="text-4xl font-black">+</span>
                  </div>
                  <h2 className="text-3xl font-black uppercase tracking-tight mb-4">Initialize Upload</h2>
                  <p className="font-mono text-base text-black/40 uppercase tracking-widest leading-loose">
                    Drop files or click to browse<br/>
                    <span className="text-black/20 text-sm font-black mt-3 block">Supported: .CSV .SQL .DB .SQLITE</span>
                  </p>
                </div>
              )}
              <input type="file" ref={fileInputRef} className="hidden" accept=".csv,.db,.sqlite,.sql" multiple onChange={handleFileChange} />
              
              <div className="mt-16 flex justify-center gap-16 border-t border-black/5 pt-10">
                <div className="text-center">
                  <p className="font-mono text-2xl font-black text-crab-secondary">100%</p>
                  <p className="font-mono text-sm uppercase text-black/30 tracking-widest mt-2">Local Processing</p>
                </div>
                <div className="text-center">
                  <p className="font-mono text-2xl font-black text-crab-success">AGENT</p>
                  <p className="font-mono text-sm uppercase text-black/30 tracking-widest mt-2">Ready to Assist</p>
                </div>
                <div className="text-center">
                  <p className="font-mono text-2xl font-black text-crab-accent">SECURE</p>
                  <p className="font-mono text-sm uppercase text-black/30 tracking-widest mt-2">Data Encrypted</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══════ STEP 2: CONVERT + BACKUP ══════ */}
        {currentStep === 2 && (
          <div className="max-w-6xl mx-auto w-full py-12 px-6 space-y-12 animate-fade-in">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 border-b-2 border-black pb-10">
              <div className="flex items-center gap-8 text-left">
                <div className="w-24 h-24 bg-white border-2 border-black p-4 shrink-0 shadow-[6px_6px_0px_0px_rgba(255,59,48,1)]">
                  <img src={logo} alt="CRAB" className="w-full h-full object-contain" />
                </div>
                <div>
                  <p className="font-mono text-sm uppercase tracking-[0.6em] text-crab-accent font-black mb-4">Phase 02</p>
                  <h2 className="text-5xl font-black uppercase tracking-tighter text-crab-text">Datasets Loaded</h2>
                  <p className="font-mono text-base text-black/40 mt-3 uppercase tracking-widest">
                    <span className="text-black font-black">{tables.length}</span> table(s) identified across <span className="text-black font-black">{rawFiles.length}</span> source file(s)
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {tables.map((t, idx) => {
                const info = filesData[t]?.info;
                const isConverted = info?.converted;
                const isSelected = selectedTable === t;
                const softColors = ["bg-[#E9F5FF]", "bg-[#F5E9FF]", "bg-[#E9FFE9]", "bg-[#FFF9E9]", "bg-[#FFE9F5]", "bg-[#FFF1E9]"];
                const bgColor = softColors[idx % softColors.length];
                
                return (
                  <button 
                    key={t} 
                    onClick={() => loadLocalTable(t)} 
                    className={`group p-8 text-left border-2 transition-all relative overflow-hidden ${
                      isSelected 
                        ? "bg-white border-black shadow-[6px_6px_0px_0px_rgba(255,59,48,1)] translate-x-[-2px] translate-y-[-2px]" 
                        : `${bgColor} border-black/10 hover:border-black/40 shadow-none hover:translate-y-[-2px]`
                    }`}
                  >
                    {isSelected && <div className="absolute top-0 left-0 w-full h-2 bg-crab-accent" />}
                    <p className={`font-mono text-base font-black uppercase truncate ${isSelected ? "text-crab-text" : "text-black/60"}`}>
                      {info?.name || t}
                    </p>
                    <div className="flex items-center gap-4 mt-5 text-sm uppercase font-mono tracking-widest text-black/30 font-bold">
                      <span className={`px-2 py-1 border border-black/10 ${isSelected ? "bg-black/5 text-black/60" : "bg-white/50"}`}>{info?.type}</span>
                      <span>•</span>
                      <span className={isSelected ? "text-black/40" : ""}>{info?.size}</span>
                      {isConverted && (
                        <span className="ml-auto bg-black text-white px-2.5 py-1 font-black text-xs leading-none tracking-tighter">
                          CSV_SYNC
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {tableData.length > 0 && (
              <div className="brutalist-card bg-white animate-slide-up overflow-hidden">
                <div className="p-5 border-b-2 border-black flex items-center justify-between bg-[#F5E9FF]">
                  <div className="flex items-center gap-4">
                    <div className="w-2.5 h-2.5 bg-crab-accent"></div>
                    <h3 className="font-mono text-base font-black uppercase tracking-widest text-black">
                      Preview: <span className="text-crab-accent">{filesData[selectedTable]?.info?.name || selectedTable}</span>
                    </h3>
                  </div>
                  <span className="font-mono text-sm font-black text-black/30 uppercase tracking-tighter">{tableData.length} records detected</span>
                </div>
                <div className="max-h-[360px] overflow-auto brutalist-scrollbar">
                  <CsvDataTable data={tableData.slice(0, 30)} columns={tableColumns} />
                </div>
                <div className="p-4 bg-white border-t border-black/5 text-center">
                  <p className="font-mono text-sm text-black/20 uppercase tracking-[0.4em] font-bold">Visualizing top 30 buffers</p>
                </div>
              </div>
            )}

            <div className="flex flex-col md:flex-row gap-6 items-center justify-end border-t-2 border-black pt-12">
              <button 
                onClick={handleBackup} 
                disabled={backupLoading || backupDone} 
                className={`brutalist-btn-secondary !py-4 !w-full md:!w-auto px-12 text-sm font-black flex items-center gap-4 ${backupDone ? "!bg-black !text-crab-success" : ""}`}
              >
                {backupDone ? (
                  <>
                    <span className="text-xl">✓</span> SYSTEM BACKED UP
                  </>
                ) : backupLoading ? (
                  "SYNCHRONIZING..."
                ) : (
                  "INITIATE BACKUP"
                )}
              </button>
              <button onClick={advanceFromStep2} className="brutalist-btn-primary !py-4 !w-full md:!w-auto px-14 text-sm font-heading tracking-tight">
                PROCEED TO DISCOVERY →
              </button>
            </div>
          </div>
        )}

        {/* ══════ STEP 3: RELATIONSHIPS ══════ */}
        {currentStep === 3 && (
          <div className="max-w-6xl mx-auto w-full py-12 px-6 space-y-10 animate-fade-in bg-crab-bg/30 min-h-full">
            {discoveryLoading ? (
              <div className="flex flex-col items-center justify-center min-h-[60vh]">
                <div className="text-center">
                  <div className="flex items-center justify-center gap-3 mb-10">
                    <div className="w-4 h-4 bg-crab-accent animate-[bounce_1s_infinite_0ms]"></div>
                    <div className="w-4 h-4 bg-crab-accent animate-[bounce_1s_infinite_200ms]"></div>
                    <div className="w-4 h-4 bg-crab-accent animate-[bounce_1s_infinite_400ms]"></div>
                  </div>
                  <h2 className="text-4xl font-black uppercase tracking-tight mb-4">Detecting Relationships</h2>
                  <p className="font-mono text-xs text-black/40 uppercase tracking-[0.4em] max-w-md mx-auto leading-relaxed">
                    Analyzing foreign key constraints & inclusion dependencies
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 border-b-2 border-black pb-10 text-left">
                  <div>
                    <p className="font-mono text-xs uppercase tracking-[0.6em] text-crab-accent font-black mb-4">Phase 03</p>
                    <h2 className="text-5xl font-black uppercase tracking-tighter text-crab-text">Architectural Map</h2>
                    <p className="font-mono text-sm text-black/40 mt-3 uppercase tracking-widest">
                      <span className="text-black font-black">{relationships.length}</span> primary connections detected among <span className="text-black font-black">{graphData.nodes.length}</span> system entities
                    </p>
                  </div>
                </div>

                {/* Relationship Summary Cards */}
                {relationships.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-0 border-2 border-black divide-y-2 md:divide-y-0 md:divide-x-2 divide-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] bg-white animate-slide-up">
                    {[
                      { type: "1 : 1", color: "bg-crab-success", list: relationships.filter(r => r.Relationship === "1 : 1"), symbol: "↔", bg: "bg-[#E9FFE9]" },
                      { type: "1 : MANY", color: "bg-black", list: relationships.filter(r => r.Relationship === "1 : MANY"), symbol: "→", bg: "bg-[#E9F5FF]" },
                      { type: "MANY : MANY", color: "bg-crab-accent", list: relationships.filter(r => r.Relationship === "MANY : MANY"), symbol: "⇌", bg: "bg-[#FFE9F5]" }
                    ].map((group, i) => (
                      <div key={i} className={`p-8 relative group ${group.bg} text-left`}>
                        <div className="flex items-center gap-4 mb-6">
                          <div className={`w-3.5 h-3.5 ${group.color}`}></div>
                          <h3 className="font-mono text-sm font-black uppercase tracking-widest text-black/80">{group.type}</h3>
                          <span className={`ml-auto font-mono text-3xl font-black ${group.list.length > 0 ? "text-black" : "text-black/10"}`}>{group.list.length}</span>
                        </div>
                        <div className="space-y-2 max-h-[140px] overflow-y-auto pr-2 brutalist-scrollbar">
                          {group.list.length > 0 ? group.list.map((r, idx) => (
                            <p key={idx} className="font-mono text-sm text-black/50 uppercase tracking-tighter truncate font-bold">
                              {r["Entity A"]} <span className="text-black/20 px-1.5">{group.symbol}</span> {r["Entity B"]}
                            </p>
                          )) : (
                            <p className="font-mono text-sm text-black/20 uppercase italic">No entities found</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* ERD Graph — CONTAINED */}
                <div className="brutalist-card bg-white relative animate-slide-up" style={{ animationDelay: '100ms' }}>
                  <div className="px-6 py-5 border-b-2 border-black bg-[#FFF9E9] flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-3 h-3 bg-black rotate-45"></div>
                      <span className="font-mono text-sm font-black uppercase tracking-widest text-crab-text">System Topology Graph</span>
                    </div>
                    <div className="flex items-center gap-8 font-mono text-sm font-black uppercase tracking-tighter">
                      <span className="flex items-center gap-2.5"><span className="w-2.5 h-2.5 bg-crab-success inline-block"></span> 1:1</span>
                      <span className="flex items-center gap-2.5"><span className="w-2.5 h-2.5 bg-black inline-block"></span> 1:M</span>
                      <span className="flex items-center gap-2.5"><span className="w-2.5 h-2.5 bg-crab-accent inline-block"></span> M:M</span>
                    </div>
                  </div>
                  <div ref={graphContainerRef} className="graph-container bg-white" style={{ height: "500px" }}>
                    {graphData.nodes.length > 0 ? (
                      <ForceGraph2D
                        graphData={graphData}
                        width={graphDimensions.width}
                        height={graphDimensions.height}
                        nodeLabel="name"
                        nodeColor={() => "#1a1a1a"}
                        linkColor={link => link.color || "#1a1a1a"}
                        linkWidth={3}
                        linkLabel="label"
                        linkDirectionalArrowLength={7}
                        linkDirectionalArrowRelPos={1}
                        backgroundColor="transparent"
                        nodeCanvasObject={(node, ctx, globalScale) => {
                          const label = node.name;
                          const fontSize = 13 / globalScale;
                          ctx.font = `900 ${fontSize}px 'JetBrains Mono', 'Fira Code', monospace`;
                          const textWidth = ctx.measureText(label).width;
                          const pad = fontSize * 0.75;
                          const bw = textWidth + pad * 2;
                          const bh = fontSize + pad;
                          
                          ctx.fillStyle = 'rgba(0,0,0,0.1)';
                          ctx.fillRect(node.x - bw / 2 + 2, node.y - bh / 2 + 2, bw, bh);
                          
                          ctx.fillStyle = '#1a1a1a';
                          ctx.fillRect(node.x - bw / 2, node.y - bh / 2, bw, bh);
                          
                          ctx.strokeStyle = '#000000';
                          ctx.lineWidth = 1.2 / globalScale;
                          ctx.strokeRect(node.x - bw / 2, node.y - bh / 2, bw, bh);

                          ctx.textAlign = 'center';
                          ctx.textBaseline = 'middle';
                          ctx.fillStyle = '#ffffff';
                          ctx.fillText(label, node.x, node.y);
                        }}
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full gap-6">
                        <div className="w-16 h-16 border-2 border-black/5 flex items-center justify-center text-black/5 text-5xl font-black italic">?</div>
                        <span className="font-mono text-base text-black/10 uppercase tracking-[0.3em] font-black">Mapping Buffer Empty</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* AI Summary */}
                {aiSummary && (
                  <div className="p-10 bg-[#1a1a1a] text-white border-2 border-black relative overflow-hidden group shadow-[8px_8px_0px_0px_rgba(255,59,48,0.2)] text-left">
                    <div className="absolute top-0 left-0 w-2.5 h-full bg-crab-accent shadow-[4px_0_15px_rgba(255,59,48,0.4)]"></div>
                    <div className="absolute -right-8 -bottom-8 w-40 h-40 bg-crab-accent/10 rotate-45 group-hover:bg-crab-accent/20 transition-all duration-700"></div>
                    
                    <h3 className="font-mono text-xs font-black uppercase mb-6 text-crab-accent flex items-center gap-4">
                      <div className="w-3 h-3 bg-crab-accent animate-pulse"></div>
                      Architectural Intelligence Summary
                    </h3>
                    <div className="relative z-10">
                      <p className="font-mono text-sm leading-loose whitespace-pre-wrap text-white/80 italic tracking-tight antialiased font-bold">
                        {aiSummary}
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex flex-col md:flex-row justify-end border-t-2 border-black pt-12 pb-16">
                  <button 
                    onClick={handleProfile} 
                    disabled={profileLoading} 
                    className="brutalist-btn-primary !py-5 !w-full md:!w-auto px-16 text-xs font-heading shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:shadow-none"
                  >
                    {profileLoading ? "PROCESSING ENGINE..." : "GENERATE FULL ANALYTICS →"}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ══════ STEP 4: ANALYTICS (before chat unlocked) ══════ */}
        {currentStep === 4 && profileData && (
          <div className="max-w-6xl mx-auto w-full py-12 px-6 space-y-12 animate-fade-in bg-crab-bg/30">
            <div className="flex flex-col md:flex-row md:items-end justify-between border-b-2 border-black pb-10 gap-8 text-left">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.6em] text-crab-accent font-black mb-4">Phase 04</p>
                <h2 className="text-5xl font-black uppercase tracking-tighter text-crab-text leading-none">Intelligence Profile</h2>
                <div className="flex items-center gap-3 mt-3">
                  <p className="font-mono text-sm text-black/40 uppercase tracking-widest font-bold">
                    Comprehensive audit of <span className="text-black font-black">{profileData.summary.total_tables}</span> system entities
                  </p>
                  <span className="px-2 py-0.5 bg-crab-success/10 border border-crab-success text-crab-success font-mono text-[9px] font-black uppercase tracking-tighter animate-fade-in">
                    ✓ Dictionary Persisted to SQLite
                  </span>
                </div>
              </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-0 border-2 border-black divide-x-2 divide-black shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] bg-white animate-slide-up">
              {[
                { label: "ENTITIES", value: profileData.summary.total_tables, accent: false, bg: "bg-[#E9F5FF]" },
                { label: "DATAPOINTS", value: profileData.summary.total_rows.toLocaleString(), accent: false, bg: "bg-[#F5E9FF]" },
                { label: "ATTRIBUTES", value: profileData.summary.total_columns, accent: false, bg: "bg-[#E9FFE9]" },
                { label: "FIDELITY", value: `${profileData.summary.overall_completeness}%`, accent: true, bg: "bg-[#FFF9E9]" },
                { label: "COMPLEXITY", value: `LVL ${profileData.summary.depth_code}`, accent: true, bg: "bg-[#FFE9F5]" },
              ].map((card, i) => (
                <div key={i} className={`p-8 relative group overflow-hidden hover:bg-white transition-colors ${card.bg} text-left`}>
                  {card.accent && <div className="absolute top-0 left-0 w-full h-2 bg-crab-accent" />}
                  <p className="font-mono text-xs uppercase text-black/30 font-black tracking-widest mb-4">{card.label}</p>
                  <p className={`font-mono text-4xl font-black ${card.accent ? "text-crab-accent" : "text-black"}`}>
                    {card.value}
                  </p>
                </div>
              ))}
            </div>

            {/* Per-Table Profiles */}
            <div className="space-y-10 pb-16">
              {Object.entries(profileData.tables).map(([tName, tData], tableIdx) => (
                <div key={tName} className="bg-white border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,0.05)] animate-slide-up relative group overflow-hidden" style={{ animationDelay: `${tableIdx * 50}ms` }}>
                  <div className="p-6 border-b-2 border-black flex flex-col md:flex-row md:items-center justify-between bg-[#FFF1E9] gap-6 text-left">
                    <div className="flex items-center gap-5">
                      <div className="w-10 h-10 border-2 border-black flex items-center justify-center font-mono font-black text-sm bg-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                        {tableIdx + 1}
                      </div>
                      <h3 className="font-heading text-sm uppercase tracking-widest text-black/80">{tName}</h3>
                    </div>
                    <div className="flex items-center gap-8 font-mono text-xs font-black uppercase tracking-tighter">
                      <span className="text-black/40">{tData.row_count} ROWS</span>
                      <span className="text-black/40">{tData.column_count} ATTRS</span>
                      <div className="flex items-center gap-4">
                        <span className="text-black/30">FIDELITY:</span>
                        <span className={tData.completeness >= 90 ? "text-crab-success" : tData.completeness >= 70 ? "text-yellow-500" : "text-crab-accent"}>
                          {tData.completeness}%
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 bg-white text-left">
                    {tData.columns.map((col, i) => {
                      const colColors = ["bg-[#E9F5FF]/30", "bg-[#F5E9FF]/30", "bg-[#E9FFE9]/30", "bg-[#FFF9E9]/30"];
                      const colBg = colColors[i % colColors.length];
                      return (
                        <div key={i} className={`p-5 border-2 border-black/5 hover:border-black transition-all ${colBg} hover:bg-white group/col relative overflow-hidden`}>
                          <div className="absolute top-0 left-0 w-1.5 h-0 group-hover/col:h-full bg-crab-accent/20 transition-all duration-300"></div>
                          <p className="font-mono text-sm font-black uppercase truncate text-black/70 group-hover/col:text-black">{col.name}</p>
                          <p className="font-mono text-xs text-black/30 mt-1.5 font-bold tracking-widest">{col.dtype.toUpperCase()}</p>
                          <div className="flex justify-between mt-5 text-[10px] font-mono font-black uppercase tracking-tighter text-black/20 group-hover/col:text-black/40 transition-colors">
                            <span>{col.null_pct}% NULL</span>
                            <span>{col.unique_count} UNIQ</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Unlock Chat Button */}
            <div className="flex justify-center pt-6 pb-24 border-t-2 border-black">
              <button 
                onClick={() => { 
                  setCurrentStep(5); 
                  setLeftTab("analytics"); 
                  setMessages(prev => prev.length === 0 ? [{ 
                    role: "assistant", 
                    content: `System initialization successful. Intelligence core has mapped ${profileData.summary.total_tables} entities across the relational graph. I am ready to process complex queries regarding the ${profileData.summary.total_rows.toLocaleString()} detected records.` 
                  }] : prev); 
                }} 
                className="brutalist-btn-primary !py-8 !w-full md:!w-auto px-24 text-base font-heading shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] hover:translate-x-1 hover:translate-y-1 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
              >
                INITIALIZE AI INTERFACE
              </button>
            </div>
          </div>
        )}

        {/* ══════ STEP 5: SPLIT VIEW — LEFT TABS + RIGHT CHAT ══════ */}
        {currentStep === 5 && (
          <div className="flex h-full relative">

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
                    className={`flex-1 py-5 px-6 font-mono text-xs uppercase tracking-widest transition-all border-r border-black/10 last:border-r-0 relative group ${
                      leftTab === tab.key
                        ? "bg-crab-accent text-white font-black"
                        : "bg-[#f9f9f9] text-black/40 hover:text-black hover:bg-black/5"
                    }`}
                  >
                    {leftTab === tab.key && (
                      <div className="absolute inset-0 border-t-4 border-white/20"></div>
                    )}
                    <span className={`mr-2 ${leftTab === tab.key ? "text-black" : "text-crab-accent/40 group-hover:text-crab-accent"}`}>{tab.icon}</span>
                    <span className={leftTab === tab.key ? "text-black" : ""}>{tab.label}</span>
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <div className="flex-1 overflow-y-auto bg-[#ffffff]">

                {/* ─── DATASETS TAB ─── */}
                {leftTab === "datasets" && (
                  <div className="max-w-5xl mx-auto p-8 space-y-8 animate-fade-in text-left">
                    <div className="flex items-center gap-8 pb-6 border-b border-black/5">
                      <div className="w-16 h-16 border-2 border-crab-accent/20 p-2 shrink-0 bg-white">
                        <img src={logo} alt="CRAB" className="w-full h-full object-contain" />
                      </div>
                      <div>
                        <p className="font-mono text-xs uppercase tracking-[0.5em] text-crab-accent mb-2 font-black">Datasets</p>
                        <h2 className="text-2xl font-black uppercase tracking-tight">{tables.length} Table(s) Loaded</h2>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {tables.map(t => {
                        const info = filesData[t]?.info;
                        const isConverted = info?.converted;
                        const isSelected = selectedTable === t;
                        return (
                          <button
                            key={t}
                            onClick={() => loadLocalTable(t)}
                            className={`group p-6 text-left border-2 transition-all relative ${
                              isSelected
                                ? "bg-white border-crab-accent shadow-[4px_4px_0px_0px_rgba(255,59,48,1)] translate-x-[-2px] translate-y-[-2px]"
                                : "bg-white border-black/10 hover:border-black/40 shadow-none hover:bg-black/5"
                            }`}
                          >
                            {isSelected && <div className="absolute top-0 left-0 w-full h-1.5 bg-crab-accent" />}
                            <p className={`font-mono text-xs font-black uppercase truncate ${isSelected ? "text-crab-accent" : "text-black/70"}`}>
                              {info?.name || t}
                            </p>
                            <div className="flex items-center gap-3 mt-4 text-[9px] uppercase font-mono tracking-widest text-black/30 font-bold">
                              <span className={isSelected ? "text-crab-accent/60" : ""}>{info?.type}</span>
                              <span>•</span>
                              <span className={isSelected ? "text-crab-accent/60" : ""}>{info?.size}</span>
                              {isConverted && (
                                <span className="ml-auto bg-crab-accent text-white px-2 py-0.5 font-black text-[8px] leading-none">CSV_SYNCED</span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {tableData.length > 0 && (
                      <div className="border-2 border-black bg-white shadow-[6px_6px_0px_0px_rgba(0,0,0,0.05)]">
                        <div className="p-4 border-b-2 border-black flex items-center justify-between bg-[#f9f9f9]">
                          <h3 className="font-mono text-xs font-black uppercase">Preview: {filesData[selectedTable]?.info?.name || selectedTable}</h3>
                          <span className="font-mono text-[10px] text-black/30 uppercase font-black">{tableData.length} rows</span>
                        </div>
                        <div className="max-h-[360px] overflow-auto">
                          <CsvDataTable data={tableData.slice(0, 30)} columns={tableColumns} />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ─── RELATIONSHIPS TAB ─── */}
                {leftTab === "relationships" && (
                  <div className="max-w-5xl mx-auto p-8 space-y-8 animate-fade-in text-left">
                    <div>
                      <p className="font-mono text-xs uppercase tracking-[0.5em] text-crab-accent mb-3 font-black">Relationships</p>
                      <h2 className="text-2xl font-black uppercase tracking-tight">Entity-Relationship Map</h2>
                      <p className="font-mono text-sm text-black/40 mt-2 uppercase font-bold">{relationships.length} relationship(s) · {graphData.nodes.length} entities</p>
                    </div>

                    {relationships.length > 0 && (
                      <div className="grid grid-cols-3 gap-0 border-2 border-black divide-x-2 divide-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                        {(() => {
                          const oneToOne = relationships.filter(r => r.Relationship === "1 : 1");
                          const oneToMany = relationships.filter(r => r.Relationship === "1 : MANY");
                          const manyToMany = relationships.filter(r => r.Relationship === "MANY : MANY");
                          return (
                            <>
                              <div className="p-6 bg-white">
                                <div className="flex items-center gap-3 mb-4">
                                  <div className="w-3 h-3 bg-green-500"></div>
                                  <h3 className="font-mono text-xs font-black uppercase">1 : 1</h3>
                                  <span className="ml-auto font-mono text-xl font-black text-green-500">{oneToOne.length}</span>
                                </div>
                                {oneToOne.map((r, i) => (
                                  <p key={i} className="font-mono text-[10px] text-black/50 mb-1 font-bold">{r["Entity A"]} ↔ {r["Entity B"]}</p>
                                ))}
                              </div>
                              <div className="p-6 bg-white">
                                <div className="flex items-center gap-3 mb-4">
                                  <div className="w-3 h-3 bg-black"></div>
                                  <h3 className="font-mono text-xs font-black uppercase">1 : MANY</h3>
                                  <span className="ml-auto font-mono text-xl font-black text-black">{oneToMany.length}</span>
                                </div>
                                {oneToMany.map((r, i) => (
                                  <p key={i} className="font-mono text-[10px] text-black/50 mb-1 font-bold">{r["Entity A"]} → {r["Entity B"]}</p>
                                ))}
                              </div>
                              <div className="p-6 bg-white">
                                <div className="flex items-center gap-3 mb-4">
                                  <div className="w-3 h-3 bg-crab-accent"></div>
                                  <h3 className="font-mono text-xs font-black uppercase">M : M</h3>
                                  <span className="ml-auto font-mono text-xl font-black text-crab-accent">{manyToMany.length}</span>
                                </div>
                                {manyToMany.map((r, i) => (
                                  <p key={i} className="font-mono text-[10px] text-black/50 mb-1 font-bold">{r["Entity A"]} ⇌ {r["Entity B"]}</p>
                                ))}
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    )}

                    <div className="border-2 border-black bg-white relative shadow-[6px_6px_0px_0px_rgba(0,0,0,0.05)]">
                      <div className="px-5 py-3 border-b-2 border-black bg-[#f9f9f9] flex items-center justify-between">
                        <span className="font-mono text-xs font-black uppercase">Topology Graph</span>
                        <div className="flex items-center gap-6 font-mono text-[9px] text-black/30 font-black uppercase">
                          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-green-500 inline-block"></span> 1:1</span>
                          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-black inline-block"></span> 1:M</span>
                          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-crab-accent inline-block"></span> M:M</span>
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
                            linkWidth={2.5}
                            linkLabel="label"
                            linkDirectionalArrowLength={6}
                            linkDirectionalArrowRelPos={1}
                            backgroundColor="#ffffff"
                            nodeCanvasObject={(node, ctx, globalScale) => {
                              const label = node.name;
                              const fontSize = 12 / globalScale;
                              ctx.font = `800 ${fontSize}px 'JetBrains Mono', sans-serif`;
                              const textWidth = ctx.measureText(label).width;
                              const pad = fontSize * 0.65;
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
                            <span className="font-mono text-sm text-black/10 uppercase font-black">No connections detected</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {aiSummary && (
                      <div className="p-8 bg-[#1a1a1a] text-white border-2 border-black relative overflow-hidden group">
                        <div className="absolute top-0 left-0 w-2 h-full bg-crab-accent"></div>
                        <h3 className="font-mono text-xs font-black uppercase mb-4 text-crab-accent flex items-center gap-3">
                          <span className="w-2.5 h-2.5 bg-crab-accent"></span>
                          AI Architecture Summary
                        </h3>
                        <p className="font-mono text-sm leading-loose whitespace-pre-wrap text-white/70 italic font-bold">{aiSummary}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* ─── ANALYTICS TAB ─── */}
                {leftTab === "analytics" && profileData && (
                  <div className="max-w-5xl mx-auto p-8 space-y-8 animate-fade-in text-left">
                    <div>
                      <p className="font-mono text-xs uppercase tracking-[0.5em] text-crab-accent mb-3 font-black">Analytics</p>
                      <h2 className="text-2xl font-black uppercase tracking-tight">Data Quality</h2>
                      <p className="font-mono text-sm text-black/40 mt-2 uppercase font-bold">Session {sessionId?.slice(0, 8)} · {profileData.summary.total_tables} tables</p>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-5 gap-0 border-2 border-black divide-x divide-black transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                      {[
                        { label: "TABLES", value: profileData.summary.total_tables, accent: false },
                        { label: "ROWS", value: profileData.summary.total_rows.toLocaleString(), accent: false },
                        { label: "COLUMNS", value: profileData.summary.total_columns, accent: false },
                        { label: "COMPLETE", value: `${profileData.summary.overall_completeness}%`, accent: true },
                        { label: "DEPTH", value: `D${profileData.summary.depth_code}`, accent: true },
                      ].map((card, i) => (
                        <div key={i} className={`p-6 bg-white relative overflow-hidden text-left`}>
                          {card.accent && <div className="absolute top-0 left-0 w-full h-1.5 bg-crab-accent" />}
                          <p className="font-mono text-[10px] uppercase text-black/40 tracking-widest font-black">{card.label}</p>
                          <p className={`font-mono text-2xl font-black mt-2 ${card.accent ? "text-crab-accent" : "text-black"}`}>
                            {card.value}
                          </p>
                        </div>
                      ))}
                    </div>

                    {Object.entries(profileData.tables).map(([tName, tData]) => (
                      <div key={tName} className="bg-white border-2 border-black relative group transition-all hover:-translate-y-0.5 hover:shadow-[4px_4px_0px_0px_rgba(255,59,48,0.1)] overflow-hidden text-left">
                        <div className="absolute top-0 left-0 w-full h-1 bg-crab-accent opacity-10 group-hover:opacity-100 transition-opacity" />
                        <div className="p-5 border-b border-black/10 flex items-center justify-between bg-[#fcfcfc]">
                          <h3 className="font-mono text-xs font-black uppercase text-black/80">{tName}</h3>
                          <div className="flex items-center gap-6 font-mono text-[10px] uppercase text-black/30 font-black">
                            <span>{tData.row_count} rows</span>
                            <span>{tData.column_count} cols</span>
                            <span className={`font-black tracking-tighter ${tData.completeness >= 90 ? "text-green-500" : tData.completeness >= 70 ? "text-yellow-500" : "text-crab-accent"}`}>
                              {tData.completeness}%
                            </span>
                          </div>
                        </div>
                        <div className="px-5 pt-3 pb-2">
                          <div className="w-full h-2 bg-black/5 p-0.5">
                            <div className={`h-full transition-all ${tData.completeness >= 90 ? "bg-green-500" : tData.completeness >= 70 ? "bg-yellow-500" : "bg-crab-accent"}`} style={{ width: `${tData.completeness}%` }} />
                          </div>
                        </div>
                        <div className="p-6 grid grid-cols-2 md:grid-cols-3 gap-4">
                          {tData.columns.map((col, i) => (
                            <div key={i} className="p-4 border border-black/10 hover:border-black transition-colors bg-white">
                              <p className="font-mono text-xs font-black uppercase truncate">{col.name}</p>
                              <p className="font-mono text-[10px] text-black/40 mt-1 font-bold">{col.dtype}</p>
                              <div className="flex justify-between mt-3 text-[9px] font-mono text-black/25 uppercase font-black">
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

            {/* ═══ DRAGGABLE RESIZER HANDLE ═══ */}
            <div 
              onMouseDown={startResizing}
              className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize z-50 hover:bg-crab-accent/30 transition-colors group"
              style={{ right: `${sidebarWidth}px`, marginRight: '-3px' }}
            >
              <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[1px] bg-black/10 group-hover:bg-crab-accent transition-colors"></div>
            </div>

            {/* ═══ RIGHT: PERSISTENT CHAT SIDEBAR ═══ */}
            <aside 
              className="shrink-0 bg-[#f9f9f9] h-full flex flex-col border-l-2 border-black relative"
              style={{ width: `${sidebarWidth}px` }}
            >
              <div className="p-5 border-b-2 border-black bg-white relative text-left">
                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-crab-accent shadow-[2px_0_4px_rgba(255,59,48,0.2)]"></div>
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-mono text-base font-black uppercase tracking-tight">CRAB Agent</h2>
                    <p className="text-[10px] font-mono text-black/40 uppercase mt-1 flex items-center gap-2 font-black">
                      <span className="w-1.5 h-1.5 bg-crab-accent"></span>
                      Intelligent Relational Assistant
                    </p>
                  </div>
                  <div className="flex items-center gap-2.5 px-3 py-1.5 bg-green-500/5 border border-green-500/20">
                    <div className="w-2 h-2 bg-green-500 animate-pulse rounded-full"></div>
                    <span className="font-mono text-[10px] text-green-600 font-black uppercase tracking-widest">Active</span>
                  </div>
                </div>
              </div>

              <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6">
                {messages.map((msg, idx) => (
                  <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} text-left`}>
                    <div className={`max-w-[92%] transition-all duration-300 ${
                      msg.role === "user"
                        ? "bg-black text-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(255,59,48,1)]"
                        : "bg-white text-[#1a1a1a] border-2 border-black relative overflow-hidden shadow-[4px_4px_0px_0px_rgba(0,0,0,0.05)]"
                    }`}>
                      {msg.role === "assistant" && (
                        <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-crab-accent/30"></div>
                      )}
                      <div className="p-5">
                        <div className="font-mono text-sm whitespace-pre-wrap leading-relaxed antialiased font-medium">
                          <MarkdownRenderer content={msg.content} />
                        </div>
                      </div>
                      {msg.images && msg.images.length > 0 && (
                        <div className="border-t-2 border-black bg-black/5">
                          {msg.images.map((img, imgIdx) => (
                            <div key={imgIdx} className="p-4">
                              <div className="border-2 border-black overflow-hidden bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                <div className="px-3 py-2 bg-black flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                                    <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                    <span className="font-mono text-[9px] text-white/50 ml-2 uppercase tracking-tighter font-black">visualization.png</span>
                                  </div>
                                  <span className="font-mono text-[9px] text-crab-accent font-black">CRAB_UI</span>
                                </div>
                                <img src={`data:image/png;base64,${img}`} alt="Chart" className="w-full grayscale-0" />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {msg.exports && msg.exports.length > 0 && (
                        <div className="border-t-2 border-black bg-[#E9FFE9]/30">
                          {msg.exports.map((exp, expIdx) => (
                            <div key={expIdx} className="p-4">
                              <button
                                onClick={() => {
                                  const byteChars = atob(exp.data);
                                  const byteNums = new Array(byteChars.length);
                                  for (let i = 0; i < byteChars.length; i++) byteNums[i] = byteChars.charCodeAt(i);
                                  const blob = new Blob([new Uint8Array(byteNums)], { type: exp.mime });
                                  const url = URL.createObjectURL(blob);
                                  const a = document.createElement('a');
                                  a.href = url;
                                  a.download = exp.filename;
                                  a.click();
                                  URL.revokeObjectURL(url);
                                }}
                                className="w-full flex items-center gap-4 p-4 border-2 border-black bg-white hover:bg-black hover:text-white transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(255,59,48,1)] hover:translate-x-[2px] hover:translate-y-[2px] group"
                              >
                                <span className="text-xl">📥</span>
                                <div className="flex-1 text-left">
                                  <p className="font-mono text-xs font-black uppercase tracking-wide">{exp.filename}</p>
                                  <p className="font-mono text-[10px] text-black/40 group-hover:text-white/50 uppercase mt-1 font-bold">
                                    {exp.rows.toLocaleString()} rows · {exp.columns} columns
                                  </p>
                                </div>
                                <span className="font-mono text-xs font-black uppercase tracking-widest opacity-50 group-hover:opacity-100">DOWNLOAD</span>
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div className="flex justify-start">
                    <div className="p-4 bg-white border-2 border-black shadow-[3px_3px_0px_0px_rgba(255,59,48,0.2)]">
                      <div className="flex items-center gap-4">
                        <div className="flex gap-2">
                          <div className="w-2 h-2 bg-crab-accent rounded-full animate-[bounce_1s_infinite_0ms]"></div>
                          <div className="w-2 h-2 bg-crab-accent rounded-full animate-[bounce_1s_infinite_200ms]"></div>
                          <div className="w-2 h-2 bg-crab-accent rounded-full animate-[bounce_1s_infinite_400ms]"></div>
                        </div>
                        <span className="font-mono text-xs uppercase text-black/50 font-black tracking-widest">Analyzing</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {messages.length <= 1 && (
                <div className="px-6 py-6 border-t-2 border-black bg-white/50 backdrop-blur-sm text-left">
                  <p className="text-[10px] font-mono text-black/30 uppercase mb-4 font-black tracking-widest">Recommended Queries</p>
                  <div className="flex flex-wrap gap-3">
                    {quickActions.map((qa, i) => (
                      <button 
                        key={i} 
                        onClick={() => { setChatInput(qa); }} 
                        className="px-4 py-2 border-2 border-black/10 bg-white text-[10px] font-mono uppercase font-black hover:bg-black hover:text-white hover:border-black transition-all hover:-translate-y-0.5 hover:shadow-[3px_3px_0px_0px_rgba(255,59,48,1)]"
                      >
                        {qa}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="p-6 border-t-2 border-black bg-white">
                <form onSubmit={handleSendMessage} className="relative group">
                  <div className="absolute -inset-0.5 bg-crab-accent opacity-0 group-focus-within:opacity-10 transition-opacity pointer-events-none"></div>
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Describe the insight you need..."
                    className="w-full p-5 pr-14 border-2 border-black font-mono text-sm focus:outline-none focus:border-crab-accent focus:shadow-[4px_4px_0px_0px_rgba(255,59,48,1)] transition-all bg-[#ffffff] relative z-10"
                    disabled={chatLoading}
                  />
                  <button 
                    type="submit" 
                    disabled={chatLoading || !chatInput.trim()} 
                    className={`absolute right-5 top-1/2 -translate-y-1/2 text-2xl transition-all z-20 ${
                      chatInput.trim() ? "text-crab-accent scale-110" : "text-black/10"
                    }`}
                  >
                    ➔
                  </button>
                </form>
                <p className="text-[9px] font-mono text-black/30 uppercase mt-4 text-center tracking-widest font-black">Powered by LangGraph Agentic Engine</p>
              </div>
            </aside>
          </div>
        )}

      </div>
    </div>
  );
}
