import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { traerTodo } from '../lib/exportar'
import { ordenarEstudiantes, mostrarNombre } from '../lib/planilla'

const fecha = (f) => new Date(f).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })

export default function Mensajes({ perfil }) {
  const admin = perfil?.rol === 'admin'
  const [centros, setCentros] = useState([])
  const [cohortes, setCohortes] = useState([])
  const [estudiantes, setEstudiantes] = useState([])
  const [enviados, setEnviados] = useState([])
  const [resumen, setResumen] = useState({})
  const [form, setForm] = useState({ destino: admin ? 'todos' : 'cohorte', centro_id: '', cohorte_id: '', asunto: '', cuerpo: '' })
  const [elegidos, setElegidos] = useState(new Set())
  const [buscar, setBuscar] = useState('')
  const [filtroCoh, setFiltroCoh] = useState('')
  const [abierto, setAbierto] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [mensaje, setMensaje] = useState(null)

  async function cargarEnviados() {
    const [{ data: ms }, { data: rs }] = await Promise.all([
      supabase.from('mensajes').select('*, centros(nombre), cohortes(nombre), mensajes_destinatarios(count)').order('creado', { ascending: false }).limit(100),
      supabase.rpc('resumen_mensajes'),
    ])
    setEnviados(ms ?? [])
    setResumen(Object.fromEntries((rs ?? []).map((r) => [r.id, r])))
  }

  useEffect(() => {
    (async () => {
      const [{ data: ce }, { data: co }, ests] = await Promise.all([
        supabase.from('centros').select('id, nombre').order('nombre'),
        admin
          ? supabase.from('cohortes').select('id, nombre, anio').order('anio', { ascending: false })
          : supabase.from('asignaciones').select('cohortes(id, nombre, anio)').eq('formador_id', perfil.id),
        traerTodo(() => supabase.from('estudiantes').select('id, nombre_completo, numero_id, cohorte_id, estado').eq('estado', 'activo').order('id')),
      ])
      setCentros(ce ?? [])
      const lista = admin ? (co ?? []) : [...new Map((co ?? []).map((a) => a.cohortes).filter(Boolean).map((c) => [c.id, c])).values()]
      setCohortes(lista)
      setEstudiantes(ests)
    })()
    cargarEnviados()
  }, [admin, perfil?.id])

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  const visibles = useMemo(() => {
    const q = buscar.toLowerCase().trim()
    return ordenarEstudiantes(estudiantes.filter((e) =>
      (!filtroCoh || String(e.cohorte_id) === filtroCoh) &&
      (!q || e.nombre_completo.toLowerCase().includes(q) || (e.numero_id ?? '').includes(q))), 'apellidos')
  }, [estudiantes, buscar, filtroCoh])
  const alternar = (id) => setElegidos((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })

  const alcance = form.destino === 'todos' ? estudiantes.length
    : form.destino === 'cohorte' ? estudiantes.filter((e) => String(e.cohorte_id) === form.cohorte_id).length
    : form.destino === 'estudiantes' ? elegidos.size : null

  async function enviar(e) {
    e.preventDefault()
    setMensaje(null)
    if (form.destino === 'centro' && !form.centro_id) { setMensaje({ tipo: 'error', texto: 'Elige el centro.' }); return }
    if (form.destino === 'cohorte' && !form.cohorte_id) { setMensaje({ tipo: 'error', texto: 'Elige la cohorte.' }); return }
    if (form.destino === 'estudiantes' && !elegidos.size) { setMensaje({ tipo: 'error', texto: 'Marca al menos un estudiante.' }); return }
    setEnviando(true)
    try {
      const { data: m, error } = await supabase.from('mensajes').insert({
        asunto: form.asunto.trim(), cuerpo: form.cuerpo.trim(), destino: form.destino,
        centro_id: form.destino === 'centro' ? Number(form.centro_id) : null,
        cohorte_id: form.destino === 'cohorte' ? Number(form.cohorte_id) : null,
      }).select('id').single()
      if (error) throw error
      if (form.destino === 'estudiantes') {
        const filas = [...elegidos].map((id) => ({ mensaje_id: m.id, estudiante_id: id }))
        for (let i = 0; i < filas.length; i += 200) {
          const { error: e2 } = await supabase.from('mensajes_destinatarios').insert(filas.slice(i, i + 200))
          if (e2) { await supabase.from('mensajes').delete().eq('id', m.id); throw e2 }
        }
      }
      setMensaje({ tipo: 'ok', texto: 'Mensaje enviado. Los estudiantes lo verán en la pestaña Mensajes de su portal.' })
      setForm((f) => ({ ...f, asunto: '', cuerpo: '' })); setElegidos(new Set())
      cargarEnviados()
    } catch (err) {
      setMensaje({ tipo: 'error', texto: `No se pudo enviar: ${err.message}` })
    }
    setEnviando(false)
  }

  async function eliminar(m) {
    if (!confirm(`¿Eliminar el mensaje "${m.asunto}"? Los estudiantes dejarán de verlo.`)) return
    const { error } = await supabase.from('mensajes').delete().eq('id', m.id)
    if (error) setMensaje({ tipo: 'error', texto: error.message })
    cargarEnviados()
  }

  const describir = (m) => m.destino === 'todos' ? 'Todos los estudiantes'
    : m.destino === 'centro' ? `Centro ${m.centros?.nombre ?? ''}`
    : m.destino === 'cohorte' ? `Cohorte ${m.cohortes?.nombre ?? ''}`
    : `${m.mensajes_destinatarios?.[0]?.count ?? 0} estudiante(s)`

  const opcion = (v, t) => (
    <label key={v} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${form.destino === v ? 'border-mariano bg-cielo font-semibold text-mariano' : 'border-slate-200 bg-white'}`}>
      <input type="radio" name="destino" className="sr-only" checked={form.destino === v} onChange={() => set('destino', v)} />{t}
    </label>
  )

  return (
    <section>
      <h1 className="text-3xl font-semibold">Mensajes</h1>
      <p className="mb-6 text-sm text-slate-500">Envía avisos a tus estudiantes. Los leen en la pestaña Mensajes de su portal.</p>

      <form onSubmit={enviar} className="mb-10 space-y-4 rounded-lg border border-slate-200 bg-white p-5">
        <div>
          <p className="etiqueta">Para</p>
          <div className="flex flex-wrap gap-2">
            {admin && opcion('todos', 'Todos los estudiantes')}
            {admin && opcion('centro', 'Un centro')}
            {opcion('cohorte', 'Una cohorte')}
            {opcion('estudiantes', 'Estudiantes específicos')}
          </div>
        </div>

        {form.destino === 'centro' && (
          <select className="campo max-w-xs" value={form.centro_id} onChange={(e) => set('centro_id', e.target.value)} aria-label="Centro">
            <option value="">Elige el centro</option>
            {centros.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        )}
        {form.destino === 'cohorte' && (
          cohortes.length ? (
            <select className="campo max-w-xs" value={form.cohorte_id} onChange={(e) => set('cohorte_id', e.target.value)} aria-label="Cohorte">
              <option value="">Elige la cohorte</option>
              {cohortes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          ) : <p className="text-sm text-amber-700">No tienes cohortes asignadas.</p>
        )}
        {form.destino === 'estudiantes' && (
          <div className="rounded-lg border border-slate-200">
            <div className="flex flex-wrap gap-2 border-b border-slate-200 bg-slate-50 p-3">
              <input className="campo max-w-xs" placeholder="Buscar nombre o documento" value={buscar} onChange={(e) => setBuscar(e.target.value)} />
              <select className="campo w-auto" value={filtroCoh} onChange={(e) => setFiltroCoh(e.target.value)} aria-label="Filtrar por cohorte">
                <option value="">Todas las cohortes</option>
                {cohortes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
              <button type="button" className="text-sm text-mariano underline" onClick={() => setElegidos((s) => new Set([...s, ...visibles.map((e) => e.id)]))}>Marcar los que se ven</button>
              {elegidos.size > 0 && <button type="button" className="text-sm text-slate-500 underline" onClick={() => setElegidos(new Set())}>Quitar todos</button>}
            </div>
            <ul className="max-h-64 overflow-y-auto">
              {visibles.map((e) => (
                <li key={e.id}>
                  <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-slate-50">
                    <input type="checkbox" checked={elegidos.has(e.id)} onChange={() => alternar(e.id)} />
                    {mostrarNombre(e, 'apellidos')}
                    <span className="text-xs text-slate-400">{e.numero_id}</span>
                  </label>
                </li>
              ))}
              {!visibles.length && <li className="p-3 text-sm text-slate-500">Ningún estudiante coincide.</li>}
            </ul>
          </div>
        )}

        <div>
          <label className="etiqueta" htmlFor="asunto">Asunto</label>
          <input id="asunto" required maxLength={150} className="campo" placeholder="Ej. Cambio de horario del retiro" value={form.asunto} onChange={(e) => set('asunto', e.target.value)} />
        </div>
        <div>
          <label className="etiqueta" htmlFor="cuerpo">Mensaje</label>
          <textarea id="cuerpo" required rows={5} maxLength={5000} className="campo" value={form.cuerpo} onChange={(e) => set('cuerpo', e.target.value)} />
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <button className="btn" disabled={enviando}>{enviando ? 'Enviando…' : 'Enviar mensaje'}</button>
          {alcance !== null && <span className="text-sm text-slate-500">Lo recibirán {alcance} estudiante(s) activo(s).</span>}
          {mensaje && <p className={`text-sm ${mensaje.tipo === 'error' ? 'text-alerta' : 'text-green-700'}`}>{mensaje.texto}</p>}
        </div>
      </form>

      <h2 className="mb-3 text-xl font-semibold">{admin ? 'Mensajes enviados' : 'Mis mensajes enviados'}</h2>
      {!enviados.length ? (
        <p className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-slate-500">Aún no se ha enviado ningún mensaje.</p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
          {enviados.map((m) => {
            const r = resumen[m.id]
            return (
              <li key={m.id} className="p-4">
                <div className="flex flex-wrap items-start gap-3">
                  <button className="min-w-0 flex-1 text-left" onClick={() => setAbierto(abierto === m.id ? null : m.id)} aria-expanded={abierto === m.id}>
                    <p className="font-medium text-mariano">{m.asunto}</p>
                    <p className="text-xs text-slate-500">{describir(m)} · {fecha(m.creado)}{admin && m.autor_nombre ? ` · ${m.autor_nombre}` : ''}</p>
                  </button>
                  {r && <span className="rounded-full bg-cielo px-3 py-1 text-xs font-semibold text-mariano">Leído por {r.leidos} de {r.total}</span>}
                  <button className="text-xs font-semibold text-alerta underline" onClick={() => eliminar(m)}>Eliminar</button>
                </div>
                {abierto === m.id && <p className="mt-3 whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-sm">{m.cuerpo}</p>}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
