import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { borrowBook, createStudent, listStudents } from "@/lib/library.functions";
import { toast } from "sonner";
import { Plus, Loader2, BookMarked } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_admin/admin/students")({
  head: () => ({ meta: [{ title: "Students — Admin" }] }),
  component: AdminStudents,
});

function AdminStudents() {
  const [open, setOpen] = useState(false);
  const [issueFor, setIssueFor] = useState<{ id: string; name: string } | null>(null);
  const fetchStudents = useServerFn(listStudents);

  const { data: students } = useQuery({
    queryKey: ["students"],
    queryFn: () => fetchStudents(),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Students</h1>
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground mt-2">
            {students?.length ?? 0} Enrolled
          </p>
        </div>
        <button onClick={() => setOpen(true)} className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm uppercase tracking-widest rounded-md neon-glow hover:bg-primary/90">
          <Plus className="w-4 h-4" /> Add Student
        </button>
      </div>

      <div className="card-surface rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary/50">
            <tr className="text-[10px] uppercase tracking-widest text-muted-foreground">
              <th className="text-left px-4 py-3">Name</th>
              <th className="text-left px-4 py-3">Email</th>
              <th className="text-left px-4 py-3">Code</th>
              <th className="text-left px-4 py-3">Dept</th>
              <th className="text-right px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {students?.map((s: any) => (
              <tr key={s.id} className="border-t border-border">
                <td className="px-4 py-3 font-medium">{s.full_name ?? "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{s.email}</td>
                <td className="px-4 py-3 font-mono text-xs">{s.student_code ?? "—"}</td>
                <td className="px-4 py-3 text-xs">{s.department ?? "—"} {s.year ? `· ${s.year}` : ""}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => setIssueFor({ id: s.id, name: s.full_name ?? s.email })}
                    className="inline-flex items-center gap-1 text-xs px-3 py-1 border border-border rounded hover:bg-primary hover:text-primary-foreground"
                  >
                    <BookMarked className="w-3 h-3" /> Issue Book
                  </button>
                </td>
              </tr>
            ))}
            {!students?.length && (
              <tr><td colSpan={5} className="px-4 py-12 text-center text-sm text-muted-foreground">
                No students enrolled yet. Click <strong>Add Student</strong> to onboard one.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      <AddStudentDialog open={open} onOpenChange={setOpen} />
      {issueFor && <IssueBookDialog student={issueFor} onClose={() => setIssueFor(null)} />}
    </div>
  );
}

function AddStudentDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    email: "", password: "", full_name: "", student_code: "", department: "", year: "", phone: "",
  });

  const create = useMutation({
    mutationFn: useServerFn(createStudent),
    onSuccess: () => {
      toast.success("Student onboarded");
      qc.invalidateQueries({ queryKey: ["students"] });
      onOpenChange(false);
      setForm({ email: "", password: "", full_name: "", student_code: "", department: "", year: "", phone: "" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const input = "w-full px-3 py-2 bg-input border border-border rounded-md text-sm focus:outline-none focus:border-primary";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display uppercase tracking-widest neon-text">Enroll Student</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); create.mutate({ data: form } as any); }} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Full Name *</label>
              <input className={input} required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Email *</label>
              <input type="email" className={input} required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Temp Password *</label>
              <input type="text" className={input} required minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Student Code</label>
              <input className={input} value={form.student_code} onChange={(e) => setForm({ ...form, student_code: e.target.value })} />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Phone</label>
              <input className={input} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Department</label>
              <input className={input} value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Year</label>
              <input className={input} value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <button type="button" onClick={() => onOpenChange(false)} className="px-4 py-2 text-sm border border-border rounded-md hover:bg-secondary">Cancel</button>
            <button type="submit" disabled={create.isPending} className="px-5 py-2 text-sm uppercase tracking-widest bg-primary text-primary-foreground rounded-md neon-glow hover:bg-primary/90 inline-flex items-center gap-2">
              {create.isPending && <Loader2 className="w-3 h-3 animate-spin" />} Enroll
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function IssueBookDialog({ student, onClose }: { student: { id: string; name: string }; onClose: () => void }) {
  const qc = useQueryClient();
  const [bookId, setBookId] = useState("");
  const [days, setDays] = useState(14);

  const { data: books } = useQuery({
    queryKey: ["books-available"],
    queryFn: async () => {
      const { data } = await supabase.from("books").select("id, title, author, available_copies").gt("available_copies", 0).order("title");
      return data ?? [];
    },
  });

  const issue = useMutation({
    mutationFn: useServerFn(borrowBook),
    onSuccess: () => {
      toast.success("Book issued");
      qc.invalidateQueries({ queryKey: ["books-all"] });
      qc.invalidateQueries({ queryKey: ["books-available"] });
      qc.invalidateQueries({ queryKey: ["active-loans"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const input = "w-full px-3 py-2 bg-input border border-border rounded-md text-sm focus:outline-none focus:border-primary";

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display uppercase tracking-widest neon-text">Issue Book</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => {
          e.preventDefault();
          if (!bookId) return toast.error("Select a book");
          issue.mutate({ data: { book_id: bookId, student_id: student.id, days } } as any);
        }} className="space-y-3">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">To</div>
            <div className="font-medium">{student.name}</div>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Book</label>
            <select className={input} value={bookId} onChange={(e) => setBookId(e.target.value)} required>
              <option value="">— Select —</option>
              {books?.map((b: any) => (
                <option key={b.id} value={b.id}>{b.title} · {b.author} ({b.available_copies})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Loan Days</label>
            <input type="number" min={1} max={60} className={input} value={days} onChange={(e) => setDays(Number(e.target.value))} />
          </div>
          <DialogFooter>
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-border rounded-md hover:bg-secondary">Cancel</button>
            <button type="submit" disabled={issue.isPending} className="px-5 py-2 text-sm uppercase tracking-widest bg-primary text-primary-foreground rounded-md neon-glow hover:bg-primary/90 inline-flex items-center gap-2">
              {issue.isPending && <Loader2 className="w-3 h-3 animate-spin" />} Issue
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
