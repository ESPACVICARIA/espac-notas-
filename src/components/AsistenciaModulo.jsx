import { useEffect, useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabase'
import { traerTodo } from '../lib/exportar'
import { fmt, truncar, NOTA_MINIMA } from '../lib/notas'
import { mostrarNombre } from '../lib/planilla'

export const ESTADOS = {
  A: { corto: 'A', largo: 'Asistió', color: 'bg-green-600 text-white border-green-600' },
  FI: { corto: 'FI', largo: 'Falla injustificada', color: 'bg-alerta text-white border-alerta' },
  FJ: { corto: 'FJ', largo: 'Falla justificada', color: 'bg-oro text-white border-oro' },
}
const REGLAS = {
  excluir: 'La falla justificada no cuenta: ni suma ni resta',
  asiste: 'La falla justificada cuenta como asistencia',
  falla: 'La falla justificada cuenta como falla',
}

const hoy = () => new Date().toLocaleDateString('en-CA')
const fechaLarga = (f) => new Date(`${f}T12:00:00`).toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
const fechaCorta = (f) => new Date(`${f}T12:00:00`).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })

// Nota de asistencia a partir de los conteos, según cómo se traten las faltas justificadas
export function notaAsistencia({ A, FI, FJ }, regla) {
  const total = regla === 'excluir' ? A + FI : A + FI + FJ
  if (!total) return null
  const presentes = regla === 'asiste' ? A + FJ : A
  return truncar((presentes / total) * 5)
}

export function porcentajeAsistencia({ A, FI, FJ }, regla) {
  const total = regla === 'excluir' ? A + FI : A + FI + FJ
  if (!total) return null
  return Math.floor((((regla === 'asiste' ? A + FJ : A) / total) * 100) + 1e-9)
}

