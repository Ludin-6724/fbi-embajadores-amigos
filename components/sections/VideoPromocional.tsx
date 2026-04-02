import { Play } from "lucide-react";

export default function VideoPromocional() {
  return (
    <section className="py-24 bg-white relative">
      <div className="container mx-auto px-4 md:px-8">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <span className="text-sm font-sans font-bold text-gold uppercase tracking-wider mb-4 inline-block">
            Visión del Congreso
          </span>
          <h2 className="text-4xl md:text-5xl font-serif font-bold text-navy-dark leading-tight">
            Descubre nuestra misión
          </h2>
        </div>

        <div className="max-w-5xl mx-auto relative group rounded-3xl overflow-hidden shadow-2xl border border-light-gray bg-navy-dark aspect-video">
          {/* El video apunta a promo.mp4 en la carpeta public, y tiene como respaldo un video online si no lo encuentra local */}
          <video 
            className="w-full h-full object-cover" 
            controls 
            preload="metadata"
            poster="/comunidad-bg.png" // Usa la bella ilustración de la comunidad temporalmente de portada
          >
            {/* Primero intenta cargar el tuyo local */}
            <source src="/promo.mp4" type="video/mp4" />
            
            {/* Si no lo ha copiado aún, cargará un video abstracto divino online como demostración visual temporal */}
            <source src="https://assets.mixkit.co/videos/preview/mixkit-ethereal-gold-and-white-abstract-particles-loop-46487-large.mp4" type="video/mp4" />
            Tu navegador no soporta el formato de video.
          </video>
        </div>
      </div>
    </section>
  );
}
