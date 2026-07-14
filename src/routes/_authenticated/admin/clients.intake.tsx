import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Building2,
  Target,
  Instagram,
  Music2,
  Linkedin,
  Youtube,
  Facebook,
  Sparkles,
  Users,
  FileText,
} from "lucide-react";
import { z } from "zod";

const intakeSearchSchema = z.object({
  clientId: z.string().uuid().optional(),
});

export const Route = createFileRoute("/_authenticated/admin/clients/intake")({
  validateSearch: intakeSearchSchema,
  component: IntakePage,
});

type PlatformStats = {
  handle?: string;
  followers?: string;
  engagement?: string;
  monthly_reach?: string;
  post_freq?: string;
  notes?: string;
};

type IntakeState = {
  // brand
  brand_name: string;
  industry: string;
  website: string;
  target_audience: string;
  brand_values: string;
  usp: string;
  competitors: string;
  // strategy
  main_goal: string;
  goals_3_months: string;
  goals_12_months: string;
  kpis: string;
  budget_range: string;
  content_pillars: string;
  tone_of_voice: string;
  preferred_formats: string;
  posting_frequency: string;
  // platforms
  instagram: PlatformStats;
  tiktok: PlatformStats;
  linkedin: PlatformStats;
  youtube: PlatformStats;
  facebook: PlatformStats;
  // awareness
  brand_awareness_score: number;
  perceived_strengths: string;
  perceived_weaknesses: string;
  top_performing_content: string;
  worst_performing_content: string;
  paid_ads_history: string;
  influencer_history: string;
  // resources
  has_photographer: boolean;
  has_videographer: boolean;
  has_copywriter: boolean;
  internal_team_notes: string;
  // notes
  extra_notes: string;
  create_client: boolean;
};

const init: IntakeState = {
  brand_name: "",
  industry: "",
  website: "",
  target_audience: "",
  brand_values: "",
  usp: "",
  competitors: "",
  main_goal: "",
  goals_3_months: "",
  goals_12_months: "",
  kpis: "",
  budget_range: "",
  content_pillars: "",
  tone_of_voice: "",
  preferred_formats: "",
  posting_frequency: "",
  instagram: {},
  tiktok: {},
  linkedin: {},
  youtube: {},
  facebook: {},
  brand_awareness_score: 5,
  perceived_strengths: "",
  perceived_weaknesses: "",
  top_performing_content: "",
  worst_performing_content: "",
  paid_ads_history: "",
  influencer_history: "",
  has_photographer: false,
  has_videographer: false,
  has_copywriter: false,
  internal_team_notes: "",
  extra_notes: "",
  create_client: true,
};

const steps = [
  { id: "brand", label: "Merk", Icon: Building2, hint: "Wie is de klant?" },
  { id: "strategy", label: "Strategie", Icon: Target, hint: "Doelen & richting" },
  { id: "social", label: "Social Awareness", Icon: Sparkles, hint: "Huidige stand per platform" },
  { id: "performance", label: "Prestaties", Icon: Sparkles, hint: "Wat werkt, wat niet" },
  { id: "resources", label: "Resources", Icon: Users, hint: "Wat is intern beschikbaar" },
  { id: "review", label: "Afronden", Icon: FileText, hint: "Controleer & opslaan" },
] as const;

