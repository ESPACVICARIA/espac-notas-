import { parsearNota, promedio, truncar } from './notas'

// Palabras que forman parte de un apellido compuesto: "de la Torre", "del Castillo"
const PARTICULAS = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'san', 'santa', 'da', 'das', 'do', 'dos', 'van', 'von'])

// Aproximación para nombres colombianos: los dos últimos apellidos
// "Luis Eduardo Beltrán Cárdenas" -> nombres "Luis Eduardo", apellidos "Beltrán Cárdenas"
export function separarNombre(completo = '') {
  const p = completo.trim().split(/\s+/).filter(Boolean)
  if (p.length <= 1) return { nombres: p.join(' '), apellidos: '' }
  let i = p.length - (p.length >= 3 ? 2 : 1)
  while (i > 1 && PARTICULAS.has(p[i - 1].toLowerCase())) i--
  return { nombres: p.slice(0, i).join(' '), apellidos: p.slice(i).join(' ') }
}

export function ordenarEstudiantes(lista, orden) {
  const conPartes = lista.map((e) => ({ ...e, ...separarNombre(e.nombre_completo) }))
  const clave = orden === 'apellidos' ? (e) => `${e.apellidos} ${e.nombres}` : (e) => e.nombre_completo
  return conPartes.sort((a, b) => clave(a).localeCompare(clave(b), 'es', { sensitivity: 'base' }))
}

export const mostrarNombre = (e, orden) =>
  orden === 'apellidos' && e.apellidos ? `${e.apellidos}, ${e.nombres}` : e.nombre_completo

export function leerPeso(texto) {
  const t = String(texto ?? '').replace('%', '').replace(',', '.').trim()
  if (t === '') return null
  const n = Number(t)
  return isNaN(n) || n < 0 || n > 100 ? undefined : n
}

// Contenidos a partir de las actividades de un estudiante.
// Las actividades sin nota no cuentan; se trunca a un decimal.
export function calcularContenidos(actividades, notasTexto = {}, metodo = 'simple') {
  const pares = actividades
    .map((a) => [a, parsearNota(notasTexto[a.clave] ?? '')])
    .filter(([, n]) => n !== null && n !== undefined)
  if (!pares.length) return null
  if (metodo === 'ponderado') {
    const total = pares.reduce((s, [a]) => s + (leerPeso(a.peso) || 0), 0)
    if (total > 0) return truncar(pares.reduce((s, [a, n]) => s + n * (leerPeso(a.peso) || 0), 0) / total)
  }
  return promedio(pares.map(([, n]) => n))
}

// Copia un valor a todos los estudiantes en una columna.
// Devuelve los nuevos valores y los ids que cambiaron.
export function copiarColumna({ estudiantes, valores, campo, texto, sobrescribir }) {
  const nuevo = { ...valores }
  const cambiados = []
  for (const e of estudiantes) {
    const actual = String(valores[e.id]?.[campo] ?? '').trim()
    if (actual !== '' && !sobrescribir) continue
    nuevo[e.id] = { ...valores[e.id], [campo]: texto }
    cambiados.push(e.id)
  }
  return { nuevo, cambiados }
}
