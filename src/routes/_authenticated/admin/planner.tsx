import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, useRef, useEffect } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";
import { useAuth } from "@/lib/auth-context";
import { generateCaption } from "@/lib/planner.functions";
import { publishTikTokPost } from "@/lib/tiktok.functions";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { z } from "zod";
import { CAPTION_LIMITS, DAY_LABELS_LONG } from "@/lib/social-constants";
import { EmojiPickerButton } from "@/components/emoji-picker-button";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  Upload,
  Sparkles,
  Trash2,
  Loader2,
  Calendar as CalIcon,
  Clock,
  CheckCircle2,
  AlertCircle,
  Send,
  Image as ImageIcon,
  Video as VideoIcon,
  CalendarDays,
  LayoutGrid,
  ListChecks,
  Eye,
  Layers,
  Repeat,
  StickyNote,
  Zap,
  type LucideIcon,
} from "lucide-react";
import {
  PLATFORMS,
  STATUS_META,
  GOLD_FALLBACK,
  toKey,
  sameDay,
  type Platform,
  type PostStatus,
} from "@/components/planner/planner-shared";
import { PostChip } from "@/components/planner/post-chip";
import { WeekView } from "@/components/planner/week-view";
import { ClientLegend } from "@/components/planner/client-legend";

const searchSchema = z.object({
  clientId: z.string().uuid().optional(),
  view: z.enum(["month", "week", "day", "agenda"]).optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export const Route = createFileRoute("/_authenticated/admin/planner")({
  validateSearch: searchSchema,
  component: PlannerPage,
});

// Platform-, status- en datumhelpers zijn gedeeld met de planner-componenten
// in src/components/planner/ (PLATFORMS, STATUS_META, toKey, sameDay).

type ScheduledPost = Tables<"scheduled_posts">;
type FeedPost = Pick<
  ScheduledPost,
  | "id"
  | "platform"
  | "caption"
  | "media_path"
  | "media_type"
  | "scheduled_at"
  | "status"
  | "published_at"
>;

/** Vorm van de `recurring_rule` JSON-kolom op scheduled_posts. */
interface RecurringRule {
  freq: "daily" | "weekly" | "monthly";
  count: number;
}

function PlannerPage() {
  const { clientId, view: viewParam, date: dateParam } = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const view = viewParam ?? "month";

  const initialDate = useMemo(() => {
    if (dateParam) {
      const [y, m, d] = dateParam.split("-").map(Number);
      return new Date(y, m - 1, d);
    }
    return new Date();
  }, [dateParam]);

  const { data: clients } = useQuery({
    queryKey: ["planner-clients"],
    queryFn: async () =>
      (await supabase.from("clients").select("id,name,brand_color,industry").order("name")).data ??
      [],
  });

  const selected = clients?.find((c) => c.id === clientId) ?? clients?.[0];
  const activeId = selected?.id;

  if (!clientId && activeId) {
    navigate({ to: "/admin/planner", search: { clientId: activeId, view }, replace: true });
  }

  const [cursor, setCursor] = useState<Date>(initialDate);
  const [selectedDate, setSelectedDate] = useState<Date>(initialDate);
  useEffect(() => {
    if (dateParam) {
      setCursor(initialDate);
      setSelectedDate(initialDate);
    }
  }, [dateParam, initialDate]);
  const [composeOpen, setComposeOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [composeDate, setComposeDate] = useState<Date | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [feedPlatform, setFeedPlatform] = useState<Platform | "all">("all");
  const [feedOpen, setFeedOpen] = useState(true);

  const { data: feedPosts } = useQuery({
    queryKey: ["feed-preview", activeId, feedPlatform],
    enabled: !!activeId,
    queryFn: async () => {
      let q = supabase
        .from("scheduled_posts")
        .select("id,platform,caption,media_path,media_type,scheduled_at,status,published_at")
        .eq("client_id", activeId!)
        .is("deleted_at", null)
        .eq("is_queued", false);
      if (feedPlatform !== "all") q = q.eq("platform", feedPlatform);
      return (await q.order("scheduled_at", { ascending: false }).limit(24)).data ?? [];
    },
  });

  const range = useMemo(() => {
    const start = new Date(cursor);
    const end = new Date(cursor);
    if (view === "month") {
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(end.getMonth() + 1, 0);
      end.setHours(23, 59, 59, 999);
    } else if (view === "week") {
      const offset = (start.getDay() + 6) % 7;
      start.setDate(start.getDate() - offset);
      start.setHours(0, 0, 0, 0);
      end.setTime(start.getTime());
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
    } else if (view === "day") {
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    } else {
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(end.getMonth() + 3, 0);
      end.setHours(23, 59, 59, 999);
    }
    return { start, end };
  }, [cursor, view]);

  const { data: posts } = useQuery({
    queryKey: [
      "scheduled-posts",
      activeId,
      range.start.toISOString(),
      range.end.toISOString(),
      feedPlatform,
    ],
    enabled: !!activeId,
    queryFn: async () => {
      let q = supabase
        .from("scheduled_posts")
        .select("*")
        .eq("client_id", activeId!)
        .is("deleted_at", null)
        .eq("is_queued", false)
        .gte("scheduled_at", range.start.toISOString())
        .lte("scheduled_at", range.end.toISOString());
      if (feedPlatform !== "all") q = q.eq("platform", feedPlatform);
      return (await q.order("scheduled_at")).data ?? [];
    },
  });

  const byDay = useMemo(() => {
    const m: Record<string, ScheduledPost[]> = {};
    (posts ?? []).forEach((p) => {
      const k = toKey(new Date(p.scheduled_at));
      (m[k] ||= []).push(p);
    });
    return m;
  }, [posts]);

  function shiftCursor(dir: -1 | 1) {
    const n = new Date(cursor);
    if (view === "month") n.setMonth(n.getMonth() + dir);
    else if (view === "week") n.setDate(n.getDate() + 7 * dir);
    else if (view === "day") n.setDate(n.getDate() + dir);
    else n.setMonth(n.getMonth() + dir);
    setCursor(n);
  }

  async function reschedule(id: string, newDate: Date, keepTime = true) {
    const orig = (posts ?? []).find((p) => p.id === id);
    if (!orig) return;
    if (orig.status === "published")
      return toast.error("Gepubliceerde posts kunnen niet verplaatst worden");
    const o = new Date(orig.scheduled_at);
    const next = new Date(newDate);
    if (keepTime) next.setHours(o.getHours(), o.getMinutes(), 0, 0);
    if (next.toISOString() === orig.scheduled_at) return;
    // Optimistische update — meteen verplaatsen in de UI, terugdraaien bij fout
    const key = [
      "scheduled-posts",
      activeId,
      range.start.toISOString(),
      range.end.toISOString(),
      feedPlatform,
    ];
    const prev = qc.getQueryData<ScheduledPost[]>(key);
    qc.setQueryData(key, (old: ScheduledPost[] | undefined) =>
      (old ?? []).map((p) => (p.id === id ? { ...p, scheduled_at: next.toISOString() } : p)),
    );
    const { error } = await supabase
      .from("scheduled_posts")
      .update({ scheduled_at: next.toISOString() })
      .eq("id", id);
    if (error) {
      qc.setQueryData(key, prev);
      return toast.error(error.message);
    }
    toast.success("Verplaatst");
    qc.invalidateQueries({ queryKey: ["scheduled-posts"] });
  }

  async function approve(id: string) {
    const { error } = await supabase
      .from("scheduled_posts")
      .update({ status: "scheduled" })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Goedgekeurd & ingepland");
    qc.invalidateQueries({ queryKey: ["scheduled-posts"] });
  }
  const publishTikTok = useServerFn(publishTikTokPost);
  async function markPublished(id: string) {
    const post = (posts ?? []).find((p) => p.id === id);
    if (post?.platform === "tiktok") {
      const t = toast.loading("Publiceren naar TikTok...");
      try {
        await publishTikTok({ data: { postId: id } });
        toast.success("Gepubliceerd op TikTok", { id: t });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Publiceren mislukt", { id: t });
      }
      qc.invalidateQueries({ queryKey: ["scheduled-posts"] });
      return;
    }
    const { error } = await supabase
      .from("scheduled_posts")
      .update({ status: "published", published_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Gepubliceerd");
    qc.invalidateQueries({ queryKey: ["scheduled-posts"] });
  }
  async function removePost(id: string) {
    if (!confirm("Naar prullenbak verplaatsen? (30 dagen herstelbaar)")) return false;
    const { error } = await supabase
      .from("scheduled_posts")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return false;
    }
    toast.success("Naar prullenbak");
    qc.invalidateQueries({ queryKey: ["scheduled-posts"] });
    return true;
  }

  function openCompose(date?: Date, id?: string) {
    setEditId(id ?? null);
    setComposeDate(date ?? selectedDate);
    setComposeOpen(true);
  }

  if (!clients) return <Loader2 className="h-6 w-6 animate-spin text-gold" />;

  if (clients.length === 0) {
    return (
      <div className="glass-strong rounded-2xl p-10 text-center">
        <p className="text-muted-foreground">Nog geen klanten. Maak eerst een klant aan.</p>
        <Link
          to="/admin/clients/new"
          className="inline-block mt-4 rounded-full bg-gradient-gold text-primary-foreground px-4 py-2 text-sm"
        >
          Nieuwe klant
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-gold/80">Planner</p>
          <h1 className="font-display text-5xl mt-2">Content kalender</h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-xl">
            Plan posts per platform, sleep om te herplannen, en gebruik AI voor captions en
            hashtags.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={activeId ?? ""}
            onChange={(e) =>
              navigate({ to: "/admin/planner", search: { clientId: e.target.value, view } })
            }
            className="rounded-full bg-input/60 hairline px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-gold/40"
          >
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button
            onClick={() => openCompose(new Date())}
            className="rounded-full bg-gradient-gold text-primary-foreground px-4 py-2 text-sm font-medium inline-flex items-center gap-2"
          >
            <Plus className="h-4 w-4" /> Nieuwe post
          </button>
        </div>
      </div>

      {/* View toggle + nav */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-full glass p-1 text-xs">
          {(["month", "week", "day", "agenda"] as const).map((v) => {
            const Icon =
              v === "month"
                ? CalendarDays
                : v === "week"
                  ? LayoutGrid
                  : v === "day"
                    ? CalIcon
                    : ListChecks;
            const labels = { month: "Maand", week: "Week", day: "Dag", agenda: "Agenda" };
            return (
              <button
                key={v}
                onClick={() =>
                  navigate({ to: "/admin/planner", search: { clientId: activeId, view: v } })
                }
                className={cn(
                  "rounded-full px-3 py-1.5 inline-flex items-center gap-1.5 transition",
                  view === v
                    ? "bg-gold/15 text-gold"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-3.5 w-3.5" /> {labels[v]}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => shiftCursor(-1)}
            className="rounded-full glass p-2 hover:bg-gold/10"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="font-display text-xl min-w-48 text-center capitalize">
            {periodLabel(cursor, view)}
          </div>
          <button
            onClick={() => shiftCursor(1)}
            className="rounded-full glass p-2 hover:bg-gold/10"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            onClick={() => {
              setCursor(new Date());
              setSelectedDate(new Date());
            }}
            className="rounded-full glass px-3 py-1.5 text-sm hover:bg-gold/10"
          >
            Vandaag
          </button>
        </div>
      </div>

      {/* Legenda: klanten met brand_color, klikbaar om te filteren */}
      <ClientLegend
        clients={clients}
        activeId={activeId}
        onSelect={(id: string) =>
          navigate({ to: "/admin/planner", search: { clientId: id, view } })
        }
      />

      {/* Feed preview per account */}
      <FeedPreviewPanel
        clientName={selected?.name ?? ""}
        platform={feedPlatform}
        setPlatform={setFeedPlatform}
        posts={feedPosts ?? []}
        open={feedOpen}
        setOpen={setFeedOpen}
        onOpenPost={(id: string) => openCompose(undefined, id)}
      />

      {/* Main view */}
      {view === "month" && (
        <MonthView
          cursor={cursor}
          byDay={byDay}
          selected={selectedDate}
          brandColor={selected?.brand_color}
          onSelectDay={(d: Date) => {
            setSelectedDate(d);
          }}
          onDoubleClickDay={(d: Date) => openCompose(d)}
          onDropPost={(d: Date, id: string) => reschedule(id, d)}
          dragId={dragId}
          setDragId={setDragId}
          onOpenPost={(id: string) => openCompose(undefined, id)}
        />
      )}
      {view === "week" && (
        <WeekView
          cursor={cursor}
          byDay={byDay}
          brandColor={selected?.brand_color}
          onClickDay={(d: Date) => openCompose(d)}
          onDropPost={(d: Date, id: string) => reschedule(id, d)}
          dragId={dragId}
          setDragId={setDragId}
          onOpenPost={(id: string) => openCompose(undefined, id)}
        />
      )}
      {view === "day" && (
        <DayView
          date={cursor}
          posts={byDay[toKey(cursor)] ?? []}
          brandColor={selected?.brand_color}
          onAdd={() => openCompose(cursor)}
          onOpenPost={(id: string) => openCompose(undefined, id)}
          onApprove={approve}
          onPublish={markPublished}
          onDelete={removePost}
        />
      )}
      {view === "agenda" && (
        <AgendaView
          posts={posts ?? []}
          brandColor={selected?.brand_color}
          onOpenPost={(id: string) => openCompose(undefined, id)}
          onApprove={approve}
          onPublish={markPublished}
          onDelete={removePost}
        />
      )}

      {composeOpen && activeId && (
        <ComposeModal
          clientId={activeId}
          clientName={selected?.name ?? ""}
          industry={selected?.industry ?? ""}
          defaultDate={composeDate ?? selectedDate}
          editId={editId}
          existing={editId ? ((posts ?? []).find((p) => p.id === editId) ?? null) : null}
          userId={user?.id}
          onClose={() => {
            setComposeOpen(false);
            setEditId(null);
          }}
          onSaved={() => {
            setComposeOpen(false);
            setEditId(null);
            qc.invalidateQueries({ queryKey: ["scheduled-posts"] });
          }}
          onDelete={
            editId
              ? async () => {
                  if (await removePost(editId)) {
                    setComposeOpen(false);
                    setEditId(null);
                  }
                }
              : undefined
          }
        />
      )}
    </div>
  );
}

function periodLabel(d: Date, view: string) {
  if (view === "month" || view === "agenda")
    return d.toLocaleDateString("nl-NL", { month: "long", year: "numeric" });
  if (view === "day")
    return d.toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long" });
  const start = new Date(d);
  start.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return `${start.getDate()} ${start.toLocaleDateString("nl-NL", { month: "short" })} – ${end.getDate()} ${end.toLocaleDateString("nl-NL", { month: "short" })}`;
}

/* ------------------------------ MONTH VIEW ------------------------------ */
function MonthView({
  cursor,
  byDay,
  selected,
  brandColor,
  onSelectDay,
  onDoubleClickDay,
  onDropPost,
  dragId,
  setDragId,
  onOpenPost,
}: {
  cursor: Date;
  byDay: Record<string, ScheduledPost[]>;
  selected: Date;
  brandColor?: string | null;
  onSelectDay: (d: Date) => void;
  onDoubleClickDay: (d: Date) => void;
  onDropPost: (d: Date, id: string) => void;
  dragId: string | null;
  setDragId: (id: string | null) => void;
  onOpenPost: (id: string) => void;
}) {
  const start = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const end = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
  const offset = (start.getDay() + 6) % 7;
  const days: Date[] = [];
  for (let i = 0; i < offset; i++)
    days.push(new Date(start.getFullYear(), start.getMonth(), -offset + i + 1));
  for (let d = 1; d <= end.getDate(); d++)
    days.push(new Date(start.getFullYear(), start.getMonth(), d));
  while (days.length % 7)
    days.push(new Date(end.getFullYear(), end.getMonth(), end.getDate() + (days.length % 7)));
  const today = new Date();

  return (
    <div className="glass-strong rounded-2xl p-4">
      <div className="grid grid-cols-7 gap-1 text-[10px] uppercase tracking-[0.18em] text-gold/70 pb-2">
        {["ma", "di", "wo", "do", "vr", "za", "zo"].map((d) => (
          <div key={d} className="text-center">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((d, i) => {
          const k = toKey(d);
          const items = byDay[k] || [];
          const inMonth = d.getMonth() === cursor.getMonth();
          const isToday = sameDay(d, today);
          const isSelected = sameDay(d, selected);
          return (
            <div
              key={i}
              onClick={() => onSelectDay(d)}
              onDoubleClick={() => onDoubleClickDay(d)}
              onDragOver={(e) => {
                e.preventDefault();
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragId) {
                  onDropPost(d, dragId);
                  setDragId(null);
                }
              }}
              className={cn(
                "min-h-28 text-left rounded-lg p-2 transition border cursor-pointer",
                inMonth ? "bg-surface/50" : "bg-surface/20 opacity-50",
                isSelected
                  ? "border-gold ring-1 ring-gold/40"
                  : "border-transparent hover:border-gold/30",
              )}
            >
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    "text-xs flex items-center justify-center h-6 w-6 rounded-full",
                    isToday
                      ? "bg-gold text-primary-foreground font-semibold"
                      : "text-muted-foreground",
                  )}
                >
                  {d.getDate()}
                </span>
                {items.length > 0 && (
                  <span className="text-[10px] text-gold/80">{items.length}</span>
                )}
              </div>
              <div className="mt-1.5 space-y-1">
                {items.slice(0, 3).map((p) => (
                  <PostChip
                    key={p.id}
                    post={p}
                    brandColor={brandColor}
                    onDragStart={() => setDragId(p.id)}
                    onDragEnd={() => setDragId(null)}
                    onOpen={() => onOpenPost(p.id)}
                  />
                ))}
                {items.length > 3 && (
                  <div className="text-[10px] text-muted-foreground pl-1">
                    +{items.length - 3} meer
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------ WEEK VIEW ------------------------------ */
// De week-weergave (7 kolommen, posts per dag gestapeld, drag & drop)
// staat in src/components/planner/week-view.tsx.

/* ------------------------------ DAY VIEW ------------------------------ */
function DayView({
  date,
  posts,
  brandColor,
  onAdd,
  onOpenPost,
  onApprove,
  onPublish,
  onDelete,
}: {
  date: Date;
  posts: ScheduledPost[];
  brandColor?: string | null;
  onAdd: () => void;
  onOpenPost: (id: string) => void;
  onApprove: (id: string) => void;
  onPublish: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const sorted = [...posts].sort((a, b) => +new Date(a.scheduled_at) - +new Date(b.scheduled_at));
  return (
    <div className="glass-strong rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="font-display text-2xl capitalize">
          {date.toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long" })}
        </div>
        <button
          onClick={onAdd}
          className="rounded-full bg-gradient-gold text-primary-foreground px-3 py-1.5 text-sm inline-flex items-center gap-1.5"
        >
          <Plus className="h-4 w-4" /> Post toevoegen
        </button>
      </div>
      {sorted.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/40 p-10 text-center text-sm text-muted-foreground">
          Geen posts voor deze dag.
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map((p) => (
            <PostRow
              key={p.id}
              post={p}
              brandColor={brandColor}
              onOpen={onOpenPost}
              onApprove={onApprove}
              onPublish={onPublish}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------ AGENDA VIEW ------------------------------ */
function AgendaView({
  posts,
  brandColor,
  onOpenPost,
  onApprove,
  onPublish,
  onDelete,
}: {
  posts: ScheduledPost[];
  brandColor?: string | null;
  onOpenPost: (id: string) => void;
  onApprove: (id: string) => void;
  onPublish: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const grouped = useMemo(() => {
    const m = new Map<string, ScheduledPost[]>();
    [...posts]
      .sort((a, b) => +new Date(a.scheduled_at) - +new Date(b.scheduled_at))
      .forEach((p) => {
        const k = toKey(new Date(p.scheduled_at));
        if (!m.has(k)) m.set(k, []);
        m.get(k)!.push(p);
      });
    return Array.from(m.entries());
  }, [posts]);

  if (grouped.length === 0) {
    return (
      <div className="glass-strong rounded-2xl p-10 text-center text-sm text-muted-foreground">
        Geen geplande posts in deze periode.
      </div>
    );
  }
  return (
    <div className="space-y-6">
      {grouped.map(([k, items]) => {
        const d = new Date(k);
        return (
          <div key={k}>
            <div className="text-xs uppercase tracking-[0.22em] text-gold/70 mb-2 capitalize">
              {d.toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long" })}
            </div>
            <div className="space-y-3">
              {items.map((p) => (
                <PostRow
                  key={p.id}
                  post={p}
                  brandColor={brandColor}
                  onOpen={onOpenPost}
                  onApprove={onApprove}
                  onPublish={onPublish}
                  onDelete={onDelete}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PostRow({
  post,
  brandColor,
  onOpen,
  onApprove,
  onPublish,
  onDelete,
}: {
  post: ScheduledPost;
  brandColor?: string | null;
  onOpen: (id: string) => void;
  onApprove: (id: string) => void;
  onPublish: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const meta = PLATFORMS.find((x) => x.id === post.platform)!;
  const sm = STATUS_META[post.status as PostStatus];
  const mediaUrl = post.media_path
    ? supabase.storage.from("client-uploads").getPublicUrl(post.media_path).data.publicUrl
    : null;
  return (
    <div
      className="glass rounded-xl p-4 flex gap-4 items-start"
      style={{ borderLeft: `3px solid ${brandColor || GOLD_FALLBACK}` }}
    >
      <div className="shrink-0">
        {mediaUrl ? (
          post.media_type?.startsWith("video") ? (
            <video src={mediaUrl} className="h-20 w-20 rounded-lg object-cover" />
          ) : (
            <img src={mediaUrl} alt="" className="h-20 w-20 rounded-lg object-cover" />
          )
        ) : (
          <div
            className={cn(
              "h-20 w-20 rounded-lg bg-gradient-to-br grid place-items-center",
              meta.color,
            )}
          >
            <meta.Icon className="h-7 w-7 text-white" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs inline-flex items-center gap-1 text-foreground/80">
            <meta.Icon className="h-3.5 w-3.5" /> {meta.label}
          </span>
          <span
            className={cn(
              "text-[10px] rounded-full px-2 py-0.5 inline-flex items-center gap-1 border",
              sm.cls,
            )}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", sm.dot)} /> {sm.label}
          </span>
          <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
            <Clock className="h-3 w-3" />{" "}
            {new Date(post.scheduled_at).toLocaleString("nl-NL", {
              hour: "2-digit",
              minute: "2-digit",
              day: "numeric",
              month: "short",
            })}
          </span>
        </div>
        <p className="text-sm mt-2 line-clamp-2 whitespace-pre-wrap">
          {post.caption || <span className="text-muted-foreground italic">Geen caption</span>}
        </p>
        {post.error_message && (
          <div className="mt-1 text-[11px] text-red-300 inline-flex items-center gap-1">
            <AlertCircle className="h-3 w-3" /> {post.error_message}
          </div>
        )}
      </div>
      <div className="flex flex-col gap-1.5 shrink-0">
        <button
          onClick={() => onOpen(post.id)}
          className="text-[11px] rounded-full border border-border/40 px-2.5 py-1 hover:bg-accent/30 inline-flex items-center gap-1"
        >
          <Eye className="h-3 w-3" /> Bekijk
        </button>
        {post.status === "draft" && (
          <button
            onClick={() => onApprove(post.id)}
            className="text-[11px] rounded-full border border-sky-400/40 text-sky-300 hover:bg-sky-500/10 px-2.5 py-1 inline-flex items-center gap-1"
          >
            <CheckCircle2 className="h-3 w-3" /> Keur goed
          </button>
        )}
        {(post.status === "scheduled" || post.status === "draft") && (
          <button
            onClick={() => onPublish(post.id)}
            className="text-[11px] rounded-full border border-emerald-400/40 text-emerald-300 hover:bg-emerald-500/10 px-2.5 py-1 inline-flex items-center gap-1"
          >
            <Send className="h-3 w-3" /> Markeer gepubliceerd
          </button>
        )}
        <button
          onClick={() => onDelete(post.id)}
          className="text-[11px] rounded-full border border-destructive/40 text-destructive hover:bg-destructive/10 px-2.5 py-1 inline-flex items-center gap-1"
        >
          <Trash2 className="h-3 w-3" /> Verwijder
        </button>
      </div>
    </div>
  );
}

/* ------------------------------ COMPOSE MODAL ------------------------------ */
function ComposeModal({
  clientId,
  clientName,
  industry,
  defaultDate,
  editId,
  existing,
  userId,
  onClose,
  onSaved,
  onDelete,
}: {
  clientId: string;
  clientName: string;
  industry: string;
  defaultDate: Date;
  editId: string | null;
  existing: ScheduledPost | null;
  userId?: string;
  onClose: () => void;
  onSaved: () => void;
  onDelete?: () => void;
}) {
  const [platforms, setPlatforms] = useState<Platform[]>(
    existing ? [existing.platform as Platform] : ["instagram"],
  );
  const [caption, setCaption] = useState<string>(existing?.caption ?? "");
  const [notes, setNotes] = useState<string>(existing?.notes ?? "");
  const [mediaPath, setMediaPath] = useState<string | null>(existing?.media_path ?? null);
  const [mediaType, setMediaType] = useState<string | null>(existing?.media_type ?? null);
  const [scheduledAt, setScheduledAt] = useState<string>(() => {
    const d = existing ? new Date(existing.scheduled_at) : new Date(defaultDate);
    if (!existing && d.getHours() === 0) d.setHours(10, 0, 0, 0);
    d.setSeconds(0, 0);
    const tz = d.getTimezoneOffset();
    const local = new Date(d.getTime() - tz * 60000);
    return local.toISOString().slice(0, 16);
  });
  const [tone, setTone] = useState<string>("");
  const [brief, setBrief] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const existingRecurringRule = existing?.recurring_rule as RecurringRule | null | undefined;
  const [recurring, setRecurring] = useState<"none" | "daily" | "weekly" | "monthly">(
    existingRecurringRule?.freq ?? "none",
  );
  const [recurringCount, setRecurringCount] = useState<number>(existingRecurringRule?.count ?? 4);
  const [showNotes, setShowNotes] = useState<boolean>(!!existing?.notes);
  const captionRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const captionFn = useServerFn(generateCaption);

  const primary = platforms[0] ?? "instagram";
  const limit = CAPTION_LIMITS[primary];
  const overSoft = limit && caption.length > limit.soft;
  const overHard = limit && caption.length > limit.hard;

  const mediaUrl = mediaPath
    ? supabase.storage.from("client-uploads").getPublicUrl(mediaPath).data.publicUrl
    : null;

  // Best-time suggestions for the primary platform
  const { data: bestTimes } = useQuery({
    queryKey: ["best-times", primary],
    queryFn: async () => {
      const { data } = await supabase
        .from("best_time_benchmarks")
        .select("day_of_week,time_of_day,score,rationale")
        .eq("platform", primary)
        .order("score", { ascending: false })
        .limit(3);
      return data ?? [];
    },
  });

  function togglePlatform(p: Platform) {
    if (editId) return;
    setPlatforms((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]));
  }

  function insertAtCursor(text: string) {
    const el = captionRef.current;
    if (!el) {
      setCaption((c) => c + text);
      return;
    }
    const start = el.selectionStart ?? caption.length;
    const end = el.selectionEnd ?? caption.length;
    const next = caption.slice(0, start) + text + caption.slice(end);
    setCaption(next);
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = start + text.length;
    });
  }

  function applyBestTime(dayOfWeek: number, timeOfDay: string) {
    const base = new Date(scheduledAt);
    const cur = base.getDay();
    const diff = (dayOfWeek - cur + 7) % 7;
    const target = new Date(base);
    target.setDate(target.getDate() + (diff === 0 ? 7 : diff));
    const [h, m] = timeOfDay.split(":").map(Number);
    target.setHours(h, m, 0, 0);
    const tz = target.getTimezoneOffset();
    setScheduledAt(new Date(target.getTime() - tz * 60000).toISOString().slice(0, 16));
    toast.success("Beste tijd toegepast");
  }

  async function onPickFile(file: File) {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "bin";
      const path = `planner/${clientId}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("client-uploads")
        .upload(path, file, { upsert: false, contentType: file.type });
      if (error) throw error;
      setMediaPath(path);
      setMediaType(file.type);
      toast.success("Media geüpload");
    } catch (e) {
      toast.error("Upload mislukt: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setUploading(false);
    }
  }

  async function generate() {
    if (!brief.trim()) return toast.error("Geef een korte briefing");
    setAiLoading(true);
    try {
      const res = await captionFn({
        data: {
          brief,
          platform: primary,
          tone,
          brand: `${clientName}${industry ? " — " + industry : ""}`,
        },
      });
      const text = (res.caption ?? "").trim();
      const tags = (res.hashtags ?? []).join(" ");
      setCaption(text + (tags ? `\n\n${tags}` : ""));
      toast.success("Caption gegenereerd");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setAiLoading(false);
    }
  }

  function expandRecurring(base: Date): Date[] {
    if (recurring === "none") return [base];
    const dates: Date[] = [];
    const n = Math.max(1, Math.min(52, recurringCount));
    for (let i = 0; i < n; i++) {
      const d = new Date(base);
      if (recurring === "daily") d.setDate(d.getDate() + i);
      else if (recurring === "weekly") d.setDate(d.getDate() + i * 7);
      else if (recurring === "monthly") d.setMonth(d.getMonth() + i);
      dates.push(d);
    }
    return dates;
  }

  async function save(asStatus: PostStatus, queueIt = false) {
    if (platforms.length === 0) return toast.error("Kies minimaal 1 platform");
    if (!queueIt && !scheduledAt) return toast.error("Kies een datum en tijd");
    if (overHard) return toast.error(`Caption te lang voor ${limit.label} (max ${limit.hard})`);
    setSaving(true);
    try {
      const recurringRule =
        recurring !== "none" && !editId ? { freq: recurring, count: recurringCount } : null;

      if (editId) {
        const { error } = await supabase
          .from("scheduled_posts")
          .update({
            caption: caption || null,
            notes: notes || null,
            media_path: mediaPath,
            media_type: mediaType,
            scheduled_at: new Date(scheduledAt).toISOString(),
            status: asStatus,
          })
          .eq("id", editId);
        if (error) throw error;
      } else if (queueIt) {
        // Add to queue — queue dispatcher assigns real time later
        const placeholder = new Date(scheduledAt || Date.now()).toISOString();
        const rows: TablesInsert<"scheduled_posts">[] = platforms.map((p) => ({
          client_id: clientId,
          platform: p,
          caption: caption || null,
          notes: notes || null,
          media_path: mediaPath,
          media_type: mediaType,
          scheduled_at: placeholder,
          status: "draft" as PostStatus,
          is_queued: true,
          created_by: userId ?? null,
        }));
        const { error } = await supabase.from("scheduled_posts").insert(rows);
        if (error) throw error;
      } else {
        const base = new Date(scheduledAt);
        const dates = expandRecurring(base);
        // For each platform × each date
        const rows: (TablesInsert<"scheduled_posts"> & {
          _isParent: boolean;
          _idx: number;
          _platform: Platform;
        })[] = [];
        for (const p of platforms) {
          const parentId: string | null = null;
          for (let i = 0; i < dates.length; i++) {
            rows.push({
              client_id: clientId,
              platform: p,
              caption: caption || null,
              notes: notes || null,
              media_path: mediaPath,
              media_type: mediaType,
              scheduled_at: dates[i].toISOString(),
              status: asStatus,
              recurring_rule: i === 0 ? recurringRule : null,
              _isParent: i === 0 && recurringRule ? true : false,
              _idx: i,
              _platform: p,
              created_by: userId ?? null,
            });
          }
          void parentId;
        }
        // Insert all without parent_recurring_id linkage (simple model)
        const insertRows = rows.map(({ _isParent, _idx, _platform, ...r }) => r);
        const { error } = await supabase.from("scheduled_posts").insert(insertRows);
        if (error) throw error;
      }
      const msg = queueIt
        ? `Toegevoegd aan wachtrij`
        : editId
          ? "Opgeslagen"
          : recurring !== "none"
            ? `${recurringCount}× ${platforms.length} post${platforms.length > 1 ? "s" : ""} aangemaakt`
            : `${platforms.length} post${platforms.length > 1 ? "s" : ""} aangemaakt`;
      toast.success(msg);
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-5xl max-h-[92vh] overflow-y-auto glass-strong rounded-2xl border border-gold/20 p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-xs uppercase tracking-[0.22em] text-gold/80 inline-flex items-center gap-2">
              {editId ? "Post bewerken" : "Nieuwe post"}
              {existing &&
                (() => {
                  const sm = STATUS_META[existing.status as PostStatus];
                  return (
                    <span
                      className={cn(
                        "text-[10px] normal-case tracking-normal rounded-full px-2 py-0.5 inline-flex items-center gap-1 border",
                        sm.cls,
                      )}
                    >
                      <span className={cn("h-1.5 w-1.5 rounded-full", sm.dot)} /> {sm.label}
                    </span>
                  );
                })()}
            </div>
            <h2 className="font-display text-3xl mt-1">{clientName}</h2>
          </div>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-accent/40">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid lg:grid-cols-[1fr_360px] gap-6">
          {/* Form */}
          <div className="space-y-4">
            {/* Platforms */}
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                Platforms {editId && "(niet wijzigbaar)"}
              </div>
              <div className="flex flex-wrap gap-2">
                {PLATFORMS.map((p) => {
                  const active = platforms.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      onClick={() => togglePlatform(p.id)}
                      disabled={!!editId}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-sm inline-flex items-center gap-1.5 transition",
                        active
                          ? "bg-gold/15 text-gold border-gold/40"
                          : "border-border/40 text-muted-foreground hover:text-foreground",
                        editId && "opacity-60 cursor-not-allowed",
                      )}
                    >
                      <p.Icon className="h-3.5 w-3.5" /> {p.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Media */}
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                Media
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*,video/*"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onPickFile(f);
                }}
              />
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="rounded-full glass px-4 py-2 text-sm inline-flex items-center gap-2 hover:bg-gold/10"
                >
                  {uploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  {mediaPath ? "Vervang" : "Upload foto / video"}
                </button>
                {mediaPath && (
                  <button
                    onClick={() => {
                      setMediaPath(null);
                      setMediaType(null);
                    }}
                    className="text-xs text-muted-foreground hover:text-destructive inline-flex items-center gap-1"
                  >
                    <Trash2 className="h-3 w-3" /> Verwijder
                  </button>
                )}
                {mediaType && (
                  <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                    {mediaType.startsWith("video") ? (
                      <VideoIcon className="h-3 w-3" />
                    ) : (
                      <ImageIcon className="h-3 w-3" />
                    )}
                    {mediaType}
                  </span>
                )}
              </div>
            </div>

            {/* Schedule + best-time */}
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                Datum & tijd
              </div>
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="rounded-lg bg-input/60 hairline px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gold/40"
              />
              {bestTimes && bestTimes.length > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] uppercase tracking-wider text-gold/70 inline-flex items-center gap-1">
                    <Zap className="h-3 w-3" /> Beste tijd
                  </span>
                  {bestTimes.map((bt, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => applyBestTime(bt.day_of_week, bt.time_of_day)}
                      title={bt.rationale ?? ""}
                      className="rounded-full border border-gold/30 bg-gold/5 px-2 py-0.5 text-[11px] hover:bg-gold/15"
                    >
                      {DAY_LABELS_LONG[bt.day_of_week]?.slice(0, 3)}{" "}
                      {String(bt.time_of_day).slice(0, 5)}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Recurring */}
            {!editId && (
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2 inline-flex items-center gap-1">
                  <Repeat className="h-3 w-3" /> Herhaling
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {(
                    [
                      { v: "none", label: "Niet" },
                      { v: "daily", label: "Dagelijks" },
                      { v: "weekly", label: "Wekelijks" },
                      { v: "monthly", label: "Maandelijks" },
                    ] as const
                  ).map((r) => (
                    <button
                      key={r.v}
                      type="button"
                      onClick={() => setRecurring(r.v)}
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-xs transition",
                        recurring === r.v
                          ? "bg-gold/15 text-gold border-gold/40"
                          : "border-border/40 text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {r.label}
                    </button>
                  ))}
                  {recurring !== "none" && (
                    <label className="text-xs text-muted-foreground inline-flex items-center gap-2">
                      Aantal:
                      <input
                        type="number"
                        min={1}
                        max={52}
                        value={recurringCount}
                        onChange={(e) => setRecurringCount(Number(e.target.value) || 1)}
                        className="w-16 rounded-lg bg-input/60 hairline px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-gold/40"
                      />
                    </label>
                  )}
                </div>
              </div>
            )}

            {/* Caption + AI + emoji */}
            <div>
              <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">
                  Caption
                </div>
                <div className="flex items-center gap-2">
                  <EmojiPickerButton onSelect={insertAtCursor} />
                  <span
                    className={cn(
                      "text-[10px]",
                      overHard
                        ? "text-red-400 font-semibold"
                        : overSoft
                          ? "text-amber-400"
                          : "text-muted-foreground",
                    )}
                  >
                    {caption.length} / {limit?.hard ?? "—"}{" "}
                    {overSoft && !overHard && `(boven ${limit.label} preview ${limit.soft})`}
                    {overHard && ` (te lang voor ${limit.label})`}
                  </span>
                </div>
              </div>
              <textarea
                ref={captionRef}
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                rows={8}
                placeholder="Schrijf je caption…"
                className={cn(
                  "w-full rounded-lg bg-input/60 hairline px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gold/40 resize-y",
                  overHard && "ring-2 ring-red-500/40",
                )}
              />

              <div className="mt-3 rounded-xl border border-gold/20 bg-gold/5 p-3 space-y-2">
                <div className="text-xs text-gold inline-flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" /> AI caption & hashtags
                </div>
                <input
                  value={brief}
                  onChange={(e) => setBrief(e.target.value)}
                  placeholder="Korte briefing — waar gaat de post over?"
                  className="w-full rounded-lg bg-input/60 hairline px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gold/40"
                />
                <div className="flex gap-2">
                  <input
                    value={tone}
                    onChange={(e) => setTone(e.target.value)}
                    placeholder="Tone (optioneel) — bijv. speels, professioneel"
                    className="flex-1 rounded-lg bg-input/60 hairline px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gold/40"
                  />
                  <button
                    onClick={generate}
                    disabled={aiLoading}
                    className="rounded-full bg-gradient-gold text-primary-foreground px-4 py-2 text-sm inline-flex items-center gap-2 disabled:opacity-60"
                  >
                    {aiLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}{" "}
                    Genereer
                  </button>
                </div>
              </div>
            </div>

            {/* Notes (internal) */}
            <div>
              <button
                type="button"
                onClick={() => setShowNotes((v) => !v)}
                className="text-xs uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1 hover:text-foreground"
              >
                <StickyNote className="h-3 w-3" /> Interne notities {notes && `(${notes.length})`}
              </button>
              {showNotes && (
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Notities voor het team — niet zichtbaar in de post"
                  className="mt-2 w-full rounded-lg bg-input/60 hairline px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gold/40 resize-y"
                />
              )}
            </div>
          </div>

          {/* Live preview */}
          <div className="space-y-3">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              Live preview
            </div>
            <div className="space-y-4">
              {(platforms.length ? platforms : ["instagram" as Platform]).map((id) => {
                const meta = PLATFORMS.find((x) => x.id === id)!;
                return (
                  <div key={id} className="glass rounded-xl p-3">
                    <div className="flex items-center gap-2 mb-2 text-xs">
                      <meta.Icon className="h-3.5 w-3.5" /> {meta.label}
                      <span className="text-[10px] text-muted-foreground ml-auto">
                        {meta.ratio}
                      </span>
                    </div>
                    <div
                      className="rounded-lg overflow-hidden bg-surface/40 border border-border/30"
                      style={{ aspectRatio: meta.ratio }}
                    >
                      {mediaUrl ? (
                        mediaType?.startsWith("video") ? (
                          <video src={mediaUrl} controls className="h-full w-full object-cover" />
                        ) : (
                          <img src={mediaUrl} alt="" className="h-full w-full object-cover" />
                        )
                      ) : (
                        <div
                          className={cn(
                            "h-full w-full bg-gradient-to-br grid place-items-center",
                            meta.color,
                          )}
                        >
                          <meta.Icon className="h-10 w-10 text-white/80" />
                        </div>
                      )}
                    </div>
                    {caption && (
                      <p className="text-xs mt-2 whitespace-pre-wrap line-clamp-6">{caption}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 flex flex-wrap items-center justify-end gap-2 pt-4 border-t border-border/30">
          {editId && onDelete && (
            <button
              onClick={onDelete}
              disabled={saving}
              className="mr-auto rounded-full border border-destructive/40 text-destructive hover:bg-destructive/10 px-4 py-2 text-sm inline-flex items-center gap-2 disabled:opacity-60"
            >
              <Trash2 className="h-4 w-4" /> Verwijder
            </button>
          )}
          <button
            onClick={onClose}
            className="rounded-full glass px-4 py-2 text-sm hover:bg-accent/30"
          >
            Annuleren
          </button>
          {!editId && (
            <button
              onClick={() => save("draft", true)}
              disabled={saving || overHard}
              className="rounded-full border border-violet-400/40 text-violet-300 hover:bg-violet-500/10 px-4 py-2 text-sm inline-flex items-center gap-2 disabled:opacity-60"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Layers className="h-4 w-4" />
              )}{" "}
              Voeg toe aan queue
            </button>
          )}
          <button
            onClick={() => save("draft")}
            disabled={saving || overHard}
            className="rounded-full border border-amber-400/40 text-amber-300 hover:bg-amber-500/10 px-4 py-2 text-sm inline-flex items-center gap-2 disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clock className="h-4 w-4" />}{" "}
            Opslaan als concept
          </button>
          <button
            onClick={() => save("scheduled")}
            disabled={saving || overHard}
            className="rounded-full bg-gradient-gold text-primary-foreground px-4 py-2 text-sm inline-flex items-center gap-2 disabled:opacity-60"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}{" "}
            Goedkeuren & inplannen
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ FEED PREVIEW ------------------------------ */
function FeedPreviewPanel({
  clientName,
  platform,
  setPlatform,
  posts,
  open,
  setOpen,
  onOpenPost,
}: {
  clientName: string;
  platform: Platform | "all";
  setPlatform: (p: Platform | "all") => void;
  posts: FeedPost[];
  open: boolean;
  setOpen: (open: boolean) => void;
  onOpenPost: (id: string) => void;
}) {
  const isAll = platform === "all";
  const meta = isAll ? null : PLATFORMS.find((p) => p.id === platform)!;
  const label = isAll ? "Alle kanalen" : meta!.label;
  const ratio = isAll
    ? "1 / 1"
    : platform === "instagram"
      ? "1 / 1"
      : platform === "tiktok"
        ? "9 / 16"
        : platform === "youtube"
          ? "16 / 9"
          : "1.91 / 1";
  const cols =
    isAll || platform === "instagram" || platform === "tiktok"
      ? "grid-cols-3"
      : "grid-cols-2 md:grid-cols-3";
  const options: Array<{ id: Platform | "all"; label: string; Icon: LucideIcon }> = [
    { id: "all", label: "Alle", Icon: Layers },
    ...PLATFORMS.map((p) => ({ id: p.id, label: p.label, Icon: p.Icon })),
  ];

  return (
    <div className="glass-strong rounded-2xl p-4">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          {(() => {
            const Icon = isAll ? Layers : meta!.Icon;
            return <Icon className="h-4 w-4 text-gold" />;
          })()}
          <div className="text-sm">
            <span className="font-display text-base">Filter</span>
            <span className="text-muted-foreground">
              {" "}
              · {clientName} · {label}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-full glass p-1 text-[11px]">
            {options.map((pl) => (
              <button
                key={pl.id}
                type="button"
                onClick={() => setPlatform(pl.id)}
                className={cn(
                  "rounded-full px-2.5 py-1 inline-flex items-center gap-1 transition cursor-pointer",
                  platform === pl.id
                    ? "bg-gold/15 text-gold"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <pl.Icon className="h-3 w-3" /> {pl.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => setOpen(!open)}
            className="rounded-full glass px-3 py-1 text-xs hover:bg-gold/10"
          >
            {open ? "Verberg preview" : "Toon preview"}
          </button>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground mb-3">
        Filtert de hele planner (maand, week, dag, agenda) en de preview hieronder.
      </p>

      {open &&
        (posts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/40 p-8 text-center text-sm text-muted-foreground">
            Nog geen posts voor {label}. Plan een post in om de feed te zien.
          </div>
        ) : (
          <>
            <div className={cn("grid gap-1 rounded-xl overflow-hidden hairline", cols)}>
              {posts.map((p) => (
                <FeedTile key={p.id} post={p} ratio={ratio} onOpen={() => onOpenPost(p.id)} />
              ))}
            </div>
            <p className="mt-2 text-[10px] text-muted-foreground">
              Nieuwste links · Goudgekaderd = ingepland · Groen vinkje = gepubliceerd · Amber =
              wacht op goedkeuring
            </p>
          </>
        ))}
    </div>
  );
}

function FeedTile({ post, ratio, onOpen }: { post: FeedPost; ratio: string; onOpen: () => void }) {
  const mediaUrl = post.media_path
    ? supabase.storage.from("client-uploads").getPublicUrl(post.media_path).data.publicUrl
    : null;
  const sm = STATUS_META[post.status as PostStatus];
  const isVideo = post.media_type?.startsWith("video");
  const ringCls =
    post.status === "published"
      ? "ring-emerald-400/60"
      : post.status === "scheduled" || post.status === "publishing"
        ? "ring-gold/70"
        : post.status === "failed"
          ? "ring-red-400/60"
          : "ring-amber-400/50";

  return (
    <button
      onClick={onOpen}
      className={cn(
        "relative bg-surface-elevated/60 ring-2 ring-inset overflow-hidden group",
        ringCls,
      )}
      style={{ aspectRatio: ratio }}
    >
      {mediaUrl ? (
        isVideo ? (
          <video src={mediaUrl} className="h-full w-full object-cover" muted playsInline />
        ) : (
          <img src={mediaUrl} alt="" className="h-full w-full object-cover" />
        )
      ) : (
        <div className="h-full w-full grid place-items-center bg-gradient-to-br from-gold/20 to-gold/5">
          <ImageIcon className="h-6 w-6 text-gold/60" />
        </div>
      )}
      {isVideo && (
        <div className="absolute top-1 right-1 rounded-full bg-black/70 p-1">
          <VideoIcon className="h-3 w-3 text-white" />
        </div>
      )}
      {post.status === "published" ? (
        <div className="absolute top-1 right-1 rounded-full bg-black/70 p-1">
          <CheckCircle2 className="h-3 w-3 text-emerald-400" />
        </div>
      ) : (
        <div className="absolute top-1 left-1 inline-flex items-center gap-1 rounded-full bg-black/70 px-1.5 py-0.5 text-[9px] text-white">
          <Clock className="h-2.5 w-2.5" />
          {new Date(post.scheduled_at).toLocaleDateString("nl-NL", {
            day: "numeric",
            month: "short",
          })}
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 p-1.5 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition">
        <p className="text-[10px] text-white line-clamp-2">{post.caption || "Geen caption"}</p>
      </div>
    </button>
  );
}
