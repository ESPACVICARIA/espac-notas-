import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import BloquesEditor from '../components/BloquesEditor'
import BloquesVista from '../components/BloquesVista'
import { LECCIONES_INTERACTIVAS, limpiarBloque, revisarBloque, nuevoId } from '../lib/bloques'
import { mostrarNombre, ordenarEstudiantes } from '../lib/planilla'

const VACIA = { titulo: '', resumen: '', bloques: [], publicada: false }
const desdeFila = (l) => ({ titulo: l.titulo, resumen: l.resumen ?? '', bloques: l.bloques ?? [], publicada: l.publicada })

export default function Estudio({ perfil }) {
  const admin = perfil?.rol === 'admin'
  const [espacios, setEspacios] = useState([])
  const [permitidos, setPermitidos] = useState([])
  const [semestre, setSemestre] = useState('')
  const [espacioId, setEspacioId] = useState('')
  const [lecciones, setLecciones] = useState([])
  const [lecturas, setLecturas] = useState({})
  const [abierta, setAbierta] = useState(null) // id o 'nueva'
  const [form, setForm] = useState(VACIA)
  const [sucio, setSucio] = useState(false)
  const [vista, setVista] = useState('editar')
  const [reflexiones, setReflexiones] = useState([])
  const [trabajando, setTrabajando] = useState(false)
  const [mensaje, setMensaje] = useState(null)

  useEffect(() => {
    supabase.from('espacios').select('*').order('semestre').order('orden').order('id').then(({ data }) => setEspacios((data ?? []).filter((e) => e.activo !== false)))
    if (admin) setPermitidos([1, 2, 3, 4])
    else supabase.from('asignaciones').select('semestre').eq('formador_id', perfil.id)
      .then(({ data }) => setPermitidos([...new Set((data ?? []).map((a) => a.semestre))].sort()))
  }, [admin, perfil?.id])

  const espacio = espacios.find((e) => String(e.id) === espacioId)
  const delSemestre = useMemo(() => espacios.filter((e) => String(e.semestre) === semestre), [espacios, semestre])

  async function cargar(abrirId) {
    if (!espacioId) { setLecciones([]); return }
    const { data } = await supabase.from('lecciones').select('*').eq('espacio_id', espacioId).order('orden').order('id')
    const ls = data ?? []
    setLecciones(ls)
    const ids = ls.map((l) => l.id)
    const { data: lec } = ids.length ? await supabase.from('lecciones_leidas').select('leccion_id').in('leccion_id', ids) : { data: [] }
    const c = {}; for (const x of lec ?? []) c[x.leccion_id] = (c[x.leccion_id] ?? 0) + 1
    setLecturas(c)
    if (abrirId !== undefined) {
      const l = ls.find((x) => x.id === abrirId)
      setAbierta(l ? l.id : null); setForm(l ? desdeFila(l) : VACIA); setSucio(false)
    }
  }
  useEffect(() => { setAbierta(null); setMensaje(null); cargar() }, [espacioId])

  async function cargarReflexiones(id) {
    const { data } = await supabase.from('reflexiones').select('*, estudiantes(nombre_completo)').eq('leccion_id', id).order('actualizado', { ascending: false })
    setReflexiones(data ?? [])
  }
  useEffect(() => { if (vista === 'reflexiones' && typeof abierta === 'number') cargarReflexiones(abierta) }, [vista, abierta])

  const confirmarSalida = () => !sucio || confirm('Tienes cambios sin guardar. ¿Salir sin guardarlos?')
  function abrir(l) { if (!confirmarSalida()) return; setAbierta(l.id); setForm(desdeFila(l)); setSucio(false); setVista('editar'); setMensaje(null) }
  function nueva(modelo) {
    if (!confirmarSalida()) return
    setAbierta('nueva')
    setForm(modelo ? { ...VACIA, titulo: modelo.titulo, resumen: modelo.resumen, bloques: modelo.bloques.map((b) => ({ ...structuredClone(b), id: nuevoId() })) } : VACIA)
    setSucio(!!modelo); setVista('editar'); setMensaje(null)
  }
  const set = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setSucio(true) }

  async function guardar() {
    if (!form.titulo.trim()) { setMensaje({ tipo: 'error', texto: 'La lección necesita un título.' }); return }
    const malo = form.bloques.findIndex((b) => revisarBloque(b))
    if (malo >= 0) { setMensaje({ tipo: 'error', texto: `Revisa el bloque ${malo + 1}: ${revisarBloque(form.bloques[malo])}.` }); return }
    if (form.publicada && !form.bloques.length) { setMensaje({ tipo: 'error', texto: 'Agrega contenido antes de publicar la lección.' }); return }
    setTrabajando(true); setMensaje(null)
    const fila = {
      titulo: form.titulo.trim(), resumen: form.resumen.trim() || null,
      bloques: form.bloques.map(limpiarBloque), publicada: form.publicada, actualizado: new Date().toISOString(),
    }
    const r = abierta === 'nueva'
      ? await supabase.from('lecciones').insert({ ...fila, espacio_id: Number(espacioId), orden: lecciones.length, autor_id: perfil.id }).select('id').single()
      : await supabase.from('lecciones').update(fila).eq('id', abierta).select('id').single()
    setTrabajando(false)
    if (r.error) {
      const falta = /bloques/.test(r.error.message)
      setMensaje({ tipo: 'error', texto: falta ? 'Falta instalar estudio_interactivo.sql en Supabase.' : `No se pudo guardar: ${r.error.message}` })
      return
    }
    await cargar(r.data.id)
    setMensaje({ tipo: 'ok', texto: form.publicada ? 'Lección guardada y publicada: los estudiantes ya la ven en su portal.' : 'Lección guardada como borrador. Márcala como publicada cuando esté lista.' })
  }

  async function eliminar() {
    const l = lecciones.find((x) => x.id === abierta)
    if (!l || !confirm(`¿Eliminar la lección "${l.titulo}"? También se borrarán las reflexiones de los estudiantes.`)) return
    const { error } = await supabase.from('lecciones').delete().eq('id', l.id)
    if (error) { setMensaje({ tipo: 'error', texto: error.message }); return }
    setAbierta(null); setSucio(false); cargar()
  }

  async function mover(i, paso) {
    const j = i + paso
    if (j < 0 || j >= lecciones.length) return
    const l = [...lecciones]; [l[i], l[j]] = [l[j], l[i]]
    setLecciones(l)
    for (const [k, x] of l.entries()) if (x.orden !== k) await supabase.from('lecciones').update({ orden: k }).eq('id', x.id)
    cargar()
  }

  const preguntasReflexion = form.bloques.filter((b) => b.tipo === 'reflexion')
  const pestanas = [['editar', 'Construir'], ['vista', 'Vista del estudiante'], ...(typeof abierta === 'number' && preguntasReflexion.length ? [['reflexiones', 'Reflexiones']] : [])]

  return (
    <section>
      <h1 className="text-3xl font-semibold">Módulos de estudio</h1>
      <p className="mb-6 text-sm text-slate-500">
        Arma lecciones interactivas con bloques: textos, imágenes, videos, tarjetas que giran, secciones para descubrir, pasos,
        preguntas y reflexiones. Los estudiantes las encuentran en la pestaña «Estudiar» de su portal.
      </p>

      {!admin && !permitidos.length ? (
        <p className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-slate-500">Podrás escribir lecciones cuando la coordinación te asigne un semestre.</p>
      ) : (
        <div className="mb-6 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="etiqueta" htmlFor="est-sem">Semestre</label>
            <select id="est-sem" className="campo" value={semestre} onChange={(e) => { if (!confirmarSalida()) return; setSemestre(e.target.value); setEspacioId(''); setSucio(false) }}>
              <option value="">Selecciona</option>
              {permitidos.map((s) => <option key={s} value={s}>Semestre {s}</option>)}
            </select>
          </div>
          <div>
            <label className="etiqueta" htmlFor="est-esp">Módulo, retiro o seminario</label>
            <select id="est-esp" className="campo" disabled={!semestre} value={espacioId} onChange={(e) => { if (!confirmarSalida()) return; setEspacioId(e.target.value); setSucio(false) }}>
              <option value="">Selecciona</option>
              {delSemestre.map((e) => <option key={e.id} value={e.id}>{e.etiqueta} · {e.nombre}</option>)}
            </select>
          </div>
        </div>
      )}

      {espacio && (
        <div className="grid gap-6 xl:grid-cols-[17rem_1fr]">
          <aside className="space-y-3">
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
              <h2 className="bg-tinta px-4 py-2 font-serif text-base font-semibold text-white">Lecciones</h2>
              <ol>
                {lecciones.map((l, i) => (
                  <li key={l.id} className={`flex items-center gap-1 border-t border-slate-100 first:border-t-0 ${abierta === l.id ? 'bg-cielo' : ''}`}>
                    <button onClick={() => abrir(l)} className="min-w-0 flex-1 px-3 py-2 text-left">
                      <span className="block truncate text-sm font-medium">{i + 1}. {l.titulo}</span>
                      <span className="text-xs text-slate-500">
                        {l.publicada ? <span className="text-green-700">Publicada</span> : 'Borrador'}
                        {` · ${(l.bloques ?? []).length} bloques`}
                        {l.publicada && ` · leída por ${lecturas[l.id] ?? 0}`}
                      </span>
                    </button>
                    <button className="px-1 text-xs text-mariano disabled:text-slate-300" aria-label="Subir" disabled={i === 0} onClick={() => mover(i, -1)}>▲</button>
                    <button className="px-1 pr-2 text-xs text-mariano disabled:text-slate-300" aria-label="Bajar" disabled={i === lecciones.length - 1} onClick={() => mover(i, 1)}>▼</button>
                  </li>
                ))}
                {!lecciones.length && <li className="p-3 text-sm text-slate-500">Este módulo aún no tiene lecciones.</li>}
              </ol>
            </div>
            <button className="btn w-full" onClick={() => nueva(null)}>Nueva lección</button>
            {LECCIONES_INTERACTIVAS.map((m) => (
              <button key={m.clave} className="btn-sec w-full text-left" onClick={() => nueva(m)}>Usar lección de ejemplo: {m.titulo}</button>
            ))}
          </aside>

          <div className="min-w-0">
            {mensaje && <p className={`mb-3 text-sm ${mensaje.tipo === 'error' ? 'text-alerta' : 'text-green-700'}`}>{mensaje.texto}</p>}
            {!abierta ? (
              <p className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-slate-500">Elige una lección o crea una nueva.</p>
            ) : (
              <div className="rounded-lg border border-slate-200 bg-white">
                <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-4">
                  {pestanas.map(([k, t]) => (
                    <button key={k} onClick={() => setVista(k)}
                      className={`-mb-px border-b-2 px-3 py-2 text-sm font-semibold ${vista === k ? 'border-mariano text-mariano' : 'border-transparent text-slate-500'}`}>{t}</button>
                  ))}
                  <span className="ml-auto flex items-center gap-3 py-2">
                    <label className="flex items-center gap-2 text-sm font-semibold">
                      <input type="checkbox" checked={form.publicada} onChange={(e) => set('publicada', e.target.checked)} /> Publicada
                    </label>
                    <button className="btn py-1.5" onClick={guardar} disabled={trabajando || !sucio}>{trabajando ? 'Guardando…' : 'Guardar'}</button>
                  </span>
                </div>

                {vista === 'editar' && (
                  <div className="space-y-4 bg-slate-50/60 p-5">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="etiqueta" htmlFor="lec-tit">Título de la lección</label>
                        <input id="lec-tit" className="campo" value={form.titulo} onChange={(e) => set('titulo', e.target.value)} />
                      </div>
                      <div>
                        <label className="etiqueta" htmlFor="lec-res">Resumen corto (opcional)</label>
                        <input id="lec-res" className="campo" maxLength={250} value={form.resumen} onChange={(e) => set('resumen', e.target.value)} />
                      </div>
                    </div>
                    <BloquesEditor bloques={form.bloques} cambiar={(v) => set('bloques', v)} />
                    {abierta !== 'nueva' && (
                      <div className="border-t border-slate-200 pt-4">
                        <button className="text-sm font-semibold text-alerta underline" onClick={eliminar}>Eliminar lección</button>
                      </div>
                    )}
                  </div>
                )}

                {vista === 'vista' && (
                  <article className="mx-auto max-w-3xl p-6">
                    <p className="text-xs text-slate-500">{espacio.etiqueta} · {espacio.nombre}</p>
                    <h2 className="font-serif text-3xl font-semibold">{form.titulo || 'Sin título'}</h2>
                    {form.resumen && <p className="mt-1 text-slate-600">{form.resumen}</p>}
                    <div className="mt-6"><BloquesVista bloques={form.bloques} /></div>
                  </article>
                )}

                {vista === 'reflexiones' && (
                  <div className="space-y-5 p-5">
                    {preguntasReflexion.map((b) => {
                      const resp = ordenarEstudiantes(
                        reflexiones.filter((r) => r.bloque_id === b.id).map((r) => ({ ...r, nombre_completo: r.estudiantes?.nombre_completo ?? '' })), 'apellidos')
                      return (
                        <div key={b.id}>
                          <h3 className="font-serif text-lg font-semibold">{b.pregunta}</h3>
                          <p className="mb-2 text-xs text-slate-500">{resp.length} respuesta(s)</p>
                          {!resp.length ? <p className="text-sm text-slate-500">Aún nadie ha respondido.</p> : (
                            <ul className="space-y-2">
                              {resp.map((r) => (
                                <li key={r.estudiante_id} className="rounded-lg border border-slate-200 p-3">
                                  <p className="text-sm font-semibold">{mostrarNombre(r, 'apellidos')}
                                    <span className="ml-2 text-xs font-normal text-slate-500">{new Date(r.actualizado).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}</span></p>
                                  <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{r.texto}</p>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
