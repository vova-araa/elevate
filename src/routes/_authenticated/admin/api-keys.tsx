import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Loader2, Trash2, Key, Copy, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { createApiKey } from "@/lib/automation-admin.functions";

export const Route = createFileRoute("/_authenticated/admin/api-keys")({
  component: ApiKeysPage,
});

function ApiKeysPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["api-keys"],
    queryFn: async () =>
      (
        await supabase
          .from("api_keys")
          .select("*, clients(name)")
          .order("created_at", { ascending: false })
      ).data ?? [],
  });

  async function remove(id: string) {
    if (!confirm("Sleutel intrekken?")) return;
    await supabase.from("api_keys").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["api-keys"] });
    toast.success("Ingetrokken");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-gold/80">Integraties</p>
          <h1 className="font-display text-5xl mt-2">API sleutels</h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
            Geef externe tools toegang via REST. Endpoints:{" "}
            <code className="text-gold">GET /api/public/v1/clients</code>,
            <code className="text-gold ml-1">GET/POST /api/public/v1/posts</code>. Auth:{" "}
            <code className="text-gold">Authorization: Bearer eak_…</code>
          </p>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="rounded-full bg-gradient-gold px-5 py-2.5 text-sm font-medium text-primary-foreground inline-flex items-center gap-2"
        >
          <Plus className="h-4 w-4" /> Nieuwe sleutel
        </button>
      </div>

      {newKey && (
        <div className="glass-strong rounded-2xl p-5 border border-gold/40">
          <p className="text-sm text-gold font-medium mb-2">
            Bewaar deze sleutel nu — hij wordt niet opnieuw getoond.
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <code className="bg-background/60 rounded px-3 py-2 text-sm break-all">
              {showKey ? newKey : "•".repeat(36)}
            </code>
            <button
              onClick={() => setShowKey((s) => !s)}
              className="rounded-full p-2 hover:bg-accent/40"
            >
              {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
            <button
              onClick={() => {
                navigator.clipboard.writeText(newKey);
                toast.success("Gekopieerd");
              }}
              className="rounded-full p-2 hover:bg-accent/40"
            >
              <Copy className="h-4 w-4" />
            </button>
            <button
              onClick={() => {
                setNewKey(null);
                setShowKey(false);
              }}
              className="ml-auto text-xs rounded-full border border-gold/40 text-gold px-3 py-1.5"
            >
              Sluit
            </button>
          </div>
        </div>
      )}

      {isLoading && <Loader2 className="h-6 w-6 animate-spin text-gold" />}

      <div className="grid gap-3">
        {(data ?? []).map((k: any) => (
          <div
            key={k.id}
            className="glass-strong rounded-xl p-4 flex items-start justify-between gap-4"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Key className="h-4 w-4 text-gold" />
                <span className="font-medium">{k.name}</span>
                {k.clients?.name && <span className="text-xs text-gold/80">{k.clients.name}</span>}
              </div>
              <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-3">
                <span>
                  Prefix: <code>{k.key_prefix}…</code>
                </span>
                <span>Scopes: {(k.scopes ?? []).join(", ")}</span>
                {k.last_used_at && (
                  <span>Laatst gebruikt: {new Date(k.last_used_at).toLocaleString("nl-NL")}</span>
                )}
              </div>
            </div>
            <button
              onClick={() => remove(k.id)}
              className="text-xs rounded-full border border-destructive/40 text-destructive hover:bg-destructive/10 px-3 py-1.5 inline-flex items-center gap-1.5"
            >
              <Trash2 className="h-3 w-3" /> Intrekken
            </button>
          </div>
        ))}
        {!isLoading && !data?.length && (
          <div className="glass-strong rounded-2xl p-10 text-center text-sm text-muted-foreground">
            Geen sleutels.
          </div>
        )}
      </div>

      {open && (
        <NewKeyModal
          onClose={(t) => {
            setOpen(false);
            if (t) setNewKey(t);
            qc.invalidateQueries({ queryKey: ["api-keys"] });
          }}
        />
      )}
    </div>
  );
}

function NewKeyModal({ onClose }: { onClose: (token?: string) => void }) {
  const [form, setForm] = useState({ name: "", client_id: "", scopes: ["read"] as string[] });
  const [saving, setSaving] = useState(false);
  const createFn = useServerFn(createApiKey);
  const { data: clients } = useQuery({
    queryKey: ["clients-min"],
    queryFn: async () =>
      (await supabase.from("clients").select("id,name").order("name")).data ?? [],
  });

  async function save() {
    if (!form.name) return toast.error("Naam verplicht");
    setSaving(true);
    try {
      const res = await createFn({
        data: { name: form.name, client_id: form.client_id || null, scopes: form.scopes as any },
      });
      onClose(res.token);
    } catch (e: any) {
      toast.error(e.message ?? "Fout");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/70 backdrop-blur-sm"
      onClick={() => onClose()}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass-strong rounded-2xl p-6 w-full max-w-md"
      >
        <h2 className="font-display text-2xl mb-4">Nieuwe API sleutel</h2>
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
              Klant (optioneel — beperkt toegang)
            </span>
            <select
              className="input mt-1"
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
          </label>
          <div>
            <span className="text-xs uppercase tracking-wider text-gold/80">Rechten</span>
            <div className="flex gap-2 mt-1">
              {["read", "write"].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      scopes: f.scopes.includes(s)
                        ? f.scopes.filter((x) => x !== s)
                        : [...f.scopes, s],
                    }))
                  }
                  className={`text-xs rounded-full border px-3 py-1 ${form.scopes.includes(s) ? "bg-gold/15 border-gold/60 text-gold" : "border-muted-foreground/30"}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={() => onClose()}
            className="text-sm rounded-full px-4 py-2 hover:bg-accent/40"
          >
            Annuleren
          </button>
          <button
            disabled={saving}
            onClick={save}
            className="text-sm rounded-full bg-gradient-gold px-5 py-2 text-primary-foreground"
          >
            {saving ? "Aanmaken…" : "Aanmaken"}
          </button>
        </div>
      </div>
    </div>
  );
}
