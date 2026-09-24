import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Configuracion() {
  const [cohortes, setCohortes] = useState([])
  const [perfiles, setPerfiles] = useState([])
  const [asignaciones, setAsignaciones] = useState([])
  const [nueva, setNueva] = useState({ nombre: '', anio: new Date().getFullYear() })
  const [asig, setAsig] = useState({ formador_id: '', cohorte_id: '', semestre: '1' })
  const [error, setError] = useState('')

  async function cargar() {
    const [c, p, a] = await Promise.all([
      supabase.from('cohortes').select('*').order('anio', { ascending: false }),
      supabase.from('perfiles').select('*').order('nombre'),
      supabase.from('asignaciones').select('*, perfiles(nombre), cohortes(nombre)').order('semestre'),
    ])
    setCohortes(c.data ?? []); setPerfiles(p.data ?? []); setAsignaciones(a.data ?? [])
  }
  useEffect(() => { cargar() }, [])

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
        <table className="w-full text-sm">
          <tbody>
            {perfiles.map((p) => (
              <tr key={p.id} className="border-t border-slate-100">
                <td className="py-2">{p.nombre}<br /><span className="text-xs text-slate-500">{p.correo}</span></td>
                <td className="py-2 text-right">
                  <select className="campo w-40" value={p.rol} onChange={(e) => ejecutar(supabase.from('perfiles').update({ rol: e.target.value }).eq('id', p.id))}>
                    <option value="admin">Coordinación</option><option value="formador">Formador</option><option value="estudiante">Estudiante</option>
                  </select>
                </td>
              </tr>
            ))}
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
