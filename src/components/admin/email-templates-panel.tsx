import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { confirmDialog } from "@/components/ui/confirm";
import { Plus, Pencil, Trash2, Loader2, Save, X, Mail } from "lucide-react";
import {
  listEmailTemplates,
  upsertEmailTemplate,
  deleteEmailTemplate,
} from "@/lib/client-email.functions";
import type { Tables } from "@/integrations/supabase/types";

type Template = Tables<"email_templates">;
const EMPTY = { id: undefined as string | undefined, name: "", subject: "", body: "" };

export function EmailTemplatesPanel() {
  const qc = useQueryClient();
  const listFn = useServerFn(listEmailTemplates);
  const upsertFn = useServerFn(upsertEmailTemplate);
  const deleteFn = useServerFn(deleteEmailTemplate);

  const { data: templates, isLoading } = useQuery({
    queryKey: ["email-templates"],
    queryFn: () => listFn(),
  });

  const [editing, setEditing] = useState<typeof EMPTY | null>(null);
  const [saving, setSaving] = useState(false);

  function startNew() {
    setEditing({ ...EMPTY });
  }

  function startEdit(t: Template) {
    setEditing({ id: t.id, name: t.name, subject: t.subject, body: t.body });
  }

  async function save() {
    if (!editing) return;
    if (!editing.name.trim() || !editing.subject.trim() || !editing.body.trim()) {
      toast.error("Vul naam, onderwerp en tekst in");
      return;
    }
    setSaving(true);
    try {
      await upsertFn({
        data: {
          id: editing.id,
          name: editing.name.trim(),
          subject: editing.subject.trim(),
          body: editing.body.trim(),
        },
      });
      toast.success("Opgeslagen");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["email-templates"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Opslaan mislukt");
    } finally {
      setSaving(false);
    }
  }

  async function remove(t: Template) {
    if (!(await confirmDialog(`Sjabloon "${t.name}" verwijderen?`))) return;
    try {
      await deleteFn({ data: { id: t.id } });
      toast.success("Verwijderd");
      qc.invalidateQueries({ queryKey: ["email-templates"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Verwijderen mislukt");
    }
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="glass-strong rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.22em] text-gold/70 inline-flex items-center gap-2">
              <Mail className="h-3.5 w-3.5" /> E-mailsjablonen
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Herbruikbare onderwerp + tekst om naar klanten te sturen — vanuit het klantdossier
              kies je een sjabloon en vul je de ontvanger in. Gebruik{" "}
              <code className="text-gold">{"{{klant_naam}}"}</code> of{" "}
              <code className="text-gold">{"{{vandaag}}"}</code> voor variabelen.
            </p>
          </div>
          {!editing && (
            <button
              onClick={startNew}
              className="shrink-0 inline-flex items-center gap-2 rounded-full bg-gradient-gold px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              <Plus className="h-4 w-4" /> Nieuw sjabloon
            </button>
          )}
        </div>

        {editing && (
          <div className="mt-4 space-y-3 rounded-xl border border-gold/15 bg-background/40 p-4">
            <input
              value={editing.name}
              onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              placeholder="Naam (bijv. Maandrapport-aankondiging)"
              className="w-full rounded-lg bg-background/60 hairline px-3 py-2 text-sm"
            />
            <input
              value={editing.subject}
              onChange={(e) => setEditing({ ...editing, subject: e.target.value })}
              placeholder="Onderwerp"
              className="w-full rounded-lg bg-background/60 hairline px-3 py-2 text-sm"
            />
            <textarea
              value={editing.body}
              onChange={(e) => setEditing({ ...editing, body: e.target.value })}
              placeholder="Bericht…"
              rows={6}
              className="w-full rounded-lg bg-background/60 hairline px-3 py-2 text-sm resize-y"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setEditing(null)}
                className="inline-flex items-center gap-2 rounded-full glass px-4 py-2 text-sm hover:bg-accent/30"
              >
                <X className="h-4 w-4" /> Annuleren
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-full bg-gradient-gold px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}{" "}
                Opslaan
              </button>
            </div>
          </div>
        )}
      </div>

      {isLoading ? (
        <Loader2 className="h-6 w-6 animate-spin text-gold" />
      ) : (templates?.length ?? 0) === 0 ? (
        <div className="glass-strong rounded-xl p-8 text-center text-sm text-muted-foreground">
          Nog geen sjablonen — maak je eerste hierboven.
        </div>
      ) : (
        <div className="space-y-2">
          {templates?.map((t) => (
            <div key={t.id} className="glass rounded-xl p-4 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="font-medium text-sm">{t.name}</div>
                <div className="text-xs text-muted-foreground truncate">{t.subject}</div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => startEdit(t)}
                  className="min-h-9 min-w-9 grid place-items-center rounded-lg hover:bg-accent/40"
                  aria-label="Bewerk sjabloon"
                >
                  <Pencil className="h-4 w-4 text-gold" />
                </button>
                <button
                  onClick={() => remove(t)}
                  className="min-h-9 min-w-9 grid place-items-center rounded-lg hover:bg-destructive/10"
                  aria-label="Verwijder sjabloon"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
