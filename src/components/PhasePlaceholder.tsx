import { ReactNode } from "react";
import { Construction } from "lucide-react";

export function PhasePlaceholder({ title, phase = 2, description, children }: { title: string; phase?: number; description?: string; children?: ReactNode }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">{title}</h1>
        {description && <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground mt-2">{description}</p>}
      </div>
      {children ?? (
        <div className="card-surface rounded-lg p-10 text-center">
          <Construction className="w-10 h-10 text-primary mx-auto mb-4 pulse-glow" />
          <div className="font-display text-xl neon-text tracking-widest">PHASE {phase}</div>
          <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
            This module unlocks in Phase {phase}. The schema and data are already wired — UI ships next.
          </p>
        </div>
      )}
    </div>
  );
}