function IntakePage() {
  const nav = useNavigate();
  const { clientId: presetClientId } = Route.useSearch();
  const [step, setStep] = useState(0);
  const [f, setF] = useState<IntakeState>(init);
  const [busy, setBusy] = useState(false);
  const [prefilled, setPrefilled] = useState(false);

  const { data: existingClient } = useQuery({
    queryKey: ["intake-client", presetClientId],
    enabled: !!presetClientId,
    queryFn: async () =>
      (await supabase.from("clients").select("*").eq("id", presetClientId!).maybeSingle()).data,
  });

  // Try to load most recent existing intake for this client and prefill
  useEffect(() => {
    if (!presetClientId || prefilled) return;
    (async () => {
      const { data: prev } = await supabase
        .from("client_intakes")
        .select("*")
        .eq("client_id", presetClientId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (prev) {
        setF((p) => ({
          ...p,
          ...Object.fromEntries(Object.entries(prev).filter(([k]) => k in init)),
          create_client: false,
        }));
        setPrefilled(true);
      } else if (existingClient) {
        setF((p) => ({
          ...p,
          brand_name: existingClient.name ?? "",
          industry: existingClient.industry ?? "",
          website: existingClient.website ?? "",
          usp: existingClient.description ?? "",
          create_client: false,
        }));
        setPrefilled(true);
      }
    })();
  }, [presetClientId, existingClient, prefilled]);

  const isExisting = !!presetClientId;

  const upd = <K extends keyof IntakeState>(k: K, v: IntakeState[K]) =>
    setF((p) => ({ ...p, [k]: v }));
  const updPlatform = (
    k: "instagram" | "tiktok" | "linkedin" | "youtube" | "facebook",
    patch: PlatformStats,
  ) => setF((p) => ({ ...p, [k]: { ...p[k], ...patch } }));

  async function save() {
    if (!f.brand_name.trim()) {
      setStep(0);
      return toast.error("Merknaam is verplicht");
    }
    setBusy(true);

    let clientId: string | null = presetClientId ?? null;
    if (!isExisting && f.create_client) {
      const { data: c, error: e } = await supabase
        .from("clients")
        .insert({
          name: f.brand_name,
          industry: f.industry || null,
          website: f.website || null,
          description: f.usp || null,
        })
        .select()
        .single();
      if (e) {
        setBusy(false);
        return toast.error(e.message);
      }
      clientId = c.id;
    }

    const { create_client: _omit, ...payload } = f;
    const { error } = await supabase.from("client_intakes").insert({
      ...payload,
      client_id: clientId,
    });
    setBusy(false);
    if (error) return toast.error(error.message);

    toast.success("Intake opgeslagen");
    if (clientId) nav({ to: "/admin/clients/$id", params: { id: clientId } });
    else nav({ to: "/admin/clients" });
  }

  const Step = steps[step];

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-gold/80">
            {isExisting ? "Update intake" : "Onboarding"}
          </p>
          <h1 className="font-display text-3xl sm:text-4xl mt-2">
            {isExisting && existingClient ? `Intake — ${existingClient.name}` : "Klant intake"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isExisting
              ? "Bestaande klant: werk strategie en huidige social awareness bij"
              : "Strategische vragenlijst: merk, doelen en huidige social awareness"}
          </p>
        </div>
        <Link
          to="/admin/clients"
          className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
        >
          <ArrowLeft className="h-3 w-3" /> Klanten
        </Link>
      </div>

      {/* Stepper */}
      <div className="glass rounded-2xl p-4">
        <div className="flex flex-wrap gap-2">
          {steps.map((s, i) => {
            const active = i === step;
            const done = i < step;
            return (
              <button
                key={s.id}
                onClick={() => setStep(i)}
                className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs transition border ${
                  active
                    ? "bg-gold/15 text-gold border-gold/40"
                    : done
                      ? "border-gold/20 text-foreground"
                      : "border-gold/10 text-muted-foreground hover:border-gold/30"
                }`}
              >
                {done ? <Check className="h-3 w-3 text-gold" /> : <s.Icon className="h-3 w-3" />}
                {s.label}
              </button>
            );
          })}
        </div>
        <div className="mt-3 h-1 rounded-full bg-input/40 overflow-hidden">
          <div
            className="h-full bg-gradient-gold transition-all"
            style={{ width: `${((step + 1) / steps.length) * 100}%` }}
          />
        </div>
      </div>

      <div className="glass-strong rounded-2xl p-5 sm:p-8 space-y-6">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-gold/80">{Step.hint}</div>
          <h2 className="font-display text-2xl mt-1">{Step.label}</h2>
        </div>

        {step === 0 && (
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Merknaam *" value={f.brand_name} onChange={(v) => upd("brand_name", v)} />
            <Field
              label="Industrie / sector"
              value={f.industry}
              onChange={(v) => upd("industry", v)}
              placeholder="Chocolatier, muziekstudio, parfumeur..."
            />
            <Field
              label="Website"
              value={f.website}
              onChange={(v) => upd("website", v)}
              placeholder="https://..."
            />
            <Field
              label="Concurrenten"
              value={f.competitors}
              onChange={(v) => upd("competitors", v)}
              placeholder="Belangrijkste 2-3 namen of accounts"
            />
            <Area
              className="sm:col-span-2"
              label="Doelgroep"
              value={f.target_audience}
              onChange={(v) => upd("target_audience", v)}
              placeholder="Leeftijd, locatie, gedrag, koopmotivatie..."
            />
            <Area
              className="sm:col-span-2"
              label="Merkwaarden / identiteit"
              value={f.brand_values}
              onChange={(v) => upd("brand_values", v)}
              placeholder="Wat staat het merk voor? 3-5 kernwoorden + uitleg"
            />
            <Area
              className="sm:col-span-2"
              label="USP — Waarom dit merk?"
              value={f.usp}
              onChange={(v) => upd("usp", v)}
              placeholder="Wat maakt dit merk uniek t.o.v. de concurrentie?"
            />
          </div>
        )}

        {step === 1 && (
          <div className="grid gap-5 sm:grid-cols-2">
            <Area
              className="sm:col-span-2"
              label="Hoofddoel social media"
              value={f.main_goal}
              onChange={(v) => upd("main_goal", v)}
              placeholder="Awareness, verkoop, community, autoriteit, leads..."
            />
            <Area
              label="Doelen — 3 maanden"
              value={f.goals_3_months}
              onChange={(v) => upd("goals_3_months", v)}
              placeholder="Concrete, meetbare doelen voor het eerste kwartaal"
            />
            <Area
              label="Doelen — 12 maanden"
              value={f.goals_12_months}
              onChange={(v) => upd("goals_12_months", v)}
              placeholder="Visie na een jaar samenwerken"
            />
            <Area
              className="sm:col-span-2"
              label="KPI's & succescriteria"
              value={f.kpis}
              onChange={(v) => upd("kpis", v)}
              placeholder="Volgers, bereik, engagement, conversies, omzet..."
            />
            <Field
              label="Budget (per maand)"
              value={f.budget_range}
              onChange={(v) => upd("budget_range", v)}
              placeholder="bv. €1.500 content + €500 ads"
            />
            <Field
              label="Postfrequentie (gewenst)"
              value={f.posting_frequency}
              onChange={(v) => upd("posting_frequency", v)}
              placeholder="bv. 3x/week feed + 5x stories"
            />
            <Area
              className="sm:col-span-2"
              label="Content pijlers"
              value={f.content_pillars}
              onChange={(v) => upd("content_pillars", v)}
              placeholder="3-5 thema's waar alle content uit voortkomt"
            />
            <Area
              label="Tone of voice"
              value={f.tone_of_voice}
              onChange={(v) => upd("tone_of_voice", v)}
              placeholder="Premium, speels, autoriteit, intiem, ironisch..."
            />
            <Area
              label="Voorkeur formats"
              value={f.preferred_formats}
              onChange={(v) => upd("preferred_formats", v)}
              placeholder="Reels, carrousels, stills, BTS, talking head..."
            />
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <p className="text-sm text-muted-foreground">
              Vul per platform de huidige situatie in. Laat leeg als ze niet aanwezig zijn.
            </p>
            <PlatformBlock
              label="Instagram"
              Icon={Instagram}
              stats={f.instagram}
              onChange={(p) => updPlatform("instagram", p)}
            />
            <PlatformBlock
              label="TikTok"
              Icon={Music2}
              stats={f.tiktok}
              onChange={(p) => updPlatform("tiktok", p)}
            />
            <PlatformBlock
              label="LinkedIn"
              Icon={Linkedin}
              stats={f.linkedin}
              onChange={(p) => updPlatform("linkedin", p)}
            />
            <PlatformBlock
              label="YouTube"
              Icon={Youtube}
              stats={f.youtube}
              onChange={(p) => updPlatform("youtube", p)}
            />
            <PlatformBlock
              label="Facebook"
              Icon={Facebook}
              stats={f.facebook}
              onChange={(p) => updPlatform("facebook", p)}
            />
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <div>
              <label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                Brand awareness — zelfbeoordeling ({f.brand_awareness_score}/10)
              </label>
              <input
                type="range"
                min={1}
                max={10}
                value={f.brand_awareness_score}
                onChange={(e) => upd("brand_awareness_score", Number(e.target.value))}
                className="mt-3 w-full accent-[hsl(var(--gold))]"
                style={{ accentColor: "#D4B97A" }}
              />
              <div className="flex justify-between text-[10px] uppercase tracking-wider text-muted-foreground mt-1">
                <span>Onbekend</span>
                <span>Top of mind</span>
              </div>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <Area
                label="Sterke punten huidige social"
                value={f.perceived_strengths}
                onChange={(v) => upd("perceived_strengths", v)}
                placeholder="Wat werkt al goed?"
              />
              <Area
                label="Zwakke punten / gaps"
                value={f.perceived_weaknesses}
                onChange={(v) => upd("perceived_weaknesses", v)}
                placeholder="Wat ontbreekt of werkt niet?"
              />
              <Area
                label="Best presterende content tot nu toe"
                value={f.top_performing_content}
                onChange={(v) => upd("top_performing_content", v)}
                placeholder="Links, formats of beschrijvingen"
              />
              <Area
                label="Slechtst presterende content"
                value={f.worst_performing_content}
                onChange={(v) => upd("worst_performing_content", v)}
                placeholder="Wat sloeg niet aan en waarom?"
              />
              <Area
                label="Historie betaalde ads"
                value={f.paid_ads_history}
                onChange={(v) => upd("paid_ads_history", v)}
                placeholder="Welke campagnes, budget, resultaat"
              />
              <Area
                label="Historie influencer / partnerships"
                value={f.influencer_history}
                onChange={(v) => upd("influencer_history", v)}
                placeholder="Welke samenwerkingen, resultaat"
              />
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <Toggle
                label="Eigen fotograaf"
                value={f.has_photographer}
                onChange={(v) => upd("has_photographer", v)}
              />
              <Toggle
                label="Eigen videograaf"
                value={f.has_videographer}
                onChange={(v) => upd("has_videographer", v)}
              />
              <Toggle
                label="Eigen copywriter"
                value={f.has_copywriter}
                onChange={(v) => upd("has_copywriter", v)}
              />
            </div>
            <Area
              label="Intern team & beschikbaarheid"
              value={f.internal_team_notes}
              onChange={(v) => upd("internal_team_notes", v)}
              placeholder="Wie levert wat aan, hoeveel uur p/w, contactpersonen..."
            />
            <Area
              label="Overige notities"
              value={f.extra_notes}
              onChange={(v) => upd("extra_notes", v)}
              placeholder="Alles wat nog niet aan bod kwam"
            />
          </div>
        )}

        {step === 5 && (
          <div className="space-y-5">
            <div className="rounded-xl border border-gold/20 p-4">
              <div className="text-xs uppercase tracking-wider text-gold/80">Samenvatting</div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 text-sm">
                <Summary k="Merk" v={f.brand_name || "—"} />
                <Summary k="Industrie" v={f.industry || "—"} />
                <Summary k="Hoofddoel" v={f.main_goal || "—"} />
                <Summary k="Budget" v={f.budget_range || "—"} />
                <Summary k="Awareness score" v={`${f.brand_awareness_score}/10`} />
                <Summary k="Postfrequentie" v={f.posting_frequency || "—"} />
              </div>
            </div>
            {isExisting ? (
              <div className="rounded-xl border border-gold/20 p-4 text-sm text-muted-foreground">
                Deze intake wordt opgeslagen en gekoppeld aan{" "}
                <span className="text-foreground font-medium">{existingClient?.name}</span>.
              </div>
            ) : (
              <label className="flex items-start gap-3 rounded-xl border border-gold/20 p-4 cursor-pointer hover:border-gold/40 transition">
                <input
                  type="checkbox"
                  checked={f.create_client}
                  onChange={(e) => upd("create_client", e.target.checked)}
                  className="mt-0.5 accent-[#D4B97A]"
                />
                <div>
                  <div className="text-sm font-medium">Direct klant aanmaken</div>
                  <div className="text-xs text-muted-foreground">
                    Maakt een nieuwe klant op basis van merknaam, industrie en website en koppelt
                    deze intake eraan.
                  </div>
                </div>
              </label>
            )}
          </div>
        )}

        {/* Nav */}
        <div className="flex items-center justify-between pt-4 border-t border-gold/10">
          <button
            disabled={step === 0}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            className="inline-flex items-center gap-1.5 rounded-full border border-gold/20 px-4 py-2 text-sm disabled:opacity-40"
          >
            <ArrowLeft className="h-4 w-4" /> Vorige
          </button>
          {step < steps.length - 1 ? (
            <button
              onClick={() => setStep((s) => Math.min(steps.length - 1, s + 1))}
              className="inline-flex items-center gap-1.5 rounded-full bg-gradient-gold px-5 py-2 text-sm font-medium text-primary-foreground glow-gold"
            >
              Volgende <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              disabled={busy}
              onClick={save}
              className="inline-flex items-center gap-1.5 rounded-full bg-gradient-gold px-5 py-2 text-sm font-medium text-primary-foreground glow-gold disabled:opacity-60"
            >
              {busy ? "Opslaan..." : "Intake opslaan"} <Check className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-2 w-full rounded-lg bg-input/60 hairline px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-gold/40"
      />
    </div>
  );
}

function Area({
  label,
  value,
  onChange,
  placeholder,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className="mt-2 w-full rounded-lg bg-input/60 hairline px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-gold/40 resize-y"
      />
    </div>
  );
}

function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label
      className={`flex items-center gap-3 rounded-xl border px-4 py-3 cursor-pointer transition ${
        value ? "border-gold/40 bg-gold/10" : "border-gold/15 hover:border-gold/30"
      }`}
    >
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
        className="accent-[#D4B97A]"
      />
      <span className="text-sm">{label}</span>
    </label>
  );
}

function PlatformBlock({
  label,
  Icon,
  stats,
  onChange,
}: {
  label: string;
  Icon: any;
  stats: PlatformStats;
  onChange: (p: PlatformStats) => void;
}) {
  return (
    <div className="rounded-xl border border-gold/15 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-gold" />
        <div className="font-medium text-sm">{label}</div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <SmallField
          label="Handle / URL"
          value={stats.handle || ""}
          onChange={(v) => onChange({ handle: v })}
        />
        <SmallField
          label="Volgers"
          value={stats.followers || ""}
          onChange={(v) => onChange({ followers: v })}
        />
        <SmallField
          label="Engagement %"
          value={stats.engagement || ""}
          onChange={(v) => onChange({ engagement: v })}
        />
        <SmallField
          label="Bereik (maand)"
          value={stats.monthly_reach || ""}
          onChange={(v) => onChange({ monthly_reach: v })}
        />
        <SmallField
          label="Posts per week"
          value={stats.post_freq || ""}
          onChange={(v) => onChange({ post_freq: v })}
        />
        <SmallField
          label="Notities"
          value={stats.notes || ""}
          onChange={(v) => onChange({ notes: v })}
        />
      </div>
    </div>
  );
}

function SmallField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-md bg-input/60 hairline px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-gold/40"
      />
    </div>
  );
}

function Summary({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{k}</div>
      <div className="mt-0.5 truncate">{v}</div>
    </div>
  );
}
