// Bloques con los que se arma una lección interactiva

let n = 0
export const nuevoId = () => `b${Date.now().toString(36)}${(++n).toString(36)}`

export const GRUPOS_BLOQUE = [
  ['contenido', 'Contenido'],
  ['actividad', 'Actividades con nota'],
  ['juego', 'Para jugar y repasar'],
]

export const TIPOS_BLOQUE = [
  { tipo: 'texto', grupo: 'contenido', nombre: 'Texto', ayuda: 'Párrafos, títulos y listas' },
  { tipo: 'destacado', grupo: 'contenido', nombre: 'Recuadro destacado', ayuda: 'Idea clave, cita bíblica u oración' },
  { tipo: 'imagen', grupo: 'contenido', nombre: 'Imagen', ayuda: 'Foto o gráfico con descripción' },
  { tipo: 'video', grupo: 'contenido', nombre: 'Video', ayuda: 'YouTube u otro enlace' },
  { tipo: 'tarjetas', grupo: 'contenido', nombre: 'Tarjetas que giran', ayuda: 'Término por delante, significado por detrás' },
  { tipo: 'acordeon', grupo: 'contenido', nombre: 'Toca para descubrir', ayuda: 'Secciones que se abren al tocarlas' },
  { tipo: 'pasos', grupo: 'contenido', nombre: 'Paso a paso', ayuda: 'Se revela un paso a la vez' },
  { tipo: 'reflexion', grupo: 'contenido', nombre: 'Reflexión personal', ayuda: 'El estudiante escribe y la guarda' },
  { tipo: 'boton', grupo: 'contenido', nombre: 'Botón de enlace', ayuda: 'Lleva a una página o documento' },
  { tipo: 'pregunta', grupo: 'actividad', marca: '❓', nombre: 'Pregunta rápida', ayuda: 'Opción múltiple o verdadero/falso, con explicación' },
  { tipo: 'unir', grupo: 'actividad', marca: '🔗', nombre: 'Unir columnas', ayuda: 'Toca un elemento de cada columna o arrastra uno sobre su pareja' },
  { tipo: 'clasificar', grupo: 'actividad', marca: '🗂️', nombre: 'Clasificar en grupos', ayuda: 'Lleva cada elemento a su caja; avisa si se equivoca' },
  { tipo: 'completar', grupo: 'actividad', marca: '✏️', nombre: 'Completar los espacios', ayuda: 'Dios es [[amor]]: con banco de palabras o escribiendo' },
  { tipo: 'ordenar', grupo: 'actividad', marca: '🔀', nombre: 'Ordenar letras o palabras', ayuda: 'Anagrama de una palabra o de una oración' },
  { tipo: 'linea', grupo: 'actividad', marca: '⏳', nombre: 'Línea de tiempo', ayuda: 'Ordena los hechos del primero al último' },
  { tipo: 'jerarquia', grupo: 'actividad', marca: '🔺', nombre: 'Jerarquía', ayuda: 'Ordena de lo más alto a lo más bajo' },
  { tipo: 'diagrama', grupo: 'actividad', marca: '📍', nombre: 'Diagrama etiquetado', ayuda: 'Sube una imagen y marca dónde va cada parte' },
  { tipo: 'trivia', grupo: 'actividad', marca: '⏱️', nombre: 'Trivia con tiempo', ayuda: 'De 50 a 100 puntos por pregunta según la rapidez' },
  { tipo: 'laberinto', grupo: 'actividad', marca: '👾', nombre: 'Laberinto de respuestas', ayuda: 'Llega a la letra correcta esquivando enemigos' },
  { tipo: 'memorama', grupo: 'juego', marca: '🧠', nombre: 'Memorama', ayuda: 'Encuentra las parejas; no da nota' },
  { tipo: 'ruleta', grupo: 'juego', marca: '🎡', nombre: 'Ruleta', ayuda: 'Gira y sale un tema o una pregunta; no da nota' },
]

// Bloques que dan nota (deben coincidir con tipos_calificables() en lecciones_nota.sql)
export const CALIFICABLES = new Set(TIPOS_BLOQUE.filter((t) => t.grupo === 'actividad').map((t) => t.tipo))
export const esCalificable = (b) => CALIFICABLES.has(b?.tipo)

