import { useEffect, useMemo, useRef, useState } from 'react'
import { partirHuecos, normalizar } from '../lib/bloques'

// ---------- utilidades ----------

export function mezclar(lista) {
  const a = [...lista]
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] }
  return a
}
// Mezcla y se asegura de que no quede en el orden original
function desordenar(lista, igual = (x, y) => x === y) {
  if (lista.length < 2) return [...lista]
  for (let k = 0; k < 20; k++) {
    const m = mezclar(lista)
    if (m.some((x, i) => !igual(x, lista[i]))) return m
  }
  return [...lista].reverse()
}

// Avisa la nota de la actividad una sola vez (la primera vez que se completa)
function useResultado(alResultado) {
  const hecho = useRef(false)
  return (puntos) => {
    if (hecho.current) return
    hecho.current = true
    alResultado?.(Math.max(0, Math.min(1, puntos)))
  }
}

// Arrastrar con dedo o ratón. Los destinos llevan data-soltar="valor".
function useArrastre(alSoltar) {
  const [fantasma, setFantasma] = useState(null)
  const arrastro = useRef(false)
  function iniciar(e, valor, texto) {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    const x0 = e.clientX, y0 = e.clientY
    let activo = false
    arrastro.current = false
    const mover = (ev) => {
      if (!activo && Math.hypot(ev.clientX - x0, ev.clientY - y0) > 8) { activo = true; arrastro.current = true }
      if (activo) setFantasma({ texto, x: ev.clientX, y: ev.clientY })
    }
    const fin = (ev) => {
      window.removeEventListener('pointermove', mover)
      window.removeEventListener('pointerup', fin)
      window.removeEventListener('pointercancel', fin)
      if (!activo) return
      setFantasma(null)
      if (ev.type === 'pointerup') {
        const el = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('[data-soltar]')
        if (el) alSoltar(valor, el.dataset.soltar)
      }
    }
    window.addEventListener('pointermove', mover)
    window.addEventListener('pointerup', fin)
    window.addEventListener('pointercancel', fin)
  }
  // Para ignorar el clic que llega justo después de soltar
  const fueArrastre = () => { const a = arrastro.current; arrastro.current = false; return a }
  const capa = fantasma && (
    <div aria-hidden="true" style={{ left: fantasma.x, top: fantasma.y }}
      className="pointer-events-none fixed z-50 max-w-[14rem] -translate-x-1/2 -translate-y-[120%] rounded-lg bg-tinta px-3 py-1.5 text-sm font-medium text-white shadow-lg">
      {fantasma.texto}
    </div>
  )
  return { iniciar, fueArrastre, capa }
}

function Marco({ marca, etiqueta, titulo, ayuda, children, color = 'border-mariano/30' }) {
  return (
    <div className={`rounded-xl border-2 ${color} bg-white p-4 sm:p-5`}>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-mariano"><span aria-hidden="true">{marca} </span>{etiqueta}</p>
      {titulo && <p className="mb-1 text-lg font-medium leading-snug">{titulo}</p>}
      {ayuda && <p className="mb-3 text-xs text-slate-500">{ayuda}</p>}
      {children}
    </div>
  )
}

function Aviso({ aviso }) {
  if (!aviso) return <p role="status" className="sr-only" />
  return (
    <p role="status" className={`mt-3 rounded-lg px-3 py-2 text-sm font-medium ${aviso.bien ? 'bg-green-50 text-green-900' : 'bg-amber-50 text-amber-900'}`}>{aviso.texto}</p>
  )
}

function Final({ correctas, total, otraVez, children }) {
  const pct = total ? correctas / total : 0
  return (
    <div role="status" className={`mt-4 rounded-lg p-3 text-sm ${pct === 1 ? 'bg-green-50 text-green-900' : 'bg-cielo text-tinta'}`}>
      <p className="font-semibold">{pct === 1 ? '¡Excelente! Todo correcto a la primera.' : `Lograste ${correctas} de ${total} a la primera.`}</p>
      {children}
      {otraVez && <button className="mt-2 text-xs underline" onClick={otraVez}>Practicar otra vez</button>}
    </div>
  )
}

const chip = 'touch-none select-none rounded-lg border-2 px-3 py-2 text-left text-[15px] font-medium transition'

// ---------- 🔗 Unir columnas ----------

