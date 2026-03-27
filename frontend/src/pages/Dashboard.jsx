import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { authService } from "../api/auth";

export default function Dashboard() {
  const [djangoData, setDjangoData] = useState("");
  const [fastapiData, setFastapiData] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    if (!authService.isAuthenticated()) {
      navigate("/login");
      return;
    }

    // Django API
    fetch("http://127.0.0.1:8000/api/test/")
      .then((res) => res.json())
      .then((data) => {
        setDjangoData(data.message);
      })
      .catch((err) => console.error("Django error:", err));

    // FastAPI API
    fetch("http://127.0.0.1:8001/ai/test/")
      .then((res) => res.json())
      .then((data) => {
        setFastapiData(data.message);
      })
      .catch((err) => console.error("FastAPI error:", err));
  }, [navigate]);

  const handleLogout = () => {
    authService.logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-12">
          <h1 className="text-4xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-emerald-400">
            CRAB Dashboard 🚀
          </h1>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20 transition-colors border border-red-500/20"
          >
            Logout
          </button>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700 backdrop-blur-sm shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse"></div>
              <h2 className="text-2xl font-bold text-slate-200">Django Backend</h2>
            </div>
            <p className="text-slate-400 font-mono bg-slate-900 p-4 rounded-lg">
              {djangoData || "Connecting..."}
            </p>
          </div>

          <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700 backdrop-blur-sm shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></div>
              <h2 className="text-2xl font-bold text-slate-200">FastAPI AI Engine</h2>
            </div>
            <p className="text-slate-400 font-mono bg-slate-900 p-4 rounded-lg">
              {fastapiData || "Connecting..."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
