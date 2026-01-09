import React, { useRef, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';

export default function App() {
  return (
    <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-6 font-sans">
      <div className="w-full max-w-4xl">
        <Banner />
      </div>
      <p className="mt-4 text-neutral-600 text-xs text-center uppercase tracking-widest">
        Electricidad Caótica: Rayos zigzagueantes y aleatorios
      </p>
    </div>
  );
}

// --- COMPONENTE PRINCIPAL ---
function Banner() {
  return (
    <div className="relative w-full h-[300px] overflow-hidden rounded-xl bg-black border border-white/10 shadow-2xl group isolate">
      {/* 1. Fondo de Estrellas */}
      <Starfield />

      {/* 2. Atmósfera / Vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(10,20,30,0.4),rgba(0,0,0,1)_90%)] z-10 pointer-events-none" />
      
      {/* 3. Contenido Central */}
      <div className="relative z-20 w-full h-full flex flex-col items-center justify-center pt-4">
        
        {/* LOGO ELÉCTRICO ZIG-ZAG */}
        <div className="mb-6 scale-125">
          <CyberEclipseZigZag />
        </div>

        {/* TEXTO PRINCIPAL */}
        <motion.h1 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="text-6xl md:text-7xl font-black tracking-tighter leading-none relative z-20"
        >
          {/* Sombra de texto */}
          <span className="absolute inset-0 text-transparent bg-clip-text bg-gradient-to-b from-white/10 to-transparent blur-sm transform translate-y-2 pointer-events-none" aria-hidden="true">
            EXOLAR
          </span>
          {/* Gradiente Principal */}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-cyan-200 to-orange-500 drop-shadow-[0_0_25px_rgba(34,211,238,0.2)]">
            EXOLAR
          </span>
        </motion.h1>

        {/* SUBTEXTO */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.5 }}
          className="mt-2 flex items-center justify-center gap-4 w-full"
        >
          <div className="h-[1px] w-12 bg-gradient-to-r from-transparent via-cyan-900 to-transparent opacity-50"></div>
          <p className="text-slate-400 text-[10px] md:text-xs font-bold tracking-[0.4em] uppercase text-shadow-sm">
            Testing Dashboard
          </p>
          <div className="h-[1px] w-12 bg-gradient-to-r from-transparent via-orange-900 to-transparent opacity-50"></div>
        </motion.div>

      </div>
    </div>
  );
}

// --- LOGO: ECLIPSE CON RAYOS ZIGZAGUEANTES ---
function CyberEclipseZigZag() {
  
  // Animación de fondo (Respiración)
  const breathingTransition = {
    duration: 5,
    repeat: Infinity,
    repeatType: "mirror",
    ease: "easeInOut"
  };

  return (
    <motion.div 
      className="relative w-24 h-24 flex items-center justify-center"
      animate={{ y: [-5, 5, -5] }}
      transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
    >
      
      {/* 1. LADO HIELO (Fondo) */}
      <motion.div 
        className="absolute -top-2 -left-2 w-20 h-20 bg-cyan-500 rounded-full blur-[35px] mix-blend-screen opacity-40"
        animate={{ scale: [0.9, 1.1], opacity: [0.3, 0.5] }}
        transition={breathingTransition}
      />

      {/* 2. LADO FUEGO (Fondo) */}
      <motion.div 
        className="absolute -bottom-2 -right-2 w-20 h-20 bg-orange-600 rounded-full blur-[35px] mix-blend-screen opacity-40"
        animate={{ scale: [0.9, 1.1], opacity: [0.3, 0.6] }}
        transition={{ ...breathingTransition, delay: 2.5 }}
      />

      {/* 3. CUERPO DEL ECLIPSE */}
      <div className="relative w-16 h-16 rounded-full bg-black z-10 shadow-2xl overflow-hidden isolate">
        
        {/* Borde Metálico Dual */}
        <div 
            className="absolute inset-0 rounded-full opacity-100 pointer-events-none border-[2px] border-transparent z-20"
            style={{
                background: "linear-gradient(135deg, #06b6d4, #000000 40%, #000000 60%, #f97316) border-box",
                WebkitMask: "linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0)",
                WebkitMaskComposite: "xor",
                maskComposite: "exclude"
            }}
        />
        
        {/* INTERIOR: RAYOS ZIG-ZAG */}
        <div className="absolute inset-0 w-full h-full z-10">
            {/* Rayo Cyan 1 - Lento y espaciado */}
            <ZigZagBolt color="#22d3ee" delay={1} duration={6} />
            
            {/* Rayo Naranja - En contra-tiempo */}
            <ZigZagBolt color="#f97316" delay={4.5} duration={7} />
            
            {/* Rayo Blanco Central - Muy raro y rápido */}
            <ZigZagBolt color="#ffffff" delay={2} duration={10} strokeWidth={1.5} />
        </div>

        {/* Oscurecimiento interno para profundidad */}
        <div className="absolute inset-0 bg-[radial-gradient(circle,transparent_20%,black_100%)] z-10 pointer-events-none" />
      </div>

    </motion.div>
  );
}

