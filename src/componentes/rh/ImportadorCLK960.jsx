import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "../../supabase";

export default function ImportadorCLK960({ onImportado }) {
  const inputRef = useRef(null);
  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje] = useState("");

  const normalizarFecha = (valor) => {
    if (!valor) return null;

    if (typeof valor === "number") {
      const fecha = XLSX.SSF.parse_date_code(valor);
      if (!fecha) return null;

      const y = String(fecha.y);
      const m = String(fecha.m).padStart(2, "0");
      const d = String(fecha.d).padStart(2, "0");

      return `${y}-${m}-${d}`;
    }

    const textoOriginal = String(valor).trim();
    if (!textoOriginal) return null;

    const soloFecha = textoOriginal.split(" ")[0].trim();

    if (/^\d{4}-\d{2}-\d{2}$/.test(soloFecha)) {
      return soloFecha;
    }

    const partes = soloFecha.split(/[\/\-.]/).map((p) => p.trim());

    if (partes.length !== 3) return null;

    let anio = "";
    let mes = "";
    let dia = "";

    if (partes[0].length === 4) {
      anio = partes[0];
      mes = partes[1];
      dia = partes[2];
    } else if (partes[2].length === 4) {
      const a = Number(partes[0]);
      const b = Number(partes[1]);
      const c = partes[2];

      anio = c;

      // Para CLK960 asumimos MM/DD/YYYY
      mes = String(a).padStart(2, "0");
      dia = String(b).padStart(2, "0");
    } else {
      return null;
    }

    const mesNumero = Number(mes);
    const diaNumero = Number(dia);
    const anioNumero = Number(anio);

    if (
      !Number.isInteger(anioNumero) ||
      !Number.isInteger(mesNumero) ||
      !Number.isInteger(diaNumero) ||
      mesNumero < 1 ||
      mesNumero > 12 ||
      diaNumero < 1 ||
      diaNumero > 31
    ) {
      return null;
    }

    return `${anio}-${String(mesNumero).padStart(2, "0")}-${String(diaNumero).padStart(2, "0")}`;
  };

  const normalizarHora = (valor) => {
    if (valor === null || valor === undefined || valor === "") return null;

    if (typeof valor === "number") {
      const totalSegundos = Math.round(valor * 24 * 60 * 60);
      const h = String(Math.floor(totalSegundos / 3600) % 24).padStart(2, "0");
      const m = String(Math.floor((totalSegundos % 3600) / 60)).padStart(2, "0");
      const s = String(totalSegundos % 60).padStart(2, "0");
      return `${h}:${m}:${s}`;
    }

    const texto = String(valor).trim();
    if (!texto) return null;

    if (/^\d{1,2}:\d{2}$/.test(texto)) {
      const [h, m] = texto.split(":");
      return `${String(h).padStart(2, "0")}:${m}:00`;
    }

    if (/^\d{1,2}:\d{2}:\d{2}$/.test(texto)) {
      const [h, m, s] = texto.split(":");
      return `${String(h).padStart(2, "0")}:${m}:${s}`;
    }

    return null;
  };

  const detectarColumna = (obj, posibles) => {
    const claves = Object.keys(obj || {});
    return claves.find((k) =>
      posibles.some((p) => k.toLowerCase().includes(p.toLowerCase()))
    );
  };

  const horaASegundos = (hora) => {
    if (!hora) return 0;
    const [h = 0, m = 0, s = 0] = String(hora).split(":").map(Number);
    return h * 3600 + m * 60 + s;
  };

  const clasificarTipo = (hora) => {
    const segundos = horaASegundos(hora);

    if (segundos < 5 * 3600) return "salida";
    if (segundos >= 12 * 3600) return "entrada";
    return "entrada";
  };

  const insertarEnBloques = async (registros, tamano = 500) => {
    let procesados = 0;

    for (let i = 0; i < registros.length; i += tamano) {
      const bloque = registros.slice(i, i + tamano);

      const { error } = await supabase.from("checadas").insert(bloque);

      if (error) {
        console.error("Error Supabase al guardar bloque:", error);
        throw error;
      }

      procesados += bloque.length;
    }

    return procesados;
  };

  const manejarArchivo = async (e) => {
    const archivo = e.target.files?.[0];
    if (!archivo) return;

    setCargando(true);
    setMensaje("");

    try {
      const data = await archivo.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });
      const hoja = workbook.Sheets[workbook.SheetNames[0]];
      const filas = XLSX.utils.sheet_to_json(hoja, { defval: "" });

      if (!filas.length) {
        setMensaje("El archivo está vacío.");
        return;
      }

      const ejemplo = filas[0];

      const colEmpleado = detectarColumna(ejemplo, [
        "id de usuario",
        "id",
        "user id",
        "no",
        "numero",
        "empleado",
      ]);

      const colNombre = detectarColumna(ejemplo, ["nombre", "name"]);

      const colTiempo = detectarColumna(ejemplo, [
        "tiempo",
        "fecha y hora",
        "datetime",
        "timestamp",
      ]);

      if (!colEmpleado || !colTiempo) {
        setMensaje("No se encontraron las columnas necesarias: ID de Usuario y Tiempo.");
        return;
      }

      const registrosFinales = filas
        .map((fila) => {
          const numero_empleado = fila[colEmpleado];
          const nombre = colNombre ? fila[colNombre] : "";
          const tiempoCompleto = fila[colTiempo];

          if (!numero_empleado || !tiempoCompleto) return null;

          let fecha = null;
          let hora = null;

          if (typeof tiempoCompleto === "number") {
            const fechaExcel = XLSX.SSF.parse_date_code(tiempoCompleto);

            if (fechaExcel) {
              fecha = `${fechaExcel.y}-${String(fechaExcel.m).padStart(2, "0")}-${String(
                fechaExcel.d
              ).padStart(2, "0")}`;

              hora = `${String(fechaExcel.H || 0).padStart(2, "0")}:${String(
                fechaExcel.M || 0
              ).padStart(2, "0")}:${String(fechaExcel.S || 0).padStart(2, "0")}`;
            }
          } else {
            const textoTiempo = String(tiempoCompleto).trim().replace(/\s+/g, " ");
            const partes = textoTiempo.split(" ");

            if (partes.length >= 2) {
              fecha = normalizarFecha(partes[0]);
              hora = normalizarHora(partes[1]);
            } else {
              fecha = normalizarFecha(textoTiempo);
            }
          }

          console.log("ORIGINAL:", tiempoCompleto);
          console.log("NORMALIZADO:", fecha, hora);

          if (!fecha || !hora) return null;

          return {
            numero_empleado: String(numero_empleado).trim(),
            nombre: String(nombre || "")
              .replace(/\./g, " ")
              .replace(/\s+/g, " ")
              .trim(),
            fecha,
            hora,
            tipo: clasificarTipo(hora),
            origen: "clk960",
          };
        })
        .filter(Boolean);

      if (!registrosFinales.length) {
        setMensaje("No se detectaron registros válidos para importar.");
        return;
      }

      const insertados = await insertarEnBloques(registrosFinales);

      setMensaje(
        `Archivo procesado correctamente. Registros detectados: ${registrosFinales.length}. Registros guardados: ${insertados}.`
      );

      onImportado?.();
    } catch (error) {
      console.error(error);
      setMensaje(`Error al importar el archivo: ${error.message || "desconocido"}`);
    } finally {
      setCargando(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div
      style={{
        background: "#ffffff",
        borderRadius: "20px",
        padding: "20px",
        color: "#0f172a",
        marginBottom: "24px",
        boxShadow: "0 8px 24px rgba(0,0,0,0.14)",
      }}
    >
      <h3 style={{ marginTop: 0, marginBottom: "8px", fontSize: "32px" }}>
        Importar archivo CLK-960
      </h3>

      <p style={{ marginTop: 0, color: "#64748b", fontSize: "15px" }}>
        Sube el Excel o CSV exportado desde el software del reloj.
      </p>

      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        onChange={manejarArchivo}
        disabled={cargando}
        style={{ marginTop: "10px" }}
      />

      {cargando && <p style={{ marginTop: "12px", fontWeight: 700 }}>Importando...</p>}
      {mensaje && <p style={{ marginTop: "12px", fontWeight: 700 }}>{mensaje}</p>}
    </div>
  );
}