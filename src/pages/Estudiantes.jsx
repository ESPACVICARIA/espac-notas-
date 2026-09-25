import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { exportarEstudiantes } from '../lib/exportar'

export default function Estudiantes({ perfil }) {
  const admin = perfil?.rol === 'admin'
  const [lista, setLista] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [cargando, setCargando] = useState(true)
  const [sel, setSel] = useState(new Set())
  const [aviso, setAviso] = useState(null)
  const [eliminando, setEliminando] = useState(false)
  const [exportando, setExportando] = useState(false)

  async function cargar() {
    const { data } = await supabase.from('estudiantes')
      .select('id, nombre_completo, numero_id, parroquia, estado, cohortes(nombre)')
      .order('nombre_completo').range(0, 9999)
    setLista(data ?? [])
    setCargando(false)
  }
  useEffect(() => { cargar() }, [])

  const q = busqueda.toLowerCase()
  const filtrados = lista.filter((e) =>
    e.nombre_completo.toLowerCase().includes(q) || (e.numero_id ?? '').toLowerCase().includes(q))

  const todosMarcados = filtrados.length > 0 && filtrados.every((e) => sel.has(e.id))

  function alternar(id) {
    setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function alternarTodos() {
    setSel((s) => {
      const n = new Set(s)
      filtrados.forEach((e) => (todosMarcados ? n.delete(e.id) : n.add(e.id)))
      return n
    })
  }

  async function exportar() {
    const ids = sel.size ? [...sel] : filtrados.map((e) => e.id)
    setExportando(true); setAviso(null)
    try {
      const total = await exportarEstudiantes(ids)
      setAviso({ tipo: 'ok', texto: `Excel descargado con ${total} estudiante(s).` })
    } catch (e) {
      setAviso({ tipo: 'error', texto: `No se pudo exportar: ${e.message}` })
    }
    setExportando(false)
  }

  async function eliminar() {
    const ids = [...sel]
    const ok = confirm(
      `¿Eliminar ${ids.length} estudiante(s)?\n\n` +
      'Se borrarán también todas sus notas y su acceso al portal. Esta acción no se puede deshacer.\n\n' +
      'Si solo dejaron de asistir, es mejor marcarlos como "Retirado" en su hoja de vida.'
    )
    if (!ok) return
    setEliminando(true); setAviso(null)
    let borrados = 0
    for (let i = 0; i < ids.length; i += 100) {
      const lote = ids.slice(i, i + 100)
      const { error } = await supabase.from('estudiantes').delete().in('id', lote)
      if (error) { setAviso({ tipo: 'error', texto: `Se eliminaron ${borrados}, pero falló el resto: ${error.message}` }); break }
      borrados += lote.length
    }
    if (borrados === ids.length) setAviso({ tipo: 'ok', texto: `${borrados} estudiante(s) eliminados.` })
    setSel(new Set())
    await cargar()
    setEliminando(false)
  }

  return (
    <section>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Estudiantes</h1>
          <p className="text-sm text-slate-500">{lista.length} catequistas en formación</p>
        </div>
        {admin && <Link to="/estudiantes/nuevo" className="btn">Matricular estudiante</Link>}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input className="campo max-w-md" placeholder="Buscar por nombre o documento"
          value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
        {filtrados.length > 0 && (
          <button onClick={exportar} disabled={exportando} className="btn-sec">
            {exportando ? 'Preparando Excel…' : sel.size ? `Exportar ${sel.size} a Excel` : `Exportar ${filtrados.length} a Excel`}
          </button>
        )}
        {admin && sel.size > 0 && (
          <>
            <button onClick={eliminar} disabled={eliminando}
              className="inline-flex items-center rounded-md bg-alerta px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
              {eliminando ? 'Eliminando…' : `Eliminar ${sel.size} seleccionado(s)`}
            </button>
            <button onClick={() => setSel(new Set())} className="text-sm text-slate-500 underline">Quitar selección</button>
          </>
        )}
      </div>

      {aviso && <p className={`mb-4 text-sm ${aviso.tipo === 'error' ? 'text-alerta' : 'text-green-700'}`}>{aviso.texto}</p>}

      {cargando ? <p className="text-slate-500">Cargando…</p> : filtrados.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-slate-500">
          {lista.length === 0 ? 'Aún no hay estudiantes matriculados. Empieza con "Matricular estudiante" o con Importar.' : 'Ningún estudiante coincide con la búsqueda.'}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-cielo text-left text-tinta">
              <tr>
                {admin && (
                  <th className="w-10 p-3">
                    <input type="checkbox" aria-label="Seleccionar todos" checked={todosMarcados} onChange={alternarTodos} />
                  </th>
                )}
                <th className="p-3">Nombre</th><th className="p-3">Documento</th><th className="p-3">Parroquia</th><th className="p-3">Cohorte</th><th className="p-3">Estado</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((e) => (
                <tr key={e.id} className={`border-t border-slate-100 hover:bg-slate-50 ${sel.has(e.id) ? 'bg-red-50' : ''}`}>
                  {admin && (
                    <td className="p-3">
                      <input type="checkbox" aria-label={`Seleccionar a ${e.nombre_completo}`} checked={sel.has(e.id)} onChange={() => alternar(e.id)} />
                    </td>
                  )}
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
