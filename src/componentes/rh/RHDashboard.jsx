import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { supabase } from "../../supabase";

const TOLERANCIA_MINUTOS = 10;

const HORARIOS_EMPLEADOS = {
  "VIVIANA GALAVIZ": {
    lunes: null,
    martes: { entrada: "16:00", salida: "23:00" },
    miercoles: null,
    jueves: { entrada: "16:00", salida: "23:00" },
    viernes: null,
    sabado: null,
    domingo: { entrada: "16:00", salida: "23:00" },
  },

  SUSANA: {
    lunes: { entrada: "16:00", salida: "00:00" },
    martes: { entrada: "16:00", salida: "00:00" },
    miercoles: { entrada: "16:00", salida: "00:00" },
    jueves: { entrada: "16:00", salida: "00:00" },
    viernes: null,
    sabado: { entrada: "16:00", salida: "00:00" },
    domingo: { entrada: "16:00", salida: "00:00" },
  },

  ZAMARA: {
    lunes: { entrada: "07:30", salida: "15:30" },
    martes: { entrada: "07:30", salida: "15:30" },
    miercoles: null,
    jueves: { entrada: "07:30", salida: "15:30" },
    viernes: { entrada: "07:30", salida: "15:30" },
    sabado: { entrada: "07:30", salida: "15:30" },
    domingo: null,
  },

  "KAREN ANDRADE": {
    lunes: null,
    martes: { entrada: "08:00", salida: "16:00" },
    miercoles: { entrada: "07:30", salida: "15:30" },
    jueves: { entrada: "08:00", salida: "16:00" },
    viernes: null,
    sabado: { entrada: "08:00", salida: "16:00" },
    domingo: null,
  },

  MAYRA: {
    lunes: { entrada: "16:00", salida: "23:00" },
    martes: null,
    miercoles: { entrada: "16:00", salida: "23:00" },
    jueves: null,
    viernes: { entrada: "16:00", salida: "23:00" },
    sabado: { entrada: "16:00", salida: "23:00" },
    domingo: { entrada: "08:00", salida: "16:00" },
  },

  HEIDI: {
    lunes: { entrada: "08:00", salida: "16:00" },
    martes: null,
    miercoles: { entrada: "08:00", salida: "16:00" },
    jueves: null,
    viernes: { entrada: "16:00", salida: "23:00" },
    sabado: null,
    domingo: null,
  },

  PACO: {
    lunes: { entrada: "16:00", salida: "00:00" },
    martes: { entrada: "16:00", salida: "00:00" },
    miercoles: { entrada: "16:00", salida: "00:00" },
    jueves: { entrada: "16:00", salida: "00:00" },
    viernes: { entrada: "16:00", salida: "00:00" },
    sabado: { entrada: "16:00", salida: "00:00" },
    domingo: { entrada: "16:00", salida: "00:00" },
  },
};

function obtenerFechaLocal() {
  const hoy = new Date();
  const anio = hoy.getFullYear();
  const mes = String(hoy.getMonth() + 1).padStart(2, "0");
  const dia = String(hoy.getDate()).padStart(2, "0");
  return `${anio}-${mes}-${dia}`;
}

function obtenerInicioSemana(fechaTexto) {
  const [anio, mes, dia] = fechaTexto.split("-").map(Number);
  const fecha = new Date(anio, mes - 1, dia, 12, 0, 0);
  const diaSemana = fecha.getDay();
  const ajuste = diaSemana === 0 ? -6 : 1 - diaSemana;
  fecha.setDate(fecha.getDate() + ajuste);

  const nuevoAnio = fecha.getFullYear();
  const nuevoMes = String(fecha.getMonth() + 1).padStart(2, "0");
  const nuevoDia = String(fecha.getDate()).padStart(2, "0");

  return `${nuevoAnio}-${nuevoMes}-${nuevoDia}`;
}

function obtenerInicioMes(fechaTexto) {
  return `${fechaTexto.slice(0, 7)}-01`;
}

function obtenerFinMes(fechaTexto) {
  const [anio, mes] = fechaTexto.split("-").map(Number);
  const ultimoDia = new Date(anio, mes, 0).getDate();
  return `${anio}-${String(mes).padStart(2, "0")}-${String(ultimoDia).padStart(2, "0")}`;
}

