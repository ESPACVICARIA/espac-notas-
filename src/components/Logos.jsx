import espac from '../logo-espac.png'
import diocesis from '../logo-diocesis.png'
import vicaria from '../logo-vicaria.png'

const ALTOS = { sm: 'h-9', md: 'h-12', lg: 'h-16' }

// Los logos tienen partes blancas, así que siempre van sobre fondo claro
export default function Logos({ tamano = 'md', className = '' }) {
  const alto = ALTOS[tamano]
  return (
    <div className={`flex items-center justify-center gap-4 ${className}`}>
      <img src={diocesis} alt="Diócesis de Engativá" className={`${alto} w-auto`} />
      <img src={espac} alt="Escuela Parroquial de Catequistas ESPAC" className={`${tamano === 'sm' ? 'h-11' : tamano === 'md' ? 'h-16' : 'h-20'} w-auto`} />
      <img src={vicaria} alt="Vicaría Episcopal Territorial Nuestra Señora del Rosario" className={`${alto} w-auto`} />
    </div>
  )
}
