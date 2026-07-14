import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState } from "react";
import {
  Activity, Upload, Briefcase, FileText, Star, MessageSquare,
  Calendar as CalIcon, Lightbulb, Sparkles, Compass, ListChecks, Filter,
} from "lucide-react";
import { cn } from "@/lib/utils";

type EventKind =
  | "deal" | "upload" | "report" | "evaluation" | "message"
  | "meeting" | "strategy" | "content" | "calendar" | "task" | "step";

type TimelineEvent = {
  id: string;
  kind: EventKind;
  at: string; // ISO
  title: string;
  description?: string | null;
  badge?: string | null;
  action: "created" | "updated";
};

const KIND_META: Record<EventKind, { label: string; icon: any; color: string }> = {
  deal:       { label: "Deal",        icon: Briefcase,    color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30" },
  upload:     { label: "Upload",      icon: Upload,       color: "text-sky-400 bg-sky-400/10 border-sky-400/30" },
  report:     { label: "Rapportage",  icon: FileText,     color: "text-amber-400 bg-amber-400/10 border-amber-400/30" },
  evaluation: { label: "Evaluatie",   icon: Star,         color: "text-yellow-400 bg-yellow-400/10 border-yellow-400/30" },
  message:    { label: "Bericht",     icon: MessageSquare,color: "text-violet-400 bg-violet-400/10 border-violet-400/30" },
  meeting:    { label: "Gesprek",     icon: MessageSquare,color: "text-blue-400 bg-blue-400/10 border-blue-400/30" },
  strategy:   { label: "Strategie",   icon: Lightbulb,    color: "text-orange-400 bg-orange-400/10 border-orange-400/30" },
  content:    { label: "Content",     icon: Sparkles,     color: "text-pink-400 bg-pink-400/10 border-pink-400/30" },
  calendar:   { label: "Kalender",    icon: CalIcon,      color: "text-cyan-400 bg-cyan-400/10 border-cyan-400/30" },
  task:       { label: "Taak",        icon: ListChecks,   color: "text-lime-400 bg-lime-400/10 border-lime-400/30" },
  step:       { label: "Stap",        icon: Compass,      color: "text-indigo-400 bg-indigo-400/10 border-indigo-400/30" },
};

function fmt(d: string) {
  return new Date(d).toLocaleString("nl-NL", { dateStyle: "medium", timeStyle: "short" });
}

function relDay(d: string) {
  return new Date(d).toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

export function ClientTimeline({ clientId }: { clientId: string }) {
  const [filter, setFilter] = useState<EventKind | "all">("all");
  const [range, setRange] = useState<"7" | "30" | "90" | "all">("all");

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["client-timeline", clientId],
    queryFn: async () => {
      const [deals, uploads, reports, evals, messages, meetings, strategy, content, calendar, tasks, steps, roadmaps] = await Promise.all([
        supabase.from("deals").select("id,title,stage,value_cents,created_at,updated_at,closed_at").eq("client_id", clientId),
        supabase.from("uploads").select("id,file_name,file_type,created_at").eq("client_id", clientId),
        supabase.from("reports").select("id,title,report_type,created_at,updated_at").eq("client_id", clientId),
        supabase.from("evaluations").select("id,title,score,period_label,created_at,updated_at").eq("client_id", clientId),
        supabase.from("messages").select("id,subject,body,sender_role,priority,created_at").eq("client_id", clientId),
        supabase.from("meetings").select("id,title,meeting_type,scheduled_at,created_at,updated_at").eq("client_id", clientId),
        supabase.from("strategy_notes").select("id,title,category,created_at,updated_at").eq("client_id", clientId),
        supabase.from("content_items").select("id,title,channel,status,created_at,updated_at").eq("client_id", clientId),
        supabase.from("calendar_items").select("id,title,status,deliverable_type,date,created_at,updated_at").eq("client_id", clientId),
        supabase.from("tasks").select("id,title,status,priority,created_at,updated_at").eq("client_id", clientId),
        supabase.from("roadmaps").select("id").eq("client_id", clientId),
        supabase.from("roadmaps").select("id,title").eq("client_id", clientId),
      ]);

      const evts: TimelineEvent[] = [];
      const pushPair = (kind: EventKind, id: string, created: string, updated: string | null, title: string, description?: string | null, badge?: string | null) => {
        evts.push({ id: `${kind}:${id}:c`, kind, at: created, title, description, badge, action: "created" });
        if (updated && updated !== created && new Date(updated).getTime() - new Date(created).getTime() > 60_000) {
          evts.push({ id: `${kind}:${id}:u`, kind, at: updated, title, description, badge, action: "updated" });
        }
      };

      deals.data?.forEach((d: any) => pushPair("deal", d.id, d.created_at, d.updated_at, d.title,
        `Stage: ${d.stage}${d.value_cents ? ` · €${(d.value_cents/100).toLocaleString("nl-NL")}` : ""}`, d.stage));
      uploads.data?.forEach((u: any) => evts.push({ id: `upload:${u.id}`, kind: "upload", at: u.created_at, title: u.file_name, description: u.file_type, action: "created" }));
      reports.data?.forEach((r: any) => pushPair("report", r.id, r.created_at, r.updated_at, r.title, r.report_type, r.report_type));
      evals.data?.forEach((e: any) => pushPair("evaluation", e.id, e.created_at, e.updated_at, e.title,
        `${e.period_label || ""}${e.score ? ` · score ${e.score}/10` : ""}`, e.score ? `${e.score}/10` : null));
      messages.data?.forEach((m: any) => evts.push({
        id: `msg:${m.id}`, kind: "message", at: m.created_at,
        title: m.subject || (m.sender_role === "admin" ? "Bericht naar klant" : "Bericht van klant"),
        description: m.body?.slice(0, 140), badge: m.priority, action: "created",
      }));
      meetings.data?.forEach((m: any) => pushPair("meeting", m.id, m.created_at, m.updated_at, m.title,
        `${m.meeting_type} · ${fmt(m.scheduled_at)}`, m.meeting_type));
      strategy.data?.forEach((s: any) => pushPair("strategy", s.id, s.created_at, s.updated_at, s.title, s.category, s.category));
      content.data?.forEach((c: any) => pushPair("content", c.id, c.created_at, c.updated_at, c.title, `${c.channel} · ${c.status}`, c.status));
      calendar.data?.forEach((c: any) => pushPair("calendar", c.id, c.created_at, c.updated_at, c.title,
        `${c.deliverable_type} · ${new Date(c.date).toLocaleDateString("nl-NL")}`, c.status));
      tasks.data?.forEach((t: any) => pushPair("task", t.id, t.created_at, t.updated_at, t.title, `prioriteit: ${t.priority}`, t.status));

      // Roadmap steps via parent roadmap ids
      const rmIds = (roadmaps.data || []).map((r: any) => r.id);
      if (rmIds.length) {
        const { data: rs } = await supabase.from("roadmap_steps")
          .select("id,title,status,deliverable_type,due_date,created_at,updated_at,roadmap_id")
          .in("roadmap_id", rmIds);
        rs?.forEach((s: any) => pushPair("step", s.id, s.created_at, s.updated_at, s.title,
          `${s.deliverable_type || "stap"}${s.due_date ? ` · due ${new Date(s.due_date).toLocaleDateString("nl-NL")}` : ""}`, s.status));
      }

      return evts.sort((a, b) => +new Date(b.at) - +new Date(a.at));
    },
  });

  const filtered = useMemo(() => {
    const cutoff = range === "all" ? 0 : Date.now() - Number(range) * 24 * 3600 * 1000;
    return events.filter((e) =>
      (filter === "all" || e.kind === filter) &&
      (range === "all" || +new Date(e.at) >= cutoff)
    );
  }, [events, filter, range]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: events.length };
    events.forEach((e) => { c[e.kind] = (c[e.kind] || 0) + 1; });
    return c;
  }, [events]);

  // Group by day
  const groups = useMemo(() => {
    const map = new Map<string, TimelineEvent[]>();
    filtered.forEach((e) => {
      const key = new Date(e.at).toISOString().slice(0, 10);
      const arr = map.get(key) || [];
      arr.push(e);
      map.set(key, arr);
    });
    return Array.from(map.entries());
  }, [filtered]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-gold/80">
          <Activity className="h-4 w-4" /> Audit log · {filtered.length} acties
        </div>
        <div className="ml-auto inline-flex items-center gap-1 text-xs">
          <Filter className="h-3 w-3 text-muted-foreground" />
          {(["7","30","90","all"] as const).map((r) => (
            <button key={r} onClick={() => setRange(r)}
              className={cn("rounded-full px-3 py-1 hairline", range === r ? "bg-gold/15 text-gold" : "text-muted-foreground hover:text-foreground")}>
              {r === "all" ? "Alles" : `${r}d`}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <button onClick={() => setFilter("all")}
          className={cn("inline-flex items-center gap-2 rounded-full hairline px-3 py-1.5 text-xs",
            filter === "all" ? "bg-gold/15 text-gold" : "text-muted-foreground hover:text-foreground")}>
          Alles <span className="opacity-60">{counts.all || 0}</span>
        </button>
        {(Object.keys(KIND_META) as EventKind[]).map((k) => {
          const M = KIND_META[k];
          return (
            <button key={k} onClick={() => setFilter(k)}
              className={cn("inline-flex items-center gap-2 rounded-full hairline px-3 py-1.5 text-xs transition",
                filter === k ? M.color : "text-muted-foreground hover:text-foreground")}>
              <M.icon className="h-3 w-3" /> {M.label} <span className="opacity-60">{counts[k] || 0}</span>
            </button>
          );
        })}
      </div>

      {isLoading && <div className="text-sm text-muted-foreground">Tijdlijn laden…</div>}
      {!isLoading && filtered.length === 0 && (
        <div className="rounded-2xl hairline p-10 text-center text-sm text-muted-foreground">
          Geen acties in deze selectie.
        </div>
      )}

      <div className="space-y-8">
        {groups.map(([day, items]) => (
          <div key={day}>
            <div className="sticky top-0 z-10 mb-3 inline-block rounded-full bg-background/80 backdrop-blur px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-gold/80 hairline">
              {relDay(day)}
            </div>
            <ol className="relative ml-3 border-l border-gold/15 space-y-3">
              {items.map((e) => {
                const M = KIND_META[e.kind];
                const Icon = M.icon;
                return (
                  <li key={e.id} className="pl-6 relative">
                    <span className={cn("absolute -left-[11px] top-1.5 grid h-5 w-5 place-items-center rounded-full border", M.color)}>
                      <Icon className="h-3 w-3" />
                    </span>
                    <div className="rounded-xl hairline p-3 hover:bg-foreground/[0.02] transition">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={cn("rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider", M.color)}>
                          {M.label}
                        </span>
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          {e.action === "created" ? "aangemaakt" : "bijgewerkt"}
                        </span>
                        {e.badge && (
                          <span className="rounded-full bg-foreground/5 px-2 py-0.5 text-[10px] text-muted-foreground">
                            {e.badge}
                          </span>
                        )}
                        <span className="ml-auto text-[11px] text-muted-foreground">{fmt(e.at)}</span>
                      </div>
                      <div className="mt-1.5 text-sm text-foreground truncate">{e.title}</div>
                      {e.description && (
                        <div className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{e.description}</div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        ))}
      </div>
    </div>
  );
}
