import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function CopyButton({
  text,
  label = "Kopieer",
  className,
}: {
  text: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Gekopieerd naar klembord");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Kopiëren mislukt");
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      className={cn(
        "inline-flex items-center gap-1.5 h-8 px-3 text-xs rounded-full border border-gold/20 bg-card hover:bg-gold/10 transition",
        className,
      )}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-emerald-500" />
      ) : (
        <Copy className="h-3.5 w-3.5 text-gold" />
      )}
      {label}
    </button>
  );
}
