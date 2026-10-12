import { useState } from 'react'
import { PROMPT_IA, leerRespuestaIA, leccionDesdeIA, repasoDesdeIA } from '../lib/importarIA'

const CLAVE_REPASO = 'espac-repaso-ia'
export function repasoPendiente() {
  try { return JSON.parse(sessionStorage.getItem(CLAVE_REPASO) ?? 'null') } catch { return null }
}
export function guardarRepasoPendiente(r) {
  try { r ? sessionStorage.setItem(CLAVE_REPASO, JSON.stringify(r)) : sessionStorage.removeItem(CLAVE_REPASO) } catch { /* sin almacenamiento */ }
}

async function copiar(texto) {
  try { await navigator.clipboard.writeText(texto); return true } catch { return false }
}

// modo: 'leccion' (crea la lección y guarda el repaso para después) o 'repaso' (solo preguntas)
export default function CrearConIA({ modo = 'leccion', alImportar, cerrar }) {
  const [respuesta, setRespuesta] = useState('')
  const [revision, setRevision] = useState(null)
  const [error, setError] = useState('')
  const [copiado, setCopiado] = useState(null)
  const [verPrompt, setVerPrompt] = useState(false)

  async function copiarPrompt() {
    const ok = await copiar(PROMPT_IA)
    setCopiado(ok ? 'Instrucciones copiadas. Pégalas en la IA y agrega el material del tema al final.' : 'No se pudo copiar automáticamente: selecciona el texto de abajo y cópialo.')
    if (!ok) setVerPrompt(true)
  }

  function revisar() {
    setError(''); setRevision(null)
    try {
      const datos = leerRespuestaIA(respuesta)
      const leccion = modo === 'leccion' ? leccionDesdeIA(datos) : null
      const repaso = repasoDesdeIA(datos)
      if (modo === 'repaso' && !repaso?.preguntas.length) throw new Error('La respuesta no trae preguntas de repaso válidas («repaso» con «preguntas»).')
      setRevision({ leccion, repaso })
    } catch (e) {
      setError(e.message)
    }
  }

  function cargar() {
    if (modo === 'leccion') guardarRepasoPendiente(revision.repaso?.preguntas.length ? revision.repaso : null)
    alImportar(revision)
  }

  const cuenta = (bloques, tipo) => bloques.filter((b) => b.tipo === tipo).length

  return (
    <div className="space-y-5 rounded-lg border border-mariano/30 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">{modo === 'leccion' ? 'Crear la lección con ayuda de una IA' : 'Crear el repaso con ayuda de una IA'}</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Funciona con ChatGPT, Claude, Gemini o Copilot. La IA prepara el contenido con el formato de la plataforma; tú lo revisas
            antes de publicarlo.
          </p>
        </div>
        {cerrar && <button className="text-sm text-slate-500 underline" onClick={cerrar}>Cerrar</button>}
      </div>

      <ol className="space-y-5">
        <li>
          <p className="font-semibold"><span className="mr-2 inline-grid h-6 w-6 place-items-center rounded-full bg-mariano text-xs text-white">1</span>Copia las instrucciones</p>
          <div className="ml-8 mt-2 flex flex-wrap items-center gap-3">
            <button className="btn" onClick={copiarPrompt}>Copiar instrucciones para la IA</button>
            <button className="text-sm text-mariano underline" onClick={() => setVerPrompt(!verPrompt)}>{verPrompt ? 'Ocultar' : 'Ver'} las instrucciones</button>
          </div>
          {copiado && <p className="ml-8 mt-2 text-sm text-green-700">{copiado}</p>}
          {verPrompt && <textarea readOnly rows={10} className="campo ml-8 mt-2 w-[calc(100%-2rem)] font-mono text-xs" value={PROMPT_IA} onFocus={(e) => e.target.select()} />}
        </li>
        <li>
          <p className="font-semibold"><span className="mr-2 inline-grid h-6 w-6 place-items-center rounded-full bg-mariano text-xs text-white">2</span>Pégalas en la IA junto con el material</p>
          <p className="ml-8 mt-1 text-sm text-slate-600">
            Abre la IA, pega las instrucciones y, al final, donde dice «MATERIAL DEL MÓDULO», pega el texto del tema: tus apuntes,
            un resumen o el contenido del módulo. Envía el mensaje y espera la respuesta.
          </p>
        </li>
        <li>
          <p className="font-semibold"><span className="mr-2 inline-grid h-6 w-6 place-items-center rounded-full bg-mariano text-xs text-white">3</span>Pega aquí la respuesta completa de la IA</p>
          <textarea rows={8} className="campo ml-8 mt-2 w-[calc(100%-2rem)] font-mono text-xs" placeholder='```json&#10;{ "leccion": { … }, "repaso": { … } }&#10;```'
            value={respuesta} onChange={(e) => { setRespuesta(e.target.value); setRevision(null); setError('') }} />
          <div className="ml-8 mt-2"><button className="btn-sec" onClick={revisar} disabled={!respuesta.trim()}>Revisar la respuesta</button></div>
          {error && <p className="ml-8 mt-2 text-sm text-alerta">{error}</p>}
        </li>
      </ol>

      {revision && (
        <div className="rounded-lg bg-cielo/60 p-4 text-sm">
          {revision.leccion && (
            <>
              <p className="font-semibold">Lección: {revision.leccion.titulo || 'Sin título'}</p>
              <p className="mt-1 text-slate-700">
                {revision.leccion.bloques.length} bloques: {cuenta(revision.leccion.bloques, 'texto')} de texto, {cuenta(revision.leccion.bloques, 'destacado')} destacados,
                {' '}{cuenta(revision.leccion.bloques, 'tarjetas')} de tarjetas, {cuenta(revision.leccion.bloques, 'acordeon') + cuenta(revision.leccion.bloques, 'pasos')} para descubrir o paso a paso,
                {' '}{cuenta(revision.leccion.bloques, 'pregunta')} preguntas rápidas y {cuenta(revision.leccion.bloques, 'reflexion')} reflexiones.
              </p>
            </>
          )}
          {revision.repaso && (
            <p className="mt-2 text-slate-700">
              <strong>Repaso:</strong> {revision.repaso.preguntas.length} preguntas listas
              {revision.repaso.descartadas > 0 && `, ${revision.repaso.descartadas} descartadas por estar incompletas`}.
              {modo === 'leccion' && ' Quedará guardado para que lo crees en Digitar notas > Repasos.'}
            </p>
          )}
          {[...(revision.leccion?.omitidos ?? []), ...(revision.leccion?.incompletos ?? [])].length > 0 && (
            <ul className="mt-2 list-disc pl-5 text-amber-800">
              {revision.leccion.omitidos.map((x) => <li key={x}>Omitido: {x}</li>)}
              {revision.leccion.incompletos.map((x) => <li key={x}>Para completar: {x}</li>)}
            </ul>
          )}
          <button className="btn mt-3" onClick={cargar} disabled={modo === 'leccion' ? !revision.leccion?.bloques.length : !revision.repaso?.preguntas.length}>
            {modo === 'leccion' ? 'Cargar en el editor' : 'Crear el repaso con estas preguntas'}
          </button>
          {modo === 'leccion' && <p className="mt-2 text-xs text-slate-500">Se abre como borrador: revísalo, agrega imágenes o videos si quieres, y luego guarda y publica.</p>}
        </div>
      )}
    </div>
  )
}
