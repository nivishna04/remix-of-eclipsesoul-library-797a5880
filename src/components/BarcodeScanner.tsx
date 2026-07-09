import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader, IScannerControls } from "@zxing/browser";
import { X, Camera, RotateCcw } from "lucide-react";

type Props = {
  open: boolean;
  onClose: () => void;
  onDetected: (text: string) => void;
  /** Window (ms) during which an identical scan is ignored. */
  debounceMs?: number;
};

export function BarcodeScanner({ open, onClose, onDetected, debounceMs = 1500 }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const lastRef = useRef<{ code: string; at: number }>({ code: "", at: 0 });
  const [error, setError] = useState<string | null>(null);
  const [lastSeen, setLastSeen] = useState<string | null>(null);
  const [tick, setTick] = useState(0); // bump to retry

  useEffect(() => {
    if (!open) return;
    setError(null);
    setLastSeen(null);
    lastRef.current = { code: "", at: 0 };
    const reader = new BrowserMultiFormatReader();
    let cancelled = false;

    (async () => {
      try {
        const devices = await BrowserMultiFormatReader.listVideoInputDevices();
        if (cancelled) return;
        const back = devices.find((d) => /back|rear|environment/i.test(d.label)) ?? devices[0];
        if (!back) throw new Error("No camera available");
        const controls = await reader.decodeFromVideoDevice(
          back.deviceId,
          videoRef.current!,
          (result, _err, ctrl) => {
            if (!result) return;
            const text = result.getText();
            const now = Date.now();
            // Debounce: same code within window → ignore.
            if (lastRef.current.code === text && now - lastRef.current.at < debounceMs) return;
            lastRef.current = { code: text, at: now };
            setLastSeen(text);
            onDetected(text);
            ctrl.stop();
            // Auto-dismiss the overlay shortly so a duplicate frame doesn't re-fire.
            setTimeout(() => onClose(), 150);
          },
        );
        controlsRef.current = controls;
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Camera unavailable");
      }
    })();

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [open, onClose, onDetected, debounceMs, tick]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur flex items-center justify-center p-4">
      <div className="w-full max-w-md card-surface rounded-xl border border-primary/40 overflow-hidden shadow-[0_0_40px_rgba(239,68,68,0.4)]">
        <div className="flex items-center gap-2 p-3 border-b border-border">
          <Camera className="w-4 h-4 text-primary" />
          <div className="text-sm font-semibold">Scan Book Barcode</div>
          <button onClick={() => setTick((t) => t + 1)} className="ml-auto p-1 rounded hover:bg-secondary" aria-label="Retry">
            <RotateCcw className="w-4 h-4" />
          </button>
          <button onClick={onClose} className="p-1 rounded hover:bg-secondary" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="relative aspect-video bg-black">
          <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3/4 h-1/3 border-2 border-primary/70 rounded-md shadow-[0_0_30px_rgba(239,68,68,0.5)]" />
          </div>
        </div>
        <div className="p-3 text-xs text-muted-foreground font-mono uppercase tracking-widest text-center">
          {error ? (
            <span className="text-destructive">{error}</span>
          ) : lastSeen ? (
            <span className="text-emerald-400">Captured: {lastSeen}</span>
          ) : (
            "Align barcode in the red frame…"
          )}
        </div>
      </div>
    </div>
  );
}
