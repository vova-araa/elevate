import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Mail, Phone, MapPin, ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";
import elevateLogoUrl from "@/assets/elevate-logo.png";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PLATFORMS } from "@/config/platforms";
import { BUSINESS } from "@/config/business";
import { submitLead } from "@/lib/leads.functions";
import { track } from "@/lib/analytics";
import { SiteFooter } from "@/components/site-footer";

const SITE_URL = "https://www.elevatedesign.nl";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact — Elevate Design" },
      {
        name: "description",
        content:
          "Plan een merkscan of stel je vraag. We reageren binnen één werkdag met een concreet vervolg.",
      },
      { property: "og:type", content: "website" },
      { property: "og:title", content: "Contact — Elevate Design" },
      {
        property: "og:description",
        content:
          "Plan een merkscan of stel je vraag. We reageren binnen één werkdag met een concreet vervolg.",
      },
      { property: "og:url", content: `${SITE_URL}/contact` },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/contact` }],
  }),
  component: ContactPage,
});

const BUDGET_RANGES = [
  "Nog niet bekend",
  "Tot € 500 / maand",
  "€ 500 – € 1.500 / maand",
  "€ 1.500 – € 3.000 / maand",
  "Meer dan € 3.000 / maand",
];

const SOURCES = ["Google", "Social media", "Doorverwezen door iemand", "Anders"];

const contactFormSchema = z.object({
  naam: z.string().trim().min(2, "Vul je naam in").max(120),
  bedrijf: z.string().trim().max(160).optional().or(z.literal("")),
  email: z.string().trim().email("Vul een geldig e-mailadres in").max(200),
  telefoon: z.string().trim().max(40).optional().or(z.literal("")),
  website: z.string().trim().max(200).optional().or(z.literal("")),
  kanalen: z.array(z.string()),
  budgetrange: z.string().optional().or(z.literal("")),
  doel: z.string().trim().max(2000).optional().or(z.literal("")),
  hoeGevonden: z.string().optional().or(z.literal("")),
  // Honeypot: onzichtbaar voor mensen, autofill-gevoelig voor bots.
  nickname: z.string().max(0).optional().or(z.literal("")),
});
type ContactFormValues = z.infer<typeof contactFormSchema>;

function ContactPage() {
  const [submitted, setSubmitted] = useState(false);
  const [startedTracked, setStartedTracked] = useState(false);
  const [formOpenedAt] = useState(() => Date.now());
  const submit = useServerFn(submitLead);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ContactFormValues>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      naam: "",
      bedrijf: "",
      email: "",
      telefoon: "",
      website: "",
      kanalen: [],
      budgetrange: "",
      doel: "",
      hoeGevonden: "",
      nickname: "",
    },
  });

  const kanalen = watch("kanalen");

  function onFormFocus() {
    if (startedTracked) return;
    setStartedTracked(true);
    track("lead_form_start");
  }

  async function onSubmit(values: ContactFormValues) {
    try {
      await submit({
        data: {
          naam: values.naam,
          bedrijf: values.bedrijf || undefined,
          email: values.email,
          telefoon: values.telefoon || undefined,
          website: values.website || undefined,
          kanalen: values.kanalen,
          budgetrange: values.budgetrange || undefined,
          doel: values.doel || undefined,
          hoeGevonden: values.hoeGevonden || undefined,
          nickname: values.nickname || "",
          formOpenedAt,
        },
      });
      track("lead_form_submit");
      setSubmitted(true);
    } catch {
      // react-hook-form laat de gebruiker gewoon opnieuw proberen; de
      // serverfunctie geeft in dat geval een generieke foutmelding terug die
      // we hier bewust niet verder specificeren (geen systeeminterna lekken).
      setValue("nickname", ""); // veiligheidshalve resetten
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-luxe">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[40vh] opacity-60"
        style={{ background: "var(--gradient-glow)" }}
      />
      <header className="relative z-10 mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
        <Link to="/" className="flex items-center gap-2.5">
          <img src={elevateLogoUrl} alt="Elevate Design" className="h-7 w-7 object-contain" />
          <span className="font-display text-lg tracking-wide">Elevate Design</span>
        </Link>
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 rounded-full border border-gold/30 px-4 py-1.5 text-xs uppercase tracking-[0.18em] text-gold hover:border-gold/50 hover:bg-gold/5"
        >
          <ArrowLeft className="h-3 w-3" /> Home
        </Link>
      </header>

      <main className="relative z-10 mx-auto max-w-5xl px-6 pb-24 pt-10">
        <p className="text-[10px] uppercase tracking-[0.24em] text-gold/80">Contact</p>
        <h1 className="mt-2 font-display text-4xl md:text-5xl">Plan een merkscan</h1>
        <p className="mt-3 max-w-xl text-sm text-muted-foreground">
          Vertel kort over je merk en waar je hulp bij zoekt. We reageren binnen één werkdag met een
          concreet vervolg.
        </p>

        <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_1.4fr]">
          {/* Contactgegevens */}
          <div className="space-y-4">
            <div className="rounded-xl border border-gold/10 bg-card/60 p-5 backdrop-blur-sm">
              <h2 className="font-display text-lg text-gold">Rechtstreeks</h2>
              <div className="mt-3 space-y-2.5 text-sm">
                <a
                  href={`mailto:${BUSINESS.email}`}
                  className="flex items-center gap-2 hover:text-gold"
                >
                  <Mail className="h-4 w-4 shrink-0 text-gold/70" /> {BUSINESS.email}
                </a>
                <a
                  href={`tel:${BUSINESS.phone}`}
                  className="flex items-center gap-2 hover:text-gold"
                >
                  <Phone className="h-4 w-4 shrink-0 text-gold/70" /> {BUSINESS.phone}
                </a>
                <p className="flex items-start gap-2 text-muted-foreground">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gold/70" />
                  <span>
                    {BUSINESS.street}
                    <br />
                    {BUSINESS.postalCode} {BUSINESS.city}
                  </span>
                </p>
              </div>
            </div>
            <div className="rounded-xl border border-gold/10 bg-card/60 p-5 backdrop-blur-sm text-sm text-muted-foreground">
              Al klant?{" "}
              <Link to="/auth" className="text-gold hover:underline">
                Log in op het portaal
              </Link>
              .
            </div>
          </div>

          {/* Formulier */}
          <div className="rounded-2xl border border-gold/10 bg-card/60 p-6 backdrop-blur-sm">
            {submitted ? (
              <div className="flex flex-col items-center py-10 text-center">
                <CheckCircle2 className="h-10 w-10 text-gold" />
                <h2 className="mt-4 font-display text-2xl">Verstuurd</h2>
                <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                  Bedankt — je aanvraag is bij ons binnen. We reageren binnen één werkdag.
                </p>
              </div>
            ) : (
              <form
                noValidate
                onSubmit={handleSubmit(onSubmit)}
                onFocus={onFormFocus}
                className="space-y-5"
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="naam">Naam *</Label>
                    <Input
                      id="naam"
                      autoComplete="name"
                      aria-invalid={!!errors.naam}
                      aria-describedby={errors.naam ? "naam-error" : undefined}
                      className="mt-1.5"
                      {...register("naam")}
                    />
                    {errors.naam && (
                      <p id="naam-error" className="mt-1 text-xs text-destructive">
                        {errors.naam.message}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="bedrijf">Bedrijf</Label>
                    <Input
                      id="bedrijf"
                      autoComplete="organization"
                      className="mt-1.5"
                      {...register("bedrijf")}
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="email">E-mail *</Label>
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      aria-invalid={!!errors.email}
                      aria-describedby={errors.email ? "email-error" : undefined}
                      className="mt-1.5"
                      {...register("email")}
                    />
                    {errors.email && (
                      <p id="email-error" className="mt-1 text-xs text-destructive">
                        {errors.email.message}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="telefoon">Telefoon</Label>
                    <Input
                      id="telefoon"
                      type="tel"
                      autoComplete="tel"
                      className="mt-1.5"
                      {...register("telefoon")}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="website">Website</Label>
                  <Input
                    id="website"
                    autoComplete="url"
                    placeholder="https://"
                    className="mt-1.5"
                    {...register("website")}
                  />
                </div>

                <fieldset>
                  <legend className="text-sm font-medium">Welke kanalen?</legend>
                  <div className="mt-2 flex flex-wrap gap-3">
                    {PLATFORMS.map((p) => (
                      <label
                        key={p.id}
                        className="flex items-center gap-2 rounded-lg border border-border/60 px-3 py-2 text-sm cursor-pointer hover:border-gold/40"
                      >
                        <Checkbox
                          checked={kanalen.includes(p.id)}
                          onCheckedChange={(checked) => {
                            setValue(
                              "kanalen",
                              checked ? [...kanalen, p.id] : kanalen.filter((k) => k !== p.id),
                            );
                          }}
                        />
                        {p.label}
                      </label>
                    ))}
                  </div>
                </fieldset>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="budgetrange">Budget</Label>
                    <Select
                      value={watch("budgetrange")}
                      onValueChange={(v) => setValue("budgetrange", v)}
                    >
                      <SelectTrigger id="budgetrange" className="mt-1.5">
                        <SelectValue placeholder="Kies een indicatie" />
                      </SelectTrigger>
                      <SelectContent>
                        {BUDGET_RANGES.map((b) => (
                          <SelectItem key={b} value={b}>
                            {b}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="hoeGevonden">Hoe vond je ons?</Label>
                    <Select
                      value={watch("hoeGevonden")}
                      onValueChange={(v) => setValue("hoeGevonden", v)}
                    >
                      <SelectTrigger id="hoeGevonden" className="mt-1.5">
                        <SelectValue placeholder="Kies een optie" />
                      </SelectTrigger>
                      <SelectContent>
                        {SOURCES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="doel">Waar zoek je hulp bij?</Label>
                  <Textarea
                    id="doel"
                    rows={4}
                    placeholder="Bijvoorbeeld: meer herkenbaarheid op Instagram, of eindelijk een vaste contentkalender."
                    className="mt-1.5"
                    {...register("doel")}
                  />
                </div>

                {/* Honeypot — onzichtbaar voor mensen, tabIndex -1 zodat toetsenbordgebruikers hem overslaan. */}
                <div
                  className="absolute -left-[9999px] top-auto h-0 w-0 overflow-hidden"
                  aria-hidden="true"
                >
                  <label htmlFor="nickname">Laat dit veld leeg</label>
                  <input
                    id="nickname"
                    type="text"
                    tabIndex={-1}
                    autoComplete="off"
                    {...register("nickname")}
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full rounded-lg bg-gradient-gold py-3 text-sm font-medium text-primary-foreground inline-flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Aanvraag versturen
                </button>
              </form>
            )}
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