function limpiarNombre(nombre) {
  return String(nombre || "")
    .replace(/\./g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function normalizarNombreVisible(nombre) {
  return String(nombre || "")
    .replace(/\./g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function obtenerNombreDia(fechaTexto) {
  const [anio, mes, dia] = fechaTexto.split("-").map(Number);
  const fecha = new Date(anio, mes - 1, dia, 12, 0, 0);
  const dias = [
    "domingo",
    "lunes",
    "martes",
    "miercoles",
    "jueves",
    "viernes",
    "sabado",
  ];
  return dias[fecha.getDay()];
}

function convertirHoraASegundos(hora) {
  if (!hora) return 0;
  const [h = 0, m = 0, s = 0] = String(hora).split(":").map(Number);
  return h * 3600 + m * 60 + s;
}

function horaTextoASegundos(horaTexto) {
  if (!horaTexto) return 0;
  const [h = 0, m = 0, s = 0] = String(horaTexto).split(":").map(Number);
  return h * 3600 + m * 60 + s;
}

function segundosAHoras(segundos) {
  return segundos > 0 ? segundos / 3600 : 0;
}

function formatearHorasDecimal(horas) {
  if (!Number.isFinite(horas)) return "0.00";
  return horas.toFixed(2);
}

function obtenerTextoFiltro(filtro) {
  if (filtro === "hoy") return "de hoy";
  if (filtro === "semana") return "de la semana";
  if (filtro === "mes") return "del mes";
  return "totales";
}

function obtenerHorarioEmpleado(nombre, fechaTexto) {
  const nombreLimpio = limpiarNombre(nombre);
  const dia = obtenerNombreDia(fechaTexto);
  return HORARIOS_EMPLEADOS[nombreLimpio]?.[dia] || null;
}

function calcularHorasTrabajadas(entradaHora, salidaHora) {
  const entrada = convertirHoraASegundos(entradaHora);
  let salida = convertirHoraASegundos(salidaHora);

  if (salida === 0) {
    salida = 24 * 3600;
  }

  if (salida < entrada) {
    salida += 24 * 3600;
  }

  return salida - entrada;
}

function formatearHora(hora) {
  if (!hora) return "-";
  return String(hora).slice(0, 5);
}

function formatearFecha(fechaTexto) {
  if (!fechaTexto) return "-";
  const [anio, mes, dia] = fechaTexto.split("-");
  return `${dia}/${mes}/${anio}`;
}

function generarInterpretaciones(detalle) {
  if (!detalle.length) return [];

  const ordenScore = [...detalle].sort((a, b) => b.scorePromedio - a.scorePromedio);
  const ordenRetardos = [...detalle].sort((a, b) => b.retardos - a.retardos);
  const ordenFaltas = [...detalle].sort((a, b) => b.faltas - a.faltas);
  const ordenHoras = [...detalle].sort((a, b) => b.horasPromedio - a.horasPromedio);

  const mejor = ordenScore[0];
  const masRetardos = ordenRetardos[0];
  const masFaltas = ordenFaltas[0];
  const masHoras = ordenHoras[0];

  const mensajes = [];

  if (mejor) {
    mensajes.push(
      `${mejor.nombre} es quien muestra mejor cumplimiento general, con score promedio de ${mejor.scorePromedio.toFixed(
        1
      )}, ${mejor.asistencias} asistencias y ${mejor.retardos} retardos.`
    );
  }

  if (masRetardos && masRetardos.retardos > 0) {
    mensajes.push(
      `${masRetardos.nombre} es quien concentra más retardos (${masRetardos.retardos}). Esto puede indicar un problema de puntualidad, transporte o un horario que no se está ajustando bien a su rutina.`
    );
  }

  if (masFaltas && masFaltas.faltas > 0) {
    mensajes.push(
      `${masFaltas.nombre} presenta más faltas (${masFaltas.faltas}). Conviene revisar si hubo descansos mal capturados, ausencias reales o falta de checada de entrada.`
    );
  }

  if (masHoras && masHoras.horasPromedio > 0) {
    mensajes.push(
      `${masHoras.nombre} es quien registra más horas promedio (${masHoras.horasPromedio.toFixed(
        2
      )} h). Esto puede reflejar mayor carga de trabajo o salidas después del horario programado.`
    );
  }

  return mensajes;
}

function recortarNombre(nombre, max) {
  if (!nombre) return "";
  return nombre.length > max ? `${nombre.slice(0, max)}...` : nombre;
}

function sumarDias(fechaTexto, dias) {
  const [anio, mes, dia] = fechaTexto.split("-").map(Number);
  const fecha = new Date(anio, mes - 1, dia, 12, 0, 0);
  fecha.setDate(fecha.getDate() + dias);

  const nuevoAnio = fecha.getFullYear();
  const nuevoMes = String(fecha.getMonth() + 1).padStart(2, "0");
  const nuevoDia = String(fecha.getDate()).padStart(2, "0");

  return `${nuevoAnio}-${nuevoMes}-${nuevoDia}`;
}

function normalizarFechaTexto(valor) {
  if (!valor) return null;

  let texto = String(valor).trim();
  if (!texto) return null;

  texto = texto.split(" ")[0].trim();
  texto = texto.replace(/\./g, "-").replace(/\//g, "-");

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
    mes = String(Number(partes[0])).padStart(2, "0");
    dia = String(Number(partes[1])).padStart(2, "0");
    anio = partes[2];
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

function excelSerialAFechaHora(serial) {
  if (serial === null || serial === undefined || serial === "") {
    return { fecha: null, hora: null };
  }

  const numero = Number(serial);
  if (!Number.isFinite(numero)) {
    return { fecha: null, hora: null };
  }

  const base = new Date(Date.UTC(1899, 11, 30));
  const fechaExcel = new Date(base.getTime() + numero * 24 * 60 * 60 * 1000);

  const anio = fechaExcel.getUTCFullYear();
  const mes = String(fechaExcel.getUTCMonth() + 1).padStart(2, "0");
  const dia = String(fechaExcel.getUTCDate()).padStart(2, "0");

  const horas = String(fechaExcel.getUTCHours()).padStart(2, "0");
  const minutos = String(fechaExcel.getUTCMinutes()).padStart(2, "0");
  const segundos = String(fechaExcel.getUTCSeconds()).padStart(2, "0");

  return {
    fecha: `${anio}-${mes}-${dia}`,
    hora: `${horas}:${minutos}:${segundos}`,
  };
}

function obtenerValor(fila, campos) {
  for (const campo of campos) {
    const valor = fila[campo];
    if (valor !== undefined && valor !== null && String(valor).trim() !== "") {
      return valor;
    }
  }
  return null;
}

function clasificarTipo(hora) {
  const seg = convertirHoraASegundos(hora);

  if (seg < 5 * 3600) return "salida";
  if (seg >= 12 * 3600) return "entrada";
  return "entrada";
}

function extraerFechaHoraDesdeFila(fila) {
  const valorFechaHora = obtenerValor(fila, [
    "Tiempo",
    "Fecha y hora",
    "Fecha Hora",
    "Datetime",
    "Record Time",
    "FechaHora",
  ]);

  if (typeof valorFechaHora === "number") {
    return excelSerialAFechaHora(valorFechaHora);
  }

  if (valorFechaHora) {
    const texto = String(valorFechaHora).trim().replace(/\s+/g, " ");
    const partes = texto.split(" ");

    if (partes.length >= 2) {
      let fecha = normalizarFechaTexto(partes[0]);
      let hora = partes[1];

      if (hora && hora.length === 5) {
        hora = `${hora}:00`;
      }

      return { fecha, hora };
    }
  }

  const valorFecha = obtenerValor(fila, ["Fecha", "Date"]);
  const valorHora = obtenerValor(fila, ["Hora", "Time"]);

  let fecha = null;
  let hora = null;

  if (typeof valorFecha === "number") {
    const convertida = excelSerialAFechaHora(valorFecha);
    fecha = convertida.fecha;
  } else if (valorFecha) {
    fecha = normalizarFechaTexto(valorFecha);
  }

  if (typeof valorHora === "number") {
    const convertida = excelSerialAFechaHora(valorHora);
    hora = convertida.hora;
  } else if (valorHora) {
    hora = String(valorHora).trim();
    if (hora.length === 5) hora = `${hora}:00`;
  }

  return { fecha, hora };
}

function construirRegistrosDesdeFilas(filas) {
  const registros = [];

  for (const fila of filas) {
    const { fecha, hora } = extraerFechaHoraDesdeFila(fila);

    if (!fecha || !hora) continue;

    const numeroEmpleado = obtenerValor(fila, [
      "ID de Usuario",
      "ID",
      "No.",
      "Número",
      "Numero",
      "User ID",
      "Enroll ID",
      "ID Usuario",
    ]);

    const nombre = obtenerValor(fila, ["Nombre", "Name", "Empleado"]) || "";

    registros.push({
      numero_empleado: numeroEmpleado ? String(numeroEmpleado).trim() : "",
      nombre: normalizarNombreVisible(nombre),
      fecha,
      hora,
      tipo: clasificarTipo(hora),
      origen: "importacion_excel",
    });
  }

  return registros.filter(
    (r) =>
      r.numero_empleado &&
      r.hora &&
      /^\d{4}-\d{2}-\d{2}$/.test(r.fecha || "") &&
      Number(r.fecha.slice(5, 7)) >= 1 &&
      Number(r.fecha.slice(5, 7)) <= 12 &&
      Number(r.fecha.slice(8, 10)) >= 1 &&
      Number(r.fecha.slice(8, 10)) <= 31
  );
}

function calcularMejorEmpleadoMesNatural(detalle) {
  if (!detalle.length) return null;

  const ranking = [...detalle].map((emp) => {
    const diasProgramados = emp.asistencias + emp.faltas;
    const porcentajeAsistencia =
      diasProgramados > 0 ? (emp.asistencias / diasProgramados) * 100 : 0;

    const scoreFinal = emp.scorePromedio * 0.7 + porcentajeAsistencia * 0.3;

    return {
      ...emp,
      porcentajeAsistencia,
      scoreFinal,
    };
  });

  ranking.sort((a, b) => {
    if (b.scoreFinal !== a.scoreFinal) return b.scoreFinal - a.scoreFinal;
    if (b.scorePromedio !== a.scorePromedio) return b.scorePromedio - a.scorePromedio;
    if (b.porcentajeAsistencia !== a.porcentajeAsistencia) {
      return b.porcentajeAsistencia - a.porcentajeAsistencia;
    }
    return a.retardos - b.retardos;
  });

  return ranking[0];
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

export default function RHDashboard() {
  const navigate = useNavigate();

  const [filtro, setFiltro] = useState("hoy");
  const [checadas, setChecadas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [ultimaActualizacion, setUltimaActualizacion] = useState("");

  const [mostrarImportador, setMostrarImportador] = useState(false);
  const [dragActivo, setDragActivo] = useState(false);
  const [importando, setImportando] = useState(false);
  const [mensajeImportacion, setMensajeImportacion] = useState("");

  const inputArchivoRef = useRef(null);

  const hoy = obtenerFechaLocal();

  const cargarChecadas = async () => {
    try {
      setCargando(true);
      setError("");

      let desde = null;
      let hasta = null;

      if (filtro === "hoy") {
        desde = hoy;
        hasta = hoy;
      } else if (filtro === "semana") {
        desde = obtenerInicioSemana(hoy);
        hasta = hoy;
      } else if (filtro === "mes") {
        desde = obtenerInicioMes(hoy);
        hasta = hoy;
      }

      let query = supabase
        .from("checadas")
        .select("*")
        .order("numero_empleado", { ascending: true })
        .order("fecha", { ascending: true })
        .order("hora", { ascending: true });

      if (desde && hasta) {
        query = query.gte("fecha", desde).lte("fecha", hasta);
      }

      const { data, error: errorSupabase } = await query;

      if (errorSupabase) throw errorSupabase;

      setChecadas(data || []);
      setUltimaActualizacion(new Date().toLocaleString());
    } catch (err) {
      console.error(err);
      setError(err.message || "No se pudieron cargar las checadas.");
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarChecadas();
  }, [filtro]);

  const resumen = useMemo(() => {
    const empleadosMap = {};
    const checadasPorEmpleado = {};

    for (const checada of checadas) {
      const numero = String(checada.numero_empleado || "").trim();
      const fecha = checada.fecha;

      if (!numero || !fecha) continue;

      if (!empleadosMap[numero]) {
        empleadosMap[numero] = {
          numero,
          nombre: normalizarNombreVisible(checada.nombre || `Empleado ${numero}`),
          puesto: "-",
          area: "-",
        };
      }

      if (!checadasPorEmpleado[numero]) {
        checadasPorEmpleado[numero] = [];
      }

      checadasPorEmpleado[numero].push(checada);
    }

    const empleados = Object.values(empleadosMap).sort((a, b) =>
      a.numero.localeCompare(b.numero, undefined, { numeric: true })
    );

    const detalle = empleados.map((empleado) => {
      const numero = empleado.numero;
      const registros = (checadasPorEmpleado[numero] || []).sort((a, b) => {
        if (a.fecha !== b.fecha) return a.fecha.localeCompare(b.fecha);
        return a.hora.localeCompare(b.hora);
      });

      const analisisPorFecha = {};
      const registrosDetallados = [];
      const usadasComoSalida = new Set();

      let asistencias = 0;
      let retardos = 0;
      let faltas = 0;
      let horasAcumuladas = 0;
      let horasExtra = 0;
      let scoreAcumulado = 0;
      let diasConScore = 0;
      let ultimoEstado = "Sin registros";

      const fechasConHorario = new Set();

      registros.forEach((r) => {
        const horario = obtenerHorarioEmpleado(empleado.nombre, r.fecha);
        if (horario) {
          fechasConHorario.add(r.fecha);
        }
      });

      const fechasBase = [...fechasConHorario].sort();

      const fechasARevisar =
        filtro === "hoy"
          ? [hoy]
          : [...new Set([...fechasBase, ...registros.map((r) => r.fecha)])].sort();

      fechasARevisar.forEach((fecha) => {
        const horario = obtenerHorarioEmpleado(empleado.nombre, fecha);

        if (!horario) return;

        const entradaProgramada = `${horario.entrada}:00`;
        const salidaProgramada = `${horario.salida}:00`;

        const registrosMismoDia = registros.filter((r) => r.fecha === fecha);
        const entradasMismoDia = registrosMismoDia
          .filter((r) => String(r.tipo).toLowerCase() === "entrada")
          .sort((a, b) => convertirHoraASegundos(a.hora) - convertirHoraASegundos(b.hora));

        const primeraEntrada = entradasMismoDia[0] || null;

        diasConScore += 1;

        if (!primeraEntrada) {
          faltas += 1;
          ultimoEstado = "Falta";

          analisisPorFecha[fecha] = {
            fecha,
            entrada: null,
            salida: null,
            horas: 0,
            horasExtra: 0,
            estado: "Falta",
            observacion: "No se registró entrada en un día laborable.",
          };
          return;
        }

        asistencias += 1;

        const entradaRealSeg = convertirHoraASegundos(primeraEntrada.hora);
        const entradaProgSeg = horaTextoASegundos(entradaProgramada);
        const toleranciaSeg = TOLERANCIA_MINUTOS * 60;
        const esRetardo = entradaRealSeg > entradaProgSeg + toleranciaSeg;

        if (esRetardo) {
          retardos += 1;
          scoreAcumulado += 8;
          ultimoEstado = "Retardo";
        } else {
          scoreAcumulado += 10;
          ultimoEstado = "Presente";
        }

        let salidaEncontrada = null;

        if (horario.salida === "00:00") {
          const siguienteFecha = sumarDias(fecha, 1);
          const candidatas = registros
            .filter((r) => {
              if (String(r.tipo).toLowerCase() !== "salida") return false;

              const clave = `${r.fecha}_${r.hora}_${numero}`;
              if (usadasComoSalida.has(clave)) return false;

              if (r.fecha === siguienteFecha && convertirHoraASegundos(r.hora) <= 4 * 3600) {
                return true;
              }

              if (r.fecha === fecha && convertirHoraASegundos(r.hora) >= 20 * 3600) {
                return true;
              }

              return false;
            })
            .sort((a, b) => {
              if (a.fecha !== b.fecha) return a.fecha.localeCompare(b.fecha);
              return a.hora.localeCompare(b.hora);
            });

          salidaEncontrada = candidatas[0] || null;
        } else {
          const candidatas = registrosMismoDia
            .filter((r) => String(r.tipo).toLowerCase() === "salida")
            .sort((a, b) => convertirHoraASegundos(a.hora) - convertirHoraASegundos(b.hora));

          salidaEncontrada = candidatas[candidatas.length - 1] || null;
        }

        if (!salidaEncontrada) {
          ultimoEstado = "Incompleto";

          analisisPorFecha[fecha] = {
            fecha,
            entrada: primeraEntrada.hora,
            salida: null,
            horas: 0,
            horasExtra: 0,
            estado: "Incompleto",
            observacion: "Se registró entrada pero no salida.",
          };
          return;
        }

        usadasComoSalida.add(`${salidaEncontrada.fecha}_${salidaEncontrada.hora}_${numero}`);

        const segundosTrabajados = calcularHorasTrabajadas(
          primeraEntrada.hora,
          salidaEncontrada.hora
        );

        const salidaProgSeg = horaTextoASegundos(salidaProgramada);
        let salidaProgramadaAjustada = salidaProgSeg === 0 ? 24 * 3600 : salidaProgSeg;

        let salidaRealSeg = convertirHoraASegundos(salidaEncontrada.hora);
        if (salidaRealSeg === 0) salidaRealSeg = 24 * 3600;
        if (salidaRealSeg < entradaRealSeg) salidaRealSeg += 24 * 3600;
        if (salidaProgramadaAjustada < entradaProgSeg) salidaProgramadaAjustada += 24 * 3600;

        const extraSeg = Math.max(0, salidaRealSeg - salidaProgramadaAjustada);

        horasAcumuladas += segundosTrabajados;
        horasExtra += extraSeg;

        const estadoFinal = esRetardo ? "Retardo" : "Completo";
        ultimoEstado = estadoFinal;

        analisisPorFecha[fecha] = {
          fecha,
          entrada: primeraEntrada.hora,
          salida: salidaEncontrada.hora,
          horas: segundosAHoras(segundosTrabajados),
          horasExtra: segundosAHoras(extraSeg),
          estado: estadoFinal,
          observacion: esRetardo
            ? "La entrada se registró después de la tolerancia permitida."
            : "Cumplió con el horario programado.",
        };
      });

      Object.values(analisisPorFecha)
        .sort((a, b) => a.fecha.localeCompare(b.fecha))
        .forEach((item) => {
          registrosDetallados.push(item);
        });

      const horasPromedio =
        asistencias > 0 ? segundosAHoras(horasAcumuladas) / asistencias : 0;

      const horasExtraPromedio =
        asistencias > 0 ? segundosAHoras(horasExtra) / asistencias : 0;

      const scorePromedio = diasConScore > 0 ? scoreAcumulado / diasConScore : 0;

      return {
        ...empleado,
        asistencias,
        retardos,
        faltas,
        horasPromedio,
        horasExtraPromedio,
        scorePromedio,
        ultimoEstado,
        registrosDetallados,
      };
    });

    const empleadosTotales = detalle.length;
    const presentes = detalle.filter(
      (e) =>
        e.ultimoEstado === "Presente" ||
        e.ultimoEstado === "Completo" ||
        e.ultimoEstado === "Retardo"
    ).length;

    const retardosTotales = detalle.reduce((acc, emp) => acc + emp.retardos, 0);
    const faltasTotales = detalle.reduce((acc, emp) => acc + emp.faltas, 0);

    const scoreGeneral =
      detalle.length > 0
        ? detalle.reduce((acc, emp) => acc + emp.scorePromedio, 0) / detalle.length
        : 0;

    const rankingPuntualidad = [...detalle]
      .sort((a, b) => b.scorePromedio - a.scorePromedio)
      .map((item, index) => ({
        posicion: index + 1,
        ...item,
      }));

    const graficaAsistencias = detalle.map((emp) => ({
      nombre: recortarNombre(emp.nombre, 12),
      asistencias: emp.asistencias,
    }));

    const graficaRetardos = detalle.map((emp) => ({
      nombre: recortarNombre(emp.nombre, 12),
      retardos: emp.retardos,
    }));

    const graficaHoras = detalle.map((emp) => ({
      nombre: recortarNombre(emp.nombre, 12),
      horas: Number(emp.horasPromedio.toFixed(2)),
    }));

    const interpretaciones = generarInterpretaciones(detalle);

    return {
      detalle,
      tarjetas: {
        empleados: empleadosTotales,
        presentes,
        retardos: retardosTotales,
        faltas: faltasTotales,
        scoreGeneral,
      },
      rankingPuntualidad,
      graficaAsistencias,
      graficaRetardos,
      graficaHoras,
      interpretaciones,
    };
  }, [checadas, filtro, hoy]);

  const mejorEmpleadoMes = useMemo(() => {
    return calcularMejorEmpleadoMesNatural(resumen.detalle);
  }, [resumen.detalle]);

  const importarArchivo = async (archivo) => {
    if (!archivo) return;

    try {
      setImportando(true);
      setMensajeImportacion("");

      const extension = archivo.name.split(".").pop()?.toLowerCase();
      if (!["xlsx", "xls", "csv"].includes(extension || "")) {
        throw new Error("Solo se permiten archivos .xlsx, .xls o .csv");
      }

      const buffer = await archivo.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array", raw: false });
      const nombreHoja = workbook.SheetNames[0];

      if (!nombreHoja) {
        throw new Error("El archivo no contiene hojas.");
      }

      const hoja = workbook.Sheets[nombreHoja];
      const filas = XLSX.utils.sheet_to_json(hoja, { defval: "" });

      if (!filas.length) {
        throw new Error("El archivo está vacío o no contiene filas válidas.");
      }

      const registros = construirRegistrosDesdeFilas(filas);

      if (!registros.length) {
        throw new Error(
          "No se detectaron registros válidos. Revisa que el archivo tenga columnas como Tiempo, Fecha y hora, Fecha, Hora, ID de Usuario o Nombre."
        );
      }

      const fechas = registros.map((r) => r.fecha).filter(Boolean).sort();
      const desde = fechas[0];
      const hasta = fechas[fechas.length - 1];

      let existentes = [];
      if (desde && hasta) {
        const { data: dataExistente, error: errorExistente } = await supabase
          .from("checadas")
          .select("numero_empleado, fecha, hora, tipo")
          .gte("fecha", desde)
          .lte("fecha", hasta);

        if (errorExistente) throw errorExistente;
        existentes = dataExistente || [];
      }

      const clavesExistentes = new Set(
        existentes.map(
          (r) =>
            `${String(r.numero_empleado || "").trim()}|${r.fecha}|${r.hora}|${String(
              r.tipo || ""
            ).toLowerCase()}`
        )
      );

      const nuevos = registros.filter((r) => {
        const clave = `${String(r.numero_empleado || "").trim()}|${r.fecha}|${r.hora}|${String(
          r.tipo || ""
        ).toLowerCase()}`;
        return !clavesExistentes.has(clave);
      });

      if (!nuevos.length) {
        setMensajeImportacion("Ese archivo no trajo registros nuevos.");
        await cargarChecadas();
        return;
      }

      const { error: errorInsert } = await supabase.from("checadas").insert(nuevos);

      if (errorInsert) throw errorInsert;

      setMensajeImportacion(
        `Importación completada. Se agregaron ${nuevos.length} registros nuevos.`
      );

      await cargarChecadas();
    } catch (err) {
      console.error(err);
      setMensajeImportacion(err.message || "No se pudo importar el archivo.");
    } finally {
      setImportando(false);
    }
  };

  const manejarSeleccionArchivo = async (e) => {
    const archivo = e.target.files?.[0];
    if (archivo) {
      await importarArchivo(archivo);
    }
    e.target.value = "";
  };

  const manejarDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActivo(false);

    const archivo = e.dataTransfer.files?.[0];
    if (archivo) {
      await importarArchivo(archivo);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top, #0f274f 0%, #08152d 45%, #050d1f 100%)",
        padding: "18px 14px 40px",
        color: "#ffffff",
      }}
    >
      <div style={{ maxWidth: "1500px", margin: "0 auto" }}>
        <div
          style={{
            background: "rgba(9, 20, 43, 0.92)",
            border: "1px solid rgba(148, 163, 184, 0.18)",
            borderRadius: "32px",
            padding: "16px",
            marginBottom: "24px",
            boxShadow: "0 25px 60px rgba(0,0,0,0.35)",
          }}
        >
          <div
            style={{
              background:
                "linear-gradient(180deg, rgba(21,33,63,0.98) 0%, rgba(17,27,53,0.98) 100%)",
              border: "1px solid rgba(148,163,184,0.16)",
              borderRadius: "30px",
              padding: "28px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: "16px",
                flexWrap: "wrap",
              }}
            >
              <div
                style={{
                  display: "flex",
                  gap: "16px",
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <div
                  style={{
                    width: 78,
                    height: 78,
                    borderRadius: 22,
                    background: "linear-gradient(135deg, #6d54d6 0%, #5740c2 100%)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "2rem",
                    color: "#fff",
                    fontWeight: 900,
                    boxShadow: "0 14px 28px rgba(87,64,194,0.25)",
                  }}
                >
                  👥
                </div>

                <div>
                  <div
                    style={{
                      fontSize: "13px",
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: "rgba(226,232,240,0.72)",
                      fontWeight: 800,
                      marginBottom: 8,
                    }}
                  >
                    Dashboard de Recursos Humanos
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
                    Asistencias, retardos, faltas y rendimiento del equipo
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  flexWrap: "wrap",
                }}
              >
                <button
                  onClick={() => navigate("/")}
                  style={botonHeaderBase}
                >
                  ← Inicio
                </button>

                <button
                  onClick={() => {
                    setMostrarImportador(true);
                    setMensajeImportacion("");
                  }}
                  style={{
                    ...botonHeaderBase,
                    background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
                    border: "1px solid rgba(96,165,250,0.35)",
                  }}
                >
                  Importar Excel
                </button>
              </div>
            </div>

            <div
              style={{
                marginTop: 16,
                display: "flex",
                gap: 14,
                flexWrap: "wrap",
                color: "rgba(226,232,240,0.72)",
                fontSize: "14px",
              }}
            >
              <span>Última actualización: {ultimaActualizacion || "Sin datos todavía"}</span>
              <span>•</span>
              <span>Sincronización automática activa</span>
              <span>•</span>
              <span>Filtro: {filtro.toUpperCase()}</span>
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: "14px",
            flexWrap: "wrap",
            marginBottom: "26px",
          }}
        >
          {[
            { key: "hoy", label: "Hoy" },
            { key: "semana", label: "Semana" },
            { key: "mes", label: "Mes" },
            { key: "todo", label: "Todo" },
          ].map((boton) => (
            <button
              key={boton.key}
              onClick={() => setFiltro(boton.key)}
              style={{
                border: filtro === boton.key
                  ? "1px solid rgba(96,165,250,0.35)"
                  : "1px solid rgba(148,163,184,0.12)",
                padding: "14px 22px",
                borderRadius: "16px",
                fontSize: "16px",
                fontWeight: "800",
                cursor: "pointer",
                background:
                  filtro === boton.key
                    ? "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)"
                    : "rgba(255,255,255,0.08)",
                color: "#ffffff",
                boxShadow:
                  filtro === boton.key
                    ? "0 8px 20px rgba(37,99,235,0.35)"
                    : "none",
              }}
            >
              {boton.label}
            </button>
          ))}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "20px",
            marginBottom: "34px",
          }}
        >
          <TarjetaResumenOscura titulo="Empleados" valor={resumen.tarjetas.empleados} />
          <TarjetaResumenOscura titulo="Presentes" valor={resumen.tarjetas.presentes} />
          <TarjetaResumenOscura titulo="Retardos" valor={resumen.tarjetas.retardos} />
          <TarjetaResumenOscura titulo="Faltas" valor={resumen.tarjetas.faltas} />
          <TarjetaResumenOscura
            titulo="Score prom."
            valor={resumen.tarjetas.scoreGeneral.toFixed(1)}
          />
        </div>

        <PanelOscuro>
          <EncabezadoSeccionOscuro
            titulo={`Asistencia ${obtenerTextoFiltro(filtro)}`}
            subtitulo={
              ultimaActualizacion ? `Última actualización: ${ultimaActualizacion}` : ""
            }
          />

          {cargando ? (
            <p style={{ fontWeight: "700", color: "rgba(226,232,240,0.82)" }}>
              Cargando checadas...
            </p>
          ) : error ? (
            <p style={{ color: "#f87171", fontWeight: "700" }}>{error}</p>
          ) : resumen.detalle.length === 0 ? (
            <p style={{ fontWeight: "700", color: "rgba(226,232,240,0.82)" }}>
              No hay registros para mostrar.
            </p>
          ) : (
            <TablaResumenOscura detalle={resumen.detalle} />
          )}
        </PanelOscuro>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
            gap: "22px",
            marginTop: "24px",
          }}
        >
          <PanelOscuro>
            <h3 style={tituloPanelOscuro}>Ranking de puntualidad</h3>
            {resumen.rankingPuntualidad.map((emp) => (
              <div
                key={emp.numero}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "12px 0",
                  borderBottom: "1px solid rgba(148,163,184,0.12)",
                  gap: "12px",
                  color: "#ffffff",
                }}
              >
                <div style={{ fontWeight: 800, minWidth: "36px" }}>#{emp.posicion}</div>
                <div style={{ flex: 1, fontWeight: 700 }}>{emp.nombre}</div>
                <div style={{ fontWeight: 800, color: "#93c5fd" }}>
                  {emp.scorePromedio.toFixed(1)}
                </div>
              </div>
            ))}
          </PanelOscuro>

          <PanelOscuro>
            <h3 style={tituloPanelOscuro}>Interpretación automática</h3>
            <div style={{ display: "grid", gap: "12px" }}>
              {resumen.interpretaciones.map((texto, index) => (
                <div
                  key={index}
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    borderRadius: "14px",
                    padding: "14px",
                    lineHeight: 1.5,
                    color: "rgba(241,245,249,0.95)",
                    border: "1px solid rgba(148,163,184,0.12)",
                  }}
                >
                  {texto}
                </div>
              ))}
            </div>
          </PanelOscuro>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
            gap: "22px",
            marginTop: "24px",
          }}
        >
          <PanelOscuro>
            <h3 style={tituloPanelOscuro}>Gráfica de asistencias</h3>
            <ChartWrap>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={resumen.graficaAsistencias}>
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
                    contentStyle={chartTooltipStyle}
                    labelStyle={{ color: "#ffffff", fontWeight: 700 }}
                    itemStyle={{ color: "#ffffff" }}
                  />
                  <Bar dataKey="asistencias" fill="#2563eb" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartWrap>
          </PanelOscuro>

          <PanelOscuro>
            <h3 style={tituloPanelOscuro}>Gráfica de retardos</h3>
            <ChartWrap>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={resumen.graficaRetardos}>
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
                    contentStyle={chartTooltipStyle}
                    labelStyle={{ color: "#ffffff", fontWeight: 700 }}
                    itemStyle={{ color: "#ffffff" }}
                  />
                  <Bar dataKey="retardos" fill="#f59e0b" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartWrap>
          </PanelOscuro>

          <PanelOscuro>
            <h3 style={tituloPanelOscuro}>Gráfica de horas promedio</h3>
            <ChartWrap>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={resumen.graficaHoras}>
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
                    contentStyle={chartTooltipStyle}
                    labelStyle={{ color: "#ffffff", fontWeight: 700 }}
                    itemStyle={{ color: "#ffffff" }}
                  />
                  <Bar dataKey="horas" fill="#22c55e" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartWrap>
          </PanelOscuro>

          <PanelOscuro>
            <h3 style={tituloPanelOscuro}>Mejor empleada del mes natural</h3>

            {mejorEmpleadoMes ? (
              <div style={{ display: "grid", gap: "14px" }}>
                <div
                  style={{
                    background: "rgba(37,99,235,0.16)",
                    border: "1px solid rgba(96,165,250,0.22)",
                    borderRadius: "18px",
                    padding: "18px",
                  }}
                >
                  <div
                    style={{
                      fontSize: "14px",
                      color: "#93c5fd",
                      fontWeight: "800",
                      marginBottom: "6px",
                    }}
                  >
                    Periodo evaluado
                  </div>
                  <div style={{ fontSize: "18px", fontWeight: "800", color: "#ffffff" }}>
                    {formatearFecha(obtenerInicioMes(hoy))} al {formatearFecha(obtenerFinMes(hoy))}
                  </div>
                </div>

                <div
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    borderRadius: "18px",
                    padding: "20px",
                    border: "1px solid rgba(148,163,184,0.12)",
                  }}
                >
                  <div
                    style={{
                      fontSize: "30px",
                      fontWeight: "900",
                      marginBottom: "8px",
                      color: "#ffffff",
                    }}
                  >
                    {mejorEmpleadoMes.nombre}
                  </div>

                  <div
                    style={{
                      color: "rgba(226,232,240,0.72)",
                      fontSize: "14px",
                      fontWeight: "700",
                      marginBottom: "16px",
                    }}
                  >
                    Mejor combinación de puntualidad y asistencia del mes natural actual.
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(2, minmax(130px, 1fr))",
                      gap: "12px",
                    }}
                  >
                    <div style={miniDatoStyleOscuro}>
                      <div style={miniLabelStyleOscuro}>Asistencias</div>
                      <div style={miniValorStyleOscuro}>{mejorEmpleadoMes.asistencias}</div>
                    </div>

                    <div style={miniDatoStyleOscuro}>
                      <div style={miniLabelStyleOscuro}>Retardos</div>
                      <div style={miniValorStyleOscuro}>{mejorEmpleadoMes.retardos}</div>
                    </div>

                    <div style={miniDatoStyleOscuro}>
                      <div style={miniLabelStyleOscuro}>Faltas</div>
                      <div style={miniValorStyleOscuro}>{mejorEmpleadoMes.faltas}</div>
                    </div>

                    <div style={miniDatoStyleOscuro}>
                      <div style={miniLabelStyleOscuro}>Score prom.</div>
                      <div style={miniValorStyleOscuro}>
                        {mejorEmpleadoMes.scorePromedio.toFixed(1)}
                      </div>
                    </div>

                    <div style={miniDatoStyleOscuro}>
                      <div style={miniLabelStyleOscuro}>Asistencia</div>
                      <div style={miniValorStyleOscuro}>
                        {mejorEmpleadoMes.porcentajeAsistencia.toFixed(1)}%
                      </div>
                    </div>

                    <div style={miniDatoStyleOscuro}>
                      <div style={miniLabelStyleOscuro}>Score final</div>
                      <div style={miniValorStyleOscuro}>
                        {mejorEmpleadoMes.scoreFinal.toFixed(1)}
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      marginTop: "16px",
                      padding: "14px",
                      borderRadius: "14px",
                      background: "rgba(34,197,94,0.12)",
                      border: "1px solid rgba(34,197,94,0.22)",
                      color: "#86efac",
                      fontWeight: "700",
                      lineHeight: 1.5,
                    }}
                  >
                    Esta tarjeta se actualiza sola cada mes y toma en cuenta del día 1 al
                    último día del mes natural actual.
                  </div>
                </div>
              </div>
            ) : (
              <div
                style={{
                  background: "rgba(255,255,255,0.04)",
                  borderRadius: "18px",
                  padding: "18px",
                  border: "1px solid rgba(148,163,184,0.12)",
                  fontWeight: "700",
                  color: "rgba(226,232,240,0.82)",
                }}
              >
                No hay suficientes datos para calcular la mejor empleada del mes.
              </div>
            )}
          </PanelOscuro>
        </div>

        <PanelOscuro style={{ marginTop: "24px" }}>
          <h3 style={tituloPanelOscuro}>Detalle de checadas por empleada</h3>
          <div style={{ display: "grid", gap: "24px" }}>
            {resumen.detalle.map((empleado) => (
              <div key={empleado.numero}>
                <div
                  style={{
                    fontSize: "20px",
                    fontWeight: "800",
                    marginBottom: "12px",
                    color: "#ffffff",
                  }}
                >
                  {empleado.nombre}
                </div>

                {empleado.registrosDetallados.length === 0 ? (
                  <div
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      padding: "14px",
                      borderRadius: "14px",
                      border: "1px solid rgba(148,163,184,0.12)",
                      color: "rgba(226,232,240,0.82)",
                    }}
                  >
                    No hay registros analizados para este periodo.
                  </div>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table
                      style={{
                        width: "100%",
                        minWidth: "900px",
                        borderCollapse: "collapse",
                      }}
                    >
                      <thead>
                        <tr style={{ borderBottom: "1px solid rgba(148,163,184,0.18)" }}>
                          <th style={thStyleOscuro}>Fecha</th>
                          <th style={thStyleOscuro}>Entrada</th>
                          <th style={thStyleOscuro}>Salida</th>
                          <th style={thStyleOscuro}>Horas</th>
                          <th style={thStyleOscuro}>Horas extra</th>
                          <th style={thStyleOscuro}>Estado</th>
                          <th style={thStyleOscuro}>Interpretación</th>
                        </tr>
                      </thead>
                      <tbody>
                        {empleado.registrosDetallados.map((item, index) => (
                          <tr
                            key={`${empleado.numero}-${item.fecha}-${index}`}
                            style={{ borderBottom: "1px solid rgba(148,163,184,0.10)" }}
                          >
                            <td style={tdStyleOscuro}>{formatearFecha(item.fecha)}</td>
                            <td style={tdStyleOscuro}>{formatearHora(item.entrada)}</td>
                            <td style={tdStyleOscuro}>{formatearHora(item.salida)}</td>
                            <td style={tdStyleOscuro}>{formatearHorasDecimal(item.horas)}</td>
                            <td style={tdStyleOscuro}>{formatearHorasDecimal(item.horasExtra)}</td>
                            <td style={tdStyleOscuro}>
                              <EstadoBadgeOscuro estado={item.estado} />
                            </td>
                            <td style={tdStyleOscuro}>{item.observacion}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        </PanelOscuro>
      </div>

      {mostrarImportador && (
        <div
          onClick={() => {
            if (!importando) {
              setMostrarImportador(false);
              setDragActivo(false);
            }
          }}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(2,6,23,0.65)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
            zIndex: 2000,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: "520px",
              background: "linear-gradient(180deg, #0f1d39 0%, #0b1630 100%)",
              color: "#ffffff",
              borderRadius: "22px",
              padding: "24px",
              border: "1px solid rgba(148,163,184,0.18)",
              boxShadow: "0 24px 60px rgba(0,0,0,0.28)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "12px",
                marginBottom: "14px",
              }}
            >
              <div>
                <div style={{ fontSize: "24px", fontWeight: "800" }}>
                  Importar archivo del checador
                </div>
                <div
                  style={{
                    fontSize: "14px",
                    color: "rgba(226,232,240,0.72)",
                    marginTop: "4px",
                    fontWeight: "600",
                  }}
                >
                  Arrastra un archivo Excel o selecciónalo manualmente.
                </div>
              </div>

              <button
                onClick={() => {
                  if (!importando) {
                    setMostrarImportador(false);
                    setDragActivo(false);
                  }
                }}
                style={{
                  border: "none",
                  background: "rgba(255,255,255,0.08)",
                  color: "#ffffff",
                  width: "36px",
                  height: "36px",
                  borderRadius: "10px",
                  cursor: "pointer",
                  fontWeight: "900",
                  fontSize: "16px",
                }}
              >
                ✕
              </button>
            </div>

            <div
              onDragEnter={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setDragActivo(true);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setDragActivo(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setDragActivo(false);
              }}
              onDrop={manejarDrop}
              style={{
                border: dragActivo
                  ? "2px dashed #60a5fa"
                  : "2px dashed rgba(148,163,184,0.35)",
                background: dragActivo ? "rgba(37,99,235,0.16)" : "rgba(255,255,255,0.04)",
                borderRadius: "18px",
                padding: "34px 20px",
                textAlign: "center",
                transition: "all 0.2s ease",
              }}
            >
              <div style={{ fontSize: "16px", fontWeight: "800", marginBottom: "8px" }}>
                Suelta aquí tu archivo
              </div>
              <div
                style={{
                  fontSize: "14px",
                  color: "rgba(226,232,240,0.72)",
                  fontWeight: "600",
                  marginBottom: "16px",
                }}
              >
                Formatos permitidos: .xlsx, .xls, .csv
              </div>

              <button
                onClick={() => inputArchivoRef.current?.click()}
                disabled={importando}
                style={{
                  border: "none",
                  background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
                  color: "#ffffff",
                  borderRadius: "12px",
                  padding: "12px 18px",
                  fontSize: "14px",
                  fontWeight: "800",
                  cursor: importando ? "not-allowed" : "pointer",
                  opacity: importando ? 0.7 : 1,
                }}
              >
                {importando ? "Importando..." : "Seleccionar archivo"}
              </button>

              <input
                ref={inputArchivoRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={manejarSeleccionArchivo}
                style={{ display: "none" }}
              />
            </div>

            <div
              style={{
                marginTop: "14px",
                fontSize: "13px",
                color: "rgba(226,232,240,0.72)",
                lineHeight: 1.5,
                fontWeight: "600",
              }}
            >
              El sistema intentará leer columnas como <b>Tiempo</b>, <b>Fecha y hora</b>,{" "}
              <b>Fecha</b>, <b>Hora</b>, <b>ID de Usuario</b> y <b>Nombre</b>.
            </div>

            {mensajeImportacion ? (
              <div
                style={{
                  marginTop: "16px",
                  background: mensajeImportacion.toLowerCase().includes("completada")
                    ? "rgba(34,197,94,0.12)"
                    : mensajeImportacion.toLowerCase().includes("nuevos")
                    ? "rgba(37,99,235,0.16)"
                    : "rgba(239,68,68,0.12)",
                  color: mensajeImportacion.toLowerCase().includes("completada")
                    ? "#86efac"
                    : mensajeImportacion.toLowerCase().includes("nuevos")
                    ? "#93c5fd"
                    : "#fca5a5",
                  border: "1px solid rgba(148,163,184,0.12)",
                  borderRadius: "14px",
                  padding: "12px 14px",
                  fontWeight: "700",
                  lineHeight: 1.45,
                }}
              >
                {mensajeImportacion}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

function TablaResumenOscura({ detalle }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          minWidth: "1300px",
        }}
      >
        <thead>
          <tr style={{ borderBottom: "1px solid rgba(148,163,184,0.18)" }}>
            <th style={thStyleOscuro}>Núm.</th>
            <th style={thStyleOscuro}>Nombre</th>
            <th style={thStyleOscuro}>Puesto</th>
            <th style={thStyleOscuro}>Área</th>
            <th style={thStyleOscuro}>Asistencias</th>
            <th style={thStyleOscuro}>Retardos</th>
            <th style={thStyleOscuro}>Faltas</th>
            <th style={thStyleOscuro}>Horas prom.</th>
            <th style={thStyleOscuro}>Horas extra prom.</th>
            <th style={thStyleOscuro}>Score prom.</th>
            <th style={thStyleOscuro}>Últ. estado</th>
          </tr>
        </thead>

        <tbody>
          {detalle.map((empleado) => (
            <tr key={empleado.numero} style={{ borderBottom: "1px solid rgba(148,163,184,0.10)" }}>
              <td style={tdStyleOscuro}>{empleado.numero}</td>
              <td style={tdStyleOscuro}>{empleado.nombre}</td>
              <td style={tdStyleOscuro}>{empleado.puesto}</td>
              <td style={tdStyleOscuro}>{empleado.area}</td>
              <td style={tdStyleOscuro}>{empleado.asistencias}</td>
              <td style={tdStyleOscuro}>{empleado.retardos}</td>
              <td style={tdStyleOscuro}>{empleado.faltas}</td>
              <td style={tdStyleOscuro}>{formatearHorasDecimal(empleado.horasPromedio)}</td>
              <td style={tdStyleOscuro}>{formatearHorasDecimal(empleado.horasExtraPromedio)}</td>
              <td style={tdStyleOscuro}>{empleado.scorePromedio.toFixed(1)}</td>
              <td style={tdStyleOscuro}>
                <EstadoBadgeOscuro estado={empleado.ultimoEstado} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TarjetaResumenOscura({ titulo, valor }) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.04)",
        borderRadius: "22px",
        padding: "22px 18px",
        color: "#ffffff",
        boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
        textAlign: "center",
        border: "1px solid rgba(148,163,184,0.12)",
      }}
    >
      <div
        style={{
          color: "rgba(226,232,240,0.72)",
          fontSize: "18px",
          marginBottom: "10px",
          fontWeight: "700",
        }}
      >
        {titulo}
      </div>
      <div
        style={{
          fontSize: "56px",
          lineHeight: 1,
          fontWeight: "900",
          letterSpacing: "-0.03em",
        }}
      >
        {valor}
      </div>
    </div>
  );
}

function EstadoBadgeOscuro({ estado }) {
  return (
    <span
      style={{
        padding: "8px 12px",
        borderRadius: "999px",
        fontSize: "13px",
        fontWeight: "800",
        display: "inline-block",
        background:
          estado === "Completo"
            ? "rgba(34,197,94,0.16)"
            : estado === "Presente"
            ? "rgba(37,99,235,0.16)"
            : estado === "Retardo"
            ? "rgba(245,158,11,0.16)"
            : estado === "Incompleto"
            ? "rgba(245,158,11,0.16)"
            : estado === "Descanso"
            ? "rgba(99,102,241,0.16)"
            : estado === "Sin registros"
            ? "rgba(148,163,184,0.16)"
            : "rgba(239,68,68,0.16)",
        color:
          estado === "Completo"
            ? "#4ade80"
            : estado === "Presente"
            ? "#93c5fd"
            : estado === "Retardo"
            ? "#fbbf24"
            : estado === "Incompleto"
            ? "#fbbf24"
            : estado === "Descanso"
            ? "#a5b4fc"
            : estado === "Sin registros"
            ? "#cbd5e1"
            : "#fca5a5",
      }}
    >
      {estado}
    </span>
  );
}

function PanelOscuro({ children, style = {} }) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.04)",
        borderRadius: "22px",
        padding: "24px",
        color: "#ffffff",
        boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
        overflowX: "auto",
        border: "1px solid rgba(148,163,184,0.12)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function EncabezadoSeccionOscuro({ titulo, subtitulo }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "12px",
        flexWrap: "wrap",
        marginBottom: "16px",
      }}
    >
      <h2
        style={{
          margin: 0,
          fontSize: "28px",
          fontWeight: "800",
          color: "#ffffff",
        }}
      >
        {titulo}
      </h2>

      <div style={{ color: "rgba(226,232,240,0.72)", fontSize: "14px", fontWeight: "600" }}>
        {subtitulo}
      </div>
    </div>
  );
}

function ChartWrap({ children }) {
  return (
    <div
      style={{
        width: "100%",
        height: 320,
        background: "rgba(2,12,34,0.52)",
        border: "1px solid rgba(148,163,184,0.12)",
        borderRadius: 20,
        padding: 12,
        boxSizing: "border-box",
      }}
    >
      {children}
    </div>
  );
}

const botonHeaderBase = {
  background: "rgba(255,255,255,0.05)",
  color: "#fff",
  border: "1px solid rgba(148,163,184,0.18)",
  borderRadius: 16,
  padding: "14px 18px",
  fontWeight: 700,
  cursor: "pointer",
};

const tituloPanelOscuro = {
  marginTop: 0,
  marginBottom: "16px",
  fontSize: "24px",
  fontWeight: "800",
  color: "#ffffff",
};

const miniDatoStyleOscuro = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(148,163,184,0.12)",
  borderRadius: "14px",
  padding: "14px",
};

const miniLabelStyleOscuro = {
  fontSize: "13px",
  color: "rgba(226,232,240,0.72)",
  fontWeight: "800",
  marginBottom: "6px",
};

const miniValorStyleOscuro = {
  fontSize: "24px",
  color: "#ffffff",
  fontWeight: "900",
};

const thStyleOscuro = {
  textAlign: "left",
  padding: "16px 12px",
  fontSize: "18px",
  fontWeight: "800",
  color: "#ffffff",
};

const tdStyleOscuro = {
  textAlign: "left",
  padding: "16px 12px",
  fontSize: "16px",
  color: "rgba(241,245,249,0.95)",
  verticalAlign: "top",
};