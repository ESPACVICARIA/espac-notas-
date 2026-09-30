import { useEffect, useRef, useState } from 'react'
import { urlFoto, subirFoto, quitarFoto } from '../lib/fotos'

// Foto tipo carné (3 x 4) con opciones para la coordinación
export default function FotoEstudiante({ estudiante, editable, alCambiar }) {
  const [url, setUrl] = useState(null)
  const [trabajando, setTrabajando] = useState(false)
  const [error, setError] = useState('')
  const entrada = useRef(null)

  useEffect(() => {
    let vivo = true
    urlFoto(estudiante.foto_url).then((u) => vivo && setUrl(u))
    return () => { vivo = false }
  }, [estudiante.foto_url])

  async function elegir(e) {
    const archivo = e.target.files?.[0]
    e.target.value = ''
    if (!archivo) return
    setTrabajando(true); setError('')
    try {
      const ruta = await subirFoto(estudiante.id, archivo, estudiante.foto_url)
      alCambiar?.(ruta)
    } catch (err) {
      setError(err.message)
    }
    setTrabajando(false)
  }

  async function quitar() {
    if (!confirm('¿Quitar la foto de este estudiante?')) return
    setTrabajando(true); setError('')
    try {
      await quitarFoto(estudiante.id, estudiante.foto_url)
      alCambiar?.(null)
    } catch (err) {
      setError(err.message)
    }
    setTrabajando(false)
  }

  const iniciales = estudiante.nombre_completo?.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase()

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="grid h-32 w-24 place-items-center overflow-hidden rounded-lg border-2 border-mariano/40 bg-cielo">
        {url ? <img src={url} alt={`Foto de ${estudiante.nombre_completo}`} className="h-full w-full object-cover" />
          : <span className="font-serif text-2xl font-semibold text-mariano" aria-hidden="true">{iniciales}</span>}
      </div>
      {editable && (
        <div className="flex flex-col items-center gap-1 text-xs">
          <input ref={entrada} type="file" accept="image/*" className="sr-only" onChange={elegir} />
          <button className="font-semibold text-mariano underline disabled:text-slate-400" disabled={trabajando} onClick={() => entrada.current?.click()}>
            {trabajando ? 'Subiendo…' : url ? 'Cambiar foto' : 'Subir foto'}
          </button>
          {url && !trabajando && <button className="text-alerta underline" onClick={quitar}>Quitar</button>}
        </div>
      )}
      {error && <p className="max-w-[10rem] text-center text-xs text-alerta">{error}</p>}
    </div>
  )
}
