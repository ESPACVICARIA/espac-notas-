import { useState } from 'react'
import TextoFormateado from './TextoFormateado'
import Video from './Video'
import { ESTILOS_DESTACADO } from '../lib/bloques'

function Destacado({ b }) {
  const e = ESTILOS_DESTACADO[b.estilo] ?? ESTILOS_DESTACADO.idea
  return (
    <aside className={`rounded-r-xl border-l-4 px-5 py-4 ${e.clase}`}>
      <p className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
        <span aria-hidden="true" className="text-base">{e.marca}</span>{b.titulo || e.nombre}
      </p>
      <TextoFormateado texto={b.texto} className={`[&>p:first-child]:mt-0 ${b.estilo === 'biblia' ? 'font-serif text-[1.08em] italic' : ''}`} />
    </aside>
  )
}

function Imagen({ b }) {
  const [grande, setGrande] = useState(false)
  if (!b.url) return null
  return (
    <figure>
      <button type="button" onClick={() => setGrande(true)} className="block w-full overflow-hidden rounded-xl" aria-label="Ampliar imagen">
        <img src={b.url} alt={b.pie || ''} className="w-full object-cover transition hover:scale-[1.01]" loading="lazy" />
      </button>
      {b.pie && <figcaption className="mt-2 text-center text-sm text-slate-500">{b.pie}</figcaption>}
      {grande && (
        <div role="dialog" aria-modal="true" aria-label="Imagen ampliada" onClick={() => setGrande(false)}
          className="fixed inset-0 z-50 grid cursor-zoom-out place-items-center bg-black/85 p-4">
          <img src={b.url} alt={b.pie || ''} className="max-h-full max-w-full rounded-lg" />
          <button className="absolute right-4 top-4 rounded-full bg-white/90 px-3 py-1 text-sm font-semibold text-tinta">Cerrar</button>
        </div>
      )}
    </figure>
  )
}

