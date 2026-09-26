import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { fmt } from '../lib/notas'
import { resumen, Camino, TablasSemestres } from '../components/Itinerario'

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

  useEffect(() => {
    supabase.from('estudiantes').select('*, cohortes(nombre), centros!estudiantes_centro_id_fkey(nombre)').eq('id', id).single().then(async ({ data }) => {
      setEst(data)
      if (data?.cohorte_id) {
        const { data: f } = await supabase.rpc('formadores_cohorte', { p_cohorte: data.cohorte_id })
        setFormadores(f ?? {})
      }
    })
    supabase.from('espacios').select('*').order('semestre').order('orden').order('id').then(({ data }) => setEspacios(data ?? []))
    supabase.from('notas').select('*').eq('estudiante_id', id)
      .then(({ data }) => setNotas(Object.fromEntries((data ?? []).map((n) => [n.espacio_id, n]))))
  }, [id])

  async function restablecer() {
    if (!confirm('La contraseña del estudiante volverá a ser su número de documento. ¿Continuar?')) return
    const { error } = await supabase.rpc('restablecer_clave_estudiante', { p_estudiante: id })
    setAviso(error
      ? { tipo: 'error', texto: `No se pudo restablecer: ${error.message}` }
      : { tipo: 'ok', texto: 'Contraseña restablecida. Ahora es su número de documento y deberá cambiarla al entrar.' })
  }

  async function eliminar() {
    const ok = confirm(`¿Eliminar a ${est.nombre_completo}?\n\nSe borrarán también todas sus notas y su acceso al portal. Esta acción no se puede deshacer.\n\nSi solo dejó de asistir, es mejor marcarlo como "Retirado" en su hoja de vida.`)
    if (!ok) return
    const { error } = await supabase.from('estudiantes').delete().eq('id', id)
    if (error) setAviso({ tipo: 'error', texto: `No se pudo eliminar: ${error.message}` })
    else navigate('/')
  }

  if (!est) return <p className="text-slate-500">Cargando…</p>

  const { semestres, general } = resumen(espacios, notas)

  const datos = [
    ['Documento', `${est.tipo_id ?? ''} ${est.numero_id ?? ''}`], ['Parroquia', est.parroquia], ['Centro de formación', est.centro_formacion],
    ['Centro (sede)', est.centros?.nombre], ['Cohorte', est.cohortes?.nombre], ['Fecha de matrícula', fecha(est.fecha_matricula)], ['Nacimiento', `${est.lugar_nacimiento ?? '—'}, ${fecha(est.fecha_nacimiento)}`],
    ['Dirección', est.direccion], ['Barrio', est.barrio], ['Teléfono', est.telefono], ['Correo electrónico', est.correo], ['Ocupación', est.ocupacion],
    ['Nivel escolar', est.nivel_escolar], ['Estudio universitario o técnico', est.estudio_superior], ['Estado', est.estado], ['Observaciones', est.observaciones],
  ]

  return (
    <section>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link to="/" className="text-sm text-mariano hover:underline">Volver a estudiantes</Link>
          <h1 className="mt-2 text-3xl font-semibold">{est.nombre_completo}</h1>
          <p className="text-sm text-slate-500">{est.parroquia}</p>
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
        <TablasSemestres semestres={semestres} notas={notas} formadores={formadores} />
      )}
    </section>
  )
}
