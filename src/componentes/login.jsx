import { useState } from "react";
import { useNavigate } from "react-router-dom";

const LOGIN_KEY = "abarrotes_garcia_logged";
const PASSWORD = "197365"; // cámbiala por la que tú quieras

export default function Login() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const iniciarSesion = (e) => {
    e.preventDefault();

    if (password === PASSWORD) {
      localStorage.setItem(LOGIN_KEY, "true");
      navigate("/");
    } else {
      setError("Contraseña incorrecta");
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0f172a",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: "20px",
        boxSizing: "border-box",
      }}
    >
      <form
        onSubmit={iniciarSesion}
        style={{
          width: "100%",
          maxWidth: "420px",
          background: "#ffffff",
          borderRadius: "18px",
          padding: "32px",
          boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
        }}
      >
        <h1
          style={{
            margin: "0 0 10px 0",
            textAlign: "center",
            fontSize: "28px",
            color: "#111827",
          }}
        >
          ABARROTES GARCIA
        </h1>

        <p
          style={{
            margin: "0 0 24px 0",
            textAlign: "center",
            color: "#6b7280",
            fontSize: "15px",
          }}
        >
          Ingresa la contraseña para entrar al sistema
        </p>

        <label
          style={{
            display: "block",
            marginBottom: "8px",
            color: "#111827",
            fontWeight: "600",
          }}
        >
          Contraseña
        </label>

        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Escribe tu contraseña"
          style={{
            width: "100%",
            padding: "12px 14px",
            borderRadius: "10px",
            border: "1px solid #d1d5db",
            fontSize: "16px",
            marginBottom: "16px",
            boxSizing: "border-box",
            outline: "none",
          }}
        />

        {error ? (
          <div
            style={{
              background: "#fee2e2",
              color: "#b91c1c",
              padding: "10px 12px",
              borderRadius: "10px",
              marginBottom: "16px",
              fontSize: "14px",
            }}
          >
            {error}
          </div>
        ) : null}

        <button
          type="submit"
          style={{
            width: "100%",
            padding: "13px",
            border: "none",
            borderRadius: "10px",
            background: "#2563eb",
            color: "#ffffff",
            fontSize: "16px",
            fontWeight: "700",
            cursor: "pointer",
          }}
        >
          Entrar
        </button>
      </form>
    </div>
  );
}