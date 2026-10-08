import { Fragment, useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { HojaMatricula, HojaItinerario, BarraImpresion } from '../components/Documentos'
import { traerTodo } from '../lib/exportar'
import { urlFoto } from '../lib/fotos'
import { ordenarEstudiantes } from '../lib/planilla'

export const MAX_LOTE = 60
const CLAVE = 'espac-imprimir-lote'

// Recuerda la lista de estudiantes por si se recarga la página
export function guardarLote(ids) {
  try { sessionStorage.setItem(CLAVE, JSON.stringify(ids)) } catch { /* sin almacenamiento */ }
}
function leerLote() {
  try { return JSON.parse(sessionStorage.getItem(CLAVE) ?? '[]') } catch { return [] }
}

export default function ImprimirVarios() {
  const { state } = useLocation()
  const [ids] = useState(() => (state?.ids?.length ? state.ids : leerLote()).slice(0, MAX_LOTE))
  const [estudiantes, setEstudiantes] = useState(null)
  const [espacios, setEspacios] = useState([])
  const [notas, setNotas] = useState({})
  const [formadores, setFormadores] = useState({})
  const [docs, setDocs] = useState({ matricula: false, itinerario: true })
  const [avance, setAvance] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!ids.length) { setEstudiantes([]); return }
    (async () => {
      try {
        setAvance('Cargando estudiantes…')
        const ests = []
        const ns = []
        for (let i = 0; i < ids.length; i += 50) {
          const lote = ids.slice(i, i + 50)
          ests.push(...await traerTodo(() => supabase.from('estudiantes').select('*, cohortes(nombre)').in('id', lote).order('id')))
          ns.push(...await traerTodo(() => supabase.from('notas').select('*').in('estudiante_id', lote).order('id')))
        }
        const { data: esp } = await supabase.from('espacios').select('*').order('semestre').order('orden').order('id')
        const porEst = {}
        for (const n of ns) (porEst[n.estudiante_id] ??= {})[n.espacio_id] = n
        const cohortes = [...new Set(ests.map((e) => e.cohorte_id).filter(Boolean))]
        const f = {}
        for (const c of cohortes) f[c] = (await supabase.rpc('formadores_cohorte', { p_cohorte: c })).data ?? {}
        setAvance('Cargando fotos…')
        const conFoto = await Promise.all(ests.map(async (e) => ({ ...e, foto_url: await urlFoto(e.foto_url) })))
        setEspacios(esp ?? []); setNotas(porEst); setFormadores(f)
        setEstudiantes(ordenarEstudiantes(conFoto, 'apellidos'))
        setAvance('')
      } catch (e) {
        setError(`No se pudieron cargar los estudiantes: ${e.message}`)
      }
    })()
  }, [ids])

  useEffect(() => {
    const anterior = document.title
    document.title = `ESPAC - ${ids.length} estudiantes`
    return () => { document.title = anterior }
  }, [ids.length])

  if (error) return <p className="text-sm text-alerta">{error}</p>
  if (!ids.length) {
    return (
      <p className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-slate-500">
        No hay estudiantes para imprimir. <Link to="/" className="text-mariano underline">Vuelve a la lista</Link> y selecciónalos.
      </p>
    )
  }
  if (!estudiantes) return <p className="text-slate-500">{avance || 'Cargando…'}</p>

  const marcar = (k) => (e) => setDocs({ ...docs, [k]: e.target.checked })
  const paginas = estudiantes.length * ((docs.matricula ? 1 : 0) + (docs.itinerario ? 2 : 0))

  return (
    <section>
      <BarraImpresion>
        <Link to="/" className="text-sm text-mariano hover:underline">Volver a estudiantes</Link>
        <span className="text-sm font-semibold">{estudiantes.length} estudiante(s)</span>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={docs.matricula} onChange={marcar('matricula')} /> Formulario de matrícula</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={docs.itinerario} onChange={marcar('itinerario')} /> Seguimiento del itinerario</label>
        <span className="text-xs text-slate-500">{paginas} página(s), en orden alfabético por apellido</span>
      </BarraImpresion>
      <div className="overflow-x-auto print:overflow-visible">
        {estudiantes.map((est) => (
          <Fragment key={est.id}>
            {docs.matricula && <HojaMatricula est={est} />}
            {docs.itinerario && <HojaItinerario est={est} espacios={espacios} notas={notas[est.id] ?? {}} formadores={formadores[est.cohorte_id] ?? {}} />}
          </Fragment>
        ))}
        {!docs.matricula && !docs.itinerario && <p className="text-slate-500 print:hidden">Elige al menos un documento.</p>}
      </div>
    </section>
  )
}
