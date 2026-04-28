import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { supabase } from "./supabase";

export default function ScannerInventario() {
  const scannerRef = useRef(null);
  const [codigo, setCodigo] = useState("");
  const [producto, setProducto] = useState(null);
  const [scanning, setScanning] = useState(false);

  const iniciarScanner = async () => {
    const scanner = new Html5Qrcode("reader");

    scannerRef.current = scanner;

    await scanner.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: 250 },
      async (decodedText) => {
        await scanner.stop();
        setScanning(false);
        buscarProducto(decodedText);
      }
    );
  };

  const buscarProducto = async (codigoEscaneado) => {
    setCodigo(codigoEscaneado);

    const { data } = await supabase
      .from("eleventa_inventario")
      .select("*")
      .limit(1);

    // 🔥 BUSCA MANUALMENTE (evita errores de columnas)
    const encontrado = data?.find((p) =>
      Object.values(p).some((v) =>
        String(v).includes(codigoEscaneado)
      )
    );

    setProducto(encontrado || null);
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Escáner Inventario</h1>

      {scanning && <div id="reader" style={styles.camera} />}

      {!scanning && (
        <button style={styles.button} onClick={() => {
          setProducto(null);
          setCodigo("");
          setScanning(true);
          setTimeout(iniciarScanner, 300);
        }}>
          Escanear código
        </button>
      )}

      <div style={styles.card}>
        <p style={styles.codigo}>{codigo || "Sin escanear"}</p>

        {producto ? (
          <>
            <h2>{producto.descripcion || producto.producto_nombre}</h2>

            <p style={{ color: "#22c55e" }}>
              Costo: ${producto.precio_costo || producto.PRECIO_USADO || 0}
            </p>

            <p style={{ color: "#3b82f6" }}>
              Venta: ${producto.precio_venta || producto.PRECIO_FINAL || 0}
            </p>

            <p style={{ color: "#a855f7" }}>
              Stock: {producto.existencia || producto.EXISTENCIA || 0}
            </p>
          </>
        ) : (
          <p style={{ color: "#aaa" }}>
            Escanea un producto
          </p>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: "100vh",
    background: "#0a0f1c",
    color: "white",
    padding: "20px",
  },
  title: {
    fontSize: "28px",
    marginBottom: "20px",
  },
  camera: {
    width: "100%",
    maxWidth: "400px",
    margin: "auto",
  },
  button: {
    padding: "15px",
    background: "#2563eb",
    color: "white",
    borderRadius: "10px",
    border: "none",
    marginBottom: "20px",
  },
  card: {
    background: "#111827",
    padding: "20px",
    borderRadius: "15px",
  },
  codigo: {
    color: "#60a5fa",
  },
};