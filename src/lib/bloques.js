// Bloques con los que se arma una lección interactiva

let n = 0
export const nuevoId = () => `b${Date.now().toString(36)}${(++n).toString(36)}`

export const TIPOS_BLOQUE = [
  { tipo: 'texto', nombre: 'Texto', ayuda: 'Párrafos, títulos y listas' },
  { tipo: 'destacado', nombre: 'Recuadro destacado', ayuda: 'Idea clave, cita bíblica u oración' },
  { tipo: 'imagen', nombre: 'Imagen', ayuda: 'Foto o gráfico con descripción' },
  { tipo: 'video', nombre: 'Video', ayuda: 'YouTube u otro enlace' },
  { tipo: 'tarjetas', nombre: 'Tarjetas que giran', ayuda: 'Término por delante, significado por detrás' },
  { tipo: 'acordeon', nombre: 'Toca para descubrir', ayuda: 'Secciones que se abren al tocarlas' },
  { tipo: 'pasos', nombre: 'Paso a paso', ayuda: 'Se revela un paso a la vez' },
  { tipo: 'pregunta', nombre: 'Pregunta rápida', ayuda: 'Con respuesta y explicación al instante' },
  { tipo: 'reflexion', nombre: 'Reflexión personal', ayuda: 'El estudiante escribe y la guarda' },
  { tipo: 'boton', nombre: 'Botón de enlace', ayuda: 'Lleva a una página o documento' },
]
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
    default: return null
  }
}

// Quita elementos vacíos antes de guardar
export function limpiarBloque(b) {
  const x = structuredClone(b)
  if (x.items) x.items = x.items.filter((i) => Object.values(i).some((v) => !vacio(v)))
  if (x.tipo === 'pregunta' && x.modo === 'opcion') {
    const correcta = x.opciones[x.correcta]
    x.opciones = x.opciones.map((o) => o.trim()).filter(Boolean)
    x.correcta = Math.max(0, x.opciones.indexOf(String(correcta).trim()))
  }
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
