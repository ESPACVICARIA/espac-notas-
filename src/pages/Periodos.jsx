import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { traerTodo } from '../lib/exportar'
import { ordenarEstudiantes, mostrarNombre } from '../lib/planilla'
import { colorDe, IconoGrupo } from '../components/GruposCentros'

const ESTADOS_PERIODO = {
  planeacion: { t: 'En planeación', c: 'bg-slate-100 text-slate-700' },
  abierto: { t: 'Abierto', c: 'bg-green-100 text-green-800' },
  cerrado: { t: 'Cerrado', c: 'bg-slate-200 text-slate-600' },
}
const ESTADOS_MATRICULA = {
  inscrito: { t: 'Inscrito', c: 'bg-blue-50 text-blue-800 border-blue-200' },
  aprobado: { t: 'Aprobado', c: 'bg-green-50 text-green-800 border-green-200' },
  reprobado: { t: 'Reprobado', c: 'bg-red-50 text-red-800 border-red-200' },
  aplazado: { t: 'Aplazado', c: 'bg-amber-50 text-amber-800 border-amber-200' },
  retirado: { t: 'Retirado', c: 'bg-slate-100 text-slate-600 border-slate-200' },
}
const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
const SIN_CENTRO = 'ninguno'
const letra = (n) => `Grupo ${String.fromCharCode(65 + n)}`
const falla = (r) => { if (r?.error) throw r.error; return r }
const fechaCorta = (f) => (f ? new Date(`${f}T12:00:00`).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')

function Dialogo({ titulo, subtitulo, cerrar, children, ancho = 'max-w-lg' }) {
  const caja = useRef(null)
  const alCerrar = useRef(cerrar)
  alCerrar.current = cerrar
  useEffect(() => {
    caja.current?.querySelector('input, select, textarea, button:not([data-cerrar])')?.focus()
    const esc = (e) => e.key === 'Escape' && alCerrar.current()
    window.addEventListener('keydown', esc)
    const previo = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', esc); document.body.style.overflow = previo }
  }, [])
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={cerrar}>
      <div ref={caja} role="dialog" aria-modal="true" aria-labelledby="dlg-titulo" onClick={(e) => e.stopPropagation()}
        className={`flex max-h-[92vh] w-full ${ancho} flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl`}>
        <div className="flex items-start gap-3 border-b border-slate-100 px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2 id="dlg-titulo" className="font-serif text-xl font-semibold leading-tight">{titulo}</h2>
            {subtitulo && <p className="mt-0.5 text-sm text-slate-500">{subtitulo}</p>}
          </div>
          <button data-cerrar onClick={cerrar} aria-label="Cerrar" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-slate-100">
            <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M5 5l10 10M15 5 5 15" /></svg>
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  )
}

