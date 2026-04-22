import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../supabase";

const REFRESH_MS = 5 * 60 * 1000;
const PAGE_SIZE = 1000;

function formatMoney(n) {
  return Number(n || 0).toLocaleString("es-MX", {
    style: "currency",
    currency: "MXN",
  });
}

function formatNumber(n) {
  return Number(n || 0).toLocaleString("es-MX");
}

function pick(obj, keys, fallback = "") {
  for (const key of keys) {
    if (obj?.[key] !== undefined && obj?.[key] !== null && obj?.[key] !== "") {
      return obj[key];
    }
  }
  return fallback;
}

function toBool(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    return ["1", "true", "si", "sí", "yes", "x", "activo"].includes(v);
  }
  return false;
}

function normalizeProducto(row) {
  const codigo = String(
    pick(row, ["codigo", "codigobarras", "codigo_barras", "clave", "sku"], "")
  ).trim();

  const descripcion = String(
    pick(row, ["descripcion", "producto", "nombre", "articulo"], "")
  ).trim();

  const departamento = String(
    pick(row, ["departamento", "depto", "grupo", "categoria"], "SIN DEPARTAMENTO")
  ).trim();

  const stockActual = Number(
    pick(
      row,
      ["stock_actual", "existencia", "stock", "inventario_actual", "cantidad"],
      0
    )
  );

  const stockMinimo = Number(
    pick(row, ["stock_minimo", "minimo", "existencia_minima"], 0)
  );

  const costo = Number(
    pick(row, ["costo", "costo_promedio", "ultimo_costo", "precio_costo"], 0)
  );

  const precio = Number(
    pick(row, ["precio", "precio_venta", "venta", "p_venta"], 0)
  );

  const activo = toBool(pick(row, ["activo", "estatus", "habilitado"], true));

  const usaInventario = toBool(
    pick(
      row,
      [
        "usa_inventario",
        "maneja_inventario",
        "controla_inventario",
        "inventariable",
        "con_inventario",
      ],
      false
    )
  );

  const valorInventario = stockActual * costo;
  const stockBajo = stockMinimo > 0 && stockActual <= stockMinimo;
  const sinExistencia = stockActual <= 0;
  const tieneCosto = costo > 0;
  const tienePrecio = precio > 0;

  return {
    ...row,
    codigo,
    descripcion,
    departamento: departamento || "SIN DEPARTAMENTO",
    stock_actual: stockActual,
    stock_minimo: stockMinimo,
    costo,
    precio,
    activo,
    usa_inventario: usaInventario,
    valor_inventario: valorInventario,
    stock_bajo: stockBajo,
    sin_existencia: sinExistencia,
    tiene_costo: tieneCosto,
    tiene_precio: tienePrecio,
  };
}

