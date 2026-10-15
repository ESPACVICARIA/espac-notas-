import { useRef, useState } from 'react'
import SubirImagen from './SubirImagen'
import { partirHuecos, nuevoId } from '../lib/bloques'

// Lista de filas con campos (parejas, elementos, hechos…)
function Filas({ items, campos, cambiar, nombre, max = 12, min = 1, ayuda }) {
  const set = (k, campo, v) => cambiar(items.map((x, j) => (j === k ? { ...x, [campo]: v } : x)))
  const mover = (k, p) => { const l = [...items]; const j = k + p; if (j < 0 || j >= l.length) return; [l[k], l[j]] = [l[j], l[k]]; cambiar(l) }
  const cols = campos.length === 1 ? '' : campos[0][2] === 'corto' ? 'sm:grid-cols-[8rem_1fr]' : 'sm:grid-cols-2'
  return (
    <div className="space-y-1.5">
      {ayuda && <p className="text-xs text-slate-500">{ayuda}</p>}
      {items.map((x, k) => (
        <div key={k} className="flex items-start gap-2">
          <span className="w-5 shrink-0 pt-1.5 text-right text-xs font-semibold text-slate-400">{k + 1}</span>
          <div className={`grid flex-1 gap-1.5 ${cols}`}>
            {campos.map(([campo, etiqueta]) => (
              <input key={campo} className="campo py-1 text-sm" placeholder={etiqueta} aria-label={`${etiqueta} ${k + 1}`}
                value={x[campo] ?? ''} onChange={(e) => set(k, campo, e.target.value)} />
            ))}
          </div>
          <span className="flex shrink-0 items-center gap-1 pt-1 text-xs">
            <button className="px-0.5 text-mariano disabled:text-slate-300" disabled={k === 0} onClick={() => mover(k, -1)} aria-label="Subir">▲</button>
            <button className="px-0.5 text-mariano disabled:text-slate-300" disabled={k === items.length - 1} onClick={() => mover(k, 1)} aria-label="Bajar">▼</button>
            <button className="px-0.5 text-slate-400 hover:text-alerta disabled:opacity-30" disabled={items.length <= min} onClick={() => cambiar(items.filter((_, j) => j !== k))} aria-label="Quitar">✕</button>
          </span>
        </div>
      ))}
      {items.length < max && (
        <button className="ml-7 text-sm font-semibold text-mariano underline" onClick={() => cambiar([...items, Object.fromEntries(campos.map(([c]) => [c, '']))])}>
          Agregar {nombre}
        </button>
      )}
    </div>
  )
}

const Titulo = ({ b, cambiar, ejemplo }) => (
  <input className="campo py-1" placeholder={`Instrucción o título (ej. ${ejemplo})`} value={b.titulo ?? ''} onChange={(e) => cambiar({ ...b, titulo: e.target.value })} />
)

function Opciones({ valor, opciones, alCambiar }) {
  return (
    <div className="flex flex-wrap gap-2 text-xs">
      {opciones.map(([k, t]) => (
        <button key={k} onClick={() => alCambiar(k)} aria-pressed={valor === k}
          className={`rounded-full border px-3 py-1 font-semibold ${valor === k ? 'border-mariano bg-cielo text-mariano' : 'border-slate-200'}`}>{t}</button>
      ))}
    </div>
  )
}