export default function AsistenciaModulo({ cohorteId, cohorteNombre, espacio, estudiantes, orden, perfil, alCambiar }) {
  const [sesiones, setSesiones] = useState([])
  const [marcas, setMarcas] = useState({}) // { sesionId: { estId: { estado, comentario } } }
  const [config, setConfig] = useState({ convalidar: false, justificadas: 'excluir' })
  const [actual, setActual] = useState(null) // sesión abierta
  const [borrador, setBorrador] = useState({})
  const [sucio, setSucio] = useState(false)
  const [nueva, setNueva] = useState({ fecha: hoy(), tema: '' })
  const [cargando, setCargando] = useState(true)
  const [trabajando, setTrabajando] = useState(false)
  const [mensaje, setMensaje] = useState(null)

  async function cargar(abrir) {
    setCargando(true)
    const [{ data: ss }, { data: cf }] = await Promise.all([
      supabase.from('sesiones').select('*').eq('cohorte_id', cohorteId).eq('espacio_id', espacio.id).order('fecha').order('id'),
      supabase.from('config_asistencia').select('*').eq('cohorte_id', cohorteId).eq('espacio_id', espacio.id).maybeSingle(),
    ])
    const lista = ss ?? []
    const ids = lista.map((s) => s.id)
    const filas = ids.length ? await traerTodo(() => supabase.from('asistencias').select('*').in('sesion_id', ids).order('sesion_id')) : []
    const m = {}
    for (const f of filas) (m[f.sesion_id] ??= {})[f.estudiante_id] = { estado: f.estado, comentario: f.comentario ?? '' }
    setSesiones(lista); setMarcas(m)
    setConfig(cf ? { convalidar: cf.convalidar, justificadas: cf.justificadas } : { convalidar: false, justificadas: 'excluir' })
    const s = abrir ? lista.find((x) => x.id === abrir) : null
    setActual(s ?? null); setBorrador(s ? structuredClone(m[s.id] ?? {}) : {}); setSucio(false)
    setCargando(false)
    return { lista, m, cf }
  }
  useEffect(() => { setMensaje(null); cargar() }, [cohorteId, espacio.id])

  // Conteos por estudiante (incluye lo que se está editando)
  const conteos = useMemo(() => {
    const vista = actual ? { ...marcas, [actual.id]: borrador } : marcas
    const r = {}
    for (const e of estudiantes) {
      const c = { A: 0, FI: 0, FJ: 0 }
      for (const s of sesiones) { const x = vista[s.id]?.[e.id]; if (x?.estado) c[x.estado]++ }
      r[e.id] = c
    }
    return r
  }, [marcas, borrador, actual, sesiones, estudiantes])

  async function convalidar(m = marcas, regla = config.justificadas) {
    const ahora = new Date().toISOString()
    const filas = estudiantes.map((e) => {
      const c = { A: 0, FI: 0, FJ: 0 }
      for (const s of sesiones) { const x = m[s.id]?.[e.id]; if (x?.estado) c[x.estado]++ }
      return { estudiante_id: e.id, espacio_id: espacio.id, asistencia: notaAsistencia(c, regla), actualizado_por: perfil.id, actualizado: ahora }
    })
    const { error } = await supabase.from('notas').upsert(filas, { onConflict: 'estudiante_id,espacio_id' })
    if (error) throw error
  }

  function abrirSesion(s) {
    if (sucio && !confirm('Tienes cambios sin guardar en esta sesión. ¿Salir sin guardarlos?')) return
    setActual(s); setBorrador(structuredClone(marcas[s.id] ?? {})); setSucio(false); setMensaje(null)
  }

  async function crearSesion(e) {
    e.preventDefault()
    if (sucio && !confirm('Tienes cambios sin guardar. ¿Continuar sin guardarlos?')) return
    setTrabajando(true); setMensaje(null)
    const { data, error } = await supabase.from('sesiones')
      .insert({ cohorte_id: cohorteId, espacio_id: espacio.id, fecha: nueva.fecha, tema: nueva.tema.trim() || null }).select('id').single()
    setTrabajando(false)
    if (error) { setMensaje({ tipo: 'error', texto: error.message }); return }
    setNueva({ fecha: hoy(), tema: '' })
    await cargar(data.id)
  }

  const marcar = (estId, estado) => {
    setBorrador((b) => ({ ...b, [estId]: { comentario: b[estId]?.comentario ?? '', estado: b[estId]?.estado === estado ? null : estado } }))
    setSucio(true)
  }
  const comentar = (estId, texto) => { setBorrador((b) => ({ ...b, [estId]: { estado: b[estId]?.estado ?? null, comentario: texto } })); setSucio(true) }
  const todosPresentes = () => {
    setBorrador((b) => Object.fromEntries(estudiantes.map((e) => [e.id, b[e.id]?.estado ? b[e.id] : { estado: 'A', comentario: b[e.id]?.comentario ?? '' }])))
    setSucio(true)
  }

  async function guardarSesion() {
    setTrabajando(true); setMensaje(null)
    try {
      const guardar = [], borrar = []
      for (const e of estudiantes) {
        const x = borrador[e.id]
        if (x?.estado) guardar.push({ sesion_id: actual.id, estudiante_id: e.id, estado: x.estado, comentario: x.comentario?.trim() || null })
        else if (marcas[actual.id]?.[e.id]) borrar.push(e.id)
      }
      if (guardar.length) {
        const { error } = await supabase.from('asistencias').upsert(guardar, { onConflict: 'sesion_id,estudiante_id' })
        if (error) throw error
      }
      if (borrar.length) {
        const { error } = await supabase.from('asistencias').delete().eq('sesion_id', actual.id).in('estudiante_id', borrar)
        if (error) throw error
      }
      const sinMarca = estudiantes.length - guardar.length
      if (config.convalidar) {
        await convalidar({ ...marcas, [actual.id]: borrador })
        alCambiar?.()
      }
      await cargar(actual.id)
      setMensaje({ tipo: 'ok', texto: `Asistencia del ${fechaLarga(actual.fecha)} guardada${sinMarca ? ` (${sinMarca} sin marcar)` : ''}.${config.convalidar ? ' La nota de Asistencia se actualizó en la planilla.' : ''}` })
    } catch (err) {
      setMensaje({ tipo: 'error', texto: `No se pudo guardar: ${err.message}` })
    }
    setTrabajando(false)
  }

  async function eliminarSesion(s) {
    if (!confirm(`¿Eliminar la sesión del ${fechaLarga(s.fecha)}? Se borrarán sus registros de asistencia.`)) return
    setTrabajando(true)
    const { error } = await supabase.from('sesiones').delete().eq('id', s.id)
    if (error) setMensaje({ tipo: 'error', texto: error.message })
    const { m } = await cargar()
    if (!error && config.convalidar) { try { await convalidar(m); alCambiar?.() } catch (e) { setMensaje({ tipo: 'error', texto: e.message }) } }
    setTrabajando(false)
  }

  async function guardarConfig(cambios) {
    const nuevo = { ...config, ...cambios }
    setTrabajando(true); setMensaje(null)
    try {
      const { error } = await supabase.from('config_asistencia')
        .upsert({ cohorte_id: cohorteId, espacio_id: espacio.id, ...nuevo }, { onConflict: 'cohorte_id,espacio_id' })
      if (error) throw error
      setConfig(nuevo)
      if (nuevo.convalidar) await convalidar(marcas, nuevo.justificadas)
      alCambiar?.()
      setMensaje({ tipo: 'ok', texto: nuevo.convalidar
        ? 'Convalidado: la nota de Asistencia de la planilla ahora sale de estas sesiones.'
        : 'La asistencia ya no se convalida. La columna Asistencia de la planilla vuelve a ser editable.' })
    } catch (err) {
      setMensaje({ tipo: 'error', texto: err.message })
    }
    setTrabajando(false)
  }

  function exportar() {
    const detalle = []
    for (const s of sesiones) for (const e of estudiantes) {
      const x = marcas[s.id]?.[e.id]
      detalle.push({
        Semestre: espacio.semestre, Módulo: `${espacio.etiqueta} · ${espacio.nombre}`, Estudiante: mostrarNombre(e, orden),
        Documento: e.numero_id ?? '', Fecha: s.fecha, Tema: s.tema ?? '', Estado: x?.estado ?? '', Detalle: x ? ESTADOS[x.estado].largo : 'Sin marcar',
        Comentario: x?.comentario ?? '',
      })
    }
    const resumen = estudiantes.map((e) => {
      const c = conteos[e.id]
      const n = notaAsistencia(c, config.justificadas)
      return { Semestre: espacio.semestre, Módulo: `${espacio.etiqueta} · ${espacio.nombre}`, Estudiante: mostrarNombre(e, orden), Documento: e.numero_id ?? '',
        A: c.A, FI: c.FI, FJ: c.FJ, 'Sesiones registradas': c.A + c.FI + c.FJ, 'Nota de asistencia': n ?? '' }
    })
    const libro = XLSX.utils.book_new()
    const hoja = (filas, nombre) => {
      const h = XLSX.utils.json_to_sheet(filas.length ? filas : [{ 'Sin datos': '' }])
      h['!cols'] = Object.keys(filas[0] ?? { x: 1 }).map((k) => ({ wch: Math.max(10, k.length + 2, ...filas.slice(0, 100).map((f) => String(f[k] ?? '').length + 1)) }))
      XLSX.utils.book_append_sheet(libro, h, nombre)
    }
    hoja(resumen, 'Resumen'); hoja(detalle, 'Detalle por fecha')
    const limpio = (t) => String(t ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase()
    XLSX.writeFile(libro, `asistencia-${limpio(cohorteNombre)}-${limpio(espacio.etiqueta)}.xlsx`)
  }

  if (cargando) return <p className="text-slate-500">Cargando asistencia…</p>

  return (
    <div className="space-y-6">
      {/* Sesiones */}
      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">Sesiones de {espacio.etiqueta}</h2>
          {sesiones.length > 0 && <button className="btn-sec py-1" onClick={exportar}>Exportar asistencia a Excel</button>}
        </div>
        <div className="mb-4 flex flex-wrap gap-2">
          {sesiones.map((s) => {
            const n = Object.keys(marcas[s.id] ?? {}).length
            return (
              <button key={s.id} onClick={() => abrirSesion(s)} aria-pressed={actual?.id === s.id}
                className={`rounded-lg border px-3 py-2 text-left text-sm ${actual?.id === s.id ? 'border-mariano bg-cielo text-mariano' : 'border-slate-200 hover:bg-slate-50'}`}>
                <span className="block font-semibold">{fechaCorta(s.fecha)}</span>
                <span className="block text-xs text-slate-500">{s.tema || `${n}/${estudiantes.length} marcados`}</span>
              </button>
            )
          })}
          {!sesiones.length && <p className="text-sm text-slate-500">Aún no hay sesiones. Crea la primera con la fecha del encuentro.</p>}
        </div>
        <form onSubmit={crearSesion} className="flex flex-wrap items-end gap-2">
          <div>
            <label className="etiqueta" htmlFor="ses-fecha">Fecha</label>
            <input id="ses-fecha" type="date" required className="campo w-auto" value={nueva.fecha} onChange={(e) => setNueva({ ...nueva, fecha: e.target.value })} />
          </div>
          <div className="min-w-[12rem] flex-1">
            <label className="etiqueta" htmlFor="ses-tema">Tema del encuentro (opcional)</label>
            <input id="ses-tema" className="campo" maxLength={120} value={nueva.tema} onChange={(e) => setNueva({ ...nueva, tema: e.target.value })} />
          </div>
          <button className="btn" disabled={trabajando}>Nueva sesión</button>
        </form>
      </div>

      {mensaje && <p className={`text-sm ${mensaje.tipo === 'error' ? 'text-alerta' : 'text-green-700'}`}>{mensaje.texto}</p>}

      {/* Llamado a lista */}
      {actual && (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-tinta px-4 py-2 text-white">
            <h3 className="font-serif text-base font-semibold">
              {fechaLarga(actual.fecha)}{actual.tema ? ` · ${actual.tema}` : ''}
            </h3>
            <div className="flex items-center gap-4 text-sm">
              <button className="text-blue-100 underline hover:text-white" onClick={todosPresentes}>Marcar a los demás como A</button>
              <button className="text-red-200 underline hover:text-white" onClick={() => eliminarSesion(actual)}>Eliminar sesión</button>
            </div>
          </div>
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-cielo text-left">
              <tr><th className="p-2">Estudiante</th><th className="p-2">Asistencia</th><th className="p-2">Comentario</th></tr>
            </thead>
            <tbody>
              {estudiantes.map((e) => {
                const x = borrador[e.id]
                return (
                  <tr key={e.id} className="border-t border-slate-100">
                    <td className="p-2 font-medium">{mostrarNombre(e, orden)}</td>
                    <td className="p-2">
                      <div className="flex gap-1" role="radiogroup" aria-label={`Asistencia de ${e.nombre_completo}`}>
                        {Object.entries(ESTADOS).map(([k, v]) => (
                          <button key={k} type="button" role="radio" aria-checked={x?.estado === k} title={v.largo}
                            onClick={() => marcar(e.id, k)}
                            className={`w-11 rounded-md border py-1 text-xs font-semibold ${x?.estado === k ? v.color : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'}`}>
                            {v.corto}
                          </button>
                        ))}
                      </div>
                    </td>
                    <td className="p-2">
                      <input className="campo py-1" maxLength={300} placeholder={x?.estado === 'FJ' ? 'Motivo de la falla' : ''}
                        aria-label={`Comentario para ${e.nombre_completo}`} value={x?.comentario ?? ''} onChange={(ev) => comentar(e.id, ev.target.value)} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div className="flex flex-wrap items-center gap-4 border-t border-slate-200 p-3">
            <button className="btn" onClick={guardarSesion} disabled={trabajando || !sucio}>{trabajando ? 'Guardando…' : 'Guardar asistencia'}</button>
            <span className="text-xs text-slate-500">A = asistió · FI = falla injustificada · FJ = falla justificada. Toca de nuevo para desmarcar.</span>
          </div>
        </div>
      )}

      {/* Resumen y convalidación */}
      {sesiones.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <div className="space-y-3 border-b border-slate-200 p-4">
            <h3 className="text-lg font-semibold">Resumen y nota de asistencia</h3>
            <label className="flex flex-wrap items-center gap-2 text-sm">
              Faltas justificadas:
              <select className="campo w-auto py-1" value={config.justificadas} disabled={trabajando}
                onChange={(e) => (config.convalidar ? guardarConfig({ justificadas: e.target.value }) : setConfig({ ...config, justificadas: e.target.value }))}>
                {Object.entries(REGLAS).map(([k, t]) => <option key={k} value={k}>{t}</option>)}
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input type="checkbox" checked={config.convalidar} disabled={trabajando} onChange={(e) => guardarConfig({ convalidar: e.target.checked })} />
              Convalidar como nota de Asistencia en la planilla
            </label>
            <p className="text-xs text-slate-500">
              Nota = porcentaje de asistencia × 5, truncada a un decimal. Por ejemplo, 9 de 10 sesiones = 4,5. Mientras esté convalidada,
              la columna Asistencia de la planilla se llena sola y queda bloqueada.
            </p>
          </div>
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-cielo">
              <tr>
                <th className="p-2 text-left">Estudiante</th><th className="p-2">A</th><th className="p-2">FI</th><th className="p-2">FJ</th>
                <th className="p-2">% asistencia</th><th className="p-2">Nota</th>
              </tr>
            </thead>
            <tbody>
              {estudiantes.map((e) => {
                const c = conteos[e.id]
                const n = notaAsistencia(c, config.justificadas)
                const pct = porcentajeAsistencia(c, config.justificadas)
                return (
                  <tr key={e.id} className="border-t border-slate-100">
                    <td className="p-2 font-medium">{mostrarNombre(e, orden)}</td>
                    <td className="p-2 text-center tabular-nums">{c.A}</td>
                    <td className={`p-2 text-center tabular-nums ${c.FI ? 'text-alerta' : ''}`}>{c.FI}</td>
                    <td className="p-2 text-center tabular-nums">{c.FJ}</td>
                    <td className="p-2 text-center tabular-nums">{pct === null ? '—' : `${pct}%`}</td>
                    <td className={`p-2 text-center font-semibold tabular-nums ${n !== null && n < NOTA_MINIMA ? 'text-alerta' : ''}`}>{fmt(n)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
