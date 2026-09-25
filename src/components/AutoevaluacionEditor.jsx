import { Fragment, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fmt, NOTA_MINIMA } from '../lib/notas'
import { mostrarNombre } from '../lib/planilla'

export const ESCALA = [[1, 'Nunca'], [2, 'Pocas veces'], [3, 'Algunas veces'], [4, 'Casi siempre'], [5, 'Siempre']]

let n = 0
const nuevoId = () => `p${Date.now().toString(36)}${++n}`

const PREGUNTAS_BASE = [
  'Asistí puntualmente a los encuentros de este módulo.',
  'Preparé con anticipación los temas y las lecturas propuestas.',
  'Participé activamente en las reflexiones y actividades del grupo.',
  'Comprendí los contenidos principales del módulo.',
  'Relaciono lo aprendido con mi vida de fe y mi servicio como catequista.',
  'Cumplí con las tareas y compromisos asignados.',
  'Mantuve una actitud de respeto, escucha y fraternidad con el grupo.',
].map((texto) => ({ id: nuevoId(), texto, tipo: 'escala' }))
  .concat([{ id: nuevoId(), texto: '¿Qué aprendizaje de este módulo quieres llevar a tu comunidad?', tipo: 'abierta' }])

const INSTRUCCIONES_BASE =
  'Responde con sinceridad. Para cada afirmación elige qué tan seguido la viviste durante el módulo. Tu nota de autoevaluación será el promedio de tus respuestas (de 1,0 a 5,0).'

const aFechaInput = (iso) => (iso ? new Date(iso).toLocaleDateString('en-CA') : '')
// La fecha límite cierra al final de ese día (hora local)
const deFechaInput = (d) => (d ? new Date(`${d}T23:59:59`).toISOString() : null)

