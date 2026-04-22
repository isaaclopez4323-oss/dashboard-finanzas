export default function SummaryCard({ titulo, valor, color = "#16a34a" }) {
  const esGasto = color === "#dc2626" || color === "#ef4444";

  return (
    <div
      style={{
        background: "#fff",
        borderRadius: "22px",
        padding: "26px 18px",
        boxShadow: "0 2px 10px rgba(0,0,0,0.06)",
        border: "1px solid #eef2f7",
        textAlign: "center",
        minHeight: "190px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div
        style={{
          width: 60,
          height: 60,
          borderRadius: 18,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "2rem",
          fontWeight: "800",
          marginBottom: 20,
          background: esGasto ? "#fee2e2" : "#dcfce7",
          color: esGasto ? "#dc2626" : "#16a34a",
        }}
      >
        $
      </div>

      <div
        style={{
          color: "#64748b",
          fontSize: "1rem",
          lineHeight: 1.5,
          marginBottom: 14,
          minHeight: "48px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
        }}
      >
        {titulo}
      </div>

      <div
        style={{
          fontSize: "1.4em",
          fontWeight: "750",
          color: "#0f172a",
          lineHeight: 1,
          wordBreak: "break-word",
        }}
      >
        {valor}
      </div>
    </div>
  );
}