export function Unir({ b, alResultado }) {
  const reportar = useResultado(alResultado)
  const pares = b.pares.filter((x) => x.izq && x.der)
  const [ronda, setRonda] = useState(0)
  const der = useMemo(() => desordenar(pares.map((p) => p.der)), [ronda, b.pares]) // eslint-disable-line react-hooks/exhaustive-deps
  const [unidos, setUnidos] = useState({}) // índice izq -> texto der
  const [fallos, setFallos] = useState(new Set())
  const [sel, setSel] = useState(null) // { lado, valor }
  const [aviso, setAviso] = useState(null)
  const usados = new Set(Object.values(unidos))
  const listo = Object.keys(unidos).length === pares.length

  function probar(i, d) {
    setSel(null)
    if (unidos[i] !== undefined || usados.has(d)) return
    if (pares[i].der === d) {
      const n = { ...unidos, [i]: d }
      setUnidos(n)
      setAviso({ bien: true, texto: `¡Bien! ${pares[i].izq} → ${d}` })
      if (Object.keys(n).length === pares.length) reportar((pares.length - fallos.size) / pares.length)
    } else {
      setFallos((f) => new Set(f).add(i))
      setAviso({ bien: false, texto: `«${pares[i].izq}» no va con «${d}». Intenta de nuevo.` })
    }
  }
  const { iniciar, fueArrastre, capa } = useArrastre((valor, destino) => {
    const [lado, v] = valor.split(':')
    const [, dv] = destino.split(':')
    if (lado === 'i') probar(Number(v), der[Number(dv)])
    else probar(Number(dv), der[Number(v)])
  })
  function tocar(lado, valor) {
    if (fueArrastre()) return
    if (!sel || sel.lado === lado) { setSel(sel?.lado === lado && sel.valor === valor ? null : { lado, valor }); return }
    lado === 'i' ? probar(valor, der[sel.valor]) : probar(sel.valor, der[valor])
  }
  const numero = (i) => Object.keys(unidos).map(Number).sort((x, y) => x - y).indexOf(i) + 1
  const otraVez = () => { setUnidos({}); setFallos(new Set()); setAviso(null); setSel(null); setRonda((r) => r + 1) }

  return (
    <Marco marca="🔗" etiqueta="Unir columnas" titulo={b.titulo} ayuda="Toca un elemento de cada columna, o arrastra uno sobre su pareja.">
      <div className="grid grid-cols-2 gap-2 sm:gap-4">
        <ul className="space-y-2">
          {pares.map((p, i) => {
            const ok = unidos[i] !== undefined
            const activo = sel?.lado === 'i' && sel.valor === i
            return (
              <li key={i}>
                <button type="button" disabled={ok} data-soltar={`i:${i}`} aria-pressed={activo}
                  onPointerDown={(e) => !ok && iniciar(e, `i:${i}`, p.izq)} onClick={() => tocar('i', i)}
                  className={`${chip} w-full ${ok ? 'border-green-600 bg-green-50 text-green-900' : activo ? 'border-mariano bg-cielo' : 'border-slate-200 bg-white hover:border-mariano'}`}>
                  {ok && <span className="mr-1 inline-grid h-5 w-5 place-items-center rounded-full bg-green-600 text-xs text-white">{numero(i)}</span>}{p.izq}
                </button>
              </li>
            )
          })}
        </ul>
        <ul className="space-y-2">
          {der.map((d, k) => {
            const i = Number(Object.keys(unidos).find((x) => unidos[x] === d))
            const ok = usados.has(d)
            const activo = sel?.lado === 'd' && sel.valor === k
            return (
              <li key={k}>
                <button type="button" disabled={ok} data-soltar={`d:${k}`} aria-pressed={activo}
                  onPointerDown={(e) => !ok && iniciar(e, `d:${k}`, d)} onClick={() => tocar('d', k)}
                  className={`${chip} w-full ${ok ? 'border-green-600 bg-green-50 text-green-900' : activo ? 'border-mariano bg-cielo' : 'border-slate-200 bg-slate-50 hover:border-mariano'}`}>
                  {ok && <span className="mr-1 inline-grid h-5 w-5 place-items-center rounded-full bg-green-600 text-xs text-white">{numero(i)}</span>}{d}
                </button>
              </li>
            )
          })}
        </ul>
      </div>
      {listo ? <Final correctas={pares.length - fallos.size} total={pares.length} otraVez={otraVez} /> : <Aviso aviso={aviso} />}
      {capa}
    </Marco>
  )
}

// ---------- 🗂️ Clasificar en grupos ----------

export function Clasificar({ b, alResultado }) {
  const reportar = useResultado(alResultado)
  const grupos = b.grupos.filter((g) => g.nombre && g.elementos?.length)
  const todos = useMemo(() => grupos.flatMap((g, gi) => g.elementos.filter(Boolean).map((t) => ({ t, gi }))), [b.grupos]) // eslint-disable-line react-hooks/exhaustive-deps
  const [ronda, setRonda] = useState(0)
  const orden = useMemo(() => mezclar(todos.map((_, i) => i)), [todos, ronda])
  const [ubicados, setUbicados] = useState({}) // índice -> grupo
  const [fallos, setFallos] = useState(new Set())
  const [sel, setSel] = useState(null)
  const [aviso, setAviso] = useState(null)
  const pendientes = orden.filter((i) => ubicados[i] === undefined)
  const listo = !pendientes.length && todos.length > 0

  function soltar(i, gi) {
    setSel(null)
    if (ubicados[i] !== undefined) return
    if (todos[i].gi === gi) {
      const n = { ...ubicados, [i]: gi }
      setUbicados(n)
      setAviso({ bien: true, texto: `¡Bien! «${todos[i].t}» va en ${grupos[gi].nombre}.` })
      if (Object.keys(n).length === todos.length) reportar((todos.length - fallos.size) / todos.length)
    } else {
      setFallos((f) => new Set(f).add(i))
      setAviso({ bien: false, texto: `«${todos[i].t}» no va en «${grupos[gi].nombre}». Intenta en otra caja.` })
    }
  }
  const { iniciar, fueArrastre, capa } = useArrastre((v, destino) => soltar(Number(v), Number(destino)))
  const otraVez = () => { setUbicados({}); setFallos(new Set()); setAviso(null); setRonda((r) => r + 1) }

  return (
    <Marco marca="🗂️" etiqueta="Clasificar en grupos" titulo={b.titulo} ayuda="Toca un elemento y luego su caja, o arrástralo hasta ella.">
      {!listo && (
        <div className="mb-3 flex flex-wrap gap-2">
          {pendientes.map((i) => (
            <button key={i} type="button" aria-pressed={sel === i}
              onPointerDown={(e) => iniciar(e, String(i), todos[i].t)} onClick={() => { if (!fueArrastre()) setSel(sel === i ? null : i) }}
              className={`${chip} ${sel === i ? 'border-mariano bg-cielo' : 'border-slate-200 bg-white hover:border-mariano'}`}>{todos[i].t}</button>
          ))}
        </div>
      )}
      <div className={`grid gap-2 ${grupos.length > 2 ? 'sm:grid-cols-3' : 'grid-cols-2'}`}>
        {grupos.map((g, gi) => (
          <button key={gi} type="button" data-soltar={gi} onClick={() => sel !== null && soltar(sel, gi)}
            className={`min-h-[6rem] rounded-xl border-2 border-dashed p-3 text-left align-top transition ${sel !== null ? 'border-mariano bg-cielo/50' : 'border-slate-300 bg-slate-50'}`}>
            <span className="mb-2 block text-sm font-semibold text-tinta">{g.nombre}</span>
            <span className="flex flex-wrap gap-1">
              {Object.keys(ubicados).filter((i) => ubicados[i] === gi).map((i) => (
                <span key={i} className="rounded-md bg-green-100 px-2 py-0.5 text-xs font-medium text-green-900">{todos[i].t}</span>
              ))}
            </span>
          </button>
        ))}
      </div>
      {listo ? <Final correctas={todos.length - fallos.size} total={todos.length} otraVez={otraVez} /> : <Aviso aviso={aviso} />}
      {capa}
    </Marco>
  )
}

// ---------- 🧠 Memorama ----------

