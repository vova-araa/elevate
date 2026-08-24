import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check, FileUp, HelpCircle, Loader2, Sparkles, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { analyzeIntakeDocument, type IntakeAnalysis } from "@/lib/intake-docs.functions";
import { uploadMedia } from "@/lib/upload-media";

const ACCEPT = ".pdf,.txt,.md,.csv,.json,application/pdf,text/plain,text/markdown,text/csv";

/**
 * Documenten bij de intake: upload een merkboek of jaarplan en laat de AI de
 * antwoorden eruit halen. Elk voorstel is los over te nemen — niets wordt
 * automatisch ingevuld, want de admin blijft eindverantwoordelijk.
 */
export function IntakeDocumentCard({
  clientId,
  existingAnswers,
  onApply,
}: {
  clientId: string;
  existingAnswers: Record<string, unknown>;
  onApply: (field: string, value: string) => void;
}) {
  const analyze = useServerFn(analyzeIntakeDocument);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<IntakeAnalysis | null>(null);
  const [applied, setApplied] = useState<Set<string>>(new Set());

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setBusy(true);
    setAnalysis(null);
    setApplied(new Set());
    setFileName(file.name);
    try {
      const { path } = await uploadMedia(file, { clientId, folder: "intake" });

      const result = await analyze({
        data: { clientId, filePath: path, fileName: file.name, existingAnswers },
      });
      setAnalysis(result);
      if (result.suggestions.length === 0 && result.followUps.length === 0) {
        toast.info("Geen bruikbare informatie gevonden in dit document.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Analyse mislukt");
      setFileName(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card-surface bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 font-display text-lg">
            <Sparkles className="h-4 w-4 text-gold" />
            Document uitlezen
          </h3>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Upload een merkboek, jaarplan of huisstijlgids. De AI haalt eruit wat in de intake hoort
            en stelt vervolgvragen over wat de strategie scherper maakt.
          </p>
        </div>
        <input ref={fileRef} type="file" accept={ACCEPT} onChange={handleFile} className="hidden" />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full bg-gold/15 px-4 text-sm text-gold hairline hover:bg-gold/25 disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
          {busy ? "Lezen…" : "Bestand kiezen"}
        </button>
      </div>

      {busy && fileName && (
        <p className="mt-3 text-xs text-muted-foreground">
          <span className="font-medium">{fileName}</span> wordt gelezen — dit duurt even bij een
          groot document.
        </p>
      )}

      {analysis && (
        <div className="mt-5 space-y-4">
          <div className="rounded-lg bg-surface-elevated/50 p-3 text-sm">
            <span className="text-muted-foreground">{analysis.summary}</span>
          </div>

          {analysis.suggestions.length > 0 && (
            <div>
              <div className="mb-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                Gevonden antwoorden — neem los over
              </div>
              <ul className="space-y-2">
                {analysis.suggestions.map((s) => {
                  const done = applied.has(s.field);
                  return (
                    <li key={s.field} className="rounded-lg border border-gold/10 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-medium text-gold">
                          {FIELD_LABELS[s.field] ?? s.field}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            onApply(s.field, s.value);
                            setApplied((prev) => new Set(prev).add(s.field));
                            toast.success(`${FIELD_LABELS[s.field] ?? s.field} ingevuld`);
                          }}
                          disabled={done}
                          className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-gold/30 px-3 text-xs text-gold disabled:opacity-50"
                        >
                          {done ? <Check className="h-3 w-3" /> : null}
                          {done ? "Overgenomen" : "Overnemen"}
                        </button>
                      </div>
                      <p className="mt-1.5 whitespace-pre-line text-sm">{s.value}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">Bron: {s.source}</p>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {analysis.followUps.length > 0 && (
            <div>
              <div className="mb-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                Vraag dit nog na bij de klant
              </div>
              <ul className="space-y-2">
                {analysis.followUps.map((f, i) => (
                  <li key={i} className="flex gap-2.5 rounded-lg bg-surface-elevated/50 p-3">
                    <HelpCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                    <div>
                      <div className="text-sm font-medium">{f.question}</div>
                      <p className="mt-0.5 text-xs text-muted-foreground">{f.why}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              setAnalysis(null);
              setFileName(null);
            }}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3" /> Analyse sluiten
          </button>
        </div>
      )}
    </div>
  );
}

const FIELD_LABELS: Record<string, string> = {
  positioning: "Positionering",
  audience: "Doelgroep",
  toneOfVoice: "Tone of voice",
  competitors: "Concurrenten",
  contentThemes: "Contentthema's",
  platformFrequency: "Frequentie per platform",
  importantDates: "Belangrijke data",
  dos: "Wel doen",
  donts: "Niet doen",
  goalOther: "Overig doel",
};
