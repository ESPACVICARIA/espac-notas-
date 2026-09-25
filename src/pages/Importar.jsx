import * as XLSX from 'xlsx'

// [campo en la base, título en la plantilla, otros nombres aceptados]
export const COLUMNAS = [
  ['nombre_completo', 'Nombre completo', ['nombre', 'nombres', 'nombresyapellidos', 'estudiante', 'nombreestudiante']],
  ['tipo_id', 'Tipo documento', ['tipo', 'tipoid', 'tipodedocumento', 'tipoidentificacion', 'tipodeidentificacion']],
  ['numero_id', 'Número documento', ['documento', 'numero', 'numerodedocumento', 'cedula', 'identificacion', 'nodocumento', 'numeroid']],
  ['parroquia', 'Parroquia', ['parroquiaalaquepertenece']],
  ['centro_formacion', 'Centro de formación', ['centroformacion', 'centro']],
  ['fecha_matricula', 'Fecha de matrícula', ['fechamatricula']],
  ['lugar_nacimiento', 'Lugar de nacimiento', ['lugarnacimiento']],
  ['fecha_nacimiento', 'Fecha de nacimiento', ['fechanacimiento']],
  ['direccion', 'Dirección', ['direccionresidencia', 'direccionderesidencia']],
  ['barrio', 'Barrio', []],
  ['telefono', 'Teléfono', ['celular', 'contacto', 'telefonoocontacto']],
  ['correo', 'Correo electrónico', ['correo', 'email', 'mail', 'ecorreo']],
  ['ocupacion', 'Ocupación', ['oficio', 'ocupacionuoficio']],
  ['nivel_escolar', 'Nivel escolar', ['nivelescolarmasalto', 'nivelescolarmasaltoalcanzado', 'escolaridad']],
  ['estudio_superior', 'Estudio universitario o técnico', ['estudiouniversitario', 'estudiosuperior', 'estudiotecnico']],
  ['observaciones', 'Observaciones', ['notas', 'comentarios']],
]

const clave = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')
const MAPA = Object.fromEntries(COLUMNAS.flatMap(([campo, titulo, alias]) => [clave(titulo), ...alias].map((a) => [a, campo])))

export const normalizarDoc = (v) => String(v ?? '').toUpperCase().replace(/[^0-9A-Z]/g, '')

const TIPOS = {
  CC: 'CC', CEDULA: 'CC', CEDULADECIUDADANIA: 'CC',
  CE: 'CE', CEDULADEEXTRANJERIA: 'CE',
  PAS: 'PAS', PA: 'PAS', PASAPORTE: 'PAS',
  TI: 'TI', TARJETADEIDENTIDAD: 'TI',
}

const CAMPOS_TEXTO = ['parroquia', 'centro_formacion', 'lugar_nacimiento', 'direccion', 'barrio', 'telefono',
  'ocupacion', 'nivel_escolar', 'estudio_superior', 'observaciones']

// Fila vacía con todas las columnas, para que todas las inserciones sean uniformes
export const ESTUDIANTE_VACIO = {
  nombre_completo: null, tipo_id: null, numero_id: null, correo: null, fecha_matricula: null, fecha_nacimiento: null,
  ...Object.fromEntries(CAMPOS_TEXTO.map((c) => [c, null])), estado: 'activo',
}

const texto = (v) => {
  const t = String(v ?? '').replace(/\s+/g, ' ').trim()
  return t || null
}

function aFecha(v) {
  if (v === null || v === undefined || String(v).trim() === '') return { valor: null }
  const ok = (y, m, d) => {
    const f = new Date(Number(y), Number(m) - 1, Number(d))
    if (f.getFullYear() !== Number(y) || f.getMonth() !== Number(m) - 1 || f.getDate() !== Number(d)) return null
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  }
  let valor = null
  if (typeof v === 'number') {
    const d = XLSX.SSF.parse_date_code(v)
    if (d) valor = ok(d.y, d.m, d.d)
  } else {
    const t = String(v).trim()
    let m = t.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/)
    if (m) valor = ok(m[1], m[2], m[3])
    m = t.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/)
    if (m) valor = ok(m[3], m[2], m[1])
  }
  return valor ? { valor } : { error: `fecha no válida "${v}" (usa DD/MM/AAAA)` }
}

