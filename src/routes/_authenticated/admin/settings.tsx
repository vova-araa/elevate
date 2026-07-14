import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useAuth } from "@/lib/auth-context";
import { z } from "zod";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Loader2,
  Building2,
  Users,
  Bell,
  Link2,
  Plus,
  Trash2,
  Save,
  Instagram,
  Music2,
  Linkedin,
  Youtube,
  Facebook,
  ShieldCheck,
  UserPlus,
  Zap,
  Plug,
  Key,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  initPostizConnect,
  disconnectPostizChannel,
  syncPostizConnection,
  claimPostizIntegration,
} from "@/lib/postiz-connect.functions";
import { listPostizIntegrations } from "@/lib/postiz.functions";

const searchSchema = z.object({
  clientId: z.string().uuid().optional(),
  tab: z.enum(["bedrijf", "social", "team", "notificaties"]).optional(),
});

export const Route = createFileRoute("/_authenticated/admin/settings")({
  validateSearch: searchSchema,
  component: SettingsPage,
});

const PLATFORMS = [
  { k: "instagram", label: "Instagram", icon: Instagram, color: "#E4405F" },
  { k: "tiktok", label: "TikTok", icon: Music2, color: "#000000" },
  { k: "linkedin", label: "LinkedIn", icon: Linkedin, color: "#0A66C2" },
  { k: "youtube", label: "YouTube", icon: Youtube, color: "#FF0000" },
  { k: "facebook", label: "Facebook", icon: Facebook, color: "#1877F2" },
] as const;

