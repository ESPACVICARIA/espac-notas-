import { NavLink } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Logos from './Logos'

const ROLES = { admin: 'Coordinación', formador: 'Formador', estudiante: 'Estudiante' }

export default function Layout({ perfil, children }) {
  const enlace = ({ isActive }) =>
    `block rounded-md px-3 py-2 text-sm font-medium ${isActive ? 'bg-white/15 text-white' : 'text-blue-100 hover:bg-white/10'}`

  return (
    <div className="min-h-screen md:grid md:grid-cols-[15rem_1fr]">
      <aside className="bg-tinta p-5 text-white md:min-h-screen">
        <div className="mb-8 border-b border-white/15 pb-5">
          <Logos tamano="sm" className="mb-4 rounded-lg bg-white px-3 py-2" />
          <p className="font-serif text-xl font-semibold leading-tight">Proceso de ESPAC Notas</p>
          <p className="mt-1 text-xs text-blue-200">Escuela Parroquial de Catequistas · Diócesis de Engativá</p>
        </div>
        <nav className="flex flex-wrap gap-1 md:flex-col">
          <NavLink to="/" end className={enlace}>Estudiantes</NavLink>
          {perfil?.rol !== 'estudiante' && <NavLink to="/notas" className={enlace}>Digitar notas</NavLink>}
          {perfil?.rol === 'admin' && <NavLink to="/importar" className={enlace}>Importar</NavLink>}
          {perfil?.rol === 'admin' && <NavLink to="/configuracion" className={enlace}>Configuración</NavLink>}
        </nav>
        <div className="mt-8 text-sm md:mt-auto">
          <p className="truncate text-blue-100">{perfil?.nombre}</p>
          <p className="text-xs text-oro">{ROLES[perfil?.rol]}</p>
          <button onClick={() => supabase.auth.signOut()} className="mt-3 text-xs text-blue-200 underline hover:text-white">
            Cerrar sesión
          </button>
        </div>
      </aside>
      <main className="mx-auto w-full max-w-6xl p-5 md:p-10">{children}</main>
    </div>
  )
}
