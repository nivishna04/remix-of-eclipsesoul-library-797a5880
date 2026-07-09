// PDF + Excel export helpers (dynamic imports keep bundle lean)
import { supabase } from "@/integrations/supabase/client";

async function logExport(format: "pdf" | "xlsx", meta: { scope: string; rows: number; filters?: Record<string, unknown> }) {
  try {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    await supabase.from("activity_logs").insert({
      user_id: u.user.id,
      action: `export.${format}`,
      entity: "report",
      entity_id: meta.scope,
      metadata: { rows: meta.rows, filters: (meta.filters ?? null) as any, at: new Date().toISOString() } as any,
    });
  } catch {
    // non-fatal
  }
}

export async function exportPdf(opts: {
  title: string;
  subtitle?: string;
  columns: string[];
  rows: (string | number)[][];
  filename: string;
  audit?: { scope: string; filters?: Record<string, unknown> };
}) {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(18);
  doc.setTextColor(220, 38, 38);
  doc.text("ECLIPSESOUL LIBRARY", 14, 16);
  doc.setFontSize(12);
  doc.setTextColor(20, 20, 20);
  doc.text(opts.title, 14, 24);
  if (opts.subtitle) {
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text(opts.subtitle, 14, 30);
  }
  autoTable(doc, {
    head: [opts.columns],
    body: opts.rows,
    startY: 34,
    styles: { fontSize: 9 },
    headStyles: { fillColor: [220, 38, 38] },
  });
  doc.save(opts.filename.endsWith(".pdf") ? opts.filename : `${opts.filename}.pdf`);
  if (opts.audit) await logExport("pdf", { scope: opts.audit.scope, rows: opts.rows.length, filters: opts.audit.filters });
}

export async function exportExcel(opts: {
  sheet: string;
  columns: string[];
  rows: (string | number)[][];
  filename: string;
  audit?: { scope: string; filters?: Record<string, unknown> };
}) {
  const XLSX = await import("xlsx");
  const data = [opts.columns, ...opts.rows];
  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, opts.sheet.slice(0, 31));
  XLSX.writeFile(wb, opts.filename.endsWith(".xlsx") ? opts.filename : `${opts.filename}.xlsx`);
  if (opts.audit) await logExport("xlsx", { scope: opts.audit.scope, rows: opts.rows.length, filters: opts.audit.filters });
}