export function Memorama({ b }) {
  const pares = b.pares.filter((p) => p.a && p.b)
  const [ronda, setRonda] = useState(0)
  const cartas = useMemo(() => mezclar(pares.flatMap((p, i) => [{ k: `${i}a`, par: i, t: p.a }, { k: `${i}b`, par: i, t: p.b }])), [b.pares, ronda]) // eslint-disable-line react-hooks/exhaustive-deps
  const [abiertas, setAbiertas] = useState([])
  const [halladas, setHalladas] = useState(new Set())
  const [jugadas, setJugadas] = useState(0)
  const bloqueado = abiertas.length === 2

  function tocar(c) {
    if (bloqueado || halladas.has(c.par) || abiertas.includes(c.k)) return
    const n = [...abiertas, c.k]
    setAbiertas(n)
    if (n.length === 2) {
      setJugadas((j) => j + 1)
      const [x, y] = n.map((k) => cartas.find((z) => z.k === k))
      if (x.par === y.par) { setHalladas((h) => new Set(h).add(x.par)); setAbiertas([]) }
      else setTimeout(() => setAbiertas([]), 1000)
    }
  }
  const listo = halladas.size === pares.length
  return (
    <Marco marca="🧠" etiqueta="Memorama" titulo={b.titulo} ayuda="Destapa dos cartas. Si son pareja se quedan a la vista; si no, se vuelven a tapar." color="border-oro/40">
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {cartas.map((c) => {
          const visible = abiertas.includes(c.k) || halladas.has(c.par)
          return (
            <button key={c.k} type="button" onClick={() => tocar(c)} aria-label={visible ? c.t : 'Carta tapada'}
              className={`grid h-24 place-items-center rounded-xl p-2 text-center text-[13px] font-medium leading-snug transition sm:h-28 ${
                halladas.has(c.par) ? 'border-2 border-green-600 bg-green-50 text-green-900'
                : visible ? 'border-2 border-oro bg-white text-tinta' : 'bg-tinta text-2xl text-oro hover:bg-mariano'}`}>
              {visible ? c.t : <span aria-hidden="true">✦</span>}
            </button>
          )
        })}
      </div>
      <p className="mt-3 text-sm text-slate-600" role="status">
        {listo ? `¡Completaste el memorama en ${jugadas} jugadas!` : `Parejas: ${halladas.size} de ${pares.length} · Jugadas: ${jugadas}`}
        {listo && <button className="ml-3 text-xs underline" onClick={() => { setHalladas(new Set()); setAbiertas([]); setJugadas(0); setRonda((r) => r + 1) }}>Jugar otra vez</button>}
      </p>
    </Marco>
  )
}

// ---------- 📍 Diagrama etiquetado ----------

export function Diagrama({ b, alResultado }) {
  const reportar = useResultado(alResultado)
  const puntos = b.puntos.filter((p) => p.nombre)
  const [ronda, setRonda] = useState(0)
  const banco = useMemo(() => mezclar(puntos.map((p) => p.nombre)), [b.puntos, ronda]) // eslint-disable-line react-hooks/exhaustive-deps
  const [puestos, setPuestos] = useState({}) // id punto -> nombre
  const [sel, setSel] = useState(null) // { tipo: 'nombre'|'punto', v }
  const [revisado, setRevisado] = useState(false)
  const usados = Object.values(puestos)
  const libres = banco.filter((n) => !usados.includes(n))

  function poner(pid, nombre) {
    setSel(null)
    if (revisado) return
    setPuestos((p) => { const n = { ...p }; for (const k of Object.keys(n)) if (n[k] === nombre && k !== pid) delete n[k]; n[pid] = nombre; return n })
  }
  const { iniciar, fueArrastre, capa } = useArrastre((nombre, pid) => poner(pid, nombre))
  function tocarPunto(pid) {
    if (revisado) return
    if (sel?.tipo === 'nombre') poner(pid, sel.v)
    else if (puestos[pid]) setPuestos((p) => { const n = { ...p }; delete n[pid]; return n })
    else setSel(sel?.v === pid ? null : { tipo: 'punto', v: pid })
  }
  function tocarNombre(nombre) {
    if (fueArrastre()) return
    if (sel?.tipo === 'punto') poner(sel.v, nombre)
    else setSel(sel?.v === nombre ? null : { tipo: 'nombre', v: nombre })
  }
  const bien = puntos.filter((p) => puestos[p.id] === p.nombre).length
  function revisar() { setRevisado(true); reportar(bien / puntos.length) }

  return (
    <Marco marca="📍" etiqueta="Diagrama etiquetado" titulo={b.titulo} ayuda="Toca un nombre y luego el número donde va (o arrástralo). Toca un número ocupado para quitarle el nombre.">
      <div className="relative mx-auto w-full max-w-xl select-none">
        <img src={b.url} alt={b.titulo || 'Diagrama'} className="w-full rounded-lg" draggable={false} />
        {puntos.map((p, k) => {
          const puesto = puestos[p.id]
          const color = revisado ? (puesto === p.nombre ? 'bg-green-600' : 'bg-alerta') : puesto ? 'bg-mariano' : sel?.v === p.id ? 'bg-oro' : 'bg-tinta'
          return (
            <button key={p.id} type="button" data-soltar={p.id} onClick={() => tocarPunto(p.id)}
              aria-label={`Punto ${k + 1}${puesto ? `: ${puesto}` : ''}`} style={{ left: `${p.x}%`, top: `${p.y}%` }}
              className={`absolute grid h-8 w-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-white text-sm font-bold text-white shadow-md ${color}`}>
              {k + 1}
            </button>
          )
        })}
      </div>
      <ol className="mt-3 grid gap-1 text-sm sm:grid-cols-2">
        {puntos.map((p, k) => (
          <li key={p.id} className="flex items-center gap-2">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-tinta text-xs font-bold text-white">{k + 1}</span>
            <span className={puestos[p.id] ? 'font-medium' : 'text-slate-400'}>{puestos[p.id] ?? '…'}</span>
            {revisado && puestos[p.id] !== p.nombre && <span className="text-xs text-green-800">→ {p.nombre}</span>}
          </li>
        ))}
      </ol>
      {!revisado && (
        <div className="mt-3 flex flex-wrap gap-2">
          {libres.map((n) => (
            <button key={n} type="button" aria-pressed={sel?.v === n}
              onPointerDown={(e) => iniciar(e, n, n)} onClick={() => tocarNombre(n)}
              className={`${chip} py-1.5 text-sm ${sel?.v === n ? 'border-mariano bg-cielo' : 'border-slate-200 bg-white hover:border-mariano'}`}>{n}</button>
          ))}
        </div>
      )}
      {!revisado ? (
        <button className="btn mt-3" disabled={Object.keys(puestos).length < puntos.length} onClick={revisar}>Comprobar</button>
      ) : (
        <Final correctas={bien} total={puntos.length} otraVez={() => { setPuestos({}); setRevisado(false); setRonda((r) => r + 1) }} />
      )}
      {capa}
    </Marco>
  )
}

