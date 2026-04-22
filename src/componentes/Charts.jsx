import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";

const DIAS_SEMANA = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MESES = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
];

function formatearMoneda(valor) {
  return `$${Number(valor || 0).toLocaleString("es-MX")}`;
}

function obtenerClaveAgrupacion(fechaTexto, filtroPeriodo) {
  if (!fechaTexto) return "Sin fecha";

  const fecha = new Date(fechaTexto);
  if (Number.isNaN(fecha.getTime())) return "Sin fecha";

  if (filtroPeriodo === "hoy") {
    return "Hoy";
  }

  if (filtroPeriodo === "semanal") {
    return DIAS_SEMANA[fecha.getDay()];
  }

  if (filtroPeriodo === "mensual") {
    return String(fecha.getDate()).padStart(2, "0");
  }

  if (filtroPeriodo === "anual" || filtroPeriodo === "todo") {
    return MESES[fecha.getMonth()];
  }

  return fechaTexto;
}

function obtenerOrdenBase(filtroPeriodo) {
  if (filtroPeriodo === "hoy") {
    return ["Hoy"];
  }

  if (filtroPeriodo === "semanal") {
    return ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
  }

  if (filtroPeriodo === "mensual") {
    return Array.from({ length: 31 }, (_, i) =>
      String(i + 1).padStart(2, "0")
    );
  }

  if (filtroPeriodo === "anual" || filtroPeriodo === "todo") {
    return MESES;
  }

  return [];
}

function construirSerie(transacciones = [], filtroPeriodo, tipoGrafico) {
  const listaSegura = Array.isArray(transacciones) ? transacciones : [];
  const base = obtenerOrdenBase(filtroPeriodo);
  const mapa = {};

  base.forEach((clave) => {
    mapa[clave] =
      tipoGrafico === "flujo"
        ? { periodo: clave, ingresos: 0, egresos: 0 }
        : { periodo: clave, ventas: 0, gastos: 0 };
  });

  listaSegura.forEach((t) => {
    const clave = obtenerClaveAgrupacion(t?.fecha, filtroPeriodo);

    if (!mapa[clave]) {
      mapa[clave] =
        tipoGrafico === "flujo"
          ? { periodo: clave, ingresos: 0, egresos: 0 }
          : { periodo: clave, ventas: 0, gastos: 0 };
    }

    const monto = Number(t?.monto || 0);

    if (tipoGrafico === "flujo") {
      if (t?.tipo === "ingreso" && t?.metodo === "efectivo") {
        mapa[clave].ingresos += monto;
      }

      if (t?.tipo === "gasto" && t?.metodo === "efectivo") {
        mapa[clave].egresos += monto;
      }
    }

    if (tipoGrafico === "tarjeta") {
      const esTarjeta =
        t?.metodo === "debito" ||
        t?.metodo === "credito" ||
        t?.metodo === "tarjeta";

      if (!esTarjeta) return;
      if (t?.tipo === "pago_tarjeta") return;

      if (t?.tipo === "ingreso") {
        mapa[clave].ventas += monto;
      }

      if (t?.tipo === "gasto") {
        mapa[clave].gastos += monto;
      }
    }
  });

  return Object.values(mapa);
}

function PanelGrafica({ titulo, subtitulo, children }) {
  return (
    <div
      style={{
        background: "transparent",
        borderRadius: "20px",
        padding: 0,
        boxShadow: "none",
        border: "none",
      }}
    >
      <h2
        style={{
          margin: 0,
          fontSize: "22px",
          color: "#ffffff",
          textAlign: "left",
          fontWeight: 900,
          letterSpacing: "-0.02em",
        }}
      >
        {titulo}
      </h2>

      <p
        style={{
          marginTop: "8px",
          marginBottom: "14px",
          color: "rgba(226,232,240,0.72)",
          fontSize: "15px",
          textAlign: "left",
        }}
      >
        {subtitulo}
      </p>

      <div
        style={{
          width: "100%",
          height: 320,
          background: "rgba(5, 17, 40, 0.55)",
          border: "1px solid rgba(148,163,184,0.12)",
          borderRadius: "18px",
          padding: "14px 14px 8px 6px",
          boxSizing: "border-box",
        }}
      >
        {children}
      </div>
    </div>
  );
}

const tooltipStyle = {
  background: "#08152d",
  border: "1px solid rgba(148,163,184,0.20)",
  borderRadius: "12px",
  color: "#ffffff",
  boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
};