function Tarjetas({ b }) {
  const [giradas, setGiradas] = useState(new Set())
  const items = b.items.filter((x) => x.frente || x.reverso)
  const girar = (k) => setGiradas((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n })
  return (
    <div>
      {b.titulo && <h4 className="mb-1 font-serif text-lg font-semibold">{b.titulo}</h4>}
      <p className="mb-3 text-xs text-slate-500">Toca cada tarjeta para girarla · {giradas.size} de {items.length} descubiertas</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {items.map((x, k) => {
          const vuelta = giradas.has(k)
          return (
            <button key={k} type="button" onClick={() => girar(k)} aria-pressed={vuelta} aria-label={vuelta ? `${x.frente}: ${x.reverso}` : `Girar tarjeta ${x.frente}`}
              className="h-40 [perspective:900px] focus-visible:outline-2 focus-visible:outline-oro">
              <span className={`relative block h-full w-full rounded-xl transition-transform duration-500 [transform-style:preserve-3d] motion-reduce:transition-none ${vuelta ? '[transform:rotateY(180deg)]' : ''}`}>
                <span className="absolute inset-0 grid place-items-center rounded-xl bg-tinta p-3 text-center font-serif text-lg font-semibold text-white [backface-visibility:hidden]">
                  {x.frente}
                  <span className="absolute bottom-2 text-[10px] font-sans font-normal uppercase tracking-wider text-blue-200">Toca para girar</span>
                </span>
                <span className="absolute inset-0 grid place-items-center overflow-auto rounded-xl border-2 border-oro bg-white p-3 text-center text-[13px] leading-snug text-tinta [backface-visibility:hidden] [transform:rotateY(180deg)]">
                  {x.reverso}
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function Acordeon({ b }) {
  const [abiertos, setAbiertos] = useState(new Set())
  const items = b.items.filter((x) => x.titulo)
  return (
    <div>
      {b.titulo && <h4 className="mb-2 font-serif text-lg font-semibold">{b.titulo}</h4>}
      <div className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200">
        {items.map((x, k) => {
          const abierto = abiertos.has(k)
          return (
            <div key={k}>
              <button type="button" aria-expanded={abierto}
                onClick={() => setAbiertos((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n })}
                className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left font-semibold ${abierto ? 'bg-cielo text-mariano' : 'bg-white hover:bg-slate-50'}`}>
                {x.titulo}
                <span aria-hidden="true" className={`text-xl leading-none transition-transform ${abierto ? 'rotate-45' : ''}`}>+</span>
              </button>
              {abierto && <div className="bg-white px-4 pb-4"><TextoFormateado texto={x.texto} /></div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Pasos({ b }) {
  const items = b.items.filter((x) => x.titulo)
  const [visibles, setVisibles] = useState(1)
  return (
    <div>
      {b.titulo && <h4 className="mb-3 font-serif text-lg font-semibold">{b.titulo}</h4>}
      <ol className="relative space-y-4 border-l-2 border-cielo pl-6">
        {items.slice(0, visibles).map((x, k) => (
          <li key={k} className="relative">
            <span className="absolute -left-[2.1rem] grid h-7 w-7 place-items-center rounded-full bg-mariano text-sm font-semibold text-white">{k + 1}</span>
            <p className="font-semibold">{x.titulo}</p>
            {x.texto && <TextoFormateado texto={x.texto} className="text-[15px] text-slate-700 [&>p:first-child]:mt-1" />}
          </li>
        ))}
      </ol>
      <div className="mt-4 flex flex-wrap gap-3 pl-6">
        {visibles < items.length ? (
          <>
            <button className="btn py-1.5" onClick={() => setVisibles(visibles + 1)}>Siguiente paso ({visibles + 1} de {items.length})</button>
            <button className="text-sm text-mariano underline" onClick={() => setVisibles(items.length)}>Ver todos</button>
          </>
        ) : items.length > 1 && (
          <button className="text-sm text-mariano underline" onClick={() => setVisibles(1)}>Volver a empezar</button>
        )}
      </div>
    </div>
  )
}

function Pregunta({ b }) {
  const [elegida, setElegida] = useState(null)
  const opciones = b.modo === 'vf' ? ['Verdadero', 'Falso'] : b.opciones.filter(Boolean)
  const correcta = b.modo === 'vf' ? (b.correcta ? 'Verdadero' : 'Falso') : b.opciones[b.correcta]
  const acierto = elegida === correcta
  return (
    <div className="rounded-xl border-2 border-mariano/30 bg-white p-5">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-mariano">Pregunta rápida</p>
      <p className="mb-4 text-lg font-medium">{b.enunciado}</p>
      <div className={`grid gap-2 ${b.modo === 'vf' ? 'grid-cols-2' : ''}`}>
        {opciones.map((o) => {
          const esta = elegida === o
          const color = elegida === null ? 'border-slate-200 bg-white hover:border-mariano hover:bg-cielo'
            : o === correcta ? 'border-green-600 bg-green-50 text-green-900'
            : esta ? 'border-alerta bg-red-50 text-red-900' : 'border-slate-200 bg-white opacity-60'
          return (
            <button key={o} type="button" disabled={elegida !== null} onClick={() => setElegida(o)}
              className={`rounded-lg border-2 px-4 py-3 text-left font-medium transition ${color} ${b.modo === 'vf' ? 'text-center' : ''}`}>
              {elegida !== null && o === correcta && <span aria-hidden="true">✓ </span>}
              {esta && o !== correcta && <span aria-hidden="true">✗ </span>}
              {o}
            </button>
          )
        })}
      </div>
      {elegida !== null && (
        <div role="status" className={`mt-4 rounded-lg p-3 text-sm ${acierto ? 'bg-green-50 text-green-900' : 'bg-amber-50 text-amber-900'}`}>
          <p className="font-semibold">{acierto ? '¡Correcto!' : `La respuesta es: ${correcta}`}</p>
          {b.explicacion && <p className="mt-1">{b.explicacion}</p>}
          <button className="mt-2 text-xs underline" onClick={() => setElegida(null)}>Intentar de nuevo</button>
        </div>
      )}
    </div>
  )
}

function Reflexion({ b, inicial = '', onGuardar }) {
  const [texto, setTexto] = useState(inicial)
  const [guardado, setGuardado] = useState(inicial)
  const [estado, setEstado] = useState(null)
  async function guardar() {
    if (!onGuardar) return
    setEstado('guardando')
    const error = await onGuardar(b.id, texto)
    if (error) { setEstado({ error }); return }
    setGuardado(texto); setEstado('ok')
  }
  return (
    <div className="rounded-xl bg-tinta p-5 text-white">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-oro">Para tu reflexión</p>
      <p className="mb-3 font-serif text-lg">{b.pregunta}</p>
      <textarea rows={4} maxLength={3000} className="w-full rounded-lg border-0 bg-white p-3 text-[15px] text-tinta focus:outline-none focus:ring-2 focus:ring-oro"
        aria-label={b.pregunta} placeholder="Escribe aquí lo que te suscita…" value={texto}
        onChange={(e) => { setTexto(e.target.value); setEstado(null) }} disabled={!onGuardar} />
      <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
        {onGuardar ? (
          <button className="rounded-md bg-oro px-4 py-1.5 font-semibold text-white disabled:opacity-50"
            disabled={estado === 'guardando' || texto === guardado} onClick={guardar}>
            {estado === 'guardando' ? 'Guardando…' : 'Guardar mi reflexión'}
          </button>
        ) : <span className="text-blue-200">Aquí el estudiante escribirá y guardará su reflexión.</span>}
        {estado === 'ok' && <span className="text-green-200">Guardada. Tu formador podrá leerla.</span>}
        {estado?.error && <span className="text-red-200">{estado.error}</span>}
      </div>
    </div>
  )
}

// Muestra los bloques de una lección. onReflexion(bloqueId, texto) devuelve un mensaje de error o null.
export default function BloquesVista({ bloques = [], reflexiones = {}, onReflexion }) {
  return (
    <div className="space-y-7 text-[16px] text-slate-800">
      {bloques.map((b) => {
        switch (b.tipo) {
          case 'texto': return <TextoFormateado key={b.id} texto={b.texto} className="[&>*:first-child]:mt-0" />
          case 'destacado': return <Destacado key={b.id} b={b} />
          case 'imagen': return <Imagen key={b.id} b={b} />
          case 'video': return <div key={b.id}><Video url={b.url} />{b.pie && <p className="mt-2 text-center text-sm text-slate-500">{b.pie}</p>}</div>
          case 'tarjetas': return <Tarjetas key={b.id} b={b} />
          case 'acordeon': return <Acordeon key={b.id} b={b} />
          case 'pasos': return <Pasos key={b.id} b={b} />
          case 'pregunta': return <Pregunta key={b.id} b={b} />
          case 'reflexion': return <Reflexion key={b.id} b={b} inicial={reflexiones[b.id] ?? ''} onGuardar={onReflexion} />
          case 'boton': return (
            <div key={b.id} className="text-center">
              <a href={b.url} target="_blank" rel="noopener noreferrer" className="btn px-6 py-3 text-base">{b.texto}</a>
            </div>
          )
          default: return null
        }
      })}
    </div>
  )
}
