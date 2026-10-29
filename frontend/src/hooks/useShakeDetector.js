import { useEffect, useRef } from 'react';

/**
 * Custom hook to detect vigorous device shaking.
 * Triggers onShake callback when phone is shaken 3 times within 1 second.
 */
export function useShakeDetector(onShake, options = {}) {
  const { threshold = 22, requiredShakes = 3, timeWindow = 1200, enabled = true } = options;

  const lastShakeTime = useRef(0);
  const shakeCount = useRef(0);
  const lastCoords = useRef({ x: 0, y: 0, z: 0 });
  const onShakeRef = useRef(onShake);

  useEffect(() => {
    onShakeRef.current = onShake;
  }, [onShake]);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    const handleMotion = (event) => {
      const acc = event.accelerationIncludingGravity || event.acceleration;
      if (!acc) return;

      const x = acc.x || 0;
      const y = acc.y || 0;
      const z = acc.z || 0;

      const deltaX = Math.abs(x - lastCoords.current.x);
      const deltaY = Math.abs(y - lastCoords.current.y);
      const deltaZ = Math.abs(z - lastCoords.current.z);

      lastCoords.current = { x, y, z };
      const totalChange = deltaX + deltaY + deltaZ;

      if (totalChange > threshold) {
        const now = Date.now();
        if (now - lastShakeTime.current < timeWindow) {
          shakeCount.current += 1;
        } else {
          shakeCount.current = 1;
        }
        lastShakeTime.current = now;

        if (shakeCount.current >= requiredShakes) {
          shakeCount.current = 0;
          if (typeof navigator !== 'undefined' && navigator.vibrate) {
            try {
              navigator.vibrate([200, 100, 250]);
            } catch (e) {}
          }
          if (onShakeRef.current) {
            onShakeRef.current();
          }
        }
      }
    };

    window.addEventListener('devicemotion', handleMotion);

    return () => {
      window.removeEventListener('devicemotion', handleMotion);
    };
  }, [threshold, requiredShakes, timeWindow, enabled]);
}
