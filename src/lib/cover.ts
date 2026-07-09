import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/** If value is an http(s) URL, returns as-is. Otherwise treats it as a path in
 * the `book-covers` private bucket and resolves a signed URL. */
export function useCoverUrl(value: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(() =>
    value && /^https?:\/\//i.test(value) ? value : null,
  );

  useEffect(() => {
    if (!value) {
      setUrl(null);
      return;
    }
    if (/^https?:\/\//i.test(value)) {
      setUrl(value);
      return;
    }
    let cancelled = false;
    supabase.storage
      .from("book-covers")
      .createSignedUrl(value, 60 * 60)
      .then(({ data }) => {
        if (!cancelled) setUrl(data?.signedUrl ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [value]);

  return url;
}

export async function uploadCover(file: File): Promise<string> {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("book-covers").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw error;
  return path;
}
