import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { Sparkles, Loader2, CalendarPlus, Copy, Check, Wand2 } from "lucide-react";
import { PLATFORMS } from "@/components/planner/planner-shared";
import {
  generateContentPlan,
  createPlanPosts,
  type PlanItem,
  type CampaignPlatform,
} from "@/lib/campaigns.functions";

export const Route = createFileRoute("/_authenticated/admin/campaigns")({
  component: CampaignsPage,
});

// Standaard-publicatietijd per platform (lokaal, spiegelt de server-default).
const DEFAULT_HOUR: Record<CampaignPlatform, number> = {
  instagram: 18,
  tiktok: 19,
  linkedin: 8,
  youtube: 17,
  facebook: 12,
};

const TONES = ["professioneel", "informeel", "energiek", "inspirerend"] as const;
type Tone = (typeof TONES)[number];

interface PreviewPost extends PlanItem {
  id: string;
  include: boolean;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function scheduledAtFor(startDate: string, item: PlanItem): Date {
  const d = new Date(`${startDate}T00:00:00`);
  d.setDate(d.getDate() + item.dayOffset);
  d.setHours(DEFAULT_HOUR[item.platform] ?? 9, 0, 0, 0);
  return d;
}

function CampaignsPage() {
  const navigate = useNavigate();
  const generate = useServerFn(generateContentPlan);
  const createPosts = useServerFn(createPlanPosts);

  const [clientId, setClientId] = useState<string>("");
  const [goal, setGoal] = useState("");
  const [platforms, setPlatforms] = useState<CampaignPlatform[]>(["instagram", "linkedin"]);
  const [days, setDays] = useState(14);
  const [postsPerPlatform, setPostsPerPlatform] = useState(4);
  const [tone, setTone] = useState<Tone>("energiek");
  const [startDate, setStartDate] = useState(todayISO());

  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [posts, setPosts] = useState<PreviewPost[]>([]);
  const [copied, setCopied] = useState<string | null>(null);

  const { data: clients } = useQuery({
    queryKey: ["campaign-clients"],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("id, name, brand_color").order("name");
      return data ?? [];
    },
  });

  const activeClient = clients?.find((c) => c.id === clientId);

