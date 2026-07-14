import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Sparkles, FlaskConical, Save, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  generateCaptionVariants,
  saveCaptionVariant,
  type CaptionVariant,
  type StudioPlatform,
} from "@/lib/ai-studio.functions";
import { CopyButton } from "./copy-button";
import { ClientSelect, type StudioClient } from "./client-select";
import { PlatformChips, platformLabel, STUDIO_PLATFORMS } from "./platform-chips";
import { cn } from "@/lib/utils";

const TONES = ["professioneel", "informeel", "energiek", "inspirerend"] as const;
type Tone = (typeof TONES)[number];

export function CaptionsAbTab({ clients }: { clients: StudioClient[] }) {
  const [briefing, setBriefing] = useState("");
  const [clientId, setClientId] = useState<string | null>(null);
  const [tone, setTone] = useState<Tone>("professioneel");
  const [platforms, setPlatforms] = useState<StudioPlatform[]>(["instagram", "linkedin"]);
  const [language, setLanguage] = useState<"nl" | "en">("nl");
  const [variantCount, setVariantCount] = useState<2 | 3>(2);
  const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set());

  const generateFn = useServerFn(generateCaptionVariants);
  const saveFn = useServerFn(saveCaptionVariant);

  const generate = useMutation({
    mutationFn: async () =>
      generateFn({
        data: { briefing: briefing.trim(), clientId, tone, platforms, language, variantCount },
      }),
    onSuccess: () => setSavedKeys(new Set()),
    onError: (e: Error) => toast.error(e.message || "Genereren mislukt"),
  });

  const save = useMutation({
    mutationFn: async (v: CaptionVariant) =>
      saveFn({
        data: { clientId, briefing: briefing.trim(), tone, platform: v.platform, text: v.text },
      }),
    onSuccess: (_r, v) => {
      setSavedKeys((prev) => new Set(prev).add(`${v.platform}-${v.variant}`));
      toast.success("Variant bewaard in AI-generaties");
    },
    onError: (e: Error) => toast.error(e.message || "Bewaren mislukt"),
  });

  const togglePlatform = (id: StudioPlatform) =>
    setPlatforms((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));

  const submit = () => {
    if (briefing.trim().length < 3) return toast.error("Vul eerst een briefing in");
    if (platforms.length === 0) return toast.error("Kies minstens één platform");
    generate.mutate();
  };

  const variants = generate.data?.variants ?? [];
  const byPlatform = platforms
    .map((p) => ({ platform: p, items: variants.filter((v) => v.platform === p) }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Formulier */}
      <div className="rounded-xl border border-gold/10 bg-card p-5 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="ab-briefing">Briefing</Label>
          <Textarea
            id="ab-briefing"
            value={briefing}
            onChange={(e) => setBriefing(e.target.value)}
            placeholder="Waar gaat de post over? Bv: lancering van onze nieuwe zomercollectie, focus op duurzame materialen…"
            rows={4}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label>Klant</Label>
            <ClientSelect clients={clients} value={clientId} onChange={setClientId} allowNone />
            <p className="text-[11px] text-muted-foreground">
              Tone-of-voice profiel wordt automatisch meegenomen.
            </p>
          </div>
          <div className="space-y-2">
            <Label>Toon</Label>
            <Select value={tone} onValueChange={(v) => setTone(v as Tone)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TONES.map((t) => (
                  <SelectItem key={t} value={t} className="capitalize">
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Taal</Label>
            <Select value={language} onValueChange={(v) => setLanguage(v as "nl" | "en")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="nl">Nederlands</SelectItem>
                <SelectItem value="en">Engels</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Varianten</Label>
            <Select
              value={String(variantCount)}
              onValueChange={(v) => setVariantCount(Number(v) as 2 | 3)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2">2 varianten (A/B)</SelectItem>
                <SelectItem value="3">3 varianten (A/B/C)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Platforms</Label>
          <PlatformChips selected={platforms} onToggle={togglePlatform} />
        </div>

        <Button
          onClick={submit}
          disabled={generate.isPending}
          className="bg-gradient-gold text-primary-foreground hover:opacity-90"
        >
          {generate.isPending ? <Loader2 className="animate-spin" /> : <FlaskConical />}
          {generate.isPending ? "Varianten genereren…" : "Genereer varianten"}
        </Button>
      </div>

      {/* Resultaten */}
      {generate.isPending && (
        <div className="rounded-xl border border-gold/10 bg-card p-10 grid place-items-center">
          <div className="flex flex-col items-center gap-3 text-sm text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin text-gold" />
            De AI schrijft {variantCount} varianten per platform…
          </div>
        </div>
      )}

      {!generate.isPending && generate.isSuccess && byPlatform.length === 0 && (
        <div className="rounded-xl border border-gold/10 bg-card p-10 text-center text-sm text-muted-foreground">
          Geen varianten ontvangen — probeer het opnieuw met een andere briefing.
        </div>
      )}

      {!generate.isPending &&
        byPlatform.map(({ platform, items }) => {
          const Icon = STUDIO_PLATFORMS.find((p) => p.id === platform)?.Icon ?? Sparkles;
          return (
            <div key={platform} className="space-y-3">
              <h3 className="font-display text-lg flex items-center gap-2">
                <Icon className="h-4 w-4 text-gold" />
                {platformLabel(platform)}
              </h3>
              <div
                className={cn(
                  "grid gap-4",
                  items.length >= 3 ? "lg:grid-cols-3 md:grid-cols-2" : "md:grid-cols-2",
                )}
              >
                {items.map((v) => {
                  const key = `${v.platform}-${v.variant}`;
                  const isSaved = savedKeys.has(key);
                  return (
                    <div
                      key={key}
                      className="rounded-xl border border-gold/10 bg-card p-4 flex flex-col gap-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="h-6 w-6 rounded-full bg-gold/15 text-gold grid place-items-center text-xs font-semibold">
                            {v.variant}
                          </span>
                          <Badge variant="secondary" className="font-normal">
                            {v.angle}
                          </Badge>
                        </div>
                      </div>
                      <p className="text-sm whitespace-pre-wrap flex-1">{v.text}</p>
                      <div className="flex items-center gap-2 pt-1">
                        <CopyButton text={v.text} />
                        <button
                          type="button"
                          disabled={isSaved || save.isPending}
                          onClick={() => save.mutate(v)}
                          className={cn(
                            "inline-flex items-center gap-1.5 h-8 px-3 text-xs rounded-full border transition disabled:opacity-60",
                            isSaved
                              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600"
                              : "border-gold/20 bg-card hover:bg-gold/10",
                          )}
                        >
                          {isSaved ? (
                            <Check className="h-3.5 w-3.5" />
                          ) : (
                            <Save className="h-3.5 w-3.5 text-gold" />
                          )}
                          {isSaved ? "Bewaard" : "Bewaar"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

      {!generate.isPending && !generate.isSuccess && (
        <div className="rounded-xl border border-dashed border-gold/20 p-10 text-center">
          <FlaskConical className="h-8 w-8 text-gold/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            Vul een briefing in en genereer per platform meerdere caption-varianten met elk een
            andere invalshoek.
          </p>
        </div>
      )}
    </div>
  );
}