function SettingsPage() {
  const { clientId, tab } = Route.useSearch();
  const navigate = useNavigate();
  const activeTab = tab ?? "bedrijf";

  const { data: clients } = useQuery({
    queryKey: ["clients-settings"],
    queryFn: async () =>
      (await supabase.from("clients").select("id,name,brand_color,logo_url").order("name")).data ??
      [],
  });

  const selected = clients?.find((c) => c.id === clientId) ?? clients?.[0];
  const activeId = selected?.id;

  if (!clientId && activeId) {
    navigate({
      to: "/admin/settings",
      search: { clientId: activeId, tab: activeTab },
      replace: true,
    });
  }

  if (!clients) return <Loader2 className="h-6 w-6 animate-spin text-gold" />;
  if (clients.length === 0) {
    return (
      <div className="glass-strong rounded-xl p-8 text-center text-muted-foreground">
        Voeg eerst een klant toe via{" "}
        <Link to="/admin/clients/new" className="text-gold underline">
          Klanten
        </Link>
        .
      </div>
    );
  }

  const tabs = [
    { k: "bedrijf", label: "Bedrijf", icon: Building2 },
    { k: "social", label: "Social accounts", icon: Link2 },
    { k: "team", label: "Team & rollen", icon: Users },
    { k: "notificaties", label: "Notificaties", icon: Bell },
  ] as const;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[0.25em] text-gold/70">Module 7</div>
          <h1 className="font-display text-3xl sm:text-4xl text-gold mt-1">Account & Bedrijf</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Bedrijfsprofiel, social accounts, team en notificatievoorkeuren.
          </p>
        </div>
        <select
          value={activeId ?? ""}
          onChange={(e) =>
            navigate({
              to: "/admin/settings",
              search: { clientId: e.target.value, tab: activeTab },
            })
          }
          className="rounded-lg border border-gold/20 bg-background/60 px-3 py-2 text-sm"
        >
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-1 border-b border-gold/10">
        {tabs.map((t) => (
          <button
            key={t.k}
            onClick={() =>
              navigate({ to: "/admin/settings", search: { clientId: activeId, tab: t.k } })
            }
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 text-sm border-b-2 -mb-px transition",
              activeTab === t.k
                ? "border-gold text-gold"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <t.icon className="h-4 w-4" /> {t.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground self-center mr-2">
          Beheer
        </span>
        <Link
          to="/admin/users"
          className="flex items-center gap-2 rounded-full border border-gold/20 bg-background/40 px-3 py-1.5 text-xs text-muted-foreground hover:text-gold hover:border-gold/40 transition"
        >
          <Users className="h-3.5 w-3.5" /> Gebruikers
        </Link>
        <Link
          to="/admin/api-keys"
          className="flex items-center gap-2 rounded-full border border-gold/20 bg-background/40 px-3 py-1.5 text-xs text-muted-foreground hover:text-gold hover:border-gold/40 transition"
        >
          <Key className="h-3.5 w-3.5" /> API sleutels
        </Link>
        <Link
          to="/admin/webhooks"
          className="flex items-center gap-2 rounded-full border border-gold/20 bg-background/40 px-3 py-1.5 text-xs text-muted-foreground hover:text-gold hover:border-gold/40 transition"
        >
          <Plug className="h-3.5 w-3.5" /> Kanalen
        </Link>
        <Link
          to="/admin/automations"
          className="flex items-center gap-2 rounded-full border border-gold/20 bg-background/40 px-3 py-1.5 text-xs text-muted-foreground hover:text-gold hover:border-gold/40 transition"
        >
          <Bell className="h-3.5 w-3.5" /> Alerts
        </Link>
      </div>

      {activeId && (
        <>
          {activeTab === "bedrijf" && <BrandTab clientId={activeId} />}
          {activeTab === "social" && <SocialTab clientId={activeId} />}
          {activeTab === "team" && <TeamTab clientId={activeId} />}
          {activeTab === "notificaties" && <NotificationsTab />}
        </>
      )}
    </div>
  );
}

/* ──────────────  BRAND  ────────────── */
function BrandTab({ clientId }: { clientId: string }) {
  const qc = useQueryClient();
  const { data: c } = useQuery({
    queryKey: ["client-full", clientId],
    queryFn: async () =>
      (await supabase.from("clients").select("*").eq("id", clientId).maybeSingle()).data,
  });
  const [form, setForm] = useState<Partial<Tables<"clients">>>({});
  useEffect(() => {
    if (c) setForm(c);
  }, [c]);

  async function save() {
    const { error } = await supabase
      .from("clients")
      .update({
        name: form.name,
        description: form.description,
        industry: form.industry,
        website: form.website,
        brand_color: form.brand_color,
        notes: form.notes,
      })
      .eq("id", clientId);
    if (error) return toast.error(error.message);
    toast.success("Opgeslagen");
    qc.invalidateQueries({ queryKey: ["client-full", clientId] });
    qc.invalidateQueries({ queryKey: ["clients-settings"] });
  }

  async function uploadLogo(file: File) {
    if (!file.type.startsWith("image/")) return toast.error("Alleen afbeeldingen toegestaan");
    if (file.size > 5 * 1024 * 1024) return toast.error("Max 5MB");
    const ext = file.name.split(".").pop() || "png";
    const path = `${clientId}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("client-logos")
      .upload(path, file, { upsert: true });
    if (upErr) return toast.error(upErr.message);
    const { data: pub } = supabase.storage.from("client-logos").getPublicUrl(path);
    const url = pub.publicUrl;
    const { error } = await supabase.from("clients").update({ logo_url: url }).eq("id", clientId);
    if (error) return toast.error(error.message);
    setForm({ ...form, logo_url: url });
    toast.success("Logo bijgewerkt");
    qc.invalidateQueries({ queryKey: ["client-full", clientId] });
    qc.invalidateQueries({ queryKey: ["clients-settings"] });
    qc.invalidateQueries({ queryKey: ["clients"] });
  }

  async function removeLogo() {
    const { error } = await supabase.from("clients").update({ logo_url: null }).eq("id", clientId);
    if (error) return toast.error(error.message);
    setForm({ ...form, logo_url: null });
    toast.success("Logo verwijderd");
    qc.invalidateQueries({ queryKey: ["client-full", clientId] });
    qc.invalidateQueries({ queryKey: ["clients-settings"] });
    qc.invalidateQueries({ queryKey: ["clients"] });
  }

  if (!c) return <Loader2 className="h-6 w-6 animate-spin text-gold" />;

  return (
    <div className="glass-strong rounded-xl p-6 space-y-4 max-w-3xl">
      <div>
        <label className="text-xs uppercase tracking-wider text-muted-foreground">
          Logo / Avatar
        </label>
        <div className="mt-2 flex items-center gap-4">
          {form.logo_url ? (
            <img
              src={form.logo_url}
              alt={form.name}
              className="h-16 w-16 rounded-full object-cover border border-gold/20"
            />
          ) : (
            <div
              className="h-16 w-16 rounded-full flex items-center justify-center font-display text-2xl text-primary-foreground"
              style={{ background: form.brand_color || "var(--gradient-gold)" }}
            >
              {form.name?.[0]?.toUpperCase()}
            </div>
          )}
          <div className="flex flex-col gap-2">
            <label className="cursor-pointer inline-flex items-center gap-2 rounded-lg hairline px-3 py-2 text-sm text-gold hover:bg-gold/10">
              {form.logo_url ? "Vervangen" : "Upload logo"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && uploadLogo(e.target.files[0])}
              />
            </label>
            {form.logo_url && (
              <button
                onClick={removeLogo}
                className="text-xs text-muted-foreground hover:text-destructive text-left"
              >
                Verwijder logo (gebruik weer kleur)
              </button>
            )}
          </div>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Wanneer er een logo is, wordt dat overal getoond in plaats van het gekleurde rondje.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Field
          label="Bedrijfsnaam"
          value={form.name}
          onChange={(v: string) => setForm({ ...form, name: v })}
        />
        <Field
          label="Branche"
          value={form.industry}
          onChange={(v: string) => setForm({ ...form, industry: v })}
        />
        <Field
          label="Website"
          value={form.website}
          onChange={(v: string) => setForm({ ...form, website: v })}
          placeholder="https://..."
        />
        <div>
          <label className="text-xs uppercase tracking-wider text-muted-foreground">
            Brandkleur (fallback)
          </label>
          <div className="flex gap-2 mt-1">
            <input
              type="color"
              value={form.brand_color || "#D4B97A"}
              onChange={(e) => setForm({ ...form, brand_color: e.target.value })}
              className="h-10 w-16 rounded border border-gold/20 bg-transparent"
            />
            <input
              value={form.brand_color || ""}
              onChange={(e) => setForm({ ...form, brand_color: e.target.value })}
              className="flex-1 rounded-lg border border-gold/20 bg-background/60 px-3 py-2 text-sm"
            />
          </div>
        </div>
      </div>
      <div>
        <label className="text-xs uppercase tracking-wider text-muted-foreground">
          Korte beschrijving
        </label>
        <textarea
          value={form.description || ""}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          rows={3}
          className="mt-1 w-full rounded-lg border border-gold/20 bg-background/60 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="text-xs uppercase tracking-wider text-muted-foreground">
          Interne notities
        </label>
        <textarea
          value={form.notes || ""}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          rows={3}
          className="mt-1 w-full rounded-lg border border-gold/20 bg-background/60 px-3 py-2 text-sm"
        />
      </div>
      <button
        onClick={save}
        className="rounded-lg bg-gradient-gold px-4 py-2.5 text-sm font-medium text-primary-foreground inline-flex items-center gap-2"
      >
        <Save className="h-4 w-4" /> Opslaan
      </button>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value?: string | null;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</label>
      <input
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-lg border border-gold/20 bg-background/60 px-3 py-2 text-sm"
      />
    </div>
  );
}

type Platform = (typeof PLATFORMS)[number]["k"];

interface PostizIntegrationView {
  id: string | number;
  username?: string | null;
  name?: string | null;
  platform?: string | null;
  assignedClientId?: string | null;
  assignedClientName?: string | null;
}

interface SyncResult {
  ok: true;
  connected: boolean;
  reason?: string;
  handle?: string;
  integrationId?: string;
  claimable?: { id: string; name: string; picture: string | null }[];
}

/* ──────────────  SOCIAL (Postiz OAuth)  ────────────── */
function SocialTab({ clientId }: { clientId: string }) {
  const qc = useQueryClient();
  const { data: conns } = useQuery({
    queryKey: ["social-conns", clientId],
    queryFn: async () =>
      (await supabase.from("social_connections").select("*").eq("client_id", clientId)).data ?? [],
  });
  const listIntegrationsFn = useServerFn(listPostizIntegrations);
  const { data: postizIntegrations, isFetching: refreshing } = useQuery({
    queryKey: ["postiz-integrations"],
    queryFn: async () => (await listIntegrationsFn()) as PostizIntegrationView[],
    refetchOnWindowFocus: true,
  });
  const [busy, setBusy] = useState<string | null>(null);

  const init = useServerFn(initPostizConnect);
  const disconnect = useServerFn(disconnectPostizChannel);
  const sync = useServerFn(syncPostizConnection);
  const claim = useServerFn(claimPostizIntegration);

  async function refreshAll() {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["postiz-integrations"] }),
      qc.invalidateQueries({ queryKey: ["social-conns", clientId] }),
    ]);
  }

  async function syncPlatform(platform: Platform, showToast = true) {
    setBusy(platform);
    try {
      const result: SyncResult = await sync({ data: { clientId, platform } });
      await refreshAll();
      if (showToast) {
        toast[result?.connected ? "success" : "info"](
          result?.connected
            ? `${platform} gekoppeld${result?.handle ? `: ${result.handle}` : ""}`
            : (result?.reason ?? "Nog geen nieuwe Postiz-koppeling gevonden"),
        );
      }
      return result;
    } catch (e) {
      if (showToast) toast.error(e instanceof Error ? e.message : "Postiz-status ophalen mislukt");
    } finally {
      setBusy(null);
    }
  }

  async function connectPlatform(platform: Platform) {
    setBusy(platform);
    try {
      const { redirectUrl } = await init({ data: { clientId, platform } });
      const opened = window.open(redirectUrl, "_blank", "noopener,noreferrer");
      if (!opened)
        throw new Error(
          "De browser blokkeerde het Postiz-tabblad. Sta pop-ups toe en probeer opnieuw.",
        );
      toast.info(`Rond ${platform} af in het Postiz-tabblad. We checken de status automatisch.`);
      // Poll several times — covers fast and slow OAuth flows.
      [4000, 9000, 18000, 35000].forEach((ms) =>
        window.setTimeout(() => syncPlatform(platform, false), ms),
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Koppelen mislukt");
    } finally {
      setBusy(null);
    }
  }

  async function remove(conn: Tables<"social_connections">) {
    if (!confirm("Verbinding verwijderen?")) return;
    try {
      await disconnect({ data: { clientId, platform: conn.platform as Platform } });
      await refreshAll();
      toast.success("Losgekoppeld");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Loskoppelen mislukt");
    }
  }

  // Re-sync alle platformen wanneer tab focus terugkomt (na OAuth tab sluiten).
  useEffect(() => {
    function onFocus() {
      refreshAll();
    }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  const integrationsList: PostizIntegrationView[] = Array.isArray(postizIntegrations)
    ? postizIntegrations
    : [];
  // Per platform: voor déze klant gereserveerd of nog vrij (claimable).
  const integrationsByPlatform = new Map<string, PostizIntegrationView[]>();
  for (const i of integrationsList) {
    const platform = String(i.platform ?? "").toLowerCase();
    if (!platform) continue;
    if (!integrationsByPlatform.has(platform)) integrationsByPlatform.set(platform, []);
    integrationsByPlatform.get(platform)!.push(i);
  }

  return (
    <div className="space-y-3">
      <div className="glass-strong rounded-xl p-4 text-xs text-muted-foreground flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Zap className="h-3.5 w-3.5 text-gold shrink-0" />
          Platforms worden gekoppeld via je Postiz workspace. Na autoriseren synct deze pagina
          automatisch.
        </div>
        <button
          onClick={async () => {
            setBusy("__all__");
            for (const p of PLATFORMS) {
              await syncPlatform(p.k, false);
            }
            setBusy(null);
            toast.success("Synchronisatie afgerond");
          }}
          disabled={busy !== null}
          className="text-[10px] uppercase tracking-wider text-gold/80 rounded-lg border border-gold/20 px-2 py-1 hover:bg-gold/10 disabled:opacity-50 flex items-center gap-1.5"
        >
          {(busy === "__all__" || refreshing) && <Loader2 className="h-3 w-3 animate-spin" />}
          Sync alle
        </button>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        {PLATFORMS.map((p) => {
          const conn = conns?.find((c) => c.platform === p.k);
          const platformIntegrations = integrationsByPlatform.get(p.k) ?? [];
          const ownIntegration = conn?.postiz_integration_id
            ? platformIntegrations.find((i) => String(i.id) === String(conn.postiz_integration_id))
            : platformIntegrations.find((i) => i.assignedClientId === clientId);
          const claimable = platformIntegrations.filter((i) => !i.assignedClientId);
          const otherClient =
            !conn && !ownIntegration && claimable.length === 0
              ? platformIntegrations.find(
                  (i) => i.assignedClientId && i.assignedClientId !== clientId,
                )
              : null;
          const Icon = p.icon;
          const isBusy = busy === p.k;
          const handle = conn?.account_username ?? ownIntegration?.username ?? ownIntegration?.name;
          const isLinked = Boolean(conn && conn.status === "active");

          return (
            <div key={p.k} className="glass-strong rounded-xl p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <Icon className="h-5 w-5 shrink-0" style={{ color: p.color }} />
                  <div className="min-w-0">
                    <div className="text-sm font-medium flex items-center gap-1.5">
                      {p.label}
                      <Zap className="h-3 w-3 text-gold" aria-label="Postiz OAuth" />
                      {isLinked && (
                        <span className="text-[10px] rounded-full bg-emerald-500/15 text-emerald-400 px-1.5 py-0.5">
                          gekoppeld
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {isLinked ? (
                        <>
                          {handle ?? "Gekoppeld via Postiz"}
                          {typeof conn?.follower_count === "number" && (
                            <span className="ml-1 text-muted-foreground/70">
                              · {conn.follower_count.toLocaleString("nl-NL")} volgers
                            </span>
                          )}
                        </>
                      ) : otherClient ? (
                        <span className="text-amber-400/80">
                          In gebruik door {otherClient.assignedClientName ?? "andere klant"}
                        </span>
                      ) : claimable.length > 0 ? (
                        <>
                          Postiz-account beschikbaar (
                          {claimable[0].username ?? claimable[0].name ?? "naamloos"})
                        </>
                      ) : (
                        "Niet gekoppeld"
                      )}
                    </div>
                  </div>
                </div>
                {isLinked ? (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => syncPlatform(p.k)}
                      disabled={isBusy}
                      title="Status verversen"
                      className="text-[10px] uppercase tracking-wider text-muted-foreground rounded-lg border border-gold/10 px-2 py-1 hover:bg-gold/10 disabled:opacity-50"
                    >
                      {isBusy ? "…" : "Sync"}
                    </button>
                    <button
                      onClick={() => conn && remove(conn)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ) : claimable.length > 1 ? (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <select
                      defaultValue=""
                      disabled={isBusy}
                      onChange={async (e) => {
                        const integrationId = e.target.value;
                        if (!integrationId) return;
                        setBusy(p.k);
                        try {
                          await claim({ data: { clientId, platform: p.k, integrationId } });
                          await refreshAll();
                          toast.success(`${p.label} gekoppeld`);
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : "Koppelen mislukt");
                        } finally {
                          setBusy(null);
                        }
                      }}
                      className="text-xs rounded-lg border border-gold/20 bg-background/60 px-2 py-1.5 max-w-[140px]"
                    >
                      <option value="">Kies account…</option>
                      {claimable.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.username ?? i.name ?? i.id}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : claimable.length === 1 || ownIntegration ? (
                  <button
                    onClick={() => syncPlatform(p.k)}
                    disabled={isBusy}
                    className="text-xs rounded-lg bg-gradient-gold px-3 py-1.5 text-primary-foreground disabled:opacity-50 flex items-center gap-1.5 shrink-0"
                  >
                    {isBusy && <Loader2 className="h-3 w-3 animate-spin" />}
                    Koppelen
                  </button>
                ) : (
                  <button
                    onClick={() => connectPlatform(p.k)}
                    disabled={isBusy}
                    className="text-xs rounded-lg bg-gradient-gold px-3 py-1.5 text-primary-foreground disabled:opacity-50 flex items-center gap-1.5 shrink-0"
                  >
                    {isBusy && <Loader2 className="h-3 w-3 animate-spin" />}
                    Verbind via Postiz
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ──────────────  TEAM  ────────────── */
function TeamTab({ clientId }: { clientId: string }) {
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "editor" | "client">("client");

  const { data: members } = useQuery({
    queryKey: ["team", clientId],
    queryFn: async () => {
      const { data: m } = await supabase
        .from("client_members")
        .select("id,user_id,created_at")
        .eq("client_id", clientId);
      if (!m?.length) return [];
      const ids = m.map((x) => x.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id,full_name,email,avatar_url")
        .in("id", ids);
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id,role")
        .in("user_id", ids);
      return m.map((row) => ({
        ...row,
        profile: profiles?.find((p) => p.id === row.user_id),
        roles: roles?.filter((r) => r.user_id === row.user_id).map((r) => r.role) ?? [],
      }));
    },
  });

  async function addMember() {
    if (!email.trim()) return toast.error("E-mail verplicht");
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", email.trim().toLowerCase())
      .maybeSingle();
    if (!profile)
      return toast.error("Geen gebruiker met dit e-mailadres gevonden. Laat ze eerst registreren.");
    const { error } = await supabase
      .from("client_members")
      .insert({ client_id: clientId, user_id: profile.id });
    if (error) return toast.error(error.message);
    // Ensure role exists
    await supabase
      .from("user_roles")
      .upsert({ user_id: profile.id, role }, { onConflict: "user_id,role" });
    setEmail("");
    toast.success("Teamlid toegevoegd");
    qc.invalidateQueries({ queryKey: ["team", clientId] });
  }

  async function removeMember(id: string) {
    if (!confirm("Teamlid verwijderen van deze klant?")) return;
    await supabase.from("client_members").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["team", clientId] });
  }

  async function updateRole(userId: string, newRole: "admin" | "editor" | "client") {
    // Replace existing roles for this user with the new one (simple model)
    await supabase.from("user_roles").delete().eq("user_id", userId);
    await supabase.from("user_roles").insert({ user_id: userId, role: newRole });
    toast.success("Rol bijgewerkt");
    qc.invalidateQueries({ queryKey: ["team", clientId] });
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="glass-strong rounded-xl p-4">
        <div className="text-sm uppercase tracking-[0.2em] text-gold/70 mb-3 flex items-center gap-2">
          <UserPlus className="h-4 w-4" /> Teamlid toevoegen
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="e-mailadres"
            type="email"
            className="flex-1 rounded-lg border border-gold/20 bg-background/60 px-3 py-2 text-sm"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as "admin" | "editor" | "client")}
            className="rounded-lg border border-gold/20 bg-background/60 px-3 py-2 text-sm"
          >
            <option value="client">Klant viewer</option>
            <option value="editor">Editor</option>
            <option value="admin">Admin</option>
          </select>
          <button
            onClick={addMember}
            className="rounded-lg bg-gradient-gold px-4 py-2 text-sm font-medium text-primary-foreground inline-flex items-center gap-2"
          >
            <Plus className="h-4 w-4" /> Voeg toe
          </button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          De gebruiker moet eerst een account aanmaken via de signup-pagina.
        </p>
      </div>

      <div className="glass-strong rounded-xl divide-y divide-gold/10">
        {!members ? (
          <Loader2 className="h-5 w-5 animate-spin text-gold m-4" />
        ) : members.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground text-center">Nog geen teamleden.</p>
        ) : (
          members.map((m) => (
            <div key={m.id} className="flex items-center gap-3 p-4">
              {m.profile?.avatar_url ? (
                <img
                  src={m.profile.avatar_url}
                  alt=""
                  className="h-9 w-9 rounded-full object-cover"
                />
              ) : (
                <div className="h-9 w-9 rounded-full bg-gold/20 grid place-items-center text-gold text-sm font-medium">
                  {(m.profile?.full_name || m.profile?.email || "?").charAt(0).toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{m.profile?.full_name || "—"}</div>
                <div className="text-xs text-muted-foreground truncate">{m.profile?.email}</div>
              </div>
              <select
                value={m.roles[0] || "client"}
                onChange={(e) =>
                  updateRole(m.user_id, e.target.value as "admin" | "editor" | "client")
                }
                className="rounded-lg border border-gold/20 bg-background/60 px-2 py-1 text-xs"
              >
                <option value="client">Klant viewer</option>
                <option value="editor">Editor</option>
                <option value="admin">Admin</option>
              </select>
              <button
                onClick={() => removeMember(m.id)}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))
        )}
      </div>

      <div className="text-xs text-muted-foreground flex items-start gap-2">
        <ShieldCheck className="h-4 w-4 text-gold/70 mt-0.5" />
        <span>
          <strong>Admin</strong> beheert alles. <strong>Editor</strong> mag content maken en
          plannen. <strong>Klant viewer</strong> ziet alleen het portaal en kan goedkeuren.
        </span>
      </div>
    </div>
  );
}

/* ──────────────  NOTIFICATIES (per gebruiker)  ────────────── */
function NotificationsTab() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: prefs, isLoading } = useQuery({
    enabled: !!user,
    queryKey: ["notif-prefs", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("notification_preferences")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  const [form, setForm] = useState<Partial<Tables<"notification_preferences">>>({
    email_enabled: true,
    in_app_enabled: true,
    notify_new_message: true,
    notify_new_upload: true,
    notify_approval: true,
    notify_publish: true,
    notify_failure: true,
    notify_task_assigned: true,
    notify_ai: true,
    notify_planning: true,
    notify_automation: true,
  });
  useEffect(() => {
    if (prefs) setForm(prefs);
  }, [prefs]);

  async function save() {
    if (!user) return;
    const payload = { ...form, user_id: user.id };
    const { error } = await supabase
      .from("notification_preferences")
      .upsert(payload, { onConflict: "user_id" });
    if (error) return toast.error(error.message);
    toast.success("Voorkeuren opgeslagen");
    qc.invalidateQueries({ queryKey: ["notif-prefs", user.id] });
  }

  type NotifKey = keyof Pick<
    Tables<"notification_preferences">,
    | "in_app_enabled"
    | "email_enabled"
    | "notify_new_message"
    | "notify_new_upload"
    | "notify_planning"
    | "notify_approval"
    | "notify_publish"
    | "notify_failure"
    | "notify_ai"
    | "notify_automation"
    | "notify_task_assigned"
  >;
  const channels: { k: NotifKey; label: string; hint: string }[] = [
    {
      k: "in_app_enabled",
      label: "In-app meldingen",
      hint: "Toon meldingen in de bel rechtsboven.",
    },
    {
      k: "email_enabled",
      label: "E-mailmeldingen",
      hint: "Stuur belangrijke meldingen naar mijn e-mail.",
    },
  ];
  const groups: { title: string; items: { k: NotifKey; label: string; hint: string }[] }[] = [
    {
      title: "Berichten & uploads",
      items: [
        { k: "notify_new_message", label: "Nieuw bericht", hint: "Chats van klanten of admins." },
        { k: "notify_new_upload", label: "Nieuwe upload", hint: "Klant uploadt foto of video." },
      ],
    },
    {
      title: "Planning & publicatie",
      items: [
        {
          k: "notify_planning",
          label: "Planning wijzigingen",
          hint: "Items toegevoegd, verplaatst of verwijderd.",
        },
        {
          k: "notify_approval",
          label: "Goedkeuringen & feedback",
          hint: "Klant keurt goed of geeft feedback.",
        },
        {
          k: "notify_publish",
          label: "Post gepubliceerd",
          hint: "Een ingeplande post is live gegaan.",
        },
        {
          k: "notify_failure",
          label: "Post mislukt / fout",
          hint: "Een publicatie of integratie faalt.",
        },
      ],
    },
    {
      title: "AI & automations",
      items: [
        {
          k: "notify_ai",
          label: "AI generatie klaar",
          hint: "Captions, ideeën of beelden zijn klaar.",
        },
        {
          k: "notify_automation",
          label: "Automation uitgevoerd",
          hint: "Een automation-regel is getriggerd.",
        },
        {
          k: "notify_task_assigned",
          label: "Taak toegewezen",
          hint: "Er staat een nieuwe taak voor jou klaar.",
        },
      ],
    },
  ];

  if (isLoading) return <Loader2 className="h-6 w-6 animate-spin text-gold" />;

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="glass-strong rounded-xl p-5">
        <div className="text-sm uppercase tracking-[0.2em] text-gold/70 mb-4">Kanalen</div>
        <div className="space-y-3">
          {channels.map((t) => (
            <Toggle
              key={t.k}
              label={t.label}
              hint={t.hint}
              checked={!!form[t.k]}
              onChange={(v) => setForm({ ...form, [t.k]: v })}
            />
          ))}
        </div>
      </div>

      {groups.map((g) => (
        <div key={g.title} className="glass-strong rounded-xl p-5">
          <div className="text-sm uppercase tracking-[0.2em] text-gold/70 mb-4">{g.title}</div>
          <div className="space-y-3">
            {g.items.map((t) => (
              <Toggle
                key={t.k}
                label={t.label}
                hint={t.hint}
                checked={!!form[t.k]}
                onChange={(v) => setForm({ ...form, [t.k]: v })}
              />
            ))}
          </div>
        </div>
      ))}

      <button
        onClick={save}
        className="rounded-lg bg-gradient-gold px-4 py-2.5 text-sm font-medium text-primary-foreground inline-flex items-center gap-2"
      >
        <Save className="h-4 w-4" /> Opslaan
      </button>
    </div>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start justify-between gap-4 cursor-pointer">
      <div>
        <div className="text-sm">{label}</div>
        {hint && <div className="text-xs text-muted-foreground mt-0.5">{hint}</div>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-6 w-11 rounded-full transition shrink-0",
          checked ? "bg-gold" : "bg-muted",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-5 w-5 rounded-full bg-background transition-all",
            checked ? "left-[22px]" : "left-0.5",
          )}
        />
      </button>
    </label>
  );
}
