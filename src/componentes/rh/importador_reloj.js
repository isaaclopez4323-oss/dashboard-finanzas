const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");
const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = "https://sppibfxwqcmloxacuavn.supabase.co";
const supabaseKey = "PON_AQUI_TU_NUEVA_SERVICE_ROLE_KEY";

const supabase = createClient(supabaseUrl, supabaseKey);

const carpeta = "C:/reloj/exportaciones";
const extensionesValidas = [".xls", ".xlsx", ".csv"];

function extensionValida(nombreArchivo) {
  return extensionesValidas.includes(path.extname(nombreArchivo).toLowerCase());
}

function horaASegundos(hora) {
  if (!hora) return 0;
  const partes = String(hora).split(":").map(Number);
  const h = partes[0] || 0;
  const m = partes[1] || 0;
  const s = partes[2] || 0;
  return h * 3600 + m * 60 + s;
}

function clasificarTipo(hora) {
  const seg = horaASegundos(hora);

  if (seg < 5 * 3600) return "salida";
  if (seg >= 12 * 3600) return "entrada";

  return "entrada";
}

function normalizarHora(valor) {
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
}

function normalizarFecha(fechaTexto) {
  if (!fechaTexto) return null;

  const texto = String(fechaTexto).trim().replace(/\./g, "-").replace(/\//g, "-");
  const partes = texto.split("-").map((p) => p.trim());

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

    // Formato del reloj: MM/DD/YYYY
    if (a >= 1 && a <= 12 && b >= 1 && b <= 31) {
      mes = String(a).padStart(2, "0");
      dia = String(b).padStart(2, "0");
    } else {
      return null;
    }
  } else {
    return null;
  }

  const mesNum = Number(mes);
  const diaNum = Number(dia);
  const anioNum = Number(anio);

  if (
    !Number.isInteger(anioNum) ||
    !Number.isInteger(mesNum) ||
    !Number.isInteger(diaNum) ||
    mesNum < 1 ||
    mesNum > 12 ||
    diaNum < 1 ||
    diaNum > 31
  ) {
    return null;
  }

  return `${anio}-${String(mesNum).padStart(2, "0")}-${String(diaNum).padStart(2, "0")}`;
}

function convertirFechaExcelAISO(valor) {
  if (!valor) return null;

  if (typeof valor === "number") {
    const fecha = XLSX.SSF.parse_date_code(valor);
    if (!fecha) return null;

    const y = String(fecha.y);
    const m = String(fecha.m).padStart(2, "0");
    const d = String(fecha.d).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  if (typeof valor === "string") {
    const texto = valor.trim();

    if (texto.includes(" ")) {
      const [fecha] = texto.split(/\s+/);
      return normalizarFecha(fecha);
    }

    return normalizarFecha(texto);
  }

  return null;
}

function extraerFechaHora(valor) {
  if (!valor) return { fecha: null, hora: null };

  if (typeof valor === "number") {
    const fecha = XLSX.SSF.parse_date_code(valor);
    if (!fecha) return { fecha: null, hora: null };

    return {
      fecha: `${fecha.y}-${String(fecha.m).padStart(2, "0")}-${String(fecha.d).padStart(2, "0")}`,
      hora: `${String(fecha.H || 0).padStart(2, "0")}:${String(fecha.M || 0).padStart(2, "0")}:${String(
        fecha.S || 0
      ).padStart(2, "0")}`,
    };
  }

  const texto = String(valor).trim().replace(/\s+/g, " ");

  if (texto.includes(" ")) {
    const [fechaTexto, horaTexto] = texto.split(" ");
    return {
      fecha: normalizarFecha(fechaTexto),
      hora: normalizarHora(horaTexto),
    };
  }

  return {
    fecha: convertirFechaExcelAISO(texto),
    hora: null,
  };
}

function obtenerValor(fila, posiblesCampos) {
  for (const campo of posiblesCampos) {
    if (fila[campo] !== undefined && fila[campo] !== null && fila[campo] !== "") {
      return fila[campo];
    }
  }
  return null;
}

async function procesarArchivo(ruta) {
  try {
    if (!fs.existsSync(ruta)) return;

    const nombre = path.basename(ruta);

    if (nombre.startsWith("procesado_")) return;
    if (!extensionValida(nombre)) return;

    console.log("Procesando:", ruta);

    const workbook = XLSX.readFile(ruta, { raw: false });
    const hoja = workbook.Sheets[workbook.SheetNames[0]];
    const filas = XLSX.utils.sheet_to_json(hoja, { defval: "" });

    const registros = [];

    for (const fila of filas) {
      const tiempo = obtenerValor(fila, [
        "Tiempo",
        "Fecha y hora",
        "Fecha Hora",
        "Datetime",
        "Record Time",
      ]);

      const fechaDirecta = obtenerValor(fila, ["Fecha", "Date"]);
      const horaDirecta = obtenerValor(fila, ["Hora", "Time"]);

      let fecha = null;
      let hora = null;

      if (tiempo) {
        const extraido = extraerFechaHora(tiempo);
        fecha = extraido.fecha;
        hora = extraido.hora;
      } else {
        fecha = convertirFechaExcelAISO(fechaDirecta);
        hora = normalizarHora(horaDirecta);
      }

      if (!fecha || !hora) continue;

      const numeroEmpleado = obtenerValor(fila, [
        "ID de Usuario",
        "ID",
        "No.",
        "Número",
        "Numero",
        "User ID",
        "Enroll ID",
      ]);

      const nombreEmpleado = obtenerValor(fila, [
        "Nombre",
        "Name",
        "Empleado",
      ]);

      registros.push({
        numero_empleado: numeroEmpleado ? String(numeroEmpleado).trim() : "",
        nombre: nombreEmpleado
          ? String(nombreEmpleado).replace(/\./g, " ").replace(/\s+/g, " ").trim()
          : "",
        fecha,
        hora,
        tipo: clasificarTipo(hora),
        origen: "clk960",
      });
    }

    const registrosValidos = registros.filter(
      (r) => r.numero_empleado && r.fecha && r.hora
    );

    if (registrosValidos.length === 0) {
      console.log("Sin registros válidos en:", nombre);
      return;
    }

    const { error } = await supabase.from("checadas").insert(registrosValidos);

    if (error) {
      console.log("Error al insertar en Supabase:", error);
      return;
    }

    console.log("Registros insertados:", registrosValidos.length);

    const nuevaRuta = path.join(carpeta, "procesado_" + nombre);
    fs.renameSync(ruta, nuevaRuta);

    console.log("Archivo movido a:", nuevaRuta);
  } catch (error) {
    console.log("Error procesando archivo:", ruta);
    console.log(error);
  }
}

async function procesarArchivosExistentes() {
  try {
    const archivos = fs.readdirSync(carpeta);

    for (const archivo of archivos) {
      if (!extensionValida(archivo)) continue;
      if (archivo.startsWith("procesado_")) continue;

      const ruta = path.join(carpeta, archivo);
      await procesarArchivo(ruta);
    }
  } catch (error) {
    console.log("Error revisando archivos existentes:");
    console.log(error);
  }
}

function vigilarCarpeta() {
  fs.watch(carpeta, (eventType, filename) => {
    if (!filename) return;
    if (!extensionValida(filename)) return;
    if (filename.startsWith("procesado_")) return;

    const ruta = path.join(carpeta, filename);

    setTimeout(() => {
      procesarArchivo(ruta);
    }, 3000);
  });
}

async function iniciar() {
  console.log("Vigilando carpeta:", carpeta);

  await procesarArchivosExistentes();
  vigilarCarpeta();
}

iniciar();