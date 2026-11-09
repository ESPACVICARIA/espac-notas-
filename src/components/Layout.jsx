import { useEffect, useRef, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Logos from './Logos'

const ROLES = { admin: 'Coordinación', formador: 'Formador', estudiante: 'Estudiante' }

// Íconos de línea (24 × 24), sin librerías externas
const TRAZOS = {
  estudiantes: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  notas: 'M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2M9 13h6M9 17h4',
  estudio: 'M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2zM22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z',
  documentos: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h5',
  mensajes: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
  importar: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
  modulos: 'M12 2 2 7l10 5 10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
  configuracion: 'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6',
  salir: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  menu: 'M3 6h18M3 12h18M3 18h18',
  cerrar: 'M18 6 6 18M6 6l12 12',
}
function Icono({ nombre, className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d={TRAZOS[nombre]} />
    </svg>
  )
}

// Menú agrupado por áreas. «roles» limita quién ve cada opción.
const GRUPOS = [
  { titulo: 'Seguimiento', items: [
    { a: '/', fin: true, icono: 'estudiantes', texto: 'Estudiantes' },
    { a: '/notas', icono: 'notas', texto: 'Digitar notas', roles: ['admin', 'formador'] },
  ] },
  { titulo: 'Formación', items: [
    { a: '/estudio', icono: 'estudio', texto: 'Módulos de estudio', roles: ['admin', 'formador'] },
    { a: '/documentos', icono: 'documentos', texto: 'Documentos', roles: ['admin', 'formador'] },
  ] },
  { titulo: 'Comunicación', items: [
    { a: '/mensajes', icono: 'mensajes', texto: 'Mensajes', roles: ['admin', 'formador'] },
  ] },
  { titulo: 'Administración', items: [
    { a: '/importar', icono: 'importar', texto: 'Importar', roles: ['admin'] },
    { a: '/modulos', icono: 'modulos', texto: 'Plan de módulos', roles: ['admin'] },
    { a: '/configuracion', icono: 'configuracion', texto: 'Configuración', roles: ['admin'] },
  ] },
]

const iniciales = (t = '') => t.replace(/@.*/, '').split(/[\s._-]+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('') || '?'

function Menu({ perfil, alElegir, arriba = 'pt-5' }) {
  const visibles = GRUPOS
    .map((g) => ({ ...g, items: g.items.filter((i) => !i.roles || i.roles.includes(perfil?.rol)) }))
    .filter((g) => g.items.length)
  const nombre = perfil?.nombre || perfil?.correo || ''

  return (
    <div className="flex h-full flex-col">
      <div className={`px-5 ${arriba}`}>
        <Logos tamano="sm" className="rounded-lg bg-white px-3 py-2" />
        <p className="mt-4 font-serif text-xl font-semibold leading-tight text-white">Gestión de ESPAC</p>
        <p className="mt-0.5 text-xs leading-snug text-blue-200/80">Escuela Parroquial de Catequistas · Diócesis de Engativá</p>
      </div>

      <nav aria-label="Menú principal" className="mt-6 flex-1 space-y-5 overflow-y-auto px-3 pb-4">
        {visibles.map((g) => (
          <div key={g.titulo}>
            <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-blue-200/60">{g.titulo}</p>
            <ul className="space-y-0.5">
              {g.items.map((i) => (
                <li key={i.a}>
                  <NavLink to={i.a} end={i.fin} onClick={alElegir}
                    className={({ isActive }) => `group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      isActive ? 'bg-white/[0.12] text-white' : 'text-blue-100/85 hover:bg-white/[0.06] hover:text-white'}`}>
                    {({ isActive }) => (
                      <>
                        <span aria-hidden="true" className={`absolute inset-y-1.5 left-0 w-[3px] rounded-full bg-oro transition-opacity ${isActive ? 'opacity-100' : 'opacity-0'}`} />
                        <Icono nombre={i.icono} className={`h-[18px] w-[18px] shrink-0 ${isActive ? 'text-oro' : 'text-blue-200/70 group-hover:text-blue-100'}`} />
                        {i.texto}
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-white/10 p-4">
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-oro text-sm font-semibold text-white">{iniciales(nombre)}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white" title={nombre}>{nombre}</p>
            <p className="text-xs text-blue-200/80">{ROLES[perfil?.rol] ?? ''}</p>
          </div>
          <button onClick={() => supabase.auth.signOut()} title="Cerrar sesión" aria-label="Cerrar sesión"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-blue-200 transition-colors hover:bg-white/10 hover:text-white">
            <Icono nombre="salir" className="h-[18px] w-[18px]" />
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Layout({ perfil, children }) {
  const [abierto, setAbierto] = useState(false)
  const boton = useRef(null)
  const panel = useRef(null)
  const { pathname } = useLocation()
  const actual = GRUPOS.flatMap((g) => g.items).find((i) => (i.fin ? pathname === i.a : pathname.startsWith(i.a)))

  // Celular: el menú se cierra al cambiar de página, con Escape o tocando fuera; mientras está abierto la página no se desplaza
  useEffect(() => { setAbierto(false) }, [pathname])
  useEffect(() => {
    if (!abierto) return
    const tecla = (e) => { if (e.key === 'Escape') { setAbierto(false); boton.current?.focus() } }
    const previo = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', tecla)
    panel.current?.querySelector('a')?.focus()
    return () => { document.body.style.overflow = previo; window.removeEventListener('keydown', tecla) }
  }, [abierto])

  return (
    <div className="min-h-screen md:grid md:grid-cols-[16rem_1fr] print:block">
      {/* Barra superior en celular */}
      <header className="sticky top-0 z-30 flex items-center gap-3 bg-tinta px-4 py-3 text-white shadow-sm md:hidden print:hidden">
        <button ref={boton} onClick={() => setAbierto(true)} aria-label="Abrir menú" aria-expanded={abierto} aria-controls="menu-movil"
          className="-ml-1 grid h-10 w-10 place-items-center rounded-lg hover:bg-white/10">
          <Icono nombre="menu" className="h-6 w-6" />
        </button>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="font-serif text-base font-semibold">Gestión de ESPAC</p>
          {actual && <p className="truncate text-xs text-blue-200">{actual.texto}</p>}
        </div>
        <span aria-hidden="true" className="grid h-8 w-8 place-items-center rounded-full bg-oro text-xs font-semibold">{iniciales(perfil?.nombre || perfil?.correo)}</span>
      </header>

      {/* Menú deslizable en celular */}
      <div className={`fixed inset-0 z-40 md:hidden print:hidden ${abierto ? 'visible' : 'invisible transition-[visibility] duration-200'}`}>
        <div onClick={() => setAbierto(false)} className={`absolute inset-0 bg-black/50 transition-opacity duration-200 ${abierto ? 'opacity-100' : 'opacity-0'}`} />
        <aside id="menu-movil" ref={panel} role="dialog" aria-modal="true" aria-label="Menú"
          className={`absolute inset-y-0 left-0 flex w-[17rem] max-w-[85vw] flex-col bg-tinta shadow-2xl transition-transform duration-200 ease-out motion-reduce:transition-none ${abierto ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="flex justify-end px-3 pt-3">
            <button onClick={() => { setAbierto(false); boton.current?.focus() }} aria-label="Cerrar menú"
              className="grid h-9 w-9 place-items-center rounded-lg text-blue-100 hover:bg-white/10 hover:text-white">
              <Icono nombre="cerrar" className="h-5 w-5" />
            </button>
          </div>
          <div className="min-h-0 flex-1"><Menu perfil={perfil} alElegir={() => setAbierto(false)} arriba="pt-0" /></div>
        </aside>
      </div>

      {/* Menú fijo en computador */}
      <aside className="sticky top-0 hidden h-screen bg-tinta md:block print:hidden">
        <Menu perfil={perfil} />
      </aside>

      <main className="mx-auto w-full max-w-6xl p-5 md:p-10 print:max-w-none print:p-0">{children}</main>
    </div>
  )
}
