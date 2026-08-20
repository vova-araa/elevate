import { createFileRoute } from "@tanstack/react-router";
import { confirmDialog } from "@/components/ui/confirm";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  inviteUser,
  setUserRole,
  setClientMembership,
  deleteUser,
  createTestAccount,
  createDemoClientAccount,
} from "@/lib/admin.functions";
import { invalidateClientLists } from "@/lib/client-cache";
import { toast } from "sonner";
import { copyToClipboard } from "@/lib/clipboard";
import { Check, Copy, FlaskConical, Rocket, Shield } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
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
  const { isSuperAdmin } = useAuth();
  const invite = useServerFn(inviteUser);
  const toggleRole = useServerFn(setUserRole);
  const toggleMember = useServerFn(setClientMembership);
  const removeUser = useServerFn(deleteUser);
  const makeTest = useServerFn(createTestAccount);
  const makeDemoClient = useServerFn(createDemoClientAccount);

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

  // Test-account zonder e-mailadres: rol + gegenereerde inloggegevens.
  const [testRole, setTestRole] = useState<"editor" | "viewer" | "client" | "admin">("editor");
  const [testBusy, setTestBusy] = useState(false);
  const [testCreds, setTestCreds] = useState<{ email: string; password: string } | null>(null);

  async function createTest() {
    setTestBusy(true);
    try {
      const res = await makeTest({ data: { role: testRole } });
      setTestCreds({ email: res.email, password: res.password });
      toast.success(`Test-account (${res.role}) aangemaakt`);
      qc.invalidateQueries({ queryKey: ["all-users"] });
    } catch (e) {
      toast.error(errorMessage(e));
    }
    setTestBusy(false);
  }

  // Demo-klant + login in één klik (voor Meta/TikTok review of een tester-klant).
  const [demoName, setDemoName] = useState("");
  const [demoBusy, setDemoBusy] = useState(false);
  const [demoCreds, setDemoCreds] = useState<{
    email: string;
    password: string;
    clientName: string;
  } | null>(null);

  async function createDemo() {
    setDemoBusy(true);
    try {
      const res = await makeDemoClient({ data: { name: demoName.trim() || undefined } });
      setDemoCreds({ email: res.email, password: res.password, clientName: res.clientName });
      toast.success(`Demo-klant "${res.clientName}" + login aangemaakt`);
      qc.invalidateQueries({ queryKey: ["all-users"] });
      invalidateClientLists(qc);
    } catch (e) {
      toast.error(errorMessage(e));
    }
    setDemoBusy(false);
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (
      f.makeAdmin &&
      !(await confirmDialog(
        `Weet je zeker dat je ${f.email || "deze gebruiker"} als admin wil aanmaken? Admins hebben volledige toegang tot alle klanten en instellingen.`,
      ))
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

  async function handleRole(
    userId: string,
    role: "admin" | "client" | "super_admin",
    enabled: boolean,
  ) {
    if (
      role === "admin" &&
      enabled &&
      !(await confirmDialog(
        "Weet je zeker dat je deze gebruiker tot admin wil promoten? Admins hebben volledige toegang tot alle klanten en instellingen.",
      ))
    ) {
      return;
    }
    if (
      role === "super_admin" &&
      enabled &&
      !(await confirmDialog({
        title: "Super admin toekennen?",
        description:
          "Een super admin heeft alle admin-rechten plus het bureau-overzicht en mag zelf super admins aanwijzen. Geef dit alleen aan mensen die je volledig vertrouwt.",
        confirmLabel: "Super admin maken",
        destructive: true,
      }))
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
    if (!(await confirmDialog(`Verwijder ${label}? Dit kan niet ongedaan worden gemaakt.`))) return;
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

      {/* Snel test-account zonder e-mailadres */}
      <div className="rounded-2xl border border-gold/10 bg-card p-6">
        <div className="flex items-center gap-2">
          <FlaskConical className="h-4 w-4 text-gold" />
          <h2 className="font-display text-lg">Test-account (zonder e-mailadres)</h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Maakt direct een testaccount aan met gegenereerde inloggegevens — handig om bijvoorbeeld
          de editor-rol te proberen. Je hoeft geen e-mailadres in te voeren.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <select
            value={testRole}
            onChange={(e) =>
              setTestRole(e.target.value as "editor" | "viewer" | "client" | "admin")
            }
            className="rounded-lg bg-input/60 hairline px-4 py-2.5 text-sm"
            aria-label="Rol voor test-account"
          >
            <option value="editor">Editor</option>
            <option value="viewer">Viewer</option>
            <option value="client">Klant</option>
            <option value="admin">Admin</option>
          </select>
          <button
            onClick={createTest}
            disabled={testBusy}
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-gold px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:brightness-105 disabled:opacity-60"
          >
            <FlaskConical className="h-4 w-4" />
            {testBusy ? "Aanmaken…" : "Test-account aanmaken"}
          </button>
        </div>

        {testCreds && (
          <div className="mt-4 rounded-xl border border-gold/20 bg-gold/5 p-4">
            <div className="text-xs uppercase tracking-[0.18em] text-gold/80">Inloggegevens</div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Bewaar deze nu — het wachtwoord is hierna niet meer op te vragen.
            </p>
            <div className="mt-3 space-y-2">
              {(
                [
                  ["E-mail", testCreds.email],
                  ["Wachtwoord", testCreds.password],
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
                    onClick={() => void copyToClipboard(value, `${label} gekopieerd`)}
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

      {/* Demo-klant + login in één klik (voor Meta/TikTok review of tester-klant) */}
      <div className="rounded-2xl border border-gold/10 bg-card p-6">
        <div className="flex items-center gap-2">
          <Rocket className="h-4 w-4 text-gold" />
          <h2 className="font-display text-lg">Demo-klant + login (voor App Review / tester)</h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Maakt in één klik een volledige klant én een klant-login aan, gekoppeld en wel. Geef de
          inloggegevens aan de Meta/TikTok-reviewer of aan een tester-klant: ze loggen in en kunnen
          direct naar <b>Kanalen</b> om te koppelen.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <input
            value={demoName}
            onChange={(e) => setDemoName(e.target.value)}
            placeholder="Naam van de demo-klant (optioneel)"
            className="min-w-[220px] flex-1 rounded-lg bg-input/60 hairline px-4 py-2.5 text-sm"
          />
          <button
            onClick={createDemo}
            disabled={demoBusy}
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-gold px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:brightness-105 disabled:opacity-60"
          >
            <Rocket className="h-4 w-4" />
            {demoBusy ? "Aanmaken…" : "Demo-klant aanmaken"}
          </button>
        </div>

        {demoCreds && (
          <div className="mt-4 rounded-xl border border-gold/20 bg-gold/5 p-4">
            <div className="text-xs uppercase tracking-[0.18em] text-gold/80">
              Klant “{demoCreds.clientName}” — inloggegevens
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Bewaar deze nu — het wachtwoord is hierna niet meer op te vragen.
            </p>
            <div className="mt-3 space-y-2">
              {(
                [
                  ["E-mail", demoCreds.email],
                  ["Wachtwoord", demoCreds.password],
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
                    onClick={() => void copyToClipboard(value, `${label} gekopieerd`)}
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
          const isSuper = u.roles?.includes("super_admin");
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
                {/* Alleen super admins kunnen de super-admin-rol uitdelen. */}
                {isSuperAdmin && (
                  <button
                    onClick={() => handleRole(u.id, "super_admin", !isSuper)}
                    className={`rounded-full px-3 py-1.5 hairline transition inline-flex items-center gap-1.5 ${isSuper ? "bg-gold/20 text-gold" : "bg-input/40 text-muted-foreground hover:text-foreground"}`}
                  >
                    <Shield className="h-3.5 w-3.5" />
                    {isSuper ? "Super admin intrekken" : "Maak super admin"}
                  </button>
                )}
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
                        className={`text-xs rounded-full px-3 py-1 hairline transition inline-flex items-center gap-1 ${linked ? "bg-gold/20 text-gold" : "bg-input/30 text-muted-foreground hover:text-foreground"}`}
                      >
                        {linked && <Check className="h-3 w-3" />}
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
