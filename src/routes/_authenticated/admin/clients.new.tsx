import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Instagram, Music2, Linkedin, Youtube, Facebook } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/clients/new")({
  component: NewClient,
});

function NewClient() {
  const nav = useNavigate();
  const [f, setF] = useState({
    name: "",
    industry: "",
    description: "",
    website: "",
    brand_color: "#D4B97A",
    instagram_url: "",
    tiktok_url: "",
    linkedin_url: "",
    youtube_url: "",
    facebook_url: "",
  });
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const payload: any = { ...f };
    Object.keys(payload).forEach((k) => {
      if (payload[k] === "") payload[k] = null;
    });
    payload.name = f.name;
    const { data, error } = await supabase.from("clients").insert(payload).select().single();
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Klant aangemaakt");
    nav({ to: "/admin/clients/$id", params: { id: data.id } });
  }

  const socials = [
    { k: "instagram_url", label: "Instagram", Icon: Instagram, ph: "https://instagram.com/..." },
    { k: "tiktok_url", label: "TikTok", Icon: Music2, ph: "https://tiktok.com/@..." },
    {
      k: "linkedin_url",
      label: "LinkedIn",
      Icon: Linkedin,
      ph: "https://linkedin.com/company/...",
    },
    { k: "youtube_url", label: "YouTube", Icon: Youtube, ph: "https://youtube.com/@..." },
    { k: "facebook_url", label: "Facebook", Icon: Facebook, ph: "https://facebook.com/..." },
  ] as const;

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <p className="text-xs uppercase tracking-[0.22em] text-gold/80">Nieuw</p>
        <h1 className="font-display text-3xl sm:text-4xl mt-2">Klant toevoegen</h1>
      </div>
      <form onSubmit={save} className="glass-strong rounded-2xl p-5 sm:p-8 space-y-5">
        {[
          { k: "name", label: "Merknaam", required: true },
          {
            k: "industry",
            label: "Industrie",
            placeholder: "Chocolatier, parfumeur, muziekstudio...",
          },
          { k: "website", label: "Website", placeholder: "https://..." },
        ].map((x: any) => (
          <div key={x.k}>
            <label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              {x.label}
            </label>
            <input
              value={(f as any)[x.k]}
              onChange={(e) => setF({ ...f, [x.k]: e.target.value })}
              required={x.required}
              placeholder={x.placeholder}
              className="mt-2 w-full rounded-lg bg-input/60 hairline px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-gold/40"
            />
          </div>
        ))}
        <div>
          <label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Omschrijving
          </label>
          <textarea
            value={f.description}
            onChange={(e) => setF({ ...f, description: e.target.value })}
            rows={4}
            className="mt-2 w-full rounded-lg bg-input/60 hairline px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-gold/40"
          />
        </div>

        <div className="space-y-3 pt-2 border-t border-gold/15">
          <div className="text-xs uppercase tracking-[0.18em] text-gold/80">Socials koppelen</div>
          {socials.map(({ k, label, Icon, ph }) => (
            <div key={k} className="flex items-center gap-2">
              <Icon className="h-4 w-4 text-gold/80 shrink-0" />
              <input
                value={(f as any)[k]}
                onChange={(e) => setF({ ...f, [k]: e.target.value })}
                placeholder={`${label} — ${ph}`}
                className="flex-1 rounded-lg bg-input/60 hairline px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gold/40"
              />
            </div>
          ))}
        </div>

        <div>
          <label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Brand kleur
          </label>
          <input
            type="color"
            value={f.brand_color}
            onChange={(e) => setF({ ...f, brand_color: e.target.value })}
            className="mt-2 h-12 w-24 rounded-lg bg-input/60 hairline"
          />
        </div>
        <button
          disabled={busy}
          className="w-full rounded-lg bg-gradient-gold py-3 text-sm font-medium text-primary-foreground glow-gold"
        >
          {busy ? "Opslaan..." : "Klant aanmaken"}
        </button>
      </form>
    </div>
  );
}