// Nota de 0 a 5 truncada a un decimal; los bloques sin respuesta cuentan 0
export function notaLeccion(bloques, resultados) {
  const cal = bloques.filter(esCalificable)
  if (!cal.length) return null
  const suma = cal.reduce((s, b) => s + Math.max(0, Math.min(1, Number(resultados[b.id] ?? 0))), 0)
  return Math.trunc(Math.round((suma / cal.length) * 5 * 1000) / 100) / 10
}

// «Dios es [[amor]] y nos llama a [[servir|servicio]]» → partes de texto y huecos
export function partirHuecos(texto = '') {
  const partes = []
  const re = /\[\[([^\]]+)\]\]/g
  let ultimo = 0, m, k = 0
  while ((m = re.exec(texto))) {
    if (m.index > ultimo) partes.push({ texto: texto.slice(ultimo, m.index) })
    const aceptadas = m[1].split('|').map((x) => x.trim()).filter(Boolean)
    if (aceptadas.length) partes.push({ hueco: k++, aceptadas })
    ultimo = re.lastIndex
  }
  if (ultimo < texto.length) partes.push({ texto: texto.slice(ultimo) })
  return partes
}

// Para comparar respuestas escritas sin tildes, mayúsculas ni signos
export const normalizar = (t) => String(t ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9ñ]/g, '')

const preguntaJuego = () => ({ enunciado: '', opciones: ['', '', ''], correcta: 0 })

export const nombreTipo = (t) => TIPOS_BLOQUE.find((x) => x.tipo === t)?.nombre ?? t

export const ESTILOS_DESTACADO = {
  idea: { nombre: 'Idea clave', marca: '✦', clase: 'border-mariano bg-cielo text-tinta' },
  biblia: { nombre: 'Palabra de Dios', marca: '✝', clase: 'border-oro bg-amber-50 text-tinta' },
  importante: { nombre: 'Importante', marca: '!', clase: 'border-alerta bg-red-50 text-tinta' },
  oracion: { nombre: 'Oración', marca: '☩', clase: 'border-tinta bg-slate-50 text-tinta' },
}

export function bloqueNuevo(tipo) {
  const id = nuevoId()
  switch (tipo) {
    case 'texto': return { id, tipo, texto: '' }
    case 'destacado': return { id, tipo, estilo: 'idea', titulo: '', texto: '' }
    case 'imagen': return { id, tipo, url: '', pie: '' }
    case 'video': return { id, tipo, url: '', pie: '' }
    case 'tarjetas': return { id, tipo, titulo: '', items: [{ frente: '', reverso: '' }, { frente: '', reverso: '' }] }
    case 'acordeon': return { id, tipo, titulo: '', items: [{ titulo: '', texto: '' }, { titulo: '', texto: '' }] }
    case 'pasos': return { id, tipo, titulo: '', items: [{ titulo: '', texto: '' }, { titulo: '', texto: '' }] }
    case 'pregunta': return { id, tipo, modo: 'opcion', enunciado: '', opciones: ['', '', ''], correcta: 0, explicacion: '' }
    case 'reflexion': return { id, tipo, pregunta: '' }
    case 'boton': return { id, tipo, texto: '', url: '' }
    case 'unir': return { id, tipo, titulo: '', pares: [{ izq: '', der: '' }, { izq: '', der: '' }, { izq: '', der: '' }] }
    case 'clasificar': return { id, tipo, titulo: '', grupos: [{ nombre: '', elementos: [] }, { nombre: '', elementos: [] }] }
    case 'memorama': return { id, tipo, titulo: '', pares: [{ a: '', b: '' }, { a: '', b: '' }, { a: '', b: '' }] }
    case 'diagrama': return { id, tipo, titulo: '', url: '', puntos: [] }
    case 'completar': return { id, tipo, titulo: '', texto: '', modo: 'banco', distractores: '' }
    case 'ordenar': return { id, tipo, titulo: '', modo: 'letras', items: [{ respuesta: '', pista: '' }] }
    case 'linea': return { id, tipo, titulo: '', items: [{ fecha: '', texto: '' }, { fecha: '', texto: '' }, { fecha: '', texto: '' }] }
    case 'jerarquia': return { id, tipo, titulo: '', items: [{ texto: '' }, { texto: '' }, { texto: '' }] }
    case 'trivia': return { id, tipo, titulo: '', segundos: 20, preguntas: [preguntaJuego(), preguntaJuego()] }
    case 'ruleta': return { id, tipo, titulo: '', items: ['', '', '', ''], quitar: false }
    case 'laberinto': return { id, tipo, titulo: '', enemigos: 1, preguntas: [preguntaJuego()] }
    default: return { id, tipo: 'texto', texto: '' }
  }
}

