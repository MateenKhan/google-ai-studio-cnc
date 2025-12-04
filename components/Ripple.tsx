import React, { useState, useCallback, useRef, useEffect } from 'react';

interface RippleEffect {
  id: number;
  x: number;
  y: number;
  size: number;
}

interface RippleProps {
  children: React.ReactNode;
  duration?: number;
  color?: string;
  disabled?: boolean;
}

const Ripple: React.FC<RippleProps> = ({ 
  children, 
  duration = 500, 
  color = 'rgba(255, 255, 255, 0.3)',
  disabled = false
}) => {
  const [ripples, setRipples] = useState<RippleEffect[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(0);

  // Check for reduced motion preference
  const prefersReducedMotion = useRef(
    typeof window !== 'undefined' 
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches 
      : false
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handleChange = (e: MediaQueryListEvent) => {
      prefersReducedMotion.current = e.matches;
    };
    
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const addRipple = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (disabled || prefersReducedMotion.current) return;

    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    // Calculate size to ensure ripple covers entire element
    const size = Math.max(rect.width, rect.height) * 2;

    const newRipple: RippleEffect = {
      id: nextId.current++,
      x,
      y,
      size
    };

    setRipples(prev => [...prev.slice(-2), newRipple]); // Keep max 3 ripples

    // Remove ripple after animation completes
    setTimeout(() => {
      setRipples(prev => prev.filter(r => r.id !== newRipple.id));
    }, duration);
  }, [duration, disabled]);

  return (
    <div
      ref={containerRef}
      onPointerDown={addRipple}
      style={{ position: 'relative', overflow: 'hidden' }}
      className="ripple-container"
    >
      {children}
      {ripples.map(ripple => (
        <span
          key={ripple.id}
          className="ripple-effect"
          style={{
            position: 'absolute',
            left: ripple.x,
            top: ripple.y,
            width: ripple.size,
            height: ripple.size,
            borderRadius: '50%',
            backgroundColor: color,
            transform: 'translate(-50%, -50%) scale(0)',
            animation: `ripple-animation ${duration}ms ease-out`,
            pointerEvents: 'none',
            zIndex: 0
          }}
        />
      ))}
      <style>{`
        @keyframes ripple-animation {
          0% {
            transform: translate(-50%, -50%) scale(0);
            opacity: 0.5;
          }
          50% {
            opacity: 0.3;
          }
          100% {
            transform: translate(-50%, -50%) scale(1);
            opacity: 0;
          }
        }

        .ripple-container > *:not(.ripple-effect) {
          position: relative;
          z-index: 1;
        }
      `}</style>
    </div>
  );
};

export default Ripple;
