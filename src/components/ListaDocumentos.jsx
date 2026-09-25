import { supabase } from '../lib/supabase'

export const TITULO_SEMESTRE = (s) => (s === 0 ? 'Documentos generales del ESPAC' : `Semestre ${s}`)

export function enlaceDe(doc) {
  if (doc.tipo === 'enlace') return doc.url
  return supabase.storage.from('documentos').getPublicUrl(doc.ruta).data.publicUrl
}

function etiquetaTipo(doc) {
  if (doc.tipo === 'enlace') return 'Enlace'
  const ext = (doc.nombre_archivo ?? '').split('.').pop().toLowerCase()
  if (ext === 'pdf') return 'PDF'
  if (['doc', 'docx'].includes(ext)) return 'Word'
  if (['ppt', 'pptx'].includes(ext)) return 'PowerPoint'
  if (['xls', 'xlsx'].includes(ext)) return 'Excel'
  if (['jpg', 'jpeg', 'png', 'webp'].includes(ext)) return 'Imagen'
  if (['mp3', 'm4a', 'wav'].includes(ext)) return 'Audio'
  if (['mp4', 'mov'].includes(ext)) return 'Video'
  return ext ? ext.toUpperCase() : 'Archivo'
}

const tamano = (b) => (!b ? '' : b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1).replace('.', ',')} MB`)
const fecha = (f) => new Date(f).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })

// Lista de documentos agrupada por semestre. Si recibe onEliminar, muestra el botón para quien pueda borrar.
export default function ListaDocumentos({ documentos, onEliminar, puedeEliminar = () => false, vacio = 'Aún no hay documentos.' }) {
  if (!documentos.length) {
    return <p className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-slate-500">{vacio}</p>
  }
  const semestres = [...new Set(documentos.map((d) => d.semestre))].sort((a, b) => a - b)
  return (
    <div className="space-y-6">
      {semestres.map((s) => (
        <div key={s} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <h2 className="bg-tinta px-4 py-2 font-serif text-base font-semibold text-white">{TITULO_SEMESTRE(s)}</h2>
          <ul className="divide-y divide-slate-100">
            {documentos.filter((d) => d.semestre === s).map((d) => (
              <li key={d.id} className="flex flex-wrap items-start gap-3 p-4">
                <span className="mt-0.5 w-20 shrink-0 rounded bg-cielo px-2 py-1 text-center text-xs font-semibold text-mariano">{etiquetaTipo(d)}</span>
                <div className="min-w-0 flex-1">
                  <a href={enlaceDe(d)} target="_blank" rel="noopener noreferrer" className="font-medium text-mariano hover:underline">{d.titulo}</a>
                  {d.descripcion && <p className="mt-0.5 text-sm text-slate-600">{d.descripcion}</p>}
                  <p className="mt-1 text-xs text-slate-500">
                    {[d.espacios && `${d.espacios.etiqueta} · ${d.espacios.nombre}`, tamano(d.tamano), fecha(d.creado)].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <a href={enlaceDe(d)} target="_blank" rel="noopener noreferrer" className="btn-sec py-1">
                    {d.tipo === 'enlace' ? 'Abrir' : 'Ver o descargar'}
                  </a>
                  {onEliminar && puedeEliminar(d) && (
                    <button onClick={() => onEliminar(d)} className="text-xs font-semibold text-alerta underline">Eliminar</button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