export default function AutoevaluacionEditor({ cohorteId, espacio, estudiantes, orden, alCambiar }) {
  const [auto, setAuto] = useState(null) // registro guardado
  const [borrador, setBorrador] = useState(null)
  const [respuestas, setRespuestas] = useState({}) // estId -> respuesta
  const [verDe, setVerDe] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState(null)

  async function cargar() {
    setCargando(true)
    const { data } = await supabase.from('autoevaluaciones').select('*')
      .eq('cohorte_id', cohorteId).eq('espacio_id', espacio.id).maybeSingle()
    setAuto(data ?? null)
    setBorrador(data ? { instrucciones: data.instrucciones ?? '', preguntas: data.preguntas ?? [], abierta: data.abierta, cierra: aFechaInput(data.cierra) } : null)
    if (data) {
      const { data: rs } = await supabase.from('respuestas_autoevaluacion').select('*').eq('autoevaluacion_id', data.id)
      setRespuestas(Object.fromEntries((rs ?? []).map((r) => [r.estudiante_id, r])))
    } else setRespuestas({})
    setCargando(false)
  }
  useEffect(() => { setMensaje(null); setVerDe(null); cargar() }, [cohorteId, espacio.id])

  const cambiar = (k, v) => setBorrador((b) => ({ ...b, [k]: v }))
  const cambiarPregunta = (id, k, v) => cambiar('preguntas', borrador.preguntas.map((p) => (p.id === id ? { ...p, [k]: v } : p)))
  const mover = (i, paso) => {
    const lista = [...borrador.preguntas]
    const j = i + paso
    if (j < 0 || j >= lista.length) return
    ;[lista[i], lista[j]] = [lista[j], lista[i]]
    cambiar('preguntas', lista)
  }

  async function crear() {
    setGuardando(true); setMensaje(null)
    const { error } = await supabase.from('autoevaluaciones').insert({
      cohorte_id: cohorteId, espacio_id: espacio.id, instrucciones: INSTRUCCIONES_BASE, preguntas: PREGUNTAS_BASE, abierta: false,
    })
    setGuardando(false)
    if (error) { setMensaje({ tipo: 'error', texto: error.message }); return }
    await cargar()
    alCambiar?.()
    setMensaje({ tipo: 'ok', texto: 'Autoevaluación creada con preguntas sugeridas. Ajústalas y ábrela cuando quieras.' })
  }

  async function guardar() {
    const preguntas = borrador.preguntas.map((p) => ({ ...p, texto: p.texto.trim() })).filter((p) => p.texto)
    if (!preguntas.some((p) => p.tipo === 'escala')) {
      setMensaje({ tipo: 'error', texto: 'Debe haber al menos una pregunta de valoración (1 a 5) para calcular la nota.' }); return
    }
    setGuardando(true); setMensaje(null)
    const { error } = await supabase.from('autoevaluaciones').update({
      instrucciones: borrador.instrucciones.trim() || null, preguntas, abierta: borrador.abierta, cierra: deFechaInput(borrador.cierra),
    }).eq('id', auto.id)
    setGuardando(false)
    if (error) { setMensaje({ tipo: 'error', texto: error.message }); return }
    await cargar()
    setMensaje({ tipo: 'ok', texto: borrador.abierta ? 'Guardado. Los estudiantes ya pueden responderla en su portal.' : 'Guardado. Aún está cerrada para los estudiantes.' })
  }

  async function eliminar() {
    const total = Object.keys(respuestas).length
    if (!confirm(`¿Eliminar la autoevaluación en línea de este módulo?${total ? `\n\nSe borrarán las ${total} respuesta(s) enviadas. Las notas que ya quedaron en la planilla se conservan.` : ''}\n\nLa columna Autoevaluación volverá a ser editable a mano.`)) return
    const { error } = await supabase.from('autoevaluaciones').delete().eq('id', auto.id)
    if (error) { setMensaje({ tipo: 'error', texto: error.message }); return }
    await cargar()
    alCambiar?.()
  }

  if (cargando) return <p className="text-slate-500">Cargando…</p>

  if (!auto) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="text-xl font-semibold">Autoevaluación en línea</h2>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          Los estudiantes responden la autoevaluación desde su portal y la nota queda de inmediato en la casilla
          <strong> Autoevaluación</strong> de <strong>{espacio.etiqueta} · {espacio.nombre}</strong>. Mientras exista, esa
          columna de la planilla queda bloqueada para que no se modifique a mano.
        </p>
        <button className="btn mt-4" onClick={crear} disabled={guardando}>{guardando ? 'Creando…' : 'Crear autoevaluación'}</button>
        {mensaje && <p className={`mt-3 text-sm ${mensaje.tipo === 'error' ? 'text-alerta' : 'text-green-700'}`}>{mensaje.texto}</p>}
      </div>
    )
  }

  const respondieron = estudiantes.filter((e) => respuestas[e.id]).length
  const cerradaPorFecha = auto.cierra && new Date(auto.cierra) <= new Date()
  const pregunta = (id) => auto.preguntas.find((p) => p.id === id)

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">Autoevaluación en línea</h2>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${auto.abierta && !cerradaPorFecha ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'}`}>
            {auto.abierta && !cerradaPorFecha ? 'Abierta para los estudiantes' : cerradaPorFecha ? 'Cerrada por fecha límite' : 'Cerrada'}
          </span>
        </div>

        <div className="mb-4 grid gap-4 sm:grid-cols-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={borrador.abierta} onChange={(e) => cambiar('abierta', e.target.checked)} />
            Abierta: los estudiantes pueden responderla
          </label>
          <div className="flex items-center gap-2 text-sm">
            <label htmlFor="cierra">Fecha límite (opcional)</label>
            <input id="cierra" type="date" className="campo w-auto py-1" value={borrador.cierra} onChange={(e) => cambiar('cierra', e.target.value)} />
          </div>
        </div>

        <label className="etiqueta" htmlFor="instr">Instrucciones para el estudiante</label>
        <textarea id="instr" rows={3} className="campo mb-4" value={borrador.instrucciones} onChange={(e) => cambiar('instrucciones', e.target.value)} />

        <p className="etiqueta">Preguntas</p>
        <ol className="space-y-2">
          {borrador.preguntas.map((p, i) => (
            <li key={p.id} className="flex flex-wrap items-center gap-2">
              <span className="w-6 text-right text-xs text-slate-500">{i + 1}.</span>
              <input className="campo min-w-[16rem] flex-1" aria-label={`Pregunta ${i + 1}`} value={p.texto}
                onChange={(e) => cambiarPregunta(p.id, 'texto', e.target.value)} />
              <select className="campo w-auto py-1" value={p.tipo} onChange={(e) => cambiarPregunta(p.id, 'tipo', e.target.value)}>
                <option value="escala">Valoración 1 a 5 (cuenta en la nota)</option>
                <option value="abierta">Respuesta escrita (no cuenta en la nota)</option>
              </select>
              <button className="px-1 text-mariano disabled:text-slate-300" aria-label="Subir" disabled={i === 0} onClick={() => mover(i, -1)}>▲</button>
              <button className="px-1 text-mariano disabled:text-slate-300" aria-label="Bajar" disabled={i === borrador.preguntas.length - 1} onClick={() => mover(i, 1)}>▼</button>
              <button className="text-xs text-alerta underline" onClick={() => cambiar('preguntas', borrador.preguntas.filter((x) => x.id !== p.id))}>Quitar</button>
            </li>
          ))}
        </ol>
        <button className="btn-sec mt-3" onClick={() => cambiar('preguntas', [...borrador.preguntas, { id: nuevoId(), texto: '', tipo: 'escala' }])}>Agregar pregunta</button>
        <p className="mt-2 text-xs text-slate-500">Escala: {ESCALA.map(([v, t]) => `${v} = ${t}`).join(' · ')}. La nota es el promedio de las valoraciones, truncado a un decimal.</p>
        {respondieron > 0 && <p className="mt-2 text-xs text-amber-700">Ya hay respuestas. Si cambias las preguntas, las notas ya enviadas no se recalculan.</p>}

        <div className="mt-5 flex flex-wrap items-center gap-4">
          <button className="btn" onClick={guardar} disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar'}</button>
          <button className="text-sm font-semibold text-alerta underline" onClick={eliminar}>Eliminar autoevaluación en línea</button>
          {mensaje && <p className={`text-sm ${mensaje.tipo === 'error' ? 'text-alerta' : 'text-green-700'}`}>{mensaje.texto}</p>}
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <div className="flex items-center justify-between bg-tinta px-4 py-2 text-white">
          <h3 className="font-serif text-base font-semibold">Respuestas</h3>
          <span className="text-sm text-blue-100">{respondieron} de {estudiantes.length} estudiantes</span>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-cielo text-left">
            <tr><th className="p-2">Estudiante</th><th className="p-2">Estado</th><th className="p-2 text-center">Nota</th><th className="p-2" /></tr>
          </thead>
          <tbody>
            {estudiantes.map((e) => {
              const r = respuestas[e.id]
              return (
                <Fragment key={e.id}>
                  <tr className="border-t border-slate-100">
                    <td className="p-2 font-medium">{mostrarNombre(e, orden)}</td>
                    <td className="p-2">
                      {r ? <span className="text-green-700">Enviada el {new Date(r.enviado).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}</span>
                        : <span className="text-slate-500">Pendiente</span>}
                    </td>
                    <td className={`p-2 text-center font-semibold tabular-nums ${r?.nota !== null && r?.nota < NOTA_MINIMA ? 'text-alerta' : ''}`}>{r ? fmt(r.nota) : '—'}</td>
                    <td className="p-2 text-right">
                      {r && <button className="text-xs text-mariano underline" onClick={() => setVerDe(verDe === e.id ? null : e.id)}>{verDe === e.id ? 'Ocultar' : 'Ver respuestas'}</button>}
                    </td>
                  </tr>
                  {verDe === e.id && r && (
                    <tr className="bg-slate-50">
                      <td colSpan={4} className="p-4">
                        <ol className="space-y-2">
                          {Object.entries(r.respuestas).map(([id, valor]) => {
                            const p = pregunta(id)
                            const etiqueta = p?.tipo === 'escala' ? `${valor} · ${ESCALA.find(([v]) => String(v) === String(valor))?.[1] ?? ''}` : valor
                            return (
                              <li key={id} className="text-sm">
                                <p className="text-slate-600">{p?.texto ?? 'Pregunta eliminada'}</p>
                                <p className="font-medium whitespace-pre-wrap">{etiqueta || '—'}</p>
                              </li>
                            )
                          })}
                        </ol>
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