  function togglePlatform(p: CampaignPlatform) {
    setPlatforms((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]));
  }

  async function onGenerate() {
    if (!clientId) return toast.error("Kies eerst een klant");
    if (goal.trim().length < 3) return toast.error("Beschrijf kort het doel of thema");
    if (platforms.length === 0) return toast.error("Kies minstens één platform");
    setBusy(true);
    try {
      const res = await generate({
        data: { clientId, goal, platforms, days, postsPerPlatform, tone },
      });
      const mapped: PreviewPost[] = res.items.map((it, i) => ({
        ...it,
        id: `${i}-${it.platform}-${it.dayOffset}`,
        include: true,
      }));
      mapped.sort((a, b) => a.dayOffset - b.dayOffset);
      setPosts(mapped);
      if (mapped.length === 0) toast.info("Geen posts gegenereerd, probeer het opnieuw.");
      else toast.success(`${mapped.length} post-ideeën gegenereerd`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Genereren mislukt");
    } finally {
      setBusy(false);
    }
  }

  const selectedCount = posts.filter((p) => p.include).length;

  async function onAddToPlanner() {
    const chosen = posts.filter((p) => p.include);
    if (chosen.length === 0) return toast.error("Selecteer minstens één post");
    setSaving(true);
    try {
      const payload = chosen.map((p) => {
        const tags = p.hashtags.length ? "\n\n" + p.hashtags.map((h) => `#${h}`).join(" ") : "";
        return {
          scheduledAt: scheduledAtFor(startDate, p).toISOString(),
          platform: p.platform,
          caption: p.caption + tags,
        };
      });
      const res = await createPosts({ data: { clientId, posts: payload } });
      toast.success(`${res.inserted} concepten toegevoegd aan de planner`);
      navigate({ to: "/admin/planner", search: { clientId } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Toevoegen mislukt");
    } finally {
      setSaving(false);
    }
  }

  function updateCaption(id: string, caption: string) {
    setPosts((cur) => cur.map((p) => (p.id === id ? { ...p, caption } : p)));
  }
  function toggleInclude(id: string) {
    setPosts((cur) => cur.map((p) => (p.id === id ? { ...p, include: !p.include } : p)));
  }
  async function copyCaption(p: PreviewPost) {
    const tags = p.hashtags.length ? "\n\n" + p.hashtags.map((h) => `#${h}`).join(" ") : "";
    await navigator.clipboard.writeText(p.caption + tags);
    setCopied(p.id);
    setTimeout(() => setCopied((c) => (c === p.id ? null : c)), 1500);
  }

  const grouped = useMemo(() => {
    const byDay = new Map<number, PreviewPost[]>();
    for (const p of posts) {
      if (!byDay.has(p.dayOffset)) byDay.set(p.dayOffset, []);
      byDay.get(p.dayOffset)!.push(p);
    }
    return [...byDay.entries()].sort((a, b) => a[0] - b[0]);
  }, [posts]);

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <div className="text-[10px] uppercase tracking-[0.25em] text-gold/70">AI</div>
        <h1 className="font-display text-3xl sm:text-4xl text-gold mt-1 inline-flex items-center gap-2">
          <Wand2 className="h-7 w-7" /> Campagne-generator
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Laat AI een compleet contentplan opstellen op basis van doel, tone-of-voice en platforms —
          en zet het in één klik als concepten in de planner.
        </p>
      </div>

      {/* Instellingen */}
      <div className="rounded-xl border border-gold/10 bg-card p-5 grid gap-4 md:grid-cols-2">
        <div>
          <label className="text-xs text-muted-foreground">Klant</label>
          <select
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gold/15 bg-background/60 px-3 h-10 text-sm"
          >
            <option value="">— Kies een klant —</option>
            {(clients ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Startdatum</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gold/15 bg-background/60 px-3 h-10 text-sm"
          />
        </div>
        <div className="md:col-span-2">
          <label className="text-xs text-muted-foreground">Doel / thema van de campagne</label>
          <textarea
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            rows={2}
            placeholder="bv. lancering nieuwe zomercollectie, meer boekingen voor de studio, merkbekendheid vergroten…"
            className="mt-1 w-full rounded-lg border border-gold/15 bg-background/60 px-3 py-2 text-sm resize-none"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Platforms</label>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {PLATFORMS.map(({ id, label, Icon }) => {
              const active = platforms.includes(id as CampaignPlatform);
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => togglePlatform(id as CampaignPlatform)}
                  className={
                    "inline-flex items-center gap-1.5 h-8 px-3 text-xs rounded-full border transition " +
                    (active
                      ? "border-gold bg-gold/15 text-foreground"
                      : "border-gold/20 bg-card text-muted-foreground hover:bg-gold/10")
                  }
                >
                  <Icon className={"h-3.5 w-3.5 " + (active ? "text-gold" : "")} />
                  {label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-muted-foreground">Periode</label>
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-gold/15 bg-background/60 px-2 h-10 text-sm"
            >
              <option value={7}>7 dagen</option>
              <option value={14}>14 dagen</option>
              <option value={30}>30 dagen</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Per platform</label>
            <select
              value={postsPerPlatform}
              onChange={(e) => setPostsPerPlatform(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-gold/15 bg-background/60 px-2 h-10 text-sm"
            >
              {[2, 3, 4, 5, 6, 8].map((n) => (
                <option key={n} value={n}>
                  {n} posts
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Toon</label>
            <select
              value={tone}
              onChange={(e) => setTone(e.target.value as Tone)}
              className="mt-1 w-full rounded-lg border border-gold/15 bg-background/60 px-2 h-10 text-sm capitalize"
            >
              {TONES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="md:col-span-2">
          <button
            onClick={onGenerate}
            disabled={busy}
            className="h-11 px-5 rounded-lg bg-gradient-gold text-primary-foreground font-medium inline-flex items-center gap-2 disabled:opacity-50 hover:brightness-105 transition"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {busy ? "Bezig met genereren…" : "Genereer contentplan"}
          </button>
        </div>
      </div>

      {/* Resultaat */}
      {posts.length > 0 && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 sticky top-0 z-10 bg-luxe/80 backdrop-blur py-2">
            <div className="text-sm text-muted-foreground">
              {selectedCount} van {posts.length} geselecteerd
              {activeClient ? ` · ${activeClient.name}` : ""}
            </div>
            <button
              onClick={onAddToPlanner}
              disabled={saving || selectedCount === 0}
              className="h-10 px-4 rounded-lg bg-gold text-primary-foreground text-sm font-medium inline-flex items-center gap-2 disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CalendarPlus className="h-4 w-4" />
              )}
              Voeg {selectedCount} toe aan planner
            </button>
          </div>

          {grouped.map(([dayOffset, dayPosts]) => {
            const date = new Date(`${startDate}T00:00:00`);
            date.setDate(date.getDate() + dayOffset);
            return (
              <div key={dayOffset}>
                <div className="text-xs uppercase tracking-wider text-gold/70 mb-2">
                  {format(date, "EEEE d MMMM", { locale: nl })}
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {dayPosts.map((p) => {
                    const meta = PLATFORMS.find((x) => x.id === p.platform);
                    const Icon = meta?.Icon ?? Sparkles;
                    return (
                      <div
                        key={p.id}
                        className={
                          "rounded-xl border bg-card p-4 transition " +
                          (p.include ? "border-gold/30" : "border-border/40 opacity-60")
                        }
                      >
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div className="inline-flex items-center gap-2 text-sm">
                            <Icon className="h-4 w-4 text-gold" />
                            <span className="font-medium">{meta?.label ?? p.platform}</span>
                            <span className="text-muted-foreground">
                              · {DEFAULT_HOUR[p.platform] ?? 9}:00
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => copyCaption(p)}
                              title="Kopieer"
                              className="p-1.5 rounded-md hover:bg-gold/10 text-muted-foreground"
                            >
                              {copied === p.id ? (
                                <Check className="h-4 w-4 text-emerald-500" />
                              ) : (
                                <Copy className="h-4 w-4" />
                              )}
                            </button>
                            <input
                              type="checkbox"
                              checked={p.include}
                              onChange={() => toggleInclude(p.id)}
                              className="h-4 w-4 accent-[var(--gold)]"
                            />
                          </div>
                        </div>
                        <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">
                          {p.title}
                        </div>
                        <textarea
                          value={p.caption}
                          onChange={(e) => updateCaption(p.id, e.target.value)}
                          rows={4}
                          className="w-full rounded-lg border border-gold/10 bg-background/50 px-3 py-2 text-sm resize-y"
                        />
                        {p.hashtags.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {p.hashtags.map((h) => (
                              <span
                                key={h}
                                className="text-[11px] px-2 py-0.5 rounded-full bg-gold/10 text-gold"
                              >
                                #{h}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
