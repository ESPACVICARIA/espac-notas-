import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import TextoFormateado from '../components/TextoFormateado'
import Video from '../components/Video'
import { LECCIONES_MODELO } from '../lib/leccionesModelo'

const VACIA = { titulo: '', resumen: '', contenido: '', video_url: '', publicada: false }
const AYUDA = [
  ['# Título', 'título de sección'], ['## Subtítulo', 'subtítulo'], ['**texto**', 'negrita'], ['*texto*', 'cursiva'],
  ['- texto', 'viñeta'], ['1. texto', 'lista numerada'], ['> texto', 'cita destacada'], ['[texto](https://…)', 'enlace'],
]

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
      setAbierta(l ? l.id : null); setForm(l ? { ...VACIA, ...l, video_url: l.video_url ?? '', resumen: l.resumen ?? '' } : VACIA); setSucio(false)
    }
  }
  useEffect(() => { setAbierta(null); setMensaje(null); cargar() }, [espacioId])

  const confirmarSalida = () => !sucio || confirm('Tienes cambios sin guardar. ¿Salir sin guardarlos?')
  function abrir(l) { if (!confirmarSalida()) return; setAbierta(l.id); setForm({ ...VACIA, ...l, video_url: l.video_url ?? '', resumen: l.resumen ?? '' }); setSucio(false); setVista('editar'); setMensaje(null) }
  function nueva(modelo) {
    if (!confirmarSalida()) return
    setAbierta('nueva'); setForm(modelo ? { ...VACIA, titulo: modelo.titulo, resumen: modelo.resumen, contenido: modelo.contenido } : VACIA)
    setSucio(!!modelo); setVista('editar'); setMensaje(null)
  }
  const set = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setSucio(true) }

  async function guardar() {
    if (!form.titulo.trim()) { setMensaje({ tipo: 'error', texto: 'La lección necesita un título.' }); return }
    if (form.video_url.trim() && !/^https?:\/\//i.test(form.video_url.trim())) { setMensaje({ tipo: 'error', texto: 'El enlace del video debe empezar por https://' }); return }
    setTrabajando(true); setMensaje(null)
    const fila = {
      titulo: form.titulo.trim(), resumen: form.resumen.trim() || null, contenido: form.contenido,
      video_url: form.video_url.trim() || null, publicada: form.publicada, actualizado: new Date().toISOString(),
    }
    const r = abierta === 'nueva'
      ? await supabase.from('lecciones').insert({ ...fila, espacio_id: Number(espacioId), orden: lecciones.length, autor_id: perfil.id }).select('id').single()
      : await supabase.from('lecciones').update(fila).eq('id', abierta).select('id').single()
    setTrabajando(false)
    if (r.error) { setMensaje({ tipo: 'error', texto: `No se pudo guardar: ${r.error.message}` }); return }
    await cargar(r.data.id)
    setMensaje({ tipo: 'ok', texto: form.publicada ? 'Lección guardada y publicada: los estudiantes ya la ven en su portal.' : 'Lección guardada como borrador. Márcala como publicada cuando esté lista.' })
  }

  async function eliminar() {
    const l = lecciones.find((x) => x.id === abierta)
    if (!l || !confirm(`¿Eliminar la lección "${l.titulo}"?`)) return
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

  return (
    <section>
      <h1 className="text-3xl font-semibold">Módulos de estudio</h1>
      <p className="mb-6 text-sm text-slate-500">
        Escribe las lecciones de cada módulo. Los estudiantes las encuentran en la pestaña «Estudiar» de su portal, junto con el
        material y los repasos del módulo.
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
        <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
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
            {LECCIONES_MODELO.map((m) => (
              <button key={m.clave} className="btn-sec w-full text-left" onClick={() => nueva(m)}>Usar lección de ejemplo: {m.titulo}</button>
            ))}
            {lecciones.some((l) => l.publicada) && <p className="text-xs text-slate-500">«Leída por» cuenta a los estudiantes que marcaron la lección como leída.</p>}
          </aside>

          <div>
            {mensaje && <p className={`mb-3 text-sm ${mensaje.tipo === 'error' ? 'text-alerta' : 'text-green-700'}`}>{mensaje.texto}</p>}
            {!abierta ? (
              <p className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-slate-500">Elige una lección o crea una nueva.</p>
            ) : (
              <div className="rounded-lg border border-slate-200 bg-white">
                <div className="flex gap-2 border-b border-slate-200 px-4">
                  {[['editar', 'Escribir'], ['vista', 'Vista del estudiante']].map(([k, t]) => (
                    <button key={k} onClick={() => setVista(k)}
                      className={`-mb-px border-b-2 px-3 py-2 text-sm font-semibold ${vista === k ? 'border-mariano text-mariano' : 'border-transparent text-slate-500'}`}>{t}</button>
                  ))}
                </div>
                {vista === 'editar' ? (
                  <div className="space-y-4 p-5">
                    <div>
                      <label className="etiqueta" htmlFor="lec-tit">Título</label>
                      <input id="lec-tit" className="campo" value={form.titulo} onChange={(e) => set('titulo', e.target.value)} />
                    </div>
                    <div>
                      <label className="etiqueta" htmlFor="lec-res">Resumen corto (opcional)</label>
                      <input id="lec-res" className="campo" maxLength={250} value={form.resumen} onChange={(e) => set('resumen', e.target.value)} />
                    </div>
                    <div>
                      <label className="etiqueta" htmlFor="lec-con">Contenido</label>
                      <textarea id="lec-con" rows={18} className="campo font-mono text-[13px] leading-relaxed" value={form.contenido} onChange={(e) => set('contenido', e.target.value)} />
                      <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                        {AYUDA.map(([c, t]) => <span key={c}><code className="rounded bg-cielo px-1 text-mariano">{c}</code> {t}</span>)}
                      </p>
                    </div>
                    <div>
                      <label className="etiqueta" htmlFor="lec-vid">Video de YouTube o enlace (opcional)</label>
                      <input id="lec-vid" className="campo" placeholder="https://www.youtube.com/watch?v=…" value={form.video_url} onChange={(e) => set('video_url', e.target.value)} />
                    </div>
                    <label className="flex items-center gap-2 text-sm font-semibold">
                      <input type="checkbox" checked={form.publicada} onChange={(e) => set('publicada', e.target.checked)} />
                      Publicada: los estudiantes pueden verla
                    </label>
                    <div className="flex flex-wrap items-center gap-4 border-t border-slate-200 pt-4">
                      <button className="btn" onClick={guardar} disabled={trabajando || !sucio}>{trabajando ? 'Guardando…' : 'Guardar lección'}</button>
                      {abierta !== 'nueva' && <button className="text-sm font-semibold text-alerta underline" onClick={eliminar}>Eliminar lección</button>}
                    </div>
                  </div>
                ) : (
                  <article className="p-6">
                    <p className="text-xs text-slate-500">{espacio.etiqueta} · {espacio.nombre}</p>
                    <h2 className="text-2xl font-semibold">{form.titulo || 'Sin título'}</h2>
                    {form.resumen && <p className="mt-1 text-slate-600">{form.resumen}</p>}
                    <Video url={form.video_url} />
                    <TextoFormateado texto={form.contenido} className="mt-4 text-[15px]" />
                  </article>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
