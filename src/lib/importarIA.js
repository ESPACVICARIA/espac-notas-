import { nuevoId, revisarBloque } from './bloques'
import { revisarPregunta, nuevoIdPregunta } from './repasosModelo'

// Instrucciones para pegar en cualquier asistente de IA (Claude, ChatGPT, Gemini…)
export const PROMPT_IA = `Actúa como diseñador de material formativo para la Escuela Parroquial de Catequistas (ESPAC) de la Diócesis de Engativá. Los estudiantes son catequistas adultos en formación, de distintos niveles escolares, y estudian desde el celular.

Al final de este mensaje, después de «MATERIAL DEL MÓDULO», te doy el contenido de un tema (un texto, apuntes o el material de una clase). Con él vas a preparar:
1. Una LECCIÓN INTERACTIVA para estudiar.
2. Un REPASO de preguntas para practicar.

CRITERIOS
- Sé fiel al contenido que te doy y a la doctrina de la Iglesia Católica. No inventes citas, números de párrafo del Catecismo ni referencias bíblicas: usa solo las que estén en el contenido o que sean exactas y conocidas.
- Lenguaje sencillo, cálido y claro. Frases cortas. Explica cada término técnico la primera vez que aparece.
- Organiza la lección en secciones con títulos. No pongas más de dos bloques de texto seguidos: intercala un bloque interactivo cada uno o dos bloques de texto.
- La lección debe tener entre 12 y 22 bloques e incluir, si el tema lo permite: un recuadro destacado al inicio con la idea central, al menos un grupo de tarjetas con los términos clave, al menos un bloque "acordeon" o "pasos", entre 2 y 4 preguntas rápidas a lo largo de la lección, y una reflexión personal al final, aplicada a la vida y al servicio del catequista.
- Incluye además entre 3 y 5 ACTIVIDADES de tipos distintos (unir, clasificar, completar, ordenar, linea, jerarquia, trivia, laberinto) donde encajen con el contenido: por ejemplo "linea" solo si hay hechos en orden histórico y "jerarquia" solo si hay un orden de importancia o de autoridad. Estas actividades y las preguntas rápidas dan la nota de la lección. Puedes cerrar con un "memorama" o una "ruleta" para repasar en grupo.
- El repaso debe tener entre 10 y 15 preguntas que cubran todo el tema, mezclando los cuatro tipos. Cada pregunta lleva una explicación breve de la respuesta correcta.
- No incluyas imágenes ni videos a menos que yo te dé el enlace exacto.

FORMATO DE RESPUESTA
Responde ÚNICAMENTE con un objeto JSON válido, sin texto antes ni después, con esta estructura:

{
  "leccion": {
    "titulo": "…",
    "resumen": "una frase que resuma el tema",
    "bloques": [ …bloques… ]
  },
  "repaso": {
    "titulo": "Repaso: …",
    "descripcion": "…",
    "preguntas": [ …preguntas… ]
  }
}

TIPOS DE BLOQUE PARA LA LECCIÓN (usa exactamente estos nombres de campo):
- Texto: {"tipo": "texto", "texto": "…"}
  Dentro del texto puedes usar: "# Título de sección", "## Subtítulo", "**negrita**", "*cursiva*", "- viñeta", "1. lista numerada", "> cita". Separa los párrafos con \\n\\n.
- Recuadro destacado: {"tipo": "destacado", "estilo": "idea" | "biblia" | "importante" | "oracion", "titulo": "…", "texto": "…"}
  Usa "biblia" solo para citas bíblicas, con la referencia en el título (por ejemplo "Lucas 24, 32").
- Tarjetas que giran: {"tipo": "tarjetas", "titulo": "…", "items": [{"frente": "término corto", "reverso": "significado en una o dos frases"}]}  (entre 3 y 8 tarjetas)
- Toca para descubrir: {"tipo": "acordeon", "titulo": "…", "items": [{"titulo": "…", "texto": "…"}]}
- Paso a paso: {"tipo": "pasos", "titulo": "…", "items": [{"titulo": "…", "texto": "…"}]}  (para procesos, etapas o relatos en orden)
- Pregunta rápida de opción múltiple: {"tipo": "pregunta", "modo": "opcion", "enunciado": "…", "opciones": ["…", "…", "…"], "correcta": 0, "explicacion": "…"}  ("correcta" es la posición de la opción correcta, empezando en 0)
- Pregunta rápida de verdadero o falso: {"tipo": "pregunta", "modo": "vf", "enunciado": "…", "correcta": true, "explicacion": "…"}
- Reflexión personal: {"tipo": "reflexion", "pregunta": "…"}
- Botón de enlace (solo si te doy el enlace): {"tipo": "boton", "texto": "…", "url": "https://…"}

ACTIVIDADES PARA LA LECCIÓN (dan nota, salvo memorama y ruleta):
- Unir columnas: {"tipo": "unir", "titulo": "Une cada … con …", "pares": [{"izq": "…", "der": "…"}]}  (de 3 a 8 parejas; los textos de "der" no se repiten)
- Clasificar en grupos: {"tipo": "clasificar", "titulo": "…", "grupos": [{"nombre": "…", "elementos": ["…", "…"]}]}  (de 2 a 4 grupos, de 2 a 5 elementos cada uno)
- Completar los espacios: {"tipo": "completar", "titulo": "…", "texto": "Dios es [[amor]] y nos llama a [[servir|servicio]].", "modo": "banco", "distractores": ["…", "…"]}  (entre [[ ]] va la palabra que falta; con | otras respuestas válidas; de 3 a 8 huecos; "modo" puede ser "banco" o "escribir")
- Ordenar letras o palabras: {"tipo": "ordenar", "titulo": "…", "modo": "letras" | "palabras", "items": [{"respuesta": "Eucaristía", "pista": "Acción de gracias"}]}  (de 2 a 5; en "palabras" la respuesta es una oración corta)
- Línea de tiempo: {"tipo": "linea", "titulo": "…", "items": [{"fecha": "…", "texto": "…"}]}  (de 4 a 8 hechos, escritos en el orden correcto)
- Jerarquía: {"tipo": "jerarquia", "titulo": "…", "items": [{"texto": "…"}]}  (de 3 a 7 niveles, de lo más alto a lo más bajo)
- Trivia con tiempo: {"tipo": "trivia", "titulo": "…", "segundos": 20, "preguntas": [{"enunciado": "…", "opciones": ["…", "…", "…"], "correcta": 0}]}  (de 4 a 8 preguntas)
- Laberinto de respuestas: {"tipo": "laberinto", "titulo": "…", "enemigos": 1, "preguntas": [{"enunciado": "…", "opciones": ["…", "…", "…"], "correcta": 0}]}  (de 2 a 4 preguntas, máximo 4 opciones cada una)
- Memorama: {"tipo": "memorama", "titulo": "…", "pares": [{"a": "término", "b": "significado corto"}]}  (de 4 a 8 parejas)
- Ruleta: {"tipo": "ruleta", "titulo": "…", "items": ["tema o pregunta para compartir", "…"]}  (de 4 a 10)

TIPOS DE PREGUNTA PARA EL REPASO:
- Opción múltiple: {"tipo": "opcion", "enunciado": "…", "opciones": ["…", "…", "…", "…"], "correcta": 0, "explicacion": "…"}
- Verdadero o falso: {"tipo": "vf", "enunciado": "…", "correcta": true, "explicacion": "…"}
- Completar: {"tipo": "completar", "enunciado": "La invocación del Espíritu Santo se llama ____.", "aceptadas": ["Epíclesis", "Epiclesis"], "explicacion": "…"}  (en "aceptadas" pon las formas válidas de escribir la respuesta)
- Relacionar: {"tipo": "relacionar", "enunciado": "Relaciona cada término con su significado.", "pares": [{"izq": "…", "der": "…"}], "explicacion": "…"}  (entre 3 y 6 parejas; los textos de la derecha no se pueden repetir)

MATERIAL DEL MÓDULO:
(pega aquí el texto del tema: tus apuntes, el resumen o el contenido de la clase)
`

