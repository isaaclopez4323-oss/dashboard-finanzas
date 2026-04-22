import { useMemo, useRef, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import { FlujoChart, TarjetaChart } from "./Charts";
import RecentTransactions from "./RecentTransactions";
import { supabase } from "../supabase";

const TARJETAS_CREDITO = [
  "American Express Platinum Credit Card",
  "American Express Gold Card",
  "Banamex Costco",
];

const IMAGEN_TARJETAS = {
  "American Express Platinum Credit Card": "/amex-platinum.png",
  "American Express Gold Card": "/amex-gold.png",
  "Banamex Costco": "/banamex-costco.png",
};

const LOGIN_KEY = "abarrotes_garcia_logged";

function obtenerFechaHoraLocal() {
  const ahora = new Date();
  const year = ahora.getFullYear();
  const month = String(ahora.getMonth() + 1).padStart(2, "0");
  const day = String(ahora.getDate()).padStart(2, "0");
  const hours = String(ahora.getHours()).padStart(2, "0");
  const minutes = String(ahora.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function crearTransaccionInicial() {
  return {
    tipo: "ingreso",
    metodo: "efectivo",
    categoria: "",
    monto: "",
    fecha: obtenerFechaHoraLocal(),
    tarjetaCredito: "",
    fuentePago: "efectivo",
  };
}

function formatearMoneda(valor) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(Number(valor || 0));
}

function obtenerInicioSemana(fecha) {
  const f = new Date(fecha);
  const dia = f.getDay();
  const diff = dia === 0 ? -6 : 1 - dia;
  f.setDate(f.getDate() + diff);
  f.setHours(0, 0, 0, 0);
  return f;
}

function obtenerFinSemana(fecha) {
  const inicio = obtenerInicioSemana(fecha);
  const fin = new Date(inicio);
  fin.setDate(fin.getDate() + 6);
  fin.setHours(23, 59, 59, 999);
  return fin;
}

function normalizarTexto(valor) {
  return String(valor || "").trim().toLowerCase();
}

function normalizarMetodo(valor) {
  const v = normalizarTexto(valor);
  if (v.includes("efect")) return "efectivo";
  if (v.includes("debit")) return "debito";
  if (v.includes("credit")) return "credito";
  return v || "efectivo";
}

function normalizarTipo(valor) {
  const v = normalizarTexto(valor);
  if (v.includes("ingre")) return "ingreso";
  if (v.includes("gasto")) return "gasto";
  if (v.includes("pago")) return "pago_tarjeta";
  return v || "ingreso";
}

function excelFechaAISO(valor) {
  if (typeof valor === "number") {
    const fecha = XLSX.SSF.parse_date_code(valor);
    if (!fecha) return obtenerFechaHoraLocal();

    const year = fecha.y;
    const month = String(fecha.m).padStart(2, "0");
    const day = String(fecha.d).padStart(2, "0");
    const hour = String(fecha.H || 0).padStart(2, "0");
    const minute = String(fecha.M || 0).padStart(2, "0");

    return `${year}-${month}-${day}T${hour}:${minute}`;
  }

  if (!valor) return obtenerFechaHoraLocal();

  const texto = String(valor).trim();

  if (/^\d{4}-\d{2}-\d{2}/.test(texto)) {
    if (texto.length === 10) return `${texto}T00:00`;
    return texto.slice(0, 16);
  }

  const partes = texto.split(/[\/\-\s:]+/);
  if (partes.length >= 3) {
    const [a, b, c, d = "00", e = "00"] = partes;

    if (String(c).length === 4) {
      const day = String(a).padStart(2, "0");
      const month = String(b).padStart(2, "0");
      const year = String(c);
      return `${year}-${month}-${day}T${String(d).padStart(2, "0")}:${String(
        e
      ).padStart(2, "0")}`;
    }
  }

  const fecha = new Date(texto);
  if (!Number.isNaN(fecha.getTime())) {
    const year = fecha.getFullYear();
    const month = String(fecha.getMonth() + 1).padStart(2, "0");
    const day = String(fecha.getDate()).padStart(2, "0");
    const hour = String(fecha.getHours()).padStart(2, "0");
    const minute = String(fecha.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day}T${hour}:${minute}`;
  }

  return obtenerFechaHoraLocal();
}

function convertirFilaExcelATransaccion(fila, index) {
  const filaNormalizada = {};

  Object.keys(fila || {}).forEach((clave) => {
    filaNormalizada[normalizarTexto(clave)] = fila[clave];
  });

  const tipo =
    filaNormalizada.tipo ??
    filaNormalizada.movimiento ??
    filaNormalizada["tipo de movimiento"];

  const metodo =
    filaNormalizada.metodo ??
    filaNormalizada.método ??
    filaNormalizada["metodo de pago"] ??
    filaNormalizada["medio de pago"];

  const categoria =
    filaNormalizada.categoria ??
    filaNormalizada.categoría ??
    filaNormalizada.concepto ??
    filaNormalizada.descripcion ??
    filaNormalizada.descripción ??
    "";

  const monto =
    filaNormalizada.monto ??
    filaNormalizada.importe ??
    filaNormalizada.total ??
    0;

  const fecha =
    filaNormalizada.fecha ??
    filaNormalizada["fecha y hora"] ??
    filaNormalizada.fechahora ??
    filaNormalizada.datetime ??
    filaNormalizada.createdat;

  const tarjetaCredito =
    filaNormalizada.tarjetacredito ??
    filaNormalizada["tarjeta credito"] ??
    filaNormalizada["tarjeta de credito"] ??
    filaNormalizada.tarjeta ??
    "";

  const fuentePago =
    filaNormalizada.fuentepago ??
    filaNormalizada["fuente pago"] ??
    filaNormalizada["fuente de pago"] ??
    "";

  return {
    id: `tmp-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
    tipo: normalizarTipo(tipo),
    metodo: normalizarMetodo(metodo),
    categoria: String(categoria || "").trim(),
    monto: Number(String(monto || 0).replace(/[^0-9.-]/g, "")) || 0,
    fecha: excelFechaAISO(fecha),
    tarjetaCredito: String(tarjetaCredito || "").trim(),
    fuentePago: fuentePago ? normalizarMetodo(fuentePago) : "",
  };
}

function dividirFechaHora(fechaISO) {
  if (!fechaISO) {
    const ahora = obtenerFechaHoraLocal();
    return {
      fecha: ahora.slice(0, 10),
      hora: ahora.slice(11, 16),
    };
  }

  const texto = String(fechaISO);

  return {
    fecha: texto.slice(0, 10),
    hora: texto.slice(11, 16) || "00:00",
  };
}

function deSupabaseATransaccion(row) {
  const hora = row?.hora || "00:00";

  return {
    id: row.id,
    tipo: row.tipo || "ingreso",
    metodo: row.metodo || "efectivo",
    categoria: row.categoria || "",
    monto: Number(row.monto || 0),
    fecha: `${row.fecha}T${hora}`,
    tarjetaCredito: row.tarjeta_credito || "",
    fuentePago: row.fuente_pago || "",
  };
}

function aSupabasePayload(transaccion) {
  const { fecha, hora } = dividirFechaHora(transaccion.fecha);

  return {
    tipo: transaccion.tipo,
    metodo: transaccion.metodo,
    categoria: transaccion.categoria,
    monto: Number(transaccion.monto || 0),
    fecha,
    hora,
    tarjeta_credito: transaccion.tarjetaCredito || null,
    fuente_pago: transaccion.fuentePago || null,
  };
}

function ordenarTransacciones(lista) {
  return [...lista].sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
}

function formatearFechaBonita(fecha = new Date()) {
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(fecha);
}

function SummaryMiniCard({
  titulo,
  valor,
  subtitulo,
  destacado = false,
  color = "#ffffff",
}) {
  return (
    <div
      style={{
        background: destacado
          ? "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)"
          : "rgba(255,255,255,0.04)",
        border: destacado
          ? "1px solid rgba(96,165,250,0.4)"
          : "1px solid rgba(148,163,184,0.12)",
        borderRadius: "22px",
        padding: "22px 18px",
        minHeight: "138px",
        boxShadow: destacado
          ? "0 16px 30px rgba(37,99,235,0.24)"
          : "0 8px 24px rgba(0,0,0,0.18)",
      }}
    >
      <div
        style={{
          color: destacado
            ? "rgba(255,255,255,0.9)"
            : "rgba(226,232,240,0.72)",
          fontSize: "14px",
          fontWeight: 700,
          marginBottom: 12,
        }}
      >
        {titulo}
      </div>

      <div
        style={{
          color: destacado ? "#ffffff" : color,
          fontSize: "2rem",
          fontWeight: 900,
          lineHeight: 1.1,
          letterSpacing: "-0.03em",
        }}
      >
        {valor}
      </div>

      {subtitulo ? (
        <div
          style={{
            marginTop: 10,
            color: destacado
              ? "rgba(255,255,255,0.82)"
              : "rgba(226,232,240,0.58)",
            fontSize: "13px",
          }}
        >
          {subtitulo}
        </div>
      ) : null}
    </div>
  );
}

function IndicadorCard({ icono, titulo, valor, color }) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(148,163,184,0.12)",
        borderRadius: "24px",
        padding: "26px",
        boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
      }}
    >
      <div
        style={{
          width: 62,
          height: 62,
          borderRadius: 18,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: color,
          fontSize: "1.8rem",
          marginBottom: 18,
        }}
      >
        {icono}
      </div>

      <div style={{ color: "rgba(226,232,240,0.72)", fontSize: "15px" }}>
        {titulo}
      </div>

      <div
        style={{
          marginTop: 10,
          fontSize: "2.35rem",
          fontWeight: 900,
          color: "#ffffff",
          lineHeight: 1.05,
          letterSpacing: "-0.03em",
        }}
      >
        {valor}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();

  const [loggedIn, setLoggedIn] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(LOGIN_KEY) === "true";
  });

  const [filtroPeriodo, setFiltroPeriodo] = useState("todo");
  const [mostrarModal, setMostrarModal] = useState(false);
  const [transacciones, setTransacciones] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [sincronizando, setSincronizando] = useState(false);
  const [nuevaTransaccion, setNuevaTransaccion] = useState(
    crearTransaccionInicial
  );

  const inputExcelRef = useRef(null);

  useEffect(() => {
    if (!loggedIn) {
      setCargando(false);
      return;
    }

    cargarTransacciones();
  }, [loggedIn]);

  useEffect(() => {
    if (nuevaTransaccion.tipo === "pago_tarjeta") {
      setNuevaTransaccion((prev) => ({
        ...prev,
        metodo: "credito",
      }));
    }
  }, [nuevaTransaccion.tipo]);

  async function cargarTransacciones() {
    try {
      setCargando(true);

      const { data, error } = await supabase
        .from("movimientos")
        .select("*")
        .order("fecha", { ascending: false })
        .order("hora", { ascending: false });

      if (error) throw error;

      setTransacciones(
        ordenarTransacciones((data || []).map(deSupabaseATransaccion))
      );
    } catch (error) {
      console.error(error);
      alert("No se pudieron cargar los movimientos desde la nube.");
    } finally {
      setCargando(false);
    }
  }

  const transaccionesFiltradas = useMemo(() => {
    const hoy = new Date();

    return transacciones.filter((t) => {
      const fecha = new Date(t.fecha);
      if (Number.isNaN(fecha.getTime())) return false;

      switch (filtroPeriodo) {
        case "hoy":
          return (
            fecha.getDate() === hoy.getDate() &&
            fecha.getMonth() === hoy.getMonth() &&
            fecha.getFullYear() === hoy.getFullYear()
          );

        case "semanal": {
          const inicio = obtenerInicioSemana(hoy);
          const fin = obtenerFinSemana(hoy);
          return fecha >= inicio && fecha <= fin;
        }

        case "mensual":
          return (
            fecha.getMonth() === hoy.getMonth() &&
            fecha.getFullYear() === hoy.getFullYear()
          );

        case "anual":
          return fecha.getFullYear() === hoy.getFullYear();

        default:
          return true;
      }
    });
  }, [transacciones, filtroPeriodo]);

  const resumen = useMemo(() => {
    let ingresos = 0;
    let gastos = 0;
    let utilidadEfectivo = 0;
    let utilidadDebito = 0;
    let utilidadCredito = 0;
    let deudaTotalTarjetas = 0;

    const deudaPorTarjeta = {};
    TARJETAS_CREDITO.forEach((tarjeta) => {
      deudaPorTarjeta[tarjeta] = 0;
    });

    transaccionesFiltradas.forEach((t) => {
      const monto = Number(t.monto) || 0;

      if (t.tipo === "ingreso") {
        ingresos += monto;

        if (t.metodo === "efectivo") utilidadEfectivo += monto;
        if (t.metodo === "debito") utilidadDebito += monto;
        if (t.metodo === "credito") utilidadCredito += monto;
      }

      if (t.tipo === "gasto") {
        gastos += monto;

        if (t.metodo === "efectivo") utilidadEfectivo -= monto;
        if (t.metodo === "debito") utilidadDebito -= monto;
        if (t.metodo === "credito") {
          utilidadCredito -= monto;

          if (t.tarjetaCredito) {
            deudaPorTarjeta[t.tarjetaCredito] =
              (deudaPorTarjeta[t.tarjetaCredito] || 0) + monto;
            deudaTotalTarjetas += monto;
          }
        }
      }

      if (t.tipo === "pago_tarjeta") {
        if (t.fuentePago === "efectivo") utilidadEfectivo -= monto;
        if (t.fuentePago === "debito") utilidadDebito -= monto;

        if (t.tarjetaCredito) {
          deudaPorTarjeta[t.tarjetaCredito] =
            (deudaPorTarjeta[t.tarjetaCredito] || 0) - monto;
          deudaTotalTarjetas -= monto;
        }
      }
    });

    return {
      ingresos,
      gastos,
      utilidadTotal: ingresos - gastos,
      utilidadEfectivo,
      utilidadDebito,
      utilidadCredito,
      deudaTotalTarjetas,
      deudaPorTarjeta,
    };
  }, [transaccionesFiltradas]);

  function cerrarSesion() {
    if (typeof window !== "undefined") {
      localStorage.removeItem(LOGIN_KEY);
    }
    setLoggedIn(false);
  }

  function abrirImportadorExcel() {
    inputExcelRef.current?.click();
  }

  function limpiarFormulario() {
    setNuevaTransaccion(crearTransaccionInicial());
  }

  async function agregarTransaccion(e) {
    e.preventDefault();

    const montoNumero = Number(nuevaTransaccion.monto);

    if (!nuevaTransaccion.categoria.trim()) {
      alert("Escribe una categoría.");
      return;
    }

    if (!montoNumero || montoNumero <= 0) {
      alert("Escribe un monto válido.");
      return;
    }

    if (
      nuevaTransaccion.metodo === "credito" &&
      nuevaTransaccion.tipo !== "pago_tarjeta" &&
      !nuevaTransaccion.tarjetaCredito
    ) {
      alert("Selecciona una tarjeta de crédito.");
      return;
    }

    if (
      nuevaTransaccion.tipo === "pago_tarjeta" &&
      !nuevaTransaccion.tarjetaCredito
    ) {
      alert("Selecciona la tarjeta que vas a pagar.");
      return;
    }

    try {
      setSincronizando(true);

      const payload = aSupabasePayload({
        ...nuevaTransaccion,
        monto: montoNumero,
      });

      const { data, error } = await supabase
        .from("movimientos")
        .insert([payload])
        .select()
        .single();

      if (error) throw error;

      setTransacciones((prev) =>
        ordenarTransacciones([deSupabaseATransaccion(data), ...prev])
      );

      setMostrarModal(false);
      limpiarFormulario();
    } catch (error) {
      console.error(error);
      alert("No se pudo guardar la transacción en la nube.");
    } finally {
      setSincronizando(false);
    }
  }

  async function eliminarTransaccion(id) {
    const confirmar = window.confirm(
      "¿Seguro que quieres eliminar este movimiento?"
    );
    if (!confirmar) return;

    try {
      setSincronizando(true);

      const { error } = await supabase.from("movimientos").delete().eq("id", id);

      if (error) throw error;

      setTransacciones((prev) => prev.filter((t) => t.id !== id));
    } catch (error) {
      console.error(error);
      alert("No se pudo eliminar el movimiento.");
    } finally {
      setSincronizando(false);
    }
  }

  function exportarExcel() {
    const datos = transaccionesFiltradas.map((t) => ({
      id: t.id,
      tipo: t.tipo,
      metodo: t.metodo,
      categoria: t.categoria,
      monto: t.monto,
      fecha: t.fecha,
      tarjetaCredito: t.tarjetaCredito || "",
      fuentePago: t.fuentePago || "",
    }));

    const hoja = XLSX.utils.json_to_sheet(datos);
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, "Transacciones");

    XLSX.writeFile(libro, `abarrotes-garcia-${filtroPeriodo}.xlsx`);
  }

  async function importarExcel(event) {
    const archivo = event.target.files?.[0];
    if (!archivo) return;

    const lector = new FileReader();

    lector.onload = async (e) => {
      try {
        setSincronizando(true);

        const resultado = e.target?.result;
        if (!resultado) throw new Error("No se pudo leer el archivo.");

        const data = new Uint8Array(resultado);
        const workbook = XLSX.read(data, { type: "array" });
        const nombreHoja = workbook.SheetNames[0];
        const hoja = workbook.Sheets[nombreHoja];
        const filas = XLSX.utils.sheet_to_json(hoja, { defval: "" });

        if (!filas.length) {
          alert("El archivo Excel está vacío.");
          return;
        }

        const importadas = filas.map((fila, index) =>
          convertirFilaExcelATransaccion(fila, index)
        );

        const validas = importadas.filter(
          (t) =>
            t.tipo &&
            t.metodo &&
            t.categoria !== "" &&
            !Number.isNaN(t.monto) &&
            t.monto > 0 &&
            t.fecha
        );

        if (!validas.length) {
          alert("No se encontraron filas válidas para importar.");
          return;
        }

        const confirmar = window.confirm(
          `Se importarán ${validas.length} movimientos.\n\nEsto reemplazará todos los movimientos actuales en la nube.\n\n¿Deseas continuar?`
        );

        if (!confirmar) return;

        const { error: deleteError } = await supabase
          .from("movimientos")
          .delete()
          .not("id", "is", null);

        if (deleteError) throw deleteError;

        const payload = validas.map(aSupabasePayload);

        const { data: insertados, error: insertError } = await supabase
          .from("movimientos")
          .insert(payload)
          .select();

        if (insertError) throw insertError;

        setTransacciones(
          ordenarTransacciones((insertados || []).map(deSupabaseATransaccion))
        );

        alert("Movimientos importados correctamente a la nube.");
      } catch (error) {
        console.error(error);
        alert("No se pudo importar el archivo Excel.");
      } finally {
        event.target.value = "";
        setSincronizando(false);
      }
    };

    lector.onerror = () => {
      alert("Ocurrió un error al leer el archivo.");
      event.target.value = "";
      setSincronizando(false);
    };

    lector.readAsArrayBuffer(archivo);
  }

  if (!loggedIn) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#071225",
          padding: "20px",
        }}
      >
        <div
          style={{
            background: "rgba(9,20,43,0.95)",
            width: "100%",
            maxWidth: "430px",
            borderRadius: "28px",
            padding: "32px",
            border: "1px solid rgba(148,163,184,0.18)",
            boxShadow: "0 20px 50px rgba(0,0,0,0.35)",
            textAlign: "center",
            color: "#fff",
          }}
        >
          <img
            src="/logo.png"
            alt="Logo"
            style={{
              width: 90,
              height: 90,
              objectFit: "contain",
              marginBottom: 16,
            }}
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />

          <h1 style={{ margin: 0, fontSize: "2rem", color: "#ffffff" }}>
            ABARROTES GARCIA
          </h1>

          <p style={{ color: "rgba(226,232,240,0.7)", marginTop: 8 }}>
            Entrar al dashboard financiero
          </p>

          <button
            onClick={() => {
              if (typeof window !== "undefined") {
                localStorage.setItem(LOGIN_KEY, "true");
              }
              setLoggedIn(true);
            }}
            style={{
              marginTop: 16,
              width: "100%",
              background: "linear-gradient(135deg, #22c55e 0%, #15803d 100%)",
              color: "white",
              border: "none",
              borderRadius: "16px",
              padding: "14px 18px",
              fontSize: "1rem",
              fontWeight: "700",
              cursor: "pointer",
            }}
          >
            Entrar
          </button>
        </div>
      </div>
    );
  }

  if (cargando) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#071225",
          color: "white",
          fontSize: "1.2rem",
          fontWeight: 700,
        }}
      >
        Cargando movimientos desde la nube...
      </div>
    );
  }

  const infoTop = [
    `Última actualización: ${formatearFechaBonita(new Date())}`,
    sincronizando ? "Estado: sincronizando..." : "Estado: listo",
    `Periodo: ${String(filtroPeriodo).toUpperCase()}`,
    `Movimientos: ${transaccionesFiltradas.length}`,
  ];

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top, #0f274f 0%, #08152d 45%, #050d1f 100%)",
        padding: "18px 14px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "1280px",
          margin: "0 auto",
          minHeight: "100vh",
        }}
      >
        <div
          style={{
            background: "rgba(9, 20, 43, 0.92)",
            border: "1px solid rgba(148, 163, 184, 0.18)",
            borderRadius: "32px",
            padding: "16px",
            boxShadow: "0 25px 60px rgba(0,0,0,0.35)",
          }}
        >
          <div
            style={{
              background:
                "linear-gradient(180deg, rgba(21,33,63,0.98) 0%, rgba(17,27,53,0.98) 100%)",
              border: "1px solid rgba(148,163,184,0.16)",
              borderRadius: "30px",
              padding: "28px",
              marginBottom: "18px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: "16px",
                flexWrap: "wrap",
                marginBottom: "18px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  gap: "16px",
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <div
                  style={{
                    width: 78,
                    height: 78,
                    borderRadius: 22,
                    background:
                      "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "2rem",
                    color: "#fff",
                    fontWeight: 900,
                    boxShadow: "0 14px 28px rgba(37,99,235,0.25)",
                  }}
                >
                  $
                </div>

                <div>
                  <div
                    style={{
                      fontSize: "13px",
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: "rgba(226,232,240,0.72)",
                      fontWeight: 800,
                      marginBottom: 8,
                    }}
                  >
                    Dashboard de Finanzas
                  </div>

                  <h1
                    style={{
                      margin: 0,
                      fontSize: "clamp(2.1rem, 4vw, 3.5rem)",
                      color: "#ffffff",
                      fontWeight: 900,
                      lineHeight: 1,
                      letterSpacing: "-0.03em",
                    }}
                  >
                    ABARROTES GARCIA
                  </h1>

                  <div
                    style={{
                      fontSize: "1rem",
                      color: "rgba(226,232,240,0.78)",
                      marginTop: 8,
                    }}
                  >
                    Gestión de ingresos, egresos y reportes financieros
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                <button
                  onClick={() => navigate("/")}
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    color: "#fff",
                    border: "1px solid rgba(148,163,184,0.18)",
                    borderRadius: "16px",
                    padding: "14px 18px",
                    fontWeight: "700",
                    cursor: "pointer",
                  }}
                >
                  ← Inicio
                </button>

                <button
                  onClick={cerrarSesion}
                  style={{
                    background: "rgba(127,29,29,0.14)",
                    color: "white",
                    border: "1px solid rgba(248,113,113,0.45)",
                    borderRadius: "16px",
                    padding: "14px 22px",
                    fontWeight: "700",
                    fontSize: "1rem",
                    cursor: "pointer",
                    boxShadow: "0 10px 25px rgba(0,0,0,0.18)",
                  }}
                >
                  Cerrar sesión
                </button>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "12px",
                marginBottom: "16px",
              }}
            >
              {[
                { key: "hoy", label: "HOY" },
                { key: "semanal", label: "SEMANAL" },
                { key: "mensual", label: "MENSUAL" },
                { key: "anual", label: "ANUAL" },
                { key: "todo", label: "TODO" },
              ].map((item) => (
                <button
                  key={item.key}
                  onClick={() => setFiltroPeriodo(item.key)}
                  style={{
                    background:
                      filtroPeriodo === item.key
                        ? "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)"
                        : "rgba(255,255,255,0.08)",
                    color: "#ffffff",
                    border:
                      filtroPeriodo === item.key
                        ? "1px solid rgba(96,165,250,0.35)"
                        : "1px solid rgba(148,163,184,0.12)",
                    borderRadius: "999px",
                    padding: "13px 18px",
                    fontWeight: "800",
                    cursor: "pointer",
                    fontSize: "0.92rem",
                  }}
                >
                  {item.label}
                </button>
              ))}

              <button
                onClick={exportarExcel}
                style={{
                  background:
                    "linear-gradient(135deg, #16a34a 0%, #15803d 100%)",
                  color: "white",
                  border: "none",
                  borderRadius: "999px",
                  padding: "13px 18px",
                  fontWeight: "800",
                  cursor: "pointer",
                  fontSize: "0.92rem",
                }}
              >
                EXPORTAR A EXCEL
              </button>

              <button
                onClick={abrirImportadorExcel}
                style={{
                  background:
                    "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
                  color: "white",
                  border: "none",
                  borderRadius: "999px",
                  padding: "13px 18px",
                  fontWeight: "800",
                  cursor: "pointer",
                  fontSize: "0.92rem",
                }}
              >
                IMPORTAR DESDE EXCEL
              </button>

              <button
                onClick={() => setMostrarModal(true)}
                style={{
                  background:
                    "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
                  color: "white",
                  border: "none",
                  borderRadius: "999px",
                  padding: "13px 20px",
                  fontWeight: "900",
                  cursor: "pointer",
                  fontSize: "0.92rem",
                }}
              >
                + NUEVA TRANSACCIÓN
              </button>

              <input
                ref={inputExcelRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={importarExcel}
                style={{ display: "none" }}
              />
            </div>

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "14px",
                color: "rgba(226,232,240,0.72)",
                fontSize: "14px",
              }}
            >
              {infoTop.map((item, index) => (
                <div
                  key={item}
                  style={{ display: "flex", alignItems: "center", gap: 14 }}
                >
                  <span>{item}</span>
                  {index !== infoTop.length - 1 ? <span>•</span> : null}
                </div>
              ))}
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "16px",
              marginBottom: "18px",
            }}
          >
            <SummaryMiniCard
              titulo="Ingresos del periodo"
              valor={formatearMoneda(resumen.ingresos)}
              subtitulo="Total de entradas"
              destacado
            />
            <SummaryMiniCard
              titulo="Gastos del periodo"
              valor={formatearMoneda(resumen.gastos)}
              subtitulo="Total de salidas"
              color="#f87171"
            />
            <SummaryMiniCard
              titulo="Utilidad total"
              valor={formatearMoneda(resumen.utilidadTotal)}
              subtitulo="Ingresos - gastos"
              color={resumen.utilidadTotal < 0 ? "#f87171" : "#4ade80"}
            />
            <SummaryMiniCard
              titulo="Deuda total tarjetas"
              valor={formatearMoneda(resumen.deudaTotalTarjetas)}
              subtitulo="Pendiente acumulado"
              color={resumen.deudaTotalTarjetas > 0 ? "#f87171" : "#4ade80"}
            />
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: "18px",
              marginBottom: "18px",
            }}
          >
            <IndicadorCard
              icono="💵"
              titulo="Utilidad en efectivo"
              valor={formatearMoneda(resumen.utilidadEfectivo)}
              color="linear-gradient(135deg, #22c55e 0%, #15803d 100%)"
            />
            <IndicadorCard
              icono="💳"
              titulo="Utilidad en débito"
              valor={formatearMoneda(resumen.utilidadDebito)}
              color="linear-gradient(135deg, #38bdf8 0%, #2563eb 100%)"
            />
            <IndicadorCard
              icono="💸"
              titulo="Utilidad en crédito"
              valor={formatearMoneda(resumen.utilidadCredito)}
              color="linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)"
            />
            <IndicadorCard
              icono="🟠"
              titulo="Deuda total tarjetas"
              valor={formatearMoneda(resumen.deudaTotalTarjetas)}
              color="linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)"
            />
          </div>

          <div
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(148,163,184,0.12)",
              borderRadius: "28px",
              padding: "24px",
              boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
              marginBottom: "18px",
            }}
          >
            <h2
              style={{
                textAlign: "center",
                margin: 0,
                color: "#ffffff",
                fontSize: "2rem",
                fontWeight: 900,
              }}
            >
              Tarjetas de crédito
            </h2>

            <p
              style={{
                textAlign: "center",
                color: "rgba(226,232,240,0.72)",
                marginTop: 8,
                fontSize: "1rem",
              }}
            >
              Deuda acumulada por tarjeta en el periodo seleccionado
            </p>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                gap: "18px",
                marginTop: "20px",
              }}
            >
              {TARJETAS_CREDITO.map((tarjeta) => (
                <div
                  key={tarjeta}
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(148,163,184,0.12)",
                    borderRadius: "22px",
                    padding: "20px",
                    textAlign: "center",
                  }}
                >
                  <img
                    src={IMAGEN_TARJETAS[tarjeta]}
                    alt={tarjeta}
                    style={{
                      width: "100%",
                      maxWidth: 160,
                      height: 100,
                      objectFit: "contain",
                      marginBottom: 14,
                    }}
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />

                  <div
                    style={{
                      color: "rgba(226,232,240,0.88)",
                      fontWeight: 700,
                      minHeight: 44,
                    }}
                  >
                    {tarjeta}
                  </div>

                  <div
                    style={{
                      fontSize: "2rem",
                      fontWeight: 900,
                      color:
                        (resumen.deudaPorTarjeta[tarjeta] || 0) > 0
                          ? "#f87171"
                          : "#4ade80",
                      marginTop: 10,
                    }}
                  >
                    {formatearMoneda(resumen.deudaPorTarjeta[tarjeta] || 0)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))",
              gap: "18px",
              marginBottom: "18px",
            }}
          >
            <div
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(148,163,184,0.12)",
                borderRadius: "24px",
                padding: "18px",
                boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
              }}
            >
              <div style={{ marginBottom: 12 }}>
                <h3
                  style={{
                    margin: 0,
                    color: "#ffffff",
                    fontSize: "2rem",
                    fontWeight: 900,
                  }}
                >
                  Flujo
                </h3>
                <p
                  style={{
                    margin: "6px 0 0 0",
                    color: "rgba(226,232,240,0.72)",
                  }}
                >
                  Comparativa general
                </p>
              </div>

              <div
                style={{
                  background: "rgba(2,12,34,0.52)",
                  border: "1px solid rgba(148,163,184,0.12)",
                  borderRadius: "20px",
                  padding: "16px",
                }}
              >
                <FlujoChart
                  transacciones={transaccionesFiltradas}
                  filtroPeriodo={filtroPeriodo}
                />
              </div>
            </div>

            <div
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(148,163,184,0.12)",
                borderRadius: "24px",
                padding: "18px",
                boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
              }}
            >
              <div style={{ marginBottom: 12 }}>
                <h3
                  style={{
                    margin: 0,
                    color: "#ffffff",
                    fontSize: "2rem",
                    fontWeight: 900,
                  }}
                >
                  Tarjetas
                </h3>
                <p
                  style={{
                    margin: "6px 0 0 0",
                    color: "rgba(226,232,240,0.72)",
                  }}
                >
                  Comparativa general
                </p>
              </div>

              <div
                style={{
                  background: "rgba(2,12,34,0.52)",
                  border: "1px solid rgba(148,163,184,0.12)",
                  borderRadius: "20px",
                  padding: "16px",
                }}
              >
                <TarjetaChart
                  transacciones={transaccionesFiltradas}
                  filtroPeriodo={filtroPeriodo}
                />
              </div>
            </div>
          </div>

          <div
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(148,163,184,0.12)",
              borderRadius: "24px",
              padding: "18px",
              boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
              marginBottom: "8px",
            }}
          >
            <div style={{ marginBottom: 14 }}>
              <h3
                style={{
                  margin: 0,
                  color: "#ffffff",
                  fontSize: "2rem",
                  fontWeight: 900,
                }}
              >
                Movimientos recientes
              </h3>
            </div>

            <div
              style={{
                background: "rgba(2,12,34,0.52)",
                border: "1px solid rgba(148,163,184,0.12)",
                borderRadius: "20px",
                padding: "14px",
              }}
            >
              <div
                style={{
                  maxHeight: "420px",
                  overflowY: "auto",
                  paddingRight: "4px",
                }}
              >
                <RecentTransactions
                  transacciones={transaccionesFiltradas}
                  eliminar={eliminarTransaccion}
                />
              </div>
            </div>
          </div>

          {mostrarModal && (
            <div
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(2,6,23,0.7)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "18px",
                zIndex: 1000,
              }}
            >
              <div
                style={{
                  width: "100%",
                  maxWidth: "580px",
                  background:
                    "linear-gradient(180deg, #0f1d39 0%, #0b1630 100%)",
                  border: "1px solid rgba(148,163,184,0.18)",
                  borderRadius: "28px",
                  padding: "24px",
                  color: "#ffffff",
                  boxShadow: "0 30px 70px rgba(0,0,0,0.42)",
                }}
              >
                <h2 style={{ marginTop: 0, color: "#ffffff" }}>
                  Nueva Transacción
                </h2>

                <form onSubmit={agregarTransaccion}>
                  <div style={{ display: "grid", gap: "14px" }}>
                    <select
                      value={nuevaTransaccion.tipo}
                      onChange={(e) =>
                        setNuevaTransaccion((prev) => ({
                          ...prev,
                          tipo: e.target.value,
                          tarjetaCredito: "",
                          fuentePago: "efectivo",
                          metodo:
                            e.target.value === "pago_tarjeta"
                              ? "credito"
                              : prev.metodo,
                        }))
                      }
                      style={estiloInput}
                    >
                      <option value="ingreso">Ingreso</option>
                      <option value="gasto">Gasto</option>
                      <option value="pago_tarjeta">Pago de tarjeta</option>
                    </select>

                    {nuevaTransaccion.tipo !== "pago_tarjeta" && (
                      <select
                        value={nuevaTransaccion.metodo}
                        onChange={(e) =>
                          setNuevaTransaccion((prev) => ({
                            ...prev,
                            metodo: e.target.value,
                            tarjetaCredito:
                              e.target.value === "credito"
                                ? prev.tarjetaCredito
                                : "",
                          }))
                        }
                        style={estiloInput}
                      >
                        <option value="efectivo">Efectivo</option>
                        <option value="debito">Débito</option>
                        <option value="credito">Crédito</option>
                      </select>
                    )}

                    <input
                      type="text"
                      placeholder="Categoría"
                      value={nuevaTransaccion.categoria}
                      onChange={(e) =>
                        setNuevaTransaccion((prev) => ({
                          ...prev,
                          categoria: e.target.value,
                        }))
                      }
                      style={estiloInput}
                    />

                    <input
                      type="number"
                      placeholder="Monto"
                      value={nuevaTransaccion.monto}
                      onChange={(e) =>
                        setNuevaTransaccion((prev) => ({
                          ...prev,
                          monto: e.target.value,
                        }))
                      }
                      style={estiloInput}
                    />

                    <input
                      type="datetime-local"
                      value={nuevaTransaccion.fecha}
                      onChange={(e) =>
                        setNuevaTransaccion((prev) => ({
                          ...prev,
                          fecha: e.target.value,
                        }))
                      }
                      style={estiloInput}
                    />

                    {nuevaTransaccion.metodo === "credito" &&
                      nuevaTransaccion.tipo !== "pago_tarjeta" && (
                        <select
                          value={nuevaTransaccion.tarjetaCredito}
                          onChange={(e) =>
                            setNuevaTransaccion((prev) => ({
                              ...prev,
                              tarjetaCredito: e.target.value,
                            }))
                          }
                          style={estiloInput}
                        >
                          <option value="">Selecciona tarjeta</option>
                          {TARJETAS_CREDITO.map((tarjeta) => (
                            <option key={tarjeta} value={tarjeta}>
                              {tarjeta}
                            </option>
                          ))}
                        </select>
                      )}

                    {nuevaTransaccion.tipo === "pago_tarjeta" && (
                      <>
                        <select
                          value={nuevaTransaccion.tarjetaCredito}
                          onChange={(e) =>
                            setNuevaTransaccion((prev) => ({
                              ...prev,
                              tarjetaCredito: e.target.value,
                            }))
                          }
                          style={estiloInput}
                        >
                          <option value="">Selecciona tarjeta</option>
                          {TARJETAS_CREDITO.map((tarjeta) => (
                            <option key={tarjeta} value={tarjeta}>
                              {tarjeta}
                            </option>
                          ))}
                        </select>

                        <select
                          value={nuevaTransaccion.fuentePago}
                          onChange={(e) =>
                            setNuevaTransaccion((prev) => ({
                              ...prev,
                              fuentePago: e.target.value,
                            }))
                          }
                          style={estiloInput}
                        >
                          <option value="efectivo">Pagar con efectivo</option>
                          <option value="debito">Pagar con débito</option>
                        </select>
                      </>
                    )}
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: "12px",
                      justifyContent: "flex-end",
                      marginTop: "20px",
                      flexWrap: "wrap",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setMostrarModal(false);
                        limpiarFormulario();
                      }}
                      style={{
                        background: "rgba(255,255,255,0.08)",
                        color: "#ffffff",
                        border: "1px solid rgba(148,163,184,0.18)",
                        borderRadius: "14px",
                        padding: "12px 18px",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      Cancelar
                    </button>

                    <button
                      type="submit"
                      disabled={sincronizando}
                      style={{
                        background:
                          "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
                        color: "white",
                        border: "none",
                        borderRadius: "14px",
                        padding: "12px 18px",
                        fontWeight: 700,
                        cursor: sincronizando ? "not-allowed" : "pointer",
                        opacity: sincronizando ? 0.7 : 1,
                      }}
                    >
                      Guardar
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const estiloInput = {
  width: "100%",
  padding: "14px 16px",
  borderRadius: "14px",
  border: "1px solid rgba(148,163,184,0.2)",
  fontSize: "1rem",
  outline: "none",
  boxSizing: "border-box",
  background: "rgba(255,255,255,0.06)",
  color: "#ffffff",
};