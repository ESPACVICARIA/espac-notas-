import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Configuracion() {
  const [cohortes, setCohortes] = useState([])
  const [perfiles, setPerfiles] = useState([])
  const [asignaciones, setAsignaciones] = useState([])
  const [nueva, setNueva] = useState({ nombre: '', anio: new Date().getFullYear() })
  const [asig, setAsig] = useState({ formador_id: '', cohorte_id: '', semestre: '1' })
  const [error, setError] = useState('')
  const [yo, setYo] = useState(null)
  const [selUsuarios, setSelUsuarios] = useState(new Set())
  const [aviso, setAviso] = useState('')

  async function cargar() {
    const { data: s } = await supabase.auth.getSession()
    setYo(s.session?.user.id ?? null)
    const [c, p, a] = await Promise.all([
      supabase.from('cohortes').select('*').order('anio', { ascending: false }),
      supabase.from('perfiles').select('*').order('nombre'),
      supabase.from('asignaciones').select('*, perfiles(nombre), cohortes(nombre)').order('semestre'),
    ])
    setCohortes(c.data ?? []); setPerfiles(p.data ?? []); setAsignaciones(a.data ?? [])
  }
  useEffect(() => { cargar() }, [])

  function alternarUsuario(id) {
    setSelUsuarios((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  async function eliminarUsuarios(ids) {
    const nombres = perfiles.filter((p) => ids.includes(p.id)).map((p) => p.nombre).join(', ')
    const ok = confirm(
      `¿Eliminar ${ids.length === 1 ? 'este usuario' : `${ids.length} usuarios`}?\n\n${nombres}\n\n` +
      'Perderán el acceso a la plataforma y se quitarán sus asignaciones. Las notas que digitaron se conservan. Esta acción no se puede deshacer.'
    )
    if (!ok) return
    setError(''); setAviso('')
    const { data, error } = await supabase.rpc('eliminar_usuarios', { p_ids: ids })
    if (error) setError(error.message)
    else setAviso(`${data} usuario(s) eliminados.`)
    setSelUsuarios(new Set())
    cargar()
  }

  const ejecutar = async (promesa) => { setError(''); const { error } = await promesa; if (error) setError(error.message); else cargar() }

  return (
    <section className="space-y-10">
      <h1 className="text-3xl font-semibold">Configuración</h1>
      {error && <p className="text-sm text-alerta">{error}</p>}

      <div>
        <h2 className="mb-3 text-xl font-semibold">Cohortes</h2>
        <form className="mb-4 flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); ejecutar(supabase.from('cohortes').insert(nueva)); setNueva({ ...nueva, nombre: '' }) }}>
          <input className="campo max-w-xs" required placeholder="Ej. Cohorte 2026-I" value={nueva.nombre} onChange={(e) => setNueva({ ...nueva, nombre: e.target.value })} />
          <input className="campo w-28" type="number" value={nueva.anio} onChange={(e) => setNueva({ ...nueva, anio: Number(e.target.value) })} />
          <button className="btn">Crear cohorte</button>
        </form>
        <ul className="text-sm">{cohortes.map((c) => <li key={c.id} className="border-t border-slate-100 py-2">{c.nombre} <span className="text-slate-500">({c.anio})</span></li>)}</ul>
      </div>

      <div>
        <h2 className="mb-1 text-xl font-semibold">Usuarios y roles</h2>
        <p className="mb-3 text-sm text-slate-500">Para dar acceso a un formador, créale el usuario en Supabase (Authentication, Add user) y luego asígnale el rol aquí.</p>
        {aviso && <p className="mb-3 text-sm text-green-700">{aviso}</p>}
        {selUsuarios.size > 0 && (
          <div className="mb-3 flex items-center gap-3">
            <button onClick={() => eliminarUsuarios([...selUsuarios])}
              className="inline-flex items-center rounded-md bg-alerta px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
              Eliminar {selUsuarios.size} seleccionado(s)
            </button>
            <button onClick={() => setSelUsuarios(new Set())} className="text-sm text-slate-500 underline">Quitar selección</button>
          </div>
        )}
        <table className="w-full text-sm">
          <tbody>
            {perfiles.map((p) => {
              const esYo = p.id === yo
              return (
                <tr key={p.id} className={`border-t border-slate-100 ${selUsuarios.has(p.id) ? 'bg-red-50' : ''}`}>
                  <td className="w-10 py-2">
                    <input type="checkbox" disabled={esYo} aria-label={`Seleccionar a ${p.nombre}`}
                      checked={selUsuarios.has(p.id)} onChange={() => alternarUsuario(p.id)} />
                  </td>
                  <td className="py-2">
                    {p.nombre} {esYo && <span className="text-xs text-oro">(tú)</span>}
                    <br /><span className="text-xs text-slate-500">{p.correo}</span>
                  </td>
                  <td className="py-2 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <select className="campo w-40" value={p.rol} disabled={esYo}
                        onChange={(e) => ejecutar(supabase.from('perfiles').update({ rol: e.target.value }).eq('id', p.id))}>
                        <option value="admin">Coordinación</option><option value="formador">Formador</option><option value="estudiante">Estudiante</option>
                      </select>
                      {!esYo && (
                        <button onClick={() => eliminarUsuarios([p.id])} className="text-xs font-semibold text-alerta underline">Eliminar</button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div>
        <h2 className="mb-1 text-xl font-semibold">Asignación de formadores</h2>
        <p className="mb-3 text-sm text-slate-500">Cada formador solo puede digitar notas del semestre y la cohorte que tenga asignados.</p>
        <form className="mb-4 flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); ejecutar(supabase.from('asignaciones').insert({ ...asig, semestre: Number(asig.semestre) })) }}>
          <select className="campo max-w-xs" required value={asig.formador_id} onChange={(e) => setAsig({ ...asig, formador_id: e.target.value })}>
            <option value="">Formador</option>
            {perfiles.filter((p) => p.rol !== 'estudiante').map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
          <select className="campo max-w-xs" required value={asig.cohorte_id} onChange={(e) => setAsig({ ...asig, cohorte_id: e.target.value })}>
            <option value="">Cohorte</option>
            {cohortes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
          <select className="campo w-36" value={asig.semestre} onChange={(e) => setAsig({ ...asig, semestre: e.target.value })}>
            {[1, 2, 3, 4].map((s) => <option key={s} value={s}>Semestre {s}</option>)}
          </select>
          <button className="btn">Asignar</button>
        </form>
        <ul className="text-sm">
          {asignaciones.map((a) => (
            <li key={a.id} className="flex items-center justify-between border-t border-slate-100 py-2">
              <span>{a.perfiles?.nombre} · {a.cohortes?.nombre} · Semestre {a.semestre}</span>
              <button className="text-xs text-alerta underline" onClick={() => ejecutar(supabase.from('asignaciones').delete().eq('id', a.id))}>Quitar</button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
