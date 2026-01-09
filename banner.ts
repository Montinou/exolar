import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Star } from 'lucide-react';

// --- Componentes Auxiliares ---

// Componente para una sola estrella parpadeante
const TwinklingStar = ({ delay, x, y, size }) => (
  <motion.div
    initial={{ opacity: 0.2, scale: 0.5 }}
    animate={{ 
      opacity: [0.2, 1, 0.2], 
      scale: [0.5, 1.2, 0.5] 
    }}
    transition={{ 
      duration: Math.random() * 3 + 2, 
      repeat: Infinity, 
      delay: delay,
      ease: "easeInOut"
    }}
    style={{ 
      left: `${x}%`, 
      top: `${y}%`,
      width: size,
      height: size
    }}
    className="absolute bg-white rounded-full shadow-[0_0_8px_rgba(255,255,255,0.8)] z-10 pointer-events-none"
  />
);

// Componente para una estrella fugaz
const ShootingStar = () => {
  const startY = Math.random() * 50; // Comienza en la mitad superior
  
  return (
    <motion.div
      initial={{ x: '-10%', y: `${startY}%`, opacity: 0, scale: 0.5 }}
      animate={{ 
        x: '150%', 
        y: `${startY + 20}%`, 
        opacity: [0, 1, 1, 0], 
        scale: 1 
      }}
      transition={{ 
        duration: 2.5, 
        ease: "easeIn",
        repeat: Infinity,
        repeatDelay: Math.random() * 10 + 5 // Intervalo aleatorio
      }}
      className="absolute z-10 w-32 h-0.5 bg-gradient-to-r from-transparent via-white to-transparent pointer-events-none rotate-12"
    />
  );
};

// --- Componente Principal: CosmicBanner ---

const CosmicBanner = ({ 
  bgImage, 
  overlayImage, 
  title = "Mi App Espacial",
  subtitle = "Explora el universo"
}) => {
  // Generar estrellas estáticas solo una vez para evitar re-renderizados pesados
  const stars = useMemo(() => {
    return Array.from({ length: 40 }).map((_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() > 0.8 ? 3 : 2, // Algunas más grandes
      delay: Math.random() * 5
    }));
  }, []);

  return (
    <div className="relative w-full h-[280px] md:h-[300px] overflow-hidden group shadow-2xl bg-black rounded-b-3xl md:rounded-3xl mx-auto max-w-[1920px]">
      
      {/* 1. Capa de Fondo (Imagen 10:1 o Panorámica) */}
      <div className="absolute inset-0 z-0">
        <img 
          src={bgImage} 
          alt="Banner Background" 
          className="w-full h-full object-cover object-center scale-105 group-hover:scale-110 transition-transform duration-[20s] ease-linear"
        />
        {/* Overlay degradado para asegurar legibilidad y fusión con la app */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/60 mix-blend-multiply" />
        <div className="absolute inset-0 bg-indigo-900/20 mix-blend-overlay" />
      </div>

      {/* 2. Capa de Estrellas Animadas */}
      <div className="absolute inset-0 z-10 overflow-hidden">
        {stars.map((star) => (
          <TwinklingStar 
            key={star.id} 
            {...star} 
          />
        ))}
        {/* Añadimos un par de estrellas fugaces */}
        <ShootingStar />
        <ShootingStar />
      </div>

      {/* 3. Contenido Central (Logo / Texto) */}
      <div className="relative z-20 flex flex-col items-center justify-center h-full text-center px-4">
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8, ease: "outBack" }}
          className="relative"
        >
          {/* Contenedor del Logo / Imagen PNG superpuesta */}
          {overlayImage ? (
            <motion.img 
              src={overlayImage} 
              alt="App Logo"
              className="h-32 md:h-40 object-contain drop-shadow-[0_0_15px_rgba(255,255,255,0.4)]"
              animate={{ y: [0, -10, 0] }} // Flotación suave
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            />
          ) : (
             // Placeholder si no hay imagen de overlay
            <div className="bg-white/10 backdrop-blur-md border border-white/20 p-6 rounded-2xl shadow-xl">
              <Sparkles className="w-16 h-16 text-yellow-300 mx-auto mb-2" />
              <h1 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-200 via-white to-purple-200 tracking-tighter">
                {title}
              </h1>
            </div>
          )}
        </motion.div>

        {/* Subtítulo opcional */}
        {subtitle && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 1 }}
            className="mt-4 text-white/90 text-sm md:text-lg font-light tracking-widest uppercase drop-shadow-md"
          >
            {subtitle}
          </motion.p>
        )}
      </div>

      {/* Bordes decorativos estilo UI futurista (Opcional) */}
      <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-blue-500/50 to-transparent z-30" />
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/20 to-transparent z-30" />
    </div>
  );
};

// --- App Principal para demostrar el uso ---

export default function App() {
  // NOTA PARA EL USUARIO:
  // Aquí es donde conectarías tus archivos subidos.
  // He usado URLs de ejemplo por si los archivos locales no se renderizan en esta vista previa,
  // pero he dejado comentado el código para usar tus archivos.
  
  // Opción A: Usando tus archivos (Descomenta esto en tu proyecto real)
  // const bgImage = "./1767956770696.jpg";
  // const overlayImage = "./1000092157.png";

  // Opción B: Fallback para esta demo (Unsplash)
  const bgImage = "https://images.unsplash.com/photo-1462331940025-496dfbfc7564?q=80&w=2622&auto=format&fit=crop"; 
  // const overlayImage = null; // Pon null para ver el texto por defecto, o una URL de PNG

  // Simulamos tu PNG con un logo placeholder, ya que no puedo leer el archivo local directamente en el iframe
  const overlayImage = "https://cdn-icons-png.flaticon.com/512/3163/3163246.png"; 

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 font-sans selection:bg-purple-500 selection:text-white">
      
      {/* Navbar simulado */}
      <nav className="p-4 border-b border-white/10 flex justify-between items-center mb-8 bg-black/50 backdrop-blur-sm sticky top-0 z-50">
        <span className="font-bold text-xl tracking-tight">CosmosApp</span>
        <button className="px-4 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-sm transition-colors">
          Menú
        </button>
      </nav>

      <main className="container mx-auto px-4 pb-20">
        
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-4 text-purple-300">Vista Previa del Banner</h2>
          <p className="text-gray-400 mb-6 max-w-2xl">
            Este componente es totalmente responsivo. Mantiene una altura de 280-300px mientras 
            centra la imagen de fondo (ideal para assets 10:1) y añade efectos de partículas.
          </p>
        </div>

        {/* --- AQUÍ ESTÁ EL COMPONENTE QUE PEDISTE --- */}
        <CosmicBanner 
          bgImage={bgImage}
          overlayImage={overlayImage}
          title="GALAXY ONE"
          subtitle="Tu viaje comienza aquí"
        />
        {/* ------------------------------------------- */}

        {/* Sección de contenido simulada para ver como queda integrado */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((item) => (
            <div key={item} className="bg-gray-800/50 p-6 rounded-2xl border border-white/5 hover:border-purple-500/30 transition-colors cursor-pointer group">
              <div className="w-12 h-12 rounded-full bg-purple-900/30 flex items-center justify-center mb-4 text-purple-400 group-hover:scale-110 transition-transform">
                <Star size={20} fill="currentColor" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Característica {item}</h3>
              <p className="text-gray-400 text-sm">
                Descripción breve de la funcionalidad de la app debajo del banner espectacular.
              </p>
            </div>
          ))}
        </div>

      </main>
    </div>
  );
}