import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Sparkles, Save, MessageSquareQuote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getToneOfVoice, saveToneOfVoice, suggestToneOfVoice } from "@/lib/ai-studio.functions";
import { ClientSelect, type StudioClient } from "./client-select";

export function ToneOfVoiceTab({ clients }: { clients: StudioClient[] }) {
  const [clientId, setClientId] = useState<string | null>(null);
  const [personality, setPersonality] = useState("");
  const [dos, setDos] = useState("");
  const [donts, setDonts] = useState("");
  const [examples, setExamples] = useState("");
  const [exampleTexts, setExampleTexts] = useState("");

  const qc = useQueryClient();
  const getFn = useServerFn(getToneOfVoice);
  const saveFn = useServerFn(saveToneOfVoice);
  const suggestFn = useServerFn(suggestToneOfVoice);

  const profileQuery = useQuery({
    queryKey: ["tone-of-voice", clientId],
    enabled: !!clientId,
    queryFn: async () => getFn({ data: { clientId: clientId! } }),
  });

  // Vul het formulier zodra het profiel geladen is (of maak leeg bij geen profiel)
  useEffect(() => {
    if (!clientId) return;
    const p = profileQuery.data?.profile;
    setPersonality(p?.personality ?? "");
    setDos(p?.dos ?? "");
    setDonts(p?.donts ?? "");
    setExamples(p?.examples ?? "");
  }, [clientId, profileQuery.data]);

  const save = useMutation({
    mutationFn: async () =>
      saveFn({ data: { clientId: clientId!, personality, dos, donts, examples } }),
    onSuccess: () => {
      toast.success("Tone-of-voice profiel opgeslagen");
      qc.invalidateQueries({ queryKey: ["tone-of-voice", clientId] });
    },
    onError: (e: Error) => toast.error(e.message || "Opslaan mislukt"),
  });

  const suggest = useMutation({
    mutationFn: async () =>
      suggestFn({ data: { clientId: clientId!, exampleTexts: exampleTexts.trim() || undefined } }),
    onSuccess: (r) => {
      setPersonality(r.personality);
      setDos(r.dos);
      setDonts(r.donts);
      setExamples(r.examples);
      toast.success("AI-voorstel geladen — controleer en sla op");
    },
    onError: (e: Error) => toast.error(e.message || "Voorstel genereren mislukt"),
  });

  const selectedClient = clients.find((c) => c.id === clientId);

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="rounded-xl border border-gold/10 bg-card p-5 space-y-2">
        <Label>Klant</Label>
        <ClientSelect clients={clients} value={clientId} onChange={setClientId} />
        <p className="text-[11px] text-muted-foreground">
          Het profiel wordt opgeslagen als strategie-notitie (categorie "tone of voice") en
          automatisch meegenomen bij caption-generatie en hergebruik.
        </p>
      </div>

      {!clientId && (
        <div className="rounded-xl border border-dashed border-gold/20 p-10 text-center">
          <MessageSquareQuote className="h-8 w-8 text-gold/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            Kies een klant om het tone-of-voice profiel te bekijken of bewerken.
          </p>
        </div>
      )}

      {clientId && profileQuery.isLoading && (
        <div className="rounded-xl border border-gold/10 bg-card p-10 grid place-items-center">
          <Loader2 className="h-6 w-6 animate-spin text-gold" />
        </div>
      )}

      {clientId && !profileQuery.isLoading && (
        <>
          {/* AI-voorstel */}
          <div className="rounded-xl border border-gold/10 bg-card p-5 space-y-3">
            <div>
              <h3 className="font-display text-base">Genereer voorstel met AI</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Plak (optioneel) bestaande teksten van {selectedClient?.name ?? "de klant"} —
                website-copy, eerdere posts, nieuwsbrieven — en laat de AI een profiel voorstellen.
              </p>
            </div>
            <Textarea
              value={exampleTexts}
              onChange={(e) => setExampleTexts(e.target.value)}
              placeholder="Plak hier voorbeeldteksten van de klant (optioneel)…"
              rows={5}
            />
            <Button
              variant="outline"
              onClick={() => suggest.mutate()}
              disabled={suggest.isPending}
              className="border-gold/30"
            >
              {suggest.isPending ? (
                <Loader2 className="animate-spin text-gold" />
              ) : (
                <Sparkles className="text-gold" />
              )}
              {suggest.isPending ? "Voorstel genereren…" : "Genereer voorstel met AI"}
            </Button>
          </div>

          {/* Profiel */}
          <div className="rounded-xl border border-gold/10 bg-card p-5 space-y-4">
            <h3 className="font-display text-base">
              Profiel — {selectedClient?.name ?? ""}
              {!profileQuery.data?.profile && (
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  (nog geen profiel opgeslagen)
                </span>
              )}
            </h3>
            <div className="space-y-2">
              <Label htmlFor="tov-personality">Merkpersoonlijkheid</Label>
              <Textarea
                id="tov-personality"
                value={personality}
                onChange={(e) => setPersonality(e.target.value)}
                placeholder="Bv: warm, nuchter en deskundig. Praat als een ervaren vriend, niet als een verkoper…"
                rows={4}
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="tov-dos">Do's</Label>
                <Textarea
                  id="tov-dos"
                  value={dos}
                  onChange={(e) => setDos(e.target.value)}
                  placeholder={
                    "- Spreek de lezer direct aan met 'je'\n- Gebruik concrete voorbeelden"
                  }
                  rows={6}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tov-donts">Don'ts</Label>
                <Textarea
                  id="tov-donts"
                  value={donts}
                  onChange={(e) => setDonts(e.target.value)}
                  placeholder={"- Geen jargon of buzzwords\n- Geen uitroeptekens stapelen"}
                  rows={6}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tov-examples">Voorbeeldzinnen</Label>
              <Textarea
                id="tov-examples"
                value={examples}
                onChange={(e) => setExamples(e.target.value)}
                placeholder={
                  "- Zo klinkt een openingszin van dit merk…\n- En zo een call-to-action…"
                }
                rows={5}
              />
            </div>
            <Button
              onClick={() => save.mutate()}
              disabled={save.isPending}
              className="bg-gradient-gold text-primary-foreground hover:opacity-90"
            >
              {save.isPending ? <Loader2 className="animate-spin" /> : <Save />}
              {save.isPending ? "Opslaan…" : "Profiel opslaan"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
