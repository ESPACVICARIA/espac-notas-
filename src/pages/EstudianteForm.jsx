import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const VACIO = {
  cohorte_id: '', centro_id: '', centro_formacion: 'Vicaría Episcopal Territorial Ntra. Sra. del Rosario', parroquia: '',
  fecha_matricula: '', nombre_completo: '', lugar_nacimiento: '', fecha_nacimiento: '', tipo_id: 'CC',
  numero_id: '', correo: '', direccion: '', barrio: '', telefono: '', ocupacion: '', nivel_escolar: '',
  estudio_superior: '', estado: 'activo', observaciones: '',
}

function Campo({ label, name, datos, set, type = 'text', required, className = '' }) {
  return (
    <div className={className}>
      <label className="etiqueta" htmlFor={name}>{label}</label>
      <input id={name} type={type} required={required} className="campo"
        value={datos[name] ?? ''} onChange={(e) => set({ ...datos, [name]: e.target.value })} />
    </div>
  )
}

export default function EstudianteForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [datos, setDatos] = useState(VACIO)
  const [cohortes, setCohortes] = useState([])
  const [centros, setCentros] = useState([])
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    supabase.from('cohortes').select('*').order('anio', { ascending: false }).then(({ data }) => setCohortes(data ?? []))
    supabase.from('centros').select('*').order('nombre').then(({ data }) => setCentros(data ?? []))
    if (id) supabase.from('estudiantes').select('*').eq('id', id).single().then(({ data }) => data && setDatos({ ...VACIO, ...data }))
  }, [id])

  async function guardar(e) {
    e.preventDefault()
    setGuardando(true); setError('')
    const limpio = Object.fromEntries(Object.entries(datos).map(([k, v]) => [k, v === '' ? null : v]))
    if (limpio.correo) limpio.correo = limpio.correo.trim().toLowerCase()
    delete limpio.creado; delete limpio.cohortes; delete limpio.centros
    if (limpio.centro_id) limpio.centro_id = Number(limpio.centro_id)
    if (limpio.cohorte_id) limpio.cohorte_id = Number(limpio.cohorte_id)
    const res = id
      ? await supabase.from('estudiantes').update(limpio).eq('id', id).select().single()
      : await supabase.from('estudiantes').insert(limpio).select().single()
    setGuardando(false)
    if (res.error) {
      setError(res.error.code === '23505' ? 'Ya existe un estudiante con ese número de documento.' : `No se pudo guardar: ${res.error.message}`)
      return
    }
    navigate(`/estudiantes/${res.data.id}`)
  }

  const p = { datos, set: setDatos }

  return (
    <form onSubmit={guardar} className="max-w-3xl">
      <h1 className="text-3xl font-semibold">{id ? 'Editar hoja de vida' : 'Matricular estudiante'}</h1>
      <p className="mb-8 text-sm text-slate-500">Formulario de matrícula-inscripción · Datos generales y personales</p>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <Campo label="Nombre completo" name="nombre_completo" required className="sm:col-span-2" {...p} />
        <div>
          <label className="etiqueta" htmlFor="centro">Centro de formación (sede)</label>
          <select id="centro" className="campo" value={datos.centro_id ?? ''} onChange={(e) => setDatos({ ...datos, centro_id: e.target.value })}>
            <option value="">Sin centro</option>
            {centros.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>
        <Campo label="Centro de formación (como aparece en el formulario impreso)" name="centro_formacion" {...p} />
        <Campo label="Parroquia a la que pertenece" name="parroquia" {...p} />
        <div>
          <label className="etiqueta" htmlFor="cohorte">Cohorte</label>
          <select id="cohorte" className="campo" value={datos.cohorte_id ?? ''} onChange={(e) => {
            const c = cohortes.find((x) => String(x.id) === e.target.value)
            setDatos({ ...datos, cohorte_id: e.target.value, ...(c?.centro_id && !datos.centro_id ? { centro_id: String(c.centro_id) } : {}) })
          }}>
            <option value="">Sin asignar</option>
            {cohortes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>
        <Campo label="Fecha de matrícula" name="fecha_matricula" type="date" {...p} />
        <Campo label="Fecha de nacimiento" name="fecha_nacimiento" type="date" {...p} />
        <Campo label="Lugar de nacimiento" name="lugar_nacimiento" {...p} />
        <div className="grid grid-cols-[6rem_1fr] gap-2">
          <div>
            <label className="etiqueta" htmlFor="tipo_id">Tipo</label>
            <select id="tipo_id" className="campo" value={datos.tipo_id ?? 'CC'} onChange={(e) => setDatos({ ...datos, tipo_id: e.target.value })}>
              {['CC', 'CE', 'PAS', 'TI'].map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <Campo label="Número de documento" name="numero_id" required {...p} />
        </div>
        <Campo label="Dirección de residencia" name="direccion" {...p} />
        <Campo label="Barrio" name="barrio" {...p} />
        <Campo label="Teléfono o contacto" name="telefono" type="tel" {...p} />
        <Campo label="Correo electrónico" name="correo" type="email" {...p} />
        <Campo label="Ocupación u oficio" name="ocupacion" {...p} />
        <Campo label="Nivel escolar más alto" name="nivel_escolar" {...p} />
        <Campo label="Estudio universitario o técnico" name="estudio_superior" {...p} />
        <div>
          <label className="etiqueta" htmlFor="estado">Estado</label>
          <select id="estado" className="campo" value={datos.estado} onChange={(e) => setDatos({ ...datos, estado: e.target.value })}>
            <option value="activo">Activo</option><option value="retirado">Retirado</option><option value="graduado">Graduado</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="etiqueta" htmlFor="obs">Observaciones</label>
          <textarea id="obs" rows={3} className="campo" value={datos.observaciones ?? ''} onChange={(e) => setDatos({ ...datos, observaciones: e.target.value })} />
        </div>
      </fieldset>

      {error && <p className="mt-4 text-sm text-alerta">{error}</p>}
      <div className="mt-8 flex gap-3">
        <button className="btn" disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar hoja de vida'}</button>
        <button type="button" className="btn-sec" onClick={() => navigate(-1)}>Cancelar</button>
      </div>
    </form>
  )
}
