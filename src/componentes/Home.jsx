import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { supabase } from "../supabase";

const REFRESH_MS = 5 * 60 * 1000;
const PAGE_SIZE = 1000;

const NOMBRES_CAJEROS = {
  "8": "MAYRA",
  "9": "CLAUDIA",
  "10": "SUSANA",
};

const COLORES_PAGO = ["#22c55e", "#2563eb", "#7c3aed", "#f59e0b", "#ef4444"];

function formatMoney(value) {
  return Number(value || 0).toLocaleString("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  });
}

function formatCompactMoney(value) {
  const n = Number(value || 0);
  if (Math.abs(n) >= 1000000) return `$${(n / 1000000).toFixed(1)}M`;
  if (Math.abs(n) >= 1000) return `$${(n / 1000).toFixed(1)}K`;
  return formatMoney(n);
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("es-MX");
}
function formatPercent(value) {
  return `${Math.abs(Number(value || 0)).toFixed(1)}%`;
}
function formatDateTime(value) {
  if (!value) return "Sin actualización";
  const fecha = new Date(value);
  if (Number.isNaN(fecha.getTime())) return "Sin actualización";
  return fecha.toLocaleString("es-MX");
}

function startOfToday() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function addDays(base, days) {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

function startOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

function parseDateAny(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeUpper(value) {
  return normalizeText(value).toUpperCase();
}

function numberFrom(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function porcentajeCambio(actual, anterior) {
  const a = numberFrom(actual);
  const b = numberFrom(anterior);
  if (!b && !a) return 0;
  if (!b) return 100;
  return ((a - b) / b) * 100;
}

function colorVariacion(variacion, invertida = false) {
  if (invertida) {
    return variacion <= 0 ? "#22c55e" : "#ef4444";
  }
  return variacion >= 0 ? "#22c55e" : "#ef4444";
}

function arrowVariacion(variacion) {
  return variacion >= 0 ? "↗" : "↘";
}

function getTicketDate(row) {
  return (
    row?.pagado_en ||
    row?.vendido_en ||
    row?.fecha_hora ||
    row?.datetime ||
    row?.fecha ||
    row?.created_at ||
    row?.fecha_ticket ||
    row?.fechahora ||
    row?.updated_at ||
    null
  );
}

function getTicketTotal(row) {
  return (
    numberFrom(row?.total) ||
    numberFrom(row?.importe_total) ||
    numberFrom(row?.importe) ||
    numberFrom(row?.monto_total) ||
    numberFrom(row?.subtotal) ||
    0
  );
}

function getTicketCashier(row) {
  const raw =
    row?.cajero_nombre ||
    row?.usuario_nombre ||
    row?.usuario ||
    row?.cajero ||
    row?.empleado ||
    row?.cajero_id ||
    row?.usuario_id ||
    row?.user_id ||
    null;

  if (raw === null || raw === undefined || raw === "") return "SIN CAJERO";

  const txt = String(raw).trim();
  return NOMBRES_CAJEROS[txt] || txt.toUpperCase();
}

function getTicketPaymentMethod(row) {
  const raw =
    row?.forma_pago ||
    row?.metodo_pago ||
    row?.pagado_con ||
    row?.metodo ||
    row?.tipo_pago ||
    row?.payment_method ||
    null;

  const txt = normalizeUpper(raw);

  if (!txt) return "OTROS";
  if (txt.includes("EFE")) return "EFECTIVO";
  if (txt.includes("DEB")) return "TARJETA";
  if (txt.includes("CRÉ")) return "TARJETA";
  if (txt.includes("CRED")) return "TARJETA";
  if (txt.includes("TARJ")) return "TARJETA";
  if (txt.includes("TRANS")) return "TRANSFERENCIA";
  if (txt.includes("SPEI")) return "TRANSFERENCIA";
  return txt;
}

function getArticuloNombre(row) {
  return (
    normalizeText(row?.descripcion) ||
    normalizeText(row?.nombre) ||
    normalizeText(row?.articulo) ||
    normalizeText(row?.producto) ||
    normalizeText(row?.articulo_nombre) ||
    normalizeText(row?.nombre_articulo) ||
    normalizeText(row?.descripcion_articulo) ||
    "Producto"
  );
}

function getArticuloCantidad(row) {
  return (
    numberFrom(row?.cantidad) ||
    numberFrom(row?.cant) ||
    numberFrom(row?.unidades) ||
    numberFrom(row?.piezas) ||
    1
  );
}

function getArticuloImporte(row) {
  return (
    numberFrom(row?.importe) ||
    numberFrom(row?.total) ||
    numberFrom(row?.subtotal) ||
    numberFrom(row?.monto) ||
    numberFrom(row?.precio_total) ||
    0
  );
}

async function fetchAll(queryBuilder, pageSize = PAGE_SIZE, maxPages = 30) {
  let from = 0;
  let pages = 0;
  let all = [];

  while (pages < maxPages) {
    const { data, error } = await queryBuilder.range(from, from + pageSize - 1);
    if (error) throw error;

    const rows = Array.isArray(data) ? data : [];
    all = all.concat(rows);

    if (rows.length < pageSize) break;

    from += pageSize;
    pages += 1;
  }

  return all;
}

function Panel({ title, right, children, style = {} }) {
  return (
    <div
      style={{
        background: "linear-gradient(180deg, #081a34 0%, #07162d 100%)",
        border: "1px solid rgba(59,130,246,0.14)",
        borderRadius: 22,
        padding: 18,
        boxShadow: "0 16px 30px rgba(0,0,0,0.20)",
        minWidth: 0,
        ...style,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "center",
          marginBottom: 14,
          flexWrap: "wrap",
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: 18,
            fontWeight: 900,
            letterSpacing: "-0.02em",
          }}
        >
          {title}
        </h3>
        {right}
      </div>
      {children}
    </div>
  );
}

function SidebarBtn({ icono, text, active = false, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        padding: "13px 14px",
        marginTop: 8,
        background: active
          ? "linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%)"
          : "transparent",
        color: "#fff",
        border: "none",
        borderRadius: 14,
        textAlign: "left",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: 12,
        fontWeight: active ? 800 : 600,
        fontSize: 15,
      }}
    >
      <span style={{ width: 20, textAlign: "center" }}>{icono}</span>
      <span>{text}</span>
    </button>
  );
}

function CardPremium({ title, value, variacion, color, invertida = false, icono }) {
  const colorTrend = colorVariacion(variacion, invertida);
  const arrow = arrowVariacion(variacion);

  return (
    <div
      style={{
        background: "linear-gradient(180deg, #091b35 0%, #08172d 100%)",
        padding: 18,
        borderRadius: 20,
        border: "1px solid rgba(59,130,246,0.16)",
        boxShadow: "0 14px 28px rgba(0,0,0,0.22)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 14,
          gap: 10,
        }}
      >
        <div
          style={{
            width: 50,
            height: 50,
            borderRadius: 15,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: color,
            fontSize: 22,
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.18)",
          }}
        >
          {icono}
        </div>

        <span
          style={{
            borderRadius: 999,
            padding: "6px 10px",
            background: "rgba(37,99,235,0.16)",
            color: "#c7d2fe",
            fontSize: 11,
            fontWeight: 900,
          }}
        >
          HOY
        </span>
      </div>

      <p
        style={{
          margin: 0,
          fontSize: 14,
          color: "rgba(219,234,254,0.82)",
          fontWeight: 700,
        }}
      >
        {title}
      </p>

      <div
        style={{
          margin: "6px 0 10px 0",
          fontSize: "clamp(22px, 2vw, 34px)",
          fontWeight: 900,
          letterSpacing: "-0.03em",
        }}
      >
        {value}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
        <span style={{ color: colorTrend, fontWeight: 800 }}>
          {arrow} {formatPercent(variacion)}
        </span>
        <span style={{ color: "rgba(191,219,254,0.7)" }}>vs ayer</span>
      </div>
    </div>
  );
}

function ActivityItem({ item }) {
  const color = item.tipo === "warn" ? "#f59e0b" : "#22c55e";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 12,
        padding: "12px 0",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div style={{ display: "flex", gap: 12, minWidth: 0 }}>
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 12,
            background: "rgba(255,255,255,0.06)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {item.icono}
        </div>

        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 800 }}>{item.titulo}</div>
          <div style={{ fontSize: 13, color: "rgba(219,234,254,0.68)" }}>
            {item.subtitulo}
          </div>
        </div>
      </div>

      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div style={{ fontWeight: 900, color }}>{item.valor}</div>
        <div style={{ fontSize: 12, color: "rgba(219,234,254,0.6)" }}>{item.tiempo}</div>
      </div>
    </div>
  );
}