const vacio = (t) => !String(t ?? '').trim()

// Primer problema de un bloque, o null si está listo
export function revisarBloque(b) {
  switch (b.tipo) {
    case 'texto': return vacio(b.texto) ? 'el texto está vacío' : null
    case 'destacado': return vacio(b.texto) ? 'el recuadro no tiene texto' : null
    case 'imagen': return vacio(b.url) ? 'falta la imagen' : null
    case 'video': return !/^https?:\/\//i.test(b.url ?? '') ? 'falta el enlace del video' : null
    case 'tarjetas': return b.items.filter((x) => !vacio(x.frente) && !vacio(x.reverso)).length < 1 ? 'necesita al menos una tarjeta con frente y reverso' : null
    case 'acordeon':
    case 'pasos': return b.items.filter((x) => !vacio(x.titulo)).length < 1 ? 'necesita al menos un elemento con título' : null
    case 'pregunta':
      if (vacio(b.enunciado)) return 'falta el enunciado de la pregunta'
      if (b.modo === 'opcion' && (b.opciones.filter((o) => !vacio(o)).length < 2 || vacio(b.opciones[b.correcta]))) return 'necesita dos opciones y la correcta marcada'
      return null
    case 'reflexion': return vacio(b.pregunta) ? 'falta la pregunta de reflexión' : null
    case 'boton': return vacio(b.texto) || !/^https?:\/\//i.test(b.url ?? '') ? 'necesita texto y un enlace que empiece por https://' : null
    case 'unir': {
      const p = (b.pares ?? []).filter((x) => !vacio(x.izq) && !vacio(x.der))
      if (p.length < 2) return 'necesita al menos dos parejas completas'
      if (new Set(p.map((x) => x.der.trim())).size < p.length) return 'los textos de la columna derecha no se pueden repetir'
      return null
    }
    case 'clasificar': {
      const g = (b.grupos ?? []).filter((x) => !vacio(x.nombre) && x.elementos?.some((e) => !vacio(e)))
      return g.length < 2 ? 'necesita al menos dos grupos con nombre y elementos' : null
    }
    case 'memorama': return (b.pares ?? []).filter((x) => !vacio(x.a) && !vacio(x.b)).length < 2 ? 'necesita al menos dos parejas' : null
    case 'diagrama':
      if (vacio(b.url)) return 'falta la imagen'
      return (b.puntos ?? []).filter((x) => !vacio(x.nombre)).length < 2 ? 'marca al menos dos puntos con su nombre' : null
    case 'completar': return !partirHuecos(b.texto).some((x) => x.aceptadas) ? 'marca al menos un hueco con [[palabra]]' : null
    case 'ordenar': return !(b.items ?? []).some((x) => !vacio(x.respuesta)) ? 'escribe al menos una palabra u oración' : null
    case 'linea':
    case 'jerarquia': return (b.items ?? []).filter((x) => !vacio(x.texto)).length < 3 ? 'necesita al menos tres elementos' : null
    case 'trivia':
    case 'laberinto': {
      const ps = (b.preguntas ?? []).filter((q) => !vacio(q.enunciado))
      if (!ps.length) return 'necesita al menos una pregunta'
      const mala = ps.findIndex((q) => q.opciones.filter((o) => !vacio(o)).length < 2 || vacio(q.opciones[q.correcta]))
      return mala >= 0 ? `la pregunta ${mala + 1} necesita dos opciones y la correcta marcada` : null
    }
    case 'ruleta': return (b.items ?? []).filter((x) => !vacio(x)).length < 2 ? 'necesita al menos dos opciones' : null
    default: return null
  }
}