export default function InventarioDashboard() {
  const [productos, setProductos] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [departamento, setDepartamento] = useState("TODOS");
  const [soloStockBajo, setSoloStockBajo] = useState(false);
  const [soloConExistencia, setSoloConExistencia] = useState(false);
  const [soloSinExistencia, setSoloSinExistencia] = useState(false);
  const [soloDuplicados, setSoloDuplicados] = useState(false);
  const [loading, setLoading] = useState(true);
  const [ultima, setUltima] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [totalRaw, setTotalRaw] = useState(0);

  const cargar = async () => {
    setLoading(true);
    setErrorMsg("");

    try {
      let allData = [];
      let from = 0;

      while (true) {
        const { data, error } = await supabase
          .from("eleventa_inventario")
          .select("*")
          .order("descripcion", { ascending: true })
          .range(from, from + PAGE_SIZE - 1);

        if (error) {
          throw error;
        }

        if (!data || data.length === 0) break;

        allData = allData.concat(data);

        if (data.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }

      console.log("TOTAL RAW:", allData.length);

      const normalizados = allData
        .map(normalizeProducto)
        .filter((p) => p.descripcion || p.codigo);

      console.log("TOTAL NORMALIZADOS:", normalizados.length);
      console.log(
        "CODIGOS UNICOS:",
        new Set(normalizados.map((p) => p.codigo).filter(Boolean)).size
      );

      setTotalRaw(allData.length);
      setProductos(normalizados);
      setUltima(new Date());
    } catch (error) {
      console.error("ERROR SUPABASE:", error);
      setErrorMsg(error.message || "No se pudo cargar eleventa_inventario");
      setProductos([]);
      setTotalRaw(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargar();
    const i = setInterval(cargar, REFRESH_MS);
    return () => clearInterval(i);
  }, []);

  const conteoCodigos = useMemo(() => {
    const map = new Map();
    for (const p of productos) {
      const key = (p.codigo || "").trim();
      if (!key) continue;
      map.set(key, (map.get(key) || 0) + 1);
    }
    return map;
  }, [productos]);

  const productosConMeta = useMemo(() => {
    return productos.map((p) => {
      const repeticiones = conteoCodigos.get((p.codigo || "").trim()) || 0;
      return {
        ...p,
        duplicado: repeticiones > 1,
        repeticiones_codigo: repeticiones,
      };
    });
  }, [productos, conteoCodigos]);

  const departamentos = useMemo(() => {
    const lista = Array.from(
      new Set(productosConMeta.map((p) => p.departamento || "SIN DEPARTAMENTO"))
    ).sort((a, b) => a.localeCompare(b, "es-MX"));

    return ["TODOS", ...lista];
  }, [productosConMeta]);

  const filtrados = useMemo(() => {
    const b = busqueda.toLowerCase().trim();

    return productosConMeta.filter((p) => {
      const coincideBusqueda =
        !b ||
        p.descripcion?.toLowerCase().includes(b) ||
        p.codigo?.toLowerCase().includes(b) ||
        p.departamento?.toLowerCase().includes(b);

      const coincideDepartamento =
        departamento === "TODOS" || p.departamento === departamento;

      const coincideStockBajo = !soloStockBajo || p.stock_bajo;
      const coincideConExistencia = !soloConExistencia || Number(p.stock_actual || 0) > 0;
      const coincideSinExistencia = !soloSinExistencia || Number(p.stock_actual || 0) <= 0;
      const coincideDuplicado = !soloDuplicados || p.duplicado;

      return (
        coincideBusqueda &&
        coincideDepartamento &&
        coincideStockBajo &&
        coincideConExistencia &&
        coincideSinExistencia &&
        coincideDuplicado
      );
    });
  }, [
    productosConMeta,
    busqueda,
    departamento,
    soloStockBajo,
    soloConExistencia,
    soloSinExistencia,
    soloDuplicados,
  ]);

  const stats = useMemo(() => {
    let stockBajo = 0;
    let piezas = 0;
    let valor = 0;
    let conExistencia = 0;
    let sinExistencia = 0;
    let conCosto = 0;
    let conPrecio = 0;
    let duplicados = 0;

    for (const p of filtrados) {
      const stock = Number(p.stock_actual || 0);

      if (p.stock_bajo) stockBajo++;
      if (stock > 0) conExistencia++;
      if (stock <= 0) sinExistencia++;
      if (p.tiene_costo) conCosto++;
      if (p.tiene_precio) conPrecio++;
      if (p.duplicado) duplicados++;

      piezas += stock;
      valor += Number(p.valor_inventario || 0);
    }

    return {
      total: filtrados.length,
      stockBajo,
      piezas,
      valor,
      conExistencia,
      sinExistencia,
      conCosto,
      conPrecio,
      duplicados,
    };
  }, [filtrados]);

  const resumenGlobal = useMemo(() => {
    const codigosUnicos = new Set(
      productosConMeta.map((p) => p.codigo).filter(Boolean)
    ).size;

    const duplicados = productosConMeta.filter((p) => p.duplicado).length;
    const conExistencia = productosConMeta.filter(
      (p) => Number(p.stock_actual || 0) > 0
    ).length;

    const sinExistencia = productosConMeta.filter(
      (p) => Number(p.stock_actual || 0) <= 0
    ).length;

    return {
      totalRaw,
      totalNormalizados: productosConMeta.length,
      codigosUnicos,
      duplicados,
      conExistencia,
      sinExistencia,
    };
  }, [productosConMeta, totalRaw]);

  const alertas = useMemo(() => {
    return productosConMeta
      .filter((p) => p.stock_bajo || p.duplicado)
      .sort((a, b) => {
        if (a.stock_bajo && !b.stock_bajo) return -1;
        if (!a.stock_bajo && b.stock_bajo) return 1;
        if (a.duplicado && !b.duplicado) return -1;
        if (!a.duplicado && b.duplicado) return 1;
        return String(a.descripcion).localeCompare(String(b.descripcion), "es-MX");
      })
      .slice(0, 20);
  }, [productosConMeta]);

  return (
    <div
      style={{
        minHeight: "100vh",
        padding: 20,
        color: "#fff",
        background:
          "radial-gradient(circle at top, #0f274f 0%, #08152d 45%, #050d1f 100%)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 20,
        }}
      >
        <div>
          <h1 style={{ margin: 0 }}>Reporte de Inventario PRO</h1>
          <p style={{ margin: "6px 0 0", color: "#9fb0cc" }}>
            Carga total desde Supabase con validación de duplicados y métricas reales
          </p>
        </div>

        <div
          style={{
            background: "#0b1a33",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 10,
            padding: "10px 14px",
            alignSelf: "flex-start",
          }}
        >
          Última actualización: {ultima?.toLocaleString() || "--"}
        </div>
      </div>

      {errorMsg ? (
        <div
          style={{
            background: "#3b1111",
            color: "#fecaca",
            borderRadius: 10,
            padding: 12,
            marginBottom: 16,
          }}
        >
          {errorMsg}
        </div>
      ) : null}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 12,
          marginBottom: 12,
        }}
      >
        <Card title="Productos visibles" value={formatNumber(stats.total)} />
        <Card title="Piezas" value={formatNumber(stats.piezas)} />
        <Card title="Valor inventario" value={formatMoney(stats.valor)} color="#22c55e" />
        <Card title="Stock bajo real" value={formatNumber(stats.stockBajo)} color="#f59e0b" />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 12,
          marginBottom: 20,
        }}
      >
        <Card title="Total bruto Supabase" value={formatNumber(resumenGlobal.totalRaw)} />
        <Card title="Normalizados" value={formatNumber(resumenGlobal.totalNormalizados)} />
        <Card title="Códigos únicos" value={formatNumber(resumenGlobal.codigosUnicos)} />
        <Card title="Duplicados" value={formatNumber(resumenGlobal.duplicados)} color="#ef4444" />
        <Card title="Con existencia" value={formatNumber(resumenGlobal.conExistencia)} color="#22c55e" />
        <Card title="Sin existencia" value={formatNumber(resumenGlobal.sinExistencia)} color="#94a3b8" />
      </div>

      <div
        style={{
          background: "#0b1a33",
          borderRadius: 12,
          padding: 12,
          marginBottom: 16,
          display: "grid",
          gridTemplateColumns: "1.5fr 0.9fr auto auto auto auto",
          gap: 10,
          alignItems: "center",
        }}
      >
        <input
          placeholder="Buscar por código, producto o departamento..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          style={inputStyle}
        />

        <select
          value={departamento}
          onChange={(e) => setDepartamento(e.target.value)}
          style={inputStyle}
        >
          {departamentos.map((dep) => (
            <option key={dep} value={dep}>
              {dep}
            </option>
          ))}
        </select>

        <CheckBoxChip
          label="Solo stock bajo"
          checked={soloStockBajo}
          onChange={setSoloStockBajo}
        />

        <CheckBoxChip
          label="Solo con existencia"
          checked={soloConExistencia}
          onChange={setSoloConExistencia}
        />

        <CheckBoxChip
          label="Solo sin existencia"
          checked={soloSinExistencia}
          onChange={setSoloSinExistencia}
        />

        <CheckBoxChip
          label="Solo duplicados"
          checked={soloDuplicados}
          onChange={setSoloDuplicados}
        />

        <button onClick={cargar} style={buttonStyle}>
          Recargar
        </button>
      </div>

      <div
        style={{
          background: "#0b1a33",
          borderRadius: 12,
          padding: 12,
          overflowX: "auto",
        }}
      >
        {loading ? (
          <p>Cargando inventario completo...</p>
        ) : filtrados.length === 0 ? (
          <p>No hay productos para mostrar.</p>
        ) : (
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              minWidth: 1200,
            }}
          >
            <thead>
              <tr>
                <Th>Código</Th>
                <Th>Producto</Th>
                <Th>Departamento</Th>
                <Th align="right">Stock</Th>
                <Th align="right">Mínimo</Th>
                <Th align="right">Costo</Th>
                <Th align="right">Precio</Th>
                <Th align="right">Valor</Th>
                <Th align="center">Dup.</Th>
                <Th align="center">Estado</Th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((p, i) => {
                const bajo = p.stock_bajo;
                const duplicado = p.duplicado;

                return (
                  <tr
                    key={`${p.codigo}-${p.id || i}`}
                    style={{
                      borderTop: "1px solid rgba(255,255,255,0.06)",
                      background: bajo
                        ? "rgba(127,29,29,0.25)"
                        : duplicado
                        ? "rgba(120,53,15,0.20)"
                        : "transparent",
                    }}
                  >
                    <Td>{p.codigo || "-"}</Td>
                    <Td>{p.descripcion || "-"}</Td>
                    <Td>{p.departamento || "-"}</Td>
                    <Td align="right">{formatNumber(p.stock_actual)}</Td>
                    <Td align="right">{formatNumber(p.stock_minimo)}</Td>
                    <Td align="right">{formatMoney(p.costo)}</Td>
                    <Td align="right">{formatMoney(p.precio)}</Td>
                    <Td align="right">{formatMoney(p.valor_inventario)}</Td>
                    <Td align="center">
                      {duplicado ? (
                        <span style={badgeWarnStyle}>{p.repeticiones_codigo}</span>
                      ) : (
                        <span style={badgeOkStyle}>1</span>
                      )}
                    </Td>
                    <Td align="center">
                      {bajo ? (
                        <span style={badgeLowStyle}>STOCK BAJO</span>
                      ) : Number(p.stock_actual || 0) <= 0 ? (
                        <span style={badgeGrayStyle}>SIN EXISTENCIA</span>
                      ) : (
                        <span style={badgeOkStyle}>OK</span>
                      )}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div
        style={{
          background: "#0b1a33",
          borderRadius: 12,
          padding: 16,
          marginTop: 20,
        }}
      >
        <h3 style={{ marginTop: 0 }}>Alertas inteligentes</h3>

        {alertas.length === 0 ? (
          <p>Todo bien 👍</p>
        ) : (
          alertas.map((a, i) => (
            <div
              key={`${a.codigo}-${a.id || i}`}
              style={{
                color: a.stock_bajo ? "#fbbf24" : "#fb923c",
                marginBottom: 8,
              }}
            >
              {a.stock_bajo ? "⚠" : "🟠"} {a.descripcion || a.codigo} —{" "}
              {a.stock_bajo
                ? `Stock: ${formatNumber(a.stock_actual)} / Mínimo: ${formatNumber(
                    a.stock_minimo
                  )}`
                : `Código duplicado: ${a.codigo} (${a.repeticiones_codigo} registros)`}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function Card({ title, value, color = "#2563eb" }) {
  return (
    <div
      style={{
        background: "#0b1a33",
        padding: 15,
        borderRadius: 10,
        minWidth: 180,
      }}
    >
      <p style={{ margin: 0, color: "#9fb0cc", fontSize: 14 }}>{title}</p>
      <h2 style={{ margin: "8px 0 0", color }}>{value}</h2>
    </div>
  );
}

function CheckBoxChip({ label, checked, onChange }) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        whiteSpace: "nowrap",
        background: "#102446",
        padding: "10px 12px",
        borderRadius: 10,
        height: 44,
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}

function Th({ children, align = "left" }) {
  return (
    <th
      align={align}
      style={{
        padding: "12px 10px",
        color: "#9fb0cc",
        fontWeight: 600,
        fontSize: 13,
        textAlign: align,
      }}
    >
      {children}
    </th>
  );
}

function Td({ children, align = "left" }) {
  return (
    <td
      align={align}
      style={{
        padding: "12px 10px",
        textAlign: align,
      }}
    >
      {children}
    </td>
  );
}

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "#102446",
  color: "#fff",
  outline: "none",
  height: 44,
};

const buttonStyle = {
  height: 44,
  padding: "0 16px",
  borderRadius: 10,
  border: "none",
  background: "#2563eb",
  color: "#fff",
  fontWeight: 700,
  cursor: "pointer",
};

const badgeOkStyle = {
  display: "inline-block",
  padding: "5px 10px",
  borderRadius: 999,
  background: "rgba(34,197,94,0.15)",
  color: "#4ade80",
  fontWeight: 700,
  fontSize: 12,
};

const badgeLowStyle = {
  display: "inline-block",
  padding: "5px 10px",
  borderRadius: 999,
  background: "rgba(245,158,11,0.15)",
  color: "#fbbf24",
  fontWeight: 700,
  fontSize: 12,
};

const badgeWarnStyle = {
  display: "inline-block",
  padding: "5px 10px",
  borderRadius: 999,
  background: "rgba(249,115,22,0.15)",
  color: "#fb923c",
  fontWeight: 700,
  fontSize: 12,
};

const badgeGrayStyle = {
  display: "inline-block",
  padding: "5px 10px",
  borderRadius: 999,
  background: "rgba(148,163,184,0.15)",
  color: "#cbd5e1",
  fontWeight: 700,
  fontSize: 12,
};