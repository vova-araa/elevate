import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Send, AlertCircle, CalendarClock, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Props = {
  clientId: string;
  clientName?: string;
  asRole: "admin" | "client";
};

const PRIORITIES = [
  { v: "low", label: "Laag" },
  { v: "medium", label: "Normaal" },
  { v: "high", label: "Hoog" },
  { v: "urgent", label: "Urgent" },
] as const;

const DELIVERABLES = [
  { v: "", label: "Geen deliverable" },
  { v: "reel", label: "Reel" },
  { v: "post", label: "Post" },
  { v: "story", label: "Story" },
  { v: "video", label: "Video" },
  { v: "copy", label: "Copy" },
  { v: "graphic", label: "Graphic" },
  { v: "other", label: "Anders" },
];

const PRIO_COLORS: Record<string, string> = {
  low: "text-muted-foreground bg-muted/30",
  medium: "text-foreground bg-accent/40",
  high: "text-amber-400 bg-amber-500/10",
  urgent: "text-red-400 bg-red-500/10",
};

export function MessagesThread({ clientId, clientName, asRole }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: messages } = useQuery({
    queryKey: ["messages", clientId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("messages")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: true });
      return data ?? [];
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel(`messages-${clientId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages", filter: `client_id=eq.${clientId}` },
        () => qc.invalidateQueries({ queryKey: ["messages", clientId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [clientId, qc]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages?.length]);

  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high" | "urgent">("medium");
  const [deliverable, setDeliverable] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [sending, setSending] = useState(false);

  async function send() {
    if (!body.trim()) return;
    setSending(true);
    const payload: any = {
      client_id: clientId,
      sender_id: user?.id ?? null,
      sender_role: asRole,
      body: body.trim(),
      subject: subject.trim() || null,
      priority,
      deliverable_type: deliverable || null,
      due_date: dueDate || null,
    };
    const { error } = await (supabase as any).from("messages").insert(payload);
    setSending(false);
    if (error) {
      toast.error("Versturen mislukt: " + error.message);
      return;
    }
    setBody("");
    setSubject("");
    setDeliverable("");
    setDueDate("");
    setPriority("medium");
    qc.invalidateQueries({ queryKey: ["messages", clientId] });
  }

  return (
    <div className="space-y-4">
      {asRole === "admin" && clientName && (
        <div className="text-xs uppercase tracking-[0.22em] text-gold/70">
          Thread • {clientName}
        </div>
      )}

      <div className="glass rounded-2xl p-4 max-h-[55vh] overflow-y-auto scrollbar-thin space-y-3">
        {(!messages || messages.length === 0) && (
          <div className="py-10 text-center text-sm text-muted-foreground">
            Nog geen berichten — start het gesprek hieronder.
          </div>
        )}
        {messages?.map((m: any) => {
          const mine = m.sender_id === user?.id;
          return (
            <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[80%] rounded-2xl px-4 py-3 text-sm",
                  mine
                    ? "bg-gold/15 text-foreground border border-gold/30"
                    : "bg-accent/40 text-foreground",
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] uppercase tracking-wider text-gold/80">
                    {m.sender_role === "admin" ? "Elevate" : "Klant"}
                  </span>
                  <span
                    className={cn(
                      "text-[10px] rounded-full px-2 py-0.5",
                      PRIO_COLORS[m.priority] ?? "",
                    )}
                  >
                    {PRIORITIES.find((p) => p.v === m.priority)?.label ?? m.priority}
                  </span>
                  {m.deliverable_type && (
                    <span className="text-[10px] rounded-full px-2 py-0.5 bg-gold/10 text-gold inline-flex items-center gap-1">
                      <Sparkles className="h-3 w-3" /> {m.deliverable_type}
                    </span>
                  )}
                </div>
                {m.subject && <div className="font-medium mb-1">{m.subject}</div>}
                <div className="whitespace-pre-wrap leading-relaxed">{m.body}</div>
                <div className="mt-2 flex items-center gap-3 text-[10px] text-muted-foreground">
                  <span>{new Date(m.created_at).toLocaleString("nl-NL")}</span>
                  {m.due_date && (
                    <span className="inline-flex items-center gap-1 text-gold/80">
                      <CalendarClock className="h-3 w-3" />
                      deadline {new Date(m.due_date).toLocaleDateString("nl-NL")}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="glass rounded-2xl p-4 space-y-3">
        <div className="grid gap-2 md:grid-cols-3">
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Onderwerp (optioneel)"
            className="rounded-lg bg-background/60 hairline px-3 py-2 text-sm md:col-span-3"
          />
          {asRole === "admin" && (
            <>
              <select
                value={deliverable}
                onChange={(e) => setDeliverable(e.target.value)}
                className="rounded-lg bg-background/60 hairline px-3 py-2 text-sm"
              >
                {DELIVERABLES.map((d) => (
                  <option key={d.v} value={d.v}>
                    {d.label}
                  </option>
                ))}
              </select>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="rounded-lg bg-background/60 hairline px-3 py-2 text-sm"
              />
            </>
          )}
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as any)}
            className={cn(
              "rounded-lg bg-background/60 hairline px-3 py-2 text-sm",
              asRole === "client" && "md:col-span-3",
            )}
          >
            {PRIORITIES.map((p) => (
              <option key={p.v} value={p.v}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={
            asRole === "admin"
              ? "Schrijf een update of vraag een deliverable aan…"
              : "Schrijf een bericht aan je Elevate-team…"
          }
          rows={3}
          className="w-full rounded-lg bg-background/60 hairline px-3 py-2 text-sm resize-y"
        />
        <div className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
            <AlertCircle className="h-3.5 w-3.5" />
            Ontvangers krijgen direct een melding.
          </div>
          <button
            onClick={send}
            disabled={sending || !body.trim()}
            className="inline-flex items-center gap-2 rounded-full bg-gradient-gold px-5 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            <Send className="h-4 w-4" /> {sending ? "Versturen…" : "Verstuur"}
          </button>
        </div>
      </div>
    </div>
  );
}
