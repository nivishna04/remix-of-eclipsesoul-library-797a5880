import { useEffect, useRef, useState } from "react";

/**
 * EclipseSoul signature cursor.
 * - Glowing eclipse core (dark disc with a fiery corona)
 * - Orbiting particles that trail behind
 * - Reacts to hover on interactive elements (expands + intensifies corona)
 * - Click ripple burst
 * Disabled on touch / coarse pointer devices.
 */
export function EclipseCursor() {
  const coreRef = useRef<HTMLDivElement>(null);
  const trailRefs = useRef<HTMLDivElement[]>([]);
  const [enabled, setEnabled] = useState(false);
  const [hot, setHot] = useState(false);
  const [bursts, setBursts] = useState<{ id: number; x: number; y: number }[]>([]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    if (coarse) return;
    setEnabled(true);

    const pos = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const trail = Array.from({ length: 6 }, () => ({ x: pos.x, y: pos.y }));

    const onMove = (e: PointerEvent) => {
      pos.x = e.clientX;
      pos.y = e.clientY;
      const t = e.target as HTMLElement | null;
      if (t) {
        const interactive = t.closest("a,button,[role='button'],input,textarea,select,label,summary,[data-cursor='hot']");
        setHot(!!interactive);
      }
    };
    const onDown = (e: PointerEvent) => {
      const id = Date.now() + Math.random();
      setBursts((b) => [...b, { id, x: e.clientX, y: e.clientY }]);
      setTimeout(() => setBursts((b) => b.filter((x) => x.id !== id)), 700);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onDown, { passive: true });

    let raf = 0;
    const tick = () => {
      if (coreRef.current) {
        coreRef.current.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0) translate(-50%, -50%)`;
      }
      // trail easing
      let prev = pos;
      for (let i = 0; i < trail.length; i++) {
        trail[i].x += (prev.x - trail[i].x) * (0.35 - i * 0.04);
        trail[i].y += (prev.y - trail[i].y) * (0.35 - i * 0.04);
        const el = trailRefs.current[i];
        if (el) el.style.transform = `translate3d(${trail[i].x}px, ${trail[i].y}px, 0) translate(-50%, -50%)`;
        prev = trail[i];
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    document.documentElement.classList.add("eclipse-cursor-active");

    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      cancelAnimationFrame(raf);
      document.documentElement.classList.remove("eclipse-cursor-active");
    };
  }, []);

  if (!enabled) return null;

  return (
    <>
      <style>{`
        html.eclipse-cursor-active,
        html.eclipse-cursor-active * { cursor: none !important; }
        @keyframes eclipse-orbit { to { transform: rotate(360deg); } }
        @keyframes eclipse-burst {
          0% { transform: translate(-50%, -50%) scale(0.2); opacity: 0.9; }
          100% { transform: translate(-50%, -50%) scale(3.2); opacity: 0; }
        }
        @keyframes eclipse-corona {
          0%, 100% { opacity: 0.85; filter: blur(6px); }
          50% { opacity: 1; filter: blur(9px); }
        }
        .eclipse-trail {
          position: fixed; left: 0; top: 0; pointer-events: none;
          width: 6px; height: 6px; border-radius: 9999px;
          background: radial-gradient(circle, oklch(0.72 0.28 25 / 0.9), transparent 70%);
          z-index: 9998;
          will-change: transform;
        }
      `}</style>

      {/* trailing embers */}
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          ref={(el) => { if (el) trailRefs.current[i] = el; }}
          className="eclipse-trail"
          style={{ opacity: 0.7 - i * 0.1, width: `${8 - i}px`, height: `${8 - i}px` }}
        />
      ))}

      {/* click bursts */}
      {bursts.map((b) => (
        <div
          key={b.id}
          style={{
            position: "fixed",
            left: b.x,
            top: b.y,
            width: 40,
            height: 40,
            borderRadius: "9999px",
            border: "2px solid oklch(0.72 0.28 25 / 0.8)",
            boxShadow: "0 0 30px oklch(0.72 0.28 25 / 0.7)",
            transform: "translate(-50%, -50%)",
            pointerEvents: "none",
            zIndex: 9999,
            animation: "eclipse-burst 0.7s ease-out forwards",
          }}
        />
      ))}

      {/* Core eclipse */}
      <div
        ref={coreRef}
        style={{
          position: "fixed",
          left: 0,
          top: 0,
          width: hot ? 44 : 26,
          height: hot ? 44 : 26,
          pointerEvents: "none",
          zIndex: 9999,
          transition: "width 180ms ease, height 180ms ease",
          willChange: "transform",
        }}
      >
        {/* corona */}
        <div
          style={{
            position: "absolute",
            inset: -14,
            borderRadius: "9999px",
            background:
              "radial-gradient(circle, oklch(0.72 0.28 25 / 0.9) 0%, oklch(0.6 0.25 25 / 0.55) 35%, transparent 70%)",
            animation: "eclipse-corona 2.4s ease-in-out infinite",
          }}
        />
        {/* orbiting particles */}
        <div
          style={{
            position: "absolute",
            inset: -10,
            animation: "eclipse-orbit 3.2s linear infinite",
          }}
        >
          {[0, 120, 240].map((deg) => (
            <span
              key={deg}
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                width: 4,
                height: 4,
                borderRadius: "9999px",
                background: "oklch(0.85 0.2 25)",
                boxShadow: "0 0 8px oklch(0.72 0.28 25)",
                transform: `rotate(${deg}deg) translate(${hot ? 26 : 18}px) translate(-50%, -50%)`,
                transformOrigin: "0 0",
              }}
            />
          ))}
        </div>
        {/* dark disc */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "9999px",
            background: "radial-gradient(circle at 35% 35%, oklch(0.18 0.02 25), oklch(0.05 0.005 25))",
            border: "1px solid oklch(0.72 0.28 25 / 0.85)",
            boxShadow: "inset 0 0 10px oklch(0.05 0 0), 0 0 18px oklch(0.72 0.28 25 / 0.55)",
          }}
        />
      </div>
    </>
  );
}
