import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  ChevronLeft, ChevronRight, Image as ImageIcon, Video, FileText, File, Sparkles,
  Clock, CheckCircle2, ShieldCheck, AlertTriangle, Plus, X, Trash2, Briefcase,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/client/calendar")({ component: ClientCalendar });

type Status = "pending" | "delivered" | "approved";
type Deliv = "image" | "video" | "copy" | "document" | "other";

const DELIV_META: Record<Deliv, { label: string; Icon: any; tint: string }> = {
  image:    { label: "Afbeelding", Icon: ImageIcon, tint: "text-sky-300 bg-sky-500/10 border-sky-400/30" },
  video:    { label: "Video",      Icon: Video,     tint: "text-fuchsia-300 bg-fuchsia-500/10 border-fuchsia-400/30" },
  copy:     { label: "Tekst",      Icon: FileText,  tint: "text-amber-300 bg-amber-500/10 border-amber-400/30" },
  document: { label: "Document",   Icon: File,      tint: "text-emerald-300 bg-emerald-500/10 border-emerald-400/30" },
  other:    { label: "Overig",     Icon: Sparkles,  tint: "text-gold bg-gold/10 border-gold/30" },
};

const STATUS_META: Record<Status, { label: string; Icon: any; cls: string; dot: string }> = {
  pending:   { label: "Open",        Icon: Clock,        cls: "text-amber-300 bg-amber-500/10 border-amber-400/30",      dot: "bg-amber-400" },
  delivered: { label: "Aangeleverd", Icon: CheckCircle2, cls: "text-sky-300 bg-sky-500/10 border-sky-400/30",            dot: "bg-sky-400" },
  approved:  { label: "Goedgekeurd", Icon: ShieldCheck,  cls: "text-emerald-300 bg-emerald-500/10 border-emerald-400/30", dot: "bg-emerald-400" },
};

const toKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