// Saca el JSON de la respuesta de la IA, aunque venga dentro de ```json … ``` o con texto alrededor
export function extraerJSON(texto) {
  const limpio = String(texto ?? '').replace(/```(?:json)?/gi, '').trim()
  const inicio = limpio.search(/[[{]/)
  if (inicio < 0) throw new Error('No encontré el contenido. Copia la respuesta completa de la IA, desde la primera llave { hasta la última }.')
  const fin = Math.max(limpio.lastIndexOf('}'), limpio.lastIndexOf(']'))
  const fragmento = limpio.slice(inicio, fin + 1)
    .replace(/[“”]/g, '"')
    .replace(/,\s*([}\]])/g, '$1')
  try {
    return JSON.parse(fragmento)
  } catch {
    throw new Error('La respuesta de la IA está incompleta o tiene un error de formato. Pídele: «Revisa que el JSON sea válido y envíalo completo».')
  }
}

const txt = (v) => String(v ?? '').trim()
const items = (lista, campos) => (Array.isArray(lista) ? lista : [])
  .map((x) => Object.fromEntries(campos.map((c) => [c, txt(x?.[c])])))
  .filter((x) => campos.some((c) => x[c]))

function correctaOpcion(correcta, opciones) {
  if (typeof correcta === 'number') return correcta
  const n = Number(correcta)
  if (!Number.isNaN(n) && String(correcta).trim() !== '') return n
  const i = opciones.findIndex((o) => o.toLowerCase() === txt(correcta).toLowerCase())
  return i >= 0 ? i : 0
}
const correctaVF = (c) => (typeof c === 'boolean' ? c : /^(true|verdadero|v|si|sí)$/i.test(txt(c)))

function convertirBloque(b) {
  const tipo = txt(b?.tipo).toLowerCase()
  const id = nuevoId()
  switch (tipo) {
    case 'texto': return { id, tipo, texto: txt(b.texto) }
    case 'destacado': return { id, tipo, estilo: ['idea', 'biblia', 'importante', 'oracion'].includes(b.estilo) ? b.estilo : 'idea', titulo: txt(b.titulo), texto: txt(b.texto) }
    case 'tarjetas': return { id, tipo, titulo: txt(b.titulo), items: items(b.items, ['frente', 'reverso']) }
    case 'acordeon':
    case 'pasos': return { id, tipo, titulo: txt(b.titulo), items: items(b.items, ['titulo', 'texto']) }
    case 'pregunta': {
      const vf = txt(b.modo).toLowerCase() === 'vf' || (!Array.isArray(b.opciones) && typeof b.correcta === 'boolean')
      if (vf) return { id, tipo, modo: 'vf', enunciado: txt(b.enunciado), opciones: ['', '', ''], correcta: correctaVF(b.correcta), explicacion: txt(b.explicacion) }
      const opciones = (b.opciones ?? []).map(txt).filter(Boolean)
      return { id, tipo, modo: 'opcion', enunciado: txt(b.enunciado), opciones, correcta: correctaOpcion(b.correcta, opciones), explicacion: txt(b.explicacion) }
    }
    case 'reflexion': return { id, tipo, pregunta: txt(b.pregunta ?? b.texto) }
    case 'boton': return { id, tipo, texto: txt(b.texto), url: txt(b.url) }
    case 'imagen':
    case 'video': return { id, tipo, url: txt(b.url), pie: txt(b.pie) }
    case 'unir': return { id, tipo, titulo: txt(b.titulo), pares: items(b.pares, ['izq', 'der']) }
    case 'memorama': return { id, tipo, titulo: txt(b.titulo), pares: items(b.pares, ['a', 'b']).slice(0, 8) }
    case 'clasificar': return { id, tipo, titulo: txt(b.titulo), grupos: (Array.isArray(b.grupos) ? b.grupos : []).slice(0, 4)
      .map((g) => ({ nombre: txt(g?.nombre), elementos: (Array.isArray(g?.elementos) ? g.elementos : []).map(txt).filter(Boolean) })) }
    case 'completar': return { id, tipo, titulo: txt(b.titulo), texto: txt(b.texto), modo: txt(b.modo) === 'escribir' ? 'escribir' : 'banco',
      distractores: Array.isArray(b.distractores) ? b.distractores.map(txt).filter(Boolean).join(', ') : txt(b.distractores) }
    case 'ordenar': return { id, tipo, titulo: txt(b.titulo), modo: txt(b.modo) === 'palabras' ? 'palabras' : 'letras', items: items(b.items, ['respuesta', 'pista']) }
    case 'linea': return { id, tipo, titulo: txt(b.titulo), items: items(b.items, ['fecha', 'texto']) }
    case 'jerarquia': return { id, tipo, titulo: txt(b.titulo), items: (Array.isArray(b.items) ? b.items : []).map((x) => ({ texto: txt(x?.texto ?? x) })).filter((x) => x.texto) }
    case 'ruleta': return { id, tipo, titulo: txt(b.titulo), items: (Array.isArray(b.items) ? b.items : []).map((x) => txt(x?.texto ?? x)).filter(Boolean).slice(0, 12), quitar: !!b.quitar }
    case 'trivia':
    case 'laberinto': {
      const preguntas = (Array.isArray(b.preguntas) ? b.preguntas : []).map((q) => {
        const opciones = (q?.opciones ?? []).map(txt).filter(Boolean).slice(0, tipo === 'laberinto' ? 4 : 6)
        return { enunciado: txt(q?.enunciado), opciones, correcta: correctaOpcion(q?.correcta, opciones) }
      })
      return tipo === 'trivia'
        ? { id, tipo, titulo: txt(b.titulo), segundos: Math.min(120, Math.max(5, Number(b.segundos) || 20)), preguntas }
        : { id, tipo, titulo: txt(b.titulo), enemigos: Math.min(3, Math.max(0, Number(b.enemigos ?? 1) || 0)), preguntas }
    }
    default: return null
  }
}

// Convierte la lección generada por la IA en bloques de la plataforma
export function convertirLeccion(datos) {
  const l = datos?.leccion ?? (Array.isArray(datos?.bloques) ? datos : null)
  if (!l) throw new Error('El contenido no trae una lección. Revisa que la IA haya respondido con "leccion" y sus "bloques".')
  const avisos = []
  const bloques = []
  for (const [i, b] of (l.bloques ?? []).entries()) {
    const c = convertirBloque(b)
    if (!c) { avisos.push(`Se omitió el bloque ${i + 1}: tipo «${txt(b?.tipo) || 'sin tipo'}» no reconocido.`); continue }
    const problema = revisarBloque(c)
    if (problema) {
      if (['imagen', 'video', 'boton'].includes(c.tipo)) { avisos.push(`Se omitió un bloque de ${c.tipo}: ${problema}.`); continue }
      avisos.push(`Revisa el bloque ${bloques.length + 1} (${c.tipo}): ${problema}.`)
    }
    bloques.push(c)
  }
  if (!bloques.length) throw new Error('La lección no trae bloques que se puedan usar.')
  return { titulo: txt(l.titulo) || 'Lección sin título', resumen: txt(l.resumen), bloques, avisos }
}

// Convierte el repaso generado por la IA en preguntas de la plataforma
export function convertirRepaso(datos) {
  const r = datos?.repaso ?? (Array.isArray(datos?.preguntas) ? datos : Array.isArray(datos) ? { preguntas: datos } : null)
  if (!r) throw new Error('El contenido no trae un repaso. Revisa que la IA haya respondido con "repaso" y sus "preguntas".')
  const avisos = []
  const preguntas = []
  for (const [i, q] of (r.preguntas ?? []).entries()) {
    const tipo = txt(q?.tipo).toLowerCase()
    const base = { id: nuevoIdPregunta(), tipo, enunciado: txt(q?.enunciado), explicacion: txt(q?.explicacion) }
    let p = null
    if (tipo === 'opcion') {
      const opciones = (q.opciones ?? []).map(txt).filter(Boolean)
      p = { ...base, opciones, correcta: correctaOpcion(q.correcta, opciones) }
    } else if (tipo === 'vf') p = { ...base, correcta: correctaVF(q.correcta) }
    else if (tipo === 'completar') p = { ...base, aceptadas: (q.aceptadas ?? [q.respuesta]).map(txt).filter(Boolean) }
    else if (tipo === 'relacionar') p = { ...base, pares: items(q.pares, ['izq', 'der']) }
    if (!p) { avisos.push(`Se omitió la pregunta ${i + 1}: tipo «${tipo || 'sin tipo'}» no reconocido.`); continue }
    const problema = revisarPregunta(p)
    if (problema) { avisos.push(`Se omitió la pregunta ${i + 1}: ${problema}.`); continue }
    preguntas.push(p)
  }
  if (!preguntas.length) throw new Error('El repaso no trae preguntas que se puedan usar.')
  return { titulo: txt(r.titulo) || 'Repaso', descripcion: txt(r.descripcion), preguntas, avisos }
}

// Nombres que usa el asistente «Crear con ayuda de IA»
export const leerRespuestaIA = extraerJSON

export function leccionDesdeIA(datos) {
  const r = convertirLeccion(datos)
  return {
    titulo: r.titulo, resumen: r.resumen, bloques: r.bloques,
    omitidos: r.avisos.filter((a) => a.startsWith('Se omitió')).map((a) => a.replace(/^Se omitió /, '')),
    incompletos: r.avisos.filter((a) => a.startsWith('Revisa')).map((a) => a.replace(/^Revisa /, '')),
  }
}

// El repaso es opcional en la respuesta: si no viene, devuelve null
export function repasoDesdeIA(datos) {
  if (!datos?.repaso && !Array.isArray(datos?.preguntas) && !Array.isArray(datos)) return null
  try {
    const r = convertirRepaso(datos)
    return { titulo: r.titulo, descripcion: r.descripcion, preguntas: r.preguntas, descartadas: r.avisos.length }
  } catch {
    return { titulo: 'Repaso', descripcion: '', preguntas: [], descartadas: 0 }
  }
}