// Quita elementos vacíos antes de guardar
const limpiarPreguntaJuego = (q) => {
  const correcta = q.opciones[q.correcta]
  const opciones = q.opciones.map((o) => String(o).trim()).filter(Boolean)
  return { ...q, enunciado: q.enunciado.trim(), opciones, correcta: Math.max(0, opciones.indexOf(String(correcta ?? '').trim())) }
}

export function limpiarBloque(b) {
  const x = structuredClone(b)
  if (x.items && x.tipo === 'ruleta') x.items = x.items.map((i) => String(i).trim()).filter(Boolean)
  else if (x.items) x.items = x.items.filter((i) => Object.values(i).some((v) => !vacio(v)))
  if (x.tipo === 'pregunta' && x.modo === 'opcion') {
    const correcta = x.opciones[x.correcta]
    x.opciones = x.opciones.map((o) => o.trim()).filter(Boolean)
    x.correcta = Math.max(0, x.opciones.indexOf(String(correcta).trim()))
  }
  if (x.pares) x.pares = x.pares.filter((p) => Object.values(p).every((v) => !vacio(v))).map((p) => Object.fromEntries(Object.entries(p).map(([k, v]) => [k, v.trim()])))
  if (x.grupos) x.grupos = x.grupos.map((g) => ({ nombre: g.nombre.trim(), elementos: g.elementos.map((e) => e.trim()).filter(Boolean) })).filter((g) => g.nombre && g.elementos.length)
  if (x.puntos) x.puntos = x.puntos.filter((p) => !vacio(p.nombre)).map((p) => ({ ...p, nombre: p.nombre.trim() }))
  if (x.preguntas) x.preguntas = x.preguntas.filter((q) => !vacio(q.enunciado)).map(limpiarPreguntaJuego)
  return x
}