const axisTick = {
  fill: "rgba(226,232,240,0.72)",
  fontSize: 12,
};

const legendStyle = {
  color: "#ffffff",
  fontSize: 13,
};

export function FlujoChart({ transacciones = [], filtroPeriodo = "todo" }) {
  const data = construirSerie(transacciones, filtroPeriodo, "flujo");

  const subtitulo =
    filtroPeriodo === "hoy"
      ? "Ingresos vs egresos del día"
      : filtroPeriodo === "semanal"
      ? "Comparativa día por día"
      : filtroPeriodo === "mensual"
      ? "Comparativa diaria del mes"
      : filtroPeriodo === "anual"
      ? "Comparativa mes por mes"
      : "Comparativa general";

  return (
    <PanelGrafica titulo="Flujo de Efectivo" subtitulo={subtitulo}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 12, right: 18, left: 8, bottom: 6 }}
        >
          <CartesianGrid
            stroke="rgba(148,163,184,0.15)"
            strokeDasharray="3 3"
          />
          <XAxis
            dataKey="periodo"
            tick={axisTick}
            axisLine={{ stroke: "rgba(148,163,184,0.18)" }}
            tickLine={{ stroke: "rgba(148,163,184,0.18)" }}
          />
          <YAxis
            tick={axisTick}
            axisLine={{ stroke: "rgba(148,163,184,0.18)" }}
            tickLine={{ stroke: "rgba(148,163,184,0.18)" }}
            tickFormatter={(value) => formatearMoneda(value)}
          />
          <Tooltip
            formatter={(value) => formatearMoneda(value)}
            contentStyle={tooltipStyle}
            labelStyle={{ color: "#ffffff", fontWeight: 700 }}
            itemStyle={{ color: "#ffffff" }}
          />
          <Legend wrapperStyle={legendStyle} />
          <Line
            type="monotone"
            dataKey="ingresos"
            name="Ingresos"
            stroke="#22c55e"
            strokeWidth={3}
            dot={{ r: 4, strokeWidth: 2, fill: "#08152d" }}
            activeDot={{ r: 6 }}
          />
          <Line
            type="monotone"
            dataKey="egresos"
            name="Egresos"
            stroke="#ff4d4f"
            strokeWidth={3}
            dot={{ r: 4, strokeWidth: 2, fill: "#08152d" }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </PanelGrafica>
  );
}

export function TarjetaChart({ transacciones = [], filtroPeriodo = "todo" }) {
  const data = construirSerie(transacciones, filtroPeriodo, "tarjeta");

  const subtitulo =
    filtroPeriodo === "hoy"
      ? "Ventas y gastos con tarjeta del día"
      : filtroPeriodo === "semanal"
      ? "Comparativa día por día"
      : filtroPeriodo === "mensual"
      ? "Comparativa diaria del mes"
      : filtroPeriodo === "anual"
      ? "Comparativa mes por mes"
      : "Comparativa general";

  return (
    <PanelGrafica titulo="Transacciones con Tarjeta" subtitulo={subtitulo}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 12, right: 18, left: 8, bottom: 6 }}
        >
          <CartesianGrid
            stroke="rgba(148,163,184,0.15)"
            strokeDasharray="3 3"
          />
          <XAxis
            dataKey="periodo"
            tick={axisTick}
            axisLine={{ stroke: "rgba(148,163,184,0.18)" }}
            tickLine={{ stroke: "rgba(148,163,184,0.18)" }}
          />
          <YAxis
            tick={axisTick}
            axisLine={{ stroke: "rgba(148,163,184,0.18)" }}
            tickLine={{ stroke: "rgba(148,163,184,0.18)" }}
            tickFormatter={(value) => formatearMoneda(value)}
          />
          <Tooltip
            formatter={(value) => formatearMoneda(value)}
            contentStyle={tooltipStyle}
            labelStyle={{ color: "#ffffff", fontWeight: 700 }}
            itemStyle={{ color: "#ffffff" }}
          />
          <Legend wrapperStyle={legendStyle} />
          <Bar
            dataKey="ventas"
            name="Ventas con tarjeta"
            fill="#34d399"
            radius={[8, 8, 0, 0]}
          />
          <Bar
            dataKey="gastos"
            name="Gastos con tarjeta"
            fill="#8b5cf6"
            radius={[8, 8, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </PanelGrafica>
  );
}