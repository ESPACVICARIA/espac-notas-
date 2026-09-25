import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { exportarEstudiantes, traerTodo } from '../lib/exportar'
import { ordenarEstudiantes, mostrarNombre } from '../lib/planilla'

const SIN_COHORTE = 'sin'

export default function Estudiantes({ perfil }) {
  const admin = perfil?.rol === 'admin'
  const [lista, setLista] = useState([])
  const [cohortes, setCohortes] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [filtroCohorte, setFiltroCohorte] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [orden, setOrden] = useState('apellidos')
  const [agrupar, setAgrupar] = useState(true)
  const [cargando, setCargando] = useState(true)
  const [sel, setSel] = useState(new Set())
  const [aviso, setAviso] = useState(null)
  const [eliminando, setEliminando] = useState(false)
  const [exportando, setExportando] = useState(false)

  async function cargar() {
    try {
      const [ests, { data: cs }] = await Promise.all([
        traerTodo(() => supabase.from('estudiantes')
          .select('id, nombre_completo, numero_id, parroquia, estado, cohorte_id, cohortes(nombre)').order('id')),
        supabase.from('cohortes').select('id, nombre, anio').order('anio', { ascending: false }).order('nombre'),
      ])
      setLista(ests)
      setCohortes(cs ?? [])
    } catch (e) {
      setAviso({ tipo: 'error', texto: `No se pudieron cargar los estudiantes: ${e.message}` })
    }
    setCargando(false)
  }
  useEffect(() => { cargar() }, [])

  const filtrados = useMemo(() => {
    const q = busqueda.toLowerCase().trim()
    const res = lista.filter((e) => {
      if (filtroCohorte === SIN_COHORTE ? e.cohorte_id : filtroCohorte && String(e.cohorte_id) !== filtroCohorte) return false
      if (filtroEstado && e.estado !== filtroEstado) return false
      return !q || e.nombre_completo.toLowerCase().includes(q) || (e.numero_id ?? '').toLowerCase().includes(q)
    })
    return ordenarEstudiantes(res, orden)
  }, [lista, busqueda, filtroCohorte, filtroEstado, orden])

  // Grupos en el mismo orden de las cohortes (más recientes primero); "Sin cohorte" al final
  const grupos = useMemo(() => {
    if (!agrupar) return [{ clave: 'todos', titulo: null, items: filtrados }]
    const porCohorte = new Map()
    for (const e of filtrados) {
      const k = e.cohorte_id ?? SIN_COHORTE
      if (!porCohorte.has(k)) porCohorte.set(k, [])
      porCohorte.get(k).push(e)
    }
    const res = cohortes.filter((c) => porCohorte.has(c.id))
      .map((c) => ({ clave: c.id, titulo: `${c.nombre}${c.anio ? ` (${c.anio})` : ''}`, items: porCohorte.get(c.id) }))
    if (porCohorte.has(SIN_COHORTE)) res.push({ clave: SIN_COHORTE, titulo: 'Sin cohorte', items: porCohorte.get(SIN_COHORTE) })
    return res
  }, [agrupar, filtrados, cohortes])

  function alternar(id) {
    setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function alternarVarios(items) {
    const todos = items.length > 0 && items.every((e) => sel.has(e.id))
    setSel((s) => { const n = new Set(s); items.forEach((e) => (todos ? n.delete(e.id) : n.add(e.id))); return n })
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

  const hayFiltros = busqueda || filtroCohorte || filtroEstado
  const limpiar = () => { setBusqueda(''); setFiltroCohorte(''); setFiltroEstado('') }

  return (
    <section>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Estudiantes</h1>
          <p className="text-sm text-slate-500">
            {hayFiltros ? `${filtrados.length} de ${lista.length} estudiantes` : `${lista.length} catequistas en formación`}
          </p>
        </div>
        {admin && <Link to="/estudiantes/nuevo" className="btn">Matricular estudiante</Link>}
      </div>

      <div className="mb-4 grid gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="etiqueta" htmlFor="buscar">Buscar</label>
          <input id="buscar" className="campo" placeholder="Nombre o documento"
            value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
        </div>
        <div>
          <label className="etiqueta" htmlFor="fcoh">Cohorte</label>
          <select id="fcoh" className="campo" value={filtroCohorte} onChange={(e) => setFiltroCohorte(e.target.value)}>
            <option value="">Todas las cohortes</option>
            {cohortes.map((c) => <option key={c.id} value={c.id}>{c.nombre}{c.anio ? ` (${c.anio})` : ''}</option>)}
            <option value={SIN_COHORTE}>Sin cohorte</option>
          </select>
        </div>
        <div>
          <label className="etiqueta" htmlFor="fest">Estado</label>
          <select id="fest" className="campo" value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
            <option value="">Todos</option>
            <option value="activo">Activos</option>
            <option value="retirado">Retirados</option>
            <option value="graduado">Graduados</option>
          </select>
        </div>
        <div>
          <label className="etiqueta" htmlFor="ford">Ordenar por</label>
          <select id="ford" className="campo" value={orden} onChange={(e) => setOrden(e.target.value)}>
            <option value="apellidos">Apellidos</option>
            <option value="nombres">Nombres</option>
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-4 sm:col-span-2 lg:col-span-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={agrupar} onChange={(e) => setAgrupar(e.target.checked)} />
            Agrupar por cohorte
          </label>
          {hayFiltros && <button onClick={limpiar} className="text-sm text-mariano underline">Quitar filtros</button>}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
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
          {lista.length === 0 ? 'Aún no hay estudiantes matriculados. Empieza con "Matricular estudiante" o con Importar.' : 'Ningún estudiante coincide con los filtros.'}
        </p>
      ) : (
        <div className="space-y-6">
          {grupos.map((g) => {
            const todos = g.items.every((e) => sel.has(e.id))
            return (
              <div key={g.clave} className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                {g.titulo && (
                  <div className="flex items-center justify-between bg-tinta px-4 py-2 text-white">
                    <h2 className="font-serif text-base font-semibold">{g.titulo}</h2>
                    <span className="text-sm text-blue-100">{g.items.length} estudiante(s)</span>
                  </div>
                )}
                <table className="w-full text-sm">
                  <thead className="bg-cielo text-left text-tinta">
                    <tr>
                      {admin && (
                        <th className="w-10 p-3">
                          <input type="checkbox" aria-label={`Seleccionar todos${g.titulo ? ` de ${g.titulo}` : ''}`}
                            checked={todos} onChange={() => alternarVarios(g.items)} />
                        </th>
                      )}
                      <th className="p-3">Nombre</th><th className="p-3">Documento</th><th className="p-3">Parroquia</th>
                      {!agrupar && <th className="p-3">Cohorte</th>}
                      <th className="p-3">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.items.map((e) => (
                      <tr key={e.id} className={`border-t border-slate-100 hover:bg-slate-50 ${sel.has(e.id) ? 'bg-red-50' : ''}`}>
                        {admin && (
                          <td className="p-3">
                            <input type="checkbox" aria-label={`Seleccionar a ${e.nombre_completo}`} checked={sel.has(e.id)} onChange={() => alternar(e.id)} />
                          </td>
                        )}
                        <td className="p-3"><Link to={`/estudiantes/${e.id}`} className="font-medium text-mariano hover:underline">{mostrarNombre(e, orden)}</Link></td>
                        <td className="p-3 tabular-nums">{e.numero_id}</td>
                        <td className="p-3">{e.parroquia}</td>
                        {!agrupar && <td className="p-3">{e.cohortes?.nombre ?? '—'}</td>}
                        <td className="p-3 capitalize">{e.estado}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