// Preguntas de opción múltiple para la trivia y el laberinto
function PreguntasJuego({ id, preguntas, cambiar, maxOpciones = 6 }) {
  const set = (i, q) => cambiar(preguntas.map((x, j) => (j === i ? q : x)))
  return (
    <div className="space-y-3">
      {preguntas.map((q, i) => (
        <fieldset key={i} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <legend className="flex w-full items-center gap-2 px-1 text-xs font-semibold text-slate-500">
            Pregunta {i + 1}
            {preguntas.length > 1 && <button className="ml-auto font-normal text-alerta underline" onClick={() => cambiar(preguntas.filter((_, j) => j !== i))}>quitar</button>}
          </legend>
          <input className="campo mb-2 py-1" placeholder="Enunciado" value={q.enunciado} onChange={(e) => set(i, { ...q, enunciado: e.target.value })} />
          <p className="mb-1 text-xs text-slate-500">Marca la opción correcta</p>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {q.opciones.map((o, k) => (
              <div key={k} className="flex items-center gap-2">
                <input type="radio" name={`jq-${id}-${i}`} checked={q.correcta === k} onChange={() => set(i, { ...q, correcta: k })} aria-label={`Opción ${k + 1} correcta`} />
                <input className={`campo py-1 text-sm ${q.correcta === k ? 'border-green-500' : ''}`} placeholder={`Opción ${k + 1}`} value={o}
                  onChange={(e) => set(i, { ...q, opciones: q.opciones.map((x, j) => (j === k ? e.target.value : x)) })} />
                {q.opciones.length > 2 && (
                  <button className="text-xs text-slate-400 hover:text-alerta" aria-label="Quitar opción"
                    onClick={() => set(i, { ...q, opciones: q.opciones.filter((_, j) => j !== k), correcta: q.correcta === k ? 0 : q.correcta > k ? q.correcta - 1 : q.correcta })}>✕</button>
                )}
              </div>
            ))}
          </div>
          {q.opciones.length < maxOpciones && (
            <button className="mt-1 text-xs font-semibold text-mariano underline" onClick={() => set(i, { ...q, opciones: [...q.opciones, ''] })}>Agregar opción</button>
          )}
        </fieldset>
      ))}
      {preguntas.length < 20 && (
        <button className="text-sm font-semibold text-mariano underline" onClick={() => cambiar([...preguntas, { enunciado: '', opciones: Array(Math.min(3, maxOpciones)).fill(''), correcta: 0 }])}>
          Agregar pregunta
        </button>
      )}
    </div>
  )
}

