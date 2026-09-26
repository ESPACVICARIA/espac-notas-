import espac from '../logo-espac.png'
import diocesis from '../logo-diocesis.png'
import vicaria from '../logo-vicaria.png'
import { CAMPOS, definitiva, promedio, fmt } from '../lib/notas'

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const partes = (f) => {
  if (!f) return ['', '', '']
  const [y, m, d] = f.split('-')
  return [String(Number(d)), MESES[Number(m) - 1] ?? '', y]
}

// Hoja tamaño carta: en pantalla se ve como papel; al imprimir ocupa la página
export function Hoja({ children }) {
  return (
    <div className="mx-auto mb-8 w-[216mm] min-h-[279mm] bg-white p-[14mm] text-black shadow-lg print:m-0 print:min-h-0 print:w-auto print:p-0 print:shadow-none not-last:break-after-page">
      {children}
    </div>
  )
}

export function Encabezado() {
  return (
    <div className="flex items-center justify-between gap-4 border-b-2 border-tinta pb-3">
      <img src={espac} alt="ESPAC" className="h-20 w-auto" />
      <div className="text-center text-[11px] font-bold uppercase leading-snug tracking-wide">
        <p className="text-[13px]">Escuela Parroquial de Catequistas - ESPAC</p>
        <p>Diócesis de Engativá</p>
        <p>Vicaría Episcopal Territorial</p>
        <p>N. Sra. Rosario - Suba - Cota</p>
      </div>
      <div className="flex items-center gap-2">
        <img src={vicaria} alt="Vicaría Nuestra Señora del Rosario" className="h-12 w-auto" />
        <img src={diocesis} alt="Diócesis de Engativá" className="h-16 w-auto" />
      </div>
    </div>
  )
}

function Linea({ etiqueta, valor, className = '' }) {
  return (
    <div className={`flex items-end gap-2 ${className}`}>
      <span className="shrink-0 text-[11px] font-bold uppercase">{etiqueta}:</span>
      <span className="min-h-5 flex-1 border-b border-slate-500 pb-0.5 text-[13px]">{valor || ''}</span>
    </div>
  )
}

const Casilla = ({ marcada, texto }) => (
  <span className="inline-flex items-center gap-1 text-[11px] font-bold">
    {texto}<span className="inline-grid h-4 w-5 place-items-center border-b border-slate-500 text-[12px]">{marcada ? 'X' : ''}</span>
  </span>
)

export function HojaMatricula({ est }) {
  const [dm, mm, am] = partes(est.fecha_matricula)
  const [dn, mn, an] = partes(est.fecha_nacimiento)
  return (
    <Hoja>
      <Encabezado />
      <div className="mt-6 flex items-start justify-between gap-6">
        <div className="flex-1 pt-4 text-center">
          <h2 className="font-sans text-[15px] font-bold uppercase">Formulario matrícula-inscripción</h2>
          <h3 className="mt-6 font-sans text-[14px] font-bold uppercase">Datos generales y personales</h3>
        </div>
        <div className="grid h-[38mm] w-[30mm] place-items-center overflow-hidden rounded-xl border-2 border-mariano text-[10px] text-slate-400">
          {est.foto_url ? <img src={est.foto_url} alt="" className="h-full w-full object-cover" /> : 'Foto'}
        </div>
      </div>

      <div className="mt-6 space-y-4 rounded-3xl border-2 border-mariano p-6">
        <Linea etiqueta="Centro de formación" valor={est.centro_formacion} />
        <Linea etiqueta="Parroquia a la que pertenece" valor={est.parroquia} />
        <div className="grid grid-cols-3 gap-4">
          <Linea etiqueta="Fecha de matrícula: día" valor={dm} />
          <Linea etiqueta="Mes" valor={mm} />
          <Linea etiqueta="Año" valor={am} />
        </div>
        <Linea etiqueta="Nombre completo" valor={est.nombre_completo} />
        <Linea etiqueta="Lugar de nacimiento" valor={est.lugar_nacimiento} />
        <div className="grid grid-cols-3 gap-4">
          <Linea etiqueta="Fecha: día" valor={dn} />
          <Linea etiqueta="Mes" valor={mn} />
          <Linea etiqueta="Año" valor={an} />
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <span className="text-[11px] font-bold uppercase">Tipo de identificación:</span>
          {['CC', 'CE', 'PAS', 'TI'].map((t) => <Casilla key={t} texto={t} marcada={est.tipo_id === t} />)}
          <Linea etiqueta="Número" valor={est.numero_id} className="min-w-[45%] flex-1" />
        </div>
        <Linea etiqueta="Dirección residencia" valor={est.direccion} />
        <div className="grid grid-cols-2 gap-4">
          <Linea etiqueta="Teléfono o contacto" valor={est.telefono} />
          <Linea etiqueta="Barrio" valor={est.barrio} />
        </div>
        <Linea etiqueta="Correo electrónico" valor={est.correo} />
        <Linea etiqueta="Ocupación u oficio" valor={est.ocupacion} />
        <Linea etiqueta="Nivel escolar más alto alcanzado" valor={est.nivel_escolar} />
        <Linea etiqueta="Estudio universitario o técnico" valor={est.estudio_superior} />
      </div>

      <div className="mt-20 space-y-16">
        <Linea etiqueta="Firma del catequista" valor="" />
        <Linea etiqueta="Firma del párroco" valor="" />
      </div>
    </Hoja>
  )
}

