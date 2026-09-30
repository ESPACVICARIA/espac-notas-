import { supabase } from './supabase'

// Reduce la foto (máximo 800 px) y la convierte en JPG para que pese poco
export function reducirImagen(archivo, maximo = 800) {
  return new Promise((resolver, rechazar) => {
    const url = URL.createObjectURL(archivo)
    const img = new Image()
    img.onload = () => {
      const escala = Math.min(1, maximo / Math.max(img.width, img.height))
      const lienzo = document.createElement('canvas')
      lienzo.width = Math.round(img.width * escala)
      lienzo.height = Math.round(img.height * escala)
      const ctx = lienzo.getContext('2d')
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, lienzo.width, lienzo.height)
      ctx.drawImage(img, 0, 0, lienzo.width, lienzo.height)
      URL.revokeObjectURL(url)
      lienzo.toBlob((b) => (b ? resolver(b) : rechazar(new Error('No se pudo procesar la imagen.'))), 'image/jpeg', 0.85)
    }
    img.onerror = () => { URL.revokeObjectURL(url); rechazar(new Error('Ese archivo no es una imagen que el navegador pueda abrir. Usa JPG o PNG.')) }
    img.src = url
  })
}

// Enlace temporal (1 hora) para ver la foto; las fotos no son públicas
export async function urlFoto(ruta) {
  if (!ruta) return null
  if (/^https?:\/\//.test(ruta)) return ruta
  const { data } = await supabase.storage.from('fotos').createSignedUrl(ruta, 3600)
  return data?.signedUrl ?? null
}

export async function subirFoto(estudianteId, archivo, rutaAnterior) {
  const imagen = await reducirImagen(archivo)
  const ruta = `${estudianteId}/${crypto.randomUUID()}.jpg`
  const { error } = await supabase.storage.from('fotos').upload(ruta, imagen, { contentType: 'image/jpeg' })
  if (error) throw error
  const { error: e2 } = await supabase.from('estudiantes').update({ foto_url: ruta }).eq('id', estudianteId)
  if (e2) { await supabase.storage.from('fotos').remove([ruta]); throw e2 }
  if (rutaAnterior && !/^https?:\/\//.test(rutaAnterior)) await supabase.storage.from('fotos').remove([rutaAnterior])
  return ruta
}

export async function quitarFoto(estudianteId, ruta) {
  const { error } = await supabase.from('estudiantes').update({ foto_url: null }).eq('id', estudianteId)
  if (error) throw error
  if (ruta && !/^https?:\/\//.test(ruta)) await supabase.storage.from('fotos').remove([ruta])
}
