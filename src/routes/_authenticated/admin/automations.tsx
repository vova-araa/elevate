import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Zap, Loader2, Trash2, Play, Pause, Clock } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/admin/automations")({
  component: AutomationsPage,
});

const TRIGGERS = [
  { value: "schedule", label: "Op tijd (terugkerend)" },
  { value: "post_published", label: "Wanneer een post gepubliceerd wordt" },
  { value: "post_metric_threshold", label: "Wanneer post drempel bereikt (binnenkort)" },
  { value: "new_upload", label: "Bij nieuwe upload" },
  { value: "new_message", label: "Bij nieuw bericht" },
];
const ACTIONS = [
  { value: "create_notification", label: "Notificatie sturen" },
  { value: "create_task", label: "Taak aanmaken" },
  { value: "send_webhook", label: "Webhook (Zapier) versturen" },
  { value: "change_post_status", label: "Post-status wijzigen" },
];

function AutomationsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: rules, isLoading } = useQuery({
    queryKey: ["automation-rules"],
    queryFn: async () =>
      (
        await supabase
          .from("automation_rules")
          .select("*, clients(name)")
          .order("created_at", { ascending: false })
      ).data ?? [],
  });
  const { data: runs } = useQuery({
    queryKey: ["automation-runs"],
    queryFn: async () =>
      (
        await supabase
          .from("automation_runs")
          .select("*, automation_rules(name)")
          .order("created_at", { ascending: false })
          .limit(20)
      ).data ?? [],
  });

  async function toggle(id: string, is_active: boolean) {
    await supabase.from("automation_rules").update({ is_active: !is_active }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["automation-rules"] });
  }
  async function remove(id: string) {
    if (!confirm("Regel verwijderen?")) return;
    await supabase.from("automation_rules").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["automation-rules"] });
    toast.success("Verwijderd");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-gold/80">Automatisering</p>
          <h1 className="font-display text-5xl mt-2">Als-dit-dan-dat regels</h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-xl">
            Definieer triggers (op tijd, bij event) en automatische acties zoals notificaties, taken
            en webhooks.
          </p>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="rounded-full bg-gradient-gold px-5 py-2.5 text-sm font-medium text-primary-foreground inline-flex items-center gap-2"
        >
          <Plus className="h-4 w-4" /> Nieuwe regel
        </button>
      </div>

      {isLoading && <Loader2 className="h-6 w-6 animate-spin text-gold" />}

      <div className="grid gap-3">
        {(rules ?? []).map((r: any) => (
          <div
            key={r.id}
            className="glass-strong rounded-xl p-4 flex items-start justify-between gap-4"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Zap className="h-4 w-4 text-gold" />
                <span className="font-medium">{r.name}</span>
                {r.clients?.name && <span className="text-xs text-gold/80">{r.clients.name}</span>}
                {!r.is_active && (
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground border border-muted-foreground/30 rounded px-1.5 py-0.5">
                    Uit
                  </span>
                )}
              </div>
              {r.description && (
                <p className="text-sm text-muted-foreground mt-1">{r.description}</p>
              )}
              <div className="text-xs text-muted-foreground mt-2 flex flex-wrap gap-x-3 gap-y-1">
                <span>
                  Trigger:{" "}
                  <span className="text-foreground/80">
                    {TRIGGERS.find((t) => t.value === r.trigger_type)?.label ?? r.trigger_type}
                  </span>
                </span>
                <span>
                  Actie:{" "}
                  <span className="text-foreground/80">
                    {ACTIONS.find((a) => a.value === r.action_type)?.label ?? r.action_type}
                  </span>
                </span>
                <span>Runs: {r.run_count}</span>
                {r.last_run_at && (
                  <span>Laatst: {new Date(r.last_run_at).toLocaleString("nl-NL")}</span>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-1.5 shrink-0">
              <button
                onClick={() => toggle(r.id, r.is_active)}
                className="text-xs rounded-full border border-gold/40 text-gold hover:bg-gold/10 px-3 py-1.5 inline-flex items-center gap-1.5"
              >
                {r.is_active ? (
                  <>
                    <Pause className="h-3 w-3" /> Pauzeer
                  </>
                ) : (
                  <>
                    <Play className="h-3 w-3" /> Activeer
                  </>
                )}
              </button>
              <button
                onClick={() => remove(r.id)}
                className="text-xs rounded-full border border-destructive/40 text-destructive hover:bg-destructive/10 px-3 py-1.5 inline-flex items-center gap-1.5"
              >
                <Trash2 className="h-3 w-3" /> Verwijder
              </button>
            </div>
          </div>
        ))}
        {!isLoading && !rules?.length && (
          <div className="glass-strong rounded-2xl p-10 text-center text-sm text-muted-foreground">
            Nog geen automatiseringen. Maak je eerste regel om handwerk weg te nemen.
          </div>
        )}
      </div>

      {runs && runs.length > 0 && (
        <div>
          <h2 className="font-display text-2xl mb-3 flex items-center gap-2">
            <Clock className="h-4 w-4 text-gold" /> Recente runs
          </h2>
          <div className="space-y-1.5">
            {runs.map((r: any) => (
              <div
                key={r.id}
                className="text-xs glass rounded-lg p-2 flex items-center justify-between gap-2"
              >
                <span className="truncate">{r.automation_rules?.name ?? "—"}</span>
                <span className={r.status === "success" ? "text-emerald-400" : "text-destructive"}>
                  {r.status}
                </span>
                <span className="text-muted-foreground">
                  {new Date(r.created_at).toLocaleString("nl-NL")}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {open && (
        <RuleModal
          onClose={() => {
            setOpen(false);
            qc.invalidateQueries({ queryKey: ["automation-rules"] });
          }}
        />
      )}
    </div>
  );
}

function RuleModal({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState<any>({
    name: "",
    description: "",
    client_id: "",
    trigger_type: "schedule",
    trigger_config: { frequency: "weekly", day_of_week: 5, hour: 9 },
    action_type: "create_task",
    action_config: { title: "Weekrapport voorbereiden", due_in_days: 1 },
    is_active: true,
  });
  const { data: clients } = useQuery({
    queryKey: ["clients-min"],
    queryFn: async () =>
      (await supabase.from("clients").select("id,name").order("name")).data ?? [],
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!form.name) return toast.error("Naam is verplicht");
    setSaving(true);
    const { error } = await supabase.from("automation_rules").insert({
      name: form.name,
      description: form.description || null,
      client_id: form.client_id || null,
      trigger_type: form.trigger_type,
      trigger_config: form.trigger_config,
      action_type: form.action_type,
      action_config: form.action_config,
      is_active: form.is_active,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Regel opgeslagen");
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass-strong rounded-2xl p-6 w-full max-w-xl max-h-[90vh] overflow-y-auto"
      >
        <h2 className="font-display text-2xl mb-4">Nieuwe automatisering</h2>
        <div className="space-y-3 text-sm">
          <Field label="Naam">
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>
          <Field label="Beschrijving">
            <textarea
              className="input min-h-20"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </Field>
          <Field label="Klant (optioneel)">
            <select
              className="input"
              value={form.client_id}
              onChange={(e) => setForm({ ...form, client_id: e.target.value })}
            >
              <option value="">— Alle klanten —</option>
              {(clients ?? []).map((c: any) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>

          <div className="border-t border-gold/10 pt-3">
            <Field label="Trigger">
              <select
                className="input"
                value={form.trigger_type}
                onChange={(e) => setForm({ ...form, trigger_type: e.target.value })}
              >
                {TRIGGERS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </Field>
            {form.trigger_type === "schedule" && (
              <div className="grid grid-cols-3 gap-2 mt-2">
                <Field label="Frequentie">
                  <select
                    className="input"
                    value={form.trigger_config.frequency}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        trigger_config: { ...form.trigger_config, frequency: e.target.value },
                      })
                    }
                  >
                    <option value="daily">Dagelijks</option>
                    <option value="weekly">Wekelijks</option>
                    <option value="monthly">Maandelijks</option>
                  </select>
                </Field>
                <Field label="Uur (UTC)">
                  <input
                    type="number"
                    min={0}
                    max={23}
                    className="input"
                    value={form.trigger_config.hour ?? 9}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        trigger_config: { ...form.trigger_config, hour: Number(e.target.value) },
                      })
                    }
                  />
                </Field>
                {form.trigger_config.frequency === "weekly" && (
                  <Field label="Dag (0=zo)">
                    <input
                      type="number"
                      min={0}
                      max={6}
                      className="input"
                      value={form.trigger_config.day_of_week ?? 1}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          trigger_config: {
                            ...form.trigger_config,
                            day_of_week: Number(e.target.value),
                          },
                        })
                      }
                    />
                  </Field>
                )}
                {form.trigger_config.frequency === "monthly" && (
                  <Field label="Dag v/d maand">
                    <input
                      type="number"
                      min={1}
                      max={28}
                      className="input"
                      value={form.trigger_config.day_of_month ?? 1}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          trigger_config: {
                            ...form.trigger_config,
                            day_of_month: Number(e.target.value),
                          },
                        })
                      }
                    />
                  </Field>
                )}
              </div>
            )}
          </div>

          <div className="border-t border-gold/10 pt-3">
            <Field label="Actie">
              <select
                className="input"
                value={form.action_type}
                onChange={(e) =>
                  setForm({ ...form, action_type: e.target.value, action_config: {} })
                }
              >
                {ACTIONS.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </select>
            </Field>
            {form.action_type === "create_notification" && (
              <div className="grid gap-2 mt-2">
                <Field label="Titel">
                  <input
                    className="input"
                    value={form.action_config.title ?? ""}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        action_config: { ...form.action_config, title: e.target.value },
                      })
                    }
                  />
                </Field>
                <Field label="Bericht">
                  <input
                    className="input"
                    value={form.action_config.body ?? ""}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        action_config: { ...form.action_config, body: e.target.value },
                      })
                    }
                  />
                </Field>
              </div>
            )}
            {form.action_type === "create_task" && (
              <div className="grid grid-cols-[1fr_120px] gap-2 mt-2">
                <Field label="Taak titel">
                  <input
                    className="input"
                    value={form.action_config.title ?? ""}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        action_config: { ...form.action_config, title: e.target.value },
                      })
                    }
                  />
                </Field>
                <Field label="Deadline (dagen)">
                  <input
                    type="number"
                    min={0}
                    className="input"
                    value={form.action_config.due_in_days ?? 1}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        action_config: {
                          ...form.action_config,
                          due_in_days: Number(e.target.value),
                        },
                      })
                    }
                  />
                </Field>
              </div>
            )}
            {form.action_type === "send_webhook" && (
              <Field label="Webhook URL">
                <input
                  className="input"
                  placeholder="https://hooks.zapier.com/..."
                  value={form.action_config.url ?? ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      action_config: { ...form.action_config, url: e.target.value },
                    })
                  }
                />
              </Field>
            )}
            {form.action_type === "change_post_status" && (
              <div className="grid grid-cols-2 gap-2 mt-2">
                <Field label="Van status">
                  <select
                    className="input"
                    value={form.action_config.from_status ?? "draft"}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        action_config: { ...form.action_config, from_status: e.target.value },
                      })
                    }
                  >
                    <option value="draft">draft</option>
                    <option value="scheduled">scheduled</option>
                    <option value="published">published</option>
                  </select>
                </Field>
                <Field label="Naar status">
                  <select
                    className="input"
                    value={form.action_config.to_status ?? "scheduled"}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        action_config: { ...form.action_config, to_status: e.target.value },
                      })
                    }
                  >
                    <option value="draft">draft</option>
                    <option value="scheduled">scheduled</option>
                    <option value="published">published</option>
                  </select>
                </Field>
              </div>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className="text-sm rounded-full px-4 py-2 hover:bg-accent/40">
            Annuleren
          </button>
          <button
            disabled={saving}
            onClick={save}
            className="text-sm rounded-full bg-gradient-gold px-5 py-2 text-primary-foreground"
          >
            {saving ? "Opslaan…" : "Opslaan"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-wider text-gold/80">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
