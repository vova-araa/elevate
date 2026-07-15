// Team & rollen: editor/viewer zijn hier (nog) rol- en toewijzingsconcepten + audittrail.
// Het afdwingen van hun rechten in RLS-policies en de admin/client-gate is een bewuste
// vervolgstap — deze ronde raken we bestaande RLS en de admin/client-gate niet aan.
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { formatDistanceToNow } from "date-fns";
import { nl } from "date-fns/locale";
import { toast } from "sonner";
import { Users, Building2, History } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  listTeam,
  setUserRole,
  assignClient,
  unassignClient,
  listActivity,
} from "@/lib/team.functions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/admin/team")({
  component: TeamAdmin,
});

type AppRole = "admin" | "editor" | "viewer" | "client";
const ROLES: AppRole[] = ["admin", "editor", "viewer", "client"];
const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Admin",
  editor: "Editor",
  viewer: "Viewer",
  client: "Klant",
};

type TeamMember = Tables<"profiles"> & { roles: string[]; clientCount: number };
type ClientOption = Pick<Tables<"clients">, "id" | "name">;
type ClientAssignment = Tables<"client_assignments">;
type ActivityEntry = Tables<"activity_log"> & {
  actor: Pick<Tables<"profiles">, "id" | "full_name" | "email"> | null;
};

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function memberLabel(m: Pick<Tables<"profiles">, "full_name" | "email">) {
  return m.full_name || m.email || "Onbekend";
}

