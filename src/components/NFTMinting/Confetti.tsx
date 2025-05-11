'use client';

import { useEffect, useRef } from 'react';

interface ConfettiProps {
  active: boolean;
  duration?: number;
}

const Confetti: React.FC<ConfettiProps> = ({ active, duration = 5000 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const confettiPiecesRef = useRef<any[]>([]);
  const startTimeRef = useRef<number | null>(null);

  // Initialize confetti pieces
  useEffect(() => {
    if (!active) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas dimensions
    const setCanvasDimensions = () => {
      if (canvas) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      }
    };

    // Create confetti pieces
    const createConfettiPieces = () => {
      const pieces = [];
      const colors = [
        '#9D4EDD', // Purple
        '#FFD700', // Gold
        '#FF5E5B', // Coral
        '#3A0CA3', // Deep Purple
        '#4CC9F0', // Cyan
        '#F72585', // Pink
      ];
      const shapes = ['circle', 'square', 'triangle', 'star'];
      
      for (let i = 0; i < 150; i++) {
        pieces.push({
          x: Math.random() * canvas.width,
          y: -20 - Math.random() * 100, // Start above the viewport
          size: Math.random() * 10 + 5,
          color: colors[Math.floor(Math.random() * colors.length)],
          shape: shapes[Math.floor(Math.random() * shapes.length)],
          speedX: Math.random() * 6 - 3,
          speedY: Math.random() * 3 + 2,
          rotation: Math.random() * 360,
          rotationSpeed: Math.random() * 10 - 5,
          opacity: 1,
        });
      }
      
      return pieces;
    };

    // Draw a confetti piece
    const drawConfettiPiece = (ctx: CanvasRenderingContext2D, piece: any) => {
      ctx.save();
      ctx.translate(piece.x, piece.y);
      ctx.rotate((piece.rotation * Math.PI) / 180);
      ctx.globalAlpha = piece.opacity;
      ctx.fillStyle = piece.color;
      
      switch (piece.shape) {
        case 'circle':
          ctx.beginPath();
          ctx.arc(0, 0, piece.size / 2, 0, Math.PI * 2);
          ctx.fill();
          break;
        case 'square':
          ctx.fillRect(-piece.size / 2, -piece.size / 2, piece.size, piece.size);
          break;
        case 'triangle':
          ctx.beginPath();
          ctx.moveTo(0, -piece.size / 2);
          ctx.lineTo(piece.size / 2, piece.size / 2);
          ctx.lineTo(-piece.size / 2, piece.size / 2);
          ctx.closePath();
          ctx.fill();
          break;
        case 'star':
          const spikes = 5;
          const outerRadius = piece.size / 2;
          const innerRadius = piece.size / 4;
          
          ctx.beginPath();
          for (let i = 0; i < spikes * 2; i++) {
            const radius = i % 2 === 0 ? outerRadius : innerRadius;
            const angle = (i * Math.PI) / spikes;
            ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
          }
          ctx.closePath();
          ctx.fill();
          break;
      }
      
      ctx.restore();
    };

    // Animation loop
    const animate = (timestamp: number) => {
      if (!startTimeRef.current) {
        startTimeRef.current = timestamp;
      }
      
      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);
      
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Update and draw confetti pieces
      for (let i = 0; i < confettiPiecesRef.current.length; i++) {
        const piece = confettiPiecesRef.current[i];
        
        // Update position
        piece.x += piece.speedX;
        piece.y += piece.speedY;
        piece.rotation += piece.rotationSpeed;
        
        // Add gravity and wind effect
        piece.speedY += 0.1;
        piece.speedX += Math.random() * 0.2 - 0.1;
        
        // Fade out based on progress
        if (progress > 0.7) {
          piece.opacity = Math.max(0, 1 - (progress - 0.7) / 0.3);
        }
        
        // Draw the piece
        drawConfettiPiece(ctx, piece);
        
        // Reset if out of bounds
        if (piece.y > canvas.height + 20) {
          piece.y = -20;
          piece.x = Math.random() * canvas.width;
        }
      }
      
      // Continue animation if not complete
      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        // Reset for next time
        startTimeRef.current = null;
      }
    };

    // Initialize
    setCanvasDimensions();
    window.addEventListener('resize', setCanvasDimensions);
    confettiPiecesRef.current = createConfettiPieces();
    animationFrameRef.current = requestAnimationFrame(animate);

    // Cleanup
    return () => {
      window.removeEventListener('resize', setCanvasDimensions);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [active, duration]);

  if (!active) return null;

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-50"
      style={{ width: '100%', height: '100%' }}
    />
  );
};

export default Confetti;