// ---------- ✏️ Completar los espacios ----------

export function Completar({ b, alResultado }) {
  const reportar = useResultado(alResultado)
  const partes = useMemo(() => partirHuecos(b.texto), [b.texto])
  const huecos = partes.filter((x) => x.aceptadas)
  const banco = useMemo(() => mezclar([
    ...huecos.map((h) => h.aceptadas[0]),
    ...String(b.distractores ?? '').split(',').map((x) => x.trim()).filter(Boolean),
  ]), [b.texto, b.distractores]) // eslint-disable-line react-hooks/exhaustive-deps
  const conBanco = b.modo !== 'escribir'
  const [resp, setResp] = useState({})
  const [activo, setActivo] = useState(0)
  const [revisado, setRevisado] = useState(false)
  const correcto = (h) => h.aceptadas.some((a) => normalizar(a) === normalizar(resp[h.hueco]))
  const bien = huecos.filter(correcto).length
  const usadas = Object.values(resp)
  const libres = banco.filter((p, i) => banco.slice(0, i + 1).filter((x) => x === p).length > usadas.filter((u) => u === p).length)

  function poner(k, palabra) {
    if (revisado) return
    const n = { ...resp, [k]: palabra }
    setResp(n)
    const sig = huecos.find((h) => !n[h.hueco])
    setActivo(sig ? sig.hueco : null)
  }
  const { iniciar, fueArrastre, capa } = useArrastre((palabra, k) => poner(Number(k), palabra))

  return (
    <Marco marca="✏️" etiqueta="Completar los espacios" titulo={b.titulo}
      ayuda={conBanco ? 'Toca un espacio y luego la palabra que va ahí (o arrástrala). Toca un espacio lleno para vaciarlo.' : 'Escribe la palabra que falta en cada espacio.'}>
      <p className="whitespace-pre-wrap text-[16px] leading-[2.4]">
        {partes.map((x, i) => {
          if (!x.aceptadas) return <span key={i}>{x.texto}</span>
          const k = x.hueco
          const estado = revisado ? (correcto(x) ? 'border-green-600 bg-green-50 text-green-900' : 'border-alerta bg-red-50 text-red-900') : ''
          if (!conBanco) {
            return (
              <input key={i} aria-label={`Espacio ${k + 1}`} disabled={revisado} value={resp[k] ?? ''}
                onChange={(e) => setResp({ ...resp, [k]: e.target.value })}
                style={{ width: `${Math.max(5, x.aceptadas[0].length + 2)}ch` }}
                className={`mx-0.5 rounded-md border-b-2 border-mariano bg-cielo/50 px-1 text-center font-medium focus:outline-none focus:ring-2 focus:ring-oro ${estado}`} />
            )
          }
          return (
            <button key={i} type="button" data-soltar={k} aria-label={`Espacio ${k + 1}${resp[k] ? `: ${resp[k]}` : ''}`}
              onClick={() => { if (revisado) return; if (resp[k]) { const n = { ...resp }; delete n[k]; setResp(n); setActivo(k) } else setActivo(k) }}
              className={`mx-0.5 inline-block min-w-[5rem] rounded-md border-2 px-2 leading-8 font-medium ${estado || (resp[k] ? 'border-mariano bg-cielo' : activo === k ? 'border-oro bg-amber-50' : 'border-dashed border-slate-300 bg-slate-50')}`}>
              {resp[k] ?? ' '}
            </button>
          )
        })}
      </p>
      {revisado && bien < huecos.length && (
        <p className="mt-2 text-sm text-slate-600">Respuestas: {huecos.map((h) => h.aceptadas[0]).join(' · ')}</p>
      )}
      {conBanco && !revisado && (
        <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
          {libres.map((p, i) => (
            <button key={`${p}-${i}`} type="button" onPointerDown={(e) => iniciar(e, p, p)}
              onClick={() => { if (fueArrastre()) return; const k = activo ?? huecos.find((h) => !resp[h.hueco])?.hueco; if (k !== undefined) poner(k, p) }}
              className={`${chip} py-1.5 text-sm border-slate-200 bg-white hover:border-mariano`}>{p}</button>
          ))}
        </div>
      )}
      {!revisado ? (
        <button className="btn mt-3" disabled={huecos.some((h) => !String(resp[h.hueco] ?? '').trim())}
          onClick={() => { setRevisado(true); reportar(bien / huecos.length) }}>Comprobar</button>
      ) : (
        <Final correctas={bien} total={huecos.length} otraVez={() => { setResp({}); setRevisado(false); setActivo(0) }} />
      )}
      {capa}
    </Marco>
  )
}

// ---------- 🔀 Ordenar letras o palabras ----------

function piezas(respuesta, modo) {
  return modo === 'palabras' ? respuesta.trim().split(/\s+/) : [...respuesta.replace(/\s+/g, '').toUpperCase()]
}

