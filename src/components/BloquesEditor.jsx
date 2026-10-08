import { useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { reducirImagen } from '../lib/fotos'
import { TIPOS_BLOQUE, ESTILOS_DESTACADO, bloqueNuevo, nombreTipo, revisarBloque } from '../lib/bloques'

const AYUDA_TEXTO = '# Título · ## Subtítulo · **negrita** · *cursiva* · - viñeta · 1. lista · > cita · [texto](https://enlace)'

function Campo({ etiqueta, children }) {
  return <label className="block text-sm"><span className="mb-1 block text-xs font-medium text-slate-600">{etiqueta}</span>{children}</label>
}

// Lista de elementos (tarjetas, acordeón, pasos)
function Elementos({ items, campos, cambiar, nombre }) {
  const set = (k, campo, v) => cambiar(items.map((x, j) => (j === k ? { ...x, [campo]: v } : x)))
  const mover = (k, p) => { const l = [...items]; const j = k + p; if (j < 0 || j >= l.length) return; [l[k], l[j]] = [l[j], l[k]]; cambiar(l) }
  return (
    <div className="space-y-2">
      {items.map((x, k) => (
        <div key={k} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="mb-2 flex items-center gap-2 text-xs text-slate-500">
            <span className="font-semibold">{nombre} {k + 1}</span>
            <span className="ml-auto" />
            <button className="px-1 text-mariano disabled:text-slate-300" disabled={k === 0} onClick={() => mover(k, -1)} aria-label="Subir">▲</button>
            <button className="px-1 text-mariano disabled:text-slate-300" disabled={k === items.length - 1} onClick={() => mover(k, 1)} aria-label="Bajar">▼</button>
            {items.length > 1 && <button className="text-alerta underline" onClick={() => cambiar(items.filter((_, j) => j !== k))}>quitar</button>}
          </div>
          <div className="grid gap-2 sm:grid-cols-[1fr_1.6fr]">
            {campos.map(([campo, etiqueta, largo]) => largo
              ? <textarea key={campo} rows={2} className="campo py-1 text-sm" placeholder={etiqueta} aria-label={etiqueta} value={x[campo] ?? ''} onChange={(e) => set(k, campo, e.target.value)} />
              : <input key={campo} className="campo py-1 text-sm" placeholder={etiqueta} aria-label={etiqueta} value={x[campo] ?? ''} onChange={(e) => set(k, campo, e.target.value)} />)}
          </div>
        </div>
      ))}
      {items.length < 12 && (
        <button className="text-sm font-semibold text-mariano underline" onClick={() => cambiar([...items, Object.fromEntries(campos.map(([c]) => [c, '']))])}>
          Agregar {nombre.toLowerCase()}
        </button>
      )}
    </div>
  )
}

function SubirImagen({ b, cambiar }) {
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
      cambiar({ ...b, url: supabase.storage.from('estudio').getPublicUrl(ruta).data.publicUrl })
    } catch (err) {
      setError(/bucket/i.test(err.message) ? 'Falta instalar la carpeta de imágenes (estudio_interactivo.sql).' : err.message)
    }
    setSubiendo(false)
  }
  return (
    <div className="space-y-2">
      {b.url && <img src={b.url} alt="" className="max-h-48 rounded-lg border border-slate-200" />}
      <div className="flex flex-wrap items-center gap-2">
        <input ref={entrada} type="file" accept="image/*" className="sr-only" onChange={elegir} />
        <button className="btn-sec py-1" disabled={subiendo} onClick={() => entrada.current?.click()}>{subiendo ? 'Subiendo…' : b.url ? 'Cambiar imagen' : 'Subir imagen'}</button>
        <span className="text-xs text-slate-500">o pega el enlace de una imagen:</span>
        <input className="campo min-w-[14rem] flex-1 py-1 text-sm" placeholder="https://…" value={b.url} onChange={(e) => cambiar({ ...b, url: e.target.value })} />
      </div>
      {error && <p className="text-xs text-alerta">{error}</p>}
      <Campo etiqueta="Descripción o pie de foto (opcional)">
        <input className="campo py-1" value={b.pie} onChange={(e) => cambiar({ ...b, pie: e.target.value })} />
      </Campo>
    </div>
  )
}

