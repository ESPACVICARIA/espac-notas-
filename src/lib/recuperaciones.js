// Formas alternativas de recuperar una inasistencia, según lo que se perdió.
// El formador elige una y puede ajustar el detalle; también puede escribir otra.

export const FORMAS = {
  modulo: [
    { clave: 'otra_cohorte', nombre: 'Asistir a la sesión con otra cohorte', detalle: 'Asiste al mismo tema con otra cohorte o en el otro centro (Suba o Cota) y trae la firma del formador que lo recibe.' },
    { clave: 'leccion', nombre: 'Lección en línea del módulo', detalle: 'Estudia la lección del tema en «Estudiar» del portal y entrega sus actividades con nota igual o superior a 3,0.' },
    { clave: 'repaso', nombre: 'Repaso en línea', detalle: 'Resuelve el repaso del módulo en el portal con nota igual o superior a 3,0.' },
    { clave: 'taller', nombre: 'Taller escrito del tema', detalle: 'Responde por escrito las preguntas de la sesión con apoyo del material del módulo (2 a 3 páginas).' },
    { clave: 'exposicion', nombre: 'Exposición al grupo', detalle: 'Prepara y presenta en el siguiente encuentro una síntesis de 10 minutos del tema que perdió.' },
    { clave: 'entrevista', nombre: 'Entrevista con el formador', detalle: 'Conversa con el formador sobre el tema perdido y muestra que lo comprende.' },
  ],
  retiro: [
    { clave: 'retiro_otro', nombre: 'Retiro con otra cohorte o centro', detalle: 'Participa completo en el retiro de otra cohorte o del otro centro (Suba o Cota), con constancia de asistencia.' },
    { clave: 'desierto', nombre: 'Jornada de desierto guiada', detalle: 'Medio día de oración personal con la guía del retiro (lecturas, meditaciones y preguntas) y entrega de su diario espiritual.' },
    { clave: 'hora_santa', nombre: 'Horas santas con reflexión', detalle: 'Dos horas santas ante el Santísimo en su parroquia, con una reflexión escrita de cada una y firma del párroco.' },
    { clave: 'lectio', nombre: 'Lectio divina escrita', detalle: 'Hace la lectio divina de los textos bíblicos del retiro (lectura, meditación, oración, contemplación) y la entrega por escrito.' },
    { clave: 'acompanamiento', nombre: 'Encuentro de acompañamiento espiritual', detalle: 'Encuentro con el director espiritual o el formador del retiro para compartir su proceso, con constancia.' },
  ],
  seminario: [
    { clave: 'seminario_otro', nombre: 'Seminario con otra cohorte', detalle: 'Asiste al mismo seminario con otra cohorte o en el otro centro, con constancia de asistencia.' },
    { clave: 'grabacion', nombre: 'Material o grabación con síntesis', detalle: 'Estudia el material o la grabación del seminario y entrega una síntesis con sus aportes (3 a 4 páginas).' },
    { clave: 'ensayo', nombre: 'Ensayo o trabajo de investigación', detalle: 'Desarrolla un trabajo escrito sobre el tema del seminario con al menos dos fuentes del Magisterio.' },
    { clave: 'exposicion', nombre: 'Exposición al grupo', detalle: 'Presenta al grupo, en el siguiente encuentro, lo esencial del tema del seminario.' },
    { clave: 'servicio', nombre: 'Proyecto de servicio pastoral', detalle: 'Aplica el tema del seminario en un servicio en su parroquia y entrega evidencias y una reflexión.' },
  ],
}
export const formasPara = (tipo) => FORMAS[tipo] ?? FORMAS.modulo

export const ESTADOS_REC = {
  asignada: { nombre: 'Asignada', clase: 'bg-amber-100 text-amber-900 border-amber-300' },
  entregada: { nombre: 'Entregada, por revisar', clase: 'bg-blue-100 text-blue-900 border-blue-300' },
  aprobada: { nombre: 'Aprobada', clase: 'bg-green-100 text-green-900 border-green-400' },
  no_presentada: { nombre: 'No presentada', clase: 'bg-red-100 text-red-900 border-red-300' },
}

// Clave de la falla: sesión y estudiante, o el espacio completo si no hay sesión
export const claveRec = (r) => (r.sesion_id ? `s${r.sesion_id}:${r.estudiante_id}` : `e${r.espacio_id}:${r.estudiante_id}`)
export const mapaRecuperaciones = (lista = []) => Object.fromEntries(lista.map((r) => [claveRec(r), r]))

// Conteo de asistencia de un estudiante. Una falla con recuperación aprobada cuenta como «R» (recuperada).
export function contar(sesiones, marcas, estId, recs = {}) {
  const c = { A: 0, FI: 0, FJ: 0, R: 0 }
  for (const s of sesiones) {
    const x = marcas[s.id]?.[estId]
    if (!x?.estado) continue
    if (x.estado !== 'A' && recs[`s${s.id}:${estId}`]?.estado === 'aprobada') c.R++
    else c[x.estado]++
  }
  return c
}

export const hoyISO = () => new Date().toLocaleDateString('en-CA')
export const vencida = (r) => r.fecha_limite && ['asignada'].includes(r.estado) && r.fecha_limite < hoyISO()

// En rojo: falla injustificada (o retiro/seminario sin asistir) sin recuperar, con la recuperación vencida o no presentada
export const enRojo = (tipo, rec) => rec?.estado !== 'aprobada' && tipo !== 'FJ' && (!rec || rec.estado === 'no_presentada' || !!vencida(rec))