function OrdenarItem({ item, modo, n, alTerminar }) {
  const correctas = useMemo(() => piezas(item.respuesta, modo), [item.respuesta, modo])
  const [fichas] = useState(() => desordenar(correctas.map((t, i) => ({ t, i })), (x, y) => x.t === y.t).map((x, k) => ({ ...x, k })))
  const [puestas, setPuestas] = useState([])
  const [estado, setEstado] = useState(null) // null | 'bien' | 'mal'
  const [fallo, setFallo] = useState(false)
  const [terminado, setTerminado] = useState(false)
  const sep = modo === 'palabras' ? ' ' : ''
  const libres = fichas.filter((f) => !puestas.includes(f.k))

  function comprobar() {
    const ok = puestas.map((k) => fichas[k].t).join(sep) === correctas.join(sep)
    setEstado(ok ? 'bien' : 'mal')
    if (!ok) setFallo(true)
    if (ok && !terminado) { setTerminado(true); alTerminar(!fallo) }
  }
  function rendirse() { setPuestas(correctas.map((t, i) => fichas.find((f) => f.i === i).k)); setEstado('bien'); if (!terminado) { setTerminado(true); alTerminar(false) } }

  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <p className="mb-2 text-sm text-slate-600"><span className="font-semibold text-tinta">{n}.</span> {item.pista || (modo === 'palabras' ? 'Ordena las palabras para formar la oración.' : 'Ordena las letras para formar la palabra.')}</p>
      <div className={`mb-2 flex min-h-[3rem] flex-wrap items-center gap-1.5 rounded-lg border-2 p-2 ${estado === 'bien' ? 'border-green-600 bg-green-50' : estado === 'mal' ? 'border-alerta bg-red-50' : 'border-dashed border-slate-300 bg-slate-50'}`}>
        {puestas.map((k) => (
          <button key={k} type="button" disabled={estado === 'bien'} onClick={() => { setPuestas(puestas.filter((x) => x !== k)); setEstado(null) }}
            className={`rounded-md bg-tinta px-2.5 py-1.5 font-semibold text-white ${modo === 'letras' ? 'min-w-[2.25rem] text-lg' : 'text-[15px]'}`}>{fichas[k].t}</button>
        ))}
        {!puestas.length && <span className="text-xs text-slate-400">Toca las fichas en orden</span>}
      </div>
      {estado !== 'bien' && (
        <div className="flex flex-wrap gap-1.5">
          {libres.map((f) => (
            <button key={f.k} type="button" onClick={() => { setPuestas([...puestas, f.k]); setEstado(null) }}
              className={`rounded-md border-2 border-mariano/40 bg-white px-2.5 py-1.5 font-semibold text-tinta hover:bg-cielo ${modo === 'letras' ? 'min-w-[2.25rem] text-lg' : 'text-[15px]'}`}>{f.t}</button>
          ))}
        </div>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-3 text-sm" role="status">
        {estado !== 'bien' && <button className="btn-sec py-1" disabled={libres.length > 0} onClick={comprobar}>Comprobar</button>}
        {estado === 'bien' && <span className="font-semibold text-green-800">¡Correcto!</span>}
        {estado === 'mal' && <><span className="text-red-800">Aún no. Toca las fichas de arriba para quitarlas.</span><button className="text-xs underline" onClick={rendirse}>Ver la respuesta</button></>}
      </div>
    </div>
  )
}

export function Ordenar({ b, alResultado }) {
  const reportar = useResultado(alResultado)
  const items = b.items.filter((x) => x.respuesta?.trim())
  const res = useRef({})
  const [hechos, setHechos] = useState(0)
  function terminar(k, ok) {
    res.current[k] = ok
    const n = Object.keys(res.current).length
    setHechos(n)
    if (n === items.length) reportar(Object.values(res.current).filter(Boolean).length / items.length)
  }
  return (
    <Marco marca="🔀" etiqueta={b.modo === 'palabras' ? 'Ordenar palabras' : 'Ordenar letras'} titulo={b.titulo}>
      <div className="space-y-3">
        {items.map((x, k) => <OrdenarItem key={k} item={x} modo={b.modo} n={k + 1} alTerminar={(ok) => terminar(k, ok)} />)}
      </div>
      {hechos === items.length && items.length > 1 && (
        <Final correctas={Object.values(res.current).filter(Boolean).length} total={items.length} />
      )}
    </Marco>
  )
}

// ---------- ⏳ Línea de tiempo y 🔺 Jerarquía ----------

export function Secuencia({ b, alResultado }) {
  const reportar = useResultado(alResultado)
  const jerarquia = b.tipo === 'jerarquia'
  const items = useMemo(() => b.items.filter((x) => x.texto).map((x, i) => ({ ...x, i })), [b.items])
  const [ronda, setRonda] = useState(0)
  const [orden, setOrden] = useState(() => desordenar(items, (x, y) => x.i === y.i))
  useEffect(() => { setOrden(desordenar(items, (x, y) => x.i === y.i)) }, [items, ronda])
  const [revisado, setRevisado] = useState(false)
  const bien = orden.filter((x, k) => x.i === k).length

  const mover = (de, a) => { if (revisado || a < 0 || a >= orden.length || de === a) return; const l = [...orden]; const [x] = l.splice(de, 1); l.splice(a, 0, x); setOrden(l) }
  const { iniciar, capa } = useArrastre((de, a) => mover(Number(de), Number(a)))

  return (
    <Marco marca={jerarquia ? '🔺' : '⏳'} etiqueta={jerarquia ? 'Jerarquía' : 'Línea de tiempo'} titulo={b.titulo}
      ayuda={jerarquia ? 'Ordena de lo más alto (arriba) a lo más bajo. Arrastra desde ⠿ o usa las flechas.' : 'Ordena del primero (arriba) al último. Arrastra desde ⠿ o usa las flechas.'}>
      <ol className={jerarquia ? 'space-y-1.5' : 'relative space-y-2 border-l-2 border-cielo pl-5'}>
        {orden.map((x, k) => {
          const estado = revisado ? (x.i === k ? 'border-green-600 bg-green-50' : 'border-alerta bg-red-50') : 'border-slate-200 bg-white'
          const ancho = jerarquia ? `${55 + (45 * k) / Math.max(1, orden.length - 1)}%` : undefined
          return (
            <li key={x.i} data-soltar={k} className="relative" style={ancho ? { width: ancho, marginInline: 'auto' } : undefined}>
              {!jerarquia && <span className={`absolute -left-[1.6rem] top-3.5 h-3 w-3 rounded-full border-2 border-white ${revisado && x.i === k ? 'bg-green-600' : 'bg-mariano'}`} />}
              <div className={`flex items-center gap-2 rounded-lg border-2 px-2 py-2 ${estado} ${jerarquia ? 'justify-center text-center' : ''}`}>
                {!revisado && <span onPointerDown={(e) => iniciar(e, String(k), x.texto)} className="cursor-grab touch-none px-1 text-lg text-slate-400" aria-hidden="true">⠿</span>}
                <span className="min-w-0 flex-1 text-[15px]">
                  {revisado && x.fecha && <span className="mr-2 rounded bg-tinta px-1.5 py-0.5 text-xs font-semibold text-white">{x.fecha}</span>}
                  {x.texto}
                </span>
                {!revisado && (
                  <span className="flex shrink-0 flex-col">
                    <button className="px-1 text-xs leading-4 text-mariano disabled:text-slate-300" disabled={k === 0} onClick={() => mover(k, k - 1)} aria-label={`Subir «${x.texto}»`}>▲</button>
                    <button className="px-1 text-xs leading-4 text-mariano disabled:text-slate-300" disabled={k === orden.length - 1} onClick={() => mover(k, k + 1)} aria-label={`Bajar «${x.texto}»`}>▼</button>
                  </span>
                )}
              </div>
            </li>
          )
        })}
      </ol>
      {!revisado ? (
        <button className="btn mt-3" onClick={() => { setRevisado(true); reportar(bien / orden.length) }}>Comprobar</button>
      ) : (
        <Final correctas={bien} total={orden.length} otraVez={() => { setRevisado(false); setRonda((r) => r + 1) }}>
          {bien < orden.length && (
            <ol className="mt-2 list-decimal space-y-0.5 pl-5">
              {items.map((x) => <li key={x.i}>{x.fecha && <strong>{x.fecha}: </strong>}{x.texto}</li>)}
            </ol>
          )}
        </Final>
      )}
      {capa}
    </Marco>
  )
}

// ---------- ⏱️ Trivia con tiempo ----------

export function Trivia({ b, alResultado }) {
  const reportar = useResultado(alResultado)
  const preguntas = useMemo(() => b.preguntas.filter((q) => q.enunciado).map((q) => ({ ...q, ops: mezclar(q.opciones.filter(Boolean)), buena: q.opciones[q.correcta] })), [b.preguntas])
  const seg = Math.max(5, Number(b.segundos) || 20)
  const [i, setI] = useState(-1) // -1 inicio
  const [resto, setResto] = useState(seg)
  const [elegida, setElegida] = useState(null) // texto | '' (tiempo agotado)
  const [puntos, setPuntos] = useState(0)
  const [correctas, setCorrectas] = useState(0)
  const inicio = useRef(0)

  useEffect(() => {
    if (i < 0 || i >= preguntas.length || elegida !== null) return
    inicio.current = Date.now()
    const t = setInterval(() => {
      const r = Math.max(0, seg - (Date.now() - inicio.current) / 1000)
      setResto(r)
      if (r <= 0) { clearInterval(t); setElegida('') }
    }, 100)
    return () => clearInterval(t)
  }, [i, elegida, seg, preguntas.length])

  function elegir(o) {
    if (elegida !== null) return
    setElegida(o)
    if (o === preguntas[i].buena) {
      setCorrectas((c) => c + 1)
      setPuntos((p) => p + 50 + Math.round((50 * resto) / seg))
    }
  }
  function siguiente() {
    if (i + 1 >= preguntas.length) { setI(preguntas.length); reportar(correctas / preguntas.length); return }
    setI(i + 1); setElegida(null); setResto(seg)
  }
  const empezar = () => { setI(0); setElegida(null); setResto(seg); setPuntos(0); setCorrectas(0) }

  if (i < 0) {
    return (
      <Marco marca="⏱️" etiqueta="Trivia con tiempo" titulo={b.titulo || 'Trivia'}>
        <p className="mb-3 text-sm text-slate-600">{preguntas.length} preguntas · {seg} segundos cada una. Cada acierto da entre 50 y 100 puntos: entre más rápido, más puntos.</p>
        <button className="btn" onClick={empezar}>¡Empezar!</button>
      </Marco>
    )
  }
  if (i >= preguntas.length) {
    return (
      <Marco marca="⏱️" etiqueta="Trivia con tiempo" titulo={b.titulo || 'Trivia'}>
        <p className="text-center font-serif text-4xl font-semibold text-mariano">{puntos} <span className="text-base font-sans text-slate-500">puntos</span></p>
        <Final correctas={correctas} total={preguntas.length} otraVez={empezar} />
      </Marco>
    )
  }
  const q = preguntas[i]
  return (
    <Marco marca="⏱️" etiqueta={`Trivia · pregunta ${i + 1} de ${preguntas.length}`} titulo={null}>
      <div className="mb-3 flex items-center gap-3">
        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuemin={0} aria-valuemax={seg} aria-valuenow={Math.ceil(resto)} aria-label="Tiempo restante">
          <div className={`h-full transition-[width] duration-100 ${resto < seg / 4 ? 'bg-alerta' : 'bg-oro'}`} style={{ width: `${(resto / seg) * 100}%` }} />
        </div>
        <span className="w-10 text-right font-semibold tabular-nums">{Math.ceil(resto)} s</span>
        <span className="rounded-full bg-cielo px-2 py-0.5 text-sm font-semibold text-mariano tabular-nums">{puntos}</span>
      </div>
      <p className="mb-3 text-lg font-medium">{q.enunciado}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {q.ops.map((o) => {
          const color = elegida === null ? 'border-slate-200 bg-white hover:border-mariano hover:bg-cielo'
            : o === q.buena ? 'border-green-600 bg-green-50 text-green-900' : o === elegida ? 'border-alerta bg-red-50 text-red-900' : 'border-slate-200 opacity-60'
          return <button key={o} type="button" disabled={elegida !== null} onClick={() => elegir(o)} className={`rounded-lg border-2 px-4 py-3 text-left font-medium ${color}`}>{o}</button>
        })}
      </div>
      {elegida !== null && (
        <div className="mt-3 flex flex-wrap items-center gap-3" role="status">
          <span className={`text-sm font-semibold ${elegida === q.buena ? 'text-green-800' : 'text-amber-800'}`}>
            {elegida === q.buena ? '¡Correcto!' : elegida === '' ? `Se acabó el tiempo. Era: ${q.buena}` : `Era: ${q.buena}`}
          </span>
          <button className="btn ml-auto py-1.5" onClick={siguiente}>{i + 1 < preguntas.length ? 'Siguiente' : 'Ver resultado'}</button>
        </div>
      )}
    </Marco>
  )
}

// ---------- 🎡 Ruleta ----------

const COLORES_RULETA = ['#2F55A4', '#17264D', '#B8892B', '#4A6FBF', '#8A6620', '#243A70']

export function Ruleta({ b }) {
  const todos = b.items.filter((x) => String(x).trim())
  const [salidos, setSalidos] = useState([]) // índices que ya salieron (con «quitar»)
  const [giro, setGiro] = useState(0)
  const [girando, setGirando] = useState(false)
  const [salio, setSalio] = useState(null) // índice en «todos»
  // El que acaba de salir se queda en la ruleta hasta el siguiente giro, para que la flecha lo señale
  const visibles = (fuera) => todos.map((t, i) => i).filter((i) => !b.quitar || !fuera.includes(i))
  const lista = visibles(salidos.filter((i) => i !== salio))
  const n = lista.length
  const seg = 360 / Math.max(1, n)

  function girar() {
    if (girando) return
    const fuera = b.quitar && salio !== null ? [...salidos, salio] : salidos
    const quedan = visibles(fuera)
    if (!quedan.length) return
    const s = 360 / quedan.length
    const k = Math.floor(Math.random() * quedan.length)
    const destino = 360 - (k + 0.5) * s
    const base = giro - (((giro % 360) + 360) % 360)
    setSalidos(fuera); setSalio(null); setGirando(true)
    setGiro(base + 360 * 5 + destino + (Math.random() - 0.5) * s * 0.6)
    setTimeout(() => { setGirando(false); setSalio(quedan[k]) }, window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 50 : 3600)
  }
  const reiniciar = () => { setSalidos([]); setSalio(null) }
  const agotada = b.quitar && salio !== null && lista.length === 1
  const corto = (t) => (t.length > 22 ? `${t.slice(0, 20)}…` : t)
  const arco = (k) => {
    const a0 = ((k * seg - 90) * Math.PI) / 180, a1 = (((k + 1) * seg - 90) * Math.PI) / 180
    return `M50 50 L${50 + 48 * Math.cos(a0)} ${50 + 48 * Math.sin(a0)} A48 48 0 ${seg > 180 ? 1 : 0} 1 ${50 + 48 * Math.cos(a1)} ${50 + 48 * Math.sin(a1)} Z`
  }

  return (
    <Marco marca="🎡" etiqueta="Ruleta" titulo={b.titulo} color="border-oro/40">
      {n > 0 ? (
        <div className="flex flex-col items-center">
          <div className="relative w-full max-w-[18rem]">
            <span aria-hidden="true" className="absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-1 text-3xl leading-none text-alerta drop-shadow">▼</span>
            <div className="overflow-hidden rounded-full"><svg viewBox="0 0 100 100" className="w-full transition-transform duration-[3500ms] ease-out motion-reduce:transition-none" style={{ transform: `rotate(${giro}deg)` }} aria-hidden="true">
              {n === 1 ? <circle cx="50" cy="50" r="48" fill={COLORES_RULETA[0]} /> : lista.map((t, k) => <path key={t} d={arco(k)} fill={COLORES_RULETA[t % COLORES_RULETA.length]} stroke="#fff" strokeWidth="0.5" />)}
              {lista.map((t, k) => (
                <text key={t} x="50" y="50" fill="#fff" fontSize={n > 8 ? 3.2 : 4} fontWeight="600" textAnchor="end" dominantBaseline="middle"
                  transform={`rotate(${(k + 0.5) * seg - 90} 50 50) translate(44 0)`}>{corto(String(todos[t]))}</text>
              ))}
              <circle cx="50" cy="50" r="6" fill="#FBFBFD" stroke="#B8892B" strokeWidth="1.5" />
            </svg></div>
          </div>
          {!agotada && <button className="btn mt-4 px-8" onClick={girar} disabled={girando}>{girando ? 'Girando…' : 'Girar'}</button>}
        </div>
      ) : null}
      <div role="status" className="mt-4 text-center">
        {salio !== null && <p className="rounded-xl bg-tinta px-4 py-3 font-serif text-xl text-white">{todos[salio]}</p>}
      </div>
      {b.quitar && salidos.length + (salio !== null ? 1 : 0) > 0 && !girando && (
        <p className="mt-2 text-center text-xs text-slate-500">
          {agotada ? 'Ya salieron todas las opciones.' : `Quedan ${todos.length - salidos.length - (salio !== null ? 1 : 0)} de ${todos.length}`} · <button className="underline" onClick={reiniciar}>Empezar de nuevo</button>
        </p>
      )}
    </Marco>
  )
}

// ---------- 👾 Laberinto de respuestas ----------

const LETRAS = ['A', 'B', 'C', 'D']
const C = 7 // celdas por lado → 15 × 15 casillas

function crearLaberinto() {
  const T = C * 2 + 1
  const g = Array.from({ length: T }, () => Array(T).fill(1))
  const visto = Array.from({ length: C }, () => Array(C).fill(false))
  const pila = [[3, 3]]
  visto[3][3] = true; g[7][7] = 0
  while (pila.length) {
    const [x, y] = pila[pila.length - 1]
    const vec = mezclar([[1, 0], [-1, 0], [0, 1], [0, -1]]).filter(([dx, dy]) => visto[x + dx]?.[y + dy] === false)
    if (!vec.length) { pila.pop(); continue }
    const [dx, dy] = vec[0]
    visto[x + dx][y + dy] = true
    g[2 * y + 1 + dy][2 * x + 1 + dx] = 0
    g[2 * (y + dy) + 1][2 * (x + dx) + 1] = 0
    pila.push([x + dx, y + dy])
  }
  // Abre muros de más para que haya caminos alternos y se pueda esquivar
  for (let k = 0; k < 18; k++) {
    const r = 1 + Math.floor(Math.random() * (T - 2)), c = 1 + Math.floor(Math.random() * (T - 2))
    if (g[r][c] === 1 && ((r % 2 === 1 && c % 2 === 0) || (r % 2 === 0 && c % 2 === 1))) g[r][c] = 0
  }
  return g
}
const ESQUINAS = [[1, 1], [13, 1], [1, 13], [13, 13]] // [columna, fila]
const SALIDAS_ENEMIGOS = [[7, 1], [1, 7], [13, 7], [7, 13]]
const INICIO = [7, 7]

function pasoHacia(g, desde, hacia) {
  const T = g.length, clave = ([x, y]) => y * T + x
  const prev = new Map([[clave(desde), null]])
  const cola = [desde]
  while (cola.length) {
    const p = cola.shift()
    if (p[0] === hacia[0] && p[1] === hacia[1]) {
      let q = p
      while (prev.get(clave(q)) && clave(prev.get(clave(q))) !== clave(desde)) q = prev.get(clave(q))
      return q
    }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const n = [p[0] + dx, p[1] + dy]
      if (g[n[1]]?.[n[0]] === 0 && !prev.has(clave(n))) { prev.set(clave(n), p); cola.push(n) }
    }
  }
  return desde
}

