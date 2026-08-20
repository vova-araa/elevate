import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { inviteUser, setClientMembership } from "@/lib/admin.functions";
import { toast } from "sonner";
import { copyToClipboard } from "@/lib/clipboard";
import { Copy, KeyRound, Mail, UserPlus, Users, X } from "lucide-react";

/**
 * Toegang per klant, op de plek waar je toch al bent: het klantdossier.
 *
 * Voorheen moest je voor "geef deze klant een login" naar de aparte
 * Gebruikers-pagina, daar de juiste persoon zoeken en de klant aanvinken.
 * Hier staat het bij de klant zelf: wie kan er in dit portaal, nodig direct
 * iemand uit (klant is voorgeselecteerd), of koppel een bestaand account.
 */

interface Props {
  clientId: string;
  clientName: string;
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export function ClientAccessPanel({ clientId, clientName }: Props) {
  const qc = useQueryClient();
  const invite = useServerFn(inviteUser);
  const toggleMember = useServerFn(setClientMembership);

  const { data, error, refetch } = useQuery({
    queryKey: ["client-access", clientId],
    queryFn: async () => {
      const [{ data: members }, { data: profiles }] = await Promise.all([
        supabase.from("client_members").select("user_id").eq("client_id", clientId),
        supabase.from("profiles").select("id, full_name, email").order("full_name"),
      ]);
      const memberIds = new Set((members ?? []).map((m) => m.user_id));
      const all = profiles ?? [];
      return {
        linked: all.filter((p) => memberIds.has(p.id)),
        available: all.filter((p) => !memberIds.has(p.id)),
      };
    },
  });

  const [f, setF] = useState({ email: "", fullName: "" });
  const [busy, setBusy] = useState(false);
  const [creds, setCreds] = useState<{ email: string; password: string } | null>(null);
  const [linkId, setLinkId] = useState("");

  async function sendInvite(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await invite({
        data: { email: f.email, fullName: f.fullName, clientId },
      });
      if (res.tempPassword) {
        setCreds({ email: f.email, password: res.tempPassword });
        toast.success("Login aangemaakt — geef de inloggegevens door");
      } else {
        setCreds(null);
        toast.success(`Uitnodiging gemaild naar ${f.email}`);
      }
      setF({ email: "", fullName: "" });
      refetch();
      qc.invalidateQueries({ queryKey: ["all-users"] });
    } catch (err) {
      toast.error(errorMessage(err));
    }
    setBusy(false);
  }

  async function setLink(userId: string, link: boolean) {
    try {
      await toggleMember({ data: { userId, clientId, link } });
      toast.success(link ? "Account gekoppeld" : "Toegang ingetrokken");
      setLinkId("");
      refetch();
      qc.invalidateQueries({ queryKey: ["all-users"] });
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Wie kan er nu in */}
      <div className="glass rounded-2xl p-6">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-gold" />
          <h3 className="font-display text-2xl">Wie heeft toegang</h3>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Deze accounts kunnen inloggen op het klantportaal van {clientName}.
        </p>
        {error && (
          <p className="mt-4 text-sm text-destructive">
            Kon de lijst niet laden — probeer opnieuw.
          </p>
        )}
        <div className="mt-4 space-y-2">
          {(data?.linked ?? []).map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-gold/10 bg-background/50 px-3 py-2.5"
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{p.full_name || p.email}</div>
                <div className="truncate text-xs text-muted-foreground">{p.email}</div>
              </div>
              <button
                onClick={() => setLink(p.id, false)}
                className="shrink-0 rounded-full border border-destructive/25 p-1.5 text-destructive transition hover:bg-destructive/10"
                title="Toegang intrekken"
                aria-label={`Toegang van ${p.email} intrekken`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          {data && data.linked.length === 0 && (
            <p className="rounded-xl border border-dashed border-gold/20 px-3 py-4 text-center text-sm text-muted-foreground">
              Nog niemand — nodig hiernaast de klant uit.
            </p>
          )}
        </div>

        {/* Bestaand account koppelen */}
        {data && data.available.length > 0 && (
          <div className="mt-4 flex items-center gap-2">
            <select
              value={linkId}
              onChange={(e) => setLinkId(e.target.value)}
              className="min-w-0 flex-1 rounded-lg bg-input/60 hairline px-3 py-2 text-sm"
              aria-label="Bestaand account koppelen"
            >
              <option value="">Bestaand account koppelen…</option>
              {data.available.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name || p.email} {p.email ? `— ${p.email}` : ""}
                </option>
              ))}
            </select>
            <button
              onClick={() => linkId && setLink(linkId, true)}
              disabled={!linkId}
              className="shrink-0 rounded-lg border border-gold/25 px-3 py-2 text-sm text-gold transition hover:bg-gold/10 disabled:opacity-50"
            >
              Koppel
            </button>
          </div>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          Rollen en alle accounts beheer je op{" "}
          <Link to="/admin/users" className="text-gold underline-offset-2 hover:underline">
            Gebruikers
          </Link>
          .
        </p>
      </div>

      {/* Nieuwe login uitnodigen */}
      <div className="glass rounded-2xl p-6">
        <div className="flex items-center gap-2">
          <UserPlus className="h-4 w-4 text-gold" />
          <h3 className="font-display text-2xl">Login uitnodigen</h3>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Maakt een account aan dat direct aan {clientName} hangt. De klant krijgt een e-mail, of je
          krijgt hier een tijdelijk wachtwoord om door te geven.
        </p>
        <form onSubmit={sendInvite} className="mt-4 space-y-3">
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              required
              type="email"
              placeholder="E-mailadres van de klant"
              value={f.email}
              onChange={(e) => setF({ ...f, email: e.target.value })}
              className="w-full rounded-lg bg-input/60 hairline py-2.5 pl-9 pr-3 text-sm"
            />
          </div>
          <input
            required
            placeholder="Volledige naam"
            value={f.fullName}
            onChange={(e) => setF({ ...f, fullName: e.target.value })}
            className="w-full rounded-lg bg-input/60 hairline px-3 py-2.5 text-sm"
          />
          <button
            disabled={busy}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-gold py-2.5 text-sm font-medium text-primary-foreground transition hover:brightness-105 disabled:opacity-60"
          >
            <UserPlus className="h-4 w-4" />
            {busy ? "Versturen…" : "Uitnodigen & koppelen"}
          </button>
        </form>

        {creds && (
          <div className="mt-4 rounded-xl border border-gold/20 bg-gold/5 p-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-gold/80">
              <KeyRound className="h-3.5 w-3.5" /> Inloggegevens
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Bewaar deze nu — het wachtwoord is hierna niet meer op te vragen.
            </p>
            <div className="mt-3 space-y-2">
              {(
                [
                  ["E-mail", creds.email],
                  ["Wachtwoord", creds.password],
                ] as const
              ).map(([label, value]) => (
                <div
                  key={label}
                  className="flex items-center justify-between gap-3 rounded-lg bg-background/60 px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {label}
                    </div>
                    <div className="truncate font-mono text-sm">{value}</div>
                  </div>
                  <button
                    onClick={() => {
                      void copyToClipboard(value, `${label} gekopieerd`);
                      toast.success(`${label} gekopieerd`);
                    }}
                    className="shrink-0 rounded-md border border-gold/20 p-1.5 text-gold hover:bg-gold/10"
                    aria-label={`${label} kopiëren`}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
