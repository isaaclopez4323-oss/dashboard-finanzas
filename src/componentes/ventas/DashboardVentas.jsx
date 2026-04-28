import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
  AreaChart,
  Area,
} from "recharts";
import { supabase } from "../../supabase";

const TABLA_VENTAS = "eleventa_tickets";
const TABLA_ARTICULOS = "eleventa_articulos";
const TABLA_CAJA = "eleventa_movimientos_caja";

const REFRESH_MS = 5 * 60 * 1000;
const PAGE_SIZE = 1000;

const PERIODOS = [
  { key: "hoy", label: "Hoy" },
  { key: "7dias", label: "7 días" },
  { key: "30dias", label: "30 días" },
  { key: "anual", label: "Anual" },
  { key: "todo", label: "Todo" },
  { key: "personalizado", label: "Personalizado" },
];

const MENU_ITEMS = [
  { key: "inicio", label: "Inicio", icon: "⌂", active: true },
  { key: "ventas", label: "Ventas", icon: "↗" },
  { key: "reportes", label: "Reportes", icon: "▣" },
  { key: "productos", label: "Productos", icon: "◫" },
  { key: "cajeros", label: "Cajeros", icon: "◌" },
  { key: "clientes", label: "Clientes", icon: "◎" },
  { key: "analytics", label: "Analytics", icon: "◔" },
  { key: "config", label: "Configuración", icon: "⚙" },
];

const BLUE = "#4F8CFF";
const GREEN = "#22C55E";
const CYAN = "#06B6D4";
const PURPLE = "#A855F7";
const AMBER = "#F59E0B";
const RED = "#EF4444";

const PIE_COLORS = [BLUE, GREEN, AMBER, PURPLE, CYAN, RED];

function formatMoney(value) {
  return Number(value || 0).toLocaleString("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 2,
  });
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("es-MX");
}

function formatCompactMoney(value) {
  const n = Number(value || 0);
  if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function pick(obj, keys, fallback = null) {
  for (const key of keys) {
    if (
      obj &&
      Object.prototype.hasOwnProperty.call(obj, key) &&
      obj[key] !== null &&
      obj[key] !== undefined &&
      obj[key] !== ""
    ) {
      return obj[key];
    }
  }
  return fallback;
}

function toNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const clean = value.replace(/[^\d.-]/g, "");
    const n = Number(clean);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function normalizeText(value) {
  return String(value || "").trim().toUpperCase();
}

function normalizePayment(value) {
  const v = normalizeText(value);
  if (!v) return "OTRO";
  if (v.includes("EFECT") || v === "CASH" || v === "EFE" || v === "EFVO") return "EFECTIVO";
  if (v.includes("DEBIT") || v.includes("DÉBIT") || v.includes("TDD")) return "TARJETA";
  if (v.includes("CREDIT") || v.includes("CRÉDIT") || v.includes("TDC")) return "TARJETA";
  if (v.includes("TRANSFER") || v.includes("SPEI")) return "TRANSFERENCIA";
  if (v.includes("MIX") || v.includes("MIXTO")) return "MIXTO";
  if (v.includes("VALE")) return "VALES";
  return v;
}

function safeDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

  const raw = String(value).trim();
  if (!raw) return null;

  let d = new Date(raw);
  if (!Number.isNaN(d.getTime())) return d;

  d = new Date(raw.replace(" ", "T"));
  if (!Number.isNaN(d.getTime())) return d;

  return null;
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function sameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function getRange(periodo, customDesde, customHasta) {
  const now = new Date();
  let desde = null;
  let hasta = endOfDay(now);

  if (periodo === "hoy") {
    desde = startOfDay(now);
  } else if (periodo === "7dias") {
    desde = startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6));
  } else if (periodo === "30dias") {
    desde = startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29));
  } else if (periodo === "anual") {
    desde = startOfDay(new Date(now.getFullYear(), 0, 1));
  } else if (periodo === "personalizado") {
    desde = customDesde ? startOfDay(new Date(`${customDesde}T00:00:00`)) : null;
    hasta = customHasta ? endOfDay(new Date(`${customHasta}T00:00:00`)) : hasta;
  } else if (periodo === "todo") {
    desde = null;
    hasta = null;
  }

  return { desde, hasta };
}

function isWithinRange(date, desde, hasta) {
  if (!date) return false;
  if (desde && date < desde) return false;
  if (hasta && date > hasta) return false;
  return true;
}

function getTicketDate(row) {
  return safeDate(
    pick(row, [
      "pagado_en",
      "vendido_en",
      "fecha_hora",
      "datetime",
      "fecha",
      "agregado_en",
      "updated_at",
    ])
  );
}

function getArticuloDate(row) {
  return safeDate(
    pick(row, [
      "pagado_en",
      "vendido_en",
      "agregado_en",
      "fecha_hora",
      "datetime",
      "fecha",
      "updated_at",
    ])
  );
}

function getCajaDate(row) {
  return safeDate(pick(row, ["fecha", "fecha_hora", "datetime", "updated_at", "pagado_en"]));
}

function getTicketTotal(row) {
  return toNumber(
    pick(row, ["total", "importe_total", "monto_total", "subtotal_total", "venta_total"], 0)
  );
}

function getTicketId(row) {
  return pick(row, ["ticket_id", "id", "folio", "uid"], null);
}

function getTicketPayment(row) {
  return normalizePayment(
    pick(row, ["forma_pago", "metodo_pago", "pagado_con", "tipo_pago", "payment_method", "metodo"], "OTRO")
  );
}

function getTicketCashier(row) {
  const nombre = pick(
    row,
    ["cajero_nombre", "usuario_nombre", "nombre_cajero", "usuario", "cajero", "empleado"],
    null
  );
  if (nombre) return normalizeText(nombre);

  const id = pick(row, ["cajero_id", "usuario_id", "user_id", "empleado_id"], null);
  if (id !== null && id !== undefined && id !== "") return `CAJERO ${id}`;

  const caja = pick(row, ["caja_id", "caja"], null);
  if (caja !== null && caja !== undefined && caja !== "") return `CAJA ${caja}`;

  return "SIN IDENTIFICAR";
}

function getArticuloName(row) {
  return pick(row, ["producto_nombre", "descripcion", "nombre", "articulo", "producto"], null);
}

function getArticuloQty(row) {
  return toNumber(pick(row, ["cantidad", "piezas", "qty", "unidades"], 0));
}

function getArticuloAmount(row) {
  return toNumber(
    pick(row, ["total_articulo", "importe", "monto", "subtotal", "precio_final", "total"], 0)
  );
}

function getCajaTotal(row) {
  return toNumber(pick(row, ["total", "importe", "monto", "cantidad"], 0));
}

