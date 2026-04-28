import { useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { supabase } from "./supabase";

export default function ScannerInventario() {
  const [codigo, setCodigo] = useState("");
  const [producto, setProducto] = useState(null);
  const [mensaje, setMensaje] = useState("Escanea un producto");
  const [scanning, setScanning] = useState(false);

  const buscarProducto = async (codigoEscaneado) => {
    setCodigo(codigoEscaneado);
    setMensaje("Buscando producto...");
    setProducto(null);

    const { data, error } = await supabase
      .from("eleventa_inventario")
      .select("*")
      .limit(5000);

    if (error) {
      setMensaje("Error: " + error.message);
      return;
    }

    const limpio = String(codigoEscaneado).trim();

    const encontrado = data?.find((p) =>
      Object.values(p).some((v) => String(v ?? "").trim() === limpio)
    );

    if (!encontrado) {
      setMensaje("No encontrado en inventario");
      return;
    }

    setProducto(encontrado);
    setMensaje("Producto encontrado");
  };

  const iniciarScanner = async () => {
    setScanning(true);
    setProducto(null);
    setCodigo("");
    setMensaje("Apunta al código de barras");

    setTimeout(async () => {
      const scanner = new Html5Qrcode("reader");

      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: 260 },
        async (decodedText) => {
          await scanner.stop();
          setScanning(false);
          buscarProducto(decodedText);
        }
      );
    }, 300);
  };

  const nombre =
    producto?.descripcion ||
    producto?.producto_nombre ||
    producto?.nombre ||
    producto?.DESCRIPCION ||
    "Producto sin nombre";

  const costo =
    producto?.precio_costo ||
    producto?.costo ||
    producto?.precio_compra ||
    producto?.PRECIO_USADO ||
    0;

  const venta =
    producto?.precio_venta ||
    producto?.precio ||
    producto?.PRECIO_FINAL ||
    0;

  const stock =
    producto?.existencia ||
    producto?.stock ||
    producto?.inventario ||
    producto?.EXISTENCIA ||
    0;

  return (
    <div style={styles.page}>
      <h1 style={styles.title}>Escáner Inventario</h1>

      <button onClick={iniciarScanner} style={styles.button}>
        Escanear código
      </button>

      {scanning && <div id="reader" style={styles.reader}></div>}

      <div style={styles.card}>
        <div style={styles.code}>{codigo || "Sin código"}</div>
        <div style={styles.msg}>{mensaje}</div>

        {producto && (
          <>
            <h2 style={styles.name}>{nombre}</h2>
            <p style={styles.cost}>Costo: ${Number(costo || 0).toFixed(2)}</p>
            <p style={styles.sale}>Venta: ${Number(venta || 0).toFixed(2)}</p>
            <p style={styles.stock}>Inventario: {Number(stock || 0)} pzas</p>
          </>
        )}
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#070d19",
    color: "white",
    padding: 24,
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI",
  },
  title: {
    fontSize: 30,
    fontWeight: 900,
    marginBottom: 24,
  },
  button: {
    background: "#2563eb",
    color: "white",
    border: "none",
    borderRadius: 14,
    padding: "16px 22px",
    fontSize: 16,
    fontWeight: 800,
    marginBottom: 24,
  },
  reader: {
    width: "100%",
    maxWidth: 420,
    marginBottom: 24,
    borderRadius: 20,
    overflow: "hidden",
  },
  card: {
    background: "#111827",
    borderRadius: 22,
    padding: 24,
  },
  code: {
    color: "#60a5fa",
    fontSize: 20,
    fontWeight: 800,
    marginBottom: 8,
  },
  msg: {
    color: "#cbd5e1",
    fontSize: 18,
    marginBottom: 18,
  },
  name: {
    fontSize: 24,
    marginBottom: 12,
  },
  cost: {
    color: "#22c55e",
    fontSize: 20,
    fontWeight: 800,
  },
  sale: {
    color: "#3b82f6",
    fontSize: 20,
    fontWeight: 800,
  },
  stock: {
    color: "#a855f7",
    fontSize: 20,
    fontWeight: 800,
  },
};