import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import ListaDocumentos, { TITULO_SEMESTRE } from '../components/ListaDocumentos'

const MAX_MB = 20
const VACIO = { titulo: '', descripcion: '', semestre: '', espacio_id: '', tipo: 'archivo', url: '' }
const nombreSeguro = (n) => n.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80)

export default function Biblioteca({ perfil }) {
  const admin = perfil?.rol === 'admin'
  const [docs, setDocs] = useState([])
  const [espacios, setEspacios] = useState([])
  const [permitidos, setPermitidos] = useState([])
  const [filtro, setFiltro] = useState('todos')
  const [busqueda, setBusqueda] = useState('')
  const [form, setForm] = useState(VACIO)
  const [archivo, setArchivo] = useState(null)
  const [abierto, setAbierto] = useState(false)
  const [subiendo, setSubiendo] = useState(false)
  const [mensaje, setMensaje] = useState(null)

  async function cargar() {
    const { data, error } = await supabase.from('documentos').select('*, espacios(etiqueta, nombre)').order('creado', { ascending: false })
    if (error) setMensaje({ tipo: 'error', texto: `No se pudieron cargar los documentos: ${error.message}` })
    setDocs(data ?? [])
  }

  useEffect(() => {
    cargar()
    supabase.from('espacios').select('*').order('semestre').order('orden').order('id').then(({ data }) => setEspacios(data ?? []))
    if (admin) setPermitidos([0, 1, 2, 3, 4])
    else {
      supabase.from('asignaciones').select('semestre').eq('formador_id', perfil.id)
        .then(({ data }) => setPermitidos([...new Set((data ?? []).map((a) => a.semestre))].sort()))
    }
  }, [admin, perfil?.id])

  const visibles = useMemo(() => {
    const q = busqueda.toLowerCase().trim()
    return docs.filter((d) =>
      (filtro === 'todos' || String(d.semestre) === filtro) &&
      (!q || d.titulo.toLowerCase().includes(q) || (d.descripcion ?? '').toLowerCase().includes(q)))
  }, [docs, filtro, busqueda])

  const espaciosSem = espacios.filter((e) => String(e.semestre) === form.semestre && e.activo !== false)
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v, ...(k === 'semestre' ? { espacio_id: '' } : {}) }))

  async function publicar(ev) {
    ev.preventDefault()
    setMensaje(null)
    if (form.tipo === 'archivo') {
      if (!archivo) { setMensaje({ tipo: 'error', texto: 'Elige el archivo que quieres compartir.' }); return }
      if (archivo.size > MAX_MB * 1024 * 1024) { setMensaje({ tipo: 'error', texto: `El archivo pesa más de ${MAX_MB} MB. Comprímelo o compártelo como enlace.` }); return }
    } else if (!/^https?:\/\//i.test(form.url.trim())) {
      setMensaje({ tipo: 'error', texto: 'El enlace debe empezar por http:// o https://' }); return
    }
    setSubiendo(true)
    const semestre = Number(form.semestre)
    let ruta = null
    try {
      if (form.tipo === 'archivo') {
        ruta = `semestre-${semestre}/${crypto.randomUUID()}-${nombreSeguro(archivo.name)}`
        const { error } = await supabase.storage.from('documentos').upload(ruta, archivo, { contentType: archivo.type || undefined })
        if (error) throw error
      }
      const { error } = await supabase.from('documentos').insert({
        titulo: form.titulo.trim(), descripcion: form.descripcion.trim() || null, semestre,
        espacio_id: form.espacio_id ? Number(form.espacio_id) : null, tipo: form.tipo, subido_por: perfil.id,
        ...(form.tipo === 'archivo'
          ? { ruta, nombre_archivo: archivo.name, tamano: archivo.size, mime: archivo.type || null }
          : { url: form.url.trim() }),
      })
      if (error) throw error
      setForm(VACIO); setArchivo(null); setAbierto(false)
      setMensaje({ tipo: 'ok', texto: `"${form.titulo.trim()}" quedó publicado en ${TITULO_SEMESTRE(semestre)}.` })
      await cargar()
    } catch (e) {
      if (ruta) await supabase.storage.from('documentos').remove([ruta])
      setMensaje({ tipo: 'error', texto: `No se pudo publicar: ${e.message}` })
    }
    setSubiendo(false)
  }

  async function eliminar(d) {
    if (!confirm(`¿Eliminar "${d.titulo}"? Los estudiantes dejarán de verlo.`)) return
    if (d.tipo === 'archivo') await supabase.storage.from('documentos').remove([d.ruta])
    const { error } = await supabase.from('documentos').delete().eq('id', d.id)
    setMensaje(error ? { tipo: 'error', texto: `No se pudo eliminar: ${error.message}` } : { tipo: 'ok', texto: 'Documento eliminado.' })
    cargar()
  }

  const filtroBtn = (v, t) => (
    <button key={v} onClick={() => setFiltro(v)}
      className={`rounded-full px-3 py-1 text-sm font-semibold ${filtro === v ? 'bg-mariano text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-cielo'}`}>{t}</button>
  )

  return (
    <section>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Documentos</h1>
          <p className="text-sm text-slate-500">Material del ESPAC por semestre. Los estudiantes lo ven en su portal.</p>
        </div>
        {permitidos.length > 0 && !abierto && <button className="btn" onClick={() => setAbierto(true)}>Compartir documento</button>}
      </div>

      {mensaje && <p className={`mb-4 text-sm ${mensaje.tipo === 'error' ? 'text-alerta' : 'text-green-700'}`}>{mensaje.texto}</p>}

      {abierto && (
        <form onSubmit={publicar} className="mb-8 grid gap-4 rounded-lg border border-slate-200 bg-white p-5 sm:grid-cols-2">
          <h2 className="text-xl font-semibold sm:col-span-2">Compartir documento</h2>
          <div className="sm:col-span-2">
            <label className="etiqueta" htmlFor="titulo">Título</label>
            <input id="titulo" required className="campo" placeholder="Ej. Guía del Módulo 5: La Revelación"
              value={form.titulo} onChange={(e) => set('titulo', e.target.value)} />
          </div>
          <div>
            <label className="etiqueta" htmlFor="sem">Semestre</label>
            <select id="sem" required className="campo" value={form.semestre} onChange={(e) => set('semestre', e.target.value)}>
              <option value="">Selecciona</option>
              {permitidos.map((s) => <option key={s} value={s}>{s === 0 ? 'General (todos los semestres)' : `Semestre ${s}`}</option>)}
            </select>
          </div>
          <div>
            <label className="etiqueta" htmlFor="esp">Módulo (opcional)</label>
            <select id="esp" className="campo" disabled={!form.semestre || form.semestre === '0'} value={form.espacio_id} onChange={(e) => set('espacio_id', e.target.value)}>
              <option value="">Todo el semestre</option>
              {espaciosSem.map((e) => <option key={e.id} value={e.id}>{e.etiqueta} · {e.nombre}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="etiqueta" htmlFor="desc">Descripción (opcional)</label>
            <textarea id="desc" rows={2} className="campo" value={form.descripcion} onChange={(e) => set('descripcion', e.target.value)} />
          </div>
          <fieldset className="flex flex-wrap gap-6 text-sm sm:col-span-2">
            <legend className="etiqueta">Qué vas a compartir</legend>
            <label className="flex items-center gap-2"><input type="radio" checked={form.tipo === 'archivo'} onChange={() => set('tipo', 'archivo')} /> Un archivo de mi computador</label>
            <label className="flex items-center gap-2"><input type="radio" checked={form.tipo === 'enlace'} onChange={() => set('tipo', 'enlace')} /> Un enlace (YouTube, Google Drive, página web)</label>
          </fieldset>
          {form.tipo === 'archivo' ? (
            <div className="sm:col-span-2">
              <input type="file" className="text-sm"
                accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.jpg,.jpeg,.png,.webp,.mp3,.m4a,.mp4"
                onChange={(e) => setArchivo(e.target.files?.[0] ?? null)} />
              <p className="mt-1 text-xs text-slate-500">PDF, Word, PowerPoint, Excel, imágenes, audio o video. Máximo {MAX_MB} MB.</p>
            </div>
          ) : (
            <div className="sm:col-span-2">
              <label className="etiqueta" htmlFor="url">Enlace</label>
              <input id="url" type="url" className="campo" placeholder="https://" value={form.url} onChange={(e) => set('url', e.target.value)} />
            </div>
          )}
          <p className="text-xs text-amber-800 sm:col-span-2">
            Comparte solo material formativo. Cualquier persona con el enlace directo del archivo podría abrirlo, así que no subas
            documentos con datos personales de los estudiantes.
          </p>
          <div className="flex gap-3 sm:col-span-2">
            <button className="btn" disabled={subiendo}>{subiendo ? 'Publicando…' : 'Publicar'}</button>
            <button type="button" className="btn-sec" onClick={() => { setAbierto(false); setForm(VACIO); setArchivo(null) }}>Cancelar</button>
          </div>
        </form>
      )}

      {!admin && permitidos.length === 0 && (
        <p className="mb-4 text-sm text-slate-500">Podrás compartir documentos cuando la coordinación te asigne un semestre.</p>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {filtroBtn('todos', 'Todos')}
        {filtroBtn('0', 'Generales')}
        {[1, 2, 3, 4].map((s) => filtroBtn(String(s), `Semestre ${s}`))}
        <input className="campo ml-auto max-w-xs" placeholder="Buscar documento" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
      </div>

      <ListaDocumentos documentos={visibles} onEliminar={eliminar}
        puedeEliminar={(d) => admin || d.subido_por === perfil?.id}
        vacio={docs.length ? 'Ningún documento coincide con el filtro.' : 'Aún no hay documentos. Usa "Compartir documento" para publicar el primero.'} />
    </section>
  )
}
