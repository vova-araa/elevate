import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { inviteUser, setUserRole, setClientMembership, deleteUser } from "@/lib/admin.functions";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/admin/users")({
  component: UsersAdmin,
});

type Profile = Tables<"profiles">;
type AppUser = Profile & { roles: string[]; clientIds: string[] };
type ClientOption = Pick<Tables<"clients">, "id" | "name">;

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function UsersAdmin() {
  const qc = useQueryClient();
  const invite = useServerFn(inviteUser);
  const toggleRole = useServerFn(setUserRole);
  const toggleMember = useServerFn(setClientMembership);
  const removeUser = useServerFn(deleteUser);

  const { data: users } = useQuery<AppUser[]>({
    queryKey: ["all-users"],
    queryFn: async () => {
      const [{ data: profiles }, { data: roles }, { data: members }] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("user_roles").select("*"),
        supabase.from("client_members").select("*"),
      ]);
      return (profiles ?? []).map((p) => ({
        ...p,
        roles: (roles ?? []).filter((r) => r.user_id === p.id).map((r) => r.role),
        clientIds: (members ?? []).filter((m) => m.user_id === p.id).map((m) => m.client_id),
      }));
    },
  });
  const { data: clients } = useQuery<ClientOption[]>({
    queryKey: ["clients-list"],
    queryFn: async () =>
      (await supabase.from("clients").select("id,name").order("name")).data ?? [],
  });

  const [f, setF] = useState({ email: "", fullName: "", clientId: "", makeAdmin: false });
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (
      f.makeAdmin &&
      !confirm(
        `Weet je zeker dat je ${f.email || "deze gebruiker"} als admin wil aanmaken? Admins hebben volledige toegang tot alle klanten en instellingen.`,
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      const res = await invite({
        data: {
          email: f.email,
          fullName: f.fullName,
          clientId: f.clientId || undefined,
          makeAdmin: f.makeAdmin,
        },
      });
      if (res.tempPassword) {
        toast.success(`Account aangemaakt. Tijdelijk wachtwoord: ${res.tempPassword}`, {
          duration: 20000,
        });
      } else {
        toast.success("Uitnodiging verzonden");
      }
      setF({ email: "", fullName: "", clientId: "", makeAdmin: false });
      qc.invalidateQueries({ queryKey: ["all-users"] });
    } catch (e) {
      toast.error(errorMessage(e));
    }
    setBusy(false);
  }

  async function handleRole(userId: string, role: "admin" | "client", enabled: boolean) {
    if (
      role === "admin" &&
      enabled &&
      !confirm(
        "Weet je zeker dat je deze gebruiker tot admin wil promoten? Admins hebben volledige toegang tot alle klanten en instellingen.",
      )
    ) {
      return;
    }
    try {
      await toggleRole({ data: { userId, role, enabled } });
      qc.invalidateQueries({ queryKey: ["all-users"] });
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  async function handleMembership(userId: string, clientId: string, link: boolean) {
    if (!clientId) return;
    try {
      await toggleMember({ data: { userId, clientId, link } });
      qc.invalidateQueries({ queryKey: ["all-users"] });
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  async function handleDelete(userId: string, label: string) {
    if (!confirm(`Verwijder ${label}? Dit kan niet ongedaan worden gemaakt.`)) return;
    try {
      await removeUser({ data: { userId } });
      toast.success("Gebruiker verwijderd");
      qc.invalidateQueries({ queryKey: ["all-users"] });
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  const filtered = (users ?? []).filter((u) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      (u.email || "").toLowerCase().includes(q) || (u.full_name || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs uppercase tracking-[0.22em] text-gold/80">Beheer</p>
        <h1 className="font-display text-5xl mt-2">Gebruikers</h1>
      </div>

      <form onSubmit={send} className="glass-strong rounded-2xl p-6 grid gap-3 md:grid-cols-2">
        <input
          required
          type="email"
          placeholder="E-mailadres"
          value={f.email}
          onChange={(e) => setF({ ...f, email: e.target.value })}
          className="rounded-lg bg-input/60 hairline px-4 py-3 text-sm"
        />
        <input
          required
          placeholder="Volledige naam"
          value={f.fullName}
          onChange={(e) => setF({ ...f, fullName: e.target.value })}
          className="rounded-lg bg-input/60 hairline px-4 py-3 text-sm"
        />
        <select
          value={f.clientId}
          onChange={(e) => setF({ ...f, clientId: e.target.value })}
          className="rounded-lg bg-input/60 hairline px-4 py-3 text-sm"
        >
          <option value="">Geen klant koppelen</option>
          {clients?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={f.makeAdmin}
            onChange={(e) => setF({ ...f, makeAdmin: e.target.checked })}
          />
          Maak admin
        </label>
        <button
          disabled={busy}
          className="md:col-span-2 rounded-lg bg-gradient-gold py-3 text-sm font-medium text-primary-foreground"
        >
          {busy ? "Versturen..." : "Account aanmaken & uitnodigen"}
        </button>
      </form>

      <input
        placeholder="Zoek op naam of e-mail..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full rounded-lg bg-input/60 hairline px-4 py-3 text-sm"
      />

      <div className="space-y-3">
        {filtered.map((u) => {
          const isAdmin = u.roles?.includes("admin");
          const isClient = u.roles?.includes("client");
          return (
            <div key={u.id} className="glass rounded-xl p-5 space-y-4">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className="text-sm font-medium">{u.full_name || u.email}</div>
                  <div className="text-xs text-muted-foreground">{u.email}</div>
                </div>
                <div className="flex gap-1 flex-wrap">
                  {u.roles?.map((r: string) => (
                    <span
                      key={r}
                      className="text-[10px] rounded-full px-2 py-0.5 bg-gold/15 text-gold uppercase tracking-wider"
                    >
                      {r}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap gap-2 text-xs">
                <button
                  onClick={() => handleRole(u.id, "admin", !isAdmin)}
                  className={`rounded-full px-3 py-1.5 hairline transition ${isAdmin ? "bg-gold/20 text-gold" : "bg-input/40 text-muted-foreground hover:text-foreground"}`}
                >
                  {isAdmin ? "Admin intrekken" : "Promoot tot admin"}
                </button>
                <button
                  onClick={() => handleRole(u.id, "client", !isClient)}
                  className={`rounded-full px-3 py-1.5 hairline transition ${isClient ? "bg-gold/20 text-gold" : "bg-input/40 text-muted-foreground hover:text-foreground"}`}
                >
                  {isClient ? "Client-rol intrekken" : "Geef client-rol"}
                </button>
                <button
                  onClick={() => handleDelete(u.id, u.email || u.full_name || u.id)}
                  className="rounded-full px-3 py-1.5 hairline bg-destructive/15 text-destructive hover:bg-destructive/25 ml-auto"
                >
                  Verwijder
                </button>
              </div>

              <div className="space-y-2">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Gekoppelde klanten
                </div>
                <div className="flex flex-wrap gap-2">
                  {(clients ?? []).map((c) => {
                    const linked = u.clientIds?.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        onClick={() => handleMembership(u.id, c.id, !linked)}
                        className={`text-xs rounded-full px-3 py-1 hairline transition ${linked ? "bg-gold/20 text-gold" : "bg-input/30 text-muted-foreground hover:text-foreground"}`}
                      >
                        {linked ? "✓ " : ""}
                        {c.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-sm text-muted-foreground text-center py-8">
            Geen gebruikers gevonden.
          </div>
        )}
      </div>
    </div>
  );
}
