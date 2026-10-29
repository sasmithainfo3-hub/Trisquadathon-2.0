import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ShieldAlert, AlertTriangle } from 'lucide-react';

/**
 * Mobile-friendly Hold-To-Activate Button
 * Requires user to press and hold for 1.5 seconds to trigger SOS.
 * Prevents accidental single taps and pocket triggers.
 */
export default function HoldToTriggerButton({
  onTrigger,
  label = 'HOLD FOR SOS',
  sublabel = 'Press & hold 1.5s',
  durationMs = 1500,
  className = '',
  size = 'default' // 'default' | 'compact' | 'large'
}) {
  const [progress, setProgress] = useState(0);
  const [isHolding, setIsHolding] = useState(false);
  const startTimeRef = useRef(null);
  const animFrameRef = useRef(null);
  const triggeredRef = useRef(false);

  const resetHold = useCallback(() => {
    setIsHolding(false);
    setProgress(0);
    startTimeRef.current = null;
    triggeredRef.current = false;
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
  }, []);

  const handleStart = (e) => {
    // Don't trigger context menu or dragging
    if (e.type === 'touchstart') {
      // Allow touch
    } else if (e.button !== 0) {
      return; // only left click
    }

    triggeredRef.current = false;
    setIsHolding(true);
    startTimeRef.current = Date.now();

    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(30);
      } catch (err) {}
    }

    const step = () => {
      if (!startTimeRef.current) return;
      const elapsed = Date.now() - startTimeRef.current;
      const currentProgress = Math.min((elapsed / durationMs) * 100, 100);
      setProgress(currentProgress);

      if (currentProgress >= 100) {
        if (!triggeredRef.current) {
          triggeredRef.current = true;
          if (typeof navigator !== 'undefined' && navigator.vibrate) {
            try {
              navigator.vibrate([100, 50, 200]);
            } catch (err) {}
          }
          onTrigger();
        }
        resetHold();
        return;
      }

      animFrameRef.current = requestAnimationFrame(step);
    };

    animFrameRef.current = requestAnimationFrame(step);
  };

  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  // Size styling
  const sizeClasses = {
    compact: 'px-3 py-1.5 text-xs font-black rounded-lg gap-1.5',
    default: 'px-5 py-2.5 text-xs sm:text-sm font-extrabold rounded-2xl gap-2',
    large: 'px-7 py-3.5 text-base font-black rounded-2xl gap-3'
  }[size] || 'px-5 py-2.5 text-xs sm:text-sm font-extrabold rounded-2xl gap-2';

  return (
    <div className="relative inline-flex items-center select-none touch-none">
      <button
        type="button"
        onMouseDown={handleStart}
        onMouseUp={resetHold}
        onMouseLeave={resetHold}
        onTouchStart={handleStart}
        onTouchEnd={resetHold}
        onTouchCancel={resetHold}
        onContextMenu={(e) => e.preventDefault()}
        className={`relative overflow-hidden flex items-center justify-center transition-all active:scale-95 cursor-pointer border border-rose-400/50 text-white shadow-xl ${
          isHolding
            ? 'bg-rose-700 shadow-rose-600/50 scale-95 ring-4 ring-rose-500/40'
            : 'bg-gradient-to-r from-rose-600 via-red-600 to-rose-700 hover:from-rose-500 hover:to-red-500 shadow-rose-950/60'
        } ${sizeClasses} ${className}`}
        title="Hold for 1.5 seconds to trigger Silent SOS"
      >
        {/* Dynamic progress fill overlay */}
        <div
          className="absolute inset-0 bg-red-950/90 transition-all pointer-events-none"
          style={{
            width: `${progress}%`,
            transition: isHolding ? 'none' : 'width 0.2s ease-out'
          }}
        />

        {/* Content */}
        <div className="relative z-10 flex items-center gap-2">
          {size === 'compact' ? (
            <AlertTriangle className={`w-3.5 h-3.5 ${isHolding ? 'animate-bounce text-amber-300' : 'text-white'}`} />
          ) : (
            <ShieldAlert className={`w-5 h-5 ${isHolding ? 'animate-ping-slow text-amber-300' : 'text-white'}`} />
          )}

          <div className="text-left leading-tight">
            <span className="block tracking-wider uppercase font-black">
              {isHolding ? (progress >= 95 ? 'ACTIVATING!' : `HOLD... ${Math.round(progress)}%`) : label}
            </span>
            {size !== 'compact' && sublabel && (
              <span className="block text-[10px] text-rose-200/80 font-normal">
                {isHolding ? 'Keep holding to confirm' : sublabel}
              </span>
            )}
          </div>
        </div>
      </button>
    </div>
  );
}
