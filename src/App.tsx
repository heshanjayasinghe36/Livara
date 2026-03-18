import { Routes, Route, Navigate } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Editor2D from "./pages/Editor2D";
import Viewer3D from "./pages/Viewer3D";
import DesignsGallery from "./pages/DesignsGallery";
import AdminLogin from "./admin/AdminLogin";
import AdminDashboard from "./admin/AdminDashboard";
import LandingPage from "./pages/LandingPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/admin/dashboard" element={<AdminDashboard />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/editor-2d" element={<Editor2D />} />
      <Route path="/viewer-3d" element={<Viewer3D />} />
      <Route path="/designs" element={<DesignsGallery />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}