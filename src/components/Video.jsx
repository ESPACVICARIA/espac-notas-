// Inserta un video de YouTube; cualquier otro enlace se muestra como botón
export function idYoutube(url = '') {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/)
  return m?.[1] ?? null
}

export default function Video({ url }) {
  if (!url) return null
  const id = idYoutube(url)
  if (!id) {
    return <a href={url} target="_blank" rel="noopener noreferrer" className="btn-sec mt-4">Ver video o recurso</a>
  }
  return (
    <div className="mt-4 aspect-video overflow-hidden rounded-lg bg-black">
      <iframe className="h-full w-full" src={`https://www.youtube-nocookie.com/embed/${id}`} title="Video de la lección"
        allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
    </div>
  )
}
