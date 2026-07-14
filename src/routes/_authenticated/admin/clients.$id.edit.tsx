import { createFileRoute, useNavigate, useParams, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Instagram,
  Music2,
  Linkedin,
  Youtube,
  Facebook,
  ArrowLeft,
  Trash2,
  Loader2,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/clients/$id/edit")({
  component: EditClient,
});

type Form = {
  name: string;
  industry: string;
  description: string;
  website: string;
  brand_color: string;
  instagram_url: string;
  tiktok_url: string;
  linkedin_url: string;
  youtube_url: string;
  facebook_url: string;
};

const empty: Form = {
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
};

function EditClient() {
  const { id } = useParams({ from: "/_authenticated/admin/clients/$id/edit" });
  const nav = useNavigate();
  const qc = useQueryClient();
  const [f, setF] = useState<Form>(empty);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const { data: client, isLoading } = useQuery({
    queryKey: ["client", id],
    queryFn: async () => (await supabase.from("clients").select("*").eq("id", id).single()).data,
  });

  useEffect(() => {
    if (!client) return;
    setF({
      name: client.name ?? "",
      industry: client.industry ?? "",
      description: client.description ?? "",
      website: client.website ?? "",
      brand_color: client.brand_color ?? "#D4B97A",
      instagram_url: client.instagram_url ?? "",
      tiktok_url: client.tiktok_url ?? "",
      linkedin_url: client.linkedin_url ?? "",
      youtube_url: client.youtube_url ?? "",
      facebook_url: client.facebook_url ?? "",
    });
  }, [client]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const payload: any = { ...f };
    Object.keys(payload).forEach((k) => {
      if (payload[k] === "") payload[k] = null;
    });
    payload.name = f.name;
    const { error } = await supabase.from("clients").update(payload).eq("id", id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Klant bijgewerkt");
    qc.invalidateQueries({ queryKey: ["client", id] });
    qc.invalidateQueries({ queryKey: ["recent-clients"] });
    nav({ to: "/admin/clients/$id", params: { id } });
  }

  async function remove() {
    if (
      !confirm(
        "Weet je zeker dat je deze klant wilt verwijderen? Dit kan niet ongedaan worden gemaakt.",
      )
    )
      return;
    setDeleting(true);
    const { error } = await supabase.from("clients").delete().eq("id", id);
    setDeleting(false);
    if (error) return toast.error(error.message);
    toast.success("Klant verwijderd");
    qc.invalidateQueries({ queryKey: ["recent-clients"] });
    nav({ to: "/admin/clients" });
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

  if (isLoading) return <Loader2 className="h-6 w-6 animate-spin text-gold" />;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link
        to="/admin/clients/$id"
        params={{ id }}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-gold"
      >
        <ArrowLeft className="h-4 w-4" /> Terug naar klant
      </Link>
      <div>
        <p className="text-xs uppercase tracking-[0.22em] text-gold/80">Bewerken</p>
        <h1 className="font-display text-3xl sm:text-4xl mt-2">{client?.name}</h1>
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

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            type="submit"
            disabled={busy}
            className="flex-1 rounded-lg bg-gradient-gold py-3 text-sm font-medium text-primary-foreground glow-gold"
          >
            {busy ? "Opslaan..." : "Wijzigingen opslaan"}
          </button>
          <button
            type="button"
            onClick={remove}
            disabled={deleting}
            className="inline-flex items-center justify-center gap-2 rounded-lg hairline border-destructive/40 px-4 py-3 text-sm text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-4 w-4" /> {deleting ? "Verwijderen..." : "Verwijderen"}
          </button>
        </div>
      </form>
    </div>
  );
}
