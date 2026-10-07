// Bancos de preguntas listos para usar en los repasos.
// Tipos: 'opcion' (opciones + índice correcta), 'vf' (correcta true/false),
// 'completar' (aceptadas: respuestas válidas), 'relacionar' (pares izq → der).

export const BANCOS = [
  {
    clave: 'eucaristia',
    titulo: 'Repaso: El Sacramento de la Eucaristía',
    descripcion: 'Fundamento humano y bíblico, dimensiones teológicas, las dos mesas y la proyección misionera de la Eucaristía.',
    preguntas: [
      {
        tipo: 'opcion',
        enunciado: 'La Iglesia enseña que la Eucaristía es…',
        opciones: [
          'El centro y la cumbre de toda la vida cristiana y de la liturgia',
          'Un sacramento reservado para las grandes fiestas',
          'Un simple recuerdo simbólico de la Última Cena',
          'Una devoción privada de cada creyente',
        ],
        correcta: 0,
        explicacion: 'En la Eucaristía se contiene, celebra y ofrece todo el bien espiritual de la Iglesia: Jesucristo mismo. Por eso es centro y cumbre de la vida cristiana.',
      },
      {
        tipo: 'opcion',
        enunciado: '¿Qué realidad humana cotidiana asume Dios en la Eucaristía?',
        opciones: ['Comer juntos y compartir la mesa', 'El trabajo diario', 'El descanso del sábado', 'Los viajes y peregrinaciones'],
        correcta: 0,
        explicacion: 'Compartir la mesa no solo alimenta el cuerpo: crea lazos de fraternidad, comunicación y comunión entre quienes participan.',
      },
      {
        tipo: 'opcion',
        enunciado: 'En el Antiguo Testamento, la Pascua judía conmemoraba…',
        opciones: [
          'La liberación de la esclavitud de Egipto mediante el sacrificio del cordero',
          'La construcción del Templo de Jerusalén',
          'El regreso del destierro en Babilonia',
          'La entrega de la tierra prometida a Abraham',
        ],
        correcta: 0,
        explicacion: 'La Pascua recordaba el paso de la esclavitud a la libertad. Jesús le da un sentido plenamente nuevo en la Última Cena.',
      },
      {
        tipo: 'vf',
        enunciado: 'En la Última Cena, Jesús se entrega a sí mismo como el verdadero Cordero de Dios que sella la Nueva Alianza para el perdón de los pecados.',
        correcta: true,
        explicacion: 'Verdadero. Jesús da un sentido nuevo al pan y al vino: es Él mismo quien se entrega e inaugura la Nueva Alianza prometida por los profetas.',
      },
      {
        tipo: 'opcion',
        enunciado: 'En la Eucaristía, el Señor resucitado está verdaderamente presente en su…',
        opciones: ['Cuerpo, sangre, alma y divinidad', 'Recuerdo y en el afecto de la asamblea', 'Palabra únicamente', 'Imagen y símbolo'],
        correcta: 0,
        explicacion: 'Es la Presencia Real: Cristo entero está presente bajo las especies del pan y del vino.',
      },
      {
        tipo: 'completar',
        enunciado: 'La transformación de la sustancia del pan y del vino en la sustancia del Cuerpo y la Sangre de Cristo se llama ____.',
        aceptadas: ['Transustanciación', 'Transubstanciación', 'Transustanciacion', 'Transubstanciacion'],
        explicacion: 'Transustanciación: cambia la sustancia, aunque permanecen las apariencias (especies) del pan y del vino.',
      },
      {
        tipo: 'completar',
        enunciado: 'La invocación del Espíritu Santo sobre el pan y el vino se llama ____.',
        aceptadas: ['Epíclesis', 'Epiclesis'],
        explicacion: 'Por la fuerza de la Palabra de Cristo y la epíclesis, el pan y el vino se convierten en su Cuerpo y su Sangre.',
      },
      {
        tipo: 'vf',
        enunciado: 'Cada Misa es una repetición del sacrificio del Calvario.',
        correcta: false,
        explicacion: 'Falso. No se repite: se actualiza y se hace presente de modo eficaz el único e irrepetible sacrificio de Cristo en la cruz.',
      },
      {
        tipo: 'completar',
        enunciado: 'La palabra griega que designa el memorial, la memoria activa de la Pascua del Señor, es ____.',
        aceptadas: ['Anámnesis', 'Anamnesis'],
        explicacion: 'Anámnesis: no es un mero recuerdo del pasado, sino memoria que hace presente la pasión, muerte, resurrección y ascensión del Señor.',
      },
      {
        tipo: 'opcion',
        enunciado: 'En cada Misa la Iglesia ofrece al Padre la Víctima divina y…',
        opciones: [
          'Integra las vidas de los fieles a esa ofrenda',
          'Ofrece solo oraciones por los difuntos',
          'Celebra únicamente la resurrección',
          'Recuerda a los santos del día',
        ],
        correcta: 0,
        explicacion: 'Los fieles unen su propia vida, trabajos y sufrimientos a la ofrenda de Cristo.',
      },
      {
        tipo: 'opcion',
        enunciado: 'La palabra griega «koinonía», aplicada a la Eucaristía, significa…',
        opciones: ['Comunión', 'Sacrificio', 'Acción de gracias', 'Envío'],
        correcta: 0,
        explicacion: 'Koinonía: el banquete eucarístico nos une íntimamente a Cristo y a todos los fieles en un solo cuerpo.',
      },
      {
        tipo: 'vf',
        enunciado: 'La comunión eucarística exige un compromiso de solidaridad con los miembros más frágiles y necesitados de la comunidad.',
        correcta: true,
        explicacion: 'Verdadero. La Eucaristía fortalece la caridad: no se puede comulgar con Cristo y desentenderse de los hermanos.',
      },
      {
        tipo: 'relacionar',
        enunciado: 'Relaciona cada término con su significado.',
        pares: [
          { izq: 'Mesa de la Palabra', der: 'Se proclama e interpreta la Sagrada Escritura' },
          { izq: 'Mesa del Cuerpo de Cristo', der: 'Plegaria Eucarística y distribución del Pan de Vida' },
          { izq: 'Anámnesis', der: 'Memorial que actualiza la Pascua del Señor' },
          { izq: 'Epíclesis', der: 'Invocación del Espíritu Santo' },
        ],
        explicacion: 'Las dos mesas forman un solo acto de culto; anámnesis y epíclesis son momentos centrales de la Plegaria Eucarística.',
      },
      {
        tipo: 'opcion',
        enunciado: 'La Plegaria Eucarística incluye…',
        opciones: [
          'Acción de gracias, consagración e intercesiones',
          'Solo las lecturas y la homilía',
          'El saludo de paz y la bendición final',
          'El acto penitencial y el Gloria',
        ],
        correcta: 0,
        explicacion: 'Es el corazón de la Mesa del Cuerpo de Cristo, que culmina en la comunión.',
      },
      {
        tipo: 'opcion',
        enunciado: '¿Qué pasaje del Evangelio refleja el camino de las «dos mesas»?',
        opciones: ['Los discípulos de Emaús', 'La multiplicación de los panes', 'Las bodas de Caná', 'La parábola del sembrador'],
        correcta: 0,
        explicacion: 'En Emaús, los discípulos escuchan las Escrituras y luego reconocen al Señor al partir el pan (Lc 24, 13-35).',
      },
      {
        tipo: 'relacionar',
        enunciado: 'Ordena el camino de los discípulos de Emaús: relaciona cada momento con lo que vivieron.',
        pares: [
          { izq: 'Al escuchar las Escrituras', der: 'Sienten arder su corazón' },
          { izq: 'Al partir el pan', der: 'Reconocen al Señor resucitado' },
          { izq: 'Después del encuentro', der: 'Parten de inmediato a dar testimonio' },
        ],
        explicacion: 'Es el mismo itinerario de cada Misa: Palabra, Eucaristía y misión.',
      },
      {
        tipo: 'opcion',
        enunciado: 'La palabra «Misa» viene del latín «mittere», que significa…',
        opciones: ['Enviar', 'Reunir', 'Ofrecer', 'Cantar'],
        correcta: 0,
        explicacion: 'La celebración termina enviando a la asamblea a vivir en lo cotidiano el amor celebrado y a transformar la sociedad con la caridad.',
      },
      {
        tipo: 'vf',
        enunciado: 'La Eucaristía es prenda de la gloria futura: anticipo del banquete celestial y promesa de la resurrección.',
        correcta: true,
        explicacion: 'Verdadero. Orienta la esperanza cristiana hacia «los cielos nuevos y la tierra nueva».',
      },
    ],
  },
]

