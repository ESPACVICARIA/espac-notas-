import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { resumen, TablasSemestres } from '../components/Itinerario'
import { fmt } from '../lib/notas'
import Logos from '../components/Logos'
import { HojaItinerario, BarraImpresion } from '../components/Documentos'
import ListaDocumentos from '../components/ListaDocumentos'
import PortalAutoevaluaciones from '../components/PortalAutoevaluaciones'

function CambioClave({ documento, clave, alCambiar }) {
  const [nueva, setNueva] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function guardar(e) {
    e.preventDefault()
    if (nueva !== confirmar) { setError('Las dos contraseñas no coinciden.'); return }
    setEnviando(true); setError('')
    const { data, error } = await supabase.rpc('cambiar_clave_estudiante',
      { p_documento: documento, p_actual: clave, p_nueva: nueva })
    setEnviando(false)
    if (error) setError('No se pudo conectar con la plataforma. Intenta de nuevo.')
    else if (data?.error) setError(data.error)
    else alCambiar(nueva)
  }

  return (
    <form onSubmit={guardar} className="mx-auto max-w-sm rounded-xl border border-slate-200 bg-white p-8">
      <h2 className="text-xl font-semibold">Crea tu contraseña</h2>
      <p className="mt-1 mb-6 text-sm text-slate-500">
        Es tu primer ingreso. Elige una contraseña propia para que solo tú puedas ver tus notas.
      </p>
      <label className="etiqueta" htmlFor="nueva">Nueva contraseña</label>
      <input id="nueva" type="password" required minLength={6} className="campo mb-4" autoComplete="new-password"
        value={nueva} onChange={(e) => setNueva(e.target.value)} />
      <label className="etiqueta" htmlFor="confirmar">Repite la contraseña</label>
      <input id="confirmar" type="password" required className="campo mb-2" autoComplete="new-password"
        value={confirmar} onChange={(e) => setConfirmar(e.target.value)} />
      <p className="mb-4 text-xs text-slate-500">Mínimo 6 caracteres. No puede ser tu número de documento.</p>
      {error && <p className="mb-4 text-sm text-alerta">{error}</p>}
      <button className="btn w-full" disabled={enviando}>{enviando ? 'Guardando…' : 'Guardar contraseña'}</button>
    </form>
  )
}

export default function PortalEstudiante({ acceso, salir, alCambiarClave, alRecargar }) {
  const { datos, documento, clave } = acceso
  const [imprimiendo, setImprimiendo] = useState(false)
  const [seccion, setSeccion] = useState('notas')
  const est = datos.estudiante
  const notas = Object.fromEntries((datos.notas ?? []).map((n) => [n.espacio_id, n]))
  const { semestres } = resumen(datos.espacios ?? [], notas)
  // Semestre en curso de la cohorte; si no está definido, el último con notas
  const conNotas = semestres.filter((x) => x.completos > 0).map((x) => x.s)
  const actual = datos.semestre_actual ?? (conNotas.length ? Math.max(...conNotas) : 1)
  const visibles = semestres.filter((x) => x.s === actual)
  const promedioActual = visibles[0]?.prom ?? null

  return (
    <div className="min-h-screen">
      <header className="border-b-4 border-tinta bg-white print:hidden">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 p-5">
          <div className="flex items-center gap-4">
            <Logos tamano="sm" />
            <div>
              <p className="font-serif text-lg font-semibold">Proceso de ESPAC Notas</p>
              <p className="text-xs text-slate-500">Escuela Parroquial de Catequistas · Diócesis de Engativá</p>
            </div>
          </div>
          <button onClick={salir} className="text-sm text-mariano underline hover:text-tinta">Salir</button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl p-5 md:p-10 print:max-w-none print:p-0">
        {datos.debe_cambiar ? (
          <CambioClave documento={documento} clave={clave} alCambiar={alCambiarClave} />
        ) : imprimiendo ? (
          <>
            <BarraImpresion>
              <button onClick={() => setImprimiendo(false)} className="text-sm text-mariano hover:underline">Volver a mis notas</button>
            </BarraImpresion>
            <div className="overflow-x-auto print:overflow-visible">
              <HojaItinerario est={est ?? {}} espacios={datos.espacios ?? []} notas={notas} formadores={datos.formadores ?? {}} solo={[actual]} />
            </div>
          </>
        ) : (
          <>
            <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
              <div>
                <h1 className="text-3xl font-semibold">{est?.nombre_completo}</h1>
                <p className="text-sm text-slate-500">{[est?.parroquia, est?.cohorte].filter(Boolean).join(' · ')}</p>
              </div>
              <div className="flex items-center gap-4">
                <button onClick={() => setImprimiendo(true)} className="btn-sec">Descargar PDF</button>
                <div className="text-right">
                  <p className="font-serif text-4xl font-semibold tabular-nums">{fmt(promedioActual)}</p>
                  <p className="text-xs text-slate-500">Promedio del semestre {actual}</p>
                </div>
              </div>
            </div>
            <div className="mb-6 flex gap-2 border-b border-slate-200">
              {[['notas', 'Mis notas'], ['autoevaluaciones', 'Autoevaluaciones'], ['documentos', `Documentos${datos.documentos?.length ? ` (${datos.documentos.length})` : ''}`]].map(([k, t]) => (
                <button key={k} onClick={() => setSeccion(k)}
                  className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold ${seccion === k ? 'border-mariano text-mariano' : 'border-transparent text-slate-500'}`}>{t}</button>
              ))}
            </div>
            {seccion === 'autoevaluaciones' ? (
              <PortalAutoevaluaciones documento={documento} clave={clave} alEnviar={alRecargar} />
            ) : seccion === 'documentos' ? (
              <ListaDocumentos documentos={datos.documentos ?? []}
                vacio="Todavía no hay documentos para tus semestres. Tus formadores los publicarán aquí." />
            ) : (
            <>
            <p className="mb-4 inline-block rounded-full bg-cielo px-4 py-1 text-sm font-semibold text-mariano">Semestre {actual} en curso</p>
            <TablasSemestres semestres={visibles} notas={notas} formadores={datos.formadores ?? {}} />
            </>
            )}
          </>
        )}
      </main>
    </div>
  )
}
