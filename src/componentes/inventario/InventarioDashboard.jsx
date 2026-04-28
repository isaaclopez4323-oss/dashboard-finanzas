import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../supabase";

const TABLA_INVENTARIO = "eleventa_inventario";
const REFRESH_MS = 5 * 60 * 1000;

function formatMoney(value) {
  return Number(value || 0).toLocaleString("es-MX", {
    style: "currency",
    currency: "MXN",
  });
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("es-MX");
}

function normalizarTexto(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

function pick(obj, keys, fallback = "") {
  for (const key of keys) {
    if (
      Object.prototype.hasOwnProperty.call(obj || {}, key) &&
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
    const limpio = value.replace(/[^0-9.-]/g, "");
    const n = Number(limpio);
    return Number.isFinite(n) ? n : 0;
  }

  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function formatearFechaHora(fecha) {
  if (!fecha) return "Sin datos";
  try {
    return new Date(fecha).toLocaleString("es-MX");
  } catch {
    return String(fecha);
  }
}

function obtenerEstado(stock, minimo) {
  const s = toNumber(stock);
  const m = toNumber(minimo);

  if (s <= 0) return "SIN EXISTENCIA";
  if (m > 0 && s <= m) return "STOCK BAJO";
  return "OK";
}

function getEstadoBadgeStyle(estado) {
  const base = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "6px 10px",
    borderRadius: "999px",
    fontSize: "11px",
    fontWeight: 700,
    letterSpacing: "0.4px",
    minWidth: "96px",
    border: "1px solid transparent",
    whiteSpace: "nowrap",
  };

  if (estado === "OK") {
    return {
      ...base,
      background: "rgba(16, 185, 129, 0.14)",
      color: "#34d399",
      borderColor: "rgba(52, 211, 153, 0.22)",
    };
  }

  if (estado === "STOCK BAJO") {
    return {
      ...base,
      background: "rgba(245, 158, 11, 0.14)",
      color: "#fbbf24",
      borderColor: "rgba(251, 191, 36, 0.24)",
    };
  }

  return {
    ...base,
    background: "rgba(148, 163, 184, 0.14)",
    color: "#cbd5e1",
    borderColor: "rgba(203, 213, 225, 0.18)",
  };
}

function getDupBadgeStyle(duplicados) {
  const esDuplicado = duplicados > 1;

  return {
    width: "28px",
    height: "28px",
    borderRadius: "999px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: esDuplicado
      ? "rgba(239, 68, 68, 0.14)"
      : "rgba(16, 185, 129, 0.14)",
    color: esDuplicado ? "#f87171" : "#34d399",
    fontWeight: 700,
    fontSize: "12px",
    border: esDuplicado
      ? "1px solid rgba(248, 113, 113, 0.22)"
      : "1px solid rgba(52, 211, 153, 0.22)",
  };
}

function tarjetaBaseStyle() {
  return {
    background:
      "linear-gradient(180deg, rgba(10,27,51,0.96) 0%, rgba(7,20,39,0.98) 100%)",
    border: "1px solid rgba(148, 163, 184, 0.10)",
    borderRadius: "18px",
    boxShadow: "0 10px 30px rgba(0,0,0,0.22)",
  };
}

function IconBox({
  children,
  color = "#3b82f6",
  bg = "rgba(59,130,246,0.14)",
}) {
  return (
    <div
      style={{
        width: 44,
        height: 44,
        borderRadius: 14,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: bg,
        color,
        border: "1px solid rgba(255,255,255,0.05)",
        flexShrink: 0,
        fontSize: 18,
        fontWeight: 800,
      }}
    >
      {children}
    </div>
  );
}

function StatCard({
  icon,
  iconColor,
  iconBg,
  title,
  value,
  subtitle,
  valueColor,
}) {
  return (
    <div
      style={{
        ...tarjetaBaseStyle(),
        padding: 18,
        minHeight: 112,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
        <IconBox color={iconColor} bg={iconBg}>
          {icon}
        </IconBox>

        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 13,
              color: "rgba(226,232,240,0.82)",
              marginBottom: 6,
            }}
          >
            {title}
          </div>

          <div
            style={{
              fontSize: 31,
              fontWeight: 800,
              lineHeight: 1,
              color: valueColor || "#f8fafc",
              marginBottom: 8,
              wordBreak: "break-word",
            }}
          >
            {value}
          </div>

          <div
            style={{
              fontSize: 12,
              color: "rgba(148,163,184,0.82)",
            }}
          >
            {subtitle}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function InventarioDashboard() {
  const [productos, setProductos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [ultimaActualizacion, setUltimaActualizacion] = useState(null);

  const [busqueda, setBusqueda] = useState("");
  const [departamento, setDepartamento] = useState("TODOS");
  const [soloStockBajo, setSoloStockBajo] = useState(false);
  const [soloConExistencia, setSoloConExistencia] = useState(false);
  const [soloSinExistencia, setSoloSinExistencia] = useState(false);
  const [soloDuplicados, setSoloDuplicados] = useState(false);

  const cargarInventario = useCallback(async () => {
    try {
      setCargando(true);
      setError("");

      const { data, error: supaError } = await supabase
        .from(TABLA_INVENTARIO)
        .select("*");

      if (supaError) {
        setError(`Error cargando inventario: ${supaError.message}`);
        setProductos([]);
        setUltimaActualizacion(null);
        setCargando(false);
        return;
      }

      const rows = Array.isArray(data) ? data : [];

      if (rows.length > 0) {
        console.log("PRIMER REGISTRO INVENTARIO:", rows[0]);
        console.log("COLUMNAS INVENTARIO:", Object.keys(rows[0]));
      }

      const normalizadosBase = rows.map((row, index) => {
        const codigo = String(
          pick(row, [
            "codigo",
            "codigo_barras",
            "codigobarras",
            "barcode",
            "sku",
            "clave",
            "id_articulo",
            "articulo_id",
            "cod_articulo",
            "cve_articulo",
          ])
        ).trim();

        const producto = String(
          pick(row, [
            "descripcion",
            "producto",
            "nombre",
            "articulo",
            "descripcion_articulo",
            "desc_articulo",
            "producto_nombre",
          ])
        ).trim();

        const depto = String(
          pick(row, [
            "departamento",
            "depto",
            "categoria",
            "linea",
            "grupo",
            "departamento_nombre",
          ])
        ).trim();

        const stock = toNumber(
          pick(
            row,
            [
              "existencia",
              "existencia_actual",
              "stock",
              "stock_actual",
              "inventario",
              "cantidad",
              "cantidad_actual",
              "piezas",
              "unidades",
              "inv_actual",
              "invexistencia",
              "existencia1",
              "exis",
              "actual",
              "saldo",
              "saldo_actual",
            ],
            0
          )
        );

        const minimo = toNumber(
          pick(
            row,
            [
              "minimo",
              "stock_minimo",
              "existencia_minima",
              "min",
              "min_stock",
              "punto_reorden",
              "reorden",
              "reorden_minimo",
              "stock_min",
            ],
            0
          )
        );

        const costo = toNumber(
          pick(
            row,
            [
              "costo",
              "costo_unitario",
              "ultimo_costo",
              "cost",
              "costo_promedio",
              "costo_compra",
            ],
            0
          )
        );

        const precio = toNumber(
          pick(
            row,
            [
              "precio",
              "precio_venta",
              "precio1",
              "publico",
              "saleprice",
              "venta",
              "p_venta",
              "precio_publico",
            ],
            0
          )
        );

        const actualizadoEn = pick(
          row,
          ["updated_at", "ultima_actualizacion", "sincronizado_en", "created_at"],
          null
        );

        return {
          __index: index,
          raw: row,
          codigo,
          producto,
          departamento: depto || "- Sin Departamento -",
          stock,
          minimo,
          costo,
          precio,
          valor: stock * costo,
          actualizadoEn,
        };
      });

      const conteoCodigo = {};
      for (const item of normalizadosBase) {
        const key = item.codigo || `SIN_CODIGO_${item.__index}`;
        conteoCodigo[key] = (conteoCodigo[key] || 0) + 1;
      }

      const normalizados = normalizadosBase.map((item) => {
        const key = item.codigo || `SIN_CODIGO_${item.__index}`;
        const duplicados = conteoCodigo[key] || 1;
        const estado = obtenerEstado(item.stock, item.minimo);

        return {
          ...item,
          duplicados,
          estado,
        };
      });

      normalizados.sort((a, b) => {
        const dep = a.departamento.localeCompare(b.departamento, "es", {
          sensitivity: "base",
        });
        if (dep !== 0) return dep;

        const prod = a.producto.localeCompare(b.producto, "es", {
          sensitivity: "base",
        });
        if (prod !== 0) return prod;

        return a.codigo.localeCompare(b.codigo, "es", {
          sensitivity: "base",
        });
      });

      let ultima = null;
      for (const item of normalizados) {
        if (item.actualizadoEn) {
          const fecha = new Date(item.actualizadoEn);
          if (!Number.isNaN(fecha.getTime())) {
            if (!ultima || fecha > ultima) ultima = fecha;
          }
        }
      }

      setProductos(normalizados);
      setUltimaActualizacion(ultima ? ultima.toISOString() : null);
      setCargando(false);
    } catch (err) {
      setError(`Error cargando inventario: ${err.message || err}`);
      setProductos([]);
      setUltimaActualizacion(null);
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarInventario();
  }, [cargarInventario]);

  useEffect(() => {
    const timer = setInterval(() => {
      cargarInventario();
    }, REFRESH_MS);

    return () => clearInterval(timer);
  }, [cargarInventario]);

  const departamentos = useMemo(() => {
    const unicos = Array.from(
      new Set(productos.map((p) => p.departamento).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));

    return ["TODOS", ...unicos];
  }, [productos]);

  const productosFiltrados = useMemo(() => {
    const q = normalizarTexto(busqueda);

    return productos.filter((item) => {
      const coincideBusqueda =
        !q ||
        normalizarTexto(item.codigo).includes(q) ||
        normalizarTexto(item.producto).includes(q) ||
        normalizarTexto(item.departamento).includes(q);

      const coincideDepartamento =
        departamento === "TODOS" || item.departamento === departamento;

      const esStockBajo =
        item.minimo > 0 && item.stock > 0 && item.stock <= item.minimo;
      const tieneExistencia = item.stock > 0;
      const noTieneExistencia = item.stock <= 0;
      const esDuplicado = item.duplicados > 1;

      if (!coincideBusqueda || !coincideDepartamento) return false;
      if (soloStockBajo && !esStockBajo) return false;
      if (soloConExistencia && !tieneExistencia) return false;
      if (soloSinExistencia && !noTieneExistencia) return false;
      if (soloDuplicados && !esDuplicado) return false;

      return true;
    });
  }, [
    productos,
    busqueda,
    departamento,
    soloStockBajo,
    soloConExistencia,
    soloSinExistencia,
    soloDuplicados,
  ]);

  const metricas = useMemo(() => {
    const totalBruto = productos.length;
    const normalizados = productos.length;
    const codigosUnicos = new Set(
      productos.map((p) => p.codigo).filter(Boolean)
    ).size;

    const piezas = productos.reduce((acc, item) => acc + toNumber(item.stock), 0);
    const valorInventario = productos.reduce(
      (acc, item) => acc + toNumber(item.valor),
      0
    );

    const stockBajoReal = productos.filter(
      (p) => p.minimo > 0 && p.stock > 0 && p.stock <= p.minimo
    ).length;

    const duplicados = productos.filter((p) => p.duplicados > 1).length;
    const conExistencia = productos.filter((p) => p.stock > 0).length;
    const sinExistencia = productos.filter((p) => p.stock <= 0).length;

    return {
      totalBruto,
      normalizados,
      codigosUnicos,
      piezas,
      valorInventario,
      stockBajoReal,
      duplicados,
      conExistencia,
      sinExistencia,
    };
  }, [productos]);

  const estilos = {
    page: {
      minHeight: "100vh",
      background:
        "radial-gradient(circle at top left, #12366b 0%, #0a1e3d 36%, #06152d 64%, #041022 100%)",
      color: "#f8fafc",
      padding: "18px",
      fontFamily:
        'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    },

    container: {
      width: "100%",
      maxWidth: 1840,
      margin: "0 auto",
    },

    topBar: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: 16,
      marginBottom: 18,
      flexWrap: "wrap",
    },

    titleWrap: {
      display: "flex",
      flexDirection: "column",
      gap: 4,
    },

    title: {
      margin: 0,
      fontSize: "clamp(36px, 4.2vw, 54px)",
      lineHeight: 1,
      fontWeight: 800,
      letterSpacing: "-1.4px",
    },

    subtitle: {
      margin: 0,
      color: "rgba(226,232,240,0.74)",
      fontSize: 15,
    },

    updateBadge: {
      ...tarjetaBaseStyle(),
      padding: "12px 16px",
      fontSize: 14,
      minWidth: 280,
      textAlign: "right",
      color: "#f8fafc",
      alignSelf: "flex-start",
    },

    metricsGridTop: {
      display: "grid",
      gridTemplateColumns: "repeat(4, minmax(220px, 1fr))",
      gap: 14,
      marginBottom: 14,
    },

    metricsGridBottom: {
      display: "grid",
      gridTemplateColumns: "repeat(6, minmax(180px, 1fr))",
      gap: 14,
      marginBottom: 16,
    },

    filtersCard: {
      ...tarjetaBaseStyle(),
      padding: 12,
      marginBottom: 16,
    },

    filtersGrid: {
      display: "grid",
      gridTemplateColumns: "2.2fr 1.3fr auto auto auto auto auto",
      gap: 10,
      alignItems: "center",
    },

    input: {
      height: 46,
      borderRadius: 12,
      border: "1px solid rgba(148,163,184,0.14)",
      outline: "none",
      background: "rgba(10, 22, 42, 0.92)",
      color: "#f8fafc",
      padding: "0 14px",
      fontSize: 14,
      width: "100%",
    },

    select: {
      height: 46,
      borderRadius: 12,
      border: "1px solid rgba(148,163,184,0.14)",
      outline: "none",
      background: "rgba(10, 22, 42, 0.92)",
      color: "#f8fafc",
      padding: "0 14px",
      fontSize: 14,
      width: "100%",
    },

    checkLabel: {
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      height: 46,
      padding: "0 12px",
      borderRadius: 12,
      border: "1px solid rgba(148,163,184,0.10)",
      background: "rgba(10, 22, 42, 0.65)",
      color: "#f8fafc",
      fontSize: 13,
      whiteSpace: "nowrap",
      cursor: "pointer",
      userSelect: "none",
    },

    button: {
      height: 46,
      borderRadius: 12,
      border: "none",
      background: "linear-gradient(90deg, #2563eb 0%, #3b82f6 100%)",
      color: "#ffffff",
      fontWeight: 700,
      padding: "0 18px",
      cursor: "pointer",
      boxShadow: "0 8px 24px rgba(37, 99, 235, 0.22)",
      whiteSpace: "nowrap",
    },

    tableCard: {
      ...tarjetaBaseStyle(),
      overflow: "hidden",
    },

    tableWrap: {
      width: "100%",
      overflowX: "auto",
    },

    table: {
      width: "100%",
      borderCollapse: "collapse",
      minWidth: 1200,
    },

    th: {
      textAlign: "left",
      fontSize: 12,
      color: "#93c5fd",
      fontWeight: 600,
      padding: "16px 18px",
      borderBottom: "1px solid rgba(148,163,184,0.12)",
      background: "rgba(8, 18, 36, 0.70)",
      position: "sticky",
      top: 0,
      zIndex: 1,
    },

    td: {
      padding: "14px 18px",
      borderBottom: "1px solid rgba(148,163,184,0.08)",
      fontSize: 14,
      color: "#f8fafc",
      verticalAlign: "middle",
    },

    emptyState: {
      padding: "34px 18px",
      textAlign: "center",
      color: "rgba(226,232,240,0.75)",
      fontSize: 15,
    },

    footerTable: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "14px 18px",
      color: "rgba(226,232,240,0.72)",
      fontSize: 13,
      background: "rgba(8, 18, 36, 0.55)",
      gap: 10,
      flexWrap: "wrap",
    },

    error: {
      ...tarjetaBaseStyle(),
      padding: 16,
      marginBottom: 16,
      color: "#fecaca",
      border: "1px solid rgba(239,68,68,0.24)",
      background: "rgba(127,29,29,0.22)",
    },

    loading: {
      ...tarjetaBaseStyle(),
      padding: 18,
      marginBottom: 16,
      color: "rgba(226,232,240,0.85)",
    },
  };

  return (
    <div style={estilos.page}>
      <div style={estilos.container}>
        <div style={estilos.topBar}>
          <div style={estilos.titleWrap}>
            <h1 style={estilos.title}>Reporte de Inventario PRO</h1>
            <p style={estilos.subtitle}>
              Carga total desde Supabase con validación de duplicados y métricas
              reales
            </p>
          </div>

          <div style={estilos.updateBadge}>
            <div
              style={{
                color: "rgba(226,232,240,0.72)",
                fontSize: 13,
                marginBottom: 4,
              }}
            >
              Última actualización:
            </div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>
              {formatearFechaHora(ultimaActualizacion)}
            </div>
          </div>
        </div>

        {error ? <div style={estilos.error}>{error}</div> : null}
        {cargando ? <div style={estilos.loading}>Cargando inventario...</div> : null}

        <div style={estilos.metricsGridTop}>
          <StatCard
            icon="▣"
            iconColor="#60a5fa"
            iconBg="rgba(59,130,246,0.16)"
            title="Productos visibles"
            value={formatNumber(productosFiltrados.length)}
            subtitle="Total en catálogo"
            valueColor="#60a5fa"
          />

          <StatCard
            icon="▤"
            iconColor="#60a5fa"
            iconBg="rgba(59,130,246,0.16)"
            title="Piezas"
            value={formatNumber(metricas.piezas)}
            subtitle="Unidades totales"
            valueColor="#60a5fa"
          />

          <StatCard
            icon="✓"
            iconColor="#34d399"
            iconBg="rgba(16,185,129,0.16)"
            title="Valor inventario"
            value={formatMoney(metricas.valorInventario)}
            subtitle="Valor total"
            valueColor="#22c55e"
          />

          <StatCard
            icon="!"
            iconColor="#fbbf24"
            iconBg="rgba(245,158,11,0.16)"
            title="Stock bajo real"
            value={formatNumber(metricas.stockBajoReal)}
            subtitle="Productos"
            valueColor="#f59e0b"
          />
        </div>

        <div style={estilos.metricsGridBottom}>
          <StatCard
            icon="•"
            iconColor="#60a5fa"
            iconBg="rgba(59,130,246,0.10)"
            title="Total bruto Supabase"
            value={formatNumber(metricas.totalBruto)}
            subtitle="Registros"
            valueColor="#60a5fa"
          />

          <StatCard
            icon="•"
            iconColor="#60a5fa"
            iconBg="rgba(59,130,246,0.10)"
            title="Normalizados"
            value={formatNumber(metricas.normalizados)}
            subtitle="Registros"
            valueColor="#60a5fa"
          />

          <StatCard
            icon="•"
            iconColor="#60a5fa"
            iconBg="rgba(59,130,246,0.10)"
            title="Códigos únicos"
            value={formatNumber(metricas.codigosUnicos)}
            subtitle="Códigos"
            valueColor="#60a5fa"
          />

          <StatCard
            icon="•"
            iconColor="#f87171"
            iconBg="rgba(239,68,68,0.10)"
            title="Duplicados"
            value={formatNumber(metricas.duplicados)}
            subtitle="Registros"
            valueColor="#ef4444"
          />

          <StatCard
            icon="•"
            iconColor="#34d399"
            iconBg="rgba(16,185,129,0.10)"
            title="Con existencia"
            value={formatNumber(metricas.conExistencia)}
            subtitle="Productos"
            valueColor="#22c55e"
          />

          <StatCard
            icon="•"
            iconColor="#cbd5e1"
            iconBg="rgba(148,163,184,0.10)"
            title="Sin existencia"
            value={formatNumber(metricas.sinExistencia)}
            subtitle="Productos"
            valueColor="#cbd5e1"
          />
        </div>

        <div style={estilos.filtersCard}>
          <div style={estilos.filtersGrid}>
            <input
              style={estilos.input}
              placeholder="Buscar por código, producto o departamento..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />

            <select
              style={estilos.select}
              value={departamento}
              onChange={(e) => setDepartamento(e.target.value)}
            >
              {departamentos.map((dep) => (
                <option key={dep} value={dep}>
                  {dep}
                </option>
              ))}
            </select>

            <label style={estilos.checkLabel}>
              <input
                type="checkbox"
                checked={soloStockBajo}
                onChange={(e) => setSoloStockBajo(e.target.checked)}
              />
              Solo stock bajo
            </label>

            <label style={estilos.checkLabel}>
              <input
                type="checkbox"
                checked={soloConExistencia}
                onChange={(e) => setSoloConExistencia(e.target.checked)}
              />
              Solo con existencia
            </label>

            <label style={estilos.checkLabel}>
              <input
                type="checkbox"
                checked={soloSinExistencia}
                onChange={(e) => setSoloSinExistencia(e.target.checked)}
              />
              Solo sin existencia
            </label>

            <label style={estilos.checkLabel}>
              <input
                type="checkbox"
                checked={soloDuplicados}
                onChange={(e) => setSoloDuplicados(e.target.checked)}
              />
              Solo duplicados
            </label>

            <button style={estilos.button} onClick={cargarInventario}>
              Recargar
            </button>
          </div>
        </div>

        <div style={estilos.tableCard}>
          <div style={estilos.tableWrap}>
            <table style={estilos.table}>
              <thead>
                <tr>
                  <th style={estilos.th}>Código</th>
                  <th style={estilos.th}>Producto</th>
                  <th style={estilos.th}>Departamento</th>
                  <th style={estilos.th}>Stock</th>
                  <th style={estilos.th}>Mínimo</th>
                  <th style={estilos.th}>Costo</th>
                  <th style={estilos.th}>Precio</th>
                  <th style={estilos.th}>Valor</th>
                  <th style={estilos.th}>Dup.</th>
                  <th style={estilos.th}>Estado</th>
                </tr>
              </thead>

              <tbody>
                {productosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={10} style={estilos.emptyState}>
                      No se encontraron productos con los filtros actuales.
                    </td>
                  </tr>
                ) : (
                  productosFiltrados.map((item) => {
                    const isSinExistencia = item.stock <= 0;
                    const isStockBajo =
                      item.minimo > 0 &&
                      item.stock > 0 &&
                      item.stock <= item.minimo;

                    return (
                      <tr
                        key={`${item.codigo}-${item.__index}`}
                        style={{
                          background: isSinExistencia
                            ? "rgba(148,163,184,0.04)"
                            : isStockBajo
                            ? "rgba(245,158,11,0.035)"
                            : "transparent",
                          transition: "background 0.18s ease",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background =
                            "rgba(37, 99, 235, 0.10)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = isSinExistencia
                            ? "rgba(148,163,184,0.04)"
                            : isStockBajo
                            ? "rgba(245,158,11,0.035)"
                            : "transparent";
                        }}
                      >
                        <td style={estilos.td}>{item.codigo || "-"}</td>
                        <td style={{ ...estilos.td, fontWeight: 600 }}>
                          {item.producto || "-"}
                        </td>
                        <td style={estilos.td}>{item.departamento || "-"}</td>
                        <td style={estilos.td}>{formatNumber(item.stock)}</td>
                        <td style={estilos.td}>{formatNumber(item.minimo)}</td>
                        <td style={estilos.td}>{formatMoney(item.costo)}</td>
                        <td style={estilos.td}>{formatMoney(item.precio)}</td>
                        <td style={estilos.td}>{formatMoney(item.valor)}</td>
                        <td style={estilos.td}>
                          <span style={getDupBadgeStyle(item.duplicados)}>
                            {item.duplicados}
                          </span>
                        </td>
                        <td style={estilos.td}>
                          <span style={getEstadoBadgeStyle(item.estado)}>
                            {item.estado}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div style={estilos.footerTable}>
            <div>
              Mostrando <strong>{formatNumber(productosFiltrados.length)}</strong>{" "}
              de <strong>{formatNumber(productos.length)}</strong> registros
            </div>

            <div>Auto refresh cada 5 minutos</div>
          </div>
        </div>
      </div>
    </div>
  );
}