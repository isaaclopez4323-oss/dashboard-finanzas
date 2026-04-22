import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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
} from "recharts";
import { supabase } from "../../supabase";

const TABLA_VENTAS = "eleventa_tickets";
const TABLA_ARTICULOS = "eleventa_articulos";
const TABLA_CAJA = "eleventa_movimientos_caja";

const NOMBRES_CAJEROS = {
  "8": "MAYRA",
  "9": "CLAUDIA",
  "10": "SUSANA",
};

const REFRESH_MS = 0;
const PAGE_SIZE = 1000;

const PERIODOS = [
  { key: "hoy", label: "HOY" },
  { key: "semanal", label: "SEMANAL" },
  { key: "mensual", label: "MENSUAL" },
  { key: "anual", label: "ANUAL" },
  { key: "todo", label: "TODO" },
];

function formatMoney(value) {
  const n = Number(value || 0);
  return n.toLocaleString("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 2,
  });
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("es-MX");
}

function formatHour(date) {
  return `${String(date.getHours()).padStart(2, "0")}:00`;
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

function startOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfWeek(date) {
  const d = startOfWeek(date);
  d.setDate(d.getDate() + 6);
  d.setHours(23, 59, 59, 999);
  return d;
}

function startOfMonth(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfMonth(date) {
  const d = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  d.setHours(23, 59, 59, 999);
  return d;
}

function startOfYear(date) {
  const d = new Date(date.getFullYear(), 0, 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfYear(date) {
  const d = new Date(date.getFullYear(), 11, 31);
  d.setHours(23, 59, 59, 999);
  return d;
}

function isValidDate(date) {
  return date instanceof Date && !Number.isNaN(date.getTime());
}

function toNumber(value) {
  if (value === null || value === undefined || value === "") return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function cleanText(value) {
  return String(value ?? "").trim();
}

function parseFechaSegura(valor) {
  if (!valor) return null;

  if (valor instanceof Date && isValidDate(valor)) return valor;

  const texto = String(valor).trim();
  if (!texto) return null;

  const intentoDirecto = new Date(texto);
  if (isValidDate(intentoDirecto)) return intentoDirecto;

  const intentoConT = new Date(texto.replace(" ", "T"));
  if (isValidDate(intentoConT)) return intentoConT;

  const match = texto.match(
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?$/
  );

  if (match) {
    const [, y, m, d, hh, mm, ss] = match;

    const fechaLocal = new Date(
      Number(y),
      Number(m) - 1,
      Number(d),
      Number(hh),
      Number(mm),
      Number(ss),
      0
    );

    if (isValidDate(fechaLocal)) return fechaLocal;
  }

  return null;
}

function parseFecha(row) {
  const posiblesCampos = [
    row.pagado_en,
    row.PAGADO_EN,
    row.vendido_en,
    row.VENDIDO_EN,
    row.fecha_hora,
    row.FECHA_HORA,
    row.datetime,
    row.fecha,
    row.created_at,
    row.fecha_ticket,
    row.fechahora,
    row.updated_at,
  ];

  for (const valor of posiblesCampos) {
    const fecha = parseFechaSegura(valor);
    if (fecha) return fecha;
  }

  return null;
}

function normalizarFormaPago(raw) {
  const valor = String(raw || "").trim().toLowerCase();

  if (!valor) return "No especificado";
  if (["e", "efectivo", "cash"].includes(valor)) return "Efectivo";
  if (["p", "tarjeta", "card"].includes(valor)) return "Tarjeta";
  if (["d", "debito", "débito", "debit"].includes(valor)) return "Débito";
  if (["c", "credito", "crédito", "credit"].includes(valor)) return "Crédito";
  if (["t", "transferencia", "transf", "spei"].includes(valor)) return "Transferencia";
  if (["m", "mixto"].includes(valor)) return "Mixto";

  return valor.charAt(0).toUpperCase() + valor.slice(1);
}

function normalizarTextoTipo(valor) {
  return String(valor || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function obtenerTextoMovimiento(row) {
  const posibles = [
    row.tipo,
    row.TIPO,
    row.tipo_movimiento,
    row.movimiento_tipo,
    row.concepto,
    row.CONCEPTO,
    row.descripcion,
    row.DESCRIPCION,
    row.referencia,
    row.observaciones,
    row.detalle,
    row.raw,
  ];

  return posibles
    .map((v) => String(v || "").trim())
    .filter(Boolean)
    .join(" | ");
}

function detectarTipoRegistro(row) {
  const texto = normalizarTextoTipo(obtenerTextoMovimiento(row));

  const esIngreso =
    texto.includes("ingreso de efectivo") ||
    texto.includes("entrada de efectivo") ||
    texto.includes("deposito de efectivo") ||
    texto.includes("deposito caja") ||
    texto.includes("fondo de caja") ||
    texto.includes("retiro a caja") ||
    texto.includes("ingreso efectivo");

  const esSalida =
    texto.includes("salida de efectivo") ||
    texto.includes("retiro de efectivo") ||
    texto.includes("gasto de caja") ||
    texto.includes("retiro caja") ||
    texto.includes("egreso") ||
    texto.includes("salida efectivo");

  const esCancelado =
    String(
      row.esta_cancelado ??
        row.cancelado ??
        row.ESTA_CANCELADO ??
        "f"
    ).toLowerCase() === "t";

  if (esCancelado) return "cancelado";
  if (esIngreso) return "ingreso_efectivo";
  if (esSalida) return "salida_efectivo";

  return "venta";
}

function esVentaReal(item) {
  return item?.tipoRegistro === "venta" && !item?.cancelado;
}

function esIngresoEfectivo(item) {
  return item?.tipoRegistro === "ingreso_efectivo";
}

function esSalidaEfectivo(item) {
  return item?.tipoRegistro === "salida_efectivo";
}

function obtenerNombreCajeroDesdeRow(row) {
  const posiblesNombres = [
    row.cajero_nombre,
    row.nombre_cajero,
    row.cajero,
    row.usuario,
    row.nombre_usuario,
    row.USUARIO,
    row.NOMBRE_COMPLETO,
  ];

  for (const valor of posiblesNombres) {
    const limpio = cleanText(valor);
    if (limpio) return limpio.toUpperCase();
  }

  const posiblesIds = [
    row.cajero_id,
    row.id_cajero,
    row.CAJERO_ID,
    row.usuario_id,
  ];

  for (const valor of posiblesIds) {
    const id = cleanText(valor);
    if (!id) continue;
    if (NOMBRES_CAJEROS[id]) return NOMBRES_CAJEROS[id];
    if (/^\d+$/.test(id)) return `CAJERO ${id}`;
    return id.toUpperCase();
  }

  return "SIN CAJERO";
}

function getTotal(row) {
  const posibles = [
    row.total,
    row.importe,
    row.monto,
    row.total_ticket,
    row.venta_total,
    row.subtotal,
    row.TOTAL,
    row.IMPORTE,
  ];

  for (const v of posibles) {
    const n = Number(v);
    if (!Number.isNaN(n) && Number.isFinite(n)) return n;
  }

  return 0;
}

function getPiezas(row) {
  const posibles = [
    row.numero_articulos,
    row.num_articulos,
    row.piezas,
    row.piezas_vendidas,
    row.articulos,
    row.items,
    row.cantidad_productos,
  ];

  for (const v of posibles) {
    const n = Number(v);
    if (!Number.isNaN(n) && Number.isFinite(n)) return n;
  }

  return 0;
}

function getFormaPago(row) {
  return (
    row.forma_pago ??
    row.metodo_pago ??
    row.pago ??
    row.pagado_con ??
    row.tipo_pago ??
    row.metodo ??
    row.PAGADO_CON ??
    ""
  );
}

function getProducto(row) {
  return (
    row.producto ??
    row.descripcion ??
    row.nombre_producto ??
    row.articulo ??
    row.item ??
    ""
  );
}

function getNombreProductoArticulo(row) {
  return (
    row.producto_nombre ??
    row.nombre_producto ??
    row.producto ??
    row.descripcion ??
    row.articulo ??
    ""
  );
}

function getCantidadArticulo(row) {
  const posibles = [
    row.cantidad,
    row.piezas,
    row.cantidad_vendida,
    row.items,
  ];

  for (const v of posibles) {
    const n = Number(v);
    if (!Number.isNaN(n) && Number.isFinite(n)) return n;
  }

  return 0;
}

function construirUid(row, index = 0) {
  const partes = [
    row.id,
    row.ID,
    row.ticket_id,
    row.id_ticket,
    row.folio,
    row.pagado_en,
    row.PAGADO_EN,
    row.vendido_en,
    row.VENDIDO_EN,
    row.created_at,
    row.caja_id,
    index,
  ];

  return partes
    .map((x) => String(x ?? ""))
    .join("|");
}

function normalizarArticulo(row, index = 0) {
  const fecha = parseFecha(row);

  return {
    uid: construirUid(row, index),
    id: row.id ?? null,
    ticketId: row.ticket_id ?? row.id_ticket ?? null,
    fecha,
    producto: String(getNombreProductoArticulo(row) || "").trim(),
    piezas: getCantidadArticulo(row),
  };
}

function normalizarFila(row, index = 0) {
  const fecha = parseFecha(row);
  const total = getTotal(row);
  const piezas = getPiezas(row);
  const pagoRaw = getFormaPago(row);
  const producto = getProducto(row);
  const cancelado =
    String(
      row.esta_cancelado ??
        row.cancelado ??
        row.ESTA_CANCELADO ??
        "f"
    ).toLowerCase() === "t";

  const tipoRegistro = detectarTipoRegistro(row);

  return {
    uid: construirUid(row, index),
    id:
      row.id ??
      row.ID ??
      row.ticket_id ??
      row.id_ticket ??
      row.folio ??
      null,
    fecha,
    total,
    piezas,
    formaPago: normalizarFormaPago(pagoRaw),
    cajeroId: String(row.cajero_id ?? row.id_cajero ?? row.CAJERO_ID ?? ""),
    cajero: obtenerNombreCajeroDesdeRow(row),
    cajaId: row.caja_id ?? row.CAJA_ID ?? null,
    producto: String(producto || "").trim(),
    cancelado,
    tipoRegistro,
    raw: row,
  };
}

function obtenerRango(periodo) {
  const ahora = new Date();

  switch (periodo) {
    case "hoy":
      return { inicio: startOfDay(ahora), fin: endOfDay(ahora) };
    case "semanal":
      return { inicio: startOfWeek(ahora), fin: endOfWeek(ahora) };
    case "mensual":
      return { inicio: startOfMonth(ahora), fin: endOfMonth(ahora) };
    case "anual":
      return { inicio: startOfYear(ahora), fin: endOfYear(ahora) };
    default:
      return { inicio: null, fin: null };
  }
}

function esMismoDia(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function filtrarPorPeriodo(data, periodo) {
  const ahora = new Date();

  if (periodo === "hoy") {
    return data.filter((item) => item.fecha && esMismoDia(item.fecha, ahora));
  }

  if (periodo === "semanal") {
    const inicio = startOfWeek(ahora);
    const fin = endOfWeek(ahora);
    return data.filter((item) => item.fecha && item.fecha >= inicio && item.fecha <= fin);
  }

  if (periodo === "mensual") {
    const inicio = startOfMonth(ahora);
    const fin = endOfMonth(ahora);
    return data.filter((item) => item.fecha && item.fecha >= inicio && item.fecha <= fin);
  }

  if (periodo === "anual") {
    const inicio = startOfYear(ahora);
    const fin = endOfYear(ahora);
    return data.filter((item) => item.fecha && item.fecha >= inicio && item.fecha <= fin);
  }

  return data;
}

function toInputDate(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseInputDate(value, endOf = false) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;

  const date = new Date(year, month - 1, day);
  if (endOf) {
    date.setHours(23, 59, 59, 999);
  } else {
    date.setHours(0, 0, 0, 0);
  }
  return date;
}

function filtrarPorRangoPersonalizado(data, fechaInicio, fechaFin) {
  const inicio = parseInputDate(fechaInicio, false);
  const fin = parseInputDate(fechaFin, true);

  if (!inicio || !fin) return data;

  return data.filter((item) => {
    if (!item.fecha) return false;
    return item.fecha >= inicio && item.fecha <= fin;
  });
}

function agruparPorHora(data) {
  const mapa = new Map();

  data.forEach((item) => {
    if (!item.fecha) return;
    const key = formatHour(item.fecha);
    mapa.set(key, (mapa.get(key) || 0) + toNumber(item.total));
  });

  return [...mapa.entries()]
    .map(([hora, total]) => ({ hora, total: Number(total.toFixed(2)) }))
    .sort((a, b) => a.hora.localeCompare(b.hora));
}

function agruparPorPago(data) {
  const mapa = new Map();

  data.forEach((item) => {
    const key = item.formaPago || "No especificado";
    mapa.set(key, (mapa.get(key) || 0) + toNumber(item.total));
  });

  return [...mapa.entries()]
    .map(([nombre, total]) => ({
      nombre,
      total: Number(total.toFixed(2)),
    }))
    .sort((a, b) => b.total - a.total);
}

function agruparPorCajero(data) {
  const mapa = new Map();

  data.forEach((item) => {
    const key = item.cajero || "Sin cajero";
    if (!mapa.has(key)) {
      mapa.set(key, { nombre: key, total: 0, tickets: 0 });
    }
    const actual = mapa.get(key);
    actual.total += toNumber(item.total);
    actual.tickets += 1;
  });

  return [...mapa.values()].sort((a, b) => b.total - a.total);
}

function obtenerTopProductosDesdeArticulos(data) {
  const validos = data.filter((x) => x.producto);

  if (!validos.length) return [];

  const mapa = new Map();

  validos.forEach((item) => {
    const key = item.producto;
    mapa.set(key, (mapa.get(key) || 0) + Math.max(item.piezas || 1, 1));
  });

  return [...mapa.entries()]
    .map(([nombre, piezas]) => ({ nombre, piezas }))
    .sort((a, b) => b.piezas - a.piezas)
    .slice(0, 10);
}

function obtenerComparativaHoyVsAyer(data) {
  const ahora = new Date();
  const inicioHoy = startOfDay(ahora);
  const finHoy = endOfDay(ahora);

  const ayer = new Date(ahora);
  ayer.setDate(ayer.getDate() - 1);
  const inicioAyer = startOfDay(ayer);
  const finAyer = endOfDay(ayer);

  const ventasHoy = data
    .filter((x) => x.fecha && x.fecha >= inicioHoy && x.fecha <= finHoy)
    .reduce((sum, x) => sum + toNumber(x.total), 0);

  const ventasAyer = data
    .filter((x) => x.fecha && x.fecha >= inicioAyer && x.fecha <= finAyer)
    .reduce((sum, x) => sum + toNumber(x.total), 0);

  const diferencia = ventasHoy - ventasAyer;
  const porcentaje =
    ventasAyer > 0 ? (diferencia / ventasAyer) * 100 : ventasHoy > 0 ? 100 : 0;

  return {
    ventasHoy,
    ventasAyer,
    diferencia,
    porcentaje,
  };
}

function obtenerPronosticoDelDia(data) {
  const ahora = new Date();
  const horaActual = ahora.getHours() + ahora.getMinutes() / 60;

  const inicioHoy = startOfDay(ahora);
  const finHoy = endOfDay(ahora);

  const ventasHoy = data
    .filter((x) => x.fecha && x.fecha >= inicioHoy && x.fecha <= finHoy)
    .reduce((sum, x) => sum + toNumber(x.total), 0);

  if (horaActual <= 0.5) {
    return {
      actual: ventasHoy,
      estimado: ventasHoy,
    };
  }

  const estimado = (ventasHoy / horaActual) * 24;

  return {
    actual: ventasHoy,
    estimado,
  };
}

function obtenerHorasMuertas(data) {
  const hoy = new Date();
  const inicioHoy = startOfDay(hoy);
  const finHoy = endOfDay(hoy);

  const ventasHoy = data.filter(
    (x) => x.fecha && x.fecha >= inicioHoy && x.fecha <= finHoy
  );

  const porHora = agruparPorHora(ventasHoy);
  if (!porHora.length) return [];

  return [...porHora]
    .sort((a, b) => a.total - b.total)
    .slice(0, 3);
}

function obtenerMovimientosCajaRecientes(data, limite = 12) {
  return [...data]
    .filter(
      (x) =>
        x.fecha &&
        (esIngresoEfectivo(x) || esSalidaEfectivo(x))
    )
    .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
    .slice(0, limite);
}

function obtenerArticulosDeTicket(ticket, articulos) {
  if (!ticket) return [];

  const posiblesIdsTicket = new Set(
    [
      ticket.id,
      ticket.raw?.id,
      ticket.raw?.ID,
      ticket.raw?.ticket_id,
      ticket.raw?.id_ticket,
      ticket.raw?.folio,
    ]
      .map((v) => String(v ?? "").trim())
      .filter(Boolean)
  );

  return articulos
    .filter((articulo) => {
      const posiblesIdsArticulo = [
        articulo.ticketId,
        articulo.id,
        articulo.uid,
      ]
        .map((v) => String(v ?? "").trim())
        .filter(Boolean);

      return posiblesIdsArticulo.some((id) => posiblesIdsTicket.has(id));
    })
    .sort((a, b) => {
      const nombreA = String(a.producto || "");
      const nombreB = String(b.producto || "");
      return nombreA.localeCompare(nombreB);
    });
}

async function contarRegistros(tabla) {
  const { count, error } = await supabase
    .from(tabla)
    .select("*", { count: "exact", head: true });

  if (error) throw error;
  return count || 0;
}

async function cargarFilasDesdeSupabase() {
  const total = await contarRegistros(TABLA_VENTAS);
  const filas = [];

  for (let desde = 0; desde < total; desde += PAGE_SIZE) {
    const hasta = desde + PAGE_SIZE - 1;

    const { data, error } = await supabase
      .from(TABLA_VENTAS)
      .select("*")
      .order("pagado_en", { ascending: false, nullsFirst: false })
      .range(desde, hasta);

    if (error) throw error;
    if (Array.isArray(data) && data.length) filas.push(...data);
  }

  return filas;
}

async function cargarCajaDesdeSupabase() {
  const total = await contarRegistros(TABLA_CAJA);
  const filas = [];

  for (let desde = 0; desde < total; desde += PAGE_SIZE) {
    const hasta = desde + PAGE_SIZE - 1;

    const { data, error } = await supabase
      .from(TABLA_CAJA)
      .select("*")
      .order("fecha_movimiento", { ascending: false, nullsFirst: false })
      .range(desde, hasta);

    if (error) throw error;
    if (Array.isArray(data) && data.length) filas.push(...data);
  }

  return filas;
}

function normalizarMovimientoCajaFila(row, index = 0) {
  const fecha = parseFechaSegura(row.fecha_movimiento ?? row.FECHA_MOVIMIENTO);

  return {
    uid: construirUid(row, `caja-${index}`),
    id: row.id ?? row.ID ?? null,
    fecha,
    total: toNumber(row.monto ?? row.MONTO),
    piezas: 0,
    formaPago: "Efectivo",
    cajeroId: String(row.cajero_id ?? row.CAJERO_ID ?? ""),
    cajero: obtenerNombreCajeroDesdeRow(row),
    cajaId: row.caja_id ?? row.CAJA_ID ?? null,
    producto: "",
    cancelado: false,
    tipoRegistro:
      String(row.tipo ?? row.TIPO ?? "").toLowerCase() === "entrada"
        ? "ingreso_efectivo"
        : "salida_efectivo",
    raw: row,
  };
}

async function cargarArticulosDesdeSupabase() {
  const total = await contarRegistros(TABLA_ARTICULOS);
  const filas = [];

  for (let desde = 0; desde < total; desde += PAGE_SIZE) {
    const hasta = desde + PAGE_SIZE - 1;

    const { data, error } = await supabase
      .from(TABLA_ARTICULOS)
      .select("*")
      .order("pagado_en", { ascending: false, nullsFirst: false })
      .range(desde, hasta);

    if (error) {
      const fallback = await supabase
        .from(TABLA_ARTICULOS)
        .select("*")
        .order("created_at", { ascending: false, nullsFirst: false })
        .range(desde, hasta);

      if (fallback.error) throw fallback.error;
      if (Array.isArray(fallback.data) && fallback.data.length) {
        filas.push(...fallback.data);
      }
      continue;
    }

    if (Array.isArray(data) && data.length) filas.push(...data);
  }

  return filas;
}

function Card({ title, value, subtitle, accent = false }) {
  return (
    <div
      style={{
        background: accent
          ? "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)"
          : "rgba(255,255,255,0.04)",
        color: "#fff",
        borderRadius: 22,
        padding: 20,
        boxShadow: accent
          ? "0 18px 36px rgba(37,99,235,0.24)"
          : "0 8px 24px rgba(0,0,0,0.16)",
        border: accent
          ? "1px solid rgba(96,165,250,0.35)"
          : "1px solid rgba(148,163,184,0.12)",
        minHeight: 120,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
      }}
    >
      <div
        style={{
          fontSize: 13,
          fontWeight: 800,
          letterSpacing: 0.4,
          color: accent ? "rgba(255,255,255,0.92)" : "rgba(226,232,240,0.72)",
        }}
      >
        {title}
      </div>

      <div
        style={{
          fontSize: 24,
          fontWeight: 900,
          marginTop: 10,
          marginBottom: 8,
          letterSpacing: "-0.03em",
        }}
      >
        {value}
      </div>

      <div
        style={{
          fontSize: 12,
          color: accent ? "rgba(255,255,255,0.82)" : "rgba(226,232,240,0.58)",
        }}
      >
        {subtitle}
      </div>
    </div>
  );
}

function Panel({ title, right, children, minHeight = 360 }) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.04)",
        borderRadius: 24,
        padding: 20,
        boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
        border: "1px solid rgba(148,163,184,0.12)",
        minHeight,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 16,
          flexWrap: "wrap",
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: 24,
            fontWeight: 900,
            color: "#ffffff",
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

function BadgeMovimiento({ tipo }) {
  const esIngreso = tipo === "ingreso_efectivo";
  const esSalida = tipo === "salida_efectivo";

  const texto = esIngreso
    ? "INGRESO"
    : esSalida
    ? "SALIDA"
    : "MOVIMIENTO";

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "6px 10px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 900,
        letterSpacing: 0.4,
        background: esIngreso
          ? "rgba(34,197,94,0.16)"
          : esSalida
          ? "rgba(239,68,68,0.16)"
          : "rgba(100,116,139,0.16)",
        color: esIngreso ? "#4ade80" : esSalida ? "#f87171" : "#cbd5e1",
        border: esIngreso
          ? "1px solid rgba(34,197,94,0.25)"
          : esSalida
          ? "1px solid rgba(239,68,68,0.25)"
          : "1px solid rgba(100,116,139,0.25)",
      }}
    >
      {texto}
    </span>
  );
}

const chartAxisTick = {
  fill: "rgba(226,232,240,0.72)",
  fontSize: 12,
};

const chartTooltipStyle = {
  background: "#08152d",
  border: "1px solid rgba(148,163,184,0.20)",
  borderRadius: "12px",
  color: "#ffffff",
  boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
};

export default function DashboardVentas() {
  const navigate = useNavigate();
  const hoyTexto = toInputDate(new Date());

  const [periodo, setPeriodo] = useState("hoy");
  const [modoFecha, setModoFecha] = useState("preset");
  const [fechaInicio, setFechaInicio] = useState(hoyTexto);
  const [fechaFin, setFechaFin] = useState(hoyTexto);
  const [cajaRaw, setCajaRaw] = useState([]);
  const [ventasRaw, setVentasRaw] = useState([]);
  const [articulosRaw, setArticulosRaw] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [ultimaActualizacion, setUltimaActualizacion] = useState(null);
  const [ticketAbierto, setTicketAbierto] = useState(null);

  async function cargarDatos() {
    try {
      setCargando(true);
      setError("");

      const [rowsVentas, rowsArticulos, rowsCaja] = await Promise.all([
        cargarFilasDesdeSupabase(),
        cargarArticulosDesdeSupabase(),
        cargarCajaDesdeSupabase(),
      ]);

      const ventasLimpias = rowsVentas.map((row, index) =>
        normalizarFila(row, index)
      );

      const articulosLimpios = rowsArticulos.map((row, index) =>
        normalizarArticulo(row, index)
      );

      const cajaLimpia = rowsCaja.map((row, index) =>
        normalizarMovimientoCajaFila(row, index)
      );

      setVentasRaw(ventasLimpias);
      setArticulosRaw(articulosLimpios);
      setCajaRaw(cajaLimpia);
      setUltimaActualizacion(new Date());
    } catch (err) {
      console.error(err);
      setVentasRaw([]);
      setCajaRaw([]);
      setArticulosRaw([]);
      setError(
        err?.message ||
          "No se pudieron cargar las ventas y artículos. Revisa las tablas y campos."
      );
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargarDatos();

    if (!REFRESH_MS || REFRESH_MS <= 0) return;

    const id = setInterval(() => {
      cargarDatos();
    }, REFRESH_MS);

    return () => clearInterval(id);
  }, []);

  const registrosFiltrados = useMemo(() => {
    if (modoFecha === "custom") {
      return filtrarPorRangoPersonalizado(ventasRaw, fechaInicio, fechaFin);
    }
    return filtrarPorPeriodo(ventasRaw, periodo);
  }, [ventasRaw, periodo, modoFecha, fechaInicio, fechaFin]);

  const ventasFiltradas = useMemo(() => {
    return registrosFiltrados.filter(esVentaReal);
  }, [registrosFiltrados]);

  const cajaFiltrada = useMemo(() => {
    if (modoFecha === "custom") {
      return filtrarPorRangoPersonalizado(cajaRaw, fechaInicio, fechaFin);
    }
    return filtrarPorPeriodo(cajaRaw, periodo);
  }, [cajaRaw, periodo, modoFecha, fechaInicio, fechaFin]);

  const ingresosEfectivoFiltrados = useMemo(() => {
    return cajaFiltrada.filter(esIngresoEfectivo);
  }, [cajaFiltrada]);

  const salidasEfectivoFiltradas = useMemo(() => {
    return cajaFiltrada.filter(esSalidaEfectivo);
  }, [cajaFiltrada]);

  const articulosFiltrados = useMemo(() => {
    if (modoFecha === "custom") {
      return filtrarPorRangoPersonalizado(articulosRaw, fechaInicio, fechaFin);
    }
    return filtrarPorPeriodo(articulosRaw, periodo);
  }, [articulosRaw, periodo, modoFecha, fechaInicio, fechaFin]);

  const ventasRecientes = useMemo(() => {
    return [...ventasFiltradas].sort(
      (a, b) => new Date(b.fecha) - new Date(a.fecha)
    );
  }, [ventasFiltradas]);

  const movimientosCajaRecientes = useMemo(() => {
    return obtenerMovimientosCajaRecientes(cajaFiltrada, 15);
  }, [cajaFiltrada]);

  const resumenTicketAbierto = useMemo(() => {
    const ticket = ventasRecientes.find((x) => x.uid === ticketAbierto) || null;
    const articulos = ticket
      ? obtenerArticulosDeTicket(ticket, articulosFiltrados)
      : [];

    const totalPiezas = articulos.reduce(
      (sum, item) => sum + toNumber(item.piezas),
      0
    );

    return {
      ticket,
      articulos,
      renglones: articulos.length,
      totalPiezas,
    };
  }, [ticketAbierto, ventasRecientes, articulosFiltrados]);

  const resumen = useMemo(() => {
    const ventasTotales = ventasFiltradas.reduce(
      (sum, x) => sum + toNumber(x.total),
      0
    );

    const ingresosEfectivo = ingresosEfectivoFiltrados.reduce(
      (sum, x) => sum + toNumber(x.total),
      0
    );

    const salidasEfectivo = salidasEfectivoFiltradas.reduce(
      (sum, x) => sum + toNumber(x.total),
      0
    );

    const balanceCaja = ingresosEfectivo - salidasEfectivo;

    const tickets = ventasFiltradas.length;
    const ticketPromedio = tickets ? ventasTotales / tickets : 0;

    const piezasVendidas = articulosFiltrados.reduce(
      (sum, x) => sum + Number(x.piezas || 0),
      0
    );

    const productosDistintos = new Set(
      articulosFiltrados.map((x) => x.producto).filter(Boolean)
    ).size;

    const promedioPiezasPorTicket = tickets ? piezasVendidas / tickets : 0;

    return {
      ventasTotales,
      ingresosEfectivo,
      salidasEfectivo,
      balanceCaja,
      tickets,
      ticketPromedio,
      piezasVendidas,
      productosDistintos,
      promedioPiezasPorTicket,
    };
  }, [
    ventasFiltradas,
    ingresosEfectivoFiltrados,
    salidasEfectivoFiltradas,
    articulosFiltrados,
  ]);

  const ventasPorHora = useMemo(
    () => agruparPorHora(ventasFiltradas),
    [ventasFiltradas]
  );

  const ventasPorPago = useMemo(
    () => agruparPorPago(ventasFiltradas),
    [ventasFiltradas]
  );

  const ventasPorCajero = useMemo(
    () => agruparPorCajero(ventasFiltradas),
    [ventasFiltradas]
  );

  const topProductos = useMemo(
    () => obtenerTopProductosDesdeArticulos(articulosFiltrados),
    [articulosFiltrados]
  );

  const comparativa = useMemo(
    () => obtenerComparativaHoyVsAyer(ventasRaw.filter(esVentaReal)),
    [ventasRaw]
  );

  const pronostico = useMemo(
    () => obtenerPronosticoDelDia(ventasRaw.filter(esVentaReal)),
    [ventasRaw]
  );

  const horasMuertas = useMemo(
    () => obtenerHorasMuertas(ventasRaw.filter(esVentaReal)),
    [ventasRaw]
  );

  const mejorHora = useMemo(() => {
    if (!ventasPorHora.length) return null;
    return [...ventasPorHora].sort((a, b) => b.total - a.total)[0];
  }, [ventasPorHora]);

  const mejorCajeroDelMes = useMemo(() => {
    const ahora = new Date();
    const inicio = startOfMonth(ahora);
    const fin = endOfMonth(ahora);

    const ventasDelMes = ventasRaw.filter(
      (x) => x.fecha && x.fecha >= inicio && x.fecha <= fin && esVentaReal(x)
    );

    if (!ventasDelMes.length) return null;

    const mapa = new Map();

    ventasDelMes.forEach((item) => {
      const key = item.cajero || "Sin cajero";
      if (!mapa.has(key)) {
        mapa.set(key, { nombre: key, total: 0, tickets: 0 });
      }
      const actual = mapa.get(key);
      actual.total += toNumber(item.total);
      actual.tickets += 1;
    });

    return [...mapa.values()].sort((a, b) => b.total - a.total)[0] || null;
  }, [ventasRaw]);

  const etiquetaPeriodo = useMemo(() => {
    if (modoFecha === "custom") {
      if (fechaInicio === fechaFin) return `Fecha: ${fechaInicio}`;
      return `Rango: ${fechaInicio} a ${fechaFin}`;
    }
    return `Periodo: ${periodo.toUpperCase()}`;
  }, [modoFecha, periodo, fechaInicio, fechaFin]);

  const coloresPago = ["#2563eb", "#0ea5e9", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6"];

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top, #0f274f 0%, #08152d 45%, #050d1f 100%)",
        padding: "18px 14px 40px",
      }}
    >
      <div
        style={{
          maxWidth: 1800,
          margin: "0 auto",
        }}
      >
        <div
          style={{
            background: "rgba(9, 20, 43, 0.92)",
            border: "1px solid rgba(148, 163, 184, 0.18)",
            borderRadius: 32,
            padding: 16,
            marginBottom: 24,
            boxShadow: "0 25px 60px rgba(0,0,0,0.35)",
          }}
        >
          <div
            style={{
              background:
                "linear-gradient(180deg, rgba(21,33,63,0.98) 0%, rgba(17,27,53,0.98) 100%)",
              border: "1px solid rgba(148,163,184,0.16)",
              borderRadius: 30,
              padding: 28,
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
              <div
                style={{
                  display: "flex",
                  gap: 16,
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <div
                  style={{
                    width: 78,
                    height: 78,
                    borderRadius: 22,
                    background: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "2rem",
                    color: "#fff",
                    fontWeight: 900,
                    boxShadow: "0 14px 28px rgba(37,99,235,0.25)",
                  }}
                >
                  ▥
                </div>

                <div>
                  <div
                    style={{
                      fontSize: 13,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: "rgba(226,232,240,0.72)",
                      fontWeight: 800,
                      marginBottom: 8,
                    }}
                  >
                    Dashboard de Ventas
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
                    Control inteligente de ventas, cajeros y formas de pago
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: 10,
                  flexWrap: "wrap",
                  justifyContent: "flex-end",
                  alignItems: "center",
                }}
              >
                <button
                  onClick={() => navigate("/")}
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    color: "#fff",
                    border: "1px solid rgba(148,163,184,0.18)",
                    borderRadius: 16,
                    padding: "14px 18px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  ← Inicio
                </button>

                {PERIODOS.map((item) => {
                  const activo = modoFecha === "preset" && periodo === item.key;
                  return (
                    <button
                      key={item.key}
                      onClick={() => {
                        setModoFecha("preset");
                        setPeriodo(item.key);
                      }}
                      style={{
                        border: activo
                          ? "1px solid rgba(96,165,250,0.35)"
                          : "1px solid rgba(148,163,184,0.12)",
                        borderRadius: 999,
                        padding: "12px 18px",
                        cursor: "pointer",
                        fontWeight: 800,
                        fontSize: 13,
                        background: activo
                          ? "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)"
                          : "rgba(255,255,255,0.08)",
                        color: "#fff",
                        boxShadow: activo
                          ? "0 10px 24px rgba(37,99,235,0.35)"
                          : "none",
                      }}
                    >
                      {item.label}
                    </button>
                  );
                })}

                <button
                  onClick={() => setModoFecha("custom")}
                  style={{
                    border:
                      modoFecha === "custom"
                        ? "1px solid #60a5fa"
                        : "1px solid rgba(148,163,184,0.12)",
                    borderRadius: 999,
                    padding: "12px 18px",
                    cursor: "pointer",
                    fontWeight: 800,
                    fontSize: 13,
                    background:
                      modoFecha === "custom"
                        ? "rgba(37,99,235,0.28)"
                        : "rgba(255,255,255,0.08)",
                    color: "#fff",
                  }}
                >
                  FECHA
                </button>

                <button
                  onClick={cargarDatos}
                  style={{
                    border: "1px solid rgba(148,163,184,0.12)",
                    borderRadius: 999,
                    padding: "12px 18px",
                    cursor: "pointer",
                    fontWeight: 800,
                    fontSize: 13,
                    background: "rgba(255,255,255,0.08)",
                    color: "#fff",
                  }}
                >
                  ACTUALIZAR
                </button>
              </div>
            </div>

            {modoFecha === "custom" && (
              <div
                style={{
                  marginTop: 16,
                  display: "flex",
                  gap: 10,
                  flexWrap: "wrap",
                  alignItems: "center",
                }}
              >
                <input
                  type="date"
                  value={fechaInicio}
                  onChange={(e) => setFechaInicio(e.target.value)}
                  style={estiloInputFecha}
                />
                <span style={{ fontWeight: 800, color: "#fff", opacity: 0.9 }}>a</span>
                <input
                  type="date"
                  value={fechaFin}
                  onChange={(e) => setFechaFin(e.target.value)}
                  style={estiloInputFecha}
                />
                <button
                  onClick={() => {
                    const hoy = toInputDate(new Date());
                    setFechaInicio(hoy);
                    setFechaFin(hoy);
                  }}
                  style={{
                    border: "1px solid rgba(148,163,184,0.12)",
                    borderRadius: 14,
                    padding: "10px 14px",
                    cursor: "pointer",
                    fontWeight: 800,
                    fontSize: 13,
                    background: "rgba(255,255,255,0.08)",
                    color: "#fff",
                  }}
                >
                  HOY
                </button>
              </div>
            )}

            <div
              style={{
                marginTop: 14,
                display: "flex",
                gap: 18,
                flexWrap: "wrap",
                fontSize: 13,
                color: "rgba(226,232,240,0.72)",
              }}
            >
              <span>
                Última actualización:{" "}
                {ultimaActualizacion
                  ? ultimaActualizacion.toLocaleString("es-MX")
                  : "sin datos"}
              </span>
              <span>Auto refresh: desactivado</span>
              <span>{etiquetaPeriodo}</span>
              <span>Tickets cargados base: {formatNumber(ventasRaw.length)}</span>
            </div>
          </div>
        </div>

        {error ? (
          <div
            style={{
              background: "rgba(127,29,29,0.18)",
              border: "1px solid rgba(248,113,113,0.28)",
              color: "#fecdd3",
              padding: 16,
              borderRadius: 18,
              marginBottom: 20,
              fontWeight: 700,
              textAlign: "center",
            }}
          >
            {error}
          </div>
        ) : null}

        {cargando ? (
          <div
            style={{
              background: "rgba(255,255,255,0.04)",
              borderRadius: 22,
              padding: 30,
              textAlign: "center",
              fontWeight: 800,
              color: "#e2e8f0",
              border: "1px solid rgba(148,163,184,0.12)",
            }}
          >
            Cargando ventas...
          </div>
        ) : (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
                gap: 16,
                marginBottom: 20,
              }}
            >
              <Card
                accent
                title="Ventas totales"
                value={formatMoney(resumen.ventasTotales)}
                subtitle={`${etiquetaPeriodo} · solo ventas reales`}
              />
              <Card
                title="Ingreso de efectivo"
                value={formatMoney(resumen.ingresosEfectivo)}
                subtitle="Entradas de caja detectadas"
              />
              <Card
                title="Salida de efectivo"
                value={formatMoney(resumen.salidasEfectivo)}
                subtitle="Retiros o egresos de caja"
              />
              <Card
                title="Balance de caja"
                value={formatMoney(resumen.balanceCaja)}
                subtitle="Ingresos - salidas de efectivo"
              />
              <Card
                title="Tickets"
                value={formatNumber(resumen.tickets)}
                subtitle="Cantidad de ventas registradas"
              />
              <Card
                title="Ticket promedio"
                value={formatMoney(resumen.ticketPromedio)}
                subtitle="Promedio por ticket"
              />
              <Card
                title="Piezas vendidas"
                value={formatNumber(resumen.piezasVendidas)}
                subtitle="Suma de artículos"
              />
              <Card
                title="Productos distintos"
                value={formatNumber(resumen.productosDistintos)}
                subtitle="Detectados en el periodo"
              />
              <Card
                title="Piezas por ticket"
                value={resumen.promedioPiezasPorTicket.toFixed(2)}
                subtitle="Promedio por compra"
              />
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                gap: 16,
                marginBottom: 20,
              }}
            >
              <Card
                title="Hoy vs Ayer"
                value={`${comparativa.porcentaje >= 0 ? "+" : ""}${comparativa.porcentaje.toFixed(1)}%`}
                subtitle={`Hoy: ${formatMoney(comparativa.ventasHoy)} | Ayer: ${formatMoney(comparativa.ventasAyer)}`}
              />
              <Card
                title="Pronóstico del día"
                value={formatMoney(pronostico.estimado)}
                subtitle={`Actual acumulado: ${formatMoney(pronostico.actual)}`}
              />
              <Card
                title="Mejor hora"
                value={mejorHora ? mejorHora.hora : "--:--"}
                subtitle={mejorHora ? formatMoney(mejorHora.total) : "Sin datos"}
              />
              <Card
                title="Horas muertas"
                value={
                  horasMuertas.length
                    ? horasMuertas.map((x) => x.hora).join(", ")
                    : "Sin datos"
                }
                subtitle="Horas con menor venta hoy"
              />
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1.35fr 1fr",
                gap: 20,
                marginBottom: 20,
              }}
            >
              <Panel
                title="Ventas recientes"
                right={
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: "rgba(226,232,240,0.72)",
                    }}
                  >
                    {formatNumber(ventasRecientes.length)} ventas en el periodo
                  </div>
                }
                minHeight={420}
              >
                <div
                  style={{
                    display: "grid",
                    gap: 10,
                    maxHeight: 520,
                    overflowY: "auto",
                    paddingRight: 6,
                  }}
                >
                  {ventasRecientes.length ? (
                    ventasRecientes.map((item) => {
                      const abierto = ticketAbierto === item.uid;
                      const detalleItems = abierto
                        ? obtenerArticulosDeTicket(item, articulosFiltrados)
                        : [];

                      return (
                        <div
                          key={item.uid}
                          style={{
                            borderRadius: 14,
                            border: "1px solid rgba(148,163,184,0.12)",
                            background: "rgba(2,12,34,0.52)",
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              gap: 12,
                              padding: "12px 14px",
                            }}
                          >
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontWeight: 900, color: "#fff" }}>
                                {item.cajero}
                              </div>
                              <div style={{ fontSize: 12, color: "rgba(226,232,240,0.72)", marginTop: 2 }}>
                                {item.fecha
                                  ? new Date(item.fecha).toLocaleString("es-MX")
                                  : "Sin fecha"}
                              </div>
                              <div style={{ fontSize: 12, color: "rgba(148,163,184,0.78)", marginTop: 2 }}>
                                Ticket: {item.id ?? "Sin ID"} ·{" "}
                                {item.formaPago || "No especificado"}
                              </div>
                            </div>

                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 10,
                                flexShrink: 0,
                              }}
                            >
                              <div
                                style={{
                                  fontWeight: 900,
                                  color: "#60a5fa",
                                }}
                              >
                                {formatMoney(item.total)}
                              </div>

                              <button
                                onClick={() =>
                                  setTicketAbierto((prev) =>
                                    prev === item.uid ? null : item.uid
                                  )
                                }
                                style={{
                                  border: "1px solid rgba(148,163,184,0.18)",
                                  background: abierto ? "rgba(37,99,235,0.22)" : "rgba(255,255,255,0.06)",
                                  color: "#93c5fd",
                                  borderRadius: 10,
                                  padding: "8px 12px",
                                  fontWeight: 800,
                                  fontSize: 12,
                                  cursor: "pointer",
                                }}
                              >
                                {abierto ? "Ocultar ticket" : "Ver ticket"}
                              </button>
                            </div>
                          </div>

                          {abierto && (
                            <div
                              style={{
                                borderTop: "1px solid rgba(148,163,184,0.12)",
                                background: "rgba(255,255,255,0.02)",
                                padding: "12px 14px",
                              }}
                            >
                              <div style={{ display: "grid", gap: 10 }}>
                                <div
                                  style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    gap: 12,
                                    flexWrap: "wrap",
                                    padding: "10px 12px",
                                    borderRadius: 12,
                                    background: "rgba(37,99,235,0.15)",
                                    border: "1px solid rgba(96,165,250,0.22)",
                                  }}
                                >
                                  <div>
                                    <div
                                      style={{
                                        fontSize: 13,
                                        fontWeight: 900,
                                        color: "#bfdbfe",
                                      }}
                                    >
                                      Detalle del ticket {item.id ?? "Sin ID"}
                                    </div>
                                    <div
                                      style={{
                                        fontSize: 12,
                                        color: "rgba(226,232,240,0.72)",
                                        marginTop: 4,
                                      }}
                                    >
                                      {item.fecha
                                        ? new Date(item.fecha).toLocaleString("es-MX")
                                        : "Sin fecha"}{" "}
                                      · {item.cajero} · {item.formaPago || "No especificado"}
                                    </div>
                                  </div>

                                  <div
                                    style={{
                                      display: "flex",
                                      gap: 8,
                                      flexWrap: "wrap",
                                    }}
                                  >
                                    <div style={pillInfo}>
                                      Renglones: {formatNumber(detalleItems.length)}
                                    </div>
                                    <div style={pillInfo}>
                                      Piezas:{" "}
                                      {formatNumber(
                                        detalleItems.reduce(
                                          (sum, x) => sum + toNumber(x.piezas),
                                          0
                                        )
                                      )}
                                    </div>
                                    <div style={pillInfoStrong}>
                                      Total: {formatMoney(item.total)}
                                    </div>
                                  </div>
                                </div>

                                <div
                                  style={{
                                    fontSize: 12,
                                    fontWeight: 800,
                                    color: "rgba(226,232,240,0.72)",
                                  }}
                                >
                                  Productos del ticket
                                </div>

                                {detalleItems.length ? (
                                  <div style={{ display: "grid", gap: 8 }}>
                                    {detalleItems.map((articulo, index) => (
                                      <div
                                        key={articulo.uid}
                                        style={{
                                          display: "flex",
                                          justifyContent: "space-between",
                                          gap: 12,
                                          padding: "10px 12px",
                                          borderRadius: 10,
                                          background: "rgba(255,255,255,0.04)",
                                          border: "1px solid rgba(148,163,184,0.12)",
                                        }}
                                      >
                                        <div
                                          style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 10,
                                            minWidth: 0,
                                          }}
                                        >
                                          <div
                                            style={{
                                              width: 24,
                                              height: 24,
                                              borderRadius: 999,
                                              background: "rgba(37,99,235,0.18)",
                                              color: "#93c5fd",
                                              display: "grid",
                                              placeItems: "center",
                                              fontSize: 11,
                                              fontWeight: 900,
                                              flexShrink: 0,
                                            }}
                                          >
                                            {index + 1}
                                          </div>

                                          <div
                                            style={{
                                              fontWeight: 700,
                                              color: "#ffffff",
                                              minWidth: 0,
                                              overflow: "hidden",
                                              textOverflow: "ellipsis",
                                              whiteSpace: "nowrap",
                                            }}
                                          >
                                            {articulo.producto || "Producto sin nombre"}
                                          </div>
                                        </div>

                                        <div
                                          style={{
                                            fontWeight: 900,
                                            color: "#60a5fa",
                                            flexShrink: 0,
                                          }}
                                        >
                                          {formatNumber(articulo.piezas)} pzas
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div
                                    style={{
                                      fontSize: 13,
                                      fontWeight: 700,
                                      color: "rgba(226,232,240,0.72)",
                                      lineHeight: 1.6,
                                    }}
                                  >
                                    No encontré artículos relacionados con este ticket en la
                                    tabla actual.
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div style={{ color: "rgba(226,232,240,0.72)", fontWeight: 700 }}>
                      No hay ventas en este periodo.
                    </div>
                  )}
                </div>
              </Panel>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1.35fr 1fr",
                gap: 20,
                marginBottom: 20,
              }}
            >
              <Panel title="Ventas por forma de pago" minHeight={320}>
                <div
                  style={{
                    width: "100%",
                    height: 280,
                    background: "rgba(2,12,34,0.52)",
                    border: "1px solid rgba(148,163,184,0.12)",
                    borderRadius: 20,
                    padding: 12,
                    boxSizing: "border-box",
                  }}
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={ventasPorPago}
                        dataKey="total"
                        nameKey="nombre"
                        innerRadius={60}
                        outerRadius={90}
                      >
                        {ventasPorPago.map((entry, index) => (
                          <Cell
                            key={index}
                            fill={coloresPago[index % coloresPago.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(v) => formatMoney(v)}
                        contentStyle={chartTooltipStyle}
                        labelStyle={{ color: "#ffffff", fontWeight: 700 }}
                        itemStyle={{ color: "#ffffff" }}
                      />
                      <Legend wrapperStyle={{ color: "#ffffff" }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {ventasPorPago.map((item) => (
                  <div
                    key={item.nombre}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginTop: 8,
                      fontWeight: 700,
                      color: "#e2e8f0",
                    }}
                  >
                    <span>{item.nombre}</span>
                    <span>{formatMoney(item.total)}</span>
                  </div>
                ))}
              </Panel>

              <Panel title="Mejor cajero del mes" minHeight={320}>
                {mejorCajeroDelMes ? (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 14,
                      fontWeight: 800,
                      fontSize: 18,
                      color: "#ffffff",
                    }}
                  >
                    <div style={{ fontSize: 26, fontWeight: 900 }}>
                      🏆 {mejorCajeroDelMes.nombre}
                    </div>

                    <div>Ventas: {formatMoney(mejorCajeroDelMes.total)}</div>
                    <div>Tickets: {formatNumber(mejorCajeroDelMes.tickets)}</div>

                    <div style={{ fontSize: 13, color: "rgba(226,232,240,0.58)" }}>
                      Mejor desempeño del mes actual
                    </div>
                  </div>
                ) : (
                  <div style={{ fontWeight: 700, color: "rgba(226,232,240,0.72)" }}>
                    Sin ventas registradas
                  </div>
                )}
              </Panel>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr",
                gap: 20,
                marginBottom: 20,
              }}
            >
              <Panel
                title="Movimientos de caja recientes"
                right={
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: "rgba(226,232,240,0.72)",
                    }}
                  >
                    Ingresos y salidas detectados en el sistema
                  </div>
                }
                minHeight={320}
              >
                {movimientosCajaRecientes.length ? (
                  <div style={{ display: "grid", gap: 10 }}>
                    {movimientosCajaRecientes.map((item) => (
                      <div
                        key={item.uid}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: 12,
                          padding: "12px 14px",
                          borderRadius: 14,
                          border: "1px solid rgba(148,163,184,0.12)",
                          background: "rgba(2,12,34,0.52)",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 6,
                            minWidth: 0,
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              flexWrap: "wrap",
                            }}
                          >
                            <div style={{ fontWeight: 900, color: "#fff" }}>{item.cajero}</div>
                            <BadgeMovimiento tipo={item.tipoRegistro} />
                          </div>

                          <div style={{ fontSize: 12, color: "rgba(226,232,240,0.72)" }}>
                            {item.fecha
                              ? new Date(item.fecha).toLocaleString("es-MX")
                              : "Sin fecha"}
                          </div>

                          <div
                            style={{
                              fontSize: 12,
                              color: "rgba(148,163,184,0.78)",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              maxWidth: "100%",
                            }}
                          >
                            {obtenerTextoMovimiento(item.raw) || "Sin descripción"}
                          </div>
                        </div>

                        <div
                          style={{
                            fontWeight: 900,
                            color:
                              item.tipoRegistro === "ingreso_efectivo"
                                ? "#4ade80"
                                : "#f87171",
                            flexShrink: 0,
                          }}
                        >
                          {item.tipoRegistro === "ingreso_efectivo" ? "+" : "-"}
                          {formatMoney(item.total)}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div
                    style={{
                      color: "rgba(226,232,240,0.72)",
                      fontWeight: 700,
                      lineHeight: 1.6,
                    }}
                  >
                    No se detectaron movimientos de caja en este periodo.
                  </div>
                )}
              </Panel>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 20,
                marginBottom: 20,
              }}
            >
              <Panel title="Ventas por cajero" minHeight={320}>
                {ventasPorCajero.length ? (
                  <div style={{ display: "grid", gap: 10 }}>
                    {ventasPorCajero.map((item) => (
                      <div
                        key={item.nombre}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 12,
                          padding: "13px 15px",
                          borderRadius: 14,
                          background: "rgba(2,12,34,0.52)",
                          border: "1px solid rgba(148,163,184,0.12)",
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 900, color: "#fff" }}>{item.nombre}</div>
                          <div style={{ fontSize: 12, color: "rgba(226,232,240,0.72)" }}>
                            {formatNumber(item.tickets)} tickets
                          </div>
                        </div>
                        <div style={{ fontWeight: 900, color: "#60a5fa" }}>
                          {formatMoney(item.total)}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ color: "rgba(226,232,240,0.72)", fontWeight: 700 }}>
                    Sin datos de cajeros.
                  </div>
                )}
              </Panel>

              <Panel title="Comparativa rápida hoy vs ayer" minHeight={320}>
                <div
                  style={{
                    width: "100%",
                    height: 260,
                    background: "rgba(2,12,34,0.52)",
                    border: "1px solid rgba(148,163,184,0.12)",
                    borderRadius: 20,
                    padding: 12,
                    boxSizing: "border-box",
                  }}
                >
                  <ResponsiveContainer>
                    <BarChart
                      data={[
                        { nombre: "Ayer", total: comparativa.ventasAyer },
                        { nombre: "Hoy", total: comparativa.ventasHoy },
                      ]}
                    >
                      <CartesianGrid
                        stroke="rgba(148,163,184,0.15)"
                        strokeDasharray="3 3"
                      />
                      <XAxis
                        dataKey="nombre"
                        tick={chartAxisTick}
                        axisLine={{ stroke: "rgba(148,163,184,0.18)" }}
                        tickLine={{ stroke: "rgba(148,163,184,0.18)" }}
                      />
                      <YAxis
                        tick={chartAxisTick}
                        axisLine={{ stroke: "rgba(148,163,184,0.18)" }}
                        tickLine={{ stroke: "rgba(148,163,184,0.18)" }}
                      />
                      <Tooltip
                        formatter={(v) => formatMoney(v)}
                        contentStyle={chartTooltipStyle}
                        labelStyle={{ color: "#ffffff", fontWeight: 700 }}
                        itemStyle={{ color: "#ffffff" }}
                      />
                      <Bar dataKey="total" fill="#2563eb" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Panel>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr",
                gap: 20,
              }}
            >
              <Panel title="Top productos detectados" minHeight={320}>
                {topProductos.length ? (
                  <div style={{ display: "grid", gap: 10 }}>
                    {topProductos.map((item, index) => (
                      <div
                        key={item.nombre}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 12,
                          padding: "13px 15px",
                          borderRadius: 14,
                          background: "rgba(2,12,34,0.52)",
                          border: "1px solid rgba(148,163,184,0.12)",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 12,
                            minWidth: 0,
                          }}
                        >
                          <div
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: 999,
                              background: "rgba(37,99,235,0.18)",
                              color: "#93c5fd",
                              display: "grid",
                              placeItems: "center",
                              fontWeight: 900,
                              flexShrink: 0,
                            }}
                          >
                            {index + 1}
                          </div>
                          <div
                            style={{
                              fontWeight: 800,
                              color: "#ffffff",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {item.nombre}
                          </div>
                        </div>

                        <div
                          style={{
                            fontWeight: 900,
                            color: "#60a5fa",
                            flexShrink: 0,
                          }}
                        >
                          {formatNumber(item.piezas)} pzas
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div
                    style={{
                      color: "rgba(226,232,240,0.72)",
                      fontWeight: 700,
                      lineHeight: 1.6,
                    }}
                  >
                    No encontré nombres de productos en la tabla actual.
                  </div>
                )}
              </Panel>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const estiloInputFecha = {
  background: "rgba(255,255,255,0.95)",
  color: "#0f172a",
  border: "1px solid #cbd5e1",
  borderRadius: 14,
  padding: "10px 14px",
  fontWeight: 700,
};

const pillInfo = {
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(148,163,184,0.14)",
  borderRadius: 999,
  padding: "6px 10px",
  fontSize: 12,
  fontWeight: 800,
  color: "#bfdbfe",
};

const pillInfoStrong = {
  background: "rgba(255,255,255,0.08)",
  border: "1px solid rgba(148,163,184,0.14)",
  borderRadius: 999,
  padding: "6px 10px",
  fontSize: 12,
  fontWeight: 900,
  color: "#ffffff",
};