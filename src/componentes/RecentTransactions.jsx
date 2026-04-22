export default function RecentTransactions({ transacciones = [], eliminar }) {
  const listaSegura = Array.isArray(transacciones) ? transacciones : [];

  const transaccionesOrdenadas = [...listaSegura].sort((a, b) => {
    const fechaA = new Date(a?.fecha || 0);
    const fechaB = new Date(b?.fecha || 0);
    return fechaB - fechaA;
  });

  function obtenerFecha(fechaCompleta) {
    if (!fechaCompleta) return "--/--/----";
    const fecha = new Date(fechaCompleta);
    if (Number.isNaN(fecha.getTime())) return String(fechaCompleta);

    return fecha.toLocaleDateString("es-MX", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  }

  function obtenerHora(fechaCompleta) {
    if (!fechaCompleta) return "--:--";
    const fecha = new Date(fechaCompleta);
    if (Number.isNaN(fecha.getTime())) return "--:--";

    return fecha.toLocaleTimeString("es-MX", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  }

  function obtenerTipoTexto(tipo) {
    if (tipo === "pago_tarjeta") return "Pago tarjeta";
    return String(tipo || "")
      .charAt(0)
      .toUpperCase() + String(tipo || "").slice(1);
  }

  function obtenerMetodoTexto(metodo) {
    if (metodo === "debito") return "Débito";
    if (metodo === "credito") return "Crédito";
    return "Efectivo";
  }

  function obtenerBadgeTipo(tipo) {
    if (tipo === "ingreso") {
      return {
        background: "rgba(34,197,94,0.16)",
        color: "#4ade80",
      };
    }

    if (tipo === "gasto") {
      return {
        background: "rgba(239,68,68,0.16)",
        color: "#f87171",
      };
    }

    return {
      background: "rgba(139,92,246,0.16)",
      color: "#a78bfa",
    };
  }

  return (
    <div
      style={{
        background: "transparent",
        borderRadius: "0",
        padding: 0,
        boxShadow: "none",
        border: "none",
        marginBottom: 0,
      }}
    >
      {transaccionesOrdenadas.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            color: "rgba(226,232,240,0.72)",
            padding: "30px 10px",
            fontSize: "16px",
          }}
        >
          No hay movimientos para mostrar.
        </div>
      ) : (
        <div
          style={{
            maxHeight: "520px",
            overflowY: "auto",
            overflowX: "auto",
            borderRadius: "16px",
            border: "1px solid rgba(148,163,184,0.10)",
            background: "rgba(3, 14, 35, 0.45)",
          }}
        >
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              minWidth: "1000px",
            }}
          >
            <thead>
              <tr>
                {[
                  "Fecha",
                  "Hora",
                  "Tipo",
                  "Método",
                  "Categoría",
                  "Monto",
                  "Acciones",
                ].map((col) => (
                  <th
                    key={col}
                    style={{
                      position: "sticky",
                      top: 0,
                      background: "rgba(6, 18, 43, 0.96)",
                      zIndex: 2,
                      padding: "16px 16px",
                      textAlign: "center",
                      color: "rgba(226,232,240,0.82)",
                      fontSize: "15px",
                      fontWeight: "800",
                      borderBottom: "1px solid rgba(148,163,184,0.14)",
                      backdropFilter: "blur(6px)",
                    }}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {transaccionesOrdenadas.map((transaccion, index) => {
                const badgeTipo = obtenerBadgeTipo(transaccion.tipo);
                const esIngreso = transaccion.tipo === "ingreso";
                const colorMonto = esIngreso ? "#22c55e" : "#ff4d4f";

                return (
                  <tr
                    key={transaccion.id}
                    style={{
                      background:
                        index % 2 === 0
                          ? "rgba(255,255,255,0.01)"
                          : "rgba(255,255,255,0.03)",
                    }}
                  >
                    <td
                      style={{
                        padding: "16px",
                        textAlign: "center",
                        color: "rgba(226,232,240,0.88)",
                        borderBottom: "1px solid rgba(148,163,184,0.08)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {obtenerFecha(transaccion.fecha)}
                    </td>

                    <td
                      style={{
                        padding: "16px",
                        textAlign: "center",
                        color: "rgba(226,232,240,0.72)",
                        borderBottom: "1px solid rgba(148,163,184,0.08)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {obtenerHora(transaccion.fecha)}
                    </td>

                    <td
                      style={{
                        padding: "16px",
                        textAlign: "center",
                        borderBottom: "1px solid rgba(148,163,184,0.08)",
                      }}
                    >
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          minWidth: "108px",
                          padding: "8px 14px",
                          borderRadius: "999px",
                          fontWeight: "800",
                          fontSize: "14px",
                          background: badgeTipo.background,
                          color: badgeTipo.color,
                        }}
                      >
                        {obtenerTipoTexto(transaccion.tipo)}
                      </span>
                    </td>

                    <td
                      style={{
                        padding: "16px",
                        textAlign: "center",
                        color: "rgba(226,232,240,0.82)",
                        borderBottom: "1px solid rgba(148,163,184,0.08)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {obtenerMetodoTexto(transaccion.metodo)}
                    </td>

                    <td
                      style={{
                        padding: "16px",
                        textAlign: "center",
                        color: "rgba(226,232,240,0.82)",
                        borderBottom: "1px solid rgba(148,163,184,0.08)",
                        minWidth: "220px",
                      }}
                    >
                      {transaccion.categoria || "-"}
                    </td>

                    <td
                      style={{
                        padding: "16px",
                        textAlign: "center",
                        fontWeight: "900",
                        fontSize: "15px",
                        color: colorMonto,
                        borderBottom: "1px solid rgba(148,163,184,0.08)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {esIngreso ? "+" : "-"}
                      {Number(transaccion.monto || 0).toLocaleString("es-MX", {
                        style: "currency",
                        currency: "MXN",
                        maximumFractionDigits: 2,
                      })}
                    </td>

                    <td
                      style={{
                        padding: "16px",
                        textAlign: "center",
                        borderBottom: "1px solid rgba(148,163,184,0.08)",
                      }}
                    >
                      {typeof eliminar === "function" ? (
                        <button
                          onClick={() => eliminar(transaccion.id)}
                          style={{
                            background: "rgba(127,29,29,0.22)",
                            color: "#ff5a5f",
                            border: "1px solid rgba(248,113,113,0.18)",
                            borderRadius: "12px",
                            width: "42px",
                            height: "42px",
                            fontWeight: "900",
                            fontSize: "18px",
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                          title="Eliminar movimiento"
                        >
                          🗑
                        </button>
                      ) : (
                        <span style={{ color: "rgba(148,163,184,0.7)" }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div
            style={{
              padding: "16px",
              display: "flex",
              justifyContent: "center",
              borderTop: "1px solid rgba(148,163,184,0.10)",
              background: "rgba(255,255,255,0.01)",
            }}
          >
            <button
              type="button"
              style={{
                background: "transparent",
                border: "none",
                color: "#3b82f6",
                fontWeight: "800",
                fontSize: "16px",
                cursor: "pointer",
              }}
            >
              Ver todos los movimientos →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}