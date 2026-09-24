// Reglas del ESPAC:
// 1. Las casillas vacías ("—") no cuentan en el promedio.
// 2. Se trunca a un decimal (3.67 -> 3.6), no se redondea.
export const CAMPOS = [
  ['asistencia', 'Asistencia'],
  ['contenidos', 'Contenidos'],
  ['autoevaluacion', 'Autoev.'],
  ['coevaluacion', 'Coev.'],
]

export const NOTA_MINIMA = 3.0

export const truncar = (n) => Math.floor(n * 10 + 1e-6) / 10

const valido = (v) => v !== null && v !== undefined && v !== '' && !isNaN(Number(v))

export function promedio(valores) {
  const v = valores.filter(valido).map(Number)
  if (!v.length) return null
  return truncar(v.reduce((a, b) => a + b, 0) / v.length)
}

export const definitiva = (n) => (n ? promedio(CAMPOS.map(([k]) => n[k])) : null)

export const fmt = (n) => (n === null || n === undefined ? '—' : Number(n).toFixed(1).replace('.', ','))

export function parsearNota(texto) {
  const t = String(texto).trim().replace(',', '.')
  if (t === '' || t === '-' || t === '—') return null
  const n = Number(t)
  if (isNaN(n) || n < 0 || n > 5) return undefined // inválida
  return Math.round(n * 10) / 10
}
