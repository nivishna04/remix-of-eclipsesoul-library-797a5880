import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const BorrowInput = z.object({
  book_id: z.string().uuid(),
  student_id: z.string().uuid().optional(), // admin can specify; student borrows for self
  days: z.number().int().min(1).max(60).default(14),
});

/** Issue a book — student borrows for self; admin can issue to any student. */
export const borrowBook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => BorrowInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const studentId = data.student_id ?? context.userId;

    // If acting on behalf of someone else, require admin
    if (data.student_id && data.student_id !== context.userId) {
      const { data: isAdmin } = await supabaseAdmin.rpc("has_role", {
        _user_id: context.userId,
        _role: "admin",
      });
      if (!isAdmin) throw new Error("Forbidden");
    }

    // Check availability
    const { data: book, error: bErr } = await supabaseAdmin
      .from("books").select("id, available_copies, title").eq("id", data.book_id).single();
    if (bErr || !book) throw new Error("Book not found");
    if (book.available_copies <= 0) throw new Error("No copies available");

    // Prevent duplicate active loan
    const { data: existing } = await supabaseAdmin
      .from("transactions")
      .select("id")
      .eq("book_id", data.book_id).eq("student_id", studentId).eq("status", "active")
      .maybeSingle();
    if (existing) throw new Error("Already borrowed");

    const due = new Date();
    due.setDate(due.getDate() + data.days);

    const { error: tErr } = await supabaseAdmin.from("transactions").insert({
      book_id: data.book_id,
      student_id: studentId,
      due_date: due.toISOString().slice(0, 10),
      status: "active",
    });
    if (tErr) throw tErr;

    const { error: uErr } = await supabaseAdmin
      .from("books").update({ available_copies: book.available_copies - 1 }).eq("id", data.book_id);
    if (uErr) throw uErr;

    await supabaseAdmin.from("activity_logs").insert({
      user_id: context.userId,
      action: "borrow",
      entity: "book",
      entity_id: data.book_id,
      metadata: { student_id: studentId, title: book.title },
    });

    return { ok: true };
  });

const ReturnInput = z.object({ transaction_id: z.string().uuid() });

/** Return a book — fine = $0.50/day overdue. Admin or owning student. */
export const returnBook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ReturnInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: tx, error } = await supabaseAdmin
      .from("transactions").select("*").eq("id", data.transaction_id).single();
    if (error || !tx) throw new Error("Transaction not found");
    if (tx.status !== "active") throw new Error("Already closed");

    if (tx.student_id !== context.userId) {
      const { data: isAdmin } = await supabaseAdmin.rpc("has_role", {
        _user_id: context.userId, _role: "admin",
      });
      if (!isAdmin) throw new Error("Forbidden");
    }

    const today = new Date();
    const due = new Date(tx.due_date);
    const overdueDays = Math.max(0, Math.ceil((today.getTime() - due.getTime()) / 86400000));
    const fine = overdueDays * 0.5;

    await supabaseAdmin.from("transactions").update({
      status: "returned",
      return_date: today.toISOString(),
      fine_amount: fine,
    }).eq("id", data.transaction_id);

    const { data: book } = await supabaseAdmin
      .from("books").select("available_copies, quantity").eq("id", tx.book_id).single();
    if (book) {
      await supabaseAdmin.from("books").update({
        available_copies: Math.min(book.quantity, book.available_copies + 1),
      }).eq("id", tx.book_id);
    }

    await supabaseAdmin.from("activity_logs").insert({
      user_id: context.userId,
      action: "return",
      entity: "transaction",
      entity_id: data.transaction_id,
      metadata: { fine, overdueDays },
    });

    return { ok: true, fine, overdueDays };
  });

const CreateStudentInput = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  full_name: z.string().min(1),
  student_code: z.string().optional(),
  department: z.string().optional(),
  year: z.string().optional(),
  phone: z.string().optional(),
});

const OWNER_EMAIL = "nivishna689@gmail.com";