function TablaSemestre({ s, espacios, notas, formador }) {
  const items = espacios.filter((e) => e.semestre === s && (e.activo !== false || notas[e.id]))
    .sort((a, b) => a.orden - b.orden || a.id - b.id)
  const prom = promedio(items.map((e) => definitiva(notas[e.id])))
  const celda = (n, k) => (!n ? '' : fmt(n[k]))
  return (
    <div className="mt-8">
      <table className="w-full border-collapse text-[11px]">
        <thead>
          <tr>
            <th colSpan={3} />
            {CAMPOS.map(([k, t]) => <th key={k} className="border border-slate-600 px-1 py-1 font-bold uppercase underline">{t}</th>)}
            <th className="border border-slate-600 px-1 py-1 font-bold uppercase underline">Definitiva</th>
          </tr>
        </thead>
        <tbody>
          {items.map((e, i) => {
            const n = notas[e.id]
            const d = definitiva(n)
            return (
              <tr key={e.id}>
                {i === 0 && (
                  <td rowSpan={items.length} className="w-7 border border-slate-600 text-center font-bold uppercase">
                    <span className="inline-block rotate-180 [writing-mode:vertical-rl]">Semestre {s}</span>
                  </td>
                )}
                <td className="w-24 border border-slate-600 px-2 py-1.5 uppercase">{e.etiqueta}</td>
                <td className="border border-slate-600 px-2 py-1.5 uppercase">{e.nombre}</td>
                {CAMPOS.map(([k]) => <td key={k} className="w-[15mm] border border-slate-600 text-center tabular-nums">{celda(n, k)}</td>)}
                <td className="w-[17mm] border border-slate-600 text-center font-bold tabular-nums">{n ? fmt(d) : ''}</td>
              </tr>
            )
          })}
          <tr>
            <td colSpan={7} className="px-2 py-1.5">
              <div className="flex items-end justify-between gap-6">
                <Linea etiqueta="Formador" valor={formador} className="flex-1" />
                <span className="font-bold uppercase">Promedio</span>
              </div>
            </td>
            <td className="border border-slate-600 text-center text-[13px] font-bold tabular-nums">{prom === null ? '' : fmt(prom)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

// Dos páginas: semestres 1-2 y 3-4, como la hoja física
export function HojaItinerario({ est, espacios, notas, formadores = {}, solo = null }) {
  const lista = solo ?? [1, 2, 3, 4]
  const paginas = []
  for (let i = 0; i < lista.length; i += 2) paginas.push(lista.slice(i, i + 2))
  const completo = !solo
  const general = promedio([1, 2, 3, 4].map((s) =>
    promedio(espacios.filter((e) => e.semestre === s && (e.activo !== false || notas[e.id])).map((e) => definitiva(notas[e.id])))))
  return (
    <>
      {paginas.map((par, i) => (
        <Hoja key={i}>
          <Encabezado />
          <h2 className="mt-6 text-center font-sans text-[15px] font-bold uppercase">Seguimiento del itinerario formativo</h2>
          <Linea etiqueta="Nombre del estudiante" valor={est.nombre_completo} className="mt-6" />
          {par.map((s) => <TablaSemestre key={s} s={s} espacios={espacios} notas={notas} formador={formadores[s]} />)}
          {completo && i === paginas.length - 1 && (
            <div className="mt-10 flex justify-end">
              <div className="flex items-center gap-3 border-2 border-tinta px-4 py-2">
                <span className="text-[12px] font-bold uppercase">Promedio del itinerario</span>
                <span className="text-[16px] font-bold tabular-nums">{general === null ? '' : fmt(general)}</span>
              </div>
            </div>
          )}
        </Hoja>
      ))}
    </>
  )
}

// Barra superior que no se imprime
export function BarraImpresion({ children }) {
  return (
    <div className="mb-6 flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white p-4 print:hidden">
      {children}
      <button className="btn ml-auto" onClick={() => window.print()}>Imprimir o guardar PDF</button>
      <p className="w-full text-xs text-slate-500">
        En la ventana de impresión elige "Guardar como PDF" como destino para descargar el archivo. Tamaño carta.
      </p>
    </div>
  )
}