// Limpia una fila y devuelve solo los campos con valor
export function limpiarFila(o) {
  const datos = {}
  const errores = []

  const nombre = texto(o.nombre_completo)
  if (nombre) datos.nombre_completo = nombre
  else errores.push('falta el nombre')

  const doc = normalizarDoc(o.numero_id)
  if (doc) datos.numero_id = doc

  if (texto(o.tipo_id)) {
    const t = TIPOS[clave(o.tipo_id).toUpperCase()]
    if (t) datos.tipo_id = t
    else errores.push(`tipo de documento no válido "${o.tipo_id}" (usa CC, CE, PAS o TI)`)
  } else if (doc) {
    datos.tipo_id = 'CC'
  }

  for (const c of CAMPOS_TEXTO) {
    const t = texto(o[c])
    if (t) datos[c] = t
  }

  const correo = texto(o.correo)
  if (correo) {
    const c = correo.toLowerCase().replace(/\s/g, '')
    if (/^[^@]+@[^@]+\.[^@]+$/.test(c)) datos.correo = c
    else errores.push(`correo no válido "${correo}"`)
  }

  for (const c of ['fecha_matricula', 'fecha_nacimiento']) {
    const r = aFecha(o[c])
    if (r.error) errores.push(r.error)
    else if (r.valor) datos[c] = r.valor
  }

  return { datos, errores }
}

export async function leerExcel(archivo) {
  const libro = XLSX.read(await archivo.arrayBuffer())
  const hoja = libro.Sheets[libro.SheetNames[0]]
  const filas = XLSX.utils.sheet_to_json(hoja, { defval: '', raw: true })
  const encabezados = Object.keys(filas[0] ?? {})
  return {
    filas: filas
      .map((f) => {
        const o = {}
        for (const [h, v] of Object.entries(f)) {
          const campo = MAPA[clave(h)]
          if (campo) o[campo] = v
        }
        return o
      })
      .filter((o) => Object.values(o).some((v) => String(v).trim() !== '')),
    reconocidos: encabezados.filter((h) => MAPA[clave(h)]),
    ignorados: encabezados.filter((h) => !MAPA[clave(h)]),
  }
}

// Lista pegada: una persona por línea, "Nombre" o "Nombre <tab> Documento"
export function leerLista(textoPegado) {
  const lineas = textoPegado.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const filas = lineas.map((l) => {
    const partes = l.split(/\t|;/).map((p) => p.trim()).filter(Boolean)
    const doc = partes.find((p) => /^[\d.\s-]{5,}$/.test(p))
    return { nombre_completo: partes.filter((p) => p !== doc).join(' '), numero_id: doc ?? '' }
  })
  // Si la primera línea es un encabezado ("Nombre", "Nombre completo"...), se omite
  if (filas.length && MAPA[clave(lineas[0].split(/\t|;/)[0])] === 'nombre_completo') filas.shift()
  return filas
}

export function descargarPlantilla() {
  const titulos = COLUMNAS.map(([, t]) => t)
  const hoja = XLSX.utils.aoa_to_sheet([titulos])
  hoja['!cols'] = titulos.map((t) => ({ wch: Math.max(14, t.length + 4) }))

  const ejemplo = XLSX.utils.aoa_to_sheet([
    titulos,
    ['María Fernanda Rojas Díaz', 'CC', '1020304050', 'Nuestra Señora de Fátima',
      'Vicaría Episcopal Territorial Ntra. Sra. del Rosario', '15/02/2026', 'Bogotá', '09/09/1980',
      'Cra 100 # 120-30', 'Suba', '3001234567', 'maria.rojas@correo.com', 'Docente', 'Secundaria', '', ''],
    [],
    ['Solo "Nombre completo" es obligatorio. Llena los estudiantes en la primera hoja; esta hoja es solo de ejemplo.'],
    ['Tipo documento: CC, CE, PAS o TI. Fechas: DD/MM/AAAA.'],
  ])
  ejemplo['!cols'] = hoja['!cols']

  const libro = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(libro, hoja, 'Estudiantes')
  XLSX.utils.book_append_sheet(libro, ejemplo, 'Ejemplo')
  XLSX.writeFile(libro, 'plantilla-estudiantes-espac.xlsx')
}
