import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Recycle, Sparkles, Lightbulb } from "lucide-react";
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
import { repurposeContent, type StudioPlatform } from "@/lib/ai-studio.functions";
import { CopyButton } from "./copy-button";
import { ClientSelect, type StudioClient } from "./client-select";
import { PlatformChips, platformLabel, STUDIO_PLATFORMS } from "./platform-chips";

export function RepurposeTab({ clients }: { clients: StudioClient[] }) {
  const [source, setSource] = useState("");
  const [clientId, setClientId] = useState<string | null>(null);
  const [platforms, setPlatforms] = useState<StudioPlatform[]>(["instagram", "linkedin", "x"]);
  const [language, setLanguage] = useState<"nl" | "en">("nl");

  const repurposeFn = useServerFn(repurposeContent);

  const generate = useMutation({
    mutationFn: async () =>
      repurposeFn({ data: { source: source.trim(), platforms, clientId, language } }),
    onError: (e: any) => toast.error(e?.message ?? "Hergebruiken mislukt"),
  });

  const togglePlatform = (id: StudioPlatform) =>
    setPlatforms((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));

  const submit = () => {
    if (source.trim().length < 20)
      return toast.error("Plak eerst bron-content (minimaal 20 tekens)");
    if (platforms.length === 0) return toast.error("Kies minstens één platform");
    generate.mutate();
  };

  const posts = generate.data?.posts ?? [];

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="rounded-xl border border-gold/10 bg-card p-5 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="rp-source">Bron-content</Label>
          <Textarea
            id="rp-source"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="Plak hier een blogtekst, video-script of bestaande post die je wil hergebruiken…"
            rows={8}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Klant (optioneel)</Label>
            <ClientSelect clients={clients} value={clientId} onChange={setClientId} allowNone />
            <p className="text-[11px] text-muted-foreground">
              Tone-of-voice profiel wordt automatisch meegenomen.
            </p>
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
          {generate.isPending ? <Loader2 className="animate-spin" /> : <Recycle />}
          {generate.isPending ? "Hergebruiken…" : "Hergebruik content"}
        </Button>
      </div>

      {generate.isPending && (
        <div className="rounded-xl border border-gold/10 bg-card p-10 grid place-items-center">
          <div className="flex flex-col items-center gap-3 text-sm text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin text-gold" />
            De AI herschrijft de content per platform…
          </div>
        </div>
      )}

      {!generate.isPending && generate.isSuccess && posts.length === 0 && (
        <div className="rounded-xl border border-gold/10 bg-card p-10 text-center text-sm text-muted-foreground">
          Geen posts ontvangen — probeer het opnieuw.
        </div>
      )}

      {!generate.isPending && posts.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {posts.map((post, i) => {
            const Icon = STUDIO_PLATFORMS.find((p) => p.id === post.platform)?.Icon ?? Sparkles;
            const fullText =
              post.hashtags.length > 0 ? `${post.text}\n\n${post.hashtags.join(" ")}` : post.text;
            return (
              <div
                key={`${post.platform}-${i}`}
                className="rounded-xl border border-gold/10 bg-card p-4 flex flex-col gap-3"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-base flex items-center gap-2">
                    <Icon className="h-4 w-4 text-gold" />
                    {platformLabel(post.platform)}
                  </h3>
                  <CopyButton text={fullText} />
                </div>
                <p className="text-sm whitespace-pre-wrap flex-1">{post.text}</p>
                {post.hashtags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {post.hashtags.map((h, j) => (
                      <Badge key={j} variant="secondary" className="font-normal">
                        {h}
                      </Badge>
                    ))}
                  </div>
                )}
                {post.notes && (
                  <p className="text-xs text-muted-foreground flex items-start gap-1.5 border-t border-gold/10 pt-2.5">
                    <Lightbulb className="h-3.5 w-3.5 text-gold shrink-0 mt-0.5" />
                    {post.notes}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!generate.isPending && !generate.isSuccess && (
        <div className="rounded-xl border border-dashed border-gold/20 p-10 text-center">
          <Recycle className="h-8 w-8 text-gold/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            Plak één stuk content en krijg per platform een native herschreven post met hashtags en
            productie-tips.
          </p>
        </div>
      )}
    </div>
  );
}