// Componente para generar un Rayo Zig-Zag SVG Aleatorio
function ZigZagBolt({ color, delay, duration, strokeWidth = 2 }) {
    // Generamos una forma aleatoria única para este componente
    // Un camino que cruza de izquierda (0, 50) a derecha (100, 50) con ruido en Y
    const pathData = useMemo(() => {
        let d = "M -10,50 "; // Empezar fuera
        const segments = 6; // Número de quiebres
        for (let i = 1; i <= segments; i++) {
            const x = (i / segments) * 120 - 10;
            // Desviación aleatoria vertical (jitter) fuerte
            const jitter = (Math.random() - 0.5) * 50; 
            d += `L ${x},${50 + jitter} `;
        }
        return d;
    }, []);

    // Rotación aleatoria inicial para que no siempre sea horizontal
    const rotation = useMemo(() => Math.random() * 360, []);

    return (
        <motion.div
            className="absolute inset-0 w-full h-full flex items-center justify-center pointer-events-none"
            style={{ rotate: rotation }}
        >
            <motion.svg
                viewBox="0 0 100 100"
                className="w-[140%] h-[140%] overflow-visible" // Más grande para cubrir rotaciones
                initial={{ opacity: 0 }}
                animate={{ 
                    opacity: [0, 1, 0, 0, 0.8, 0], // Doble flash rápido
                    pathLength: [0, 1] // Efecto de dibujo rápido opcional
                }} 
                transition={{
                    duration: 0.4, // El flash dura muy poco (golpe eléctrico)
                    times: [0, 0.1, 0.2, 0.3, 0.4, 1],
                    repeat: Infinity,
                    repeatDelay: duration, // Mucho tiempo de espera entre rayos
                    delay: delay,
                    ease: "linear"
                }}
            >
                <path 
                    d={pathData} 
                    stroke={color} 
                    strokeWidth={strokeWidth} 
                    fill="none" 
                    strokeLinecap="round" 
                    strokeLinejoin="bevel"
                    filter={`drop-shadow(0 0 4px ${color})`} // Glow del rayo
                />
            </motion.svg>
        </motion.div>
    );
}


// --- FONDO: CANVAS STARFIELD (Optimizado) ---
function Starfield() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationFrameId;
    const width = canvas.width = canvas.parentElement.offsetWidth;
    const height = canvas.height = canvas.parentElement.offsetHeight;

    const stars = [];
    const numStars = 300; 
    
    for (let i = 0; i < numStars; i++) {
      stars.push({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: Math.random() < 0.8 ? Math.random() * 0.8 : Math.random() * 1.5,
        alpha: Math.random() * 0.8 + 0.2,
        baseAlpha: Math.random() * 0.8 + 0.2,
        speed: Math.random() * 0.05 + 0.01,
        twinkleSpeed: Math.random() * 0.02 + 0.005,
        twinklePhase: Math.random() * Math.PI * 2
      });
    }

    let shootingStars = [];
    const createShootingStar = () => {
      const startX = Math.random() * width;
      const startY = Math.random() < 0.5 ? -10 : Math.random() * (height / 2);
      shootingStars.push({
        x: startX,
        y: startY,
        length: Math.random() * 80 + 50,
        speed: Math.random() * 10 + 15,
        angle: Math.PI / 4 + (Math.random() * 0.2 - 0.1),
        opacity: 1,
        life: 1
      });
    };

    const render = () => {
      ctx.clearRect(0, 0, width, height);
      const gradient = ctx.createRadialGradient(width/2, height/2, 0, width/2, height/2, width);
      gradient.addColorStop(0, 'rgba(10, 20, 30, 0)');
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0.2)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      stars.forEach(star => {
        star.twinklePhase += star.twinkleSpeed;
        const twinkle = Math.sin(star.twinklePhase) * 0.3;
        const currentAlpha = Math.max(0.1, Math.min(1, star.baseAlpha + twinkle));
        ctx.fillStyle = `rgba(220, 240, 255, ${currentAlpha})`;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
        ctx.fill();
        star.y -= star.speed; 
        if (star.y < 0) star.y = height;
      });

      if (Math.random() < 0.015) createShootingStar();

      for (let i = shootingStars.length - 1; i >= 0; i--) {
        const s = shootingStars[i];
        s.x += Math.cos(s.angle) * s.speed;
        s.y += Math.sin(s.angle) * s.speed;
        s.life -= 0.02;
        s.opacity = s.life;

        if (s.life > 0) {
          const endX = s.x - Math.cos(s.angle) * s.length;
          const endY = s.y - Math.sin(s.angle) * s.length;
          const grad = ctx.createLinearGradient(s.x, s.y, endX, endY);
          grad.addColorStop(0, `rgba(200, 255, 255, ${s.opacity})`);
          grad.addColorStop(1, `rgba(34, 211, 238, 0)`);
          ctx.beginPath();
          ctx.moveTo(s.x, s.y);
          ctx.lineTo(endX, endY);
          ctx.strokeStyle = grad;
          ctx.lineWidth = 2;
          ctx.lineCap = 'round';
          ctx.stroke();
        } else {
          shootingStars.splice(i, 1);
        }
        if (s.x > width + 100 || s.y > height + 100) shootingStars.splice(i, 1);
      }
      animationFrameId = requestAnimationFrame(render);
    };
    render();
    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 z-0 opacity-80" />;
}