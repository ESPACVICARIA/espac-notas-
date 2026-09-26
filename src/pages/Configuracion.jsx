import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import NuevoUsuario from '../components/NuevoUsuario'
import { gestionarUsuarios, generarClave } from '../lib/usuarios'

const GRUPOS = [
  ['admin', 'Coordinación y administración', 'Acceso completo: estudiantes, módulos, importaciones y configuración.'],
  ['formador', 'Docentes (formadores)', 'Digitan notas solo en las cohortes y semestres que tengan asignados.'],
  ['estudiante', 'Cuentas de estudiante', 'Cuentas creadas en Supabase sin rol de trabajo. Los estudiantes del portal entran con su documento y no necesitan cuenta aquí.'],
]

const SECCIONES = [
  ['usuarios', 'Usuarios y roles', 'Crear cuentas, roles, nombres y contraseñas'],
  ['asignaciones', 'Asignación de formadores', 'Qué docente dicta cada semestre'],
  ['cohortes', 'Cohortes', 'Grupos, semestre en curso y visibilidad de notas'],
  ['centros', 'Centros de formación', 'Sedes como Suba y Cota'],
]

export default function Configuracion() {
  const [cohortes, setCohortes] = useState([])
  const [perfiles, setPerfiles] = useState([])
  const [asignaciones, setAsignaciones] = useState([])
  const [nueva, setNueva] = useState({ nombre: '', anio: new Date().getFullYear() })
  const [asig, setAsig] = useState({ formador_id: '', cohorte_id: '', semestre: '1' })
  const [error, setError] = useState('')
  const [centros, setCentros] = useState([])
  const [nuevoCentro, setNuevoCentro] = useState('')
  const [centroEdit, setCentroEdit] = useState(null)
  const [params, setParams] = useSearchParams()
  const seccion = SECCIONES.some(([k]) => k === params.get('seccion')) ? params.get('seccion') : 'usuarios'
  const irA = (k) => { setError(''); setParams({ seccion: k }, { replace: true }) }
  const [yo, setYo] = useState(null)
  const [selUsuarios, setSelUsuarios] = useState(new Set())
  const [aviso, setAviso] = useState('')
  const [editando, setEditando] = useState(null) // { id, nombre, anio }
  const [nombreEdit, setNombreEdit] = useState(null) // { id, nombre }

  async function cargar() {
    const { data: s } = await supabase.auth.getSession()
    setYo(s.session?.user.id ?? null)
    const [c, p, a, ce] = await Promise.all([
      supabase.from('cohortes').select('*, estudiantes!estudiantes_cohorte_id_fkey(count)').order('anio', { ascending: false }),
      supabase.from('perfiles').select('*').order('nombre'),
      supabase.from('asignaciones').select('*, perfiles(nombre, correo), cohortes(nombre)').order('semestre'),
      supabase.from('centros').select('*, estudiantes!estudiantes_centro_id_fkey(count), cohortes!cohortes_centro_id_fkey(count), perfiles!perfiles_centro_id_fkey(count)').order('nombre'),
    ])
    setCohortes(c.data ?? []); setPerfiles(p.data ?? []); setAsignaciones(a.data ?? []); setCentros(ce.data ?? [])
  }
  useEffect(() => { cargar() }, [])

  async function guardarCohorte() {
    if (!editando.nombre.trim()) { setError('La cohorte necesita un nombre.'); return }
    await ejecutar(supabase.from('cohortes').update({ nombre: editando.nombre.trim(), anio: editando.anio || null }).eq('id', editando.id))
    setEditando(null)
  }

  async function eliminarCohorte(c) {
    const total = c.estudiantes?.[0]?.count ?? 0
    const ok = confirm(
      `¿Eliminar la cohorte "${c.nombre}"?\n\n` +
      (total ? `Sus ${total} estudiante(s) NO se borran: quedarán "Sin cohorte" y conservan sus notas.\n` : 'No tiene estudiantes.\n') +
      'También se quitarán las asignaciones de formadores de esta cohorte.'
    )
    if (!ok) return
    ejecutar(supabase.from('cohortes').delete().eq('id', c.id))
  }

  async function cambiarClave(p) {
    const sugerida = generarClave()
    const clave = prompt(`Nueva contraseña para ${p.nombre || p.correo} (mínimo 8 caracteres).\n\nPuedes usar la sugerida o escribir otra:`, sugerida)
    if (clave === null) return
    setError(''); setAviso('')
    try {
      await gestionarUsuarios({ accion: 'cambiar_clave', id: p.id, clave: clave.trim() })
      setAviso(`Contraseña cambiada. Entrégale a ${p.nombre || p.correo} su nueva contraseña: ${clave.trim()}`)
    } catch (e) {
      setError(e.message)
    }
  }

  async function crearCentro(e) {
    e.preventDefault()
    if (!nuevoCentro.trim()) return
    await ejecutar(supabase.from('centros').insert({ nombre: nuevoCentro.trim() }))
    setNuevoCentro('')
  }
  async function guardarCentro() {
    if (!centroEdit.nombre.trim()) { setError('El centro necesita un nombre.'); return }
    await ejecutar(supabase.from('centros').update({ nombre: centroEdit.nombre.trim() }).eq('id', centroEdit.id))
    setCentroEdit(null)
  }
  function eliminarCentro(c) {
    const n = (r) => c[r]?.[0]?.count ?? 0
    const usado = n('estudiantes') + n('cohortes') + n('perfiles')
    if (!confirm(`¿Eliminar el centro "${c.nombre}"?${usado ? `\n\nTiene ${n('estudiantes')} estudiante(s), ${n('cohortes')} cohorte(s) y ${n('perfiles')} docente(s). No se borran: quedarán "sin centro".` : ''}`)) return
    ejecutar(supabase.from('centros').delete().eq('id', c.id))
  }

  async function guardarNombre() {
    if (!nombreEdit.nombre.trim()) { setError('Escribe el nombre como debe aparecer.'); return }
    await ejecutar(supabase.from('perfiles').update({ nombre: nombreEdit.nombre.trim() }).eq('id', nombreEdit.id))
    setNombreEdit(null)
  }

  function alternarUsuario(id) {
    setSelUsuarios((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  async function eliminarUsuarios(ids) {
    const nombres = perfiles.filter((p) => ids.includes(p.id)).map((p) => p.nombre || p.correo).join(', ')
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

  const conteos = {
    usuarios: perfiles.filter((p) => p.rol !== 'estudiante').length,
    asignaciones: asignaciones.length,
    cohortes: cohortes.length,
    centros: centros.length,
  }

  return (
    <section>
      <h1 className="text-3xl font-semibold">Configuración</h1>
      <p className="mb-6 text-sm text-slate-500">Elige qué quieres administrar.</p>
      <div className="md:grid md:grid-cols-[14rem_1fr] md:gap-8">
        <nav aria-label="Secciones de configuración" className="mb-6 flex gap-2 overflow-x-auto md:mb-0 md:flex-col md:overflow-visible">
          {SECCIONES.map(([k, titulo, detalle]) => (
            <button key={k} onClick={() => irA(k)} aria-current={seccion === k ? 'page' : undefined}
              className={`shrink-0 rounded-lg border px-4 py-3 text-left ${seccion === k ? 'border-mariano bg-cielo text-mariano' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}>
              <span className="flex items-center justify-between gap-3 text-sm font-semibold">
                {titulo}
                <span className="rounded-full bg-white px-2 text-xs font-normal text-slate-500 ring-1 ring-slate-200">{conteos[k]}</span>
              </span>
              <span className="hidden text-xs font-normal text-slate-500 md:block">{detalle}</span>
            </button>
          ))}
        </nav>
        <div className="min-w-0 space-y-4">

      {error && <p className="text-sm text-alerta">{error}</p>}

      {seccion === 'cohortes' && (<div>
        <h2 className="mb-3 text-xl font-semibold">Cohortes</h2>
        <form className="mb-4 flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); ejecutar(supabase.from('cohortes').insert(nueva)); setNueva({ ...nueva, nombre: '' }) }}>
          <input className="campo max-w-xs" required placeholder="Ej. Cohorte 2026-I" value={nueva.nombre} onChange={(e) => setNueva({ ...nueva, nombre: e.target.value })} />
          <input className="campo w-28" type="number" value={nueva.anio} onChange={(e) => setNueva({ ...nueva, anio: Number(e.target.value) })} />
          <button className="btn">Crear cohorte</button>
        </form>
        <ul className="text-sm">
          {cohortes.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-3 border-t border-slate-100 py-2">
              {editando?.id === c.id ? (
                <>
                  <input className="campo max-w-xs" value={editando.nombre} autoFocus
                    onChange={(e) => setEditando({ ...editando, nombre: e.target.value })}
                    onKeyDown={(e) => e.key === 'Enter' && guardarCohorte()} />
                  <input className="campo w-28" type="number" value={editando.anio ?? ''}
                    onChange={(e) => setEditando({ ...editando, anio: e.target.value ? Number(e.target.value) : null })} />
                  <button className="btn" onClick={guardarCohorte}>Guardar</button>
                  <button className="text-sm text-slate-500 underline" onClick={() => setEditando(null)}>Cancelar</button>
                </>
              ) : (
                <>
                  <span className="flex-1">
                    {c.nombre} <span className="text-slate-500">({c.anio ?? 'sin año'}) · {c.estudiantes?.[0]?.count ?? 0} estudiantes</span>
                  </span>
                  <label className="flex items-center gap-2 text-xs text-slate-600">
                    Centro
                    <select className="campo w-auto py-1" value={c.centro_id ?? ''}
                      onChange={(e) => ejecutar(supabase.from('cohortes').update({ centro_id: e.target.value ? Number(e.target.value) : null }).eq('id', c.id))}>
                      <option value="">Sin centro</option>
                      {centros.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
                    </select>
                  </label>
                  <label className="flex items-center gap-2 text-xs text-slate-600">
                    Semestre en curso
                    <select className="campo w-auto py-1" value={c.semestre_actual ?? ''}
                      onChange={(e) => ejecutar(supabase.from('cohortes').update({ semestre_actual: e.target.value ? Number(e.target.value) : null }).eq('id', c.id))}>
                      <option value="">Sin definir</option>
                      {[1, 2, 3, 4].map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </label>
                  <label className="flex items-center gap-2 text-xs text-slate-600" title="Si está desactivado, los estudiantes solo ven el semestre en curso">
                    <input type="checkbox" checked={!!c.ver_todas_notas}
                      onChange={(e) => ejecutar(supabase.from('cohortes').update({ ver_todas_notas: e.target.checked }).eq('id', c.id))} />
                    Estudiantes pueden ver todas sus notas
                  </label>
                  <button className="text-xs font-semibold text-mariano underline" onClick={() => setEditando({ id: c.id, nombre: c.nombre, anio: c.anio })}>Modificar</button>
                  <button className="text-xs font-semibold text-alerta underline" onClick={() => eliminarCohorte(c)}>Eliminar</button>
                </>
              )}
            </li>
          ))}
        </ul>
      </div>)}

      {seccion === 'usuarios' && (<div>
        <h2 className="mb-1 text-xl font-semibold">Usuarios y roles</h2>
        <p className="mb-3 text-sm text-slate-500">
          Usa "Crear usuario" para dar acceso a un docente o a la coordinación.
          El nombre es el que aparece en planillas, itinerarios y PDF: escríbelo con su título, por ejemplo "Pbro. Juan Pérez" o "Diác. Germán Velandia".
        </p>
        <NuevoUsuario alCrear={cargar} />
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
        <div className="space-y-6">
          {GRUPOS.map(([rol, titulo, descripcion]) => {
            const lista = perfiles.filter((p) => p.rol === rol)
            const marcables = lista.filter((p) => p.id !== yo)
            const todos = marcables.length > 0 && marcables.every((p) => selUsuarios.has(p.id))
            return (
              <div key={rol} className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                <div className="flex flex-wrap items-center justify-between gap-2 bg-cielo px-4 py-2">
                  <div>
                    <h3 className="font-serif text-base font-semibold">{titulo} <span className="font-sans text-sm font-normal text-slate-500">({lista.length})</span></h3>
                    <p className="text-xs text-slate-600">{descripcion}</p>
                  </div>
                  {marcables.length > 0 && (
                    <label className="flex items-center gap-2 text-xs">
                      <input type="checkbox" checked={todos} onChange={() => setSelUsuarios((sel) => {
                        const n = new Set(sel)
                        marcables.forEach((p) => (todos ? n.delete(p.id) : n.add(p.id)))
                        return n
                      })} />
                      Seleccionar todos
                    </label>
                  )}
                </div>
                {lista.length === 0 ? (
                  <p className="p-4 text-sm text-slate-500">No hay usuarios en este grupo.</p>
                ) : (
                  <table className="w-full text-sm">
                    <tbody>
                      {lista.map((p) => {
                        const esYo = p.id === yo
                        return (
                        <tr key={p.id} className={`border-t border-slate-100 first:border-t-0 ${selUsuarios.has(p.id) ? 'bg-red-50' : ''}`}>
                          <td className="w-10 py-2 pl-4">
                            <input type="checkbox" disabled={esYo} aria-label={`Seleccionar a ${p.nombre}`}
                              checked={selUsuarios.has(p.id)} onChange={() => alternarUsuario(p.id)} />
                          </td>
                          <td className="py-2">
                            {nombreEdit?.id === p.id ? (
                              <div className="flex flex-wrap items-center gap-2">
                                <input className="campo max-w-xs" autoFocus value={nombreEdit.nombre}
                                  onChange={(e) => setNombreEdit({ ...nombreEdit, nombre: e.target.value })}
                                  onKeyDown={(e) => e.key === 'Enter' && guardarNombre()} />
                                <button className="btn py-1" onClick={guardarNombre}>Guardar</button>
                                <button className="text-sm text-slate-500 underline" onClick={() => setNombreEdit(null)}>Cancelar</button>
                              </div>
                            ) : (
                              <>
                                {p.nombre || <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">Falta el nombre</span>}{' '}
                                {esYo && <span className="text-xs text-oro">(tú)</span>}{' '}
                                <button className="text-xs text-mariano underline" onClick={() => setNombreEdit({ id: p.id, nombre: p.nombre ?? '' })}>Cambiar nombre</button>
                              </>
                            )}
                            <br /><span className="text-xs text-slate-500">{p.correo}</span>
                          </td>
                          <td className="py-2 pr-4 text-right">
                            <div className="flex items-center justify-end gap-3">
                              {p.rol !== 'estudiante' && (
                                <select className="campo w-32 py-1 text-xs" aria-label={`Centro de ${p.nombre || p.correo}`} value={p.centro_id ?? ''}
                                  onChange={(e) => ejecutar(supabase.from('perfiles').update({ centro_id: e.target.value ? Number(e.target.value) : null }).eq('id', p.id))}>
                                  <option value="">Todos los centros</option>
                                  {centros.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
                                </select>
                              )}
                              <select className="campo w-40" value={p.rol} disabled={esYo}
                                onChange={(e) => ejecutar(supabase.from('perfiles').update({ rol: e.target.value }).eq('id', p.id))}>
                                <option value="admin">Coordinación</option><option value="formador">Docente (formador)</option><option value="estudiante">Estudiante</option>
                              </select>
                              {p.rol !== 'estudiante' && (
                                <button onClick={() => cambiarClave(p)} className="text-xs font-semibold text-mariano underline">Cambiar contraseña</button>
                              )}
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
                )}
              </div>
            )
          })}
        </div>
      </div>)}

      {seccion === 'asignaciones' && (<div>
        <h2 className="mb-1 text-xl font-semibold">Asignación de formadores</h2>
        <p className="mb-3 text-sm text-slate-500">Cada formador solo puede digitar notas del semestre y la cohorte que tenga asignados.</p>
        <form className="mb-4 flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); ejecutar(supabase.from('asignaciones').insert({ ...asig, semestre: Number(asig.semestre) })) }}>
          <select className="campo max-w-xs" required value={asig.formador_id} onChange={(e) => setAsig({ ...asig, formador_id: e.target.value })}>
            <option value="">Formador</option>
            {perfiles.filter((p) => p.rol !== 'estudiante').map((p) => <option key={p.id} value={p.id}>{p.nombre || `${p.correo} (sin nombre)`}</option>)}
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
              <span>{a.perfiles?.nombre || <span className="text-amber-700">{a.perfiles?.correo} (sin nombre)</span>} · {a.cohortes?.nombre} · Semestre {a.semestre}</span>
              <button className="text-xs text-alerta underline" onClick={() => ejecutar(supabase.from('asignaciones').delete().eq('id', a.id))}>Quitar</button>
            </li>
          ))}
        </ul>
      </div>)}
      {seccion === 'centros' && (<div>
        <h2 className="mb-1 text-xl font-semibold">Centros de formación</h2>
        <p className="mb-3 text-sm text-slate-500">Cada estudiante, cohorte y docente puede pertenecer a un centro. Así puedes filtrar y organizar por sede.</p>
        <form className="mb-4 flex flex-wrap gap-2" onSubmit={crearCentro}>
          <input className="campo max-w-xs" placeholder="Nombre del centro" value={nuevoCentro} onChange={(e) => setNuevoCentro(e.target.value)} />
          <button className="btn">Crear centro</button>
        </form>
        <ul className="rounded-lg border border-slate-200 bg-white text-sm">
          {centros.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-3 border-t border-slate-100 px-4 py-3 first:border-t-0">
              {centroEdit?.id === c.id ? (
                <>
                  <input className="campo max-w-xs" autoFocus value={centroEdit.nombre}
                    onChange={(e) => setCentroEdit({ ...centroEdit, nombre: e.target.value })}
                    onKeyDown={(e) => e.key === 'Enter' && guardarCentro()} />
                  <button className="btn py-1" onClick={guardarCentro}>Guardar</button>
                  <button className="text-sm text-slate-500 underline" onClick={() => setCentroEdit(null)}>Cancelar</button>
                </>
              ) : (
                <>
                  <span className="flex-1 font-medium">{c.nombre}
                    <span className="ml-2 font-normal text-slate-500">
                      {c.estudiantes?.[0]?.count ?? 0} estudiantes · {c.cohortes?.[0]?.count ?? 0} cohortes · {c.perfiles?.[0]?.count ?? 0} docentes
                    </span>
                  </span>
                  <button className="text-xs font-semibold text-mariano underline" onClick={() => setCentroEdit({ id: c.id, nombre: c.nombre })}>Modificar</button>
                  <button className="text-xs font-semibold text-alerta underline" onClick={() => eliminarCentro(c)}>Eliminar</button>
                </>
              )}
            </li>
          ))}
          {centros.length === 0 && <li className="p-4 text-slate-500">Aún no hay centros.</li>}
        </ul>
      </div>)}
        </div>
      </div>
    </section>
  )
}
