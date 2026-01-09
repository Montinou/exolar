"use client";

import React, { useRef, useEffect } from "react";

interface StarfieldCanvasProps {
  numStars?: number;
  className?: string;
}

interface Star {
  x: number;
  y: number;
  radius: number;
  baseAlpha: number;
  twinkleSpeed: number;
  twinklePhase: number;
}

export function StarfieldCanvas({
  numStars = 500,
  className = "",
}: StarfieldCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;

    // Check for reduced motion preference
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    const resizeCanvas = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      canvas.width = parent.offsetWidth;
      canvas.height = parent.offsetHeight;
    };

    resizeCanvas();

    const width = canvas.width;
    const height = canvas.height;

    // Initialize stars with randomized breathing parameters
    const stars: Star[] = [];
    for (let i = 0; i < numStars; i++) {
      // 80% small stars, 15% medium, 5% large bright stars
      const rand = Math.random();
      let radius: number;
      let baseAlpha: number;

      if (rand < 0.8) {
        // Small stars
        radius = Math.random() * 0.5 + 0.4; // 0.4-0.9px
        baseAlpha = Math.random() * 0.5 + 0.5; // 0.5-1.0
      } else if (rand < 0.95) {
        // Medium stars - brighter
        radius = Math.random() * 0.5 + 0.9; // 0.9-1.4px
        baseAlpha = Math.random() * 0.3 + 0.7; // 0.7-1.0
      } else {
        // Large bright stars - very visible
        radius = Math.random() * 0.6 + 1.4; // 1.4-2.0px
        baseAlpha = 1.0; // Always full brightness base
      }

      stars.push({
        x: Math.random() * width,
        y: Math.random() * height,
        radius,
        baseAlpha,
        // Wide range of twinkle speeds for varied breathing
        twinkleSpeed: Math.random() * 0.04 + 0.005, // 0.005-0.045 (faster)
        // Random starting phase so they don't sync
        twinklePhase: Math.random() * Math.PI * 2,
      });
    }

    const render = () => {
      // Clear with transparency (parent has bg-black)
      ctx.clearRect(0, 0, width, height);

      // Render stars with breathing effect
      stars.forEach((star) => {
        if (!prefersReducedMotion) {
          star.twinklePhase += star.twinkleSpeed;
        }

        // Calculate breathing alpha with wider amplitude (0.7) for more dramatic effect
        const twinkle = Math.sin(star.twinklePhase) * 0.7;
        const currentAlpha = Math.max(
          0.05,
          Math.min(1, star.baseAlpha + twinkle)
        );

        // Pure white stars
        ctx.fillStyle = `rgba(255, 255, 255, ${currentAlpha})`;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
        ctx.fill();
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    // Handle resize
    const handleResize = () => {
      resizeCanvas();
    };
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
    };
  }, [numStars]);

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 z-0 ${className}`}
    />
  );
}

export default StarfieldCanvas;