export const claimOwnerAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.auth.admin.getUserById(context.userId);
    if (error || !data.user) throw new Error("User not found");

    if (data.user.email?.toLowerCase() !== OWNER_EMAIL) return { ok: false };

    const { error: roleError } = await supabaseAdmin.from("user_roles").insert({
      user_id: context.userId,
      role: "admin",
    });

    if (roleError && roleError.code !== "23505") throw roleError;
    return { ok: true };
  });

const DecideAdminRequestInput = z.object({
  id: z.string().uuid(),
  approve: z.boolean(),
});

export const decideAdminRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => DecideAdminRequestInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(context.userId);
    if (userError || !userData.user) throw new Error("User not found");
    if (userData.user.email?.toLowerCase() !== OWNER_EMAIL) throw new Error("Only the owner can decide admin requests");

    const { data: request, error: requestError } = await supabaseAdmin
      .from("admin_requests")
      .select("user_id")
      .eq("id", data.id)
      .maybeSingle();
    if (requestError) throw requestError;
    if (!request) throw new Error("Request not found");

    const { error: updateError } = await supabaseAdmin
      .from("admin_requests")
      .update({
        status: data.approve ? "approved" : "rejected",
        decided_by: context.userId,
        decided_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (updateError) throw updateError;

    if (data.approve) {
      const { error: roleError } = await supabaseAdmin.from("user_roles").insert({
        user_id: request.user_id,
        role: "admin",
      });
      if (roleError && roleError.code !== "23505") throw roleError;
    }

    return { ok: true };
  });

async function requireAdminUser(supabaseAdmin: any, userId: string) {
  const { data: isAdmin } = await supabaseAdmin.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (!isAdmin) throw new Error("Admin only");
}

export const listStudents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await requireAdminUser(supabaseAdmin, context.userId);

    const { data: roles, error: rolesError } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "student");
    if (rolesError) throw rolesError;

    const ids = (roles ?? []).map((r: { user_id: string }) => r.user_id);
    if (!ids.length) return [];

    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .in("id", ids)
      .order("full_name");
    if (error) throw error;
    return data ?? [];
  });

export const getAdminStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await requireAdminUser(supabaseAdmin, context.userId);

    const [books, tx, students, reservations] = await Promise.all([
      supabaseAdmin.from("books").select("quantity, available_copies", { count: "exact" }),
      supabaseAdmin.from("transactions").select("status, fine_amount, fine_paid, due_date, return_date"),
      supabaseAdmin.from("user_roles").select("user_id", { count: "exact", head: true }).eq("role", "student"),
      supabaseAdmin.from("reservations").select("status", { count: "exact", head: true }).eq("status", "pending"),
    ]);

    const totalQty = books.data?.reduce((s: number, b: any) => s + (b.quantity ?? 0), 0) ?? 0;
    const availableQty = books.data?.reduce((s: number, b: any) => s + (b.available_copies ?? 0), 0) ?? 0;
    const issued = tx.data?.filter((t: any) => t.status === "issued" || t.status === "active").length ?? 0;
    const now = Date.now();
    const overdue = tx.data?.filter((t: any) =>
      (t.status === "issued" || t.status === "active") && new Date(t.due_date).getTime() < now,
    ).length ?? 0;
    const finesCollected = tx.data?.filter((t: any) => t.fine_paid).reduce((s: number, t: any) => s + Number(t.fine_amount ?? 0), 0) ?? 0;

    return {
      totalTitles: books.count ?? 0,
      totalCopies: totalQty,
      available: availableQty,
      issued,
      overdue,
      students: students.count ?? 0,
      reservations: reservations.count ?? 0,
      finesCollected,
    };
  });

/** Admin-only: provision a student account. */
export const createStudent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CreateStudentInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: isAdmin } = await supabaseAdmin.rpc("has_role", {
      _user_id: context.userId, _role: "admin",
    });
    if (!isAdmin) throw new Error("Admin only");

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name, role: "student" },
    });
    if (error) throw error;
    const newId = created.user!.id;

    await supabaseAdmin.from("profiles").update({
      full_name: data.full_name,
      student_code: data.student_code ?? null,
      department: data.department ?? null,
      year: data.year ?? null,
      phone: data.phone ?? null,
    }).eq("id", newId);

    return { ok: true, id: newId };
  });