function EditorClasificar({ b, cambiar }) {
  const set = (i, g) => cambiar({ ...b, grupos: b.grupos.map((x, j) => (j === i ? g : x)) })
  return (
    <div className="space-y-2">
      <Titulo b={b} cambiar={cambiar} ejemplo="Clasifica cada sacramento según su grupo" />
      <div className={`grid gap-2 ${b.grupos.length > 2 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
        {b.grupos.map((g, i) => (
          <div key={i} className="rounded-lg border border-slate-200 bg-slate-50 p-2">
            <div className="mb-1 flex items-center gap-2">
              <input className="campo py-1 text-sm font-semibold" placeholder={`Nombre del grupo ${i + 1}`} value={g.nombre} onChange={(e) => set(i, { ...g, nombre: e.target.value })} />
              {b.grupos.length > 2 && <button className="text-xs text-slate-400 hover:text-alerta" aria-label="Quitar grupo" onClick={() => cambiar({ ...b, grupos: b.grupos.filter((_, j) => j !== i) })}>✕</button>}
            </div>
            <textarea rows={4} className="campo py-1 text-sm" placeholder={'Un elemento por línea\nBautismo\nConfirmación'} aria-label={`Elementos del grupo ${i + 1}`}
              value={g.elementos.join('\n')} onChange={(e) => set(i, { ...g, elementos: e.target.value.split('\n') })} />
          </div>
        ))}
      </div>
      {b.grupos.length < 4 && <button className="text-sm font-semibold text-mariano underline" onClick={() => cambiar({ ...b, grupos: [...b.grupos, { nombre: '', elementos: [] }] })}>Agregar grupo</button>}
    </div>
  )
}

function EditorDiagrama({ b, cambiar }) {
  const [moviendo, setMoviendo] = useState(null)
  const setPuntos = (puntos) => cambiar({ ...b, puntos })
  function tocar(e) {
    const r = e.currentTarget.getBoundingClientRect()
    const x = Math.round(((e.clientX - r.left) / r.width) * 1000) / 10
    const y = Math.round(((e.clientY - r.top) / r.height) * 1000) / 10
    if (moviendo) { setPuntos(b.puntos.map((p) => (p.id === moviendo ? { ...p, x, y } : p))); setMoviendo(null) }
    else if (b.puntos.length < 15) setPuntos([...b.puntos, { id: nuevoId(), x, y, nombre: '' }])
  }
  return (
    <div className="space-y-2">
      <Titulo b={b} cambiar={cambiar} ejemplo="Señala las partes del templo" />
      <SubirImagen url={b.url} alCambiar={(url) => cambiar({ ...b, url })} vistaPrevia={false} />
      {b.url && (
        <>
          <p className="text-xs text-slate-500">{moviendo ? 'Toca la imagen en el nuevo lugar del punto.' : 'Toca la imagen donde va cada parte para poner un punto y escribe su nombre abajo.'}</p>
          <div className="relative max-w-xl cursor-crosshair select-none" onClick={tocar}>
            <img src={b.url} alt="" className="w-full rounded-lg border border-slate-200" draggable={false} />
            {b.puntos.map((p, k) => (
              <span key={p.id} style={{ left: `${p.x}%`, top: `${p.y}%` }}
                className={`pointer-events-none absolute grid h-7 w-7 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-white text-xs font-bold text-white shadow ${moviendo === p.id ? 'bg-oro' : 'bg-tinta'}`}>{k + 1}</span>
            ))}
          </div>
          <ol className="space-y-1.5">
            {b.puntos.map((p, k) => (
              <li key={p.id} className="flex items-center gap-2">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-tinta text-xs font-bold text-white">{k + 1}</span>
                <input className="campo py-1 text-sm" placeholder="Nombre de esta parte" value={p.nombre}
                  onChange={(e) => setPuntos(b.puntos.map((x) => (x.id === p.id ? { ...x, nombre: e.target.value } : x)))} />
                <button className="text-xs text-mariano underline" onClick={() => setMoviendo(moviendo === p.id ? null : p.id)}>{moviendo === p.id ? 'cancelar' : 'mover'}</button>
                <button className="text-xs text-slate-400 hover:text-alerta" aria-label="Quitar punto" onClick={() => setPuntos(b.puntos.filter((x) => x.id !== p.id))}>✕</button>
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  )
}

function EditorCompletar({ b, cambiar }) {
  const area = useRef(null)
  const huecos = partirHuecos(b.texto).filter((x) => x.aceptadas)
  function hacerHueco() {
    const t = area.current
    if (!t) return
    const [a, z] = [t.selectionStart, t.selectionEnd]
    const sel = b.texto.slice(a, z).trim()
    if (!sel || sel.includes('[[')) return
    const texto = `${b.texto.slice(0, a)}[[${sel}]]${b.texto.slice(z)}`
    cambiar({ ...b, texto })
    requestAnimationFrame(() => { t.focus(); t.setSelectionRange(a + sel.length + 4, a + sel.length + 4) })
  }
  return (
    <div className="space-y-2">
      <Titulo b={b} cambiar={cambiar} ejemplo="Completa el texto del Credo" />
      <textarea ref={area} rows={4} className="campo text-[15px] leading-relaxed" aria-label="Texto con espacios"
        placeholder="Dios es [[amor]] y nos llama a [[servir|servicio]] a los hermanos." value={b.texto} onChange={(e) => cambiar({ ...b, texto: e.target.value })} />
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn-sec py-1 text-sm" onMouseDown={(e) => e.preventDefault()} onClick={hacerHueco}>Convertir en hueco lo seleccionado</button>
        <span className="text-xs text-slate-500">
          {huecos.length} hueco(s). Lo que va entre [[ ]] es el espacio; separa con | otras respuestas válidas: [[servir|servicio]].
        </span>
      </div>
      <Opciones valor={b.modo} alCambiar={(modo) => cambiar({ ...b, modo })} opciones={[['banco', 'Con banco de palabras'], ['escribir', 'Escribiendo la respuesta']]} />
      {b.modo !== 'escribir' && (
        <input className="campo py-1 text-sm" placeholder="Palabras de distracción, separadas por comas (opcional): odio, temor, poder"
          value={b.distractores ?? ''} onChange={(e) => cambiar({ ...b, distractores: e.target.value })} />
      )}
    </div>
  )
}

function EditorRuleta({ b, cambiar }) {
  return (
    <div className="space-y-2">
      <Titulo b={b} cambiar={cambiar} ejemplo="¿Qué tema nos toca compartir?" />
      <textarea rows={5} className="campo text-sm" aria-label="Opciones de la ruleta" placeholder={'Una opción por línea (de 2 a 12)\nBautismo\nConfirmación\nEucaristía'}
        value={b.items.join('\n')} onChange={(e) => cambiar({ ...b, items: e.target.value.split('\n').slice(0, 12) })} />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={!!b.quitar} onChange={(e) => cambiar({ ...b, quitar: e.target.checked })} />
        Quitar de la ruleta lo que ya salió
      </label>
    </div>
  )
}

// Editor de las actividades nuevas; devuelve null si el tipo no es de aquí
export default function EditorActividad({ b, cambiar }) {
  const set = (k, v) => cambiar({ ...b, [k]: v })
  switch (b.tipo) {
    case 'unir':
      return (
        <div className="space-y-2">
          <Titulo b={b} cambiar={cambiar} ejemplo="Une cada sacramento con su signo" />
          <Filas items={b.pares} nombre="pareja" min={2} max={10} cambiar={(v) => set('pares', v)}
            campos={[['izq', 'Columna izquierda'], ['der', 'Su pareja (derecha)']]} ayuda="Escribe cada pareja en la misma fila. Al estudiante la columna derecha le llega mezclada." />
        </div>
      )
    case 'clasificar': return <EditorClasificar b={b} cambiar={cambiar} />
    case 'memorama':
      return (
        <div className="space-y-2">
          <Titulo b={b} cambiar={cambiar} ejemplo="Encuentra cada término con su significado" />
          <Filas items={b.pares} nombre="pareja" min={2} max={8} cambiar={(v) => set('pares', v)}
            campos={[['a', 'Carta 1 (ej. Epíclesis)'], ['b', 'Carta 2 (ej. Invocación del Espíritu)']]} ayuda="Cada fila es una pareja de cartas. Máximo 8 parejas (16 cartas)." />
        </div>
      )
    case 'diagrama': return <EditorDiagrama b={b} cambiar={cambiar} />
    case 'completar': return <EditorCompletar b={b} cambiar={cambiar} />
    case 'ordenar':
      return (
        <div className="space-y-2">
          <Titulo b={b} cambiar={cambiar} ejemplo="Ordena las letras" />
          <Opciones valor={b.modo} alCambiar={(modo) => set('modo', modo)} opciones={[['letras', 'Letras de una palabra'], ['palabras', 'Palabras de una oración']]} />
          <Filas items={b.items} nombre={b.modo === 'palabras' ? 'oración' : 'palabra'} max={10} cambiar={(v) => set('items', v)}
            campos={[['respuesta', b.modo === 'palabras' ? 'Oración correcta' : 'Palabra correcta'], ['pista', 'Pista (opcional)']]} />
        </div>
      )
    case 'linea':
      return (
        <div className="space-y-2">
          <Titulo b={b} cambiar={cambiar} ejemplo="Ordena la historia de la salvación" />
          <Filas items={b.items} nombre="hecho" min={2} max={12} cambiar={(v) => set('items', v)}
            campos={[['fecha', 'Fecha (opcional)', 'corto'], ['texto', 'Hecho o acontecimiento']]}
            ayuda="Escríbelos en el orden correcto, del primero al último. Al estudiante le llegan desordenados; la fecha se le muestra al comprobar." />
        </div>
      )
    case 'jerarquia':
      return (
        <div className="space-y-2">
          <Titulo b={b} cambiar={cambiar} ejemplo="Ordena la jerarquía de la Iglesia" />
          <Filas items={b.items} nombre="nivel" min={2} max={12} cambiar={(v) => set('items', v)}
            campos={[['texto', 'Nivel']]} ayuda="Escríbelos en el orden correcto, de lo más alto a lo más bajo. Al estudiante le llegan desordenados." />
        </div>
      )
    case 'trivia':
      return (
        <div className="space-y-2">
          <Titulo b={b} cambiar={cambiar} ejemplo="Trivia de los sacramentos" />
          <label className="flex items-center gap-2 text-sm">
            Segundos por pregunta
            <input type="number" min={5} max={120} className="campo w-20 py-1" value={b.segundos} onChange={(e) => set('segundos', Number(e.target.value))} />
            <span className="text-xs text-slate-500">Cada acierto da de 50 a 100 puntos según la rapidez. La nota es aciertos ÷ preguntas.</span>
          </label>
          <PreguntasJuego id={b.id} preguntas={b.preguntas} cambiar={(v) => set('preguntas', v)} />
        </div>
      )
    case 'ruleta': return <EditorRuleta b={b} cambiar={cambiar} />
    case 'laberinto':
      return (
        <div className="space-y-2">
          <Titulo b={b} cambiar={cambiar} ejemplo="Llega a la respuesta correcta" />
          <label className="flex items-center gap-2 text-sm">
            Enemigos
            <select className="campo w-auto py-1" value={b.enemigos} onChange={(e) => set('enemigos', Number(e.target.value))}>
              {[0, 1, 2, 3].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <span className="text-xs text-slate-500">Cada pregunta tiene de 2 a 4 opciones (A, B, C, D) en las esquinas del laberinto.</span>
          </label>
          <PreguntasJuego id={b.id} preguntas={b.preguntas} maxOpciones={4} cambiar={(v) => set('preguntas', v)} />
        </div>
      )
    default: return null
  }
}