export function Laberinto({ b, alResultado }) {
  const reportar = useResultado(alResultado)
  const preguntas = useMemo(() => b.preguntas.filter((q) => q.enunciado).map((q) => ({ ...q, ops: q.opciones.filter(Boolean).slice(0, 4), buena: q.opciones[q.correcta] })), [b.preguntas])
  const numEnemigos = Math.max(0, Math.min(3, Number(b.enemigos) || 0))
  const [i, setI] = useState(0)
  const [mapa, setMapa] = useState(crearLaberinto)
  const [ops, setOps] = useState(() => mezclar(preguntas[0]?.ops ?? []))
  const [yo, setYo] = useState(INICIO)
  const [enemigos, setEnemigos] = useState(() => SALIDAS_ENEMIGOS.slice(0, numEnemigos))
  const [aviso, setAviso] = useState(null)
  const fallo = useRef(false)
  const aciertos = useRef(0)
  const caja = useRef(null)
  const terminado = i >= preguntas.length
  const q = preguntas[i]

  function reiniciar(texto) {
    fallo.current = true
    setYo(INICIO); setEnemigos(SALIDAS_ENEMIGOS.slice(0, numEnemigos)); setAviso({ bien: false, texto })
  }
  function nuevaPregunta(k) {
    setI(k); setMapa(crearLaberinto()); setYo(INICIO); setEnemigos(SALIDAS_ENEMIGOS.slice(0, numEnemigos)); fallo.current = false
    if (k < preguntas.length) setOps(mezclar(preguntas[k].ops))
    else reportar(aciertos.current / preguntas.length)
  }

  function mover(dx, dy) {
    if (terminado) return
    const n = [yo[0] + dx, yo[1] + dy]
    if (mapa[n[1]]?.[n[0]] !== 0) return
    const letra = ESQUINAS.findIndex(([x, y], k) => k < ops.length && x === n[0] && y === n[1])
    if (letra >= 0) {
      if (ops[letra] === q.buena) {
        if (!fallo.current) aciertos.current++
        setAviso({ bien: true, texto: `¡Correcto! ${LETRAS[letra]}: ${q.buena}` })
        nuevaPregunta(i + 1)
      } else reiniciar(`«${ops[letra]}» no es la respuesta. Vuelves al inicio.`)
      return
    }
    // Los enemigos se mueven después de cada paso tuyo
    const nuevos = enemigos.map((e) => {
      if (Math.random() < 0.25) return e
      if (Math.random() < 0.7) return pasoHacia(mapa, e, n)
      const libres = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([a, c]) => [e[0] + a, e[1] + c]).filter(([x, y]) => mapa[y]?.[x] === 0)
      return libres.length ? libres[Math.floor(Math.random() * libres.length)] : e
    })
    if (enemigos.some((e) => e[0] === n[0] && e[1] === n[1]) || nuevos.some((e) => e[0] === n[0] && e[1] === n[1])) {
      reiniciar('¡Te atraparon! Vuelves al inicio.')
      return
    }
    setYo(n); setEnemigos(nuevos); setAviso(null)
  }
  function tecla(e) {
    const d = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[e.key]
    if (d) { e.preventDefault(); mover(...d) }
  }

  if (!preguntas.length) return null
  if (terminado) {
    return (
      <Marco marca="👾" etiqueta="Laberinto de respuestas" titulo={b.titulo}>
        <Final correctas={aciertos.current} total={preguntas.length} otraVez={() => { aciertos.current = 0; setAviso(null); nuevaPregunta(0) }} />
      </Marco>
    )
  }
  const T = mapa.length
  return (
    <Marco marca="👾" etiqueta={`Laberinto · pregunta ${i + 1} de ${preguntas.length}`} titulo={q.enunciado}
      ayuda={`Llega a la letra correcta${numEnemigos ? ' esquivando a los enemigos' : ''}. Muévete con las flechas del teclado o con los botones.`}>
      <ul className="mb-3 grid gap-1 text-sm sm:grid-cols-2">
        {ops.map((o, k) => <li key={k}><span className="mr-1 inline-grid h-6 w-6 place-items-center rounded-full bg-mariano text-xs font-bold text-white">{LETRAS[k]}</span>{o}</li>)}
      </ul>
      <div ref={caja} tabIndex={0} onKeyDown={tecla} aria-label="Laberinto. Usa las flechas para moverte."
        className="mx-auto grid w-full max-w-sm overflow-hidden rounded-lg bg-tinta p-1 focus:outline-none focus:ring-2 focus:ring-oro"
        style={{ gridTemplateColumns: `repeat(${T}, 1fr)` }}>
        {mapa.flatMap((fila, y) => fila.map((v, x) => {
          const letra = ESQUINAS.findIndex(([cx, cy], k) => k < ops.length && cx === x && cy === y)
          const enemigo = enemigos.some((e) => e[0] === x && e[1] === y)
          const soy = yo[0] === x && yo[1] === y
          return (
            <div key={`${x}-${y}`} className={`grid aspect-square place-items-center text-[min(3.2vw,0.85rem)] leading-none ${v ? 'bg-tinta' : 'bg-papel'}`}>
              {soy ? <span className="h-[80%] w-[80%] rounded-full bg-oro ring-2 ring-white" aria-label="Tú" />
                : enemigo ? <span aria-label="Enemigo">👾</span>
                : letra >= 0 ? <span className="grid h-[90%] w-[90%] place-items-center rounded-full bg-mariano font-bold text-white">{LETRAS[letra]}</span>
                : null}
            </div>
          )
        }))}
      </div>
      <div className="mx-auto mt-3 grid w-40 grid-cols-3 gap-1" aria-label="Controles">
        <span /><button className="btn-sec py-2" onClick={() => mover(0, -1)} aria-label="Arriba">▲</button><span />
        <button className="btn-sec py-2" onClick={() => mover(-1, 0)} aria-label="Izquierda">◀</button>
        <span className="grid place-items-center text-xs text-slate-400" aria-hidden="true">●</span>
        <button className="btn-sec py-2" onClick={() => mover(1, 0)} aria-label="Derecha">▶</button>
        <span /><button className="btn-sec py-2" onClick={() => mover(0, 1)} aria-label="Abajo">▼</button><span />
      </div>
      <Aviso aviso={aviso} />
    </Marco>
  )
}