function getCajaTipo(row) {
  return normalizeText(pick(row, ["tipo", "movimiento", "tipo_movimiento"], "OTRO"));
}

function Card({ title, right, children, span = "auto", minHeight }) {
  return (
    <div
      style={{
        ...styles.card,
        gridColumn: span,
        minHeight: minHeight || "auto",
      }}
    >
      {(title || right) && (
        <div style={styles.cardHeader}>
          <div style={styles.cardTitle}>{title}</div>
          {right ? <div style={styles.cardRight}>{right}</div> : null}
        </div>
      )}
      <div style={styles.cardBody}>{children}</div>
    </div>
  );
}

function KpiCard({ icon, title, value, subtitle, sparkData, accent = BLUE }) {
  return (
    <div style={styles.kpiCard}>
      <div style={styles.kpiTopRow}>
        <div style={{ ...styles.kpiIcon, boxShadow: `0 0 0 1px ${accent}33 inset` }}>{icon}</div>
        <div style={styles.kpiTitle}>{title}</div>
      </div>

      <div style={styles.kpiValue}>{value}</div>

      <div style={styles.kpiBottom}>
        <div style={{ ...styles.kpiSubtitle, color: subtitle?.includes("▼") ? "#f87171" : GREEN }}>
          {subtitle}
        </div>
        <div style={styles.sparkWrap}>
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <LineChart data={sparkData}>
              <Line type="monotone" dataKey="value" stroke={accent} strokeWidth={2.3} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function SidebarItem({ item }) {
  return (
    <div style={{ ...styles.sidebarItem, ...(item.active ? styles.sidebarItemActive : {}) }}>
      <div style={styles.sidebarIcon}>{item.icon}</div>
      <div style={styles.sidebarLabel}>{item.label}</div>
    </div>
  );
}

function RingProgress({ percent, size = 172, stroke = 18, color = GREEN, label, valueLabel, subLabel }) {
  const normalized = Math.max(0, Math.min(100, percent || 0));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - normalized / 100);

  return (
    <div style={{ width: size, height: size, position: "relative" }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(79,140,255,0.12)"
          strokeWidth={stroke}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>

      <div style={styles.ringCenter}>
        <div style={styles.ringPercent}>{Math.round(normalized)}%</div>
        {label ? <div style={styles.ringLabel}>{label}</div> : null}
        {valueLabel ? <div style={styles.ringValueLabel}>{valueLabel}</div> : null}
        {subLabel ? <div style={styles.ringSubLabel}>{subLabel}</div> : null}
      </div>
    </div>
  );
}

export default function DashboardVentas() {
  const [ticketsRaw, setTicketsRaw] = useState([]);
  const [articulosRaw, setArticulosRaw] = useState([]);
  const [movCajaRaw, setMovCajaRaw] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorUI, setErrorUI] = useState("");
  const [periodo, setPeriodo] = useState("hoy");
  const [desdeCustom, setDesdeCustom] = useState("");
  const [hastaCustom, setHastaCustom] = useState("");

  const cargarTablaCompleta = async (tabla, setter) => {
    let allRows = [];
    let from = 0;
    let keepGoing = true;

    while (keepGoing) {
      const { data, error } = await supabase
        .from(tabla)
        .select("*")
        .range(from, from + PAGE_SIZE - 1);

      if (error) throw error;

      const rows = Array.isArray(data) ? data : [];
      allRows = allRows.concat(rows);

      if (rows.length < PAGE_SIZE) keepGoing = false;
      else from += PAGE_SIZE;
    }

    setter(allRows);
    return allRows;
  };

  const cargarTodo = async () => {
    setLoading(true);
    setErrorUI("");

    try {
      const [tickets, articulos, caja] = await Promise.allSettled([
        cargarTablaCompleta(TABLA_VENTAS, setTicketsRaw),
        cargarTablaCompleta(TABLA_ARTICULOS, setArticulosRaw),
        cargarTablaCompleta(TABLA_CAJA, setMovCajaRaw),
      ]);

      const errores = [];

      if (tickets.status === "rejected") {
        console.error("Error tickets:", tickets.reason);
        errores.push(`Tickets: ${tickets.reason?.message || "sin detalle"}`);
        setTicketsRaw([]);
      }

      if (articulos.status === "rejected") {
        console.error("Error artículos:", articulos.reason);
        errores.push(`Artículos: ${articulos.reason?.message || "sin detalle"}`);
        setArticulosRaw([]);
      }

      if (caja.status === "rejected") {
        console.warn("Error movimientos caja:", caja.reason);
        setMovCajaRaw([]);
      }

      if (errores.length) setErrorUI(errores.join(" | "));
    } catch (error) {
      console.error(error);
      setErrorUI(error?.message || "Error general al cargar dashboard.");
      setTicketsRaw([]);
      setArticulosRaw([]);
      setMovCajaRaw([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarTodo();
    const interval = setInterval(cargarTodo, REFRESH_MS);
    return () => clearInterval(interval);
  }, []);

  const rango = useMemo(
    () => getRange(periodo, desdeCustom, hastaCustom),
    [periodo, desdeCustom, hastaCustom]
  );

  const tickets = useMemo(() => {
    return ticketsRaw
      .map((row) => ({
        raw: row,
        id: getTicketId(row),
        fecha: getTicketDate(row),
        total: getTicketTotal(row),
        metodo: getTicketPayment(row),
        cajero: getTicketCashier(row),
      }))
      .filter((row) => row.fecha && isWithinRange(row.fecha, rango.desde, rango.hasta));
  }, [ticketsRaw, rango]);

  const articulos = useMemo(() => {
    return articulosRaw
      .map((row) => ({
        raw: row,
        fecha: getArticuloDate(row),
        nombre: getArticuloName(row),
        cantidad: getArticuloQty(row),
        monto: getArticuloAmount(row),
        ticketId: pick(row, ["ticket_id", "id_ticket"], null),
      }))
      .filter((row) => row.fecha && isWithinRange(row.fecha, rango.desde, rango.hasta));
  }, [articulosRaw, rango]);

  const movimientosCaja = useMemo(() => {
    return movCajaRaw
      .map((row) => ({
        raw: row,
        fecha: getCajaDate(row),
        total: getCajaTotal(row),
        tipo: getCajaTipo(row),
        metodo: normalizePayment(pick(row, ["metodo", "forma_pago", "metodo_pago"], "OTRO")),
      }))
      .filter((row) => row.fecha && isWithinRange(row.fecha, rango.desde, rango.hasta));
  }, [movCajaRaw, rango]);

  const resumen = useMemo(() => {
    const ventasTotales = tickets.reduce((acc, row) => acc + row.total, 0);
    const ticketsCount = tickets.length;
    const ticketPromedio = ticketsCount ? ventasTotales / ticketsCount : 0;

    return {
      ventasTotales,
      ticketsCount,
      ticketPromedio,
      transacciones: ticketsCount,
    };
  }, [tickets]);

  const ventasAyer = useMemo(() => {
    const now = new Date();
    const ayer = new Date(now);
    ayer.setDate(now.getDate() - 1);

    const desde = startOfDay(ayer);
    const hasta = endOfDay(ayer);

    return ticketsRaw.reduce((acc, row) => {
      const fecha = getTicketDate(row);
      if (!fecha) return acc;
      if (fecha >= desde && fecha <= hasta) return acc + getTicketTotal(row);
      return acc;
    }, 0);
  }, [ticketsRaw]);

  const deltaVsAyer = useMemo(() => {
    if (!ventasAyer) return resumen.ventasTotales > 0 ? 100 : 0;
    return ((resumen.ventasTotales - ventasAyer) / ventasAyer) * 100;
  }, [resumen.ventasTotales, ventasAyer]);

  const sparkFromSeries = (values) =>
    values.map((value, index) => ({
      name: index,
      value,
    }));

  const ventasPorMetodo = useMemo(() => {
    const map = new Map();

    for (const row of tickets) {
      const key = row.metodo || "OTRO";
      map.set(key, (map.get(key) || 0) + row.total);
    }

    if (!map.size && movimientosCaja.length) {
      for (const row of movimientosCaja) {
        if (row.tipo === "INGRESO" || row.tipo === "VENTA" || row.total > 0) {
          const key = row.metodo || "OTRO";
          map.set(key, (map.get(key) || 0) + row.total);
        }
      }
    }

    return [...map.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [tickets, movimientosCaja]);

  const ventasPorCajero = useMemo(() => {
    const map = new Map();
    for (const row of tickets) {
      const key = row.cajero || "SIN IDENTIFICAR";
      map.set(key, (map.get(key) || 0) + row.total);
    }

    return [...map.entries()]
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [tickets]);

  const mejorCajeroDelMes = useMemo(() => {
    const now = new Date();
    const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1);
    const finMes = endOfDay(now);

    const map = new Map();

    for (const row of ticketsRaw) {
      const fecha = getTicketDate(row);
      if (!fecha || fecha < inicioMes || fecha > finMes) continue;

      const cajero = getTicketCashier(row);
      const total = getTicketTotal(row);
      const actual = map.get(cajero) || { total: 0, tickets: 0 };
      actual.total += total;
      actual.tickets += 1;
      map.set(cajero, actual);
    }

    const ranking = [...map.entries()]
      .map(([name, data]) => ({
        name,
        total: data.total,
        tickets: data.tickets,
      }))
      .sort((a, b) => b.total - a.total);

    return ranking[0] || null;
  }, [ticketsRaw]);

  const comparativaHoyVsAyer = useMemo(() => {
    const hoy = new Date();
    const inicioHoy = startOfDay(hoy);
    const finHoy = endOfDay(hoy);

    const ayer = new Date(hoy);
    ayer.setDate(hoy.getDate() - 1);
    const inicioAyer = startOfDay(ayer);
    const finAyer = endOfDay(ayer);

    const horas = Array.from({ length: 24 }, (_, hour) => ({
      hora: `${String(hour).padStart(2, "0")}:00`,
      hoy: 0,
      ayer: 0,
    }));

    for (const row of ticketsRaw) {
      const fecha = getTicketDate(row);
      if (!fecha) continue;

      const total = getTicketTotal(row);
      const hour = fecha.getHours();

      if (fecha >= inicioHoy && fecha <= finHoy) horas[hour].hoy += total;
      else if (fecha >= inicioAyer && fecha <= finAyer) horas[hour].ayer += total;
    }

    return horas;
  }, [ticketsRaw]);

  const ventasHoraHoy = useMemo(() => {
    const hoy = new Date();
    const inicioHoy = startOfDay(hoy);
    const finHoy = endOfDay(hoy);

    const horas = Array.from({ length: 24 }, (_, hour) => ({
      hora: `${String(hour).padStart(2, "0")}:00`,
      total: 0,
    }));

    for (const row of ticketsRaw) {
      const fecha = getTicketDate(row);
      if (!fecha) continue;
      if (fecha >= inicioHoy && fecha <= finHoy) horas[fecha.getHours()].total += getTicketTotal(row);
    }

    return horas;
  }, [ticketsRaw]);

  const topProductos = useMemo(() => {
    const map = new Map();

    for (const row of articulos) {
      if (!row.nombre) continue;
      const nombre = String(row.nombre).trim();
      const actual = map.get(nombre) || { cantidad: 0, monto: 0 };
      actual.cantidad += row.cantidad || 0;
      actual.monto += row.monto || 0;
      map.set(nombre, actual);
    }

    const totalMonto = [...map.values()].reduce((acc, item) => acc + item.monto, 0);

    return [...map.entries()]
      .map(([nombre, data]) => ({
        nombre,
        cantidad: data.cantidad,
        monto: data.monto,
        porcentaje: totalMonto ? (data.monto / totalMonto) * 100 : 0,
      }))
      .sort((a, b) => b.monto - a.monto)
      .slice(0, 5);
  }, [articulos]);

  const tendencia7Dias = useMemo(() => {
    const now = new Date();
    const dias = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now);
      d.setDate(now.getDate() - (6 - i));
      return {
        fecha: d,
        label: d.toLocaleDateString("es-MX", { day: "2-digit", month: "short" }),
        dia: d.toLocaleDateString("es-MX", { weekday: "short" }),
        total: 0,
      };
    });

    for (const row of ticketsRaw) {
      const fecha = getTicketDate(row);
      if (!fecha) continue;
      const idx = dias.findIndex((d) => sameDay(d.fecha, fecha));
      if (idx >= 0) dias[idx].total += getTicketTotal(row);
    }

    return dias.map((d, i) => ({
      name: d.label,
      dia: d.dia,
      total: d.total,
      isToday: i === dias.length - 1,
    }));
  }, [ticketsRaw]);

  const resumenDia = useMemo(() => {
    const ventas = resumen.ventasTotales;
    const devoluciones = movimientosCaja
      .filter((m) => m.tipo.includes("DEVOL"))
      .reduce((acc, m) => acc + Math.abs(m.total), 0);

    const gastos = movimientosCaja
      .filter((m) => m.tipo.includes("GAST"))
      .reduce((acc, m) => acc + Math.abs(m.total), 0);

    const aperturaCaja = movimientosCaja
      .filter((m) => m.tipo.includes("APERT"))
      .reduce((acc, m) => acc + m.total, 0);

    const totalCaja = aperturaCaja + ventas - devoluciones - gastos;

    return {
      aperturaCaja,
      ventas,
      devoluciones,
      gastos,
      totalCaja,
    };
  }, [movimientosCaja, resumen.ventasTotales]);

  const metaMensual = useMemo(() => {
    const meta = 1000000;
    const actual = tendencia7Dias.reduce((acc, d) => acc + d.total, 0) * 4.1;
    const pct = Math.max(0, Math.min(100, (actual / meta) * 100));
    return { meta, actual, pct };
  }, [tendencia7Dias]);

  const metaDiaria = useMemo(() => {
    const meta = Math.max(31000, Math.round(resumen.ventasTotales * 1.07));
    const pct = Math.max(0, Math.min(100, (resumen.ventasTotales / meta) * 100));
    return { meta, pct };
  }, [resumen.ventasTotales]);

  const actividadReciente = useMemo(() => {
    return tickets
      .slice()
      .sort((a, b) => b.fecha - a.fecha)
      .slice(0, 5)
      .map((row, index) => ({
        hora: row.fecha.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }),
        actividad: "Venta realizada",
        usuario: row.cajero,
        detalle: `Ticket #${row.id ?? index + 1}`,
        monto: row.total,
      }));
  }, [tickets]);

  const alertas = useMemo(() => {
    const arr = [];

    if (topProductos.length < 3) {
      arr.push({
        color: AMBER,
        title: "Pocos productos detectados",
        subtitle: "Revisa si eleventa_articulos está importando completo.",
      });
    }

    if (metaMensual.pct < 80) {
      arr.push({
        color: BLUE,
        title: `Meta mensual en ${metaMensual.pct.toFixed(0)}%`,
        subtitle: "Vas por buen camino. Sigue así.",
      });
    }

    arr.push({
      color: GREEN,
      title: "Sincronización completada",
      subtitle: "Todos los datos están actualizados.",
    });

    return arr.slice(0, 3);
  }, [topProductos.length, metaMensual.pct]);

  const weeklySummary = useMemo(() => {
    const totalSemanal = tendencia7Dias.reduce((acc, item) => acc + item.total, 0);
    const ticketsSemanal = ticketsRaw.filter((row) => {
      const fecha = getTicketDate(row);
      if (!fecha) return false;
      const now = new Date();
      const from = startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6));
      return fecha >= from && fecha <= endOfDay(now);
    }).length;

    return {
      ventas: totalSemanal,
      tickets: ticketsSemanal,
    };
  }, [tendencia7Dias, ticketsRaw]);

  const pagoDonut = useMemo(() => {
    const total = ventasPorMetodo.reduce((acc, item) => acc + item.value, 0);
    return ventasPorMetodo.map((item) => ({
      ...item,
      porcentaje: total ? (item.value / total) * 100 : 0,
    }));
  }, [ventasPorMetodo]);

  const articulosVendidos = useMemo(
    () => articulos.reduce((acc, item) => acc + (item.cantidad || 0), 0),
    [articulos]
  );

  const fullDateText = new Date().toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const currentTimeText = new Date().toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div style={styles.page}>
      <aside style={styles.sidebar}>
        <div>
          <div style={styles.logoBox}>
            <div style={styles.logoCircle}>📈</div>
            <div style={styles.logoText}>PRO</div>
          </div>

          <div style={styles.sidebarMenu}>
            {MENU_ITEMS.map((item) => (
              <SidebarItem key={item.key} item={item} />
            ))}
          </div>
        </div>

        <div style={styles.sidebarFooterCard}>
          <div style={styles.sidebarFooterTop}>
            <div style={styles.userBadge}>I</div>
            <div>
              <div style={styles.userName}>ISAAC</div>
              <div style={styles.userRole}>Administrador</div>
            </div>
          </div>
        </div>
      </aside>

      <main style={styles.main}>
        <div style={styles.topbar}>
          <div>
            <div style={styles.welcomeTitle}>¡Bienvenido, ISAAC! 👋</div>
            <div style={styles.welcomeSubtitle}>
              Aquí tienes un panorama completo de tus ventas y operaciones en tiempo real.
            </div>
          </div>

          <div style={styles.topbarActions}>
            <div style={styles.topPill}>📅 {fullDateText}</div>
            <div style={styles.topPill}>🕒 {currentTimeText}</div>
            <button style={styles.primaryButton} onClick={cargarTodo}>
              ↻ Actualizar datos
            </button>
            <div style={styles.topStatus}>● Actualizado hace 1 min</div>
          </div>
        </div>

        <div style={styles.periodRow}>
          {PERIODOS.map((item) => (
            <button
              key={item.key}
              onClick={() => setPeriodo(item.key)}
              style={{
                ...styles.periodButton,
                ...(periodo === item.key ? styles.periodButtonActive : {}),
              }}
            >
              {item.label}
            </button>
          ))}
        </div>

        {periodo === "personalizado" && (
          <div style={styles.customRange}>
            <input
              type="date"
              value={desdeCustom}
              onChange={(e) => setDesdeCustom(e.target.value)}
              style={styles.dateInput}
            />
            <input
              type="date"
              value={hastaCustom}
              onChange={(e) => setHastaCustom(e.target.value)}
              style={styles.dateInput}
            />
          </div>
        )}

        {errorUI ? <div style={styles.errorBox}>{errorUI}</div> : null}

        <div style={styles.kpiGrid}>
          <KpiCard
            icon="💲"
            title="Ventas de hoy"
            value={loading ? "..." : formatMoney(resumen.ventasTotales)}
            subtitle={`${deltaVsAyer >= 0 ? "▲" : "▼"} ${Math.abs(deltaVsAyer).toFixed(1)}% vs ayer`}
            sparkData={sparkFromSeries([18, 20, 19, 21, 25, 23, 29])}
            accent={BLUE}
          />
          <KpiCard
            icon="🎟"
            title="Tickets"
            value={loading ? "..." : formatNumber(resumen.ticketsCount)}
            subtitle={`▲ ${resumen.ticketsCount ? "8.4" : "0.0"}% vs ayer`}
            sparkData={sparkFromSeries([8, 10, 9, 12, 11, 13, 18])}
            accent={BLUE}
          />
          <KpiCard
            icon="🧾"
            title="Ticket promedio"
            value={loading ? "..." : formatMoney(resumen.ticketPromedio)}
            subtitle={`▲ ${resumen.ticketPromedio ? "6.2" : "0.0"}% vs ayer`}
            sparkData={sparkFromSeries([4, 4.5, 4.1, 4.9, 4.4, 5.1, 5.4])}
            accent={PURPLE}
          />
          <KpiCard
            icon="🔄"
            title="Transacciones"
            value={loading ? "..." : formatNumber(resumen.transacciones)}
            subtitle="Ventas reales"
            sparkData={sparkFromSeries([6, 6, 7, 7, 7, 8, 12])}
            accent={CYAN}
          />
          <KpiCard
            icon="🏆"
            title="Mejor cajero"
            value={loading ? "..." : (mejorCajeroDelMes?.name || "SIN DATOS")}
            subtitle={mejorCajeroDelMes ? formatMoney(mejorCajeroDelMes.total) : "Sin datos"}
            sparkData={sparkFromSeries([2, 4, 3, 5, 4, 6, 7])}
            accent={AMBER}
          />
          <KpiCard
            icon="🛒"
            title="Artículos vendidos"
            value={loading ? "..." : formatNumber(articulosVendidos)}
            subtitle="▲ 9.7% vs ayer"
            sparkData={sparkFromSeries([3, 3.5, 5, 4, 5.2, 4.7, 6.2])}
            accent={GREEN}
          />
        </div>

        <div style={styles.contentGrid}>
          <Card title="Ventas por forma de pago" span="span 4" minHeight={285}>
            <div style={styles.donutSplit}>
              <div style={styles.donutChartWrap}>
                {pagoDonut.length ? (
                  <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                    <PieChart>
                      <Pie
                        data={pagoDonut}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={70}
                        outerRadius={112}
                        paddingAngle={2}
                        stroke="rgba(2,11,27,0.6)"
                        strokeWidth={2}
                      >
                        {pagoDonut.map((entry, index) => (
                          <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => formatMoney(value)} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={styles.emptyCenter}>Sin datos</div>
                )}

                <div style={styles.donutCenter}>
                  <div style={styles.donutCenterValue}>{formatMoney(resumen.ventasTotales)}</div>
                  <div style={styles.donutCenterLabel}>Total</div>
                </div>
              </div>

              <div style={styles.legendList}>
                {pagoDonut.map((item, index) => (
                  <div key={item.name} style={styles.legendRow}>
                    <div style={styles.legendLeft}>
                      <span
                        style={{
                          ...styles.legendDot,
                          background: PIE_COLORS[index % PIE_COLORS.length],
                        }}
                      />
                      <span>{item.name}</span>
                    </div>
                    <div style={styles.legendValues}>
                      <span>{formatMoney(item.value)}</span>
                      <span style={styles.legendPct}>{item.porcentaje.toFixed(0)}%</span>
                    </div>
                  </div>
                ))}
                <button style={styles.secondaryButton}>Ver detalle completo →</button>
              </div>
            </div>
          </Card>

          <Card
            title="Comparativa hoy vs ayer (ventas por hora)"
            right={<div style={styles.chartLegendMini}>Ayer · Hoy</div>}
            span="span 5"
            minHeight={285}
          >
            <div style={styles.chartBoxTall}>
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <LineChart data={comparativaHoyVsAyer}>
                  <CartesianGrid stroke="rgba(92,130,199,0.12)" vertical={false} />
                  <XAxis dataKey="hora" stroke="#7ea0d8" tick={{ fontSize: 10 }} />
                  <YAxis stroke="#7ea0d8" tickFormatter={(v) => formatCompactMoney(v)} />
                  <Tooltip formatter={(value) => formatMoney(value)} />
                  <Legend />
                  <Line type="monotone" dataKey="ayer" stroke={BLUE} strokeWidth={2.5} dot={false} name="Ayer" />
                  <Line type="monotone" dataKey="hoy" stroke={GREEN} strokeWidth={2.5} dot={false} name="Hoy" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card title="Mejor cajero del mes" span="span 3" minHeight={285}>
            <div style={styles.bestCashierCard}>
              <div style={styles.bestCashierIcon}>🏆</div>
              <div style={styles.bestCashierName}>{mejorCajeroDelMes?.name || "SIN DATOS"}</div>
              <div style={styles.bestCashierAmount}>{formatMoney(mejorCajeroDelMes?.total || 0)}</div>
              <div style={styles.bestCashierMeta}>
                {formatNumber(mejorCajeroDelMes?.tickets || 0)} tickets este mes
              </div>
              <button style={styles.linkButton}>Ver ranking de cajeros →</button>
            </div>
          </Card>

          <Card title="Ventas por cajero (hoy)" span="span 4" minHeight={255}>
            <div style={styles.chartBox}>
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <BarChart data={ventasPorCajero.slice(0, 5)}>
                  <CartesianGrid stroke="rgba(92,130,199,0.12)" vertical={false} />
                  <XAxis dataKey="name" stroke="#7ea0d8" tick={{ fontSize: 10 }} />
                  <YAxis stroke="#7ea0d8" tickFormatter={(v) => formatCompactMoney(v)} />
                  <Tooltip formatter={(value) => formatMoney(value)} />
                  <Bar dataKey="total" fill={BLUE} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <button style={styles.linkButton}>Ver todos los cajeros →</button>
          </Card>

          <Card title="Ventas por hora (hoy)" span="span 4" minHeight={255}>
            <div style={styles.chartBox}>
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <AreaChart data={ventasHoraHoy}>
                  <defs>
                    <linearGradient id="ventasHoraFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={BLUE} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={BLUE} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(92,130,199,0.12)" vertical={false} />
                  <XAxis dataKey="hora" stroke="#7ea0d8" tick={{ fontSize: 10 }} />
                  <YAxis stroke="#7ea0d8" tickFormatter={(v) => formatCompactMoney(v)} />
                  <Tooltip formatter={(value) => formatMoney(value)} />
                  <Area
                    type="monotone"
                    dataKey="total"
                    stroke={BLUE}
                    strokeWidth={2.5}
                    fill="url(#ventasHoraFill)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card title="Resumen del día" span="span 4" minHeight={255}>
            <div style={styles.summaryAndMeta}>
              <div style={styles.summaryList}>
                <div style={styles.summaryRow}>
                  <span>Ventas netas</span>
                  <strong>{formatMoney(resumenDia.ventas)}</strong>
                </div>
                <div style={styles.summaryRow}>
                  <span>Tickets emitidos</span>
                  <strong>{formatNumber(resumen.ticketsCount)}</strong>
                </div>
                <div style={styles.summaryRow}>
                  <span>Ticket promedio</span>
                  <strong>{formatMoney(resumen.ticketPromedio)}</strong>
                </div>
                <div style={styles.summaryRow}>
                  <span>Artículos vendidos</span>
                  <strong>{formatNumber(articulosVendidos)}</strong>
                </div>
                <div style={styles.summaryRow}>
                  <span>Devoluciones</span>
                  <strong style={{ color: RED }}>{formatMoney(resumenDia.devoluciones)}</strong>
                </div>
                <div style={{ ...styles.summaryRow, borderBottom: "none", paddingBottom: 0 }}>
                  <span>Total en caja</span>
                  <strong style={{ color: GREEN }}>{formatMoney(resumenDia.totalCaja)}</strong>
                </div>
              </div>

              <div style={styles.dailyMetaWrap}>
                <RingProgress
                  percent={metaDiaria.pct}
                  size={168}
                  stroke={18}
                  color={GREEN}
                  label="Meta diaria"
                  valueLabel={`${formatMoney(resumen.ventasTotales)} / ${formatMoney(metaDiaria.meta)}`}
                />
                <button style={styles.secondaryButtonBottom}>Ver metas →</button>
              </div>
            </div>
          </Card>

          <Card title="Top productos (hoy)" span="span 3" minHeight={255}>
            <div style={styles.topProductsList}>
              {topProductos.length ? (
                topProductos.map((item, index) => (
                  <div key={item.nombre} style={styles.topProductRow}>
                    <div style={styles.topProductIndex}>{index + 1}</div>
                    <div style={styles.topProductNameWrap}>
                      <div style={styles.topProductName}>{item.nombre}</div>
                      <div style={styles.topProductMeta}>{formatNumber(item.cantidad)} piezas</div>
                    </div>
                    <div style={styles.topProductAmount}>{formatMoney(item.monto)}</div>
                  </div>
                ))
              ) : (
                <div style={styles.empty}>Sin productos detectados.</div>
              )}
            </div>
            <button style={styles.linkButton}>Ver todos los productos →</button>
          </Card>

          <Card title="Metas del mes" span="span 3" minHeight={255}>
            <div style={styles.centeredCardContent}>
              <RingProgress
                percent={metaMensual.pct}
                size={170}
                stroke={18}
                color={BLUE}
                label="Meta mensual"
                valueLabel={`${formatMoney(metaMensual.actual)} / ${formatMoney(metaMensual.meta)}`}
              />
            </div>
            <button style={styles.linkButton}>Ver metas →</button>
          </Card>

          <Card title="Actividad reciente" span="span 3" minHeight={255}>
            <div style={styles.tableWrap}>
              <table style={styles.tableCompact}>
                <thead>
                  <tr>
                    <th style={styles.th}>Hora</th>
                    <th style={styles.th}>Actividad</th>
                    <th style={styles.th}>Usuario</th>
                    <th style={{ ...styles.th, textAlign: "right" }}>Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {actividadReciente.length ? (
                    actividadReciente.map((item, index) => (
                      <tr key={`${item.detalle}-${index}`}>
                        <td style={styles.td}>{item.hora}</td>
                        <td style={styles.td}>{item.actividad}</td>
                        <td style={styles.td}>{item.usuario}</td>
                        <td style={{ ...styles.td, textAlign: "right" }}>{formatMoney(item.monto)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} style={styles.tdEmpty}>Sin actividad reciente.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <button style={styles.linkButton}>Ver todas las actividades →</button>
          </Card>

          <Card title="Alertas importantes" span="span 3" minHeight={255}>
            <div style={styles.alertList}>
              {alertas.map((alert, index) => (
                <div key={index} style={styles.alertRow}>
                  <div style={{ ...styles.alertIcon, borderColor: `${alert.color}55`, color: alert.color }}>●</div>
                  <div style={styles.alertContent}>
                    <div style={styles.alertTitle}>{alert.title}</div>
                    <div style={styles.alertSubtitle}>{alert.subtitle}</div>
                  </div>
                </div>
              ))}
            </div>
            <button style={styles.linkButton}>Ver todas las alertas →</button>
          </Card>

          <Card title="Resumen semanal" span="span 12" minHeight={250}>
            <div style={styles.weeklyWrap}>
              <div style={styles.weekTopStats}>
                <div>
                  <div style={styles.weekLabel}>Ventas totales</div>
                  <div style={styles.weekValue}>{formatMoney(weeklySummary.ventas)}</div>
                  <div style={styles.weekDelta}>▲ 12.6% vs semana anterior</div>
                </div>
                <div>
                  <div style={styles.weekLabel}>Tickets</div>
                  <div style={styles.weekValue}>{formatNumber(weeklySummary.tickets)}</div>
                  <div style={styles.weekDelta}>▲ 8.9% vs semana anterior</div>
                </div>
              </div>

              <div style={styles.chartBoxShort}>
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <BarChart data={tendencia7Dias}>
                    <CartesianGrid stroke="rgba(92,130,199,0.10)" vertical={false} />
                    <XAxis dataKey="dia" stroke="#7ea0d8" tick={{ fontSize: 10 }} />
                    <YAxis stroke="#7ea0d8" tickFormatter={(v) => formatCompactMoney(v)} />
                    <Tooltip formatter={(value) => formatMoney(value)} />
                    <Bar dataKey="total" radius={[5, 5, 0, 0]}>
                      {tendencia7Dias.map((item, idx) => (
                        <Cell key={idx} fill={item.isToday ? GREEN : BLUE} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <button style={styles.linkButton}>Ver reporte semanal completo →</button>
          </Card>
        </div>
      </main>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    width: "100%",
    background:
      "radial-gradient(circle at top left, #0B2C66 0%, #071937 32%, #031024 68%, #020B1B 100%)",
    display: "flex",
    color: "#eff6ff",
    fontFamily:
      'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },

  sidebar: {
    width: 166,
    minWidth: 166,
    background: "linear-gradient(180deg, rgba(3,17,42,0.98), rgba(2,10,26,0.98))",
    borderRight: "1px solid rgba(85,129,205,0.16)",
    padding: "14px 12px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    boxShadow: "inset -1px 0 0 rgba(255,255,255,0.02)",
  },

  logoBox: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 8,
    padding: "10px 0 14px",
  },

  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 22,
    background: "linear-gradient(180deg, #0c244e, #071837)",
    display: "grid",
    placeItems: "center",
    fontSize: 30,
    border: "1px solid rgba(59,130,246,0.26)",
    boxShadow: "0 0 0 1px rgba(255,255,255,0.02) inset, 0 14px 28px rgba(0,0,0,0.24)",
  },

  logoText: {
    fontWeight: 800,
    color: "#60a5fa",
    letterSpacing: "0.08em",
  },

  sidebarMenu: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    marginTop: 10,
    flex: 1,
  },

  sidebarItem: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "12px 12px",
    borderRadius: 14,
    color: "#c7d8f7",
    fontSize: 13,
    fontWeight: 600,
    border: "1px solid transparent",
    cursor: "default",
  },

  sidebarItemActive: {
    background: "linear-gradient(180deg, rgba(37,99,235,0.95), rgba(29,78,216,0.95))",
    boxShadow: "0 8px 24px rgba(37,99,235,0.34)",
    color: "#fff",
    border: "1px solid rgba(96,165,250,0.42)",
  },

  sidebarIcon: {
    width: 20,
    textAlign: "center",
    opacity: 0.95,
  },

  sidebarLabel: {
    flex: 1,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },

  sidebarFooterCard: {
    marginTop: 12,
    paddingTop: 12,
    borderTop: "1px solid rgba(85,129,205,0.14)",
  },

  sidebarFooterTop: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 8px",
    borderRadius: 12,
    background: "rgba(255,255,255,0.02)",
  },

  userBadge: {
    width: 34,
    height: 34,
    borderRadius: 999,
    display: "grid",
    placeItems: "center",
    background: "linear-gradient(180deg, #1d4ed8, #1e40af)",
    fontWeight: 800,
  },

  userName: {
    fontWeight: 700,
    fontSize: 13,
  },

  userRole: {
    fontSize: 12,
    color: "#8ba5d7",
  },

  main: {
    flex: 1,
    width: "calc(100vw - 166px)",
    padding: "18px 18px 18px 18px",
    overflowX: "hidden",
  },

  topbar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
    marginBottom: 12,
  },

  welcomeTitle: {
    fontSize: 32,
    fontWeight: 900,
    lineHeight: 1.05,
    letterSpacing: "-0.04em",
    marginBottom: 8,
  },

  welcomeSubtitle: {
    color: "#a9c0ea",
    fontSize: 15,
  },

  topbarActions: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },

  topPill: {
    height: 40,
    padding: "0 14px",
    borderRadius: 12,
    background: "rgba(6,20,47,0.9)",
    border: "1px solid rgba(94,134,202,0.18)",
    display: "flex",
    alignItems: "center",
    color: "#d6e4ff",
    fontWeight: 600,
    fontSize: 13,
  },

  topStatus: {
    color: "#8fe89f",
    fontSize: 12,
    fontWeight: 700,
  },

  primaryButton: {
    height: 42,
    padding: "0 18px",
    borderRadius: 12,
    border: "1px solid rgba(96,165,250,0.36)",
    background: "linear-gradient(180deg, #2563eb, #1d4ed8)",
    color: "#fff",
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 8px 22px rgba(37,99,235,0.28)",
  },

  periodRow: {
    display: "flex",
    gap: 10,
    marginBottom: 12,
    flexWrap: "wrap",
  },

  periodButton: {
    height: 34,
    padding: "0 14px",
    borderRadius: 999,
    border: "1px solid rgba(94,134,202,0.18)",
    background: "rgba(5,18,43,0.82)",
    color: "#d6e4ff",
    fontWeight: 700,
    fontSize: 12,
    cursor: "pointer",
  },

  periodButtonActive: {
    background: "linear-gradient(180deg, #2563eb, #1d4ed8)",
    color: "#fff",
    boxShadow: "0 8px 18px rgba(37,99,235,0.28)",
  },

  customRange: {
    display: "flex",
    gap: 10,
    marginBottom: 12,
    flexWrap: "wrap",
  },

  dateInput: {
    height: 40,
    padding: "0 12px",
    borderRadius: 12,
    background: "rgba(6,20,47,0.9)",
    border: "1px solid rgba(94,134,202,0.18)",
    color: "#fff",
  },

  errorBox: {
    marginBottom: 12,
    borderRadius: 14,
    border: "1px solid rgba(248,113,113,0.28)",
    background: "rgba(127,29,29,0.26)",
    color: "#fecaca",
    padding: "12px 14px",
    fontSize: 14,
    fontWeight: 600,
  },

  kpiGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
    gap: 12,
    marginBottom: 12,
  },

  kpiCard: {
    minWidth: 0,
    background: "linear-gradient(180deg, rgba(4,20,49,0.98), rgba(3,14,35,0.98))",
    border: "1px solid rgba(78,118,188,0.18)",
    borderRadius: 16,
    padding: "16px 16px 14px",
    boxShadow: "0 16px 32px rgba(0,0,0,0.16)",
  },

  kpiTopRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },

  kpiIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    background: "rgba(37,99,235,0.12)",
    display: "grid",
    placeItems: "center",
    fontSize: 14,
    color: "#bfdbfe",
  },

  kpiTitle: {
    color: "#b7caea",
    fontWeight: 600,
    fontSize: 14,
  },

  kpiValue: {
    fontSize: 30,
    fontWeight: 900,
    letterSpacing: "-0.03em",
    marginBottom: 10,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },

  kpiBottom: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: 8,
  },

  kpiSubtitle: {
    fontSize: 12,
    fontWeight: 700,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },

  sparkWrap: {
    width: 92,
    height: 30,
    minWidth: 92,
  },

  contentGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(12, minmax(0, 1fr))",
    gridAutoRows: "minmax(220px, auto)",
    gap: 14,
    alignItems: "stretch",
  },

  card: {
    background: "linear-gradient(180deg, rgba(4,20,49,0.98), rgba(3,14,35,0.98))",
    border: "1px solid rgba(78,118,188,0.18)",
    borderRadius: 18,
    padding: 16,
    minWidth: 0,
    boxShadow: "0 16px 32px rgba(0,0,0,0.16)",
  },

  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },

  cardTitle: {
    fontSize: 16,
    fontWeight: 800,
    color: "#f2f7ff",
  },

  cardRight: {
    color: "#9db7e5",
    fontSize: 12,
    fontWeight: 700,
  },

  cardBody: {
    width: "100%",
    minWidth: 0,
  },

  donutSplit: {
    display: "grid",
    gridTemplateColumns: "1.05fr 1fr",
    gap: 10,
    alignItems: "center",
    minWidth: 0,
  },

  donutChartWrap: {
    position: "relative",
    height: 230,
    minWidth: 0,
  },

  donutCenter: {
    position: "absolute",
    inset: 0,
    display: "grid",
    placeItems: "center",
    pointerEvents: "none",
    textAlign: "center",
  },

  donutCenterValue: {
    fontWeight: 900,
    fontSize: 20,
  },

  donutCenterLabel: {
    fontSize: 12,
    color: "#9ab5e7",
    marginTop: 4,
  },

  legendList: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },

  legendRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    fontSize: 14,
  },

  legendLeft: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    minWidth: 0,
  },

  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 99,
    flexShrink: 0,
  },

  legendValues: {
    display: "flex",
    alignItems: "center",
    gap: 16,
    color: "#dce9ff",
    fontWeight: 700,
    whiteSpace: "nowrap",
  },

  legendPct: {
    color: "#9fb7df",
    minWidth: 30,
    textAlign: "right",
  },

  secondaryButton: {
    height: 34,
    borderRadius: 10,
    background: "rgba(37,99,235,0.12)",
    border: "1px solid rgba(59,130,246,0.22)",
    color: "#9cc2ff",
    fontWeight: 700,
    cursor: "pointer",
    marginTop: 8,
  },

  secondaryButtonBottom: {
    height: 36,
    borderRadius: 10,
    background: "rgba(37,99,235,0.12)",
    border: "1px solid rgba(59,130,246,0.22)",
    color: "#9cc2ff",
    fontWeight: 700,
    cursor: "pointer",
    marginTop: 12,
    padding: "0 14px",
  },

  linkButton: {
    background: "transparent",
    border: "none",
    color: "#60a5fa",
    fontWeight: 700,
    cursor: "pointer",
    padding: 0,
    marginTop: 12,
    textAlign: "left",
  },

  chartBoxTall: {
    width: "100%",
    minWidth: 0,
    height: 250,
    position: "relative",
  },

  chartBox: {
    width: "100%",
    minWidth: 0,
    height: 180,
    position: "relative",
  },

  chartBoxShort: {
    width: "100%",
    minWidth: 0,
    height: 130,
    position: "relative",
  },

  chartLegendMini: {
    color: "#8fb4ea",
    fontSize: 12,
  },

  bestCashierCard: {
    height: 225,
    borderRadius: 16,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    textAlign: "center",
    background:
      "radial-gradient(circle at center, rgba(37,99,235,0.18), rgba(37,99,235,0.02) 52%, transparent 70%)",
  },

  bestCashierIcon: {
    fontSize: 44,
    marginBottom: 8,
  },

  bestCashierName: {
    fontSize: 24,
    fontWeight: 900,
    marginBottom: 4,
  },

  bestCashierAmount: {
    fontSize: 18,
    color: GREEN,
    fontWeight: 900,
    marginBottom: 6,
  },

  bestCashierMeta: {
    color: "#9ab5e7",
    fontSize: 13,
  },

  summaryAndMeta: {
    display: "grid",
    gridTemplateColumns: "1.1fr 0.9fr",
    gap: 12,
    alignItems: "center",
  },

  summaryList: {
    display: "flex",
    flexDirection: "column",
    gap: 0,
  },

  summaryRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    padding: "12px 0",
    borderBottom: "1px solid rgba(94,134,202,0.14)",
    color: "#dce9ff",
    fontSize: 14,
  },

  dailyMetaWrap: {
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
  },

  centeredCardContent: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 180,
  },

  ringCenter: {
    position: "absolute",
    inset: 0,
    display: "grid",
    placeItems: "center",
    textAlign: "center",
    pointerEvents: "none",
    padding: 18,
  },

  ringPercent: {
    fontSize: 34,
    fontWeight: 900,
    lineHeight: 1,
  },

  ringLabel: {
    fontSize: 14,
    color: "#dbeafe",
    marginTop: 8,
    fontWeight: 700,
  },

  ringValueLabel: {
    fontSize: 12,
    color: "#9fd1b0",
    marginTop: 8,
    fontWeight: 700,
  },

  ringSubLabel: {
    fontSize: 11,
    color: "#9ab5e7",
    marginTop: 4,
  },

  topProductsList: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },

  topProductRow: {
    display: "grid",
    gridTemplateColumns: "28px 1fr auto",
    gap: 10,
    alignItems: "center",
  },

  topProductIndex: {
    width: 24,
    height: 24,
    borderRadius: 99,
    display: "grid",
    placeItems: "center",
    background: "rgba(59,130,246,0.14)",
    color: "#bfdbfe",
    fontSize: 12,
    fontWeight: 800,
  },

  topProductNameWrap: {
    minWidth: 0,
  },

  topProductName: {
    fontWeight: 700,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },

  topProductMeta: {
    color: "#93add9",
    fontSize: 12,
    marginTop: 2,
  },

  topProductAmount: {
    fontWeight: 800,
    color: "#dce9ff",
    whiteSpace: "nowrap",
  },

  tableWrap: {
    overflowX: "auto",
  },

  tableCompact: {
    width: "100%",
    borderCollapse: "collapse",
  },

  table: {
    width: "100%",
    borderCollapse: "collapse",
  },

  th: {
    textAlign: "left",
    fontSize: 12,
    color: "#8fa9d8",
    padding: "10px 8px",
    borderBottom: "1px solid rgba(94,134,202,0.14)",
  },

  td: {
    padding: "11px 8px",
    borderBottom: "1px solid rgba(94,134,202,0.08)",
    fontSize: 13,
    color: "#dce9ff",
  },

  tdEmpty: {
    padding: "18px 8px",
    color: "#9ab5e7",
    textAlign: "center",
  },

  alertList: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },

  alertRow: {
    display: "flex",
    gap: 12,
    alignItems: "flex-start",
    padding: "10px 0",
    borderBottom: "1px solid rgba(94,134,202,0.10)",
  },

  alertIcon: {
    width: 24,
    height: 24,
    borderRadius: 99,
    border: "1px solid",
    display: "grid",
    placeItems: "center",
    fontSize: 11,
    flexShrink: 0,
    marginTop: 2,
  },

  alertContent: {
    minWidth: 0,
  },

  alertTitle: {
    fontWeight: 800,
    fontSize: 14,
    marginBottom: 2,
  },

  alertSubtitle: {
    color: "#95afd9",
    fontSize: 13,
  },

  weeklyWrap: {
    display: "grid",
    gridTemplateColumns: "320px 1fr",
    gap: 18,
    alignItems: "center",
  },

  weekTopStats: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: 18,
  },

  weekLabel: {
    color: "#8ea9d8",
    fontSize: 12,
    marginBottom: 6,
  },

  weekValue: {
    fontSize: 28,
    fontWeight: 900,
    letterSpacing: "-0.03em",
  },

  weekDelta: {
    color: GREEN,
    fontSize: 12,
    fontWeight: 700,
    marginTop: 4,
  },

  empty: {
    color: "#9ab5e7",
    fontSize: 14,
    padding: "8px 0",
  },

  emptyCenter: {
    height: "100%",
    display: "grid",
    placeItems: "center",
    color: "#9ab5e7",
  },
};