import { useEffect, useState } from "react";

function App() {
  const [djangoData, setDjangoData] = useState("");
  const [fastapiData, setFastapiData] = useState("");

  useEffect(() => {
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
  }, []);

  return (
    <div>
      <h1>Full Stack Connection 🚀</h1>

      <h2>Django:</h2>
      <p>{djangoData}</p>

      <h2>FastAPI:</h2>
      <p>{fastapiData}</p>

      <h1 class="text-3xl font-bold underline">
        Hello world!
      </h1>
    </div>
  );
}

export default App;