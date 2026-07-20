import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { startOfWeek, addDays, format } from "date-fns";
import { nl } from "date-fns/locale";
import {
  Target,
  Sparkles,
  Loader2,
  CalendarDays,
  Pencil,
  X,
  Save,
  ArrowRight,
  ClipboardList,
} from "lucide-react";
import { useClientStore } from "@/lib/stores/client-store";
import { PLATFORMS } from "@/components/planner/planner-shared";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  getIntake,
  getStrategy,
  saveStrategy,
  generateStrategy,
  generateWeekPlan,
  type Cadence,
  type WeekPlanDay,
} from "@/lib/strategy.functions";
import type { CampaignPlatform } from "@/lib/campaigns.functions";

export const Route = createFileRoute("/_authenticated/admin/strategy")({
  component: StrategyPage,
});

interface StrategyForm {
  positioning: string;
  audience: string;
  tone: string;
  pillars: string[];
  cadence: Cadence;
  goals: string;
  dos: string[];
  donts: string[];
}

const EMPTY_FORM: StrategyForm = {
  positioning: "",
  audience: "",
  tone: "",
  pillars: [],
  cadence: {},
  goals: "",
  dos: [],
  donts: [],
};

function toStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

function nextMondayISO(): string {
  const monday = startOfWeek(new Date(), { weekStartsOn: 1 });
  // Als vandaag al voorbij de start van de week is, pak toch deze week —
  // de admin kan de datum zelf nog aanpassen.
  return format(monday, "yyyy-MM-dd");
}

