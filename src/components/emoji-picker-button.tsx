import { useState, useRef, useEffect, lazy, Suspense } from "react";
import { Smile } from "lucide-react";

const EmojiPicker = lazy(() => import("emoji-picker-react"));

export function EmojiPickerButton({ onSelect }: { onSelect: (emoji: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  return (
    <div ref={ref} className="relative inline-block">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="rounded-full glass p-1.5 hover:bg-gold/10" title="Emoji invoegen">
        <Smile className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 z-50">
          <Suspense fallback={<div className="rounded-lg glass-strong p-4 text-xs">Laden…</div>}>
            <EmojiPicker
              onEmojiClick={(e) => { onSelect(e.emoji); setOpen(false); }}
              theme={"dark" as any}
              width={320}
              height={400}
            />
          </Suspense>
        </div>
      )}
    </div>
  );
}
