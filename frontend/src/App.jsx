import { Routes, Route, Navigate } from "react-router-dom";
import Dashboard from "./pages/Dashboard";


import Analyzer from "./pages/Analyzer";
import Login from "./pages/Login";
import Register from "./pages/Register";

import ProtectedRoute from "./routes/ProtectedRoute";

function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/analyzer"
        element={
          <ProtectedRoute>
            <Analyzer />
          </ProtectedRoute>
        }
      />
      {/* Chat is now integrated into Analyzer Step 5 */}
      <Route path="/chat" element={<Navigate to="/analyzer" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
    </Routes>
  );
}


export default App;