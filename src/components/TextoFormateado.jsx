// Muestra texto con un formato sencillo, sin permitir HTML:
//   # Título      ## Subtítulo      **negrita**      *cursiva*
//   - viñeta      1. lista numerada      > cita      [texto](https://enlace)
// Las líneas en blanco separan párrafos.

const ENLACE = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g

function enLinea(texto, clave = '') {
  const partes = []
  let resto = texto
  let i = 0
  const patron = /(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\(https?:\/\/[^\s)]+\))/
  while (resto) {
    const m = resto.match(patron)
    if (!m) { partes.push(resto); break }
    if (m.index) partes.push(resto.slice(0, m.index))
    const t = m[0]
    const k = `${clave}-${i++}`
    if (t.startsWith('**')) partes.push(<strong key={k}>{t.slice(2, -2)}</strong>)
    else if (t.startsWith('[')) {
      const [, txt, url] = [...t.matchAll(ENLACE)][0]
      partes.push(<a key={k} href={url} target="_blank" rel="noopener noreferrer" className="font-medium text-mariano underline">{txt}</a>)
    } else partes.push(<em key={k}>{t.slice(1, -1)}</em>)
    resto = resto.slice(m.index + t.length)
  }
  return partes
}

export default function TextoFormateado({ texto = '', className = '' }) {
  const bloques = []
  const lineas = texto.replace(/\r/g, '').split('\n')
  let i = 0
  while (i < lineas.length) {
    const l = lineas[i]
    const t = l.trim()
    if (!t) { i++; continue }
    if (t.startsWith('## ')) { bloques.push(<h3 key={i} className="mt-6 text-lg font-semibold text-tinta">{enLinea(t.slice(3), i)}</h3>); i++; continue }
    if (t.startsWith('# ')) { bloques.push(<h2 key={i} className="mt-8 text-xl font-semibold text-tinta first:mt-0">{enLinea(t.slice(2), i)}</h2>); i++; continue }
    if (/^[-*•] /.test(t)) {
      const items = []
      while (i < lineas.length && /^[-*•] /.test(lineas[i].trim())) { items.push(lineas[i].trim().slice(2)); i++ }
      bloques.push(<ul key={`u${i}`} className="mt-3 list-disc space-y-1 pl-6">{items.map((x, k) => <li key={k}>{enLinea(x, `${i}-${k}`)}</li>)}</ul>)
      continue
    }
    if (/^\d+[.)] /.test(t)) {
      const items = []
      while (i < lineas.length && /^\d+[.)] /.test(lineas[i].trim())) { items.push(lineas[i].trim().replace(/^\d+[.)] /, '')); i++ }
      bloques.push(<ol key={`o${i}`} className="mt-3 list-decimal space-y-1 pl-6">{items.map((x, k) => <li key={k}>{enLinea(x, `${i}-${k}`)}</li>)}</ol>)
      continue
    }
    if (t.startsWith('> ')) {
      const items = []
      while (i < lineas.length && lineas[i].trim().startsWith('> ')) { items.push(lineas[i].trim().slice(2)); i++ }
      bloques.push(<blockquote key={`q${i}`} className="mt-4 border-l-4 border-oro bg-cielo/50 px-4 py-2 font-serif text-[1.05em] italic">{enLinea(items.join(' '), i)}</blockquote>)
      continue
    }
    const parrafo = []
    while (i < lineas.length && lineas[i].trim() && !/^(#{1,2} |[-*•] |\d+[.)] |> )/.test(lineas[i].trim())) { parrafo.push(lineas[i].trim()); i++ }
    bloques.push(<p key={`p${i}`} className="mt-3 leading-relaxed">{enLinea(parrafo.join(' '), i)}</p>)
  }
  return <div className={className}>{bloques}</div>
}
