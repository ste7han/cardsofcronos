'use client';

import React, { useEffect, useRef, useState } from 'react';

interface Star {
  x: number;
  y: number;
  size: number;
  opacity: number;
  speed: number;
  twinkleSpeed: number;
  twinkleDirection: number;
  layer: number; // For parallax effect
}

interface Nebula {
  x: number;
  y: number;
  radius: number;
  opacity: number;
  color: string;
  pulseSpeed: number;
  pulseDirection: number;
  currentRadius: number;
}

interface Constellation {
  stars: { x: number; y: number }[];
  lines: { from: number; to: number }[];
  opacity: number;
  fadeDirection: number;
  fadeSpeed: number;
}

interface Hexagon {
  x: number;
  y: number;
  size: number;
  rotation: number;
  rotationSpeed: number;
  opacity: number;
  pulseSpeed: number;
  pulseDirection: number;
  borderColor: string;
}

interface ArcaneRune {
  x: number;
  y: number;
  symbol: string;
  size: number;
  opacity: number;
  fadeSpeed: number;
  fadeDirection: number;
  rotation: number;
  rotationSpeed: number;
}

const StarryBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const starsRef = useRef<Star[]>([]);
  const nebulaeRef = useRef<Nebula[]>([]);
  const constellationsRef = useRef<Constellation[]>([]);
  const hexagonsRef = useRef<Hexagon[]>([]);
  const [mousePosition, setMousePosition] = useState<{ x: number; y: number } | null>(null);
  const arcaneRunesRef = useRef<ArcaneRune[]>([]);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Set canvas to full screen with device pixel ratio for sharper rendering
    const resizeCanvas = () => {
      const pixelRatio = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * pixelRatio;
      canvas.height = window.innerHeight * pixelRatio;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.scale(pixelRatio, pixelRatio);
    };
    
    // Initialize stars with parallax layers
    const initStars = () => {
      const stars: Star[] = [];
      // More stars for a denser cosmic feel
      const starCount = Math.floor(window.innerWidth * window.innerHeight / 1500);
      
      for (let i = 0; i < starCount; i++) {
        // Assign different layers for parallax effect (1-3)
        const layer = Math.floor(Math.random() * 3) + 1;
        stars.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          // Larger stars in front layers
          size: Math.random() * (4 - layer) + 0.5,
          opacity: Math.random() * 0.8 + 0.2,
          // Faster movement for front layers
          speed: (Math.random() * 0.05 + 0.01) / layer,
          twinkleSpeed: Math.random() * 0.01 + 0.005,
          twinkleDirection: Math.random() > 0.5 ? 1 : -1,
          layer
        });
      }
      
      starsRef.current = stars;
    };
    
    // Initialize nebulae
    const initNebulae = () => {
      const nebulae: Nebula[] = [];
      const nebulaCount = Math.floor(window.innerWidth / 500) + 1; // Adjust based on screen size
      
      const colors = [
        'rgba(157, 78, 221, opacity)', // Purple
        'rgba(30, 39, 97, opacity)',   // Cosmic blue
        'rgba(247, 37, 133, opacity)', // Nebula pink
        'rgba(58, 12, 163, opacity)'   // Deep purple
      ];
      
      for (let i = 0; i < nebulaCount; i++) {
        const radius = Math.random() * 200 + 100;
        nebulae.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          radius,
          currentRadius: radius,
          opacity: Math.random() * 0.15 + 0.05,
          color: colors[Math.floor(Math.random() * colors.length)],
          pulseSpeed: Math.random() * 0.002 + 0.001,
          pulseDirection: Math.random() > 0.5 ? 1 : -1
        });
      }
      
      nebulaeRef.current = nebulae;
    };
    
    // Initialize constellations
    const initConstellations = () => {
      const constellations: Constellation[] = [];
      const constellationCount = Math.floor(window.innerWidth / 800) + 1;
      
      for (let i = 0; i < constellationCount; i++) {
        // Create a constellation with 4-7 stars
        const starCount = Math.floor(Math.random() * 4) + 4;
        const stars = [];
        
        // Center point of constellation
        const centerX = Math.random() * canvas.width;
        const centerY = Math.random() * canvas.height;
        
        // Create stars around center
        for (let j = 0; j < starCount; j++) {
          stars.push({
            x: centerX + (Math.random() - 0.5) * 200,
            y: centerY + (Math.random() - 0.5) * 200
          });
        }
        
        // Create lines between stars
        const lines = [];
        for (let j = 0; j < starCount - 1; j++) {
          lines.push({ from: j, to: j + 1 });
          
          // Add some random connections for more complex shapes
          if (Math.random() > 0.7 && j > 1) {
            lines.push({ from: j, to: Math.floor(Math.random() * j) });
          }
        }
        
        constellations.push({
          stars,
          lines,
          opacity: 0,
          fadeDirection: 1,
          fadeSpeed: Math.random() * 0.005 + 0.001
        });
      }
      
      constellationsRef.current = constellations;
    };
    
    // Initialize hexagons (Cronos-inspired)
    const initHexagons = () => {
      const hexagons: Hexagon[] = [];
      const hexagonCount = Math.floor(window.innerWidth / 400) + 2;
      
      // Colors for hexagon borders
      const colors = [
        'rgba(157, 78, 221, opacity)', // Purple
        'rgba(255, 215, 0, opacity)',  // Gold
        'rgba(247, 37, 133, opacity)', // Nebula pink
      ];
      
      for (let i = 0; i < hexagonCount; i++) {
        hexagons.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          size: Math.random() * 40 + 20,
          rotation: Math.random() * Math.PI,
          rotationSpeed: (Math.random() - 0.5) * 0.001,
          opacity: Math.random() * 0.2 + 0.1,
          pulseSpeed: Math.random() * 0.005 + 0.002,
          pulseDirection: Math.random() > 0.5 ? 1 : -1,
          borderColor: colors[Math.floor(Math.random() * colors.length)]
        });
      }
      
      hexagonsRef.current = hexagons;
    };
    
    // Initialize arcane runes
    const initArcaneRunes = () => {
      const runes: ArcaneRune[] = [];
      const runeCount = Math.floor(window.innerWidth / 500) + 2;
      const runeSymbols = ['✧', '⚝', '⚜', '✦', '✴', '❈'];
      
      for (let i = 0; i < runeCount; i++) {
        runes.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          symbol: runeSymbols[Math.floor(Math.random() * runeSymbols.length)],
          size: Math.random() * 20 + 10,
          opacity: 0,
          fadeSpeed: Math.random() * 0.005 + 0.001,
          fadeDirection: 1,
          rotation: Math.random() * Math.PI * 2,
          rotationSpeed: (Math.random() - 0.5) * 0.002
        });
      }
      
      arcaneRunesRef.current = runes;
    };
    
    // Draw hexagon
    const drawHexagon = (ctx: CanvasRenderingContext2D, hexagon: Hexagon) => {
      const { x, y, size, rotation, opacity, borderColor } = hexagon;
      
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = rotation + (Math.PI * 2 * i / 6);
        const pointX = x + size * Math.cos(angle);
        const pointY = y + size * Math.sin(angle);
        
        if (i === 0) {
          ctx.moveTo(pointX, pointY);
        } else {
          ctx.lineTo(pointX, pointY);
        }
      }
      ctx.closePath();
      
      // Draw border with custom color
      ctx.strokeStyle = borderColor.replace('opacity', opacity.toString());
      ctx.lineWidth = 1;
      ctx.stroke();
      
      // Add subtle inner glow
      ctx.strokeStyle = borderColor.replace('opacity', (opacity * 0.3).toString());
      ctx.lineWidth = 0.5;
      
      // Draw inner hexagon
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = rotation + (Math.PI * 2 * i / 6);
        const pointX = x + (size * 0.8) * Math.cos(angle);
        const pointY = y + (size * 0.8) * Math.sin(angle);
        
        if (i === 0) {
          ctx.moveTo(pointX, pointY);
        } else {
          ctx.lineTo(pointX, pointY);
        }
      }
      ctx.closePath();
      ctx.stroke();
    };
    
    // Handle mouse movement for parallax effect
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    
    // Draw everything
    const draw = () => {
      if (!ctx || !canvas) return;
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Create cosmic gradient background
      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      gradient.addColorStop(0, '#0A0818'); // Cosmic black
      gradient.addColorStop(0.5, '#1A1133'); // Deep space purple
      gradient.addColorStop(1, '#0A0A23'); // Dark blue
      
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Draw nebulae
      nebulaeRef.current.forEach(nebula => {
        // Update nebula pulsing
        nebula.currentRadius += nebula.pulseSpeed * nebula.pulseDirection;
        if (nebula.currentRadius > nebula.radius * 1.2 || nebula.currentRadius < nebula.radius * 0.8) {
          nebula.pulseDirection *= -1;
        }
        
        const gradient = ctx.createRadialGradient(
          nebula.x, nebula.y, 0,
          nebula.x, nebula.y, nebula.currentRadius
        );
        
        const color = nebula.color.replace('opacity', nebula.opacity.toString());
        gradient.addColorStop(0, color);
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(nebula.x, nebula.y, nebula.currentRadius, 0, Math.PI * 2);
        ctx.fill();
      });
      
      // Draw hexagons
      hexagonsRef.current.forEach(hexagon => {
        // Update hexagon rotation and pulsing
        hexagon.rotation += hexagon.rotationSpeed;
        hexagon.opacity += hexagon.pulseSpeed * hexagon.pulseDirection;
        
        if (hexagon.opacity > 0.3 || hexagon.opacity < 0.1) {
          hexagon.pulseDirection *= -1;
        }
        
        drawHexagon(ctx, hexagon);
      });
      
      // Draw arcane runes
      arcaneRunesRef.current.forEach(rune => {
        // Update rune fading and rotation
        rune.opacity += rune.fadeSpeed * rune.fadeDirection;
        rune.rotation += rune.rotationSpeed;
        
        if (rune.opacity > 0.8) {
          rune.fadeDirection = -1;
        } else if (rune.opacity < 0) {
          rune.fadeDirection = 1;
          
          // Move rune to a new position
          rune.x = Math.random() * canvas.width;
          rune.y = Math.random() * canvas.height;
        }
        
        if (rune.opacity > 0) {
          // Draw rune
          ctx.save();
          ctx.translate(rune.x, rune.y);
          ctx.rotate(rune.rotation);
          
          // Glow effect
          if (rune.opacity > 0.5) {
            ctx.shadowColor = '#FFD700';
            ctx.shadowBlur = 10;
          }
          
          ctx.font = `${rune.size}px serif`;
          ctx.fillStyle = `rgba(255, 215, 0, ${rune.opacity})`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(rune.symbol, 0, 0);
          
          ctx.restore();
        }
      });
      
      // Draw constellations
      constellationsRef.current.forEach(constellation => {
        // Update constellation fading
        constellation.opacity += constellation.fadeSpeed * constellation.fadeDirection;
        
        if (constellation.opacity > 0.8) {
          constellation.fadeDirection = -1;
        } else if (constellation.opacity < 0) {
          constellation.fadeDirection = 1;
          
          // Regenerate constellation in a new position
          const centerX = Math.random() * canvas.width;
          const centerY = Math.random() * canvas.height;
          
          constellation.stars.forEach(star => {
            star.x = centerX + (Math.random() - 0.5) * 200;
            star.y = centerY + (Math.random() - 0.5) * 200;
          });
        }
        
        // Draw constellation lines
        if (constellation.opacity > 0) {
          ctx.strokeStyle = `rgba(255, 215, 0, ${constellation.opacity * 0.3})`;
          ctx.lineWidth = 0.5;
          
          constellation.lines.forEach(line => {
            const fromStar = constellation.stars[line.from];
            const toStar = constellation.stars[line.to];
            
            ctx.beginPath();
            ctx.moveTo(fromStar.x, fromStar.y);
            ctx.lineTo(toStar.x, toStar.y);
            ctx.stroke();
          });
          
          // Draw constellation stars
          constellation.stars.forEach(star => {
            ctx.beginPath();
            ctx.arc(star.x, star.y, 1.5, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 215, 0, ${constellation.opacity})`;
            ctx.fill();
          });
        }
      });
      
      // Apply parallax effect based on mouse position
      const parallaxOffset = mousePosition ? {
        x: (mousePosition.x - window.innerWidth / 2) / 50,
        y: (mousePosition.y - window.innerHeight / 2) / 50
      } : { x: 0, y: 0 };
      
      // Draw stars with parallax effect
      starsRef.current.forEach(star => {
        // Calculate parallax offset based on star layer
        const layerOffset = {
          x: parallaxOffset.x / star.layer,
          y: parallaxOffset.y / star.layer
        };
        
        const drawX = star.x + layerOffset.x;
        const drawY = star.y + layerOffset.y;
        
        // Draw star with glow for larger stars
        if (star.size > 1.5) {
          // Add glow
          const glow = ctx.createRadialGradient(
            drawX, drawY, 0,
            drawX, drawY, star.size * 2
          );
          
          glow.addColorStop(0, `rgba(255, 255, 255, ${star.opacity})`);
          glow.addColorStop(1, 'rgba(255, 255, 255, 0)');
          
          ctx.beginPath();
          ctx.arc(drawX, drawY, star.size * 2, 0, Math.PI * 2);
          ctx.fillStyle = glow;
          ctx.fill();
        }
        
        // Draw star core
        ctx.beginPath();
        ctx.arc(drawX, drawY, star.size, 0, Math.PI * 2);
        
        // Different colors for some stars
        if (star.layer === 1 && Math.random() > 0.7) {
          ctx.fillStyle = `rgba(255, 215, 0, ${star.opacity})`; // Gold
        } else if (star.layer === 2 && Math.random() > 0.8) {
          ctx.fillStyle = `rgba(157, 78, 221, ${star.opacity})`; // Purple
        } else {
          ctx.fillStyle = `rgba(255, 255, 255, ${star.opacity})`;
        }
        
        ctx.fill();
        
        // Update star opacity for twinkling effect
        star.opacity += star.twinkleSpeed * star.twinkleDirection;
        
        // Reverse direction if opacity reaches limits
        if (star.opacity >= 1 || star.opacity <= 0.2) {
          star.twinkleDirection *= -1;
        }
        
        // Move star slightly
        star.y += star.speed;
        
        // Reset star if it goes off screen
        if (star.y > canvas.height) {
          star.y = 0;
          star.x = Math.random() * canvas.width;
        }
      });
      
      // Draw occasional shooting stars
      if (Math.random() < 0.01) {
        const shootingStar = {
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height / 3,
          length: Math.random() * 100 + 50,
          angle: Math.PI / 4 + Math.random() * Math.PI / 8,
          opacity: Math.random() * 0.7 + 0.3,
          width: Math.random() * 3 + 1
        };
        
        ctx.beginPath();
        ctx.moveTo(shootingStar.x, shootingStar.y);
        ctx.lineTo(
          shootingStar.x + Math.cos(shootingStar.angle) * shootingStar.length,
          shootingStar.y + Math.sin(shootingStar.angle) * shootingStar.length
        );
        
        const gradient = ctx.createLinearGradient(
          shootingStar.x, shootingStar.y,
          shootingStar.x + Math.cos(shootingStar.angle) * shootingStar.length,
          shootingStar.y + Math.sin(shootingStar.angle) * shootingStar.length
        );
        
        gradient.addColorStop(0, `rgba(255, 255, 255, ${shootingStar.opacity})`);
        gradient.addColorStop(0.1, `rgba(255, 215, 0, ${shootingStar.opacity})`);
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        
        ctx.strokeStyle = gradient;
        ctx.lineWidth = shootingStar.width;
        ctx.stroke();
        
        // Add glow effect
        ctx.beginPath();
        ctx.moveTo(shootingStar.x, shootingStar.y);
        ctx.lineTo(
          shootingStar.x + Math.cos(shootingStar.angle) * shootingStar.length,
          shootingStar.y + Math.sin(shootingStar.angle) * shootingStar.length
        );
        
        ctx.strokeStyle = `rgba(255, 255, 255, ${shootingStar.opacity * 0.3})`;
        ctx.lineWidth = shootingStar.width * 3;
        ctx.stroke();
      }
      
      requestAnimationFrame(draw);
    };
    
      window.addEventListener('resize', () => {
      resizeCanvas();
      initStars();
      initNebulae();
      initConstellations();
      initHexagons();
      initArcaneRunes();
    });
    
    window.addEventListener('mousemove', handleMouseMove);
    
    resizeCanvas();
    initStars();
    initNebulae();
    initConstellations();
    initHexagons();
    initArcaneRunes();
    draw();
    
    return () => {
      window.removeEventListener('resize', resizeCanvas);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);
  
  return (
    <canvas
      ref={canvasRef}
      className="fixed top-0 left-0 w-full h-full -z-10"
      style={{ pointerEvents: 'none' }}
    />
  );
};

export default StarryBackground;
