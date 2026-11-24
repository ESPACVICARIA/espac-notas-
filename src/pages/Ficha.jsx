import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { fmt } from '../lib/notas'
import { resumen, Camino, TablasSemestres } from '../components/Itinerario'
import FotoEstudiante from '../components/FotoEstudiante'
import { ordenarEstudiantes, mostrarNombre } from '../lib/planilla'

// El listado de Estudiantes guarda aquí el orden en que se ve (con sus filtros)
const CLAVE_RECORRIDO = 'espac-recorrido-estudiantes'
function leerRecorrido() {
  try { const r = JSON.parse(sessionStorage.getItem(CLAVE_RECORRIDO)); return Array.isArray(r) ? r : [] } catch { return [] }
}

// Semestre elegido para ver las notas: se mantiene al pasar de un estudiante a otro (solo en esta pestaña)
const CLAVE_SEMESTRE = 'espac-semestre-ficha'
function leerSemestre() {
  try { return sessionStorage.getItem(CLAVE_SEMESTRE) } catch { return null }
}

const Flecha = ({ d }) => (
  <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
)

const fecha = (f) => (f ? new Date(f + 'T00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' }) : '—')

export default function Ficha({ perfil }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const admin = perfil?.rol === 'admin'
  const [est, setEst] = useState(null)
  const [espacios, setEspacios] = useState([])
  const [notas, setNotas] = useState({})
  const [pestana, setPestana] = useState('itinerario')
  const [aviso, setAviso] = useState(null)
  const [formadores, setFormadores] = useState({})
  const [acceso, setAcceso] = useState(null)
  const [recorrido, setRecorrido] = useState(leerRecorrido)
  const [semElegido, setSemElegido] = useState(leerSemestre) // null = el semestre actual de la cohorte
  const barraSem = useRef(null)
  // En celular la barra de semestres se desliza sola para mostrar el elegido (sin mover la página)
  useEffect(() => {
    const c = barraSem.current, b = c?.querySelector('[aria-pressed="true"]')
    if (c && b) c.scrollLeft = b.offsetLeft - (c.clientWidth - b.offsetWidth) / 2
  }, [semElegido, pestana, est?.id, espacios.length])
  function elegirSemestre(v) {
    setSemElegido(v)
    try { sessionStorage.setItem(CLAVE_SEMESTRE, v) } catch { /* sin almacenamiento: vale para esta visita */ }
  }

  // Si la ficha se abrió sin pasar por el listado (enlace directo o recarga), se recorre la cohorte del estudiante
  useEffect(() => {
    if (!est || recorrido.some((r) => r.id === est.id)) return
    if (!est.cohorte_id) { setRecorrido([]); return }
    supabase.from('estudiantes').select('id, nombre_completo').eq('cohorte_id', est.cohorte_id).then(({ data }) => {
      setRecorrido(ordenarEstudiantes(data ?? [], 'apellidos').map((e) => ({ id: e.id, nombre: mostrarNombre(e, 'apellidos') })))
    })
  }, [est]) // eslint-disable-line react-hooks/exhaustive-deps

  const pos = useMemo(() => recorrido.findIndex((r) => r.id === id), [recorrido, id])
  const anterior = pos > 0 ? recorrido[pos - 1] : null
  const siguiente = pos >= 0 && pos < recorrido.length - 1 ? recorrido[pos + 1] : null
  const ir = (r) => r && navigate(`/estudiantes/${r.id}`)

  // Flechas ← → del teclado, siempre que no se esté escribiendo en un campo
  useEffect(() => {
    const tecla = (e) => {
      if (e.altKey || e.ctrlKey || e.metaKey || e.target.closest?.('input, textarea, select, [contenteditable]')) return
      if (e.key === 'ArrowRight' && siguiente) ir(siguiente)
      if (e.key === 'ArrowLeft' && anterior) ir(anterior)
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [anterior, siguiente]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // Al pasar a otro estudiante se limpia lo del anterior y se descartan respuestas que lleguen tarde
    let vigente = true
    setAviso(null); setAcceso(null); setFormadores({}); setNotas({})
    window.scrollTo({ top: 0 })
    supabase.from('estudiantes').select('*, cohortes(nombre, semestre_actual), centros!estudiantes_centro_id_fkey(nombre)').eq('id', id).single().then(async ({ data }) => {
      if (!vigente) return
      setEst(data)
      if (data) {
        // Los formadores que este estudiante tuvo en cada semestre (según su historial de grupos);
        // si aún no se instaló el historial, los de su cohorte
        let r = await supabase.rpc('formadores_estudiante', { p_estudiante: data.id })
        if (r.error && data.cohorte_id) r = await supabase.rpc('formadores_cohorte', { p_cohorte: data.cohorte_id })
        if (vigente) setFormadores(r.error ? {} : r.data ?? {})
      }
    })
    if (!espacios.length) supabase.from('espacios').select('*').order('semestre').order('orden').order('id').then(({ data }) => setEspacios(data ?? []))
    if (admin) supabase.rpc('estado_acceso_estudiante', { p_estudiante: id }).then(({ data }) => { if (vigente) setAcceso(data ?? null) })
    supabase.from('notas').select('*').eq('estudiante_id', id)
      .then(({ data }) => { if (vigente) setNotas(Object.fromEntries((data ?? []).map((n) => [n.espacio_id, n]))) })
    return () => { vigente = false }
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function restablecer() {
    if (!confirm('La contraseña del estudiante volverá a ser su número de documento. ¿Continuar?')) return
    const { error } = await supabase.rpc('restablecer_clave_estudiante', { p_estudiante: id })
    setAviso(error
      ? { tipo: 'error', texto: `No se pudo restablecer: ${error.message}` }
      : { tipo: 'ok', texto: 'Contraseña restablecida y acceso desbloqueado. Ahora es su número de documento y deberá cambiarla al entrar.' })
    if (!error) supabase.rpc('estado_acceso_estudiante', { p_estudiante: id }).then(({ data }) => setAcceso(data ?? null))
  }

  async function eliminar() {
    const ok = confirm(`¿Eliminar a ${est.nombre_completo}?\n\nSe borrarán también todas sus notas y su acceso al portal. Esta acción no se puede deshacer.\n\nSi solo dejó de asistir, es mejor marcarlo como "Retirado" en su hoja de vida.`)
    if (!ok) return
    const { error } = await supabase.from('estudiantes').delete().eq('id', id)
    if (error) setAviso({ tipo: 'error', texto: `No se pudo eliminar: ${error.message}` })
    else navigate('/')
  }

  if (!est) return <p className="text-slate-500">Cargando…</p>
  const cargandoOtro = est.id !== id

  const { semestres, general } = resumen(espacios, notas)
  const semActual = est.cohortes?.semestre_actual ? String(est.cohortes.semestre_actual) : null
  const verSem = semElegido ?? semActual ?? 'todos'
  const semVisible = verSem === 'todos' ? semestres : semestres.filter((x) => String(x.s) === verSem)
  const datoSem = verSem === 'todos' ? null : semestres.find((x) => String(x.s) === verSem)

  const datos = [
    ['Documento', `${est.tipo_id ?? ''} ${est.numero_id ?? ''}`], ['Parroquia', est.parroquia], ['Centro de formación', est.centro_formacion],
    ['Centro (sede)', est.centros?.nombre], ['Cohorte', est.cohortes?.nombre], ['Fecha de matrícula', fecha(est.fecha_matricula)], ['Nacimiento', `${est.lugar_nacimiento ?? '—'}, ${fecha(est.fecha_nacimiento)}`],
    ['Dirección', est.direccion], ['Barrio', est.barrio], ['Teléfono', est.telefono], ['Correo electrónico', est.correo], ['Ocupación', est.ocupacion],
    ['Nivel escolar', est.nivel_escolar], ['Estudio universitario o técnico', est.estudio_superior], ['Estado', est.estado], ['Observaciones', est.observaciones],
  ]

  return (
    <section className={cargandoOtro ? 'opacity-60 transition-opacity' : 'transition-opacity'} aria-busy={cargandoOtro}>
      {/* Navegación entre estudiantes */}
      <nav aria-label="Navegación entre estudiantes" className="mb-6 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm print:hidden">
        <Link to="/" className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-mariano hover:bg-cielo">
          <Flecha d="M12 15 7 10l5-5" /> Estudiantes
        </Link>
        {pos >= 0 && recorrido.length > 1 && (
          <>
            <span className="mx-1 hidden h-5 w-px bg-slate-200 sm:block" aria-hidden="true" />
            <span className="text-sm text-slate-500 tabular-nums" aria-live="polite">
              Estudiante <strong className="text-tinta">{pos + 1}</strong> de {recorrido.length}
            </span>
            <span className="ml-auto flex items-center gap-2">
              <button onClick={() => ir(anterior)} disabled={!anterior} title={anterior ? `${anterior.nombre} (tecla ←)` : 'Es el primero de la lista'}
                className="btn-sec px-3 py-1.5">
                <Flecha d="M12 15 7 10l5-5" /> <span className="hidden sm:inline">Anterior</span>
              </button>
              <button onClick={() => ir(siguiente)} disabled={!siguiente} title={siguiente ? `${siguiente.nombre} (tecla →)` : 'Es el último de la lista'}
                className="btn px-3 py-1.5">
                Siguiente <Flecha d="m8 5 5 5-5 5" />
              </button>
            </span>
            {siguiente && <p className="w-full truncate text-right text-xs text-slate-400 sm:pr-1">Sigue: {siguiente.nombre}</p>}
          </>
        )}
      </nav>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-5">
          <FotoEstudiante key={est.id} estudiante={est} editable={admin} alCambiar={(ruta) => setEst({ ...est, foto_url: ruta })} />
          <div>
            <h1 className="text-3xl font-semibold">{est.nombre_completo}</h1>
            <p className="text-sm text-slate-500">{est.parroquia}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="text-right">
            <p className="font-serif text-4xl font-semibold tabular-nums">{fmt(general)}</p>
            <p className="text-xs text-slate-500">Promedio del itinerario</p>
          </div>
          <Link to={`/estudiantes/${id}/imprimir`} className="btn-sec">Imprimir o PDF</Link>
          {admin && <Link to={`/estudiantes/${id}/editar`} className="btn-sec">Editar</Link>}
          {admin && <button onClick={restablecer} className="btn-sec">Restablecer contraseña</button>}
          {admin && <button onClick={eliminar} className="inline-flex items-center rounded-md border border-alerta px-4 py-2 text-sm font-semibold text-alerta hover:bg-red-50">Eliminar</button>}
        </div>
      </div>

      {admin && acceso && (
        <div className="mb-6 flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm">
          <strong>Acceso al portal:</strong>
          {!est.numero_id ? <span className="text-amber-700">No tiene número de documento: no puede entrar. Agrégalo en Editar.</span>
            : !acceso.existe ? <span className="text-amber-700">Sin acceso creado. Pulsa "Restablecer contraseña" para activarlo.</span>
            : acceso.bloqueado ? <span className="text-alerta">Bloqueado por intentos fallidos. Pulsa "Restablecer contraseña" para desbloquearlo.</span>
            : acceso.debe_cambiar ? <span className="text-slate-700">Aún no ha entrado: su contraseña es su número de documento, <strong>{est.numero_id}</strong>.</span>
            : <span className="text-slate-700">Ya creó su propia contraseña. Si la olvidó, restablécela.</span>}
          {acceso.existe && acceso.intentos > 0 && !acceso.bloqueado && <span className="text-xs text-slate-500">({acceso.intentos} intento(s) fallido(s))</span>}
        </div>
      )}

      {aviso && <p className={`mb-6 text-sm ${aviso.tipo === 'error' ? 'text-alerta' : 'text-green-700'}`}>{aviso.texto}</p>}

      <Camino semestres={semestres} />

      <div className="mb-6 flex gap-2 border-b border-slate-200">
        {[['itinerario', 'Itinerario formativo'], ['hoja', 'Hoja de vida']].map(([k, t]) => (
          <button key={k} onClick={() => setPestana(k)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold ${pestana === k ? 'border-mariano text-mariano' : 'border-transparent text-slate-500'}`}>{t}</button>
        ))}
      </div>

      {pestana === 'hoja' ? (
        <dl className="grid gap-x-8 gap-y-4 rounded-lg border border-slate-200 bg-white p-6 sm:grid-cols-2">
          {datos.map(([k, v]) => (
            <div key={k}><dt className="text-xs text-slate-500">{k}</dt><dd>{v || '—'}</dd></div>
          ))}
        </dl>
      ) : (
        <>
          <div className="mb-5 flex flex-wrap items-center gap-3 print:hidden">
            <span className="text-sm font-semibold text-slate-600">Ver notas de</span>
            <div ref={barraSem} role="group" aria-label="Semestre" className="relative -mx-1 max-w-full overflow-x-auto px-1">
              <div className="flex w-max gap-1 rounded-xl bg-slate-200/60 p-1">
                {[['todos', 'Todos'], ...semestres.map((x) => [String(x.s), `Semestre ${x.s}`])].map(([v, t]) => (
                  <button key={v} onClick={() => elegirSemestre(v)} aria-pressed={verSem === v}
                    className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                      verSem === v ? 'bg-white text-tinta shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:bg-white/60 hover:text-tinta'}`}>
                    {t}
                    {v === semActual && <span className="rounded-full bg-amber-100 px-1.5 py-px text-[10px] font-bold uppercase tracking-wide text-oro">actual</span>}
                  </button>
                ))}
              </div>
            </div>
            {datoSem && (
              <span className="text-sm text-slate-500">
                Promedio del semestre {datoSem.s}: <strong className="font-serif text-lg text-tinta tabular-nums">{fmt(datoSem.prom)}</strong>
                <span className="ml-2 text-xs">({datoSem.completos} de {datoSem.total} con nota)</span>
              </span>
            )}
          </div>
          {verSem === 'todos' || datoSem?.items.length
            ? <TablasSemestres semestres={semVisible} notas={notas} formadores={formadores} />
            : <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">Este semestre aún no tiene módulos, retiros ni seminarios.</p>}
        </>
      )}
    </section>
  )
}