function TeamAdmin() {
  const qc = useQueryClient();
  const fetchTeam = useServerFn(listTeam);
  const changeRole = useServerFn(setUserRole);
  const doAssign = useServerFn(assignClient);
  const doUnassign = useServerFn(unassignClient);
  const fetchActivity = useServerFn(listActivity);

  const { data: members, isLoading: membersLoading } = useQuery<TeamMember[]>({
    queryKey: ["team-members"],
    queryFn: async () => (await fetchTeam()) as TeamMember[],
  });

  const { data: clients } = useQuery<ClientOption[]>({
    queryKey: ["team-clients"],
    queryFn: async () =>
      (await supabase.from("clients").select("id,name").order("name")).data ?? [],
  });

  const { data: assignments, isLoading: assignmentsLoading } = useQuery<ClientAssignment[]>({
    queryKey: ["team-assignments"],
    queryFn: async () => (await supabase.from("client_assignments").select("*")).data ?? [],
  });

  const { data: activity, isLoading: activityLoading } = useQuery<ActivityEntry[]>({
    queryKey: ["team-activity"],
    queryFn: async () => (await fetchActivity({ data: { limit: 50 } })) as ActivityEntry[],
  });

  const [selectedMemberId, setSelectedMemberId] = useState<string>("");
  const [note, setNote] = useState("");

  const selectedMember = useMemo(
    () => (members ?? []).find((m) => m.id === selectedMemberId) ?? null,
    [members, selectedMemberId],
  );
  const selectedAssignments = useMemo(
    () => (assignments ?? []).filter((a) => a.user_id === selectedMemberId),
    [assignments, selectedMemberId],
  );

  async function handleRoleChange(userId: string, label: string, role: AppRole) {
    if (
      role === "admin" &&
      !confirm(
        `Weet je zeker dat je ${label} als admin wil instellen? Admins hebben volledige toegang tot alle klanten en instellingen.`,
      )
    ) {
      return;
    }
    try {
      await changeRole({ data: { userId, role } });
      toast.success("Rol bijgewerkt");
      qc.invalidateQueries({ queryKey: ["team-members"] });
      qc.invalidateQueries({ queryKey: ["team-activity"] });
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  async function handleAssign(clientId: string) {
    if (!selectedMemberId) return;
    try {
      await doAssign({ data: { userId: selectedMemberId, clientId, note: note || undefined } });
      toast.success("Klant toegewezen");
      setNote("");
      qc.invalidateQueries({ queryKey: ["team-assignments"] });
      qc.invalidateQueries({ queryKey: ["team-members"] });
      qc.invalidateQueries({ queryKey: ["team-activity"] });
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  async function handleUnassign(clientId: string) {
    if (!selectedMemberId) return;
    try {
      await doUnassign({ data: { userId: selectedMemberId, clientId } });
      toast.success("Toewijzing verwijderd");
      qc.invalidateQueries({ queryKey: ["team-assignments"] });
      qc.invalidateQueries({ queryKey: ["team-members"] });
      qc.invalidateQueries({ queryKey: ["team-activity"] });
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs uppercase tracking-[0.22em] text-gold/80">Beheer</p>
        <h1 className="font-display text-5xl mt-2">Team & rollen</h1>
      </div>

      <Tabs defaultValue="leden">
        <TabsList className="h-auto flex-wrap justify-start">
          <TabsTrigger value="leden" className="gap-1.5">
            <Users className="h-3.5 w-3.5" />
            Teamleden
          </TabsTrigger>
          <TabsTrigger value="toewijzing" className="gap-1.5">
            <Building2 className="h-3.5 w-3.5" />
            Klant-toewijzing
          </TabsTrigger>
          <TabsTrigger value="activiteit" className="gap-1.5">
            <History className="h-3.5 w-3.5" />
            Activiteit
          </TabsTrigger>
        </TabsList>

        <TabsContent value="leden" className="mt-4 space-y-3">
          {membersLoading && (
            <div className="space-y-3">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          )}
          {!membersLoading && (members ?? []).length === 0 && (
            <div className="text-sm text-muted-foreground text-center py-8">
              Geen teamleden gevonden.
            </div>
          )}
          {(members ?? []).map((m) => (
            <div key={m.id} className="glass rounded-xl p-5 space-y-3">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className="text-sm font-medium">{memberLabel(m)}</div>
                  <div className="text-xs text-muted-foreground">{m.email}</div>
                </div>
                <div className="flex gap-1 flex-wrap items-center">
                  {m.roles.length === 0 && (
                    <span className="text-[10px] rounded-full px-2 py-0.5 bg-input/40 text-muted-foreground uppercase tracking-wider">
                      Geen rol
                    </span>
                  )}
                  {m.roles.map((r) => (
                    <span
                      key={r}
                      className="text-[10px] rounded-full px-2 py-0.5 bg-gold/15 text-gold uppercase tracking-wider"
                    >
                      {ROLE_LABELS[r as AppRole] ?? r}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Rol wijzigen
                </span>
                <Select
                  value=""
                  onValueChange={(v) => handleRoleChange(m.id, memberLabel(m), v as AppRole)}
                >
                  <SelectTrigger className="w-44">
                    <SelectValue placeholder="Kies een rol..." />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {ROLE_LABELS[r]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-xs text-muted-foreground">
                  {m.clientCount} klant{m.clientCount === 1 ? "" : "en"} toegewezen
                </span>
              </div>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="toewijzing" className="mt-4 space-y-4">
          <div className="glass-strong rounded-2xl p-6 space-y-4">
            <div className="space-y-2">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Teamlid
              </span>
              <Select value={selectedMemberId} onValueChange={setSelectedMemberId}>
                <SelectTrigger>
                  <SelectValue placeholder="Kies een teamlid..." />
                </SelectTrigger>
                <SelectContent>
                  {(members ?? []).map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {memberLabel(m)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedMember && (
              <>
                <input
                  placeholder="Notitie bij toewijzing (optioneel)"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full rounded-lg bg-input/60 hairline px-4 py-3 text-sm"
                />
                <div className="space-y-2">
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    Klanten voor {memberLabel(selectedMember)}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(clients ?? []).map((c) => {
                      const linked = selectedAssignments.some((a) => a.client_id === c.id);
                      return (
                        <button
                          key={c.id}
                          onClick={() => (linked ? handleUnassign(c.id) : handleAssign(c.id))}
                          className={`text-xs rounded-full px-3 py-1 hairline transition ${linked ? "bg-gold/20 text-gold" : "bg-input/30 text-muted-foreground hover:text-foreground"}`}
                        >
                          {linked ? "✓ " : ""}
                          {c.name}
                        </button>
                      );
                    })}
                  </div>
                  {assignmentsLoading && <Skeleton className="h-6 w-32" />}
                </div>
              </>
            )}
            {!selectedMember && (
              <p className="text-sm text-muted-foreground">
                Kies een teamlid om klanten toe te wijzen of te verwijderen.
              </p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="activiteit" className="mt-4 space-y-2">
          {activityLoading && (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          )}
          {!activityLoading && (activity ?? []).length === 0 && (
            <div className="text-sm text-muted-foreground text-center py-8">
              Nog geen activiteit geregistreerd.
            </div>
          )}
          {(activity ?? []).map((entry) => (
            <div
              key={entry.id}
              className="glass rounded-xl px-4 py-3 flex items-center justify-between gap-4 flex-wrap"
            >
              <div className="text-sm">
                <span className="font-medium">
                  {entry.actor ? memberLabel(entry.actor) : "Systeem"}
                </span>{" "}
                <span className="text-muted-foreground">
                  — {entry.action}
                  {entry.entity_type ? ` (${entry.entity_type})` : ""}
                </span>
              </div>
              <span className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true, locale: nl })}
              </span>
            </div>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