function ClientCalendar() {
  const qc = useQueryClient();
  const { role } = useAuth();
  const isAdmin = role === "admin";
  const [month, setMonth] = useState(() => { const n = new Date(); n.setDate(1); return n; });
  const [selected, setSelected] = useState<Date>(new Date());
  const [statusFilter, setStatusFilter] = useState<"all" | Status>("all");

  const [adding, setAdding] = useState(false);

  const { data } = useQuery({
    queryKey: ["client-cal"],
    queryFn: async () => (await supabase.from("calendar_items").select("*, clients(id,name,brand_color)").order("date")).data ?? [],
  });

  const { data: clients } = useQuery({
    queryKey: ["calendar-clients"],
    enabled: isAdmin,
    queryFn: async () => (await supabase.from("clients").select("id,name,brand_color").order("name")).data ?? [],
  });

  const start = new Date(month.getFullYear(), month.getMonth(), 1);
  const end = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  const offset = (start.getDay() + 6) % 7;
  const days: Date[] = [];
  for (let i = 0; i < offset; i++) days.push(new Date(start.getFullYear(), start.getMonth(), -offset + i + 1));
  for (let d = 1; d <= end.getDate(); d++) days.push(new Date(start.getFullYear(), start.getMonth(), d));
  while (days.length % 7 !== 0) days.push(new Date(end.getFullYear(), end.getMonth(), end.getDate() + (days.length % 7)));

  const items = useMemo(() => (data ?? []).filter((x: any) => statusFilter === "all" || x.status === statusFilter), [data, statusFilter]);

  const byDay = useMemo(() => {
    const m: Record<string, any[]> = {};
    items.forEach((x: any) => { (m[x.date] ||= []).push(x); });
    return m;
  }, [items]);

  const today = new Date();
  const selectedKey = toKey(selected);
  const selectedItems = byDay[selectedKey] || [];

  const monthTotals = useMemo(() => {
    let pending = 0, delivered = 0, approved = 0, overdue = 0;
    (data ?? []).forEach((x: any) => {
      const d = new Date(x.date);
      if (d.getMonth() !== month.getMonth() || d.getFullYear() !== month.getFullYear()) return;
      if (x.status === "pending") pending++;
      else if (x.status === "delivered") delivered++;
      else if (x.status === "approved") approved++;
      if (x.status === "pending" && d < new Date(today.toDateString())) overdue++;
    });
    return { pending, delivered, approved, overdue };
  }, [data, month]);

  async function setStatus(id: string, status: Status) {
    const { error } = await supabase.from("calendar_items").update({ status }).eq("id", id);
    if (error) return toast.error("Update mislukt: " + error.message);
    toast.success("Status bijgewerkt");
    qc.invalidateQueries({ queryKey: ["client-cal"] });
  }

  async function removeItem(id: string) {
    if (!confirm("Verwijderen?")) return;
    const { error } = await supabase.from("calendar_items").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Verwijderd");
    qc.invalidateQueries({ queryKey: ["client-cal"] });
  }

  async function addItem(payload: { client_id: string; title: string; deliverable_type: Deliv; description: string }) {
    const { error } = await supabase.from("calendar_items").insert({
      client_id: payload.client_id,
      title: payload.title,
      deliverable_type: payload.deliverable_type,
      description: payload.description || null,
      date: selectedKey,
      status: "pending",
    } as any);
    if (error) return toast.error(error.message);
    toast.success("Toegevoegd");
    setAdding(false);
    qc.invalidateQueries({ queryKey: ["client-cal"] });
  }

  async function reassignItem(id: string, client_id: string) {
    const { error } = await supabase.from("calendar_items").update({ client_id } as any).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Toegewezen");
    qc.invalidateQueries({ queryKey: ["client-cal"] });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-gold/80">Planning</p>
          <h1 className="font-display text-5xl mt-2">Kalender</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Klik op een dag voor de deliverables. Statusbadges tonen meteen wat er nog open staat.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
            className="rounded-full glass p-2 hover:bg-gold/10"><ChevronLeft className="h-4 w-4" /></button>
          <div className="font-display text-xl w-44 text-center capitalize">
            {month.toLocaleDateString("nl-NL", { month: "long", year: "numeric" })}
          </div>
          <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
            className="rounded-full glass p-2 hover:bg-gold/10"><ChevronRight className="h-4 w-4" /></button>
          <button onClick={() => { const n = new Date(); n.setDate(1); setMonth(n); setSelected(new Date()); }}
            className="rounded-full glass px-3 py-1.5 text-sm hover:bg-gold/10">Vandaag</button>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Te leveren" value={monthTotals.pending} tone="amber" Icon={Clock} />
        <Kpi label="Aangeleverd" value={monthTotals.delivered} tone="sky" Icon={CheckCircle2} />
        <Kpi label="Goedgekeurd" value={monthTotals.approved} tone="emerald" Icon={ShieldCheck} />
        <Kpi label="Te laat" value={monthTotals.overdue} tone="red" Icon={AlertTriangle} />
      </div>

      {/* Filter */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-muted-foreground uppercase tracking-wider">Filter:</span>
        {(["all", "pending", "delivered", "approved"] as const).map((s) => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={cn(
              "rounded-full border px-3 py-1 transition",
              statusFilter === s
                ? "bg-gold/15 text-gold border-gold/40"
                : "border-border/40 text-muted-foreground hover:text-foreground",
            )}>
            {s === "all" ? "Alles" : STATUS_META[s].label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        {/* Calendar grid */}
        <div className="glass-strong rounded-2xl p-4">
          <div className="grid grid-cols-7 gap-1 text-[10px] uppercase tracking-[0.18em] text-gold/70 pb-2">
            {["ma","di","wo","do","vr","za","zo"].map((d) => <div key={d} className="text-center">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {days.map((d, i) => {
              const k = toKey(d);
              const dayItems = byDay[k] || [];
              const inMonth = d.getMonth() === month.getMonth();
              const isToday = sameDay(d, today);
              const isSelected = sameDay(d, selected);
              const counts = { pending: 0, delivered: 0, approved: 0 } as Record<Status, number>;
              dayItems.forEach((it: any) => { counts[it.status as Status] = (counts[it.status as Status] ?? 0) + 1; });
              const overdue = !isToday && d < new Date(today.toDateString()) && counts.pending > 0;

              return (
                <button key={i} onClick={() => setSelected(d)}
                  className={cn(
                    "min-h-28 text-left rounded-lg p-2 transition border",
                    inMonth ? "bg-surface/50" : "bg-surface/20 opacity-50",
                    isSelected ? "border-gold ring-1 ring-gold/40" : "border-transparent hover:border-gold/30",
                    overdue && "bg-red-500/5",
                  )}>
                  <div className="flex items-center justify-between">
                    <span className={cn(
                      "text-xs flex items-center justify-center h-6 w-6 rounded-full",
                      isToday ? "bg-gold text-primary-foreground font-semibold" : "text-muted-foreground",
                    )}>
                      {d.getDate()}
                    </span>
                    {overdue && <AlertTriangle className="h-3 w-3 text-red-400" />}
                  </div>
                  {dayItems.length > 0 && (
                    <div className="mt-1.5 space-y-1">
                      {dayItems.slice(0, 2).map((it: any) => {
                        const dv = DELIV_META[(it.deliverable_type as Deliv) ?? "other"];
                        const sm = STATUS_META[it.status as Status];
                        return (
                          <div key={it.id}
                            className={cn("text-[10px] rounded px-1.5 py-0.5 truncate inline-flex items-center gap-1 border w-full", dv.tint)}>
                            <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", sm.dot)} />
                            <dv.Icon className="h-3 w-3 shrink-0" />
                            <span className="truncate">{it.title}</span>
                          </div>
                        );
                      })}
                      {dayItems.length > 2 && (
                        <div className="text-[10px] text-muted-foreground pl-1">+{dayItems.length - 2} meer</div>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Day detail panel */}
        <aside className="glass-strong rounded-2xl p-5 h-fit lg:sticky lg:top-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-xs uppercase tracking-[0.22em] text-gold/70">Geselecteerde dag</div>
              <div className="font-display text-2xl mt-1 capitalize">
                {selected.toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long" })}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {selectedItems.length} deliverable{selectedItems.length === 1 ? "" : "s"}
              </div>
            </div>
            {isAdmin && (
              <button onClick={() => setAdding((v) => !v)}
                className="rounded-full bg-gradient-gold text-primary-foreground p-2 hover:opacity-90"
                title={adding ? "Annuleren" : "Toevoegen"}>
                {adding ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              </button>
            )}
          </div>

          {isAdmin && adding && (
            <AddForm clients={clients ?? []} onSubmit={addItem} onCancel={() => setAdding(false)} />
          )}

          <div className="mt-4 space-y-3">
            {selectedItems.length === 0 && !adding && (
              <div className="rounded-xl border border-dashed border-border/40 p-6 text-center text-sm text-muted-foreground">
                Geen deliverables op deze dag.
              </div>
            )}
            {selectedItems.map((it: any) => {
              const dv = DELIV_META[(it.deliverable_type as Deliv) ?? "other"];
              const sm = STATUS_META[it.status as Status];
              const overdue = it.status === "pending" && new Date(it.date) < new Date(today.toDateString());
              const clientName = it.clients?.name;
              const clientColor = it.clients?.brand_color || "var(--gradient-gold)";
              return (
                <div key={it.id} className={cn("rounded-xl p-3 border", "bg-surface/40", overdue ? "border-red-400/40" : "border-border/40")}>
                  <div className="flex items-start gap-2">
                    <div className={cn("rounded-lg p-1.5 border", dv.tint)}>
                      <dv.Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium leading-tight">{it.title}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">{dv.label}</div>
                      {clientName && (
                        <div className="mt-1.5 inline-flex items-center gap-1.5 text-[11px]">
                          <span className="h-2 w-2 rounded-full" style={{ background: clientColor }} />
                          <Briefcase className="h-3 w-3 text-muted-foreground" />
                          <span className="text-foreground/80">{clientName}</span>
                        </div>
                      )}
                    </div>
                    <span className={cn("text-[10px] rounded-full px-2 py-1 inline-flex items-center gap-1 border whitespace-nowrap", sm.cls)}>
                      <sm.Icon className="h-3 w-3" /> {sm.label}
                    </span>
                  </div>
                  {it.description && <p className="text-xs text-muted-foreground mt-2 whitespace-pre-wrap">{it.description}</p>}
                  {overdue && (
                    <div className="mt-2 text-[11px] text-red-300 inline-flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" /> Deadline verlopen
                    </div>
                  )}
                  {isAdmin && (clients?.length ?? 0) > 0 && (
                    <div className="mt-2">
                      <select
                        value={it.client_id}
                        onChange={(e) => reassignItem(it.id, e.target.value)}
                        className="w-full text-[11px] rounded-lg bg-input/60 hairline px-2 py-1.5 outline-none focus:ring-2 focus:ring-gold/40"
                      >
                        {clients!.map((c: any) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {it.status !== "delivered" && (
                      <button onClick={() => setStatus(it.id, "delivered")}
                        className="text-[11px] rounded-full border border-sky-400/40 text-sky-300 hover:bg-sky-500/10 px-2.5 py-1 inline-flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Markeer aangeleverd
                      </button>
                    )}
                    {isAdmin && it.status !== "approved" && (
                      <button onClick={() => setStatus(it.id, "approved")}
                        className="text-[11px] rounded-full border border-emerald-400/40 text-emerald-300 hover:bg-emerald-500/10 px-2.5 py-1 inline-flex items-center gap-1">
                        <ShieldCheck className="h-3 w-3" /> Keur goed
                      </button>
                    )}
                    {it.status !== "pending" && (
                      <button onClick={() => setStatus(it.id, "pending")}
                        className="text-[11px] rounded-full border border-border/40 text-muted-foreground hover:text-foreground px-2.5 py-1 inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" /> Heropen
                      </button>
                    )}
                    {isAdmin && (
                      <button onClick={() => removeItem(it.id)}
                        className="text-[11px] rounded-full border border-destructive/40 text-destructive hover:bg-destructive/10 px-2.5 py-1 inline-flex items-center gap-1 ml-auto">
                        <Trash2 className="h-3 w-3" /> Verwijder
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>


          {/* Legend */}
          <div className="mt-6 border-t border-border/30 pt-4 space-y-2">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Legenda</div>
            <div className="flex flex-wrap gap-2 text-[11px]">
              {(Object.keys(STATUS_META) as Status[]).map((s) => (
                <span key={s} className={cn("rounded-full border px-2 py-0.5 inline-flex items-center gap-1", STATUS_META[s].cls)}>
                  <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_META[s].dot)} /> {STATUS_META[s].label}
                </span>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Kpi({ label, value, tone, Icon }: { label: string; value: number; tone: "amber" | "sky" | "emerald" | "red"; Icon: any }) {
  const tones: Record<string, string> = {
    amber: "from-amber-500/15 to-transparent text-amber-300 border-amber-400/30",
    sky: "from-sky-500/15 to-transparent text-sky-300 border-sky-400/30",
    emerald: "from-emerald-500/15 to-transparent text-emerald-300 border-emerald-400/30",
    red: "from-red-500/15 to-transparent text-red-300 border-red-400/30",
  };
  return (
    <div className={cn("rounded-2xl border p-4 bg-gradient-to-br", tones[tone])}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-wider opacity-80">{label}</span>
        <Icon className="h-4 w-4 opacity-80" />
      </div>
      <div className="font-display text-3xl mt-1 text-foreground">{value}</div>
    </div>
  );
}

function AddForm({
  clients,
  onSubmit,
  onCancel,
}: {
  clients: any[];
  onSubmit: (p: { client_id: string; title: string; deliverable_type: Deliv; description: string }) => void;
  onCancel: () => void;
}) {
  const [clientId, setClientId] = useState(clients[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [type, setType] = useState<Deliv>("other");
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState(false);

  if (clients.length === 0) {
    return (
      <div className="mt-4 rounded-xl border border-dashed border-border/40 p-4 text-center text-sm text-muted-foreground">
        Voeg eerst een klant toe om deliverables in te plannen.
      </div>
    );
  }

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (!title.trim() || !clientId) return;
        setBusy(true);
        await onSubmit({ client_id: clientId, title: title.trim(), deliverable_type: type, description: desc.trim() });
        setBusy(false);
      }}
      className="mt-4 rounded-xl border border-gold/30 bg-surface/60 p-3 space-y-2"
    >
      <div className="text-[11px] uppercase tracking-wider text-gold/80">Nieuw item</div>
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Titel"
        className="w-full text-sm rounded-lg bg-input/60 hairline px-3 py-2 outline-none focus:ring-2 focus:ring-gold/40"
      />
      <select
        value={clientId}
        onChange={(e) => setClientId(e.target.value)}
        className="w-full text-sm rounded-lg bg-input/60 hairline px-3 py-2 outline-none focus:ring-2 focus:ring-gold/40"
      >
        {clients.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
      <select
        value={type}
        onChange={(e) => setType(e.target.value as Deliv)}
        className="w-full text-sm rounded-lg bg-input/60 hairline px-3 py-2 outline-none focus:ring-2 focus:ring-gold/40"
      >
        {(Object.keys(DELIV_META) as Deliv[]).map((k) => (
          <option key={k} value={k}>{DELIV_META[k].label}</option>
        ))}
      </select>
      <textarea
        value={desc}
        onChange={(e) => setDesc(e.target.value)}
        placeholder="Omschrijving (optioneel)"
        rows={2}
        className="w-full text-sm rounded-lg bg-input/60 hairline px-3 py-2 outline-none focus:ring-2 focus:ring-gold/40 resize-none"
      />
      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={busy || !title.trim() || !clientId}
          className="flex-1 rounded-lg bg-gradient-gold py-2 text-xs font-medium text-primary-foreground disabled:opacity-50"
        >
          Toevoegen
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg hairline px-3 py-2 text-xs text-muted-foreground hover:text-foreground"
        >
          Annuleer
        </button>
      </div>
    </form>
  );
}
