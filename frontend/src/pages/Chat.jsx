import { useState, useRef, useEffect, useCallback } from "react";
import { Link, useLocation } from "react-router-dom";
import ForceGraph2D from "react-force-graph-2d";
import logo from "../assets/logo/CRAB_LOGO.png";

const AI_API = "http://127.0.0.1:8001";

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
      <div class="mt-2 mb-4 border-2 border-black overflow-hidden shadow-[4px_4px_0px_0px_rgba(0,0,0,0.05)] text-left">
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
  
  // 3. Handle line breaks
  html = html.replace(/\n{3,}/g, '\n\n');
  html = html.replace(/\n/g, '<br/>');

  return (
    <div 
      className="markdown-content leading-relaxed text-left" 
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

export default function Chat() {
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [error, setError] = useState("");
  const [sidebarWidth, setSidebarWidth] = useState(450);
  const fileInputRef = useRef(null);
  const scrollRef = useRef(null);
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
    const newWidth = e.clientX;
    if (newWidth > 350 && newWidth < 900) {
      setSidebarWidth(newWidth);
    }
  }, []);

  useEffect(() => {
    if (location.state?.initialData) {
        processIncomingData(location.state.initialData);
    }
  }, [location.state]);

  useEffect(() => {
    if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, chatLoading]);

  const processIncomingData = (data) => {
      setSessionId(data.session_id);
      
      const nodes = data.entities.map(id => ({ id, name: id, val: 5 }));
      const links = data.relationships.map(rel => ({
        source: rel["Entity A"],
        target: rel["Entity B"],
        label: rel["Relationship"],
        color: rel["Relationship"] === "MANY : MANY" ? "#ff3b30" : 
               rel["Relationship"] === "1 : 1" ? "#22c55e" : "#1a1a1a"
      }));

      setGraphData({ nodes, links });
      
      setMessages([
          { role: "assistant", content: `System initialization successful. Analysis Complete. ${data.summary}` }
      ]);
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
        if (!res.ok) throw new Error("Agent failed to respond.");
        const data = await res.json();
        setMessages(prev => [...prev, { 
            role: "assistant", 
            content: data.response,
            images: data.images || [],
            exports: data.exports || []
        }]);
    } catch (err) {
        setMessages(prev => [...prev, { role: "assistant", content: "Error: " + err.message }]);
    } finally {
        setChatLoading(false);
    }
  };

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setLoading(true);
    setError("");
    const formData = new FormData();
    files.forEach(f => formData.append("files", f));

    try {
      const res = await fetch(`${AI_API}/ai/relationships`, {
        method: "POST",
        body: formData
      });
      if (!res.ok) throw new Error("Discovery failed.");
      const data = await res.json();
      processIncomingData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-white text-[#1a1a1a] font-sans selection:bg-crab-accent selection:text-white overflow-hidden relative">
      {/* Sidebar: Advanced Chat Agent */}
      <aside 
        className="bg-white border-r-2 border-black h-full flex flex-col relative shrink-0 z-10"
        style={{ width: `${sidebarWidth}px` }}
      >
        <div className="p-5 border-b-2 border-black flex justify-between items-center bg-white relative">
            <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-crab-accent"></div>
            <div>
                <h2 className="font-heading text-sm uppercase tracking-tighter text-left">CRAB Agent</h2>
                <p className="text-sm font-mono text-black/40 uppercase tracking-widest text-left font-bold flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-crab-accent"></span>
                    Intelligent Relational Assistant
                </p>
            </div>
            <Link to="/analyzer" className="text-sm font-black uppercase border-2 border-black px-3 py-1 hover:bg-black hover:text-white transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">BACK</Link>
        </div>
        
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 brutalist-scrollbar bg-[#f9f9f9]">
            {messages.length === 0 && !loading && (
                <div className="text-center py-20 animate-fade-in">
                    <div className="w-16 h-16 border-2 border-black/5 mx-auto mb-6 flex items-center justify-center text-black/10 text-4xl font-black italic">?</div>
                    <p className="font-mono text-sm uppercase text-black/20 italic tracking-[0.3em] leading-relaxed">Ingest files to start<br/>conversational discovery.</p>
                </div>
            )}

            {messages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} animate-slide-up text-left`}>
                    <div className={`max-w-[92%] transition-all duration-300 ${
                        msg.role === "user"
                          ? "bg-black text-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(255,59,48,1)]"
                          : "bg-white text-[#1a1a1a] border-2 border-black relative overflow-hidden shadow-[4px_4px_0px_0px_rgba(0,0,0,0.05)]"
                    }`}>
                        {msg.role === "assistant" && <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-crab-accent/30"></div>}
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
                                                    <span className="font-mono text-xs text-white/50 ml-2 uppercase tracking-tighter font-black">visualization.png</span>
                                                </div>
                                            </div>
                                            <img src={`data:image/png;base64,${img}`} alt="Chart" className="w-full" />
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
                                                    {exp.rows.toLocaleString()} rows
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
                <div className="flex justify-start animate-fade-in">
                    <div className="p-4 bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(255,59,48,0.2)]">
                        <div className="flex items-center gap-3">
                            <div className="flex gap-1.5">
                                <div className="w-2 h-2 bg-crab-accent rounded-full animate-[bounce_1s_infinite_0ms]"></div>
                                <div className="w-2 h-2 bg-crab-accent rounded-full animate-[bounce_1s_infinite_200ms]"></div>
                                <div className="w-2 h-2 bg-crab-accent rounded-full animate-[bounce_1s_infinite_400ms]"></div>
                            </div>
                            <span className="font-mono text-sm uppercase font-black tracking-widest text-black/40">Analyzing</span>
                        </div>
                    </div>
                </div>
            )}

            {error && <div className="p-4 bg-crab-accent/5 border-l-4 border-crab-accent text-crab-accent text-sm font-black uppercase tracking-widest text-left animate-shake">{error}</div>}
        </div>

        <div className="p-6 border-t-2 border-black bg-white space-y-4">
            <form onSubmit={handleSendMessage} className="relative group">
                <div className="absolute -inset-0.5 bg-crab-accent opacity-0 group-focus-within:opacity-10 transition-opacity pointer-events-none"></div>
                <input 
                    type="text" 
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Ask about data or relationships..."
                    className="w-full p-5 pr-14 border-2 border-black font-mono text-sm focus:outline-none focus:ring-0 focus:border-crab-accent shadow-[4px_4px_0px_0px_rgba(0,0,0,0.03)] focus:shadow-[4px_4px_0px_0px_rgba(255,59,48,1)] transition-all bg-white relative z-10"
                    disabled={!sessionId || chatLoading}
                />
                <button 
                  type="submit" 
                  disabled={!sessionId || chatLoading}
                  className={`absolute right-5 top-1/2 -translate-y-1/2 text-2xl transition-all z-20 ${
                    chatInput.trim() ? "text-crab-accent scale-110" : "text-black/10"
                  }`}
                >
                    ➔
                </button>
            </form>
            <button onClick={() => fileInputRef.current.click()} className="w-full brutalist-btn-primary !py-4 text-xs font-black flex items-center justify-center gap-3">
                <span className="text-xl">📁</span> {graphData.nodes.length > 0 ? "RE-INGEST DATA" : "INGEST NEW DATA SOURCE"}
            </button>
            <input type="file" ref={fileInputRef} className="hidden" multiple accept=".csv,.db,.sqlite,.sql" onChange={handleFileChange} />
            <p className="text-[9px] font-mono text-black/20 uppercase text-center tracking-[0.4em] font-black">Powered by LangGraph Agentic Engine</p>
        </div>

        {/* DRAGGABLE RESIZER HANDLE */}
        <div 
          onMouseDown={startResizing}
          className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize z-50 hover:bg-crab-accent/30 transition-colors group"
          style={{ left: `${sidebarWidth}px`, marginLeft: '-3px' }}
        >
          <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[1px] bg-black/10 group-hover:bg-crab-accent transition-colors"></div>
        </div>
      </aside>

      {/* Main Graph Area */}
      <main className="flex-1 relative bg-white overflow-hidden animate-fade-in">
        <header className="absolute top-8 right-8 z-20 flex items-center gap-4 bg-white p-4 border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
            <div className="p-1 border border-black/5">
                <img src={logo} alt="CRAB" className="h-6 w-auto" />
            </div>
            <div className="flex flex-col items-start">
                <span className="font-heading text-[9px] uppercase tracking-tighter leading-none">Topology Graph</span>
                <span className="text-[7px] font-mono text-black/30 uppercase mt-1 tracking-widest font-black">Dynamic Node Mapping</span>
            </div>
        </header>

        {loading && (
           <div className="absolute inset-0 z-30 bg-white/60 backdrop-blur-sm flex items-center justify-center animate-fade-in">
               <div className="flex flex-col items-center gap-6">
                   <div className="flex gap-2">
                        <div className="w-3 h-3 bg-black animate-[bounce_1s_infinite_0ms]"></div>
                        <div className="w-3 h-3 bg-black animate-[bounce_1s_infinite_200ms]"></div>
                        <div className="w-3 h-3 bg-black animate-[bounce_1s_infinite_400ms]"></div>
                   </div>
                   <div className="text-3xl font-black uppercase tracking-[0.3em] text-crab-text">Detecting...</div>
               </div>
           </div>
        )}

        <div className="w-full h-full cursor-grab active:cursor-grabbing bg-crab-bg/10">
            {graphData.nodes.length > 0 ? (
                <ForceGraph2D
                    graphData={graphData}
                    nodeLabel="name"
                    nodeColor={() => "#1a1a1a"}
                    linkColor={link => link.color || "#1a1a1a"}
                    linkWidth={2.5}
                    linkLabel="label"
                    linkDirectionalArrowLength={6}
                    linkDirectionalArrowRelPos={1}
                    backgroundColor="transparent"
                    nodeCanvasObject={(node, ctx, globalScale) => {
                        const label = node.name;
                        const fontSize = 12/globalScale;
                        ctx.font = `900 ${fontSize}px 'JetBrains Mono', 'Fira Code', monospace`;
                        const textWidth = ctx.measureText(label).width;
                        const pad = fontSize * 0.7;
                        const bw = textWidth + pad * 2;
                        const bh = fontSize + pad;

                        ctx.fillStyle = 'rgba(0,0,0,0.1)';
                        ctx.fillRect(node.x - bw / 2 + 2, node.y - bh / 2 + 2, bw, bh);

                        ctx.fillStyle = '#1a1a1a';
                        ctx.fillRect(node.x - bw / 2, node.y - bh / 2, bw, bh);
                        
                        ctx.strokeStyle = '#000';
                        ctx.lineWidth = 1/globalScale;
                        ctx.strokeRect(node.x - bw / 2, node.y - bh / 2, bw, bh);

                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.fillStyle = '#ffffff';
                        ctx.fillText(label, node.x, node.y);
                    }}
                />
            ) : (
                <div className="flex flex-col items-center justify-center h-full opacity-[0.03] pointer-events-none select-none">
                    <span className="font-heading text-[12vw] uppercase -rotate-6 tracking-tighter">Structure</span>
                    <span className="font-heading text-[12vw] uppercase rotate-3 tracking-tighter mt-[-4vw]">Architect</span>
                </div>
            )}
        </div>

        {/* Legend */}
        {graphData.nodes.length > 0 && (
            <div className="absolute bottom-8 left-8 z-20 bg-white p-3 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-col gap-2">
                <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 bg-crab-success"></div>
                    <span className="font-mono text-[8px] font-black uppercase tracking-widest">1 : 1 Relation</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 bg-black"></div>
                    <span className="font-mono text-[8px] font-black uppercase tracking-widest">1 : M Relation</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 bg-crab-accent"></div>
                    <span className="font-mono text-[8px] font-black uppercase tracking-widest">M : M Relation</span>
                </div>
            </div>
        )}
      </main>
    </div>
  );
}
