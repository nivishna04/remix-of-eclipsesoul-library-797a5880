import { useCoverUrl } from "@/lib/cover";
import { BookOpen } from "lucide-react";

export function BookCover({
  src,
  alt,
  className = "",
}: {
  src: string | null | undefined;
  alt: string;
  className?: string;
}) {
  const url = useCoverUrl(src);
  return (
    <div className={`relative bg-secondary overflow-hidden ${className}`}>
      {url ? (
        <img src={url} alt={alt} className="w-full h-full object-cover" loading="lazy" />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-muted-foreground/40">
          <BookOpen className="w-8 h-8" />
        </div>
      )}
    </div>
  );
}
