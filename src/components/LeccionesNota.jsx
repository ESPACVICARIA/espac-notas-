import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fmt, NOTA_MINIMA } from '../lib/notas'
import { mostrarNombre } from '../lib/planilla'
import { esCalificable, nombreTipo } from '../lib/bloques'

const CRITERIOS = { mejor: 'El mejor intento', primero: 'El primer intento' }
const falla = (r) => { if (r.error) throw r.error; return r }

// Lecciones del módulo con actividades que dan nota: el formador decide si cuentan para su cohorte
export default function LeccionesNota({ cohorteId, espacio, estudiantes, orden, alCambiar }) {
  const [lecciones, setLecciones] = useState([])
  const [enlaces, setEnlaces] = useState({}) // leccion_id -> fila de lecciones_nota
  const [intentos, setIntentos] = useState([])
  const [abierta, setAbierta] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [trabajando, setTrabajando] = useState(false)
  const [mensaje, setMensaje] = useState(null)
  const [falta, setFalta] = useState(false)

  async function cargar() {
    setCargando(true)
    const { data } = await supabase.from('lecciones').select('id, titulo, bloques, publicada').eq('espacio_id', espacio.id).order('orden').order('id')
    const ls = (data ?? []).filter((l) => (l.bloques ?? []).some(esCalificable))
    setLecciones(ls)
    const ids = ls.map((l) => l.id)
    if (ids.length) {
      const r = await supabase.from('lecciones_nota').select('*').eq('cohorte_id', cohorteId).in('leccion_id', ids)
      setFalta(!!r.error)
      setEnlaces(Object.fromEntries((r.data ?? []).map((x) => [x.leccion_id, x])))
      const idsEst = estudiantes.map((e) => e.id)
      const { data: is } = await supabase.from('intentos_leccion').select('*').in('leccion_id', ids).in('estudiante_id', idsEst.length ? idsEst : ['00000000-0000-0000-0000-000000000000']).order('creado')
      setIntentos(is ?? [])
    } else { setEnlaces({}); setIntentos([]) }
    setCargando(false)
  }
  useEffect(() => { setMensaje(null); setAbierta(null); cargar() }, [cohorteId, espacio.id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function configurar(l, cuenta, criterio) {
    setTrabajando(true); setMensaje(null)
    try {
      const e = enlaces[l.id]
      if (cuenta) {
        let actividadId = e?.actividad_id
        const nombre = `Lección: ${l.titulo}`
        if (!actividadId) {
          const { count } = await supabase.from('actividades').select('id', { count: 'exact', head: true }).eq('cohorte_id', cohorteId).eq('espacio_id', espacio.id)
          const { data } = falla(await supabase.from('actividades').insert({ cohorte_id: cohorteId, espacio_id: espacio.id, nombre, orden: count ?? 0 }).select('id').single())
          actividadId = data.id
        } else falla(await supabase.from('actividades').update({ nombre }).eq('id', actividadId))
        falla(await supabase.from('lecciones_nota').upsert({ leccion_id: l.id, cohorte_id: cohorteId, actividad_id: actividadId, criterio }))
      } else if (e) {
        if (e.actividad_id) falla(await supabase.from('actividades').delete().eq('id', e.actividad_id))
        falla(await supabase.from('lecciones_nota').delete().eq('leccion_id', l.id).eq('cohorte_id', cohorteId))
      }
      falla(await supabase.rpc('sincronizar_leccion', { p_leccion: l.id, p_cohorte: cohorteId }))
      await cargar()
      alCambiar?.()
      setMensaje({ tipo: 'ok', texto: cuenta
        ? `«${l.titulo}» cuenta como actividad de Contenidos. Las entregas que ya existían se pasaron a la planilla.`
        : `«${l.titulo}» ya no cuenta como nota. Se quitó su actividad y se recalculó Contenidos.` })
    } catch (err) {
      setMensaje({ tipo: 'error', texto: /lecciones_nota|sincronizar_leccion/.test(err.message) ? 'Falta instalar lecciones_nota.sql en Supabase.' : err.message })
    }
    setTrabajando(false)
  }

  if (cargando) return <p className="text-slate-500">Cargando lecciones…</p>

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="mb-1 text-xl font-semibold">Lecciones con nota · {espacio.etiqueta}</h2>
        <p className="max-w-3xl text-sm text-slate-600">
          Las lecciones de <strong>Módulos de estudio</strong> que tienen actividades (preguntas rápidas, unir, clasificar, completar, ordenar,
          línea de tiempo, jerarquía, diagrama, trivia o laberinto) dan una nota: el primer intento de cada actividad, promediado y
          multiplicado por 5. Si activas «Cuenta como nota», esa nota entra como una actividad de <strong>Contenidos</strong> para esta cohorte.
        </p>
        {falta && <p className="mt-2 text-sm text-alerta">Falta instalar lecciones_nota.sql en Supabase para usar esta opción.</p>}
      </div>

      {mensaje && <p className={`text-sm ${mensaje.tipo === 'error' ? 'text-alerta' : 'text-green-700'}`}>{mensaje.texto}</p>}

      {!lecciones.length ? (
        <p className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-slate-500">
          Este módulo aún no tiene lecciones con actividades que den nota. Agrégalas en Módulos de estudio.
        </p>
      ) : lecciones.map((l) => {
        const e = enlaces[l.id]
        const cuenta = !!e?.actividad_id
        const criterio = e?.criterio ?? 'mejor'
        const propios = intentos.filter((x) => x.leccion_id === l.id)
        const porEst = {}
        for (const it of propios) (porEst[it.estudiante_id] ??= []).push(it)
        const cuentaDe = (lista) => !lista?.length ? null : criterio === 'primero' ? lista[0].nota : Math.max(...lista.map((x) => Number(x.nota ?? 0)))
        const actividades = l.bloques.filter(esCalificable)
        const acierto = {}
        for (const it of propios) for (const [id, p] of Object.entries(it.resultados ?? {})) { const a = (acierto[id] ??= { s: 0, n: 0 }); a.s += Number(p); a.n++ }
        const abiertaEsta = abierta === l.id
        return (
          <div key={l.id} className="rounded-lg border border-slate-200 bg-white">
            <div className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{l.titulo}</p>
                <p className="text-xs text-slate-500">
                  {actividades.length} actividad(es) con nota · {l.publicada ? 'Publicada' : 'Borrador (los estudiantes aún no la ven)'} · entregada por {Object.keys(porEst).length} de {estudiantes.length}
                </p>
              </div>
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input type="checkbox" checked={cuenta} disabled={trabajando || falta} onChange={(ev) => configurar(l, ev.target.checked, criterio)} />
                Cuenta como nota
              </label>
              {cuenta && (
                <select className="campo w-auto py-1 text-sm" value={criterio} disabled={trabajando} onChange={(ev) => configurar(l, true, ev.target.value)} aria-label="Nota que cuenta">
                  {Object.entries(CRITERIOS).map(([k, t]) => <option key={k} value={k}>{t}</option>)}
                </select>
              )}
              <button className="btn-sec py-1 text-sm" onClick={() => setAbierta(abiertaEsta ? null : l.id)}>{abiertaEsta ? 'Ocultar resultados' : 'Ver resultados'}</button>
            </div>
            {abiertaEsta && (
              <div className="space-y-5 border-t border-slate-200 p-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-cielo text-left">
                      <tr><th className="p-2">Estudiante</th><th className="p-2 text-center">Entregas</th><th className="p-2 text-center">Mejor</th><th className="p-2 text-center">Nota que cuenta</th></tr>
                    </thead>
                    <tbody>
                      {estudiantes.map((s) => {
                        const lista = porEst[s.id]
                        const n = cuentaDe(lista)
                        return (
                          <tr key={s.id} className="border-t border-slate-100">
                            <td className="p-2 font-medium">{mostrarNombre(s, orden)}</td>
                            <td className="p-2 text-center tabular-nums">{lista?.length ?? <span className="text-slate-400">Pendiente</span>}</td>
                            <td className="p-2 text-center tabular-nums">{lista ? fmt(Math.max(...lista.map((x) => Number(x.nota ?? 0)))) : '—'}</td>
                            <td className={`p-2 text-center font-semibold tabular-nums ${n !== null && n < NOTA_MINIMA ? 'text-alerta' : ''}`}>{fmt(n)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                {propios.length > 0 && (
                  <div>
                    <h3 className="mb-2 font-semibold">Actividades que más cuestan</h3>
                    <ul className="space-y-1">
                      {actividades.map((b, k) => ({ b, k, a: acierto[b.id] })).filter((x) => x.a).sort((x, y) => x.a.s / x.a.n - y.a.s / y.a.n).map(({ b, k, a }) => {
                        const pct = Math.round((a.s / a.n) * 100)
                        return (
                          <li key={b.id} className="flex items-center gap-3 text-sm">
                            <span className={`w-12 shrink-0 text-right font-semibold tabular-nums ${pct < 60 ? 'text-alerta' : 'text-green-700'}`}>{pct}%</span>
                            <span className="h-2 w-24 shrink-0 overflow-hidden rounded-full bg-slate-100"><span className="block h-full bg-mariano" style={{ width: `${pct}%` }} /></span>
                            <span className="min-w-0 truncate">{k + 1}. {nombreTipo(b.tipo)}{b.titulo || b.enunciado ? `: ${b.titulo || b.enunciado}` : ''}</span>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
