import * as XLSX from 'xlsx'
import { supabase } from './supabase'
import { CAMPOS, definitiva, promedio } from './notas'

// Supabase entrega máximo 1000 filas por consulta: se piden por páginas
export async function traerTodo(construir) {
  const todo = []
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await construir().range(desde, desde + 999)
    if (error) throw error
    todo.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }
  return todo
}

const n = (v) => (v === null || v === undefined ? '' : Number(v))

export async function exportarEstudiantes(ids) {
  const estudiantes = []
  const notas = []
  for (let i = 0; i < ids.length; i += 100) {
    const lote = ids.slice(i, i + 100)
    estudiantes.push(...await traerTodo(() => supabase.from('estudiantes').select('*, cohortes(nombre)').in('id', lote)))
    notas.push(...await traerTodo(() => supabase.from('notas').select('*').in('estudiante_id', lote)))
  }
  const { data: espacios } = await supabase.from('espacios').select('*').order('semestre').order('orden').order('id')
  estudiantes.sort((a, b) => a.nombre_completo.localeCompare(b.nombre_completo, 'es'))

  const notasDe = {}
  for (const x of notas) (notasDe[x.estudiante_id] ??= {})[x.espacio_id] = x

  // Hoja 1: hoja de vida
  const hojaVida = estudiantes.map((e) => ({
    'Nombre completo': e.nombre_completo, 'Tipo documento': e.tipo_id ?? '', 'Número documento': e.numero_id ?? '',
    'Cohorte': e.cohortes?.nombre ?? '', 'Estado': e.estado, 'Parroquia': e.parroquia ?? '',
    'Centro de formación': e.centro_formacion ?? '', 'Fecha de matrícula': e.fecha_matricula ?? '',
    'Lugar de nacimiento': e.lugar_nacimiento ?? '', 'Fecha de nacimiento': e.fecha_nacimiento ?? '',
    'Dirección': e.direccion ?? '', 'Barrio': e.barrio ?? '', 'Teléfono': e.telefono ?? '',
    'Correo electrónico': e.correo ?? '', 'Ocupación': e.ocupacion ?? '', 'Nivel escolar': e.nivel_escolar ?? '',
    'Estudio universitario o técnico': e.estudio_superior ?? '', 'Observaciones': e.observaciones ?? '',
  }))

  // Hoja 2: promedios por semestre
  const resumen = estudiantes.map((e) => {
    const ns = notasDe[e.id] ?? {}
    const proms = [1, 2, 3, 4].map((s) => promedio(espacios.filter((x) => x.semestre === s).map((x) => definitiva(ns[x.id]))))
    return {
      'Nombre completo': e.nombre_completo, 'Número documento': e.numero_id ?? '', 'Cohorte': e.cohortes?.nombre ?? '',
      'Semestre 1': n(proms[0]), 'Semestre 2': n(proms[1]), 'Semestre 3': n(proms[2]), 'Semestre 4': n(proms[3]),
      'Promedio general': n(promedio(proms)),
    }
  })

  // Hoja 3: detalle de cada nota
  const detalle = []
  for (const e of estudiantes) {
    for (const x of espacios) {
      const nota = notasDe[e.id]?.[x.id]
      if (!nota) continue
      detalle.push({
        'Nombre completo': e.nombre_completo, 'Número documento': e.numero_id ?? '', 'Semestre': x.semestre,
        'Espacio': x.etiqueta, 'Nombre del espacio': x.nombre,
        ...Object.fromEntries(CAMPOS.map(([k, t]) => [t, n(nota[k])])),
        'Definitiva': n(definitiva(nota)),
      })
    }
  }

  const libro = XLSX.utils.book_new()
  const agregar = (filas, nombre) => {
    const hoja = XLSX.utils.json_to_sheet(filas.length ? filas : [{ 'Sin datos': '' }])
    const cols = Object.keys(filas[0] ?? { 'Sin datos': '' })
    hoja['!cols'] = cols.map((c) => ({ wch: Math.max(12, c.length + 2, ...filas.slice(0, 200).map((f) => String(f[c] ?? '').length + 1)) }))
    XLSX.utils.book_append_sheet(libro, hoja, nombre)
  }
  agregar(hojaVida, 'Hoja de vida')
  agregar(resumen, 'Promedios')
  agregar(detalle, 'Notas detalladas')

  const hoy = new Date().toISOString().slice(0, 10)
  XLSX.writeFile(libro, `espac-estudiantes-${hoy}.xlsx`)
  return estudiantes.length
}
