import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import ForceGraph2D from "react-force-graph-2d";
import logo from "../assets/logo/CRAB_LOGO.png";

const AI_API = "http://127.0.0.1:8001";

export default function Chat() {
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);
  const scrollRef = useRef(null);

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
      
      // Transform relationships into graph nodes/links
      const nodes = data.entities.map(id => ({ id, name: id, val: 5 }));
      const links = data.relationships.map(rel => ({
        source: rel["Entity A"],
        target: rel["Entity B"],
        label: rel["Relationship"],
        color: rel["Relationship"] === "MANY : MANY" ? "#ff3b30" : 
               rel["Relationship"] === "1 : 1" ? "#34c759" : "#1a1a1a"
      }));

      setGraphData({ nodes, links });
      
      // Initial AI message
      setMessages([
          { role: "assistant", content: `Analysis Complete. ${data.summary}` }
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
        setMessages(prev => [...prev, { role: "assistant", content: data.response }]);
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
    <div className="flex h-screen bg-[#f4f4f0] text-[#1a1a1a] font-sans selection:bg-crab-accent selection:text-white overflow-hidden relative">
      {/* Sidebar: Advanced Chat Agent */}
      <aside className="w-[450px] bg-white border-r-4 border-black h-full flex flex-col shadow-[8px_0px_0px_0px_rgba(0,0,0,1)] z-10">
        <div className="p-6 border-b-4 border-black flex justify-between items-center bg-[#f9f9f9]">
            <div>
                <h2 className="font-heading text-xl uppercase tracking-tighter">Chat Agent</h2>
                <p className="text-[10px] font-mono text-gray-400 uppercase">LangGraph + Pandas Engine</p>
            </div>
            <Link to="/analyzer" className="text-[11px] font-black uppercase border-b-2 border-black hover:text-crab-accent transition-colors">Back</Link>
        </div>
        
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-[#fcfcfc]">
            {messages.length === 0 && !loading && (
                <div className="text-center py-20">
                    <p className="font-mono text-xs uppercase text-gray-400 italic">Ingest files to start conversational discovery.</p>
                </div>
            )}

            {messages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[85%] p-4 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ${
                        msg.role === "user" ? "bg-crab-accent text-white" : "bg-white text-[#1a1a1a]"
                    }`}>
                        <p className="font-mono text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                    </div>
                </div>
            ))}

            {chatLoading && (
                <div className="flex justify-start">
                    <div className="p-4 bg-gray-100 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] animate-pulse">
                        <span className="font-mono text-xs uppercase font-black">Agent reasoning...</span>
                    </div>
                </div>
            )}

            {error && <div className="p-4 bg-red-100 border-2 border-red-500 text-red-700 text-xs font-black uppercase">{error}</div>}
        </div>

        <div className="p-6 border-t-4 border-black bg-white space-y-4">
            <form onSubmit={handleSendMessage} className="relative">
                <input 
                    type="text" 
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Ask about data or relationships..."
                    className="w-full p-4 pr-12 border-4 border-black font-mono text-sm focus:outline-none focus:ring-0 focus:border-crab-accent"
                    disabled={!sessionId || chatLoading}
                />
                <button 
                  type="submit" 
                  disabled={!sessionId || chatLoading}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-2xl"
                >
                    ➔
                </button>
            </form>
            <button onClick={() => fileInputRef.current.click()} className="w-full brutalist-btn-primary !py-3 text-[10px] font-black flex items-center justify-center gap-2">
                <span className="text-lg">📁</span> {graphData.nodes.length > 0 ? "RE-INGEST DATA" : "INGEST NEW DATA SOURCE"}
            </button>
            <input type="file" ref={fileInputRef} className="hidden" multiple accept=".csv,.db,.sqlite,.sql" onChange={handleFileChange} />
        </div>
      </aside>

      {/* Main Graph Area */}
      <main className="flex-1 relative bg-white overflow-hidden">
        <header className="absolute top-8 right-8 z-20 flex items-center gap-3 bg-white/80 backdrop-blur-md p-4 border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
            <img src={logo} alt="CRAB" className="h-8 w-auto" />
            <span className="font-heading text-[10px] uppercase border-b-2 border-crab-accent">Topology Graph</span>
        </header>

        {loading && (
           <div className="absolute inset-0 z-30 bg-white/50 backdrop-blur-sm flex items-center justify-center">
               <div className="text-4xl font-black uppercase tracking-[10px] animate-pulse">Detecting...</div>
           </div>
        )}

        <div className="w-full h-full cursor-grab active:cursor-grabbing">
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
                        const fontSize = 14/globalScale;
                        ctx.font = `bold ${fontSize}px 'Inter', sans-serif`;
                        const textWidth = ctx.measureText(label).width;
                        const bckgDimensions = [textWidth, fontSize].map(n => n + fontSize * 0.5);

                        ctx.fillStyle = 'rgba(255, 255, 255, 1)';
                        ctx.fillRect(node.x - bckgDimensions[0] / 2, node.y - bckgDimensions[1] / 2, ...bckgDimensions);
                        ctx.lineWidth = 2/globalScale;
                        ctx.strokeStyle = '#000';
                        ctx.strokeRect(node.x - bckgDimensions[0] / 2, node.y - bckgDimensions[1] / 2, ...bckgDimensions);

                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.fillStyle = '#1a1a1a';
                        ctx.fillText(label, node.x, node.y);
                    }}
                />
            ) : (
                <div className="flex flex-col items-center justify-center h-full opacity-10 pointer-events-none">
                    <span className="font-heading text-[10vw] uppercase -rotate-6 tracking-tighter">Structure</span>
                </div>
            )}
        </div>
      </main>
    </div>
  );
}


