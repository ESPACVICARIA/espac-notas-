import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const TIPOS = [['modulo', 'Módulo'], ['retiro', 'Retiro'], ['seminario', 'Seminario']]

export default function Modulos() {
  const [espacios, setEspacios] = useState([])
  const [borrador, setBorrador] = useState({}) // { id: { etiqueta, nombre, tipo, semestre } }
  const [mensaje, setMensaje] = useState(null)
  const [trabajando, setTrabajando] = useState(false)

  async function cargar() {
    const { data, error } = await supabase.from('espacios').select('*, notas(count), actividades(count)')
      .order('semestre').order('orden').order('id')
    if (error) setMensaje({ tipo: 'error', texto: error.message })
    setEspacios(data ?? [])
  }
  useEffect(() => { cargar() }, [])

  const deSemestre = (s) => espacios.filter((e) => e.semestre === s)
  const valor = (e, k) => borrador[e.id]?.[k] ?? e[k]
  const cambiar = (e, k, v) => setBorrador((b) => ({ ...b, [e.id]: { ...b[e.id], [k]: v } }))
  const conteo = (e, rel) => e[rel]?.[0]?.count ?? 0

  async function correr(tarea, exito) {
    setTrabajando(true); setMensaje(null)
    try {
      await tarea()
      if (exito) setMensaje({ tipo: 'ok', texto: exito })
    } catch (err) {
      setMensaje({ tipo: 'error', texto: err.message })
    }
    await cargar()
    setTrabajando(false)
  }
  const falla = (r) => { if (r.error) throw r.error; return r }

  function guardar(e) {
    const b = borrador[e.id]
    if (!b) return
    const cambios = { ...b }
    if (cambios.etiqueta !== undefined && !cambios.etiqueta.trim()) { setMensaje({ tipo: 'error', texto: 'La etiqueta no puede quedar vacía.' }); return }
    if (cambios.nombre !== undefined && !cambios.nombre.trim()) { setMensaje({ tipo: 'error', texto: 'El nombre no puede quedar vacío.' }); return }
    if (cambios.semestre !== undefined) {
      cambios.semestre = Number(cambios.semestre)
      if (cambios.semestre !== e.semestre) cambios.orden = Math.max(0, ...deSemestre(cambios.semestre).map((x) => x.orden)) + 1
    }
    correr(async () => {
      falla(await supabase.from('espacios').update(cambios).eq('id', e.id))
      setBorrador((x) => { const n = { ...x }; delete n[e.id]; return n })
    }, `"${cambios.nombre ?? e.nombre}" actualizado.`)
  }

  function mover(e, paso) {
    const lista = deSemestre(e.semestre)
    const i = lista.findIndex((x) => x.id === e.id)
    const j = i + paso
    if (j < 0 || j >= lista.length) return
    const nueva = [...lista]
    ;[nueva[i], nueva[j]] = [nueva[j], nueva[i]]
    correr(async () => {
      for (const [k, x] of nueva.entries()) {
        if (x.orden !== k + 1) falla(await supabase.from('espacios').update({ orden: k + 1 }).eq('id', x.id))
      }
    })
  }

  function agregar(s) {
    const orden = Math.max(0, ...deSemestre(s).map((x) => x.orden)) + 1
    correr(async () => {
      falla(await supabase.from('espacios').insert({ semestre: s, orden, tipo: 'modulo', etiqueta: 'Nuevo módulo', nombre: 'Escribe el nombre', activo: true }))
    }, `Se agregó un espacio al semestre ${s}. Cambia su etiqueta y nombre, y pulsa Guardar.`)
  }

  function eliminar(e) {
    const notas = conteo(e, 'notas')
    if (notas > 0) {
      const ok = confirm(
        `"${e.nombre}" tiene ${notas} nota(s) registradas y no se puede eliminar sin perderlas.\n\n` +
        '¿Quieres archivarlo? Dejará de aparecer para digitar notas, pero los estudiantes que ya lo cursaron lo conservarán en su itinerario.'
      )
      if (ok) correr(async () => { falla(await supabase.from('espacios').update({ activo: false }).eq('id', e.id)) }, `"${e.nombre}" archivado.`)
      return
    }
    const acts = conteo(e, 'actividades')
    const ok = confirm(`¿Eliminar "${e.etiqueta} · ${e.nombre}"?${acts ? `\n\nTambién se borrarán sus ${acts} actividad(es) de contenidos.` : ''}\n\nEsta acción no se puede deshacer.`)
    if (ok) correr(async () => { falla(await supabase.from('espacios').delete().eq('id', e.id)) }, 'Espacio eliminado.')
  }

  function reactivar(e) {
    correr(async () => { falla(await supabase.from('espacios').update({ activo: true }).eq('id', e.id)) }, `"${e.nombre}" está activo otra vez.`)
  }

  return (
    <section>
      <h1 className="text-3xl font-semibold">Módulos del itinerario</h1>
      <p className="mb-6 max-w-3xl text-sm text-slate-500">
        Organiza los módulos, retiros y seminarios de cada semestre. Los cambios de nombre se ven de inmediato en planillas,
        itinerarios y PDF. Un espacio con notas no se elimina: se archiva para conservar el historial de los estudiantes.
      </p>
      {mensaje && <p className={`mb-4 text-sm ${mensaje.tipo === 'error' ? 'text-alerta' : 'text-green-700'}`}>{mensaje.texto}</p>}

      <div className="space-y-8">
        {[1, 2, 3, 4].map((s) => (
          <div key={s} className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <div className="flex items-center justify-between bg-tinta px-4 py-2 text-white">
              <h2 className="font-serif text-base font-semibold">Semestre {s}</h2>
              <button className="text-sm text-blue-100 underline hover:text-white" disabled={trabajando} onClick={() => agregar(s)}>Agregar espacio</button>
            </div>
            <table className="w-full min-w-[860px] text-sm">
              <thead className="bg-cielo text-left">
                <tr>
                  <th className="p-2">Orden</th><th className="p-2">Tipo</th><th className="p-2">Etiqueta</th>
                  <th className="p-2">Nombre</th><th className="p-2">Semestre</th><th className="p-2">Notas</th><th className="p-2" />
                </tr>
              </thead>
              <tbody>
                {deSemestre(s).map((e, i, lista) => {
                  const sucio = !!borrador[e.id]
                  const archivado = e.activo === false
                  return (
                    <tr key={e.id} className={`border-t border-slate-100 ${archivado ? 'bg-slate-50 text-slate-400' : ''} ${sucio ? 'bg-amber-50' : ''}`}>
                      <td className="p-2 whitespace-nowrap">
                        <button className="px-1 text-mariano disabled:text-slate-300" aria-label="Subir" disabled={trabajando || i === 0} onClick={() => mover(e, -1)}>▲</button>
                        <button className="px-1 text-mariano disabled:text-slate-300" aria-label="Bajar" disabled={trabajando || i === lista.length - 1} onClick={() => mover(e, 1)}>▼</button>
                      </td>
                      <td className="p-2">
                        <select className="campo w-32 py-1" value={valor(e, 'tipo')} onChange={(ev) => cambiar(e, 'tipo', ev.target.value)}>
                          {TIPOS.map(([k, t]) => <option key={k} value={k}>{t}</option>)}
                        </select>
                      </td>
                      <td className="p-2"><input className="campo w-32 py-1" value={valor(e, 'etiqueta')} onChange={(ev) => cambiar(e, 'etiqueta', ev.target.value)} /></td>
                      <td className="p-2"><input className="campo py-1" value={valor(e, 'nombre')} onChange={(ev) => cambiar(e, 'nombre', ev.target.value)} /></td>
                      <td className="p-2">
                        <select className="campo w-20 py-1" value={valor(e, 'semestre')} onChange={(ev) => cambiar(e, 'semestre', ev.target.value)}>
                          {[1, 2, 3, 4].map((x) => <option key={x} value={x}>{x}</option>)}
                        </select>
                      </td>
                      <td className="p-2 tabular-nums">{conteo(e, 'notas')}</td>
                      <td className="p-2 whitespace-nowrap text-right">
                        {sucio && <button className="btn mr-2 py-1" disabled={trabajando} onClick={() => guardar(e)}>Guardar</button>}
                        {archivado ? (
                          <button className="text-xs font-semibold text-mariano underline" onClick={() => reactivar(e)}>Reactivar</button>
                        ) : (
                          <button className="text-xs font-semibold text-alerta underline" disabled={trabajando} onClick={() => eliminar(e)}>
                            {conteo(e, 'notas') > 0 ? 'Archivar' : 'Eliminar'}
                          </button>
                        )}
                        {archivado && <span className="ml-2 text-xs">Archivado</span>}
                      </td>
                    </tr>
                  )
                })}
                {deSemestre(s).length === 0 && (
                  <tr><td colSpan={7} className="p-4 text-center text-slate-500">Este semestre no tiene espacios. Usa "Agregar espacio".</td></tr>
                )}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </section>
  )
}
