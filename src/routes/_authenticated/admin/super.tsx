import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { getStorageUsage } from "@/lib/storage.functions";
import {
  Shield,
  Users,
  Briefcase,
  CalendarClock,
  CheckCircle2,
  HardDrive,
  Plus,
  ArrowRight,
  Loader2,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export const Route = createFileRoute("/_authenticated/admin/super")({
  component: SuperAdminDashboard,
});

function formatBytes(bytes: number): string {
  if (!bytes) return "0 MB";
  const gb = bytes / 1024 / 1024 / 1024;
  if (gb >= 1) return `${gb.toLocaleString("nl-NL", { maximumFractionDigits: 2 })} GB`;
  const mb = bytes / 1024 / 1024;
  return `${mb.toLocaleString("nl-NL", { maximumFractionDigits: 1 })} MB`;
}

function SuperAdminDashboard() {
  const { isSuperAdmin, loading } = useAuth();
  const getUsage = useServerFn(getStorageUsage);

  const { data: clients } = useQuery({
    queryKey: ["super-clients"],
    enabled: isSuperAdmin,
    queryFn: async () =>
      (await supabase.from("clients").select("id, name, created_at, brand_color").order("name"))
        .data ?? [],
  });

  const { data: roleCounts } = useQuery({
    queryKey: ["super-role-counts"],
    enabled: isSuperAdmin,
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("role, user_id");
      const rows = data ?? [];
      const uniq = (r: string) => new Set(rows.filter((x) => x.role === r).map((x) => x.user_id));
      return {
        admins: uniq("admin").size,
        superAdmins: uniq("super_admin").size,
        clients: uniq("client").size,
      };
    },
  });

  const { data: postCounts } = useQuery({
    queryKey: ["super-post-counts"],
    enabled: isSuperAdmin,
    queryFn: async () => {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      const [scheduled, publishedMonth] = await Promise.all([
        supabase
          .from("scheduled_posts")
          .select("id", { count: "exact", head: true })
          .eq("status", "scheduled")
          .is("deleted_at", null)
          .gte("scheduled_at", new Date().toISOString()),
        supabase
          .from("scheduled_posts")
          .select("id", { count: "exact", head: true })
          .eq("status", "published")
          .gte("published_at", startOfMonth.toISOString()),
      ]);
      return { scheduled: scheduled.count ?? 0, publishedMonth: publishedMonth.count ?? 0 };
    },
  });

  const { data: usage } = useQuery({
    queryKey: ["super-storage-usage"],
    enabled: isSuperAdmin,
    queryFn: () => getUsage(),
    meta: { silent: true },
  });

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-gold" />
      </div>
    );
  }
  // Alleen super admins mogen hier komen; anderen terug naar het admin-dashboard.
  if (!isSuperAdmin) return <Navigate to="/admin/dashboard" replace />;

  return (
    <div className="space-y-8">
      <div className="aurora flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.22em] text-gold/80">
            <Shield className="h-3.5 w-3.5" /> Super admin
          </p>
          <h1 className="mt-2 font-display text-4xl sm:text-5xl">Bureau-overzicht</h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            De volledige stand van het bureau: alle klanten, het team, publicaties en opslag op één
            plek.
          </p>
        </div>
        <Link
          to="/admin/clients/new"
          className="inline-flex items-center gap-2 rounded-full bg-gradient-gold px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:brightness-105"
        >
          <Plus className="h-4 w-4" /> Nieuwe klant
        </Link>
      </div>

      {/* Stat-tegels */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile
          icon={Briefcase}
          value={clients?.length ?? "—"}
          label="Klanten"
          to="/admin/clients"
          tone="bg-gold/15 text-gold"
        />
        <StatTile
          icon={Users}
          value={roleCounts?.clients ?? "—"}
          label="Klant-accounts"
          to="/admin/users"
          tone="bg-sky-500/15 text-sky-500"
        />
        <StatTile
          icon={Shield}
          value={(roleCounts?.admins ?? 0) + (roleCounts?.superAdmins ?? 0) || "—"}
          label="Admins"
          to="/admin/users"
          tone="bg-emerald-500/15 text-emerald-500"
        />
        <StatTile
          icon={CalendarClock}
          value={postCounts?.scheduled ?? "—"}
          label="Gepland"
          to="/admin/planner"
          tone="bg-amber-500/15 text-amber-500"
        />
        <StatTile
          icon={CheckCircle2}
          value={postCounts?.publishedMonth ?? "—"}
          label="Gepubliceerd (maand)"
          to="/admin/reports"
          tone="bg-fuchsia-500/15 text-fuchsia-500"
        />
        <StatTile
          icon={HardDrive}
          value={usage ? formatBytes(usage.totalBytes) : "—"}
          label="Opslag"
          to="/admin/media"
          tone="bg-gold/15 text-gold"
        />
      </div>

      {/* Klanten + team */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-xl border border-gold/10 bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-xl">Klanten</h2>
            <Link
              to="/admin/clients"
              className="inline-flex items-center gap-1 text-xs text-gold hover:underline"
            >
              Alles beheren <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {clients && clients.length > 0 ? (
            <div className="space-y-1.5">
              {clients.map((c) => (
                <Link
                  key={c.id}
                  to="/admin/clients/$id"
                  params={{ id: c.id }}
                  className="flex items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 transition hover:border-gold/20 hover:bg-accent/30"
                >
                  <span
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-xs font-semibold text-white"
                    style={{ background: c.brand_color || "var(--gold)" }}
                  >
                    {c.name.slice(0, 2).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{c.name}</span>
                    <span className="block text-[11px] text-muted-foreground">
                      Sinds {new Date(c.created_at).toLocaleDateString("nl-NL")}
                    </span>
                  </span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground/40" />
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-gold/20 p-8 text-center">
              <p className="text-sm text-muted-foreground">Nog geen klanten.</p>
              <Link
                to="/admin/clients/new"
                className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-gold/30 px-4 py-1.5 text-xs text-gold hover:bg-gold/5"
              >
                <Plus className="h-3.5 w-3.5" /> Eerste klant aanmaken
              </Link>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-gold/10 bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-xl">Team</h2>
            <Link
              to="/admin/users"
              className="inline-flex items-center gap-1 text-xs text-gold hover:underline"
            >
              Beheren <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <ul className="space-y-2 text-sm">
            <TeamRow label="Super admins" value={roleCounts?.superAdmins} tone="text-gold" />
            <TeamRow label="Admins" value={roleCounts?.admins} tone="text-emerald-500" />
            <TeamRow label="Klant-accounts" value={roleCounts?.clients} tone="text-sky-500" />
          </ul>
          <Link
            to="/admin/users"
            className="mt-4 flex items-center justify-center gap-1.5 rounded-lg border border-gold/20 py-2 text-xs text-gold transition hover:bg-gold/5"
          >
            <Plus className="h-3.5 w-3.5" /> Account toevoegen
          </Link>
        </div>
      </div>
    </div>
  );
}

function StatTile({
  icon: Icon,
  value,
  label,
  to,
  tone,
}: {
  icon: LucideIcon;
  value: ReactNode;
  label: string;
  to: string;
  tone: string;
}) {
  return (
    <Link to={to} className="card-lift group rounded-xl border border-gold/10 bg-card p-4">
      <span className={cn("grid h-9 w-9 place-items-center rounded-lg", tone)}>
        <Icon className="h-5 w-5" />
      </span>
      <div className="mt-3 font-display text-2xl leading-none tabular-nums">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{label}</div>
    </Link>
  );
}

function TeamRow({ label, value, tone }: { label: string; value?: number; tone: string }) {
  return (
    <li className="flex items-center justify-between rounded-lg bg-background/50 px-3 py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("font-display text-lg tabular-nums", tone)}>{value ?? "—"}</span>
    </li>
  );
}
