import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Loader2, Trash2, Send, Webhook, CheckCircle2, XCircle } from "lucide-react";
import { useState } from "react";
import { testWebhook } from "@/lib/automation-admin.functions";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/admin/webhooks")({
  component: WebhooksPage,
});

type WebhookEndpointWithClient = Tables<"webhook_endpoints"> & {
  clients: Pick<Tables<"clients">, "name"> | null;
};
type WebhookDeliveryWithEndpoint = Tables<"webhook_deliveries"> & {
  webhook_endpoints: Pick<Tables<"webhook_endpoints">, "name"> | null;
};

const EVENTS = [
  "post.created",
  "post.published",
  "post.failed",
  "upload.created",
  "message.created",
  "task.created",
  "automation.run",
  "test.ping",
];

function WebhooksPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const testFn = useServerFn(testWebhook);
  const [testing, setTesting] = useState<string | null>(null);

  const { data: endpoints, isLoading } = useQuery({
    queryKey: ["webhooks"],
    queryFn: async () =>
      (
        await supabase
          .from("webhook_endpoints")
          .select("*, clients(name)")
          .order("created_at", { ascending: false })
      ).data ?? [],
  });
  const { data: deliveries } = useQuery({
    queryKey: ["webhook-deliveries"],
    queryFn: async () =>
      (
        await supabase
          .from("webhook_deliveries")
          .select("*, webhook_endpoints(name)")
          .order("created_at", { ascending: false })
          .limit(15)
      ).data ?? [],
  });

  async function remove(id: string) {
    if (!confirm("Webhook verwijderen?")) return;
    await supabase.from("webhook_endpoints").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["webhooks"] });
  }
  async function toggle(id: string, is_active: boolean) {
    await supabase.from("webhook_endpoints").update({ is_active: !is_active }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["webhooks"] });
  }
  async function runTest(ep: WebhookEndpointWithClient) {
    setTesting(ep.id);
    const res = await testFn({ data: { url: ep.url, secret: ep.secret ?? undefined } });
    setTesting(null);
    if (res.ok) toast.success(`Test verzonden (HTTP ${res.status})`);
    else toast.error(`Test mislukt: ${res.status} ${res.body}`);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-gold/80">Integraties</p>
          <h1 className="font-display text-5xl mt-2">Webhooks & Zapier</h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-xl">
            Verstuur events naar Zapier, Make, n8n of een eigen URL. Voeg een geheim toe voor
            HMAC-handtekening.
          </p>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="rounded-full bg-gradient-gold px-5 py-2.5 text-sm font-medium text-primary-foreground inline-flex items-center gap-2"
        >
          <Plus className="h-4 w-4" /> Nieuwe webhook
        </button>
      </div>

      {isLoading && <Loader2 className="h-6 w-6 animate-spin text-gold" />}

      <div className="grid gap-3">
        {(endpoints ?? []).map((e: WebhookEndpointWithClient) => (
          <div key={e.id} className="glass-strong rounded-xl p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Webhook className="h-4 w-4 text-gold" />
                  <span className="font-medium">{e.name}</span>
                  {e.clients?.name && (
                    <span className="text-xs text-gold/80">{e.clients.name}</span>
                  )}
                  {!e.is_active && (
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground border border-muted-foreground/30 rounded px-1.5 py-0.5">
                      Uit
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate mt-1">{e.url}</p>
                <div className="text-xs text-muted-foreground mt-2 flex flex-wrap gap-2">
                  {(e.events ?? []).map((ev: string) => (
                    <span key={ev} className="border border-gold/20 rounded-full px-2 py-0.5">
                      {ev}
                    </span>
                  ))}
                </div>
                {e.failure_count > 0 && (
                  <div className="text-xs text-destructive mt-1">
                    {e.failure_count} mislukte pogingen
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-1.5 shrink-0">
                <button
                  disabled={testing === e.id}
                  onClick={() => runTest(e)}
                  className="text-xs rounded-full border border-gold/40 text-gold hover:bg-gold/10 px-3 py-1.5 inline-flex items-center gap-1.5"
                >
                  <Send className="h-3 w-3" /> {testing === e.id ? "Bezig…" : "Test"}
                </button>
                <button
                  onClick={() => toggle(e.id, e.is_active)}
                  className="text-xs rounded-full border border-muted-foreground/30 hover:bg-accent/40 px-3 py-1.5"
                >
                  {e.is_active ? "Pauzeer" : "Activeer"}
                </button>
                <button
                  onClick={() => remove(e.id)}
                  className="text-xs rounded-full border border-destructive/40 text-destructive hover:bg-destructive/10 px-3 py-1.5 inline-flex items-center gap-1.5"
                >
                  <Trash2 className="h-3 w-3" /> Verwijder
                </button>
              </div>
            </div>
          </div>
        ))}
        {!isLoading && !endpoints?.length && (
          <div className="glass-strong rounded-2xl p-10 text-center text-sm text-muted-foreground">
            Geen webhooks. Maak in Zapier een "Webhooks by Zapier → Catch Hook" en plak die URL
            hier.
          </div>
        )}
      </div>

      {deliveries && deliveries.length > 0 && (
        <div>
          <h2 className="font-display text-2xl mb-3">Recente leveringen</h2>
          <div className="space-y-1.5">
            {deliveries.map((d: WebhookDeliveryWithEndpoint) => (
              <div
                key={d.id}
                className="text-xs glass rounded-lg p-2 flex items-center justify-between gap-2"
              >
                <span className="truncate flex items-center gap-2">
                  {d.status_code && d.status_code < 300 ? (
                    <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                  ) : (
                    <XCircle className="h-3 w-3 text-destructive" />
                  )}
                  {d.webhook_endpoints?.name ?? "—"} · {d.event}
                </span>
                <span className="text-muted-foreground">
                  {d.status_code ?? d.error_message ?? "?"}
                </span>
                <span className="text-muted-foreground">
                  {new Date(d.created_at).toLocaleString("nl-NL")}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {open && (
        <WebhookModal
          onClose={() => {
            setOpen(false);
            qc.invalidateQueries({ queryKey: ["webhooks"] });
          }}
        />
      )}
    </div>
  );
}

function WebhookModal({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({
    name: "",
    url: "",
    secret: "",
    client_id: "",
    events: ["post.published"] as string[],
  });
  const [saving, setSaving] = useState(false);
  const { data: clients } = useQuery({
    queryKey: ["clients-min"],
    queryFn: async () =>
      (await supabase.from("clients").select("id,name").order("name")).data ?? [],
  });

  function toggleEvent(e: string) {
    setForm((f) => ({
      ...f,
      events: f.events.includes(e) ? f.events.filter((x) => x !== e) : [...f.events, e],
    }));
  }

  async function save() {
    if (!form.name || !form.url) return toast.error("Naam en URL verplicht");
    if (!form.events.length) return toast.error("Kies minstens 1 event");
    setSaving(true);
    const { error } = await supabase.from("webhook_endpoints").insert({
      name: form.name,
      url: form.url,
      secret: form.secret || null,
      client_id: form.client_id || null,
      events: form.events,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Webhook opgeslagen");
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass-strong rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
      >
        <h2 className="font-display text-2xl mb-4">Nieuwe webhook</h2>
        <div className="space-y-3 text-sm">
          <label className="block">
            <span className="text-xs uppercase tracking-wider text-gold/80">Naam</span>
            <input
              className="input mt-1"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="text-xs uppercase tracking-wider text-gold/80">
              URL (Zapier Catch Hook)
            </span>
            <input
              className="input mt-1"
              placeholder="https://hooks.zapier.com/hooks/catch/..."
              value={form.url}
              onChange={(e) => setForm({ ...form, url: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="text-xs uppercase tracking-wider text-gold/80">
              Secret (optioneel, voor HMAC-handtekening)
            </span>
            <input
              className="input mt-1"
              value={form.secret}
              onChange={(e) => setForm({ ...form, secret: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="text-xs uppercase tracking-wider text-gold/80">Klant (optioneel)</span>
            <select
              className="input mt-1"
              value={form.client_id}
              onChange={(e) => setForm({ ...form, client_id: e.target.value })}
            >
              <option value="">— Alle klanten —</option>
              {(clients ?? []).map((c: Pick<Tables<"clients">, "id" | "name">) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <div>
            <span className="text-xs uppercase tracking-wider text-gold/80">Events</span>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {EVENTS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => toggleEvent(e)}
                  className={`text-xs rounded-full border px-2.5 py-1 ${form.events.includes(e) ? "bg-gold/15 border-gold/60 text-gold" : "border-muted-foreground/30 text-muted-foreground"}`}
                >
                  {e}
                </button>
              ))}
            </div>
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
