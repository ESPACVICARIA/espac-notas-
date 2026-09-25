import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { HojaMatricula, HojaItinerario, BarraImpresion } from '../components/Documentos'

export default function Imprimir() {
  const { id } = useParams()
  const [est, setEst] = useState(null)
  const [espacios, setEspacios] = useState([])
  const [notas, setNotas] = useState({})
  const [formadores, setFormadores] = useState({})
  const [docs, setDocs] = useState({ matricula: true, itinerario: true })

  useEffect(() => {
    (async () => {
      const [{ data: e }, { data: esp }, { data: ns }] = await Promise.all([
        supabase.from('estudiantes').select('*, cohortes(nombre)').eq('id', id).single(),
        supabase.from('espacios').select('*').order('id'),
        supabase.from('notas').select('*').eq('estudiante_id', id),
      ])
      setEst(e); setEspacios(esp ?? [])
      setNotas(Object.fromEntries((ns ?? []).map((n) => [n.espacio_id, n])))
      if (e?.cohorte_id) {
        const { data: as } = await supabase.from('asignaciones').select('semestre, perfiles(nombre)').eq('cohorte_id', e.cohorte_id)
        const porSem = {}
        for (const a of as ?? []) if (a.perfiles?.nombre) (porSem[a.semestre] ??= []).push(a.perfiles.nombre)
        setFormadores(Object.fromEntries(Object.entries(porSem).map(([s, n]) => [s, n.join(', ')])))
      }
    })()
  }, [id])

  // El título de la pestaña se usa como nombre sugerido del PDF
  useEffect(() => {
    if (!est) return
    const anterior = document.title
    document.title = `ESPAC - ${est.nombre_completo}`
    return () => { document.title = anterior }
  }, [est])

  if (!est) return <p className="text-slate-500">Cargando…</p>

  const marcar = (k) => (e) => setDocs({ ...docs, [k]: e.target.checked })

  return (
    <section>
      <BarraImpresion>
        <Link to={`/estudiantes/${id}`} className="text-sm text-mariano hover:underline">Volver a la ficha</Link>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={docs.matricula} onChange={marcar('matricula')} /> Formulario de matrícula</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={docs.itinerario} onChange={marcar('itinerario')} /> Seguimiento del itinerario</label>
      </BarraImpresion>
      <div className="overflow-x-auto print:overflow-visible">
        {docs.matricula && <HojaMatricula est={est} />}
        {docs.itinerario && <HojaItinerario est={est} espacios={espacios} notas={notas} formadores={formadores} />}
        {!docs.matricula && !docs.itinerario && <p className="text-slate-500 print:hidden">Elige al menos un documento.</p>}
      </div>
    </section>
  )
}
