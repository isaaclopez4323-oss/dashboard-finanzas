export function convertirHoraAMinutos(hora) {
  if (!hora) return 0
  const [h, m] = hora.split(":").map(Number)
  return h * 60 + m
}

export function calcularMinutosTarde(horaEntrada, horarioEntrada, tolerancia = 10) {
  if (!horaEntrada || !horarioEntrada) return 0

  const entrada = convertirHoraAMinutos(horaEntrada)
  const horario = convertirHoraAMinutos(horarioEntrada)

  const limite = horario + tolerancia

  if (entrada > limite) {
    return entrada - horario
  }

  return 0
}

export function calcularHorasTrabajadas(entrada, salida) {
  if (!entrada || !salida) return 0

  const minEntrada = convertirHoraAMinutos(entrada)
  const minSalida = convertirHoraAMinutos(salida)

  if (minSalida <= minEntrada) return 0

  return ((minSalida - minEntrada) / 60).toFixed(2)
}

export function determinarEstado(minutosTarde, tieneChecadas) {

  if (!tieneChecadas) return "falta"

  if (minutosTarde === 0) return "puntual"

  if (minutosTarde <= 15) return "retardo leve"

  return "retardo"
}

export function calcularScoreDia(estado) {

  switch (estado) {

    case "puntual":
      return 10

    case "retardo leve":
      return 7

    case "retardo":
      return 5

    case "falta":
      return 0

    default:
      return 0
  }
}