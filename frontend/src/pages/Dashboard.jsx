import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Papa from "papaparse";
import { authService } from "../api/auth";
import logo from "../assets/logo/CRAB_LOGO.png";
import CsvDataTable from "../components/CsvDataTable";

const API_BASE = import.meta.env.VITE_DJANGO_API || "http://127.0.0.1:8000";
const AI_API_BASE = "http://127.0.0.1:8001";

export default function Dashboard() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [history, setHistory] = useState([]);
  const [csvData, setCsvData] = useState([]);
  const [csvColumns, setCsvColumns] = useState([]);
  const [selectedFileInfo, setSelectedFileInfo] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [backupLoading, setBackupLoading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [analysisHistory, setAnalysisHistory] = useState([]);
  const [dictionaryData, setDictionaryData] = useState(null);
  const [dictLoading, setDictLoading] = useState(false);
  const [selectedSession, setSelectedSession] = useState(null);
  const [user, setUser] = useState({ username: "", email: "" });
  
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const fetchDictionary = async (sessionId) => {
    if (!sessionId) return;
    setDictLoading(true);
    try {
      const res = await fetch(`${AI_API_BASE}/ai/dictionary?session_id=${sessionId}`);
      if (res.ok) {
        const data = await res.json();
        setDictionaryData(data);
      }
    } catch (err) {
      console.error("Failed to fetch dictionary:", err);
    } finally {
      setDictLoading(false);
    }
  };

  const handleHistoryClick = (session) => {
    setSelectedSession(session);
    setDictionaryData(null); // Force reload
    clearData(); // Clear any current preview
    fetchDictionary(session.session_id);
  };

  const handleDownloadDictionary = async () => {
    const sessionToDownload = selectedSession || analysisHistory[0];
    if (!sessionToDownload) return;
    const sessionId = sessionToDownload.session_id;
    try {
      const res = await fetch(`${AI_API_BASE}/ai/dictionary/download?session_id=${sessionId}`);
      if (res.ok) {
        const data = await res.json();
        const blob = new Blob([JSON.stringify(data.content, null, 2)], { type: "application/json" });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = data.filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
      }
    } catch (err) {
      alert("Failed to download dictionary.");
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await fetch(`${AI_API_BASE}/ai/history`);
      if (res.ok) {
        const data = await res.json();
        setAnalysisHistory(data);
      }
    } catch (err) {
      console.error("Failed to fetch RAM history:", err);
    }
  };


  const fetchBackups = async () => {
    try {
      const token = localStorage.getItem("access");
      if (!token) return;
      
      const res = await fetch(`${API_BASE}/api/backup/list/`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setHistory(data);
      }
    } catch (err) {
      console.error("Failed to fetch backups:", err);
    }
  };

  useEffect(() => {
    const initUser = async () => {
      const cachedUser = authService.getUser();
      if (cachedUser.username) {
        setUser(cachedUser);
      }
      const freshUser = await authService.fetchMe();
      if (freshUser) {
        setUser(freshUser);
      }
    };
    
    initUser();
    fetchBackups();
    fetchHistory();
    const interval = setInterval(() => {
      fetchBackups();
      fetchHistory();
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (analysisHistory.length > 0 && !dictLoading) {
      const targetSession = selectedSession || analysisHistory[0];
      const targetSessionId = targetSession.session_id;
      
      // Safely check current dictionary session ID
      let currentDictSessionId = null;
      if (dictionaryData) {
        const firstTable = Object.values(dictionaryData)[0];
        if (firstTable && firstTable.length > 0) {
          currentDictSessionId = firstTable[0].session_id;
        }
      }
      
      if (!dictionaryData || currentDictSessionId !== targetSessionId) {
        fetchDictionary(targetSessionId);
      }
    }
  }, [analysisHistory, selectedSession, dictionaryData, dictLoading]);

  const handleStartAnalysisClick = () => {
    navigate("/analyzer");
  };


  const handleStartBackup = async () => {
    setBackupLoading(true);
    try {
      const token = localStorage.getItem("access");
      const res = await fetch(`${API_BASE}/api/backup/start/`, {
        method: "POST",
        headers: { 
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ backup_type: "FULL" })
      });
      if (res.ok) {
        fetchBackups();
      }
    } catch (err) {
      alert("Failed to contact backup service.");
    } finally {
      setBackupLoading(false);
    }
  };

  const handleClearHistory = async () => {
    if (!window.confirm("Are you sure you want to clear all analysis history and session files?")) return;
    try {
      const res = await fetch(`${AI_API_BASE}/ai/history`, { method: "DELETE" });
      if (res.ok) {
        setAnalysisHistory([]);
        setDictionaryData(null);
        setSelectedSession(null);
        alert("History cleared successfully.");
      }
    } catch (err) {
      alert("Failed to clear history.");
    }
  };

  const handleLaunchAnalysis = async () => {
    navigate("/analyzer");
  };

  const handleOpenChat = () => {
    navigate("/chat");
  };

  const handleLogout = () => {
    authService.logout();
    navigate("/login");
  };

  const handleCrabItClick = () => {
    fileInputRef.current.click();
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setSelectedFile(file);
    const fileExt = file.name.split('.').pop().toLowerCase();
    setSelectedFileInfo({
      name: file.name,
      size: (file.size / 1024).toFixed(2) + " KB",
      type: fileExt.toUpperCase()
    });

    if (fileExt === "csv") {
      setLoading(true);
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          if (results.data && results.data.length > 0) {
            setCsvData(results.data.slice(0, 100));
            const headers = Object.keys(results.data[0]).map((key) => ({
              header: key,
              accessorKey: key,
            }));
            setCsvColumns(headers);
          }
          setLoading(false);
        },
      });
    } else {
      setCsvData([]);
      setCsvColumns([]);
    }
  };

  const clearData = () => {
    setCsvData([]);
    setCsvColumns([]);
    setSelectedFileInfo(null);
    setSelectedFile(null);
    setAnalysisResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="flex h-screen bg-white text-[#1a1a1a] font-sans selection:bg-crab-accent selection:text-white overflow-hidden relative">
      {/* Sidebar Overlay */}
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-30 lg:hidden" onClick={() => setIsSidebarOpen(false)}></div>
      )}

      {/* Sidebar */}
      <aside className={`fixed lg:relative z-40 h-full bg-white border-r-4 border-black transition-all shadow-[8px_0px_0px_0px_rgba(0,0,0,1)] ${isSidebarOpen ? "w-80 translate-x-0" : "w-0 -translate-x-full lg:w-80 lg:translate-x-0"}`}>
        <div className="flex flex-col h-full p-6">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <img src={logo} alt="Logo" className="w-20 h-20 object-contain" />
              <h2 className="font-heading text-xl uppercase tracking-tighter">Dashboard</h2>
            </div>
            <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden text-3xl font-black">×</button>
          </div>

          <button onClick={handleStartAnalysisClick} className="mb-4 brutalist-btn-secondary !py-3 font-heading text-sm">
            ANALYZER ENGINE
          </button>

          <button onClick={handleStartBackup} disabled={backupLoading} className="mb-8 brutalist-btn-primary !py-3 font-heading text-sm !shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            {backupLoading ? "BACKING UP..." : "SYSTEM BACKUP"}
          </button>


          <div className="flex-1 overflow-y-auto space-y-6 pr-2 custom-scrollbar">
            <div>
              <h3 className="text-sm font-black uppercase tracking-widest text-gray-400 mb-2">Analysis History</h3>
              <div className="space-y-3">
                 {analysisHistory.length > 0 ? analysisHistory.map((item) => (
                    <button 
                      key={item.id} 
                      onClick={() => handleHistoryClick(item)}
                      className={`w-full text-left p-3 bg-white border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all text-sm font-mono uppercase ${selectedSession?.session_id === item.session_id ? 'ring-2 ring-crab-accent' : ''}`}
                    >
                       <div className="flex justify-between font-black text-crab-accent mb-1">
                          <span className="truncate">{item.filename}</span>
                          <span>{item.file_type}</span>
                       </div>
                       <div className="flex justify-between items-center text-[10px] text-gray-400">
                          <span>{new Date(item.timestamp).toLocaleDateString()}</span>
                          <span>{item.table_count} TABLES</span>
                       </div>
                    </button>
                 )) : (
                    <p className="text-sm font-mono text-gray-400 uppercase">No History Found</p>
                 )}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-black uppercase tracking-widest text-gray-400 mb-2">System Backups</h3>
              <div className="space-y-3">
                {history.map((record) => (
                  <div key={record.id} className={`p-3 bg-white border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] relative ${record.status === 'FAILED' ? 'border-red-500' : ''}`}>
                    <div className="flex items-center justify-between mb-1 text-sm font-mono">
                      <span className="truncate w-4/5 uppercase">ID: #{record.id}</span>
                      <div className={`w-2 h-2 ${
                        record.status === 'COMPLETED' ? 'bg-green-500' : 
                        record.status === 'FAILED' ? 'bg-red-500' : 
                        'bg-yellow-500 animate-pulse'
                      }`}></div>
                    </div>
                    <div className="flex justify-between items-center text-[10px]">
                       <span className="uppercase font-black text-gray-400">{new Date(record.created_at).toLocaleDateString()}</span>
                       {record.status === 'COMPLETED' && record.file_url && (
                          <a href={`${API_BASE}${record.file_url}`} target="_blank" rel="noopener noreferrer" className="text-crab-accent font-black hover:underline" download>D-LOAD</a>
                       )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-auto pt-8 border-t-4 border-black space-y-4">
            <div className="bg-black/5 p-4 border-2 border-black/10">
              <p className="font-heading text-sm uppercase text-black/40 mb-1 tracking-widest">Active User</p>
              <div className="flex flex-col text-left">
                <span className="font-mono text-sm font-black uppercase truncate">{user.username || "CRAB USER"}</span>
                <span className="font-mono text-xs text-crab-accent font-bold truncate lowercase mt-0.5">{user.email || "user@crab-system.ai"}</span>
              </div>
            </div>
            <button onClick={handleClearHistory} className="brutalist-btn-secondary !bg-red-50 py-3 text-sm !shadow-[4px_4px_0px_0px_rgba(255,59,48,1)] !text-red-600 hover:!bg-red-500 hover:!text-white transition-all w-full">CLEAR ALL HISTORY</button>
            <button onClick={handleLogout} className="brutalist-btn-primary py-3 text-sm !shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] w-full">LOGOUT</button>
          </div>
        </div>
      </aside>


      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full overflow-y-auto p-6 lg:p-12 relative">
        {(selectedFileInfo || dictionaryData) && (
          <div className="absolute top-6 left-6 lg:top-10 lg:left-12 w-12 h-12 z-20 hidden md:block">
            <img src={logo} alt="CRAB" className="w-full h-auto object-contain opacity-80" />
          </div>
        )}

        {selectedFileInfo ? (
          <div className="max-w-6xl mx-auto w-full">
             <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 border-b-4 border-black pb-4">
               <div>
                  <h2 className="font-heading text-2xl uppercase mb-1">Dataset Loaded</h2>
                  <p className="font-mono text-sm uppercase text-gray-400">
                    {selectedFileInfo.name} | {selectedFileInfo.size} | {selectedFileInfo.type}
                  </p>
               </div>
               <button onClick={clearData} className="brutalist-btn-secondary !py-2 !w-auto px-6 text-sm font-black">
                 CLEAR / NEW
               </button>
             </div>
             
             {isAnalyzing ? (
                <div className="p-20 bg-white border-4 border-black shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] text-center">
                   <h2 className="text-4xl font-black mb-4 animate-pulse">CRACKING DATA...</h2>
                   <div className="w-64 h-8 border-4 border-black mx-auto overflow-hidden">
                      <div className="h-full bg-crab-accent animate-width"></div>
                   </div>
                </div>
             ) : analysisResult ? (
                <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
                   <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {analysisResult.schema.map((col, idx) => (
                        <div key={idx} className="p-6 bg-white border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all">
                           <h4 className="font-heading text-sm text-crab-accent mb-2 uppercase">{col.name}</h4>
                           <div className="space-y-2">
                              <p className="font-mono text-xl font-black">{col.type}</p>
                              <div className="flex justify-between text-sm font-black uppercase text-gray-400">
                                 <span>{col.unique_values} UNIQUE</span>
                                 <span>{col.completeness} FULL</span>
                              </div>
                           </div>
                        </div>
                      ))}
                   </div>
                   <div className="p-8 bg-[#1a1a1a] text-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(255,59,48,1)]">
                      <h3 className="font-heading text-xl mb-4">ENGINE INSIGHT</h3>
                      <p className="font-mono text-base leading-relaxed mb-6">
                         Step 1 Incomplete. Relationship detection (Step 2) requires 2+ datasets. 
                         Please upload additional nodes to begin cardinality mapping.
                      </p>
                      <button className="brutalist-btn-primary !w-auto px-12 !shadow-[4px_4px_0px_0px_rgba(255,255,255,1)]">NEXT PHASE</button>
                   </div>
                </div>
             ) : (
                <div className="flex flex-col gap-12">
                   {csvData.length > 0 && <CsvDataTable data={csvData} columns={csvColumns} />}
                   <div className="p-12 bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] text-center">
                      <h3 className="font-heading text-xl mb-4">INGESTION COMPLETE</h3>
                      <p className="font-mono text-base max-w-md mx-auto">
                        Dataset ready for AI profiling.
                      </p>
                      <button onClick={handleLaunchAnalysis} className="brutalist-btn-primary mt-8 max-w-sm mx-auto !py-5 text-xl">
                         LAUNCH AI ANALYSIS
                      </button>
                   </div>
                </div>
             )}
          </div>
        ) : analysisHistory.length > 0 ? (
          <div className="max-w-6xl mx-auto w-full space-y-10">
            <div className="flex items-end justify-between border-b-4 border-black pb-6">
              <div>
                <h1 className="text-[3rem] md:text-[4rem] font-black leading-[0.85] uppercase -tracking-wider">
                  System<br/><span className="text-crab-accent">Status</span>
                </h1>
                <p className="font-mono text-sm text-gray-400 mt-2 uppercase tracking-widest">Active nodes & Relational Cardinality</p>
              </div>
              <button onClick={handleStartAnalysisClick} className="brutalist-btn-primary !w-auto !py-4 px-10 text-sm font-heading">
                ANALYZER ENGINE
              </button>
            </div>

            {(() => {
              const latest = selectedSession || analysisHistory[0];
              return (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-4 bg-white border-2 border-black">
                    <p className="font-mono text-[10px] uppercase text-gray-400">Target Dataset</p>
                    <p className="font-mono text-sm font-black truncate mt-1">{latest.filename}</p>
                  </div>
                  <div className="p-4 bg-white border-2 border-black">
                    <p className="font-mono text-[10px] uppercase text-gray-400">Resolved Tables</p>
                    <p className="font-mono text-2xl font-black mt-1">{latest.table_count}</p>
                  </div>
                  <div className="p-4 bg-white border-2 border-black">
                    <p className="font-mono text-[10px] uppercase text-gray-400">Total Joins</p>
                    <p className="font-mono text-2xl font-black mt-1">{latest.relationship_count || "0"}</p>
                  </div>
                  <div className="p-4 bg-black text-white border-2 border-black">
                    <p className="font-mono text-[10px] uppercase text-gray-500">Node Type</p>
                    <p className="font-mono text-base font-black mt-1 uppercase tracking-widest">{latest.file_type}</p>
                  </div>
                </div>
              );
            })()}

            {/* Depth Code Section */}
            <div className="grid grid-cols-1 gap-6">
              {/* Depth Code Card */}
              <div className="p-6 bg-[#1a1a1a] text-white border-4 border-black shadow-[6px_6px_0px_0px_rgba(255,59,48,1)]">
                <h3 className="font-heading text-base uppercase mb-4 text-crab-accent border-b-2 border-crab-accent pb-2">Schema Depth Code</h3>
                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <p className="font-mono text-5xl font-black">{(selectedSession || analysisHistory[0])?.relationship_count > 5 ? "D3" : (selectedSession || analysisHistory[0])?.relationship_count > 2 ? "D2" : "D1"}</p>
                    <p className="text-[10px] font-mono uppercase text-gray-400 mt-2">Depth Level</p>
                  </div>
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-green-500 border border-white/20"></div>
                      <span className="font-mono text-sm uppercase">D1 — Flat (0-2 FK chains)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-yellow-500 border border-white/20"></div>
                      <span className="font-mono text-sm uppercase">D2 — Moderate (3-5 FK chains)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-red-500 border border-white/20"></div>
                      <span className="font-mono text-sm uppercase">D3 — Deep (6+ FK chains)</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Tables Overview */}
            <div className="bg-white border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
              <div className="p-4 border-b-2 border-black bg-[#f9f9f9]">
                <h3 className="font-heading text-base uppercase">Resolved Tables</h3>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {(selectedSession || analysisHistory[0]).table_count > 0 && Array.from({ length: (selectedSession || analysisHistory[0]).table_count }, (_, i) => (
                    <div key={i} className="p-3 border-2 border-gray-200 hover:border-black transition-colors">
                      <p className="font-mono text-sm font-black uppercase">Table #{i + 1}</p>
                      <p className="text-[10px] font-mono text-gray-400 uppercase mt-1">From: {(selectedSession || analysisHistory[0]).filename}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Data Dictionary Section */}
            <div className="bg-white border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
              <div className="p-4 border-b-2 border-black bg-[#f9f9f9] flex justify-between items-center">
                <div className="flex flex-col">
                  <h3 className="font-heading text-base uppercase">Detailed Data Dictionary</h3>
                  {selectedSession && (
                    <p className="font-mono text-xs text-crab-accent uppercase font-black">
                      Viewing: {selectedSession.filename}
                    </p>
                  )}
                </div>
                <button 
                  onClick={handleDownloadDictionary} 
                  disabled={!dictionaryData}
                  className="brutalist-btn-secondary !py-1 !px-4 text-sm font-black !w-auto !shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                >
                  DOWNLOAD .JSON
                </button>
              </div>
              <div className="p-6">
                {dictLoading ? (
                  <div className="py-12 text-center">
                    <div className="animate-spin inline-block w-8 h-8 border-4 border-black border-t-transparent mb-4"></div>
                    <p className="font-mono text-sm uppercase animate-pulse">Retrieving dictionary nodes...</p>
                  </div>
                ) : dictionaryData ? (
                  <div className="space-y-10">
                    {Object.entries(dictionaryData).map(([tableName, columns]) => (
                      <div key={tableName} className="animate-in fade-in duration-500">
                        <div className="flex items-center gap-4 mb-4">
                          <h4 className="font-heading text-lg uppercase bg-black text-white px-3 py-1">{tableName}</h4>
                          <div className="h-[2px] flex-1 bg-black/10"></div>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left font-mono text-sm border-collapse">
                            <thead>
                              <tr className="border-b-2 border-black bg-gray-50">
                                <th className="py-3 px-4">COLUMN</th>
                                <th className="py-3 px-4">TYPE</th>
                                <th className="py-3 px-4 text-right">NULL %</th>
                                <th className="py-3 px-4 text-right">UNIQUE</th>
                                <th className="py-3 px-4">MIN/MAX RANGE</th>
                                <th className="py-3 px-4">VALUE SAMPLES</th>
                              </tr>
                            </thead>
                            <tbody>
                              {columns.map((col, idx) => (
                                <tr key={idx} className="border-b border-black/5 hover:bg-crab-accent/5 transition-colors">
                                  <td className="py-3 px-4 font-black text-crab-accent">{col.column_name}</td>
                                  <td className="py-3 px-4 font-bold">{col.dtype}</td>
                                  <td className="py-3 px-4 text-right">
                                    <span className={col.null_pct > 20 ? "text-red-500 font-black" : ""}>
                                      {col.null_pct}%
                                    </span>
                                  </td>
                                  <td className="py-3 px-4 text-right">{col.unique_count}</td>
                                  <td className="py-3 px-4">
                                    <div className="flex flex-col gap-1 text-[10px] leading-none">
                                      <div className="flex justify-between">
                                        <span className="text-gray-400 uppercase mr-2">MIN</span>
                                        <span className="truncate max-w-[100px]">{col.min_val || "N/A"}</span>
                                      </div>
                                      <div className="flex justify-between border-t border-black/5 pt-1">
                                        <span className="text-gray-400 uppercase mr-2">MAX</span>
                                        <span className="truncate max-w-[100px]">{col.max_val || "N/A"}</span>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="py-3 px-4">
                                    <div className="flex flex-wrap gap-1">
                                      {JSON.parse(col.sample_values || "[]").map((val, vIdx) => (
                                        <span key={vIdx} className="bg-gray-100 px-1 border border-black/10 truncate max-w-[80px]">
                                          {String(val)}
                                        </span>
                                      ))}
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-12 text-center border-2 border-dashed border-black/20">
                    <p className="font-mono text-sm text-gray-400 uppercase">No dictionary data generated for this session.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex gap-4 pb-12 border-t-4 border-black pt-8">
              <button 
                onClick={handleStartAnalysisClick} 
                className="flex-1 brutalist-btn-primary !py-6 text-base font-heading shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]"
              >
                ANALYZER ENGINE
              </button>
              <button 
                onClick={handleStartBackup} 
                disabled={backupLoading} 
                className="flex-1 brutalist-btn-secondary !py-6 text-base font-heading"
              >
                {backupLoading ? "EXECUTING BACKUP..." : "INITIATE SYSTEM BACKUP"}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center -mt-20">
            {/* Logo Centerpiece */}
            <div className="flex flex-col items-center gap-6 w-full">
              <div className="w-96 h-96 md:w-[32rem] md:h-[32rem] flex items-center justify-center">
                <img src={logo} alt="CRAB" className="w-full h-auto object-contain" />
              </div>
              
              <div className="text-center">
                <p className="font-mono text-sm uppercase tracking-[0.5em] text-black opacity-30 font-black">
                  Comprehensive Relational Analyzer and Builder
                </p>
              </div>
            </div>

            <div className="mt-8">
              <button 
                onClick={handleStartAnalysisClick} 
                className="brutalist-btn-primary !py-3 !px-10 text-base font-heading shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all"
              >
                ANALYZER ENGINE
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
