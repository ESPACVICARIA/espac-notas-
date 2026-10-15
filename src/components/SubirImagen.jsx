import { useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { reducirImagen } from '../lib/fotos'

// Sube una imagen a la carpeta «estudio» de Supabase o acepta un enlace
export default function SubirImagen({ url, alCambiar, vistaPrevia = true }) {
  const entrada = useRef(null)
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState('')
  async function elegir(e) {
    const archivo = e.target.files?.[0]
    e.target.value = ''
    if (!archivo) return
    setSubiendo(true); setError('')
    try {
      const esGif = archivo.type === 'image/gif'
      const contenido = esGif ? archivo : await reducirImagen(archivo, 1600)
      const ruta = `lecciones/${crypto.randomUUID()}.${esGif ? 'gif' : 'jpg'}`
      const { error: err } = await supabase.storage.from('estudio').upload(ruta, contenido, { contentType: esGif ? 'image/gif' : 'image/jpeg' })
      if (err) throw err
      alCambiar(supabase.storage.from('estudio').getPublicUrl(ruta).data.publicUrl)
    } catch (err) {
      setError(/bucket/i.test(err.message) ? 'Falta instalar la carpeta de imágenes (estudio_interactivo.sql).' : err.message)
    }
    setSubiendo(false)
  }
  return (
    <div className="space-y-2">
      {vistaPrevia && url && <img src={url} alt="" className="max-h-48 rounded-lg border border-slate-200" />}
      <div className="flex flex-wrap items-center gap-2">
        <input ref={entrada} type="file" accept="image/*" className="sr-only" onChange={elegir} />
        <button className="btn-sec py-1" disabled={subiendo} onClick={() => entrada.current?.click()}>{subiendo ? 'Subiendo…' : url ? 'Cambiar imagen' : 'Subir imagen'}</button>
        <span className="text-xs text-slate-500">o pega el enlace de una imagen:</span>
        <input className="campo min-w-[14rem] flex-1 py-1 text-sm" placeholder="https://…" value={url ?? ''} onChange={(e) => alCambiar(e.target.value)} />
      </div>
      {error && <p className="text-xs text-alerta">{error}</p>}
    </div>
  )
}
