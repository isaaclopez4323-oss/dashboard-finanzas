import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Dashboard from "./componentes/Dashboard";
import DashboardVentas from "./componentes/ventas/DashboardVentas";
import RH from "./componentes/rh/RHDashboard";
import Home from "./componentes/Home";
import Login from "./componentes/login";
import ProtectedRoute from "./componentes/ProtectedRoute";
import InventarioDashboard from "./componentes/inventario/InventarioDashboard";
import ScannerInventario from "./pages/ScannerInventario";

<Route path="/scanner" element={<ScannerInventario />} />

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Home />
            </ProtectedRoute>
          }
        />
<Route
  path="/inventario"
  element={
    <ProtectedRoute>
      <InventarioDashboard />
    </ProtectedRoute>
  }
/>
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/rh"
          element={
            <ProtectedRoute>
              <RH />
            </ProtectedRoute>
          }
        />

        <Route
          path="/dashboard-ventas"
          element={
            <ProtectedRoute>
              <DashboardVentas />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}