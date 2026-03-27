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
  
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

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
    fetchBackups();
    fetchHistory();
    const interval = setInterval(() => {
      fetchBackups();
      fetchHistory();
    }, 10000);
    return () => clearInterval(interval);
  }, []);

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

  const handleLaunchAnalysis = async () => {
    if (!selectedFile) return;
    setIsAnalyzing(true);
    setAnalysisResult(null);

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const res = await fetch(`${AI_API_BASE}/ai/process`, {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        setAnalysisResult(data);
      } else {
        alert("AI Engine is currently unavailable or returned an error.");
      }
    } catch (err) {
      alert("Could not connect to the AI Analysis Engine (Port 8001). Please ensure it is running.");
    } finally {
      setIsAnalyzing(false);
    }
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
            <h2 className="font-heading text-xl uppercase tracking-tighter">System</h2>
            <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden text-3xl font-black">×</button>
          </div>

          <button onClick={handleStartAnalysisClick} className="mb-8 brutalist-btn-secondary !py-3 font-heading text-[10px]">
            ANALYZER ENGINE
          </button>


          <div className="flex-1 overflow-y-auto space-y-6 pr-2 custom-scrollbar">
            <div>
              <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Analysis History</h3>
              <div className="space-y-3">
                 {analysisHistory.length > 0 ? analysisHistory.map((item) => (
                    <div key={item.id} className="p-3 bg-white border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] text-[10px] font-mono uppercase">
                       <div className="flex justify-between font-black text-crab-accent mb-1">
                          <span>{item.filename}</span>
                          <span>{item.file_type}</span>
                       </div>
                       <div className="flex justify-between items-center text-[8px] text-gray-400">
                          <span>{new Date(item.timestamp).toLocaleDateString()}</span>
                          <span>{item.table_count} TABLES</span>
                       </div>
                    </div>
                 )) : (
                    <p className="text-[10px] font-mono text-gray-400 uppercase">No History Found</p>
                 )}
              </div>
            </div>

            <div>
              <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-2">System Backups</h3>
              <div className="space-y-3">
                {history.map((record) => (
                  <div key={record.id} className={`p-3 bg-white border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] relative ${record.status === 'FAILED' ? 'border-red-500' : ''}`}>
                    <div className="flex items-center justify-between mb-1 text-[10px] font-mono">
                      <span className="truncate w-4/5 uppercase">ID: #{record.id}</span>
                      <div className={`w-2 h-2 ${
                        record.status === 'COMPLETED' ? 'bg-green-500' : 
                        record.status === 'FAILED' ? 'bg-red-500' : 
                        'bg-yellow-500 animate-pulse'
                      }`}></div>
                    </div>
                    <div className="flex justify-between items-center text-[8px]">
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

          <div className="mt-auto pt-8 border-t-4 border-black">
            <button onClick={handleLogout} className="brutalist-btn-primary py-3 text-sm !shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">LOGOUT</button>
          </div>
        </div>
      </aside>


      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full overflow-y-auto p-6 lg:p-12">

        {selectedFileInfo ? (
          <div className="max-w-6xl mx-auto w-full">
             <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 border-b-4 border-black pb-4">
               <div>
                  <h2 className="font-heading text-2xl uppercase mb-1">Dataset Loaded</h2>
                  <p className="font-mono text-xs uppercase text-gray-400">
                    {selectedFileInfo.name} | {selectedFileInfo.size} | {selectedFileInfo.type}
                  </p>
               </div>
               <button onClick={clearData} className="brutalist-btn-secondary !py-2 !w-auto px-6 text-xs font-black">
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
                           <h4 className="font-heading text-[10px] text-crab-accent mb-2 uppercase">{col.name}</h4>
                           <div className="space-y-2">
                              <p className="font-mono text-xl font-black">{col.type}</p>
                              <div className="flex justify-between text-[10px] font-black uppercase text-gray-400">
                                 <span>{col.unique_values} UNIQUE</span>
                                 <span>{col.completeness} FULL</span>
                              </div>
                           </div>
                        </div>
                      ))}
                   </div>
                   <div className="p-8 bg-[#1a1a1a] text-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(255,59,48,1)]">
                      <h3 className="font-heading text-xl mb-4">ENGINE INSIGHT</h3>
                      <p className="font-mono text-sm leading-relaxed mb-6">
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
                      <p className="font-mono text-sm max-w-md mx-auto">
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
                <p className="font-mono text-xs text-gray-400 mt-2 uppercase tracking-widest">Active nodes & Relational Cardinality</p>
              </div>
              <button onClick={handleStartAnalysisClick} className="brutalist-btn-primary !w-auto !py-4 px-10 text-xs font-heading">
                ANALYZER ENGINE
              </button>
            </div>

            {(() => {
              const latest = analysisHistory[0];
              return (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-4 bg-white border-2 border-black">
                    <p className="font-mono text-[8px] uppercase text-gray-400">Target Dataset</p>
                    <p className="font-mono text-xs font-black truncate mt-1">{latest.filename}</p>
                  </div>
                  <div className="p-4 bg-white border-2 border-black">
                    <p className="font-mono text-[8px] uppercase text-gray-400">Resolved Tables</p>
                    <p className="font-mono text-2xl font-black mt-1">{latest.table_count}</p>
                  </div>
                  <div className="p-4 bg-white border-2 border-black">
                    <p className="font-mono text-[8px] uppercase text-gray-400">Total Joins</p>
                    <p className="font-mono text-2xl font-black mt-1">{latest.relationship_count || "0"}</p>
                  </div>
                  <div className="p-4 bg-black text-white border-2 border-black">
                    <p className="font-mono text-[8px] uppercase text-gray-500">Node Type</p>
                    <p className="font-mono text-sm font-black mt-1 uppercase tracking-widest">{latest.file_type}</p>
                  </div>
                </div>
              );
            })()}

            {/* Data Quality Overview & Depth Code Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Data Quality Card */}
              <div className="p-6 bg-white border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                <h3 className="font-heading text-sm uppercase mb-4 border-b-2 border-black pb-2">Data Quality Metrics</h3>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-[10px] font-mono uppercase font-black mb-1">
                      <span>Overall Completeness</span>
                      <span className="text-green-500">HIGH</span>
                    </div>
                    <div className="w-full h-4 bg-gray-200 border-2 border-black">
                      <div className="h-full bg-green-500" style={{ width: "92%" }}></div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 pt-2">
                    <div className="text-center p-3 border border-gray-200">
                      <p className="font-mono text-xl font-black">92%</p>
                      <p className="text-[8px] font-mono uppercase text-gray-400 mt-1">Non-Null</p>
                    </div>
                    <div className="text-center p-3 border border-gray-200">
                      <p className="font-mono text-xl font-black">100%</p>
                      <p className="text-[8px] font-mono uppercase text-gray-400 mt-1">Parsed</p>
                    </div>
                    <div className="text-center p-3 border border-gray-200">
                      <p className="font-mono text-xl font-black">OK</p>
                      <p className="text-[8px] font-mono uppercase text-gray-400 mt-1">Integrity</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Depth Code Card */}
              <div className="p-6 bg-[#1a1a1a] text-white border-4 border-black shadow-[6px_6px_0px_0px_rgba(255,59,48,1)]">
                <h3 className="font-heading text-sm uppercase mb-4 text-crab-accent border-b-2 border-crab-accent pb-2">Schema Depth Code</h3>
                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <p className="font-mono text-5xl font-black">{analysisHistory[0]?.relationship_count > 5 ? "D3" : analysisHistory[0]?.relationship_count > 2 ? "D2" : "D1"}</p>
                    <p className="text-[8px] font-mono uppercase text-gray-400 mt-2">Depth Level</p>
                  </div>
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-green-500 border border-white/20"></div>
                      <span className="font-mono text-[10px] uppercase">D1 — Flat (0-2 FK chains)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-yellow-500 border border-white/20"></div>
                      <span className="font-mono text-[10px] uppercase">D2 — Moderate (3-5 FK chains)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-red-500 border border-white/20"></div>
                      <span className="font-mono text-[10px] uppercase">D3 — Deep (6+ FK chains)</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Tables Overview */}
            <div className="bg-white border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
              <div className="p-4 border-b-2 border-black bg-[#f9f9f9]">
                <h3 className="font-heading text-sm uppercase">Resolved Tables</h3>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {analysisHistory.slice(0, 1).map(session => (
                    Array.from({ length: session.table_count }, (_, i) => (
                      <div key={i} className="p-3 border-2 border-gray-200 hover:border-black transition-colors">
                        <p className="font-mono text-[10px] font-black uppercase">Table #{i + 1}</p>
                        <p className="text-[8px] font-mono text-gray-400 uppercase mt-1">From: {session.filename}</p>
                      </div>
                    ))
                  ))}
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex gap-4 pb-12 border-t-4 border-black pt-8">
              <button 
                onClick={handleStartAnalysisClick} 
                className="flex-1 brutalist-btn-primary !py-6 text-sm font-heading shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]"
              >
                ANALYZER ENGINE
              </button>
              <button 
                onClick={handleStartBackup} 
                disabled={backupLoading} 
                className="flex-1 brutalist-btn-secondary !py-6 text-sm font-heading"
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
                <p className="font-mono text-[10px] uppercase tracking-[0.5em] text-black opacity-30 font-black">
                  Comprehensive Relational Analyzer and Builder
                </p>
              </div>
            </div>

            <div className="mt-8">
              <button 
                onClick={handleStartAnalysisClick} 
                className="brutalist-btn-primary !py-3 !px-10 text-sm font-heading shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all"
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
