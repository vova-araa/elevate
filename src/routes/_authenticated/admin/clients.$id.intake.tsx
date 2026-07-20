import { useEffect } from "react";
import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Sparkles, Target } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { PLATFORMS } from "@/components/planner/planner-shared";
import {
  getIntake,
  saveIntake,
  generateStrategy,
  intakeAnswersSchema,
  type IntakeAnswers,
} from "@/lib/strategy.functions";
import type { CampaignPlatform } from "@/lib/campaigns.functions";

export const Route = createFileRoute("/_authenticated/admin/clients/$id/intake")({
  component: IntakeQuestionnairePage,
});

const INTAKE_DEFAULTS: IntakeAnswers = {
  positioning: "",
  audience: "",
  goalReach: false,
  goalLeads: false,
  goalSales: false,
  goalOther: "",
  toneOfVoice: "",
  competitors: "",
  contentThemes: "",
  platforms: [],
  platformFrequency: "",
  importantDates: "",
  dos: "",
  donts: "",
};

function IntakeQuestionnairePage() {
  const { id } = useParams({ from: "/_authenticated/admin/clients/$id/intake" });
  const navigate = useNavigate();
  const qc = useQueryClient();

  const getIntakeFn = useServerFn(getIntake);
  const saveIntakeFn = useServerFn(saveIntake);
  const generateStrategyFn = useServerFn(generateStrategy);

  const { data: client } = useQuery({
    queryKey: ["client", id],
    queryFn: async () =>
      (await supabase.from("clients").select("id, name, industry").eq("id", id).single()).data,
  });

  const { data: intake, isLoading } = useQuery({
    queryKey: ["client-intake", id],
    queryFn: () => getIntakeFn({ data: { clientId: id } }),
  });

  const form = useForm<IntakeAnswers>({
    resolver: zodResolver(intakeAnswersSchema),
    defaultValues: INTAKE_DEFAULTS,
  });

  useEffect(() => {
    if (intake?.answers) {
      form.reset({ ...INTAKE_DEFAULTS, ...(intake.answers as Partial<IntakeAnswers>) });
    }
  }, [intake, form]);

  const saveMutation = useMutation({
    mutationFn: (vars: { answers: IntakeAnswers; status: "draft" | "completed" }) =>
      saveIntakeFn({ data: { clientId: id, answers: vars.answers, status: vars.status } }),
    onSuccess: (saved) => {
      qc.setQueryData(["client-intake", id], saved);
      qc.invalidateQueries({ queryKey: ["client-intake", id] });
    },
  });

  const generateMutation = useMutation({
    mutationFn: () => generateStrategyFn({ data: { clientId: id } }),
    onSuccess: () => {
      toast.success("Strategie gegenereerd op basis van de intake");
      navigate({ to: "/admin/strategy" });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Genereren mislukt"),
  });

  async function onSaveDraft(values: IntakeAnswers) {
    try {
      await saveMutation.mutateAsync({ answers: values, status: "draft" });
      toast.success("Intake opgeslagen als concept");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Opslaan mislukt");
    }
  }

  async function onCompleteAndGenerate(values: IntakeAnswers) {
    try {
      await saveMutation.mutateAsync({ answers: values, status: "completed" });
      await generateMutation.mutateAsync();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Opslaan mislukt");
    }
  }

  function togglePlatform(p: CampaignPlatform) {
    const cur = form.getValues("platforms");
    form.setValue("platforms", cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p], {
      shouldDirty: true,
    });
  }

  const selectedPlatforms = form.watch("platforms");

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.25em] text-gold/70">Strategie-intake</p>
          <h1 className="font-display text-3xl sm:text-4xl mt-1 inline-flex items-center gap-2">
            <Target className="h-7 w-7 text-gold" />
            {client?.name ?? "Intake"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Beantwoord deze vragenlijst zodat de AI hier een contentstrategie en stappenplan uit kan
            opbouwen. De strategie is daarna altijd nog handmatig aan te passen.
          </p>
        </div>
        <Link
          to="/admin/clients/$id"
          params={{ id }}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground shrink-0"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Terug naar klant
        </Link>
      </div>

      {isLoading ? (
        <div className="rounded-xl border border-gold/10 bg-card p-10 text-center text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
          Intake laden…
        </div>
      ) : (
        <form className="space-y-5" onSubmit={form.handleSubmit(onCompleteAndGenerate)}>
          <Section title="Merk & positionering">
            <Field label="Positionering" hint="Hoe wil het merk gezien worden?">
              <Textarea rows={3} {...form.register("positioning")} />
            </Field>
            <Field label="Doelgroep" hint="Leeftijd, locatie, gedrag, koopmotivatie…">
              <Textarea rows={3} {...form.register("audience")} />
            </Field>
            <Field label="Concurrenten" hint="Belangrijkste 2-3 namen of accounts">
              <Textarea rows={2} {...form.register("competitors")} />
            </Field>
          </Section>

          <Section title="Doelen">
            <div className="grid gap-2 sm:grid-cols-3">
              <CheckboxField
                label="Bereik / naamsbekendheid"
                checked={form.watch("goalReach")}
                onChange={(v) => form.setValue("goalReach", v, { shouldDirty: true })}
              />
              <CheckboxField
                label="Leads"
                checked={form.watch("goalLeads")}
                onChange={(v) => form.setValue("goalLeads", v, { shouldDirty: true })}
              />
              <CheckboxField
                label="Verkoop"
                checked={form.watch("goalSales")}
                onChange={(v) => form.setValue("goalSales", v, { shouldDirty: true })}
              />
            </div>
            <Field label="Overige doelen" hint="Optioneel — vul aan wat hierboven niet past">
              <Textarea rows={2} {...form.register("goalOther")} />
            </Field>
          </Section>

          <Section title="Tone-of-voice & content">
            <Field label="Tone-of-voice" hint="Premium, speels, autoriteit, intiem, ironisch…">
              <Textarea rows={2} {...form.register("toneOfVoice")} />
            </Field>
            <Field label="Content-voorkeuren / thema's" hint="Waar moet content over gaan?">
              <Textarea rows={3} {...form.register("contentThemes")} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Wat past wél bij het merk">
                <Textarea rows={2} {...form.register("dos")} />
              </Field>
              <Field label="Wat past niet bij het merk">
                <Textarea rows={2} {...form.register("donts")} />
              </Field>
            </div>
          </Section>

          <Section title="Platforms & frequentie">
            <div>
              <label className="text-xs text-muted-foreground">Gewenste platforms</label>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {PLATFORMS.map(({ id: p, label, Icon }) => {
                  const active = selectedPlatforms.includes(p);
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => togglePlatform(p)}
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
            <Field label="Gewenste frequentie" hint="bv. 3x/week feed + 5x stories">
              <Textarea rows={2} {...form.register("platformFrequency")} />
            </Field>
            <Field label="Belangrijke data / seizoenen" hint="Campagnes, lanceringen, feestdagen…">
              <Textarea rows={2} {...form.register("importantDates")} />
            </Field>
          </Section>

          <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              disabled={saveMutation.isPending}
              onClick={form.handleSubmit(onSaveDraft)}
            >
              {saveMutation.isPending && generateMutation.isIdle ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              Concept opslaan
            </Button>
            <Button
              type="submit"
              disabled={saveMutation.isPending || generateMutation.isPending}
              className="bg-gradient-gold text-primary-foreground hover:brightness-105"
            >
              {generateMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              Opslaan & genereer strategie met AI
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gold/10 bg-card p-5 space-y-4">
      <div className="text-xs uppercase tracking-[0.2em] text-gold/80">{title}</div>
      {children}
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-xs text-muted-foreground">{label}</label>
      <div className="mt-1">{children}</div>
      {hint && <p className="mt-1 text-[11px] text-muted-foreground/70">{hint}</p>}
    </div>
  );
}

function CheckboxField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 rounded-lg border border-gold/15 px-3 py-2 text-sm cursor-pointer hover:border-gold/30">
      <Checkbox checked={checked} onCheckedChange={(v) => onChange(v === true)} />
      {label}
    </label>
  );
}
