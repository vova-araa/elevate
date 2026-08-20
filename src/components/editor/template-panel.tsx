import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { parseGrade, type Grade } from "@/lib/color-grade";
import { cn } from "@/lib/utils";

/**
 * Beeldsjablonen: het hele recept — kleurgrade, beeldverhouding en tekstlagen —
 * onder één naam bewaren en later in één klik terugzetten.
 *
 * Dit is waar de tijdwinst zit. De grade instellen is leuk werk dat je één keer
 * doet; hem daarna elke post opnieuw namaken is het werk dat je wilt kwijtraken,
 * en het is precies waar de look van een klant langzaam uit elkaar loopt.
 */

export interface TemplatePayload {
  grade: Grade;
  aspect: number;
  /** Tekstlagen; vorm wordt door de editor bepaald, hier alleen doorgegeven. */
  layers: unknown[];
}

export function TemplatePanel({
  clientId,
  current,
  onApply,
}: {
  /** Klant waar dit beeld bij hoort; leeg = alleen bureaubrede sjablonen. */
  clientId?: string;
  current: TemplatePayload;
  onApply: (t: TemplatePayload) => void;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: templates, isLoading } = useQuery({
    queryKey: ["editor-templates", clientId ?? "agency"],
    queryFn: async () => {
      // Bureaubrede sjablonen (client_id leeg) altijd erbij, zodat je eigen
      // huisstijl overal beschikbaar is.
      let q = supabase.from("editor_templates").select("*").order("name");
      q = clientId ? q.or(`client_id.is.null,client_id.eq.${clientId}`) : q.is("client_id", null);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const save = useMutation({
    mutationFn: async (vars: { name: string; scope: "client" | "agency" }) => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("editor_templates").insert({
        name: vars.name,
        client_id: vars.scope === "client" ? (clientId ?? null) : null,
        grade: JSON.parse(JSON.stringify(current.grade)),
        aspect: current.aspect || null,
        layers: JSON.parse(JSON.stringify(current.layers)),
        created_by: u.user?.id ?? null,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      setName("");
      qc.invalidateQueries({ queryKey: ["editor-templates"] });
      toast.success("Sjabloon opgeslagen");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("editor_templates").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["editor-templates"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-3">
      <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Sjablonen</div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Laden…
        </div>
      ) : (templates?.length ?? 0) === 0 ? (
        <p className="text-xs leading-relaxed text-muted-foreground">
          Nog geen sjablonen. Stel hieronder een look in en bewaar hem — daarna zet je die met één
          klik op elk volgend beeld.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {templates?.map((t) => (
            <li
              key={t.id}
              className="flex items-center gap-2 rounded-lg bg-input/40 px-2.5 py-2 hairline"
            >
              <button
                type="button"
                onClick={() =>
                  onApply({
                    grade: parseGrade(t.grade),
                    aspect: typeof t.aspect === "number" ? t.aspect : 0,
                    layers: Array.isArray(t.layers) ? (t.layers as unknown[]) : [],
                  })
                }
                className="flex min-w-0 flex-1 items-center gap-2 text-left text-xs"
              >
                <Check className="h-3.5 w-3.5 shrink-0 text-gold" />
                <span className="truncate">{t.name}</span>
                {t.client_id === null && (
                  <span className="shrink-0 rounded-full border border-border/70 px-1.5 text-[9px] uppercase tracking-wider text-muted-foreground">
                    bureau
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => remove.mutate(t.id)}
                aria-label={`${t.name} verwijderen`}
                className="shrink-0 text-muted-foreground hover:text-red-400"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-1.5 border-t border-border/60 pt-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Naam, bv. Bruiloft warm"
          className="w-full rounded-lg bg-input/60 px-3 py-2 text-xs hairline"
        />
        <div className="flex gap-1.5">
          <button
            type="button"
            disabled={name.trim().length < 2 || saving}
            onClick={() => {
              setSaving(true);
              save.mutate(
                { name: name.trim(), scope: clientId ? "client" : "agency" },
                { onSettled: () => setSaving(false) },
              );
            }}
            className={cn(
              "inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-gold px-3 py-2 text-xs font-medium text-primary-foreground",
              "hover:opacity-90 disabled:opacity-50",
            )}
          >
            <Plus className="h-3.5 w-3.5" />
            {clientId ? "Bewaar voor deze klant" : "Bewaar"}
          </button>
          {clientId && (
            <button
              type="button"
              disabled={name.trim().length < 2 || saving}
              onClick={() => {
                setSaving(true);
                save.mutate(
                  { name: name.trim(), scope: "agency" },
                  { onSettled: () => setSaving(false) },
                );
              }}
              className="rounded-lg px-3 py-2 text-xs hairline hover:bg-accent/40 disabled:opacity-50"
              title="Voor alle klanten beschikbaar"
            >
              Bureaubreed
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