// Formulario para crear o editar un grupo
function FormGrupo({ grupo, periodo, centros, cohortes, formadores, grupos, guardar, cerrar }) {
  const nuevo = !grupo
  const [f, setF] = useState(() => grupo
    ? { centro: grupo.centro_id ?? SIN_CENTRO, semestre: grupo.semestre, nombre: grupo.nombre, formador: grupo.formador_id ?? '', dia: grupo.dia ?? '', horario: grupo.horario ?? '', cupo: grupo.cupo ?? '' }
    : { centro: centros[0]?.id ?? SIN_CENTRO, semestre: 1, nombre: '', formador: '', dia: 'Sábado', horario: '', cupo: '', origen: 'nueva', cohorte: '' })
  const [error, setError] = useState('')
  const [trabajando, setTrabajando] = useState(false)
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }))

  // Nombre sugerido: la siguiente letra libre en ese centro y semestre
  const sugerido = useMemo(() => {
    const usados = new Set(grupos.filter((g) => g.id !== grupo?.id && String(g.centro_id ?? SIN_CENTRO) === String(f.centro) && g.semestre === Number(f.semestre)).map((g) => g.nombre))
    let n = 0; while (usados.has(letra(n))) n++
    return letra(n)
  }, [grupos, f.centro, f.semestre, grupo])
  const libres = cohortes.filter((c) => !grupos.some((g) => g.cohorte_id === c.id))

  async function enviar(e) {
    e.preventDefault()
    const nombre = (f.nombre || sugerido).trim()
    if (grupos.some((g) => g.id !== grupo?.id && String(g.centro_id ?? SIN_CENTRO) === String(f.centro) && g.semestre === Number(f.semestre) && g.nombre.toLowerCase() === nombre.toLowerCase())) {
      setError(`Ya existe «${nombre}» en ese centro y semestre.`); return
    }
    if (nuevo && f.origen === 'continua' && !f.cohorte) { setError('Elige la cohorte que continúa.'); return }
    const cupo = f.cupo === '' ? null : Number(f.cupo)
    if (cupo !== null && (!Number.isInteger(cupo) || cupo < 1 || cupo > 200)) { setError('El cupo debe ser un número entre 1 y 200.'); return }
    setTrabajando(true); setError('')
    try {
      await guardar({
        nombre, centro_id: f.centro === SIN_CENTRO ? null : Number(f.centro), semestre: Number(f.semestre),
        formador_id: f.formador || null, dia: f.dia || null, horario: f.horario.trim() || null, cupo,
      }, nuevo ? { origen: f.origen, cohorte: f.cohorte } : null)
      cerrar()
    } catch (err) {
      setError(err.message); setTrabajando(false)
    }
  }

  return (
    <form onSubmit={enviar} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="etiqueta" htmlFor="g-centro">Centro</label>
          <select id="g-centro" className="campo" value={f.centro} onChange={(e) => set('centro', e.target.value)}>
            {centros.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            <option value={SIN_CENTRO}>Sin centro</option>
          </select>
        </div>
        <div>
          <label className="etiqueta" htmlFor="g-sem">Semestre del plan</label>
          <select id="g-sem" className="campo" value={f.semestre} onChange={(e) => set('semestre', Number(e.target.value))}>
            {[1, 2, 3, 4].map((s) => <option key={s} value={s}>Semestre {s}</option>)}
          </select>
        </div>
        <div>
          <label className="etiqueta" htmlFor="g-nombre">Nombre del grupo</label>
          <input id="g-nombre" className="campo" maxLength={60} placeholder={sugerido} value={f.nombre} onChange={(e) => set('nombre', e.target.value)} />
        </div>
        <div>
          <label className="etiqueta" htmlFor="g-form">Formador del semestre</label>
          <select id="g-form" className="campo" value={f.formador} onChange={(e) => set('formador', e.target.value)}>
            <option value="">Sin asignar</option>
            {formadores.map((p) => <option key={p.id} value={p.id}>{p.nombre || p.correo}</option>)}
          </select>
        </div>
        <div>
          <label className="etiqueta" htmlFor="g-dia">Día de encuentro</label>
          <select id="g-dia" className="campo" value={f.dia} onChange={(e) => set('dia', e.target.value)}>
            <option value="">Sin definir</option>
            {DIAS.map((d) => <option key={d}>{d}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-[1fr_6rem] gap-3">
          <div>
            <label className="etiqueta" htmlFor="g-hora">Horario</label>
            <input id="g-hora" className="campo" maxLength={60} placeholder="2:00 a 6:00 p. m." value={f.horario} onChange={(e) => set('horario', e.target.value)} />
          </div>
          <div>
            <label className="etiqueta" htmlFor="g-cupo">Cupo</label>
            <input id="g-cupo" className="campo" inputMode="numeric" placeholder="30" value={f.cupo} onChange={(e) => set('cupo', e.target.value.replace(/\D/g, ''))} />
          </div>
        </div>
      </div>

      {nuevo && (
        <fieldset className="rounded-xl border border-slate-200 p-4">
          <legend className="px-1 text-[13px] font-semibold text-slate-600">¿Quiénes conforman el grupo?</legend>
          <label className="flex items-start gap-2 text-sm">
            <input type="radio" className="mt-0.5" name="origen" checked={f.origen === 'nueva'} onChange={() => set('origen', 'nueva')} />
            <span><strong>Grupo nuevo</strong> (estudiantes que ingresan, o se arma desde cero). Luego matriculas a los estudiantes.</span>
          </label>
          <label className="mt-2 flex items-start gap-2 text-sm">
            <input type="radio" className="mt-0.5" name="origen" checked={f.origen === 'continua'} onChange={() => set('origen', 'continua')} disabled={!libres.length} />
            <span><strong>Continúa una cohorte</strong> que ya existe (avanza de semestre). Sus estudiantes activos quedan matriculados.</span>
          </label>
          {f.origen === 'continua' && (
            <select className="campo mt-3" aria-label="Cohorte que continúa" value={f.cohorte} onChange={(e) => {
              const c = cohortes.find((x) => String(x.id) === e.target.value)
              // Sugiere su centro y el semestre siguiente (o el mismo, si es el periodo actual)
              setF((x) => ({ ...x, cohorte: e.target.value, ...(c ? { centro: c.centro_id ?? SIN_CENTRO, semestre: c.semestre_actual ? Math.min(4, c.semestre_actual + (periodo.actual ? 0 : 1)) : x.semestre } : {}) }))
            }}>
              <option value="">Elige la cohorte…</option>
              {libres.map((c) => <option key={c.id} value={c.id}>{c.nombre}{c.semestre_actual ? ` · iba en semestre ${c.semestre_actual}` : ''}</option>)}
            </select>
          )}
        </fieldset>
      )}

      {periodo.actual && <p className="rounded-lg bg-cielo px-3 py-2 text-xs text-tinta">Es el periodo actual: el formador queda asignado de inmediato y podrá digitar las notas de este grupo.</p>}
      {error && <p className="text-sm text-alerta" role="alert">{error}</p>}
      <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
        <button className="btn" disabled={trabajando}>{trabajando ? 'Guardando…' : nuevo ? 'Crear grupo' : 'Guardar cambios'}</button>
        <button type="button" className="btn-sec" onClick={cerrar}>Cancelar</button>
      </div>
    </form>
  )
}

// Detalle de un grupo: sus matriculados, estados y cambios de grupo
function DetalleGrupo({ grupo, periodo, grupos, estudiantes, matriculas, nombreGrupo, orden, alCambiar, editar, eliminar }) {
  const [buscar, setBuscar] = useState('')
  const [agregar, setAgregar] = useState(false)
  const [sel, setSel] = useState(new Set())
  const [trabajando, setTrabajando] = useState(false)
  const [aviso, setAviso] = useState(null)
  const porId = useMemo(() => new Map(estudiantes.map((e) => [e.id, e])), [estudiantes])
  const propias = matriculas.filter((m) => m.grupo_id === grupo.id)
  const filas = ordenarEstudiantes(propias.map((m) => ({ ...porId.get(m.estudiante_id), m })).filter((x) => x.id), orden)
  const conMatricula = new Set(matriculas.filter((m) => m.estado !== 'aplazado').map((m) => m.estudiante_id))
  const q = buscar.trim().toLowerCase()
  const candidatos = ordenarEstudiantes(estudiantes.filter((e) => e.estado !== 'graduado' && !conMatricula.has(e.id)
    && (!q || e.nombre_completo.toLowerCase().includes(q) || (e.numero_id ?? '').includes(q))), orden)
    .sort((a, b) => (b.centro_id === grupo.centro_id) - (a.centro_id === grupo.centro_id))

  async function hacer(fn, ok) {
    setTrabajando(true); setAviso(null)
    try { await fn(); setAviso({ ok: true, t: ok }); await alCambiar() } catch (e) { setAviso({ ok: false, t: e.message }) }
    setTrabajando(false)
  }
  const cambiarEstado = (m, estado) => hacer(
    () => supabase.from('matriculas').update({ estado, grupo_id: estado === 'aplazado' ? null : m.grupo_id }).eq('id', m.id).then(falla),
    estado === 'aplazado' ? 'Matrícula aplazada: sale del grupo y queda en «Sin matrícula».' : `Estado cambiado a ${ESTADOS_MATRICULA[estado].t.toLowerCase()}.`)
  const mover = (m, destino) => hacer(
    () => supabase.from('matriculas').update({ grupo_id: Number(destino) }).eq('id', m.id).then(falla),
    `Cambiado a ${nombreGrupo(grupos.find((g) => g.id === Number(destino)))}.`)
  const matricular = () => hacer(async () => {
    const filasNuevas = [...sel].map((id) => ({ periodo_id: periodo.id, estudiante_id: id, grupo_id: grupo.id, estado: 'inscrito' }))
    await supabase.from('matriculas').upsert(filasNuevas, { onConflict: 'periodo_id,estudiante_id' }).then(falla)
    setSel(new Set()); setAgregar(false)
  }, `${sel.size} estudiante(s) matriculado(s).`)

  const lleno = grupo.cupo && filas.filter((x) => x.m.estado !== 'retirado').length >= grupo.cupo

  return (
    <div className="space-y-5">
      <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        {[['Formador', grupo.formador], ['Encuentro', [grupo.dia, grupo.horario].filter(Boolean).join(' · ') || '—'], ['Cohorte', grupo.cohorte],
          ['Matriculados', `${filas.filter((x) => x.m.estado !== 'retirado').length}${grupo.cupo ? ` de ${grupo.cupo}` : ''}`]].map(([k, v]) => (
          <div key={k} className="rounded-xl bg-slate-50 px-3 py-2">
            <dt className="text-xs text-slate-500">{k}</dt>
            <dd className={`font-semibold ${k === 'Formador' && !grupo.formador_id ? 'text-amber-700' : 'text-tinta'}`}>{v || 'Sin asignar'}</dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-wrap gap-2">
        <button className="btn" onClick={() => setAgregar(!agregar)} disabled={periodo.estado === 'cerrado'}>{agregar ? 'Cerrar' : 'Matricular estudiantes'}</button>
        <button className="btn-sec" onClick={editar}>Editar grupo</button>
        {!propias.length && <button className="ml-auto text-sm text-alerta underline" onClick={eliminar}>Eliminar grupo</button>}
      </div>
      {aviso && <p role="status" className={`text-sm ${aviso.ok ? 'text-green-700' : 'text-alerta'}`}>{aviso.t}</p>}

      {agregar && (
        <div className="rounded-xl border-2 border-mariano/30 bg-cielo/40 p-4">
          <p className="mb-2 text-sm font-semibold">Estudiantes sin matrícula en {periodo.nombre} (primero los de este centro)</p>
          {lleno && <p className="mb-2 text-xs font-semibold text-amber-700">El grupo ya llegó a su cupo; puedes matricular de todos modos.</p>}
          <input className="campo mb-2" placeholder="Buscar por nombre o documento" value={buscar} onChange={(e) => setBuscar(e.target.value)} aria-label="Buscar estudiante" />
          <ul className="max-h-64 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200 bg-white">
            {candidatos.slice(0, 200).map((e) => (
              <li key={e.id}>
                <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-slate-50">
                  <input type="checkbox" checked={sel.has(e.id)} onChange={() => setSel((s) => { const n = new Set(s); n.has(e.id) ? n.delete(e.id) : n.add(e.id); return n })} />
                  <span className="min-w-0 flex-1 truncate">{mostrarNombre(e, orden)}</span>
                  <span className="shrink-0 text-xs text-slate-400">{e.aplazado ? 'aplazado' : e.anio_ingreso ? `ingresó ${e.anio_ingreso}` : ''}</span>
                </label>
              </li>
            ))}
            {!candidatos.length && <li className="px-3 py-6 text-center text-sm text-slate-500">No hay estudiantes sin matrícula{q ? ' con esa búsqueda' : ''}.</li>}
          </ul>
          <button className="btn mt-3" disabled={!sel.size || trabajando} onClick={matricular}>{trabajando ? 'Matriculando…' : `Matricular ${sel.size || ''} en este grupo`}</button>
        </div>
      )}

      {!filas.length ? (
        <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">Aún no hay estudiantes en este grupo.</p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
          {filas.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center gap-2 px-3 py-2.5">
              <Link to={`/estudiantes/${e.id}`} className="min-w-0 basis-full truncate text-sm font-medium text-mariano hover:underline sm:basis-auto sm:flex-1">{mostrarNombre(e, orden)}</Link>
              <select aria-label={`Estado de ${e.nombre_completo}`} value={e.m.estado} disabled={trabajando || periodo.estado === 'cerrado'}
                onChange={(ev) => cambiarEstado(e.m, ev.target.value)}
                className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${ESTADOS_MATRICULA[e.m.estado].c}`}>
                {Object.entries(ESTADOS_MATRICULA).map(([k, v]) => <option key={k} value={k}>{v.t}</option>)}
              </select>
              {grupos.length > 1 && (
                <select aria-label={`Cambiar de grupo a ${e.nombre_completo}`} value="" disabled={trabajando || periodo.estado === 'cerrado'}
                  onChange={(ev) => ev.target.value && mover(e.m, ev.target.value)}
                  className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs text-slate-600">
                  <option value="">Cambiar de grupo…</option>
                  {grupos.filter((g) => g.id !== grupo.id).map((g) => <option key={g.id} value={g.id}>{nombreGrupo(g)}</option>)}
                </select>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function Periodos({ perfil }) {
  const [periodos, setPeriodos] = useState([])
  const [verId, setVerId] = useState(null)
  const [centros, setCentros] = useState([])
  const [cohortes, setCohortes] = useState([])
  const [formadores, setFormadores] = useState([])
  const [estudiantes, setEstudiantes] = useState([])
  const [grupos, setGrupos] = useState([])
  const [matriculas, setMatriculas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [falta, setFalta] = useState(false)
  const [aviso, setAviso] = useState(null)
  const [dialogo, setDialogo] = useState(null) // { tipo: 'nuevo' | 'editar' | 'ver', grupo }
  const [trabajando, setTrabajando] = useState(false)

  async function cargarBase() {
    const [p, ce, co, fo, es] = await Promise.all([
      supabase.from('periodos').select('*').order('anio', { ascending: false }).order('numero', { ascending: false }),
      supabase.from('centros').select('id, nombre').order('nombre'),
      supabase.from('cohortes').select('id, nombre, anio, centro_id, semestre_actual').order('anio', { ascending: false }).order('nombre'),
      supabase.from('perfiles').select('id, nombre, correo, rol').in('rol', ['admin', 'formador']).order('nombre'),
      traerTodo(() => supabase.from('estudiantes').select('id, nombre_completo, numero_id, estado, centro_id, cohorte_id, anio_ingreso').order('id')),
    ])
    if (p.error) { setFalta(/periodos/.test(p.error.message)); setCargando(false); return null }
    setPeriodos(p.data ?? []); setCentros(ce.data ?? []); setCohortes(co.data ?? []); setFormadores(fo.data ?? []); setEstudiantes(es ?? [])
    return p.data ?? []
  }
  async function cargarPeriodo(id) {
    if (!id) { setGrupos([]); setMatriculas([]); return }
    const [g, m] = await Promise.all([
      supabase.from('grupos').select('*').eq('periodo_id', id),
      traerTodo(() => supabase.from('matriculas').select('*').eq('periodo_id', id).order('id')),
    ])
    setGrupos(g.data ?? []); setMatriculas(m ?? [])
  }
  async function recargar(id = verId) {
    const ps = await cargarBase()
    if (ps) await cargarPeriodo(id)
  }
  useEffect(() => {
    (async () => {
      const ps = await cargarBase()
      if (ps) {
        const id = (ps.find((x) => x.actual) ?? ps[0])?.id ?? null
        setVerId(id); await cargarPeriodo(id)
      }
      setCargando(false)
    })()
  }, [])

  const periodo = periodos.find((p) => p.id === verId)
  const nombreDe = (id) => { const p = formadores.find((x) => x.id === id); return p ? (p.nombre || p.correo) : null }
  const centroDe = (id) => centros.find((c) => c.id === id)?.nombre
  const nombreGrupo = (g) => g ? `${centroDe(g.centro_id) ?? 'Sin centro'} · S${g.semestre} · ${g.nombre}` : ''
  const gruposVista = grupos.map((g) => {
    const ms = matriculas.filter((m) => m.grupo_id === g.id && m.estado !== 'retirado')
    return { ...g, formador: nombreDe(g.formador_id), cohorte: cohortes.find((c) => c.id === g.cohorte_id)?.nombre, inscritos: ms.length }
  })
  const secciones = [...centros, { id: null, nombre: 'Sin centro' }]
    .map((c) => ({ centro: c, grupos: gruposVista.filter((g) => (g.centro_id ?? null) === c.id).sort((a, b) => a.semestre - b.semestre || a.nombre.localeCompare(b.nombre)) }))
    .filter((x) => x.grupos.length)
  const matriculadosIds = new Set(matriculas.filter((m) => m.estado !== 'aplazado').map((m) => m.estudiante_id))
  const sinMatricula = estudiantes.filter((e) => e.estado === 'activo' && !matriculadosIds.has(e.id))
  const aplazados = new Set(matriculas.filter((m) => m.estado === 'aplazado').map((m) => m.estudiante_id))
  const estudiantesConMarca = estudiantes.map((e) => (aplazados.has(e.id) ? { ...e, aplazado: true } : e))

  async function nuevoPeriodo() {
    const u = periodos[0]
    const anio = u ? (u.numero === 1 ? u.anio : u.anio + 1) : new Date().getFullYear()
    const numero = u ? (u.numero === 1 ? 2 : 1) : (new Date().getMonth() < 6 ? 1 : 2)
    if (!confirm(`¿Crear el periodo ${anio}-${numero}? Quedará en planeación hasta que lo vuelvas actual.`)) return
    setTrabajando(true)
    const { data, error } = await supabase.from('periodos').insert({
      nombre: `${anio}-${numero}`, anio, numero, estado: 'planeacion',
      inicio: `${anio}-${numero === 1 ? '02-01' : '08-01'}`, fin: `${anio}-${numero === 1 ? '06-30' : '12-15'}`,
    }).select('id').single()
    setTrabajando(false)
    if (error) { setAviso({ ok: false, t: error.message }); return }
    setAviso({ ok: true, t: `Periodo ${anio}-${numero} creado. Ahora arma sus grupos.` })
    setVerId(data.id); await recargar(data.id)
  }
  async function guardarPeriodo(cambios) {
    const { error } = await supabase.from('periodos').update(cambios).eq('id', periodo.id)
    if (error) setAviso({ ok: false, t: error.message }); else await recargar()
  }
  async function hacerActual() {
    if (!confirm(`¿Volver actual el periodo ${periodo.nombre}?\n\nCada cohorte con grupo en este periodo pasa a su nuevo semestre y centro, los formadores quedan asignados y los estudiantes matriculados pasan a su grupo. Digitar notas y el portal mostrarán este periodo.`)) return
    setTrabajando(true)
    const { data, error } = await supabase.rpc('activar_periodo', { p_periodo: periodo.id })
    setTrabajando(false)
    setAviso(error ? { ok: false, t: error.message } : { ok: true, t: `${periodo.nombre} es ahora el periodo actual (${data.grupos} grupos, ${data.matriculas} matrículas aplicadas).` })
    await recargar()
  }

  async function guardarGrupo(datos, nuevo) {
    if (dialogo.tipo === 'editar') {
      await supabase.from('grupos').update(datos).eq('id', dialogo.grupo.id).then(falla)
      setAviso({ ok: true, t: `${datos.nombre} actualizado.` })
    } else {
      let cohorteId = nuevo.origen === 'continua' ? Number(nuevo.cohorte) : null
      if (!cohorteId) {
        const nombreCohorte = `${periodo.nombre} · ${centroDe(datos.centro_id) ?? 'Sin centro'} · ${datos.nombre}`
        const { data } = await supabase.from('cohortes').insert({ nombre: nombreCohorte, anio: periodo.anio, centro_id: datos.centro_id, semestre_actual: periodo.actual ? datos.semestre : null }).select('id').single().then(falla)
        cohorteId = data.id
      }
      const { data: g } = await supabase.from('grupos').insert({ ...datos, periodo_id: periodo.id, cohorte_id: cohorteId }).select('id').single().then(falla)
      if (nuevo.origen === 'continua') {
        // Los estudiantes activos de la cohorte que aún no tienen matrícula en el periodo
        const ids = estudiantes.filter((e) => e.cohorte_id === cohorteId && e.estado === 'activo' && !matriculas.some((m) => m.estudiante_id === e.id)).map((e) => e.id)
        if (ids.length) await supabase.from('matriculas').insert(ids.map((id) => ({ periodo_id: periodo.id, estudiante_id: id, grupo_id: g.id, estado: 'inscrito' }))).then(falla)
        setAviso({ ok: true, t: `${datos.nombre} creado con ${ids.length} estudiante(s) matriculado(s).` })
      } else setAviso({ ok: true, t: `${datos.nombre} creado. Ábrelo para matricular a sus estudiantes.` })
    }
    await recargar()
  }
  async function eliminarGrupo(g) {
    if (!confirm(`¿Eliminar ${nombreGrupo(g)}? No tiene estudiantes.`)) return
    const { error } = await supabase.from('grupos').delete().eq('id', g.id)
    setDialogo(null)
    setAviso(error ? { ok: false, t: error.message } : { ok: true, t: 'Grupo eliminado.' })
    await recargar()
  }

  if (cargando) return <p className="text-slate-500">Cargando…</p>
  if (falta) {
    return (
      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
        <h1 className="titulo-pagina">Periodos y grupos</h1>
        <p className="mt-2 text-sm text-amber-900">Falta instalar <strong>periodos.sql</strong> en Supabase (SQL Editor). Al ejecutarlo se crea el periodo actual con los grupos y matrículas que hay hoy.</p>
      </section>
    )
  }

  const grupoAbierto = dialogo?.grupo && gruposVista.find((g) => g.id === dialogo.grupo.id)

  return (
    <section>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="antetitulo">Administración académica</p>
          <h1 className="titulo-pagina mt-1">Periodos y grupos</h1>
          <p className="subtitulo-pagina">Cada semestre se arman los grupos por centro, se asigna su formador y se matricula a los estudiantes.</p>
        </div>
        <button className="btn-sec" onClick={nuevoPeriodo} disabled={trabajando}>+ Nuevo periodo</button>
      </header>

      {/* Periodos */}
      <div role="tablist" aria-label="Periodos" className="-mx-1 mb-4 overflow-x-auto px-1 pb-1">
        <div className="flex w-max gap-2">
          {periodos.map((p) => (
            <button key={p.id} role="tab" aria-selected={p.id === verId} onClick={async () => { setVerId(p.id); setAviso(null); await cargarPeriodo(p.id) }}
              className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-left transition ${p.id === verId ? 'border-tinta bg-tinta text-white shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
              <span className="font-serif text-lg font-semibold">{p.nombre}</span>
              {p.actual && <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${p.id === verId ? 'bg-oro text-white' : 'bg-amber-100 text-oro'}`}>Actual</span>}
              {!p.actual && <span className={`text-xs ${p.id === verId ? 'text-blue-100' : 'text-slate-500'}`}>{ESTADOS_PERIODO[p.estado].t}</span>}
            </button>
          ))}
        </div>
      </div>

      {aviso && <p role="status" className={`mb-4 rounded-lg px-3 py-2 text-sm ${aviso.ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-alerta'}`}>{aviso.t}</p>}

      {!periodo ? (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">Crea el primer periodo para empezar.</p>
      ) : (
        <>
          <div className="mb-6 grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:grid-cols-[1fr_auto]">
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="etiqueta" htmlFor="p-ini">Inicio</label>
                <input id="p-ini" type="date" className="campo" defaultValue={periodo.inicio ?? ''} key={`i${periodo.id}`} onBlur={(e) => e.target.value !== (periodo.inicio ?? '') && guardarPeriodo({ inicio: e.target.value || null })} />
              </div>
              <div>
                <label className="etiqueta" htmlFor="p-fin">Fin</label>
                <input id="p-fin" type="date" className="campo" defaultValue={periodo.fin ?? ''} key={`f${periodo.id}`} onBlur={(e) => e.target.value !== (periodo.fin ?? '') && guardarPeriodo({ fin: e.target.value || null })} />
              </div>
              <div>
                <label className="etiqueta" htmlFor="p-est">Estado</label>
                <select id="p-est" className="campo" value={periodo.estado} onChange={(e) => guardarPeriodo({ estado: e.target.value })}>
                  {Object.entries(ESTADOS_PERIODO).map(([k, v]) => <option key={k} value={k}>{v.t}</option>)}
                </select>
              </div>
            </div>
            <div className="flex items-end">
              {periodo.actual
                ? <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-oro">★ Periodo actual · {fechaCorta(periodo.inicio)} a {fechaCorta(periodo.fin)}</p>
                : <button className="btn" onClick={hacerActual} disabled={trabajando || !grupos.length} title={!grupos.length ? 'Primero crea sus grupos' : ''}>Volver periodo actual</button>}
            </div>
          </div>

          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[['Grupos', grupos.length, ''], ['Matriculados', matriculas.filter((m) => !['aplazado', 'retirado'].includes(m.estado)).length, ''],
              ['Grupos sin formador', grupos.filter((g) => !g.formador_id).length, grupos.some((g) => !g.formador_id) ? 'text-amber-700' : ''],
              ['Activos sin matrícula', sinMatricula.length, sinMatricula.length ? 'text-alerta' : '']].map(([t, n, c]) => (
              <div key={t} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className={`font-serif text-3xl font-semibold tabular-nums ${c || 'text-tinta'}`}>{n}</p>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t}</p>
              </div>
            ))}
          </div>

          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-serif text-2xl font-semibold">Grupos de {periodo.nombre}</h2>
            <button className="btn" onClick={() => setDialogo({ tipo: 'nuevo' })} disabled={periodo.estado === 'cerrado'}>+ Nuevo grupo</button>
          </div>

          {!secciones.length ? (
            <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
              Este periodo aún no tiene grupos. Crea uno por cada centro y semestre (Grupo A, Grupo B…).
            </p>
          ) : (
            <div className="space-y-8">
              {secciones.map(({ centro, grupos: gs }) => (
                <section key={centro.id ?? 'sin'} aria-label={centro.nombre}>
                  <h3 className="mb-3 font-serif text-xl font-semibold">{centro.id ? `Centro ${centro.nombre}` : centro.nombre}
                    <span className="ml-3 font-sans text-sm font-normal text-slate-500">{gs.length} grupo(s) · {gs.reduce((n, g) => n + g.inscritos, 0)} matriculados</span>
                  </h3>
                  <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {gs.map((g) => {
                      const col = colorDe(g.cohorte_id)
                      const pct = g.cupo ? Math.min(100, Math.round((g.inscritos / g.cupo) * 100)) : null
                      return (
                        <li key={g.id}>
                          <button onClick={() => setDialogo({ tipo: 'ver', grupo: g })}
                            className="group flex h-full w-full flex-col rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-mariano/20">
                            <span className="flex items-center gap-3">
                              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full" style={{ background: col.fondo, color: col.tinta }}><IconoGrupo className="h-6 w-6" /></span>
                              <span className="min-w-0">
                                <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Semestre {g.semestre}</span>
                                <span className="block truncate font-serif text-lg font-semibold leading-tight text-tinta">{g.nombre}</span>
                              </span>
                            </span>
                            <span className="mt-4 space-y-1 text-sm">
                              <span className={`flex items-center gap-2 ${g.formador ? 'text-slate-700' : 'font-semibold text-amber-700'}`}>
                                <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="10" cy="7" r="3" /><path d="M4 17c1-3 3.5-4.5 6-4.5s5 1.5 6 4.5" /></svg>
                                {g.formador ?? 'Sin formador asignado'}
                              </span>
                              {(g.dia || g.horario) && (
                                <span className="flex items-center gap-2 text-slate-500">
                                  <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="10" cy="10" r="7" /><path d="M10 6v4l3 2" /></svg>
                                  {[g.dia, g.horario].filter(Boolean).join(' · ')}
                                </span>
                              )}
                            </span>
                            <span className="mt-auto block pt-4">
                              <span className="flex items-baseline justify-between text-sm">
                                <span><strong className="tabular-nums">{g.inscritos}</strong> matriculado(s)</span>
                                {g.cupo && <span className="text-xs text-slate-500">cupo {g.cupo}</span>}
                              </span>
                              {pct !== null && (
                                <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-slate-100">
                                  <span className={`block h-full rounded-full ${pct >= 100 ? 'bg-alerta' : 'bg-mariano'}`} style={{ width: `${pct}%` }} />
                                </span>
                              )}
                            </span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </section>
              ))}
            </div>
          )}

          {sinMatricula.length > 0 && (
            <details className="mt-8 rounded-2xl border border-red-200 bg-red-50/50 p-5">
              <summary className="cursor-pointer font-semibold text-alerta">
                {sinMatricula.length} estudiante(s) activo(s) sin matrícula en {periodo.nombre}
              </summary>
              <p className="mt-2 text-sm text-slate-600">Están activos pero no tienen grupo en este periodo (por ejemplo, aplazados que vuelven o estudiantes nuevos). Ábre un grupo y usa «Matricular estudiantes».</p>
              <ul className="mt-3 grid gap-1 text-sm sm:grid-cols-2 lg:grid-cols-3">
                {ordenarEstudiantes(sinMatricula, 'apellidos').map((e) => (
                  <li key={e.id} className="truncate">
                    <Link to={`/estudiantes/${e.id}`} className="text-mariano hover:underline">{mostrarNombre(e, 'apellidos')}</Link>
                    {aplazados.has(e.id) && <span className="ml-1 text-xs text-amber-700">(aplazado)</span>}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}

      {dialogo?.tipo === 'nuevo' && (
        <Dialogo titulo="Nuevo grupo" subtitulo={`Periodo ${periodo.nombre}`} cerrar={() => setDialogo(null)}>
          <FormGrupo periodo={periodo} centros={centros} cohortes={cohortes} formadores={formadores} grupos={grupos}
            guardar={guardarGrupo} cerrar={() => setDialogo(null)} />
        </Dialogo>
      )}
      {dialogo?.tipo === 'editar' && grupoAbierto && (
        <Dialogo titulo={`Editar ${grupoAbierto.nombre}`} subtitulo={nombreGrupo(grupoAbierto)} cerrar={() => setDialogo({ tipo: 'ver', grupo: grupoAbierto })}>
          <FormGrupo grupo={grupoAbierto} periodo={periodo} centros={centros} cohortes={cohortes} formadores={formadores} grupos={grupos}
            guardar={guardarGrupo} cerrar={() => setDialogo({ tipo: 'ver', grupo: grupoAbierto })} />
        </Dialogo>
      )}
      {dialogo?.tipo === 'ver' && grupoAbierto && (
        <Dialogo ancho="max-w-3xl" titulo={`${grupoAbierto.nombre} · Semestre ${grupoAbierto.semestre}`}
          subtitulo={`${centroDe(grupoAbierto.centro_id) ? `Centro ${centroDe(grupoAbierto.centro_id)}` : 'Sin centro'} · Periodo ${periodo.nombre}`} cerrar={() => setDialogo(null)}>
          <DetalleGrupo grupo={grupoAbierto} periodo={periodo} grupos={gruposVista} estudiantes={estudiantesConMarca} matriculas={matriculas}
            nombreGrupo={nombreGrupo} orden="apellidos" alCambiar={() => recargar()}
            editar={() => setDialogo({ tipo: 'editar', grupo: grupoAbierto })} eliminar={() => eliminarGrupo(grupoAbierto)} />
        </Dialogo>
      )}
    </section>
  )
}
