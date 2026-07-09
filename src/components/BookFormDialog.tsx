import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { uploadCover } from "@/lib/cover";
import { toast } from "sonner";
import { Loader2, Upload } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type BookInput = {
  id?: string;
  title: string;
  author: string;
  isbn?: string | null;
  barcode?: string | null;
  category?: string | null;
  publisher?: string | null;
  published_year?: number | null;
  shelf_location?: string | null;
  quantity: number;
  available_copies?: number;
  description?: string | null;
  cover_url?: string | null;
};

export function BookFormDialog({
  open,
  onOpenChange,
  initial,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: BookInput | null;
}) {
  const isEdit = !!initial?.id;
  const qc = useQueryClient();
  const [form, setForm] = useState<BookInput>(
    initial ?? {
      title: "",
      author: "",
      quantity: 1,
      available_copies: 1,
      isbn: "",
      barcode: "",
      category: "",
      publisher: "",
      published_year: null,
      shelf_location: "",
      description: "",
      cover_url: "",
    },
  );
  const [file, setFile] = useState<File | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      let cover_url = form.cover_url || null;
      if (file) cover_url = await uploadCover(file);

      const payload = {
        title: form.title.trim(),
        author: form.author.trim(),
        isbn: form.isbn || null,
        barcode: form.barcode || null,
        category: form.category || null,
        publisher: form.publisher || null,
        published_year: form.published_year || null,
        shelf_location: form.shelf_location || null,
        quantity: Number(form.quantity) || 0,
        description: form.description || null,
        cover_url,
      };

      if (isEdit) {
        const { error } = await supabase
          .from("books")
          .update(payload)
          .eq("id", initial!.id!);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("books")
          .insert({ ...payload, available_copies: payload.quantity });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(isEdit ? "Book updated" : "Book added to the stacks");
      qc.invalidateQueries({ queryKey: ["books-all"] });
      qc.invalidateQueries({ queryKey: ["books-all-student"] });
      qc.invalidateQueries({ queryKey: ["book"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.author.trim()) {
      toast.error("Title and author required");
      return;
    }
    save.mutate();
  }

  const input =
    "w-full px-3 py-2 bg-input border border-border rounded-md text-sm focus:outline-none focus:border-primary";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display tracking-widest uppercase neon-text">
            {isEdit ? "Edit Volume" : "Catalog New Volume"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Title *</label>
              <input className={input} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Author *</label>
              <input className={input} value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} required />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Category</label>
              <input className={input} value={form.category ?? ""} onChange={(e) => setForm({ ...form, category: e.target.value })} />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground">ISBN</label>
              <input className={input} value={form.isbn ?? ""} onChange={(e) => setForm({ ...form, isbn: e.target.value })} />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Barcode</label>
              <input className={input} value={form.barcode ?? ""} onChange={(e) => setForm({ ...form, barcode: e.target.value })} />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Publisher</label>
              <input className={input} value={form.publisher ?? ""} onChange={(e) => setForm({ ...form, publisher: e.target.value })} />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Year</label>
              <input type="number" className={input} value={form.published_year ?? ""} onChange={(e) => setForm({ ...form, published_year: e.target.value ? Number(e.target.value) : null })} />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Shelf Location</label>
              <input className={input} value={form.shelf_location ?? ""} onChange={(e) => setForm({ ...form, shelf_location: e.target.value })} />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Quantity</label>
              <input type="number" min={0} className={input} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} />
            </div>
            <div className="md:col-span-2">
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Description</label>
              <textarea rows={3} className={input} value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="md:col-span-2 space-y-2">
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Cover Image</label>
              <input
                className={input}
                placeholder="Paste image URL or upload below"
                value={form.cover_url ?? ""}
                onChange={(e) => setForm({ ...form, cover_url: e.target.value })}
              />
              <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer hover:text-primary transition">
                <Upload className="w-3 h-3" />
                <span>{file ? file.name : "Upload from device"}</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>
          </div>
          <DialogFooter>
            <button type="button" onClick={() => onOpenChange(false)} className="px-4 py-2 text-sm border border-border rounded-md hover:bg-secondary">
              Cancel
            </button>
            <button type="submit" disabled={save.isPending} className="px-5 py-2 text-sm uppercase tracking-widest bg-primary text-primary-foreground rounded-md neon-glow hover:bg-primary/90 disabled:opacity-50 inline-flex items-center gap-2">
              {save.isPending && <Loader2 className="w-3 h-3 animate-spin" />}
              {isEdit ? "Save" : "Catalog"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
