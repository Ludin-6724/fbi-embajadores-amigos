import Link from "next/link";
import { MoveRight } from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-navy-dark text-white py-16 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-gold to-transparent opacity-50"></div>
      
      <div className="container mx-auto px-4 md:px-8 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 lg:gap-24 mb-12">
          
          <div className="flex flex-col items-start gap-4">
            <Link href="/" className="flex items-center gap-4">
              <img 
                src="/logo-fbi.jpg" 
                alt="Logo Congreso FBI" 
                className="h-14 w-auto object-contain mix-blend-screen grayscale invert brightness-[3] contrast-200"
              />
              <img 
                src="/logo-amigos.jpg" 
                alt="Logo Amigos" 
                className="h-14 w-auto object-contain border-l border-white/30 pl-4 mix-blend-screen grayscale invert brightness-[3] contrast-200"
              />
            </Link>
            <p className="text-light-gray/70 max-w-sm mt-4 text-sm leading-relaxed">
              El sitio web oficial y compañero digital del taller "DEL ALGORITMO AL AGENTE" del Congreso FBI.
            </p>
          </div>

          <div className="flex flex-col space-y-4">
            <h4 className="font-serif font-semibold text-lg text-white mb-2">Secciones</h4>
            <Link href="#mision" className="text-sm text-light-gray/70 hover:text-white transition-colors">La Misión</Link>
            <Link href="#comunidad" className="text-sm text-light-gray/70 hover:text-white transition-colors">Nuestra Comunidad</Link>
            <Link href="#rachas" className="text-sm text-light-gray/70 hover:text-white transition-colors">Rachas de Conexión</Link>
            <Link href="#eventos" className="text-sm text-light-gray/70 hover:text-white transition-colors">Próximos Eventos</Link>
          </div>

          <div className="flex flex-col space-y-4">
            <h4 className="font-serif font-semibold text-lg text-white mb-2">Únete a la misión</h4>
            <p className="text-sm text-light-gray/70">
              Recibe notificaciones sobre nuevos ministerios, eventos y mensajes inspiradores.
            </p>
            <div className="flex mt-4 items-center">
              <input 
                type="email" 
                placeholder="Tu correo electrónico" 
                className="bg-white/10 px-4 py-3 rounded-l-md text-sm text-white placeholder-white/50 focus:outline-none focus:ring-1 focus:ring-gold flex-1 border border-transparent focus:border-gold/50 transition-all"
              />
              <button 
                className="bg-gold px-4 py-3 rounded-r-md hover:bg-gold/80 transition-colors flex items-center justify-center border border-gold"
                aria-label="Suscribirse"
              >
                <MoveRight size={20} className="text-navy-dark" />
              </button>
            </div>
          </div>
        </div>
        
        <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row justify-between items-center text-xs text-light-gray/50">
          <p>© {new Date().getFullYear()} Congreso FBI. Todos los derechos reservados.</p>
          <div className="flex space-x-4 mt-4 md:mt-0">
            <Link href="#" className="hover:text-gold transition-colors">Términos de Servicio</Link>
            <Link href="#" className="hover:text-gold transition-colors">Privacidad</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
