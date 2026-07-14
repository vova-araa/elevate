import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Anchor, Hash, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { generateHooks, generateHashtags } from "@/lib/planner.functions";
import { CopyButton } from "./copy-button";
import { cn } from "@/lib/utils";

// Platform-enum van de bestaande planner-functies
const PLANNER_PLATFORMS = ["instagram", "tiktok", "linkedin", "youtube", "facebook"] as const;
type PlannerPlatform = (typeof PLANNER_PLATFORMS)[number];

const PLATFORM_LABELS: Record<PlannerPlatform, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  linkedin: "LinkedIn",
  youtube: "YouTube",
  facebook: "Facebook",
};

function PlatformSelect({
  value,
  onChange,
}: {
  value: PlannerPlatform;
  onChange: (v: PlannerPlatform) => void;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as PlannerPlatform)}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {PLANNER_PLATFORMS.map((p) => (
          <SelectItem key={p} value={p}>
            {PLATFORM_LABELS[p]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

const GROUP_META = [
  {
    key: "big" as const,
    label: "Groot (volume)",
    cls: "border-gold/40 bg-gold/10 hover:bg-gold/20",
  },
  {
    key: "medium" as const,
    label: "Middel (relevant)",
    cls: "border-gold/25 bg-gold/5 hover:bg-gold/15",
  },
  {
    key: "niche" as const,
    label: "Niche (specifiek)",
    cls: "border-border bg-background/50 hover:bg-gold/10",
  },
];

export function HooksHashtagsTab() {
  // Hooks
  const [hookTopic, setHookTopic] = useState("");
  const [hookPlatform, setHookPlatform] = useState<PlannerPlatform>("instagram");
  const [hookCount, setHookCount] = useState(8);
  const hooksFn = useServerFn(generateHooks);
  const hooks = useMutation({
    mutationFn: async () =>
      hooksFn({ data: { topic: hookTopic.trim(), platform: hookPlatform, count: hookCount } }),
    onError: (e: any) => toast.error(e?.message ?? "Hooks genereren mislukt"),
  });

  // Hashtags
  const [tagTopic, setTagTopic] = useState("");
  const [tagPlatform, setTagPlatform] = useState<PlannerPlatform>("instagram");
  const [tagNiche, setTagNiche] = useState("");
  const [collected, setCollected] = useState<string[]>([]);
  const hashtagsFn = useServerFn(generateHashtags);
  const hashtags = useMutation({
    mutationFn: async () =>
      hashtagsFn({
        data: {
          topic: tagTopic.trim(),
          platform: tagPlatform,
          niche: tagNiche.trim() || undefined,
        },
      }),
    onError: (e: any) => toast.error(e?.message ?? "Hashtags genereren mislukt"),
  });

  const normalizeTag = (t: string) => (t.startsWith("#") ? t : `#${t}`);
  const toggleCollected = (tag: string) => {
    const t = normalizeTag(tag);
    setCollected((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  };

  return (
    <div className="grid gap-6 xl:grid-cols-2 max-w-6xl">
      {/* Hooks */}
      <section className="rounded-xl border border-gold/10 bg-card p-5 space-y-4 self-start">
        <h3 className="font-display text-lg flex items-center gap-2">
          <Anchor className="h-4 w-4 text-gold" />
          Hooks
        </h3>
        <div className="space-y-2">
          <Label htmlFor="hook-topic">Onderwerp</Label>
          <Input
            id="hook-topic"
            value={hookTopic}
            onChange={(e) => setHookTopic(e.target.value)}
            placeholder="Bv: tips om beter te slapen"
            onKeyDown={(e) => e.key === "Enter" && hookTopic.trim().length >= 2 && hooks.mutate()}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Platform</Label>
            <PlatformSelect value={hookPlatform} onChange={setHookPlatform} />
          </div>
          <div className="space-y-2">
            <Label>Aantal</Label>
            <Select value={String(hookCount)} onValueChange={(v) => setHookCount(Number(v))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[5, 8, 10, 12, 15].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n} hooks
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button
          onClick={() => {
            if (hookTopic.trim().length < 2) return toast.error("Vul eerst een onderwerp in");
            hooks.mutate();
          }}
          disabled={hooks.isPending}
          className="bg-gradient-gold text-primary-foreground hover:opacity-90"
        >
          {hooks.isPending ? <Loader2 className="animate-spin" /> : <Anchor />}
          {hooks.isPending ? "Genereren…" : "Genereer hooks"}
        </Button>

        {hooks.isPending && (
          <div className="grid place-items-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-gold" />
          </div>
        )}
        {!hooks.isPending && hooks.isSuccess && (hooks.data?.hooks ?? []).length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">
            Geen hooks ontvangen — probeer opnieuw.
          </p>
        )}
        {!hooks.isPending && (hooks.data?.hooks ?? []).length > 0 && (
          <ul className="space-y-2">
            {hooks.data!.hooks.map((h, i) => (
              <li
                key={i}
                className="flex items-center gap-2 rounded-lg border border-gold/10 bg-background/50 px-3 py-2"
              >
                <span className="text-sm flex-1">{h}</span>
                <CopyButton text={h} label="" className="h-7 px-2" />
              </li>
            ))}
          </ul>
        )}
        {!hooks.isPending && !hooks.isSuccess && (
          <p className="text-xs text-muted-foreground">
            Scroll-stoppende openingszinnen in verschillende stijlen: vraag, statement,
            controversieel, lijst, before/after.
          </p>
        )}
      </section>

      {/* Hashtags */}
      <section className="rounded-xl border border-gold/10 bg-card p-5 space-y-4 self-start">
        <h3 className="font-display text-lg flex items-center gap-2">
          <Hash className="h-4 w-4 text-gold" />
          Hashtags
        </h3>
        <div className="space-y-2">
          <Label htmlFor="tag-topic">Onderwerp</Label>
          <Input
            id="tag-topic"
            value={tagTopic}
            onChange={(e) => setTagTopic(e.target.value)}
            placeholder="Bv: duurzame mode voor vrouwen"
            onKeyDown={(e) => e.key === "Enter" && tagTopic.trim().length >= 2 && hashtags.mutate()}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Platform</Label>
            <PlatformSelect value={tagPlatform} onChange={setTagPlatform} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tag-niche">Niche (optioneel)</Label>
            <Input
              id="tag-niche"
              value={tagNiche}
              onChange={(e) => setTagNiche(e.target.value)}
              placeholder="Bv: slow fashion"
            />
          </div>
        </div>
        <Button
          onClick={() => {
            if (tagTopic.trim().length < 2) return toast.error("Vul eerst een onderwerp in");
            hashtags.mutate();
          }}
          disabled={hashtags.isPending}
          className="bg-gradient-gold text-primary-foreground hover:opacity-90"
        >
          {hashtags.isPending ? <Loader2 className="animate-spin" /> : <Hash />}
          {hashtags.isPending ? "Genereren…" : "Genereer hashtags"}
        </Button>

        {hashtags.isPending && (
          <div className="grid place-items-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-gold" />
          </div>
        )}

        {!hashtags.isPending && hashtags.isSuccess && (
          <div className="space-y-4">
            {GROUP_META.map(({ key, label, cls }) => {
              const tags = hashtags.data?.[key] ?? [];
              if (tags.length === 0) return null;
              return (
                <div key={key} className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {label}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {tags.map((t, i) => {
                      const tag = normalizeTag(t);
                      const active = collected.includes(tag);
                      return (
                        <button
                          key={`${key}-${i}`}
                          type="button"
                          onClick={() => toggleCollected(tag)}
                          className={cn(
                            "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-medium transition",
                            active ? "border-gold bg-gold text-primary-foreground" : cls,
                          )}
                          title={active ? "Verwijder uit verzameling" : "Voeg toe aan verzameling"}
                        >
                          {tag}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            {(hashtags.data?.big ?? []).length +
              (hashtags.data?.medium ?? []).length +
              (hashtags.data?.niche ?? []).length ===
              0 && (
              <p className="text-sm text-muted-foreground text-center py-6">
                Geen hashtags ontvangen — probeer opnieuw.
              </p>
            )}
          </div>
        )}

        {!hashtags.isPending && !hashtags.isSuccess && (
          <p className="text-xs text-muted-foreground">
            Klik op hashtags om ze te verzamelen; kopieer daarna de hele set in één keer.
          </p>
        )}

        {/* Verzameling */}
        {collected.length > 0 && (
          <div className="rounded-lg border border-gold/20 bg-gold/5 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium">Verzameling ({collected.length})</p>
              <div className="flex items-center gap-2">
                <CopyButton text={collected.join(" ")} label="Kopieer alles" />
                <button
                  type="button"
                  onClick={() => setCollected([])}
                  className="inline-flex items-center gap-1 h-8 px-2.5 text-xs rounded-full border border-border hover:bg-accent/40"
                >
                  <X className="h-3 w-3" />
                  Leegmaken
                </button>
              </div>
            </div>
            <p className="text-sm break-words">{collected.join(" ")}</p>
          </div>
        )}
      </section>
    </div>
  );
}