function EditorBloque({ b, cambiar }) {
  const set = (k, v) => cambiar({ ...b, [k]: v })
  switch (b.tipo) {
    case 'texto':
      return (
        <div>
          <textarea rows={6} className="campo font-mono text-[13px] leading-relaxed" aria-label="Texto" value={b.texto} onChange={(e) => set('texto', e.target.value)} />
          <p className="mt-1 text-xs text-slate-500">{AYUDA_TEXTO}</p>
        </div>
      )
    case 'destacado':
      return (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {Object.entries(ESTILOS_DESTACADO).map(([k, e]) => (
              <button key={k} onClick={() => set('estilo', k)} aria-pressed={b.estilo === k}
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${b.estilo === k ? 'border-mariano bg-cielo text-mariano' : 'border-slate-200'}`}>{e.marca} {e.nombre}</button>
            ))}
          </div>
          <input className="campo py-1" placeholder={`Título (por defecto: ${ESTILOS_DESTACADO[b.estilo]?.nombre})`} value={b.titulo} onChange={(e) => set('titulo', e.target.value)} />
          <textarea rows={3} className="campo" placeholder="Texto del recuadro" value={b.texto} onChange={(e) => set('texto', e.target.value)} />
        </div>
      )
    case 'imagen': return <SubirImagen b={b} cambiar={cambiar} />
    case 'video':
      return (
        <div className="space-y-2">
          <input className="campo" placeholder="https://www.youtube.com/watch?v=…" value={b.url} onChange={(e) => set('url', e.target.value)} />
          <input className="campo py-1" placeholder="Descripción (opcional)" value={b.pie} onChange={(e) => set('pie', e.target.value)} />
        </div>
      )
    case 'tarjetas':
      return (
        <div className="space-y-2">
          <input className="campo py-1" placeholder="Título del grupo de tarjetas (opcional)" value={b.titulo} onChange={(e) => set('titulo', e.target.value)} />
          <Elementos items={b.items} nombre="Tarjeta" cambiar={(v) => set('items', v)} campos={[['frente', 'Frente: palabra o pregunta'], ['reverso', 'Reverso: significado o respuesta', true]]} />
        </div>
      )
    case 'acordeon':
    case 'pasos':
      return (
        <div className="space-y-2">
          <input className="campo py-1" placeholder="Título del bloque (opcional)" value={b.titulo} onChange={(e) => set('titulo', e.target.value)} />
          <Elementos items={b.items} nombre={b.tipo === 'pasos' ? 'Paso' : 'Sección'} cambiar={(v) => set('items', v)}
            campos={[['titulo', b.tipo === 'pasos' ? 'Título del paso' : 'Título que se ve'], ['texto', b.tipo === 'pasos' ? 'Explicación' : 'Contenido que aparece al tocar', true]]} />
        </div>
      )
    case 'pregunta':
      return (
        <div className="space-y-2">
          <div className="flex gap-2 text-xs">
            {[['opcion', 'Opción múltiple'], ['vf', 'Verdadero o falso']].map(([k, t]) => (
              <button key={k} onClick={() => cambiar({ ...b, modo: k, correcta: k === 'vf' ? true : 0 })} aria-pressed={b.modo === k}
                className={`rounded-full border px-3 py-1 font-semibold ${b.modo === k ? 'border-mariano bg-cielo text-mariano' : 'border-slate-200'}`}>{t}</button>
            ))}
          </div>
          <textarea rows={2} className="campo" placeholder="Enunciado de la pregunta" value={b.enunciado} onChange={(e) => set('enunciado', e.target.value)} />
          {b.modo === 'vf' ? (
            <div className="flex gap-4 text-sm">
              {[[true, 'Verdadero'], [false, 'Falso']].map(([v, t]) => (
                <label key={t} className="flex items-center gap-2"><input type="radio" name={`vf-${b.id}`} checked={b.correcta === v} onChange={() => set('correcta', v)} /> Es {t}</label>
              ))}
            </div>
          ) : (
            <fieldset className="space-y-1">
              <legend className="mb-1 text-xs text-slate-500">Marca la opción correcta</legend>
              {b.opciones.map((o, k) => (
                <div key={k} className="flex items-center gap-2">
                  <input type="radio" name={`op-${b.id}`} checked={b.correcta === k} onChange={() => set('correcta', k)} aria-label={`Opción ${k + 1} correcta`} />
                  <input className={`campo py-1 text-sm ${b.correcta === k ? 'border-green-500' : ''}`} placeholder={`Opción ${k + 1}`} value={o}
                    onChange={(e) => set('opciones', b.opciones.map((x, j) => (j === k ? e.target.value : x)))} />
                  {b.opciones.length > 2 && <button className="text-xs text-slate-400 underline" onClick={() => cambiar({ ...b, opciones: b.opciones.filter((_, j) => j !== k), correcta: b.correcta === k ? 0 : b.correcta > k ? b.correcta - 1 : b.correcta })}>quitar</button>}
                </div>
              ))}
              {b.opciones.length < 6 && <button className="text-xs font-semibold text-mariano underline" onClick={() => set('opciones', [...b.opciones, ''])}>Agregar opción</button>}
            </fieldset>
          )}
          <textarea rows={2} className="campo text-sm" placeholder="Explicación que aparece al responder" value={b.explicacion} onChange={(e) => set('explicacion', e.target.value)} />
        </div>
      )
    case 'reflexion':
      return (
        <div>
          <textarea rows={2} className="campo" placeholder="Pregunta para que el estudiante reflexione" value={b.pregunta} onChange={(e) => set('pregunta', e.target.value)} />
          <p className="mt-1 text-xs text-slate-500">El estudiante escribe su respuesta y la guarda. Puedes leerlas en la pestaña «Reflexiones».</p>
        </div>
      )
    case 'boton':
      return (
        <div className="grid gap-2 sm:grid-cols-2">
          <input className="campo py-1" placeholder="Texto del botón (ej. Leer el documento completo)" value={b.texto} onChange={(e) => set('texto', e.target.value)} />
          <input className="campo py-1" placeholder="https://…" value={b.url} onChange={(e) => set('url', e.target.value)} />
        </div>
      )
    default: return null
  }
}

function Agregar({ alElegir, compacto }) {
  const [abierto, setAbierto] = useState(false)
  if (!abierto) {
    return (
      <div className={`flex justify-center ${compacto ? '' : 'py-2'}`}>
        <button className={`rounded-full border border-dashed border-mariano/50 px-4 text-sm font-semibold text-mariano hover:bg-cielo ${compacto ? 'py-0.5 text-xs' : 'py-2'}`}
          onClick={() => setAbierto(true)}>+ Agregar bloque{compacto ? ' aquí' : ''}</button>
      </div>
    )
  }
  return (
    <div className="rounded-xl border border-mariano/30 bg-cielo/40 p-3">
      <div className="mb-2 flex items-center justify-between text-sm font-semibold text-mariano">
        ¿Qué quieres agregar?
        <button className="text-xs font-normal text-slate-500 underline" onClick={() => setAbierto(false)}>Cancelar</button>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {TIPOS_BLOQUE.map((t) => (
          <button key={t.tipo} onClick={() => { alElegir(bloqueNuevo(t.tipo)); setAbierto(false) }}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-left hover:border-mariano">
            <span className="block text-sm font-semibold">{t.nombre}</span>
            <span className="block text-xs text-slate-500">{t.ayuda}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export default function BloquesEditor({ bloques, cambiar }) {
  const [plegados, setPlegados] = useState(new Set())
  const set = (i, b) => cambiar(bloques.map((x, j) => (j === i ? b : x)))
  const insertar = (i, b) => cambiar([...bloques.slice(0, i), b, ...bloques.slice(i)])
  const mover = (i, p) => { const l = [...bloques]; const j = i + p; if (j < 0 || j >= l.length) return; [l[i], l[j]] = [l[j], l[i]]; cambiar(l) }
  const duplicar = (i) => insertar(i + 1, { ...structuredClone(bloques[i]), id: bloqueNuevo('texto').id })
  const plegar = (id) => setPlegados((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })

  return (
    <div className="space-y-2">
      {!bloques.length && <p className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">La lección está vacía. Agrega el primer bloque.</p>}
      {bloques.map((b, i) => {
        const problema = revisarBloque(b)
        const plegado = plegados.has(b.id)
        return (
          <div key={b.id}>
            {i > 0 && <Agregar compacto alElegir={(nb) => insertar(i, nb)} />}
            <div className={`mt-2 rounded-xl border bg-white ${problema ? 'border-amber-300' : 'border-slate-200'}`}>
              <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-3 py-2">
                <button onClick={() => plegar(b.id)} className="text-xs text-slate-400" aria-label={plegado ? 'Desplegar' : 'Plegar'}>{plegado ? '▸' : '▾'}</button>
                <span className="text-xs font-semibold text-mariano">{i + 1}. {nombreTipo(b.tipo)}</span>
                {problema && <span className="text-xs text-amber-700">· {problema}</span>}
                <span className="ml-auto flex items-center gap-2 text-xs">
                  <button className="px-1 text-mariano disabled:text-slate-300" disabled={i === 0} onClick={() => mover(i, -1)} aria-label="Subir bloque">▲</button>
                  <button className="px-1 text-mariano disabled:text-slate-300" disabled={i === bloques.length - 1} onClick={() => mover(i, 1)} aria-label="Bajar bloque">▼</button>
                  <button className="text-slate-500 underline" onClick={() => duplicar(i)}>duplicar</button>
                  <button className="text-alerta underline" onClick={() => { if (confirm(`¿Quitar el bloque «${nombreTipo(b.tipo)}»?`)) cambiar(bloques.filter((_, j) => j !== i)) }}>quitar</button>
                </span>
              </div>
              {!plegado && <div className="p-3"><EditorBloque b={b} cambiar={(nb) => set(i, nb)} /></div>}
            </div>
          </div>
        )
      })}
      <Agregar alElegir={(nb) => cambiar([...bloques, nb])} />
    </div>
  )
}
