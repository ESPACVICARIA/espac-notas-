import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Estudiantes({ perfil }) {
  const [lista, setLista] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    supabase.from('estudiantes').select('id, nombre_completo, numero_id, parroquia, estado, cohortes(nombre)')
      .order('nombre_completo')
      .then(({ data }) => { setLista(data ?? []); setCargando(false) })
  }, [])

  const q = busqueda.toLowerCase()
  const filtrados = lista.filter((e) =>
    e.nombre_completo.toLowerCase().includes(q) || (e.numero_id ?? '').includes(q))

  return (
    <section>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Estudiantes</h1>
          <p className="text-sm text-slate-500">{lista.length} catequistas en formación</p>
        </div>
        {perfil?.rol === 'admin' && <Link to="/estudiantes/nuevo" className="btn">Matricular estudiante</Link>}
      </div>

      <input className="campo mb-4 max-w-md" placeholder="Buscar por nombre o documento"
        value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />

      {cargando ? <p className="text-slate-500">Cargando…</p> : filtrados.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-slate-500">
          {lista.length === 0 ? 'Aún no hay estudiantes matriculados. Empieza con "Matricular estudiante".' : 'Ningún estudiante coincide con la búsqueda.'}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-cielo text-left text-tinta">
              <tr><th className="p-3">Nombre</th><th className="p-3">Documento</th><th className="p-3">Parroquia</th><th className="p-3">Cohorte</th><th className="p-3">Estado</th></tr>
            </thead>
            <tbody>
              {filtrados.map((e) => (
                <tr key={e.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="p-3"><Link to={`/estudiantes/${e.id}`} className="font-medium text-mariano hover:underline">{e.nombre_completo}</Link></td>
                  <td className="p-3 tabular-nums">{e.numero_id}</td>
                  <td className="p-3">{e.parroquia}</td>
                  <td className="p-3">{e.cohortes?.nombre ?? '—'}</td>
                  <td className="p-3 capitalize">{e.estado}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
