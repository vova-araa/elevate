import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import {
  generateContentIdeas,
  generateCaption,
  generateHooks,
  generateHashtags,
} from "@/lib/planner.functions";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { z } from "zod";
import {
  Sparkles,
  Loader2,
  Instagram,
  Music2,
  Linkedin,
  Youtube,
  Facebook,
  Copy,
  Send,
  Lightbulb,
  MessageSquareQuote,
  Hash,
  Wand2,
  ArrowRight,
  CheckCircle2,
  Plus,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

const searchSchema = z.object({ clientId: z.string().uuid().optional() });

export const Route = createFileRoute("/_authenticated/admin/create")({
  validateSearch: searchSchema,
  component: CreatePage,
});

type Platform = "instagram" | "tiktok" | "linkedin" | "youtube" | "facebook";
type Tab = "ideas" | "caption" | "hooks" | "hashtags";

type CreateClient = Pick<
  Tables<"clients">,
  "id" | "name" | "industry" | "description" | "brand_color"
>;

type ContentIdea = {
  title: string;
  platform: string;
  format: string;
  hook: string;
  description: string;
  pillar?: string;
};

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

const PLATFORMS: { id: Platform; label: string; Icon: LucideIcon }[] = [
  { id: "instagram", label: "Instagram", Icon: Instagram },
  { id: "tiktok", label: "TikTok", Icon: Music2 },
  { id: "linkedin", label: "LinkedIn", Icon: Linkedin },
  { id: "youtube", label: "YouTube", Icon: Youtube },
  { id: "facebook", label: "Facebook", Icon: Facebook },
];

function CreatePage() {
  const { clientId } = Route.useSearch();
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: clients } = useQuery<CreateClient[]>({
    queryKey: ["create-clients"],
    queryFn: async () =>
      (
        await supabase
          .from("clients")
          .select("id,name,industry,description,brand_color")
          .order("name")
      ).data ?? [],
  });

  const selected = clients?.find((c) => c.id === clientId) ?? clients?.[0];
  const activeId = selected?.id;

  if (!clientId && activeId) {
    navigate({ to: "/admin/create", search: { clientId: activeId }, replace: true });
  }

  const [tab, setTab] = useState<Tab>("ideas");

  if (!clients) return <Loader2 className="h-6 w-6 animate-spin text-gold" />;
  if (clients.length === 0) {
    return (
      <div className="glass-strong rounded-2xl p-10 text-center">
        <p className="text-muted-foreground">Nog geen klanten. Maak eerst een klant aan.</p>
        <Link
          to="/admin/clients/new"
          className="inline-block mt-4 rounded-full bg-gradient-gold text-primary-foreground px-4 py-2 text-sm"
        >
          Nieuwe klant
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-gold/80">AI Create</p>
          <h1 className="font-display text-5xl mt-2">Studio</h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-xl">
            Genereer ideeën, captions, hooks en hashtags op basis van de klant en plan ze door naar
            de Planner.
          </p>
        </div>
        <select
          value={activeId ?? ""}
          onChange={(e) => navigate({ to: "/admin/create", search: { clientId: e.target.value } })}
          className="rounded-full bg-input/60 hairline px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-gold/40"
        >
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="inline-flex rounded-full glass p-1 text-xs flex-wrap">
        {(
          [
            { id: "ideas", label: "Content ideeën", Icon: Lightbulb },
            { id: "caption", label: "Caption", Icon: MessageSquareQuote },
            { id: "hooks", label: "Hooks", Icon: Wand2 },
            { id: "hashtags", label: "Hashtags", Icon: Hash },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "rounded-full px-3 py-1.5 inline-flex items-center gap-1.5 transition",
              tab === t.id ? "bg-gold/15 text-gold" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <t.Icon className="h-3.5 w-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {selected && tab === "ideas" && <IdeasTab client={selected} userId={user?.id} />}
      {selected && tab === "caption" && <CaptionTab client={selected} userId={user?.id} />}
      {selected && tab === "hooks" && <HooksTab />}
      {selected && tab === "hashtags" && <HashtagsTab />}
    </div>
  );
}

/* ----------------------------- Ideas Tab ----------------------------- */
function IdeasTab({ client, userId }: { client: CreateClient; userId?: string }) {
  const [platforms, setPlatforms] = useState<Platform[]>(["instagram", "tiktok", "linkedin"]);
  const [audience, setAudience] = useState("");
  const [pillars, setPillars] = useState("");
  const [goal, setGoal] = useState("");
  const [count, setCount] = useState(8);
  const [loading, setLoading] = useState(false);
  const [ideas, setIdeas] = useState<ContentIdea[]>([]);
  const ideasFn = useServerFn(generateContentIdeas);
  const [schedulingId, setSchedulingId] = useState<string | null>(null);

  async function run() {
    if (platforms.length === 0) return toast.error("Kies minimaal 1 platform");
    setLoading(true);
    try {
      const res = await ideasFn({
        data: {
          brand: client.name,
          industry: client.industry ?? undefined,
          audience: audience || undefined,
          pillars: pillars || undefined,
          goal: goal || undefined,
          platforms,
          count,
        },
      });
      setIdeas(res.ideas);
      if (res.ideas.length === 0) toast.error("Geen ideeën gegenereerd, probeer opnieuw.");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  async function scheduleIdea(idx: number, date: string) {
    const idea = ideas[idx];
    if (!idea) return;
    setSchedulingId(String(idx));
    try {
      const caption = `${idea.hook}\n\n${idea.description}`;
      const { error } = await supabase.from("scheduled_posts").insert({
        client_id: client.id,
        platform: idea.platform as TablesInsert<"scheduled_posts">["platform"],
        caption,
        scheduled_at: new Date(date).toISOString(),
        status: "draft",
        created_by: userId ?? null,
      });
      if (error) throw error;
      toast.success("Toegevoegd aan Planner als concept");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSchedulingId(null);
    }
  }

  return (
    <div className="grid lg:grid-cols-[340px_1fr] gap-6">
      <div className="glass-strong rounded-2xl p-5 space-y-4 h-fit">
        <div className="text-xs uppercase tracking-wider text-gold/80">Briefing</div>
        <Field label="Platforms">
          <div className="flex flex-wrap gap-1.5">
            {PLATFORMS.map((p) => {
              const active = platforms.includes(p.id);
              return (
                <button
                  key={p.id}
                  onClick={() =>
                    setPlatforms((cur) =>
                      cur.includes(p.id) ? cur.filter((x) => x !== p.id) : [...cur, p.id],
                    )
                  }
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-xs inline-flex items-center gap-1 transition",
                    active
                      ? "bg-gold/15 text-gold border-gold/40"
                      : "border-border/40 text-muted-foreground",
                  )}
                >
                  <p.Icon className="h-3 w-3" /> {p.label}
                </button>
              );
            })}
          </div>
        </Field>
        <Field label="Doelgroep">
          <textarea
            value={audience}
            onChange={(e) => setAudience(e.target.value)}
            rows={2}
            placeholder="Bijv. jonge ondernemers 25-40 in NL/BE"
            className="w-full rounded-lg bg-input/60 hairline px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gold/40"
          />
        </Field>
        <Field label="Content pijlers">
          <textarea
            value={pillars}
            onChange={(e) => setPillars(e.target.value)}
            rows={2}
            placeholder="Bijv. educatie, behind-the-scenes, klantcases"
            className="w-full rounded-lg bg-input/60 hairline px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gold/40"
          />
        </Field>
        <Field label="Doel deze maand">
          <textarea
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            rows={2}
            placeholder="Bijv. 500 nieuwe volgers + 20 leads"
            className="w-full rounded-lg bg-input/60 hairline px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gold/40"
          />
        </Field>
        <Field label={`Aantal ideeën: ${count}`}>
          <input
            type="range"
            min={3}
            max={15}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            className="w-full accent-gold"
          />
        </Field>
        <button
          onClick={run}
          disabled={loading}
          className="w-full rounded-full bg-gradient-gold text-primary-foreground px-4 py-2.5 text-sm font-medium inline-flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}{" "}
          Genereer ideeën
        </button>
      </div>

      <div className="space-y-3">
        {ideas.length === 0 && !loading && (
          <div className="glass-strong rounded-2xl p-10 text-center text-sm text-muted-foreground">
            Vul de briefing in en klik op <em>Genereer ideeën</em>.
          </div>
        )}
        {loading && (
          <div className="glass-strong rounded-2xl p-10 text-center text-sm text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin text-gold mx-auto mb-2" /> AI brainstormt…
          </div>
        )}
        {ideas.map((idea, i) => {
          const meta = PLATFORMS.find((p) => p.id === idea.platform);
          return (
            <div key={i} className="glass-strong rounded-2xl p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    {meta && (
                      <span className="text-[11px] inline-flex items-center gap-1 rounded-full border border-gold/30 bg-gold/5 px-2 py-0.5">
                        <meta.Icon className="h-3 w-3" /> {meta.label}
                      </span>
                    )}
                    <span className="text-[11px] rounded-full border border-border/40 px-2 py-0.5 text-muted-foreground">
                      {idea.format}
                    </span>
                    {idea.pillar && (
                      <span className="text-[11px] rounded-full border border-border/40 px-2 py-0.5 text-muted-foreground">
                        {idea.pillar}
                      </span>
                    )}
                  </div>
                  <h3 className="font-display text-xl">{idea.title}</h3>
                  <p className="text-sm text-gold mt-1.5 italic">"{idea.hook}"</p>
                  <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">
                    {idea.description}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2 pt-4 border-t border-border/30">
                <input
                  type="datetime-local"
                  defaultValue={(() => {
                    const d = new Date();
                    d.setDate(d.getDate() + 1);
                    d.setHours(10, 0, 0, 0);
                    const tz = d.getTimezoneOffset();
                    return new Date(d.getTime() - tz * 60000).toISOString().slice(0, 16);
                  })()}
                  id={`dt-${i}`}
                  className="rounded-lg bg-input/60 hairline px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-gold/40"
                />
                <button
                  onClick={() => {
                    const el = document.getElementById(`dt-${i}`) as HTMLInputElement;
                    if (el?.value) scheduleIdea(i, el.value);
                  }}
                  disabled={schedulingId === String(i)}
                  className="rounded-full bg-gradient-gold text-primary-foreground px-3 py-1.5 text-xs inline-flex items-center gap-1.5"
                >
                  {schedulingId === String(i) ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Send className="h-3 w-3" />
                  )}
                  Plan in als concept
                </button>
                <button
                  onClick={() =>
                    navigator.clipboard
                      .writeText(`${idea.hook}\n\n${idea.description}`)
                      .then(() => toast.success("Gekopieerd"))
                  }
                  className="rounded-full glass px-3 py-1.5 text-xs inline-flex items-center gap-1.5 hover:bg-accent/30 ml-auto"
                >
                  <Copy className="h-3 w-3" /> Kopieer
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ----------------------------- Caption Tab ----------------------------- */
function CaptionTab({ client, userId }: { client: CreateClient; userId?: string }) {
  const [platform, setPlatform] = useState<Platform>("instagram");
  const [brief, setBrief] = useState("");
  const [tone, setTone] = useState("");
  const [caption, setCaption] = useState("");
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const captionFn = useServerFn(generateCaption);

  async function run() {
    if (!brief.trim()) return toast.error("Geef een korte briefing");
    setLoading(true);
    try {
      const res = await captionFn({
        data: {
          brief,
          platform,
          tone: tone || undefined,
          brand: `${client.name}${client.industry ? " — " + client.industry : ""}`,
        },
      });
      setCaption(res.caption);
      setHashtags(res.hashtags);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  async function schedule(when: string) {
    setScheduling(true);
    try {
      const full = caption + (hashtags.length ? `\n\n${hashtags.join(" ")}` : "");
      const { error } = await supabase.from("scheduled_posts").insert({
        client_id: client.id,
        platform,
        caption: full,
        scheduled_at: new Date(when).toISOString(),
        status: "draft",
        created_by: userId ?? null,
      });
      if (error) throw error;
      toast.success("Gepland als concept");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setScheduling(false);
    }
  }

  const fullText = caption + (hashtags.length ? `\n\n${hashtags.join(" ")}` : "");

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div className="glass-strong rounded-2xl p-5 space-y-4">
        <div className="text-xs uppercase tracking-wider text-gold/80">Briefing</div>
        <Field label="Platform">
          <div className="flex flex-wrap gap-1.5">
            {PLATFORMS.map((p) => (
              <button
                key={p.id}
                onClick={() => setPlatform(p.id)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs inline-flex items-center gap-1 transition",
                  platform === p.id
                    ? "bg-gold/15 text-gold border-gold/40"
                    : "border-border/40 text-muted-foreground",
                )}
              >
                <p.Icon className="h-3 w-3" /> {p.label}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Onderwerp / brief">
          <textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            rows={5}
            placeholder="Bijv. We lanceren een nieuwe service voor…"
            className="w-full rounded-lg bg-input/60 hairline px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gold/40"
          />
        </Field>
        <Field label="Tone-of-voice (optioneel)">
          <input
            value={tone}
            onChange={(e) => setTone(e.target.value)}
            placeholder="Bijv. speels, professioneel, direct"
            className="w-full rounded-lg bg-input/60 hairline px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gold/40"
          />
        </Field>
        <button
          onClick={run}
          disabled={loading}
          className="w-full rounded-full bg-gradient-gold text-primary-foreground px-4 py-2.5 text-sm font-medium inline-flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}{" "}
          Genereer caption
        </button>
      </div>

      <div className="glass-strong rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-xs uppercase tracking-wider text-gold/80">Resultaat</div>
          {caption && (
            <span className="text-[10px] text-muted-foreground">{fullText.length} tekens</span>
          )}
        </div>
        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          rows={10}
          placeholder="De caption verschijnt hier…"
          className="w-full rounded-lg bg-input/60 hairline px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gold/40 resize-y"
        />
        {hashtags.length > 0 && (
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5">
              Hashtags
            </div>
            <div className="flex flex-wrap gap-1.5">
              {hashtags.map((h, i) => (
                <span
                  key={i}
                  className="text-[11px] rounded-full border border-gold/30 bg-gold/5 px-2 py-0.5"
                >
                  {h}
                </span>
              ))}
            </div>
          </div>
        )}
        {caption && (
          <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-border/30">
            <input
              type="datetime-local"
              id="cap-dt"
              defaultValue={(() => {
                const d = new Date();
                d.setDate(d.getDate() + 1);
                d.setHours(10, 0, 0, 0);
                const tz = d.getTimezoneOffset();
                return new Date(d.getTime() - tz * 60000).toISOString().slice(0, 16);
              })()}
              className="rounded-lg bg-input/60 hairline px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-gold/40"
            />
            <button
              onClick={() => {
                const el = document.getElementById("cap-dt") as HTMLInputElement;
                if (el?.value) schedule(el.value);
              }}
              disabled={scheduling}
              className="rounded-full bg-gradient-gold text-primary-foreground px-3 py-1.5 text-xs inline-flex items-center gap-1.5"
            >
              {scheduling ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Send className="h-3 w-3" />
              )}{" "}
              Plan in als concept
            </button>
            <button
              onClick={() =>
                navigator.clipboard.writeText(fullText).then(() => toast.success("Gekopieerd"))
              }
              className="rounded-full glass px-3 py-1.5 text-xs inline-flex items-center gap-1.5 hover:bg-accent/30 ml-auto"
            >
              <Copy className="h-3 w-3" /> Kopieer
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ----------------------------- Hooks Tab ----------------------------- */
function HooksTab() {
  const [topic, setTopic] = useState("");
  const [platform, setPlatform] = useState<Platform>("instagram");
  const [count, setCount] = useState(8);
  const [loading, setLoading] = useState(false);
  const [hooks, setHooks] = useState<string[]>([]);
  const hooksFn = useServerFn(generateHooks);

  async function run() {
    if (!topic.trim()) return toast.error("Geef een onderwerp");
    setLoading(true);
    try {
      const res = await hooksFn({ data: { topic, platform, count } });
      setHooks(res.hooks);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid lg:grid-cols-[340px_1fr] gap-6">
      <div className="glass-strong rounded-2xl p-5 space-y-4 h-fit">
        <div className="text-xs uppercase tracking-wider text-gold/80">Hooks-generator</div>
        <Field label="Platform">
          <div className="flex flex-wrap gap-1.5">
            {PLATFORMS.map((p) => (
              <button
                key={p.id}
                onClick={() => setPlatform(p.id)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs inline-flex items-center gap-1",
                  platform === p.id
                    ? "bg-gold/15 text-gold border-gold/40"
                    : "border-border/40 text-muted-foreground",
                )}
              >
                <p.Icon className="h-3 w-3" /> {p.label}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Onderwerp">
          <textarea
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            rows={4}
            placeholder="Waar gaat de post over?"
            className="w-full rounded-lg bg-input/60 hairline px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gold/40"
          />
        </Field>
        <Field label={`Aantal: ${count}`}>
          <input
            type="range"
            min={3}
            max={15}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            className="w-full accent-gold"
          />
        </Field>
        <button
          onClick={run}
          disabled={loading}
          className="w-full rounded-full bg-gradient-gold text-primary-foreground px-4 py-2.5 text-sm font-medium inline-flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}{" "}
          Genereer hooks
        </button>
      </div>
      <div className="space-y-2">
        {hooks.length === 0 && !loading && (
          <div className="glass-strong rounded-2xl p-10 text-center text-sm text-muted-foreground">
            Geef een onderwerp en genereer scroll-stoppende hooks.
          </div>
        )}
        {loading && (
          <div className="glass-strong rounded-2xl p-10 text-center">
            <Loader2 className="h-6 w-6 animate-spin text-gold mx-auto" />
          </div>
        )}
        {hooks.map((h, i) => (
          <button
            key={i}
            onClick={() => navigator.clipboard.writeText(h).then(() => toast.success("Gekopieerd"))}
            className="w-full text-left glass rounded-xl p-4 hover:border-gold/40 border border-transparent transition flex items-center gap-3"
          >
            <span className="text-xs text-gold/70 shrink-0">{String(i + 1).padStart(2, "0")}</span>
            <span className="flex-1 text-sm">{h}</span>
            <Copy className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        ))}
      </div>
    </div>
  );
}

/* ----------------------------- Hashtags Tab ----------------------------- */
function HashtagsTab() {
  const [topic, setTopic] = useState("");
  const [platform, setPlatform] = useState<Platform>("instagram");
  const [niche, setNiche] = useState("");
  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState<{ big: string[]; medium: string[]; niche: string[] } | null>(
    null,
  );
  const hashFn = useServerFn(generateHashtags);

  async function run() {
    if (!topic.trim()) return toast.error("Geef een onderwerp");
    setLoading(true);
    try {
      const res = await hashFn({ data: { topic, platform, niche: niche || undefined } });
      setGroups(res);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  function copyAll() {
    if (!groups) return;
    const all = [...groups.big, ...groups.medium, ...groups.niche].join(" ");
    navigator.clipboard.writeText(all).then(() => toast.success("Alle hashtags gekopieerd"));
  }

  return (
    <div className="grid lg:grid-cols-[340px_1fr] gap-6">
      <div className="glass-strong rounded-2xl p-5 space-y-4 h-fit">
        <div className="text-xs uppercase tracking-wider text-gold/80">Hashtag mix</div>
        <Field label="Platform">
          <div className="flex flex-wrap gap-1.5">
            {PLATFORMS.map((p) => (
              <button
                key={p.id}
                onClick={() => setPlatform(p.id)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs inline-flex items-center gap-1",
                  platform === p.id
                    ? "bg-gold/15 text-gold border-gold/40"
                    : "border-border/40 text-muted-foreground",
                )}
              >
                <p.Icon className="h-3 w-3" /> {p.label}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Onderwerp">
          <textarea
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            rows={3}
            placeholder="Waar gaat de post over?"
            className="w-full rounded-lg bg-input/60 hairline px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gold/40"
          />
        </Field>
        <Field label="Niche (optioneel)">
          <input
            value={niche}
            onChange={(e) => setNiche(e.target.value)}
            placeholder="Bijv. duurzame mode in NL"
            className="w-full rounded-lg bg-input/60 hairline px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gold/40"
          />
        </Field>
        <button
          onClick={run}
          disabled={loading}
          className="w-full rounded-full bg-gradient-gold text-primary-foreground px-4 py-2.5 text-sm font-medium inline-flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Hash className="h-4 w-4" />}{" "}
          Genereer hashtags
        </button>
      </div>
      <div className="space-y-4">
        {!groups && !loading && (
          <div className="glass-strong rounded-2xl p-10 text-center text-sm text-muted-foreground">
            Resultaten verschijnen in drie groepen: groot, middel en niche.
          </div>
        )}
        {loading && (
          <div className="glass-strong rounded-2xl p-10 text-center">
            <Loader2 className="h-6 w-6 animate-spin text-gold mx-auto" />
          </div>
        )}
        {groups && (
          <>
            <div className="flex justify-end">
              <button
                onClick={copyAll}
                className="rounded-full glass px-3 py-1.5 text-xs inline-flex items-center gap-1.5 hover:bg-accent/30"
              >
                <Copy className="h-3 w-3" /> Kopieer alle
              </button>
            </div>
            <HashGroup
              label="Groot bereik"
              tags={groups.big}
              tone="border-fuchsia-400/30 bg-fuchsia-500/5 text-fuchsia-200"
            />
            <HashGroup
              label="Middel"
              tags={groups.medium}
              tone="border-sky-400/30 bg-sky-500/5 text-sky-200"
            />
            <HashGroup
              label="Niche"
              tags={groups.niche}
              tone="border-emerald-400/30 bg-emerald-500/5 text-emerald-200"
            />
          </>
        )}
      </div>
    </div>
  );
}

function HashGroup({ label, tags, tone }: { label: string; tags: string[]; tone: string }) {
  return (
    <div className="glass-strong rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs uppercase tracking-wider text-gold/80">{label}</div>
        <button
          onClick={() =>
            navigator.clipboard.writeText(tags.join(" ")).then(() => toast.success("Gekopieerd"))
          }
          className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
        >
          <Copy className="h-3 w-3" /> Kopieer
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {tags.map((t, i) => (
          <span key={i} className={cn("text-[11px] rounded-full border px-2 py-0.5", tone)}>
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5">
        {label}
      </div>
      {children}
    </div>
  );
}