let contador = 0
export const nuevoIdPregunta = () => `q${Date.now().toString(36)}${(++contador).toString(36)}`
export const conIds = (preguntas) => preguntas.map((p) => ({ ...structuredClone(p), id: nuevoIdPregunta() }))

export const TIPOS_PREGUNTA = {
  opcion: 'Opción múltiple',
  vf: 'Verdadero o falso',
  completar: 'Completar',
  relacionar: 'Relacionar',
}

export function preguntaVacia(tipo) {
  const base = { id: nuevoIdPregunta(), tipo, enunciado: '', explicacion: '' }
  if (tipo === 'opcion') return { ...base, opciones: ['', '', '', ''], correcta: 0 }
  if (tipo === 'vf') return { ...base, correcta: true }
  if (tipo === 'completar') return { ...base, aceptadas: [''] }
  return { ...base, pares: [{ izq: '', der: '' }, { izq: '', der: '' }, { izq: '', der: '' }] }
}

// Devuelve el primer problema de una pregunta, o null si está completa
export function revisarPregunta(p) {
  if (!p.enunciado?.trim()) return 'falta el enunciado'
  if (p.tipo === 'opcion') {
    const llenas = p.opciones.filter((o) => o.trim())
    if (llenas.length < 2) return 'necesita al menos dos opciones'
    if (!p.opciones[p.correcta]?.trim()) return 'la opción marcada como correcta está vacía'
    if (new Set(llenas.map((o) => o.trim())).size !== llenas.length) return 'tiene opciones repetidas'
  }
  if (p.tipo === 'completar' && !p.aceptadas.some((a) => a.trim())) return 'falta la respuesta correcta'
  if (p.tipo === 'relacionar') {
    const llenos = p.pares.filter((x) => x.izq.trim() && x.der.trim())
    if (llenos.length < 2) return 'necesita al menos dos parejas completas'
    if (new Set(llenos.map((x) => x.der.trim())).size !== llenos.length) return 'las respuestas de la derecha no pueden repetirse'
  }
  return null
}

// Limpia una pregunta antes de guardarla
export function limpiarPregunta(p) {
  const q = { ...p, enunciado: p.enunciado.trim(), explicacion: (p.explicacion ?? '').trim() }
  if (p.tipo === 'opcion') {
    const correcta = p.opciones[p.correcta].trim()
    q.opciones = p.opciones.map((o) => o.trim()).filter(Boolean)
    q.correcta = q.opciones.indexOf(correcta)
  }
  if (p.tipo === 'completar') q.aceptadas = p.aceptadas.map((a) => a.trim()).filter(Boolean)
  if (p.tipo === 'relacionar') q.pares = p.pares.map((x) => ({ izq: x.izq.trim(), der: x.der.trim() })).filter((x) => x.izq && x.der)
  return q
}
