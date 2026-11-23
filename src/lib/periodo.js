import { supabase } from './supabase'

// Periodo actual y sus grupos. Coordinación ve todos los grupos; un formador, solo los suyos.
// Si aún no se instaló periodos.sql, devuelve { instalado: false } y las páginas siguen como antes.
export async function cargarPeriodoActual(perfil) {
  const { data: periodo, error } = await supabase.from('periodos').select('*').eq('actual', true).maybeSingle()
  if (error) return { instalado: false, periodo: null, grupos: [] }
  if (!periodo) return { instalado: true, periodo: null, grupos: [] }
  let consulta = supabase.from('grupos').select('*').eq('periodo_id', periodo.id)
  if (perfil?.rol !== 'admin') consulta = consulta.eq('formador_id', perfil?.id)
  const { data: grupos } = await consulta
  return { instalado: true, periodo, grupos: grupos ?? [] }
}

export const nombreCorto = (g) => `Semestre ${g.semestre} · ${g.nombre}`

// Abre la página Estudiantes directamente en el grupo (la página lee sus filtros de esta pestaña)
export function prepararEstudiantesDelGrupo(cohorteId) {
  try {
    const previo = JSON.parse(sessionStorage.getItem('espac-filtros-estudiantes') ?? '{}') ?? {}
    sessionStorage.setItem('espac-filtros-estudiantes', JSON.stringify({ ...previo, busqueda: '', cohorte: String(cohorteId), estado: '', centro: '', vista: 'grupos' }))
  } catch { /* sin almacenamiento: se abre el listado normal */ }
}
