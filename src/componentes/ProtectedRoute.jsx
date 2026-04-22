import { Navigate } from "react-router-dom";

const LOGIN_KEY = "abarrotes_garcia_logged";

export default function ProtectedRoute({ children }) {
  const autenticado = localStorage.getItem(LOGIN_KEY) === "true";

  if (!autenticado) {
    return <Navigate to="/login" replace />;
  }

  return children;
}