// Lección de ejemplo interactiva
export const LECCIONES_INTERACTIVAS = [
  {
    clave: 'eucaristia',
    titulo: 'El Sacramento de la Eucaristía',
    resumen: 'Centro y cumbre de la vida cristiana: fundamento bíblico, presencia real, memorial, comunión y misión.',
    bloques: [
      { tipo: 'destacado', estilo: 'idea', titulo: 'Centro y cumbre', texto: 'El Sacramento de la Eucaristía es el **centro y la cumbre** de toda la vida cristiana y de la liturgia eclesial. En él se contiene, celebra y ofrece todo el bien espiritual de la Iglesia: **la persona misma de Jesucristo**.' },
      { tipo: 'texto', texto: '# 1. Fundamento humano y bíblico\n\nDios asume una realidad humana tan cotidiana como **la comida en común**. Compartir la mesa no solo alimenta el cuerpo: crea lazos de **fraternidad, comunicación y comunión** entre quienes participan.' },
      { tipo: 'acordeon', titulo: 'De la Antigua a la Nueva Pascua · toca cada una', items: [
        { titulo: 'La Pascua judía', texto: 'En el Antiguo Testamento, la Pascua conmemoraba la **liberación de la esclavitud de Egipto** mediante el sacrificio del cordero.' },
        { titulo: 'La Nueva Pascua de Jesús', texto: 'En la Última Cena, Jesús da un sentido plenamente nuevo al pan y al vino: se entrega a sí mismo como el **verdadero Cordero de Dios**, que inaugura y sella la **Nueva Alianza** prometida por los profetas para el perdón de los pecados.' },
      ] },
      { tipo: 'pregunta', modo: 'opcion', enunciado: '¿Qué conmemoraba la Pascua judía?', opciones: ['La liberación de la esclavitud de Egipto', 'La construcción del Templo', 'El regreso del destierro de Babilonia'], correcta: 0, explicacion: 'La Pascua recordaba el paso de la esclavitud a la libertad mediante el sacrificio del cordero. Jesús le da plenitud entregándose Él mismo.' },
      { tipo: 'texto', texto: '# 2. Dimensiones teológicas fundamentales\n\nGira cada tarjeta para descubrir su significado.' },
      { tipo: 'tarjetas', titulo: 'Palabras clave de la Eucaristía', items: [
        { frente: 'Presencia Real', reverso: 'El Señor resucitado está verdaderamente presente en su cuerpo, sangre, alma y divinidad bajo las especies del pan y del vino.' },
        { frente: 'Transustanciación', reverso: 'La sustancia del pan y del vino se transforma en la sustancia del Cuerpo y la Sangre de Cristo.' },
        { frente: 'Epíclesis', reverso: 'La invocación del Espíritu Santo sobre el pan y el vino.' },
        { frente: 'Anámnesis', reverso: 'Memorial: no un simple recuerdo, sino la actualización del único sacrificio de Cristo.' },
        { frente: 'Koinonía', reverso: 'Comunión: une a cada fiel con Cristo y a todos en un solo cuerpo.' },
        { frente: 'Misa = mittere', reverso: 'Enviar: la celebración termina enviando a la asamblea a vivir el amor celebrado.' },
      ] },
      { tipo: 'destacado', estilo: 'importante', titulo: 'No se repite el Calvario', texto: 'La Misa **no es una repetición** del sacrificio de la cruz: es la **actualización y presencia eficaz** del único e irrepetible sacrificio de Cristo. En ella la Iglesia ofrece al Padre la Víctima divina e integra las vidas de los fieles a esa ofrenda.' },
      { tipo: 'pregunta', modo: 'vf', enunciado: 'La comunión eucarística exige un compromiso de solidaridad con los más frágiles de la comunidad.', correcta: true, explicacion: 'Verdadero. La Eucaristía fortalece la caridad: comulgar con Cristo nos compromete con los hermanos más necesitados.' },
      { tipo: 'texto', texto: '# 3. Las «dos mesas»\n\nLa Misa se nutre de dos momentos que forman **un solo acto de culto**:\n\n- **La Mesa de la Palabra:** se proclama e interpreta la Sagrada Escritura; es Cristo quien habla a su pueblo.\n- **La Mesa del Cuerpo de Cristo:** la Plegaria Eucarística (acción de gracias, consagración e intercesiones) que culmina en la comunión.' },
      { tipo: 'pasos', titulo: 'El camino de Emaús (Lc 24, 13-35) · avanza paso a paso', items: [
        { titulo: 'Caminan tristes y confundidos', texto: 'Dos discípulos regresan a Emaús sin esperanza después de la muerte de Jesús.' },
        { titulo: 'Escuchan las Escrituras', texto: 'Jesús les explica la Palabra y su corazón comienza a **arder**. Es la Mesa de la Palabra.' },
        { titulo: 'Lo reconocen al partir el pan', texto: 'En la mesa, al partir el pan, se les abren los ojos. Es la Mesa del Cuerpo de Cristo.' },
        { titulo: 'Parten a dar testimonio', texto: 'Regresan de inmediato a Jerusalén a anunciar que el Señor vive. Es el envío misionero.' },
      ] },
      { tipo: 'destacado', estilo: 'biblia', titulo: 'Lucas 24, 32', texto: '«¿No ardía nuestro corazón mientras nos hablaba por el camino y nos explicaba las Escrituras?»' },
      { tipo: 'texto', texto: '# 4. Proyección misionera y escatológica\n\n- **Envío misionero:** la celebración termina enviando a la asamblea en paz para transformar la sociedad mediante la caridad.\n- **Prenda de la gloria futura:** la Eucaristía es anticipo del banquete celestial y promesa de la resurrección, que orienta la esperanza hacia «los cielos nuevos y la tierra nueva».' },
      { tipo: 'pregunta', modo: 'opcion', enunciado: 'La palabra «Misa» viene del latín «mittere», que significa…', opciones: ['Enviar', 'Reunir', 'Ofrecer'], correcta: 0, explicacion: 'Mittere significa enviar: quien celebra la Eucaristía es enviado a vivirla en lo cotidiano.' },
      { tipo: 'reflexion', pregunta: '¿Cómo puedo ayudar a los niños y jóvenes que acompaño a descubrir el camino de Emaús en la Misa del domingo?' },
    ],
  },
]
