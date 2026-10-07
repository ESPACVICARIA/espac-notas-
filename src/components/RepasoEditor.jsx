import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fmt, NOTA_MINIMA } from '../lib/notas'
import { mostrarNombre } from '../lib/planilla'
import { BANCOS, TIPOS_PREGUNTA, conIds, preguntaVacia, revisarPregunta, limpiarPregunta } from '../lib/repasosModelo'

const CRITERIOS = { mejor: 'El mejor intento', primero: 'El primer intento' }
const falla = (r) => { if (r.error) throw r.error; return r }

function EditorPregunta({ p, i, total, cambiar, mover, quitar }) {
  const set = (k, v) => cambiar({ ...p, [k]: v })
  const problema = revisarPregunta(p)
  return (
    <li className={`rounded-lg border bg-white p-4 ${problema ? 'border-amber-300' : 'border-slate-200'}`}>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-mariano">{i + 1}.</span>
        <span className="rounded bg-cielo px-2 py-0.5 text-xs font-semibold text-mariano">{TIPOS_PREGUNTA[p.tipo]}</span>
        {problema && <span className="text-xs text-amber-700">Incompleta: {problema}</span>}
        <span className="ml-auto flex items-center gap-2">
          <button className="px-1 text-mariano disabled:text-slate-300" aria-label="Subir" disabled={i === 0} onClick={() => mover(-1)}>▲</button>
          <button className="px-1 text-mariano disabled:text-slate-300" aria-label="Bajar" disabled={i === total - 1} onClick={() => mover(1)}>▼</button>
          <button className="text-xs text-alerta underline" onClick={quitar}>Quitar</button>
        </span>
      </div>
      <textarea rows={2} className="campo mb-3" aria-label={`Enunciado de la pregunta ${i + 1}`} placeholder="Enunciado de la pregunta"
        value={p.enunciado} onChange={(e) => set('enunciado', e.target.value)} />

      {p.tipo === 'opcion' && (
        <fieldset className="space-y-2">
          <legend className="mb-1 text-xs text-slate-500">Marca la opción correcta</legend>
          {p.opciones.map((o, k) => (
            <div key={k} className="flex items-center gap-2">
              <input type="radio" name={`c-${p.id}`} checked={p.correcta === k} onChange={() => set('correcta', k)} aria-label={`Opción ${k + 1} es la correcta`} />
              <input className={`campo py-1 ${p.correcta === k ? 'border-green-500' : ''}`} value={o} placeholder={`Opción ${k + 1}`}
                onChange={(e) => set('opciones', p.opciones.map((x, j) => (j === k ? e.target.value : x)))} />
              {p.opciones.length > 2 && (
                <button className="text-xs text-slate-400 underline" onClick={() => cambiar({ ...p, opciones: p.opciones.filter((_, j) => j !== k), correcta: p.correcta === k ? 0 : p.correcta > k ? p.correcta - 1 : p.correcta })}>quitar</button>
              )}
            </div>
          ))}
          {p.opciones.length < 6 && <button className="text-xs text-mariano underline" onClick={() => set('opciones', [...p.opciones, ''])}>Agregar opción</button>}
        </fieldset>
      )}

      {p.tipo === 'vf' && (
        <div className="flex gap-4 text-sm">
          {[[true, 'Verdadero'], [false, 'Falso']].map(([v, t]) => (
            <label key={t} className="flex items-center gap-2">
              <input type="radio" name={`vf-${p.id}`} checked={p.correcta === v} onChange={() => set('correcta', v)} /> La respuesta es {t}
            </label>
          ))}
        </div>
      )}

      {p.tipo === 'completar' && (
        <div>
          <p className="mb-1 text-xs text-slate-500">Respuestas aceptadas (no importan tildes ni mayúsculas). Usa ____ en el enunciado para el espacio en blanco.</p>
          {p.aceptadas.map((a, k) => (
            <div key={k} className="mb-1 flex items-center gap-2">
              <input className="campo max-w-sm py-1" value={a} placeholder={k === 0 ? 'Respuesta correcta' : 'Otra forma válida'}
                onChange={(e) => set('aceptadas', p.aceptadas.map((x, j) => (j === k ? e.target.value : x)))} />
              {p.aceptadas.length > 1 && <button className="text-xs text-slate-400 underline" onClick={() => set('aceptadas', p.aceptadas.filter((_, j) => j !== k))}>quitar</button>}
            </div>
          ))}
          <button className="text-xs text-mariano underline" onClick={() => set('aceptadas', [...p.aceptadas, ''])}>Agregar otra forma válida</button>
        </div>
      )}

      {p.tipo === 'relacionar' && (
        <div>
          <p className="mb-1 text-xs text-slate-500">Escribe cada pareja correcta. El estudiante verá la columna derecha en desorden.</p>
          {p.pares.map((x, k) => (
            <div key={k} className="mb-1 grid grid-cols-[1fr_auto_1fr_auto] items-center gap-2">
              <input className="campo py-1" value={x.izq} placeholder="Término"
                onChange={(e) => set('pares', p.pares.map((y, j) => (j === k ? { ...y, izq: e.target.value } : y)))} />
              <span className="text-slate-400">→</span>
              <input className="campo py-1" value={x.der} placeholder="Le corresponde"
                onChange={(e) => set('pares', p.pares.map((y, j) => (j === k ? { ...y, der: e.target.value } : y)))} />
              {p.pares.length > 2 ? <button className="text-xs text-slate-400 underline" onClick={() => set('pares', p.pares.filter((_, j) => j !== k))}>quitar</button> : <span />}
            </div>
          ))}
          {p.pares.length < 8 && <button className="text-xs text-mariano underline" onClick={() => set('pares', [...p.pares, { izq: '', der: '' }])}>Agregar pareja</button>}
        </div>
      )}

      <label className="mt-3 block text-xs text-slate-500">
        Explicación que verá el estudiante al revisar
        <textarea rows={2} className="campo mt-1" value={p.explicacion ?? ''} onChange={(e) => set('explicacion', e.target.value)} />
      </label>
    </li>
  )
}

