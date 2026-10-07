import { useState } from 'react'

// Campo de contraseña con botón para mostrarla u ocultarla
export default function CampoClave({ id, value, onChange, className = '', ...resto }) {
  const [visible, setVisible] = useState(false)
  return (
    <div className={`relative ${className}`}>
      <input id={id} type={visible ? 'text' : 'password'} className="campo pr-24" value={value}
        onChange={onChange} autoCapitalize="off" autoCorrect="off" spellCheck={false} {...resto} />
      <button type="button" onClick={() => setVisible((v) => !v)} aria-controls={id} aria-pressed={visible}
        className="absolute inset-y-0 right-0 flex items-center gap-1 px-3 text-xs font-semibold text-mariano hover:text-tinta">
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {visible ? (
            <>
              <path d="M3 3l18 18" />
              <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
              <path d="M9.9 5.1A10.4 10.4 0 0 1 12 5c6.5 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.2M6.6 6.6C3.9 8.4 2 12 2 12s3.5 7 10 7a9.8 9.8 0 0 0 5.4-1.6" />
            </>
          ) : (
            <>
              <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
              <circle cx="12" cy="12" r="3" />
            </>
          )}
        </svg>
        {visible ? 'Ocultar' : 'Mostrar'}
      </button>
    </div>
  )
}
