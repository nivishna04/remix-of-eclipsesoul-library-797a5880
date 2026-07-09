import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const Input = z.object({
  persona: z.enum(["lyra", "orion"]).default("lyra"),
  messages: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string().min(1).max(2000),
  })).min(1).max(20),
});

const PERSONA_STYLE: Record<string, string> = {
  lyra: "You are Lyra — a gentle, kind, elegant female holographic librarian. Warm, patient, encouraging. Short sentences, never rushed, gently smiling in tone. Sometimes greet with 'Hello.' and thank the reader.",
  orion: "You are Orion — a calm, intelligent, confident male AI librarian. Professional but friendly, precise and reliable. Speak like an experienced librarian; prefer clear, direct sentences.",
};

type ContextBundle = {
  role: "student" | "admin";
  profile: any;
  active_borrowings: any[];
  overdue: any[];
  reservations: any[];
  fines: { unpaid_total: number; paid_total: number; entries: any[] };
  lost_reports: any[];
  seat_bookings: any[];
  recommendations: any[];
  admin_stats?: any;
};

function nDays(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

async function gatherContext(sb: any, userId: string): Promise<ContextBundle> {
  const [
    profileR, rolesR, txR, resR, lostR, seatR, booksR,
  ] = await Promise.all([
    sb.from("profiles").select("full_name,email,phone,department,year,student_code").eq("id", userId).maybeSingle(),
    sb.from("user_roles").select("role").eq("user_id", userId),
    sb.from("transactions").select("id,book_id,issue_date,due_date,return_date,fine_amount,fine_paid,status,books(title,author,isbn,shelf_location)").eq("student_id", userId).order("issue_date", { ascending: false }).limit(30),
    sb.from("reservations").select("id,status,reserved_at,resolved_at,books(title,author,available_copies)").eq("student_id", userId).order("reserved_at", { ascending: false }).limit(20),
    sb.from("lost_books").select("id,status,reported_at,fine_amount,notes,books(title,author)").eq("student_id", userId).order("reported_at", { ascending: false }).limit(20),
    sb.from("seat_reservations").select("id,start_time,end_time,status,seats(seat_number,zone)").eq("student_id", userId).order("start_time", { ascending: false }).limit(20),
    sb.from("books").select("id,title,author,category,available_copies,quantity,shelf_location").limit(500),
  ]);

  const isAdmin = (rolesR.data || []).some((r: any) => r.role === "admin");
  const tx = txR.data || [];
  const active = tx.filter((t: any) => t.status === "issued" || !t.return_date);
  const overdue = active.filter((t: any) => new Date(t.due_date).getTime() < Date.now());
  const lost = lostR.data || [];

  const unpaidFines = tx.filter((t: any) => !t.fine_paid && Number(t.fine_amount) > 0).reduce((s: number, t: any) => s + Number(t.fine_amount), 0);
  const paidFines = tx.filter((t: any) => t.fine_paid && Number(t.fine_amount) > 0).reduce((s: number, t: any) => s + Number(t.fine_amount), 0);
  const unpaidLost = lost.filter((l: any) => l.status !== "resolved" && Number(l.fine_amount) > 0).reduce((s: number, l: any) => s + Number(l.fine_amount), 0);
  const paidLost = lost.filter((l: any) => l.status === "resolved" && Number(l.fine_amount) > 0).reduce((s: number, l: any) => s + Number(l.fine_amount), 0);

  const borrowedIds = new Set(active.map((t: any) => t.book_id));
  const borrowedCats = new Set(tx.map((t: any) => t.books?.category).filter(Boolean));
  const recs = (booksR.data || [])
    .filter((b: any) => b.available_copies > 0 && !borrowedIds.has(b.id) && (borrowedCats.size === 0 || borrowedCats.has(b.category)))
    .slice(0, 6);

  const bundle: ContextBundle = {
    role: isAdmin ? "admin" : "student",
    profile: profileR.data,
    active_borrowings: active.map((t: any) => ({
      title: t.books?.title, author: t.books?.author, isbn: t.books?.isbn, shelf: t.books?.shelf_location,
      due_date: t.due_date, days_overdue: Math.max(0, nDays(t.due_date)),
    })),
    overdue: overdue.map((t: any) => ({ title: t.books?.title, due_date: t.due_date, days_overdue: nDays(t.due_date), fine: Number(t.fine_amount) })),
    reservations: (resR.data || []).map((r: any) => ({ title: r.books?.title, status: r.status, reserved_at: r.reserved_at, available_copies: r.books?.available_copies })),
    fines: {
      unpaid_total: Math.round((unpaidFines + unpaidLost) * 100) / 100,
      paid_total: Math.round((paidFines + paidLost) * 100) / 100,
      entries: [
        ...tx.filter((t: any) => Number(t.fine_amount) > 0).map((t: any) => ({ kind: "overdue", title: t.books?.title, amount: Number(t.fine_amount), paid: t.fine_paid })),
        ...lost.filter((l: any) => Number(l.fine_amount) > 0).map((l: any) => ({ kind: "lost", title: l.books?.title, amount: Number(l.fine_amount), paid: l.status === "resolved" })),
      ],
    },
    lost_reports: lost.map((l: any) => ({ title: l.books?.title, status: l.status, reported_at: l.reported_at, fine: Number(l.fine_amount || 0), notes: l.notes })),
    seat_bookings: (seatR.data || []).map((s: any) => ({ seat: s.seats?.seat_number, zone: s.seats?.zone, start: s.start_time, end: s.end_time, status: s.status })),
    recommendations: recs.map((b: any) => ({ title: b.title, author: b.author, category: b.category, shelf: b.shelf_location })),
  };

  if (isAdmin) {
    const [{ count: totalBooks }, { count: totalStudents }, { count: activeIssues }, { count: pendingLost }] = await Promise.all([
      sb.from("books").select("id", { count: "exact", head: true }),
      sb.from("profiles").select("id", { count: "exact", head: true }),
      sb.from("transactions").select("id", { count: "exact", head: true }).eq("status", "issued"),
      sb.from("lost_books").select("id", { count: "exact", head: true }).eq("status", "pending"),
    ]);
    bundle.admin_stats = { total_books: totalBooks, total_students: totalStudents, active_issues: activeIssues, pending_lost: pendingLost };
  }

  return bundle;
}

const ROUTES = `
- /student/catalog — browse & search books
- /student/my-books — currently borrowed
- /student/reservations — place / cancel holds
- /student/fines — pay fines
- /student/lost-books — report a lost book
- /student/seats — book a seat
- /student/profile — profile settings
- /admin/catalog — manage books
- /admin/issues — issue / return books
- /admin/reservations — manage holds
- /admin/lost-books — review lost reports
- /admin/fines — collect fines
- /admin/reports — reports, exports & audit
- /admin/seats — seat administration
- /admin/students — student directory
`;

export const askAssistant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("AI is not configured");

    const ctx = await gatherContext(context.supabase, context.userId);

    const system = [
      "You are Eclipse AI, the intelligent virtual library assistant for EclipseSoul Library Management System.",
      PERSONA_STYLE[data.persona],
      "Use ONLY the JSON context below to answer factual questions about the user's account. If a field is empty or missing, say so politely — do not invent data.",
      "When helpful, recommend the next action (renew, reserve, pay fine, report lost, book a seat) and mention the exact route path. Keep replies under 6 short sentences unless the user asks for detail.",
      "Available app routes:" + ROUTES,
      "USER CONTEXT (JSON):",
      "```json",
      JSON.stringify(ctx, null, 2).slice(0, 12000),
      "```",
    ].join("\n");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "system", content: system }, ...data.messages],
      }),
    });
    if (res.status === 429) throw new Error("Rate limit — try again soon");
    if (res.status === 402) throw new Error("AI credits exhausted");
    if (!res.ok) throw new Error(`AI error ${res.status}`);
    const json: any = await res.json();
    const text: string = json?.choices?.[0]?.message?.content ?? "…";
    return { text };
  });