export default function RepasoEditor({ cohorteId, espacio, estudiantes, orden, alCambiar }) {
  const [repasos, setRepasos] = useState([])
  const [actual, setActual] = useState(null)
  const [borrador, setBorrador] = useState(null)
  const [sucio, setSucio] = useState(false)
  const [intentos, setIntentos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [trabajando, setTrabajando] = useState(false)
  const [mensaje, setMensaje] = useState(null)
  const [verResultados, setVerResultados] = useState(false)

  async function cargar(abrirId) {
    setCargando(true)
    const { data } = await supabase.from('repasos').select('*').eq('cohorte_id', cohorteId).eq('espacio_id', espacio.id).order('creado')
    const lista = data ?? []
    setRepasos(lista)
    const r = lista.find((x) => x.id === (abrirId ?? actual?.id)) ?? null
    setActual(r)
    setBorrador(r ? structuredClone(r) : null)
    setSucio(false)
    if (r) {
      const { data: is } = await supabase.from('intentos_repaso').select('*').eq('repaso_id', r.id).order('creado')
      setIntentos(is ?? [])
    } else setIntentos([])
    setCargando(false)
  }
  useEffect(() => { setMensaje(null); setActual(null); cargar(null) }, [cohorteId, espacio.id])

  function abrir(r) {
    if (sucio && !confirm('Tienes cambios sin guardar. ¿Salir sin guardarlos?')) return
    setMensaje(null); setVerResultados(false)
    cargar(r.id)
  }

  async function crear(banco) {
    setTrabajando(true); setMensaje(null)
    try {
      const { data } = falla(await supabase.from('repasos').insert({
        cohorte_id: cohorteId, espacio_id: espacio.id,
        titulo: banco ? banco.titulo : `Repaso: ${espacio.nombre}`,
        descripcion: banco?.descripcion ?? null,
        preguntas: banco ? conIds(banco.preguntas) : [],
      }).select('id').single())
      await cargar(data.id)
      setMensaje({ tipo: 'ok', texto: banco
        ? `Repaso creado con ${banco.preguntas.length} preguntas. Revísalas, ajusta lo que quieras y ábrelo a los estudiantes.`
        : 'Repaso creado. Agrega las preguntas.' })
    } catch (e) { setMensaje({ tipo: 'error', texto: e.message }) }
    setTrabajando(false)
  }

  const cambiar = (k, v) => { setBorrador((b) => ({ ...b, [k]: v })); setSucio(true) }
  const cambiarPregunta = (i, p) => cambiar('preguntas', borrador.preguntas.map((x, j) => (j === i ? p : x)))
  const moverPregunta = (i, paso) => {
    const l = [...borrador.preguntas]; const j = i + paso
    if (j < 0 || j >= l.length) return
    ;[l[i], l[j]] = [l[j], l[i]]
    cambiar('preguntas', l)
  }

  // Crea o quita la actividad de Contenidos que recibe la nota del repaso
  async function enlazarNota(r, cuenta, titulo) {
    let actividadId = r.actividad_id
    if (cuenta && !actividadId) {
      const { count } = await supabase.from('actividades').select('id', { count: 'exact', head: true }).eq('cohorte_id', cohorteId).eq('espacio_id', espacio.id)
      const { data } = falla(await supabase.from('actividades').insert({ cohorte_id: cohorteId, espacio_id: espacio.id, nombre: titulo, orden: count ?? 0 }).select('id').single())
      actividadId = data.id
    }
    if (cuenta && actividadId) falla(await supabase.from('actividades').update({ nombre: titulo }).eq('id', actividadId))
    if (!cuenta && actividadId) {
      falla(await supabase.from('actividades').delete().eq('id', actividadId))
      actividadId = null
    }
    return actividadId
  }

  async function guardar() {
    const problemas = borrador.preguntas.map((p, i) => [i + 1, revisarPregunta(p)]).filter(([, x]) => x)
    if (!borrador.titulo.trim()) { setMensaje({ tipo: 'error', texto: 'El repaso necesita un título.' }); return }
    if (borrador.abierto && !borrador.preguntas.length) { setMensaje({ tipo: 'error', texto: 'Agrega preguntas antes de abrir el repaso.' }); return }
    if (problemas.length) { setMensaje({ tipo: 'error', texto: `Revisa la pregunta ${problemas[0][0]}: ${problemas[0][1]}.` }); return }
    setTrabajando(true); setMensaje(null)
    try {
      const titulo = borrador.titulo.trim()
      const actividadId = await enlazarNota(actual, borrador.cuenta_nota, titulo)
      falla(await supabase.from('repasos').update({
        titulo, descripcion: borrador.descripcion?.trim() || null,
        preguntas: borrador.preguntas.map(limpiarPregunta),
        abierto: borrador.abierto, cuenta_nota: borrador.cuenta_nota, criterio: borrador.criterio,
        actividad_id: actividadId,
      }).eq('id', actual.id))
      if (borrador.cuenta_nota !== actual.cuenta_nota || borrador.criterio !== actual.criterio || actividadId !== actual.actividad_id) {
        falla(await supabase.rpc('sincronizar_repaso', { p_repaso: actual.id }))
        if (!borrador.cuenta_nota) falla(await supabase.rpc('recalcular_contenidos_grupo', { p_coh: cohorteId, p_esp: espacio.id }))
        alCambiar?.()
      }
      await cargar(actual.id)
      setMensaje({ tipo: 'ok', texto: [
        'Repaso guardado.',
        borrador.abierto ? 'Los estudiantes ya pueden resolverlo en su portal.' : 'Aún está cerrado para los estudiantes.',
        borrador.cuenta_nota ? 'Su nota cuenta como actividad de Contenidos en la planilla.' : '',
      ].filter(Boolean).join(' ') })
    } catch (e) { setMensaje({ tipo: 'error', texto: `No se pudo guardar: ${e.message}` }) }
    setTrabajando(false)
  }

  async function eliminar() {
    if (!confirm(`¿Eliminar "${actual.titulo}"?${intentos.length ? `\n\nSe borrarán ${intentos.length} intento(s) de los estudiantes.` : ''}${actual.cuenta_nota ? '\n\nTambién se quitará su actividad de Contenidos y se recalculará la planilla.' : ''}`)) return
    setTrabajando(true)
    try {
      if (actual.actividad_id) falla(await supabase.from('actividades').delete().eq('id', actual.actividad_id))
      falla(await supabase.from('repasos').delete().eq('id', actual.id))
      if (actual.cuenta_nota) { falla(await supabase.rpc('recalcular_contenidos_grupo', { p_coh: cohorteId, p_esp: espacio.id })); alCambiar?.() }
      setActual(null); await cargar(null)
      setMensaje({ tipo: 'ok', texto: 'Repaso eliminado.' })
    } catch (e) { setMensaje({ tipo: 'error', texto: e.message }) }
    setTrabajando(false)
  }

  if (cargando) return <p className="text-slate-500">Cargando repasos…</p>

  // Resultados
  const porEst = {}
  for (const it of intentos) (porEst[it.estudiante_id] ??= []).push(it)
  const notaQueCuenta = (lista) => !lista?.length ? null
    : actual?.criterio === 'primero' ? lista[0].nota : Math.max(...lista.map((x) => Number(x.nota ?? 0)))
  const aciertoPregunta = {}
  for (const it of intentos) for (const r of it.resultado ?? []) {
    const a = (aciertoPregunta[r.id] ??= { suma: 0, n: 0 }); a.suma += Number(r.puntos); a.n++
  }
  const resolvieron = estudiantes.filter((e) => porEst[e.id]).length

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="mb-1 text-xl font-semibold">Repasos de {espacio.etiqueta}</h2>
        <p className="mb-4 max-w-3xl text-sm text-slate-600">
          Un repaso interactivo que el estudiante resuelve en su portal, con revisión y explicaciones al final. Puede repetirlo para
          mejorar. Si activas «Cuenta como nota», su resultado entra como una actividad de <strong>Contenidos</strong> en la planilla.
        </p>
        <div className="mb-4 flex flex-wrap gap-2">
          {repasos.map((r) => (
            <button key={r.id} onClick={() => abrir(r)} aria-pressed={actual?.id === r.id}
              className={`rounded-lg border px-3 py-2 text-left text-sm ${actual?.id === r.id ? 'border-mariano bg-cielo text-mariano' : 'border-slate-200 hover:bg-slate-50'}`}>
              <span className="block font-semibold">{r.titulo}</span>
              <span className="block text-xs text-slate-500">
                {r.preguntas.length} preguntas · {r.abierto ? 'Abierto' : 'Cerrado'}{r.cuenta_nota ? ' · Cuenta como nota' : ''}
              </span>
            </button>
          ))}
          {!repasos.length && <p className="text-sm text-slate-500">Este módulo aún no tiene repasos.</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn-sec" disabled={trabajando} onClick={() => crear(null)}>Nuevo repaso en blanco</button>
          {BANCOS.map((b) => (
            <button key={b.clave} className="btn" disabled={trabajando} onClick={() => crear(b)}>
              Usar banco: {b.titulo.replace(/^Repaso:\s*/, '')} ({b.preguntas.length} preguntas)
            </button>
          ))}
        </div>
      </div>

      {mensaje && <p className={`text-sm ${mensaje.tipo === 'error' ? 'text-alerta' : 'text-green-700'}`}>{mensaje.texto}</p>}

      {actual && borrador && (
        <>
          <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
            <div className="flex flex-wrap gap-2 border-b border-slate-200">
              {[[false, 'Preguntas y ajustes'], [true, `Resultados (${resolvieron}/${estudiantes.length})`]].map(([v, t]) => (
                <button key={t} onClick={() => setVerResultados(v)}
                  className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold ${verResultados === v ? 'border-mariano text-mariano' : 'border-transparent text-slate-500'}`}>{t}</button>
              ))}
            </div>

            {!verResultados ? (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="etiqueta" htmlFor="rep-titulo">Título</label>
                    <input id="rep-titulo" className="campo" value={borrador.titulo} onChange={(e) => cambiar('titulo', e.target.value)} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="etiqueta" htmlFor="rep-desc">Descripción para el estudiante (opcional)</label>
                    <textarea id="rep-desc" rows={2} className="campo" value={borrador.descripcion ?? ''} onChange={(e) => cambiar('descripcion', e.target.value)} />
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={borrador.abierto} onChange={(e) => cambiar('abierto', e.target.checked)} />
                    Abierto: los estudiantes pueden resolverlo
                  </label>
                  <label className="flex items-center gap-2 text-sm font-semibold">
                    <input type="checkbox" checked={borrador.cuenta_nota} onChange={(e) => cambiar('cuenta_nota', e.target.checked)} />
                    Cuenta como nota (actividad de Contenidos)
                  </label>
                  {borrador.cuenta_nota && (
                    <label className="flex items-center gap-2 text-sm sm:col-span-2">
                      Nota que cuenta:
                      <select className="campo w-auto py-1" value={borrador.criterio} onChange={(e) => cambiar('criterio', e.target.value)}>
                        {Object.entries(CRITERIOS).map(([k, t]) => <option key={k} value={k}>{t}</option>)}
                      </select>
                      <span className="text-xs text-slate-500">Nota = aciertos ÷ preguntas × 5, truncada a un decimal.</span>
                    </label>
                  )}
                </div>

                <ol className="space-y-3">
                  {borrador.preguntas.map((p, i) => (
                    <EditorPregunta key={p.id} p={p} i={i} total={borrador.preguntas.length}
                      cambiar={(np) => cambiarPregunta(i, np)} mover={(paso) => moverPregunta(i, paso)}
                      quitar={() => cambiar('preguntas', borrador.preguntas.filter((_, j) => j !== i))} />
                  ))}
                </ol>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  Agregar pregunta:
                  {Object.entries(TIPOS_PREGUNTA).map(([k, t]) => (
                    <button key={k} className="btn-sec py-1" onClick={() => cambiar('preguntas', [...borrador.preguntas, preguntaVacia(k)])}>{t}</button>
                  ))}
                </div>
                {intentos.length > 0 && <p className="text-xs text-amber-700">Ya hay intentos. Si cambias preguntas, las notas ya obtenidas no se recalculan.</p>}

                <div className="flex flex-wrap items-center gap-4 border-t border-slate-200 pt-4">
                  <button className="btn" onClick={guardar} disabled={trabajando || !sucio}>{trabajando ? 'Guardando…' : 'Guardar repaso'}</button>
                  <button className="text-sm font-semibold text-alerta underline" disabled={trabajando} onClick={eliminar}>Eliminar repaso</button>
                </div>
              </>
            ) : (
              <div className="space-y-6">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-cielo text-left">
                      <tr><th className="p-2">Estudiante</th><th className="p-2 text-center">Intentos</th><th className="p-2 text-center">Mejor</th><th className="p-2 text-center">Nota que cuenta</th></tr>
                    </thead>
                    <tbody>
                      {estudiantes.map((e) => {
                        const l = porEst[e.id]
                        const n = notaQueCuenta(l)
                        return (
                          <tr key={e.id} className="border-t border-slate-100">
                            <td className="p-2 font-medium">{mostrarNombre(e, orden)}</td>
                            <td className="p-2 text-center tabular-nums">{l?.length ?? <span className="text-slate-400">Pendiente</span>}</td>
                            <td className="p-2 text-center tabular-nums">{l ? fmt(Math.max(...l.map((x) => Number(x.nota ?? 0)))) : '—'}</td>
                            <td className={`p-2 text-center font-semibold tabular-nums ${n !== null && n < NOTA_MINIMA ? 'text-alerta' : ''}`}>{fmt(n)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                {intentos.length > 0 && (
                  <div>
                    <h3 className="mb-2 font-semibold">Preguntas que más cuestan</h3>
                    <p className="mb-2 text-xs text-slate-500">Porcentaje de acierto en todos los intentos. Las de menor acierto son buenas para reforzar en el próximo encuentro.</p>
                    <ul className="space-y-1">
                      {actual.preguntas
                        .map((p, i) => ({ p, i, a: aciertoPregunta[p.id] }))
                        .filter((x) => x.a)
                        .sort((x, y) => x.a.suma / x.a.n - y.a.suma / y.a.n)
                        .map(({ p, i, a }) => {
                          const pct = Math.round((a.suma / a.n) * 100)
                          return (
                            <li key={p.id} className="flex items-center gap-3 text-sm">
                              <span className={`w-12 shrink-0 text-right font-semibold tabular-nums ${pct < 60 ? 'text-alerta' : 'text-green-700'}`}>{pct}%</span>
                              <span className="h-2 w-24 shrink-0 overflow-hidden rounded-full bg-slate-100"><span className="block h-full bg-mariano" style={{ width: `${pct}%` }} /></span>
                              <span className="min-w-0 truncate">{i + 1}. {p.enunciado}</span>
                            </li>
                          )
                        })}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