function StrategyPage() {
  const { activeClient } = useClientStore();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const clientId = activeClient?.id ?? null;

  const getIntakeFn = useServerFn(getIntake);
  const getStrategyFn = useServerFn(getStrategy);
  const saveStrategyFn = useServerFn(saveStrategy);
  const generateStrategyFn = useServerFn(generateStrategy);
  const generateWeekPlanFn = useServerFn(generateWeekPlan);

  const { data: intake } = useQuery({
    queryKey: ["client-intake", clientId],
    queryFn: () => getIntakeFn({ data: { clientId: clientId! } }),
    enabled: !!clientId,
  });

  const { data: strategy, isLoading: strategyLoading } = useQuery({
    queryKey: ["client-strategy", clientId],
    queryFn: () => getStrategyFn({ data: { clientId: clientId! } }),
    enabled: !!clientId,
  });

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<StrategyForm>(EMPTY_FORM);
  const [weekStart, setWeekStart] = useState(nextMondayISO());
  const [weekPlan, setWeekPlan] = useState<WeekPlanDay[] | null>(null);

  useEffect(() => {
    if (strategy) {
      setForm({
        positioning: strategy.positioning ?? "",
        audience: strategy.audience ?? "",
        tone: strategy.tone ?? "",
        pillars: toStringArray(strategy.pillars),
        cadence: (strategy.cadence ?? {}) as Cadence,
        goals: strategy.goals ?? "",
        dos: toStringArray(strategy.dos),
        donts: toStringArray(strategy.donts),
      });
    } else {
      setForm(EMPTY_FORM);
    }
    setWeekPlan(null);
  }, [strategy]);

  const saveMutation = useMutation({
    mutationFn: (vars: StrategyForm) =>
      saveStrategyFn({
        data: {
          clientId: clientId!,
          positioning: vars.positioning || null,
          audience: vars.audience || null,
          tone: vars.tone || null,
          pillars: vars.pillars,
          cadence: vars.cadence,
          goals: vars.goals || null,
          dos: vars.dos,
          donts: vars.donts,
        },
      }),
    onSuccess: (saved) => {
      qc.setQueryData(["client-strategy", clientId], saved);
      setEditing(false);
      toast.success("Strategie opgeslagen");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Opslaan mislukt"),
  });

  const generateMutation = useMutation({
    mutationFn: () => generateStrategyFn({ data: { clientId: clientId! } }),
    onSuccess: (saved) => {
      qc.setQueryData(["client-strategy", clientId], saved);
      setEditing(false);
      toast.success("Strategie gegenereerd met AI");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Genereren mislukt"),
  });

  const weekPlanMutation = useMutation({
    mutationFn: () =>
      generateWeekPlanFn({ data: { clientId: clientId!, weekStartISO: weekStart } }),
    onSuccess: (res) => {
      setWeekPlan(res.days);
      toast.success(`${res.inserted} concepten toegevoegd aan de planner`);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Weekplanning genereren mislukt"),
  });

  if (!clientId) {
    return (
      <div className="max-w-4xl">
        <Header />
        <div className="rounded-xl border border-gold/10 bg-card p-10 text-center">
          <Target className="h-8 w-8 text-gold mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            Selecteer eerst een klant (⌘K of via Klanten) om diens strategie te bekijken of te
            bewerken.
          </p>
        </div>
      </div>
    );
  }

  const hasIntake = !!intake?.answers && Object.keys(intake.answers as object).length > 0;

  if (!hasIntake) {
    return (
      <div className="max-w-4xl space-y-6">
        <Header client={activeClient?.name} />
        <div className="rounded-xl border border-gold/10 bg-card p-10 text-center space-y-4">
          <ClipboardList className="h-8 w-8 text-gold mx-auto" />
          <div>
            <h2 className="font-display text-2xl">Nog geen intake ingevuld</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Vul eerst de strategie-intake in voor {activeClient?.name} — daaruit bouwt de AI de
              contentstrategie op.
            </p>
          </div>
          <Link
            to="/admin/clients/$id/intake"
            params={{ id: clientId }}
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-gold px-4 py-2 text-sm font-medium text-primary-foreground hover:brightness-105 transition"
          >
            <Sparkles className="h-4 w-4" /> Naar de intake
          </Link>
        </div>
      </div>
    );
  }

  const hasStrategy = !!strategy;

  return (
    <div className="max-w-5xl space-y-6">
      <Header client={activeClient?.name} source={strategy?.source} />

      <div className="flex flex-wrap gap-3">
        <Button
          onClick={() => generateMutation.mutate()}
          disabled={generateMutation.isPending}
          className="bg-gradient-gold text-primary-foreground hover:brightness-105"
        >
          {generateMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          {hasStrategy ? "Hergenereer met AI" : "Genereer strategie met AI"}
        </Button>
        {!editing && (
          <Button variant="outline" onClick={() => setEditing(true)}>
            <Pencil className="h-4 w-4" /> Handmatig bewerken
          </Button>
        )}
      </div>

      {strategyLoading ? (
        <div className="rounded-xl border border-gold/10 bg-card p-10 text-center text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
          Strategie laden…
        </div>
      ) : editing ? (
        <StrategyEditForm
          form={form}
          setForm={setForm}
          onCancel={() => {
            setEditing(false);
            if (strategy) {
              setForm({
                positioning: strategy.positioning ?? "",
                audience: strategy.audience ?? "",
                tone: strategy.tone ?? "",
                pillars: toStringArray(strategy.pillars),
                cadence: (strategy.cadence ?? {}) as Cadence,
                goals: strategy.goals ?? "",
                dos: toStringArray(strategy.dos),
                donts: toStringArray(strategy.donts),
              });
            } else {
              setForm(EMPTY_FORM);
            }
          }}
          onSave={() => saveMutation.mutate(form)}
          saving={saveMutation.isPending}
        />
      ) : hasStrategy ? (
        <StrategyOverview strategy={form} />
      ) : (
        <div className="rounded-xl border border-gold/10 bg-card p-10 text-center text-sm text-muted-foreground">
          Nog geen strategie ingesteld. Genereer er één met AI of stel hem handmatig in.
        </div>
      )}

      {hasStrategy && !editing && (
        <div className="rounded-xl border border-gold/10 bg-card p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-gold/80">Weekplanning</div>
              <p className="text-sm text-muted-foreground mt-1">
                Genereer op basis van de strategie concrete post-ideeën voor een week — deze worden
                direct als concept in de planner gezet.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={weekStart}
                onChange={(e) => setWeekStart(e.target.value)}
                className="h-9 w-40 text-sm"
              />
              <Button
                onClick={() => weekPlanMutation.mutate()}
                disabled={weekPlanMutation.isPending}
                className="bg-gradient-gold text-primary-foreground hover:brightness-105 shrink-0"
              >
                {weekPlanMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CalendarDays className="h-4 w-4" />
                )}
                Genereer weekplanning
              </Button>
            </div>
          </div>

          {weekPlan && (
            <div className="space-y-3 pt-2 border-t border-gold/10">
              <div className="grid gap-3 md:grid-cols-2">
                {weekPlan.map((day) => (
                  <div
                    key={day.date}
                    className="rounded-lg border border-gold/10 bg-background/40 p-3"
                  >
                    <div className="text-xs uppercase tracking-wider text-gold/80">
                      {format(new Date(`${day.date}T00:00:00`), "EEEE d MMMM", { locale: nl })}
                    </div>
                    <div className="mt-2 space-y-2">
                      {day.items.map((it, i) => {
                        const meta = PLATFORMS.find((p) => p.id === it.platform);
                        const Icon = meta?.Icon ?? Sparkles;
                        return (
                          <div key={i} className="rounded-md bg-gold/5 px-2.5 py-2">
                            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                              <Icon className="h-3 w-3 text-gold" />
                              {meta?.label ?? it.platform}
                            </div>
                            <div className="text-sm font-medium mt-0.5">{it.title}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-end">
                <button
                  onClick={() => navigate({ to: "/admin/planner", search: { clientId } })}
                  className="inline-flex items-center gap-1.5 text-xs text-gold hover:underline"
                >
                  Bekijk in planner <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Header({ client, source }: { client?: string | null; source?: string | null }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.25em] text-gold/70">AI</div>
      <h1 className="font-display text-3xl sm:text-4xl text-gold mt-1 inline-flex items-center gap-2">
        <Target className="h-7 w-7" /> Strategie
        {client && <span className="text-foreground">— {client}</span>}
      </h1>
      <p className="text-sm text-muted-foreground mt-1">
        De vaste contentstrategie van deze klant — wordt standaard gebruikt als context bij het
        genereren van contentplannen en weekplanningen.
        {source && (
          <span className="ml-2 text-[11px] uppercase tracking-wider text-gold/70">
            ({source === "ai" ? "AI-gegenereerd" : "Handmatig ingesteld"})
          </span>
        )}
      </p>
    </div>
  );
}

function StrategyOverview({ strategy }: { strategy: StrategyForm }) {
  const activePlatforms = PLATFORMS.filter((p) => (strategy.cadence[p.id] ?? 0) > 0);
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <InfoCard title="Positionering" body={strategy.positioning} />
        <InfoCard title="Doelgroep" body={strategy.audience} />
        <InfoCard title="Tone-of-voice" body={strategy.tone} />
        <InfoCard title="Doelen" body={strategy.goals} />
      </div>

      <div className="rounded-xl border border-gold/10 bg-card p-5">
        <div className="text-xs uppercase tracking-[0.2em] text-gold/80 mb-3">Content-pijlers</div>
        <div className="flex flex-wrap gap-2">
          {strategy.pillars.length ? (
            strategy.pillars.map((p, i) => (
              <span
                key={`${p}-${i}`}
                className="rounded-full bg-gold/10 text-gold text-xs px-3 py-1.5"
              >
                {p}
              </span>
            ))
          ) : (
            <span className="text-sm text-muted-foreground">Nog geen pijlers ingesteld.</span>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-gold/10 bg-card p-5">
        <div className="text-xs uppercase tracking-[0.2em] text-gold/80 mb-3">
          Cadans — posts per week
        </div>
        {activePlatforms.length ? (
          <div className="grid gap-2 sm:grid-cols-3">
            {activePlatforms.map(({ id: p, label, Icon }) => (
              <div
                key={p}
                className="flex items-center gap-2 rounded-lg border border-gold/15 px-3 py-2"
              >
                <Icon className="h-4 w-4 text-gold shrink-0" />
                <span className="text-sm flex-1">{label}</span>
                <span className="font-display text-lg text-gold">{strategy.cadence[p]}x</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Nog geen cadans ingesteld.</p>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <ListCard title="Wel doen" items={strategy.dos} tone="good" />
        <ListCard title="Niet doen" items={strategy.donts} tone="warn" />
      </div>
    </div>
  );
}

function InfoCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-gold/10 bg-card p-5">
      <div className="text-xs uppercase tracking-[0.2em] text-gold/80">{title}</div>
      <p className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">{body || "—"}</p>
    </div>
  );
}

function ListCard({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "good" | "warn";
}) {
  return (
    <div className="rounded-xl border border-gold/10 bg-card p-5">
      <div
        className={
          "text-xs uppercase tracking-[0.2em] " +
          (tone === "good" ? "text-gold/80" : "text-destructive/80")
        }
      >
        {title}
      </div>
      {items.length ? (
        <ul className="mt-2 space-y-1.5 text-sm">
          {items.map((it, i) => (
            <li key={i} className="text-muted-foreground">
              • {it}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">—</p>
      )}
    </div>
  );
}

function StrategyEditForm({
  form,
  setForm,
  onCancel,
  onSave,
  saving,
}: {
  form: StrategyForm;
  setForm: React.Dispatch<React.SetStateAction<StrategyForm>>;
  onCancel: () => void;
  onSave: () => void;
  saving: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gold/10 bg-card p-5 space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Positionering">
            <Textarea
              rows={3}
              value={form.positioning}
              onChange={(e) => setForm((f) => ({ ...f, positioning: e.target.value }))}
            />
          </Field>
          <Field label="Doelgroep">
            <Textarea
              rows={3}
              value={form.audience}
              onChange={(e) => setForm((f) => ({ ...f, audience: e.target.value }))}
            />
          </Field>
          <Field label="Tone-of-voice">
            <Textarea
              rows={2}
              value={form.tone}
              onChange={(e) => setForm((f) => ({ ...f, tone: e.target.value }))}
            />
          </Field>
          <Field label="Doelen">
            <Textarea
              rows={2}
              value={form.goals}
              onChange={(e) => setForm((f) => ({ ...f, goals: e.target.value }))}
            />
          </Field>
        </div>
      </div>

      <div className="rounded-xl border border-gold/10 bg-card p-5">
        <TagListEditor
          label="Content-pijlers"
          values={form.pillars}
          onChange={(v) => setForm((f) => ({ ...f, pillars: v }))}
          placeholder="bv. Behind the scenes"
        />
      </div>

      <div className="rounded-xl border border-gold/10 bg-card p-5">
        <label className="text-xs text-muted-foreground">Cadans — posts per week</label>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {PLATFORMS.map(({ id: p, label, Icon }) => (
            <div
              key={p}
              className="flex items-center gap-2 rounded-lg border border-gold/15 px-3 py-2"
            >
              <Icon className="h-4 w-4 text-gold shrink-0" />
              <span className="text-xs flex-1">{label}</span>
              <Input
                type="number"
                min={0}
                max={14}
                value={form.cadence[p as CampaignPlatform] ?? 0}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    cadence: {
                      ...f.cadence,
                      [p]: Math.max(0, Math.min(14, Number(e.target.value) || 0)),
                    },
                  }))
                }
                className="h-8 w-16 text-xs text-right"
              />
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-gold/10 bg-card p-5">
          <TagListEditor
            label="Wel doen"
            values={form.dos}
            onChange={(v) => setForm((f) => ({ ...f, dos: v }))}
            placeholder="bv. Altijd ondertitels toevoegen"
          />
        </div>
        <div className="rounded-xl border border-gold/10 bg-card p-5">
          <TagListEditor
            label="Niet doen"
            values={form.donts}
            onChange={(v) => setForm((f) => ({ ...f, donts: v }))}
            placeholder="bv. Geen politieke uitspraken"
          />
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel}>
          <X className="h-4 w-4" /> Annuleren
        </Button>
        <Button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="bg-gradient-gold text-primary-foreground hover:brightness-105"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Opslaan
        </Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs text-muted-foreground">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function TagListEditor({
  label,
  values,
  onChange,
  placeholder,
}: {
  label: string;
  values: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");
  function add() {
    const v = draft.trim();
    if (!v) return;
    onChange([...values, v]);
    setDraft("");
  }
  return (
    <div>
      <label className="text-xs text-muted-foreground">{label}</label>
      <div className="mt-1.5 mb-2 flex flex-wrap gap-1.5">
        {values.map((v, i) => (
          <span
            key={`${v}-${i}`}
            className="inline-flex items-center gap-1 rounded-full bg-gold/10 text-gold text-xs px-2.5 py-1"
          >
            {v}
            <button
              type="button"
              onClick={() => onChange(values.filter((_, idx) => idx !== i))}
              className="hover:text-destructive"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        {values.length === 0 && (
          <span className="text-xs text-muted-foreground/60">Nog niets toegevoegd</span>
        )}
      </div>
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={placeholder}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          className="h-9 text-sm"
        />
        <Button type="button" variant="outline" size="sm" onClick={add}>
          Toevoegen
        </Button>
      </div>
    </div>
  );
}