export default function Home() {
  const navigate = useNavigate();

  const [stats, setStats] = useState({
    ventasHoy: 0,
    ventasAyer: 0,
    ingresoEfectivoHoy: 0,
    ingresoEfectivoAyer: 0,
    salidaEfectivoHoy: 0,
    salidaEfectivoAyer: 0,
    ticketsHoy: 0,
    ticketsAyer: 0,
    productosStock: 0,
    empleadosActivos: 0,
    ticketsBase: 0,
  });

  const [ventasHora, setVentasHora] = useState([]);
  const [ventasCajero, setVentasCajero] = useState([]);
  const [metodosPago, setMetodosPago] = useState([]);
  const [topProductos, setTopProductos] = useState([]);
  const [actividadReciente, setActividadReciente] = useState([]);
  const [alertas, setAlertas] = useState([]);
  const [ultimaActualizacion, setUltimaActualizacion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actualizando, setActualizando] = useState(false);
  const [errorCarga, setErrorCarga] = useState("");

  const cerrarSesion = () => {
    localStorage.removeItem("abarrotes_garcia_logged");
    navigate("/login");
  };

  const irInicio = () => navigate("/");
  const irVentas = () => navigate("/dashboard-ventas");
  const irFinanzas = () => navigate("/dashboard");
  const irInventario = () => navigate("/inventario");
  const irRH = () => navigate("/rh");

  const cargarDatos = async (esRefresco = false) => {
    try {
      if (esRefresco) setActualizando(true);
      else setLoading(true);

      setErrorCarga("");

      const hoy = startOfToday();
      const manana = addDays(hoy, 1);
      const ayer = addDays(hoy, -1);
      const inicioMes = startOfMonth();

      const hoyIso = hoy.toISOString();
      const mananaIso = manana.toISOString();
      const ayerIso = ayer.toISOString();
      const mesIso = inicioMes.toISOString();

      let ventasHoy = 0;
      let ventasAyer = 0;
      let ingresoEfectivoHoy = 0;
      let ingresoEfectivoAyer = 0;
      let salidaEfectivoHoy = 0;
      let salidaEfectivoAyer = 0;
      let ticketsHoy = 0;
      let ticketsAyer = 0;
      let productosStock = 0;
      let empleadosActivos = 0;
      let ticketsBase = 0;

      const [countHoyResp, countAyerResp, countBaseResp] = await Promise.all([
        supabase
          .from("eleventa_tickets")
          .select("*", { count: "exact", head: true })
          .gte("pagado_en", hoyIso)
          .lt("pagado_en", mananaIso),
        supabase
          .from("eleventa_tickets")
          .select("*", { count: "exact", head: true })
          .gte("pagado_en", ayerIso)
          .lt("pagado_en", hoyIso),
        supabase
          .from("eleventa_tickets")
          .select("*", { count: "exact", head: true }),
      ]);

      if (countHoyResp.error) throw countHoyResp.error;
      if (countAyerResp.error) throw countAyerResp.error;
      if (countBaseResp.error) throw countBaseResp.error;

      ticketsHoy = countHoyResp.count || 0;
      ticketsAyer = countAyerResp.count || 0;
      ticketsBase = countBaseResp.count || 0;

      const [ticketsHoyRows, ticketsAyerRows] = await Promise.all([
        fetchAll(
          supabase
            .from("eleventa_tickets")
            .select("*")
            .gte("pagado_en", hoyIso)
            .lt("pagado_en", mananaIso)
            .order("pagado_en", { ascending: true }),
          1000,
          20
        ),
        fetchAll(
          supabase
            .from("eleventa_tickets")
            .select("*")
            .gte("pagado_en", ayerIso)
            .lt("pagado_en", hoyIso)
            .order("pagado_en", { ascending: true }),
          1000,
          20
        ),
      ]);

      ventasHoy = (ticketsHoyRows || []).reduce((acc, row) => acc + getTicketTotal(row), 0);
      ventasAyer = (ticketsAyerRows || []).reduce((acc, row) => acc + getTicketTotal(row), 0);

      let movimientosHoy = [];
      let movimientosAyer = [];

      try {
        movimientosHoy = await fetchAll(
          supabase
            .from("movimientos")
            .select("*")
            .gte("fecha", hoyIso)
            .lt("fecha", mananaIso)
            .order("fecha", { ascending: true }),
          1000,
          20
        );
      } catch {
        movimientosHoy = await fetchAll(
          supabase
            .from("movimientos")
            .select("*")
            .gte("created_at", hoyIso)
            .lt("created_at", mananaIso)
            .order("created_at", { ascending: true }),
          1000,
          20
        );
      }

      try {
        movimientosAyer = await fetchAll(
          supabase
            .from("movimientos")
            .select("*")
            .gte("fecha", ayerIso)
            .lt("fecha", hoyIso)
            .order("fecha", { ascending: true }),
          1000,
          20
        );
      } catch {
        movimientosAyer = await fetchAll(
          supabase
            .from("movimientos")
            .select("*")
            .gte("created_at", ayerIso)
            .lt("created_at", hoyIso)
            .order("created_at", { ascending: true }),
          1000,
          20
        );
      }

      for (const mov of movimientosHoy) {
        const tipo = normalizeUpper(mov?.tipo);
        const metodo = normalizeUpper(mov?.metodo);
        const monto = numberFrom(mov?.monto);

        if (!metodo.includes("EFE")) continue;
        if (tipo === "INGRESO") ingresoEfectivoHoy += monto;
        if (tipo === "GASTO") salidaEfectivoHoy += monto;
      }

      for (const mov of movimientosAyer) {
        const tipo = normalizeUpper(mov?.tipo);
        const metodo = normalizeUpper(mov?.metodo);
        const monto = numberFrom(mov?.monto);

        if (!metodo.includes("EFE")) continue;
        if (tipo === "INGRESO") ingresoEfectivoAyer += monto;
        if (tipo === "GASTO") salidaEfectivoAyer += monto;
      }

      const articulosCountResp = await supabase
        .from("eleventa_articulos")
        .select("*", { count: "exact", head: true });

      if (articulosCountResp.error) throw articulosCountResp.error;
      productosStock = articulosCountResp.count || 0;

      let checadasRows = [];
      try {
        checadasRows = await fetchAll(
          supabase
            .from("checadas")
            .select("*")
            .gte("fecha_hora", mesIso)
            .order("fecha_hora", { ascending: false }),
          1000,
          20
        );
      } catch {
        try {
          checadasRows = await fetchAll(
            supabase
              .from("checadas")
              .select("*")
              .gte("datetime", mesIso)
              .order("datetime", { ascending: false }),
            1000,
            20
          );
        } catch {
          checadasRows = await fetchAll(supabase.from("checadas").select("*"), 1000, 20);
        }
      }

      const empleadosSet = new Set();
      for (const row of checadasRows) {
        const nombre = normalizeUpper(row?.nombre || row?.empleado || row?.usuario);
        const fecha =
          parseDateAny(row?.fecha_hora) ||
          parseDateAny(row?.datetime) ||
          parseDateAny(row?.fecha);

        if (!nombre || !fecha) continue;
        if (fecha >= inicioMes) empleadosSet.add(nombre);
      }
      empleadosActivos = empleadosSet.size;

      const hourlyMap = {};
      for (let h = 0; h < 24; h += 1) {
        hourlyMap[h] = { hora: `${h}:00`, total: 0, hour: h };
      }

      const cajeroMap = {};
      const pagoMap = {};

      for (const ticket of ticketsHoyRows) {
        const fecha = parseDateAny(getTicketDate(ticket));
        const total = getTicketTotal(ticket);
        const cajero = getTicketCashier(ticket);
        const pago = getTicketPaymentMethod(ticket);

        if (fecha) {
          const hour = fecha.getHours();
          if (hourlyMap[hour]) hourlyMap[hour].total += total;
        }

        cajeroMap[cajero] = (cajeroMap[cajero] || 0) + total;
        pagoMap[pago] = (pagoMap[pago] || 0) + total;
      }

      const ventasHoraData = Object.values(hourlyMap);

      const ventasCajeroData = Object.entries(cajeroMap)
        .map(([nombre, total]) => ({ nombre, total }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);

      const totalPagos = Object.values(pagoMap).reduce((a, b) => a + b, 0);

      const metodosPagoData = Object.entries(pagoMap)
        .map(([nombre, total], index) => ({
          nombre,
          total,
          porcentaje: totalPagos ? (total / totalPagos) * 100 : 0,
          color: COLORES_PAGO[index % COLORES_PAGO.length],
        }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);

      let articulosHoyRows = [];
      try {
        articulosHoyRows = await fetchAll(
          supabase
            .from("eleventa_articulos")
            .select("*")
            .gte("pagado_en", hoyIso)
            .lt("pagado_en", mananaIso),
          1000,
          30
        );
      } catch {
        try {
          articulosHoyRows = await fetchAll(
            supabase
              .from("eleventa_articulos")
              .select("*")
              .gte("fecha", hoyIso)
              .lt("fecha", mananaIso),
            1000,
            30
          );
        } catch {
          articulosHoyRows = await fetchAll(
            supabase.from("eleventa_articulos").select("*"),
            1000,
            5
          );
        }
      }

      const productosMap = {};
      for (const item of articulosHoyRows) {
        const nombre = getArticuloNombre(item);
        const cantidad = getArticuloCantidad(item);
        const importe = getArticuloImporte(item);

        if (!productosMap[nombre]) {
          productosMap[nombre] = {
            producto: nombre,
            vendidos: 0,
            total: 0,
          };
        }

        productosMap[nombre].vendidos += cantidad;
        productosMap[nombre].total += importe;
      }

      const topProductosData = Object.values(productosMap)
        .sort((a, b) => b.total - a.total || b.vendidos - a.vendidos)
        .slice(0, 5);

      const actividad = [];

      const ultimosTickets = [...ticketsHoyRows]
        .sort((a, b) => {
          const da = parseDateAny(getTicketDate(a))?.getTime() || 0;
          const db = parseDateAny(getTicketDate(b))?.getTime() || 0;
          return db - da;
        })
        .slice(0, 3);

      for (const ticket of ultimosTickets) {
        const total = getTicketTotal(ticket);
        const caja =
          ticket?.caja_id ||
          ticket?.caja ||
          ticket?.terminal ||
          ticket?.numero_caja ||
          "";
        const ticketId = ticket?.id || ticket?.ticket_id || "";

        actividad.push({
          icono: "🛒",
          titulo: `Venta realizada${caja ? ` en Caja ${caja}` : ""}`,
          subtitulo: ticketId ? `Ticket #${ticketId}` : "Venta registrada",
          valor: formatMoney(total),
          tiempo: "Hoy",
          tipo: "ok",
        });
      }

      const ultimosMovs = [...movimientosHoy]
        .sort((a, b) => {
          const da = parseDateAny(a?.fecha || a?.created_at)?.getTime() || 0;
          const db = parseDateAny(b?.fecha || b?.created_at)?.getTime() || 0;
          return db - da;
        })
        .slice(0, 2);

      for (const mov of ultimosMovs) {
        const tipo = normalizeUpper(mov?.tipo);
        const monto = numberFrom(mov?.monto);

        actividad.push({
          icono: tipo === "INGRESO" ? "↗" : "↘",
          titulo: tipo === "INGRESO" ? "Entrada de efectivo" : "Salida de efectivo",
          subtitulo:
            normalizeText(mov?.concepto || mov?.descripcion || mov?.nota) ||
            "Movimiento financiero",
          valor: tipo === "INGRESO" ? `+${formatMoney(monto)}` : `-${formatMoney(monto)}`,
          tiempo: "Hoy",
          tipo: tipo === "INGRESO" ? "ok" : "warn",
        });
      }

      const alertasLista = [];
      if (ventasCajeroData.length === 0) alertasLista.push("Sin ventas por cajero detectadas hoy");
      if (ticketsHoy === 0) alertasLista.push("No hay tickets registrados hoy");
      if (salidaEfectivoHoy > ingresoEfectivoHoy && salidaEfectivoHoy > 0) {
        alertasLista.push("La salida de efectivo supera al ingreso de efectivo");
      }
      if (empleadosActivos > 0 && empleadosActivos < 3) {
        alertasLista.push("Pocos empleados con actividad este mes");
      }
      if (topProductosData.length < 3) {
        alertasLista.push("Pocos productos detectados en el resumen de hoy");
      }
      if (alertasLista.length === 0) alertasLista.push("Operación general estable");

      setStats({
        ventasHoy,
        ventasAyer,
        ingresoEfectivoHoy,
        ingresoEfectivoAyer,
        salidaEfectivoHoy,
        salidaEfectivoAyer,
        ticketsHoy,
        ticketsAyer,
        productosStock,
        empleadosActivos,
        ticketsBase,
      });

      setVentasHora(ventasHoraData);
      setVentasCajero(ventasCajeroData);
      setMetodosPago(metodosPagoData);
      setTopProductos(topProductosData);
      setActividadReciente(actividad.slice(0, 4));
      setAlertas(alertasLista.slice(0, 4));
      setUltimaActualizacion(new Date().toISOString());
    } catch (error) {
      console.error("Error cargando Home ERP:", error);
      setErrorCarga(error?.message || "No se pudieron cargar los datos.");
    } finally {
      setLoading(false);
      setActualizando(false);
    }
  };

  useEffect(() => {
    cargarDatos(false);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      cargarDatos(true);
    }, REFRESH_MS);

    return () => clearInterval(interval);
  }, []);

  const variaciones = useMemo(
    () => ({
      ventas: porcentajeCambio(stats.ventasHoy, stats.ventasAyer),
      ingreso: porcentajeCambio(stats.ingresoEfectivoHoy, stats.ingresoEfectivoAyer),
      salida: porcentajeCambio(stats.salidaEfectivoHoy, stats.salidaEfectivoAyer),
      tickets: porcentajeCambio(stats.ticketsHoy, stats.ticketsAyer),
    }),
    [stats]
  );

  const topCards = [
    {
      titulo: "Ventas hoy",
      valor: formatMoney(stats.ventasHoy),
      variacion: variaciones.ventas,
      invertida: false,
      color: "#2563eb",
      icono: "🛒",
    },
    {
      titulo: "Ingreso efectivo",
      valor: formatMoney(stats.ingresoEfectivoHoy),
      variacion: variaciones.ingreso,
      invertida: false,
      color: "#16a34a",
      icono: "$",
    },
    {
      titulo: "Salida efectivo",
      valor: formatMoney(stats.salidaEfectivoHoy),
      variacion: variaciones.salida,
      invertida: true,
      color: "#f59e0b",
      icono: "⇄",
    },
    {
      titulo: "Tickets hoy",
      valor: formatNumber(stats.ticketsHoy),
      variacion: variaciones.tickets,
      invertida: false,
      color: "#7c3aed",
      icono: "🎟",
    },
    {
      titulo: "Stock productos",
      valor: formatNumber(stats.productosStock),
      variacion: -2.1,
      invertida: false,
      color: "#d97706",
      icono: "📦",
    },
  ];

  const sidebarItems = [
    { label: "Inicio", icono: "⌂", onClick: irInicio, active: true },
    { label: "Ventas", icono: "🛒", onClick: irVentas },
    { label: "Finanzas", icono: "$", onClick: irFinanzas },
    { label: "Inventario", icono: "📦", onClick: irInventario },
    { label: "Recursos Humanos", icono: "👥", onClick: irRH },
    { label: "Reportes", icono: "📊", onClick: irVentas },
    { label: "Configuración", icono: "⚙", onClick: irInicio },
    { label: "Usuarios", icono: "👤", onClick: irInicio },
    { label: "Sincronización", icono: "⟳", onClick: irInicio },
  ];

  const modulos = [
    {
      key: "ventas",
      titulo: "Ventas",
      descripcion:
        "Control inteligente de ventas, cajeros, horarios, tickets y formas de pago.",
      valorLabel: "Ventas totales hoy",
      valor: formatMoney(stats.ventasHoy),
      badge: "HOY",
      color: "#2563eb",
      icono: "🛒",
      onClick: irVentas,
    },
    {
      key: "finanzas",
      titulo: "Finanzas",
      descripcion:
        "Gestión de ingresos, egresos, gastos, tarjetas y reportes financieros.",
      valorLabel: "Ingreso de efectivo hoy",
      valor: formatMoney(stats.ingresoEfectivoHoy),
      badge: "HOY",
      color: "#16a34a",
      icono: "$",
      onClick: irFinanzas,
    },
    {
      key: "rh",
      titulo: "Recursos Humanos",
      descripcion:
        "Administración de personal, asistencias, retardos, faltas y rendimiento.",
      valorLabel: "Empleados activos este mes",
      valor: formatNumber(stats.empleadosActivos),
      badge: "RH",
      color: "#7c3aed",
      icono: "👥",
      onClick: irRH,
    },
    {
      key: "inventario",
      titulo: "Inventario",
      descripcion:
        "Control de productos, existencias, entradas, salidas, proveedores y alertas de stock.",
      valorLabel: "Artículos sincronizados",
      valor: formatNumber(stats.productosStock),
      badge: "SYNC",
      color: "#d97706",
      icono: "📦",
      onClick: irInventario,
    },
  ];

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #071225 0%, #08172c 100%)",
        color: "#ffffff",
        fontFamily:
          'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        padding: 16,
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "240px minmax(0, 1fr)",
          gap: 16,
          minHeight: "calc(100vh - 32px)",
        }}
      >
        <aside
          style={{
            background: "linear-gradient(180deg, #07162c 0%, #071326 100%)",
            border: "1px solid rgba(59,130,246,0.18)",
            borderRadius: 24,
            padding: 18,
            display: "flex",
            flexDirection: "column",
            boxShadow: "0 20px 40px rgba(0,0,0,0.28)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, padding: 8 }}>
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: 14,
                background: "rgba(255,255,255,0.06)",
                display: "flex",
                alignItems: "center",
                                justifyContent: "center",
                border: "1px solid rgba(255,255,255,0.08)",
                flexShrink: 0,
              }}
            >
              <img
                src="/logo.png"
                alt="Logo"
                style={{ width: 34, height: 34, objectFit: "contain" }}
              />
            </div>

            <div style={{ fontWeight: 900, fontSize: 15, lineHeight: 1.15, letterSpacing: "-0.02em" }}>
              ABARROTES
              <br />
              GARCIA
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
            {sidebarItems.map((item) => (
              <SidebarBtn
                key={item.label}
                icono={item.icono}
                text={item.label}
                active={item.active}
                onClick={item.onClick}
              />
            ))}
          </div>

          <div
            style={{
              marginTop: "auto",
              borderTop: "1px solid rgba(255,255,255,0.08)",
              paddingTop: 16,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 16,
                padding: 12,
              }}
            >
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #d1d5db 0%, #9ca3af 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 18,
                  color: "#111827",
                  fontWeight: 900,
                  flexShrink: 0,
                }}
              >
                A
              </div>

              <div>
                <div style={{ fontWeight: 800 }}>Administrador</div>
                <div style={{ fontSize: 12, color: "rgba(191,219,254,0.68)" }}>
                  admin@abarrotes.com
                </div>
              </div>
            </div>
          </div>
        </aside>

        <main
          style={{
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            <div>
              <h1
                style={{
                  margin: 0,
                  fontSize: "clamp(28px, 4vw, 42px)",
                  fontWeight: 900,
                  letterSpacing: "-0.03em",
                }}
              >
                ¡Bienvenido, Administrador!
              </h1>
              <p
                style={{
                  margin: "6px 0 0 0",
                  color: "rgba(191,219,254,0.72)",
                  fontSize: 16,
                }}
              >
                Resumen general de la operación del día de hoy
              </p>
            </div>

            <div
              style={{
                display: "flex",
                gap: 12,
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              <button
                style={{
                  border: "1px solid rgba(255,255,255,0.08)",
                  background: "rgba(8,20,40,0.9)",
                  color: "#fff",
                  borderRadius: 14,
                  padding: "13px 16px",
                  fontWeight: 700,
                  fontSize: 14,
                  minWidth: 140,
                  cursor: "default",
                }}
              >
                📅 Hoy
              </button>

              <button
                style={{
                  border: "1px solid rgba(255,255,255,0.08)",
                  background: "rgba(8,20,40,0.9)",
                  color: "#fff",
                  borderRadius: 14,
                  padding: "13px 16px",
                  fontWeight: 700,
                  fontSize: 14,
                  minWidth: 140,
                  cursor: "default",
                }}
              >
                {new Date().toLocaleDateString("es-MX")}
              </button>

              <button
                style={{
                  border: "1px solid rgba(239,68,68,0.35)",
                  background: "rgba(127,29,29,0.15)",
                  color: "#fff",
                  borderRadius: 14,
                  padding: "13px 18px",
                  fontWeight: 800,
                  fontSize: 14,
                  cursor: "pointer",
                }}
                onClick={cerrarSesion}
              >
                ⎋ Cerrar sesión
              </button>
            </div>
          </div>

          {errorCarga ? (
            <div
              style={{
                borderRadius: 16,
                padding: "14px 16px",
                background: "rgba(127,29,29,0.28)",
                border: "1px solid rgba(248,113,113,0.35)",
                color: "#fecaca",
                fontWeight: 700,
              }}
            >
              Error al cargar datos: {errorCarga}
            </div>
          ) : null}

          <section
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
              gap: 14,
            }}
          >
            {topCards.map((card) => (
              <CardPremium
                key={card.titulo}
                title={card.titulo}
                value={card.valor}
                variacion={card.variacion}
                color={card.color}
                invertida={card.invertida}
                icono={card.icono}
              />
            ))}
          </section>

          <section
            style={{
              display: "grid",
              gridTemplateColumns: "2fr 1.2fr",
              gap: 16,
            }}
          >
            <Panel
              title="Ventas por hora"
              right={
                <span
                  style={{
                    borderRadius: 999,
                    padding: "7px 10px",
                    background: "rgba(37,99,235,0.16)",
                    color: "#c7d2fe",
                    fontSize: 11,
                    fontWeight: 900,
                  }}
                >
                  HOY
                </span>
              }
            >
              <div style={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={ventasHora}>
                    <defs>
                      <linearGradient id="ventasGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#2563eb" stopOpacity={0.55} />
                        <stop offset="100%" stopColor="#2563eb" stopOpacity={0.03} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                    <XAxis
                      dataKey="hora"
                      stroke="rgba(191,219,254,0.65)"
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis
                      stroke="rgba(191,219,254,0.65)"
                      tick={{ fontSize: 12 }}
                      tickFormatter={(v) => formatCompactMoney(v)}
                    />
                    <Tooltip
                      formatter={(value) => [formatMoney(value), "Ventas"]}
                      contentStyle={{
                        background: "#08172d",
                        border: "1px solid rgba(59,130,246,0.20)",
                        borderRadius: 12,
                        color: "#fff",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="total"
                      stroke="#3b82f6"
                      strokeWidth={3}
                      fill="url(#ventasGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Panel>

            <Panel title="Métodos de pago">
              <div style={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={metodosPago}
                      dataKey="total"
                      nameKey="nombre"
                      innerRadius={70}
                      outerRadius={100}
                      paddingAngle={4}
                    >
                      {metodosPago.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value, name, props) => [
                        formatMoney(value),
                        props?.payload?.nombre || name,
                      ]}
                      contentStyle={{
                        background: "#08172d",
                        border: "1px solid rgba(59,130,246,0.20)",
                        borderRadius: 12,
                        color: "#fff",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
                {metodosPago.map((item) => (
                  <div
                    key={item.nombre}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                      fontSize: 14,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span
                        style={{
                          width: 12,
                          height: 12,
                          borderRadius: "50%",
                          background: item.color,
                          display: "inline-block",
                        }}
                      />
                      <span>{item.nombre}</span>
                    </div>
                    <div style={{ fontWeight: 800 }}>
                      {formatMoney(item.total)} · {item.porcentaje.toFixed(1)}%
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          </section>

          <section
            style={{
              display: "grid",
              gridTemplateColumns: "1.3fr 1fr",
              gap: 16,
            }}
          >
            <Panel
              title="Módulos principales"
              right={
                <span style={{ color: "rgba(191,219,254,0.7)", fontSize: 13 }}>
                  Acceso rápido
                </span>
              }
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                  gap: 14,
                }}
              >
                {modulos.map((modulo) => (
                  <div
                    key={modulo.key}
                    style={{
                      borderRadius: 18,
                      padding: 18,
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.06)",
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div
                        style={{
                          width: 46,
                          height: 46,
                          borderRadius: 14,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 22,
                          background: modulo.color,
                          flexShrink: 0,
                        }}
                      >
                        {modulo.icono}
                      </div>

                      <h4 style={{ margin: 0, fontSize: 18, fontWeight: 900 }}>
                        {modulo.titulo}
                      </h4>
                    </div>

                    <p
                      style={{
                        margin: 0,
                        color: "rgba(219,234,254,0.78)",
                        fontSize: 14,
                        lineHeight: 1.5,
                        minHeight: 64,
                      }}
                    >
                      {modulo.descripcion}
                    </p>

                    <div
                      style={{
                        marginTop: 4,
                        borderRadius: 14,
                        padding: "12px 14px",
                        background: "rgba(255,255,255,0.03)",
                        border: "1px solid rgba(255,255,255,0.06)",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 10,
                      }}
                    >
                      <div>
                        <p
                          style={{
                            margin: 0,
                            fontSize: 11,
                            color: "rgba(191,219,254,0.66)",
                            fontWeight: 800,
                            textTransform: "uppercase",
                          }}
                        >
                          {modulo.valorLabel}
                        </p>
                        <p
                          style={{
                            margin: "4px 0 0 0",
                            fontSize: 22,
                            fontWeight: 900,
                            color: modulo.color,
                          }}
                        >
                          {modulo.valor}
                        </p>
                      </div>

                      <span
                        style={{
                          borderRadius: 999,
                          padding: "8px 10px",
                          fontSize: 11,
                          fontWeight: 900,
                          background: "rgba(255,255,255,0.08)",
                          color: "#fff",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {modulo.badge}
                      </span>
                    </div>

                    <button
                      onClick={modulo.onClick}
                      style={{
                        marginTop: "auto",
                        border: "none",
                        borderRadius: 14,
                        padding: "14px 16px",
                        background: modulo.color,
                        color: "#fff",
                        fontWeight: 900,
                        fontSize: 16,
                        cursor: "pointer",
                      }}
                    >
                      Abrir módulo                      →
                    </button>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel title="Actividad reciente">
              <div>
                {actividadReciente.map((item, index) => (
                  <ActivityItem key={index} item={item} />
                ))}
              </div>
            </Panel>
          </section>

          <section
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 16,
            }}
          >
            <Panel title="Top productos">
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {topProductos.map((p, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.06)",
                      borderRadius: 12,
                      padding: "10px 12px",
                      fontSize: 14,
                    }}
                  >
                    <span>{p.producto}</span>
                    <span style={{ fontWeight: 900 }}>
                      {formatMoney(p.total)}
                    </span>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel title="Alertas del sistema">
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {alertas.map((a, i) => (
                  <div
                    key={i}
                    style={{
                      background: "rgba(245,158,11,0.12)",
                      border: "1px solid rgba(245,158,11,0.25)",
                      borderRadius: 12,
                      padding: "10px 12px",
                      fontSize: 14,
                      color: "#fbbf24",
                      fontWeight: 700,
                    }}
                  >
                    ⚠ {a}
                  </div>
                ))}
              </div>
            </Panel>
          </section>

          <div
            style={{
              marginTop: 10,
              textAlign: "center",
              fontSize: 13,
              color: "rgba(191,219,254,0.65)",
            }}
          >
            Última actualización: {formatDateTime(ultimaActualizacion)} ·
            Auto refresh activo cada 5 minutos · Tickets base:{" "}
            {formatNumber(stats.ticketsBase)}
          </div>
        </main>
      </div>
    </div>
  );
}
                