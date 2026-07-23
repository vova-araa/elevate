import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Bot,
  User as UserIcon,
  Send,
  Loader2,
  Sparkles,
  CalendarPlus,
  ListTodo,
  BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useClientStore } from "@/lib/stores/client-store";
import { runAssistant } from "@/lib/assistant.functions";

export const Route = createFileRoute("/_authenticated/admin/assistant")({
  component: AdminAssistant,
});

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  actions?: string[];
}

const WELCOME: ChatMessage = {
  role: "assistant",
  content:
    "Hoi! Ik ben de AI-assistent van Elevate Design. Ik kan posts als concept inplannen, taken aanmaken en vragen over klanten beantwoorden — vertel me gewoon wat je nodig hebt.",
};

function suggestionChips(clientName?: string | null): string[] {
  const who = clientName ?? "een klant";
  return [
    `Plan 3 posts voor ${who} volgende week`,
    `Maak een taak: contentkalender afstemmen met ${who}`,
    `Hoe presteert ${who} op dit moment?`,
  ];
}

function AdminAssistant() {
  const { activeClient } = useClientStore();
  const qc = useQueryClient();
  const assistant = useServerFn(runAssistant);

  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = useMutation({
    mutationFn: async (text: string) => {
      const history = [...messages, { role: "user" as const, content: text }];
      setMessages(history);
      setInput("");
      return assistant({
        data: { messages: history.map((m) => ({ role: m.role, content: m.content })) },
      });
    },
    onSuccess: (r) => {
      setMessages((prev) => [...prev, { role: "assistant", content: r.reply, actions: r.actions }]);
      if (r.actions.length > 0) {
        qc.invalidateQueries({ queryKey: ["scheduled-posts"] });
        qc.invalidateQueries({ queryKey: ["admin-tasks"] });
        qc.invalidateQueries({ queryKey: ["admin-sidebar-counts"] });
      }
    },
    onError: (e: Error) => toast.error(e.message || "AI-assistent gaf een fout"),
  });

  const submit = (text?: string) => {
    const t = (text ?? input).trim();
    if (!t || send.isPending) return;
    send.mutate(t);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <div className="text-[10px] uppercase tracking-[0.25em] text-gold/70">AI</div>
        <h1 className="font-display text-3xl sm:text-4xl text-gold mt-1 inline-flex items-center gap-2">
          <Bot className="h-7 w-7" /> AI Assistent
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Regel dingen via natuurlijke taal: posts inplannen als concept, taken aanmaken of vragen
          stellen over klanten.
        </p>
      </div>

      <div className="flex flex-col h-[calc(100vh-16rem)]">
        {/* Chat */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto rounded-2xl border border-gold/15 bg-card p-4 space-y-4"
        >
          {messages.map((m, i) => (
            <div key={i} className={cn("flex gap-3", m.role === "user" ? "flex-row-reverse" : "")}>
              <div
                className={cn(
                  "h-8 w-8 rounded-full grid place-items-center shrink-0",
                  m.role === "user" ? "bg-accent/40" : "bg-gold/20 text-gold",
                )}
              >
                {m.role === "user" ? <UserIcon className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
              </div>
              <div className={cn("max-w-[80%] space-y-2", m.role === "user" ? "items-end" : "")}>
                <div
                  className={cn(
                    "rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap",
                    m.role === "user"
                      ? "bg-gradient-gold text-primary-foreground rounded-tr-sm"
                      : "bg-background/50 border border-border rounded-tl-sm",
                  )}
                >
                  {m.content}
                </div>
                {m.actions && m.actions.length > 0 && (
                  <div className="space-y-1.5">
                    {m.actions.map((a, j) => (
                      <div
                        key={j}
                        className="text-xs rounded-lg border border-gold/20 bg-gold/5 px-3 py-2 inline-flex items-center gap-2"
                      >
                        <Sparkles className="h-3 w-3 text-gold shrink-0" />
                        {a}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {send.isPending && (
            <div className="flex gap-3">
              <div className="h-8 w-8 rounded-full bg-gold/20 text-gold grid place-items-center">
                <Bot className="h-4 w-4" />
              </div>
              <div className="rounded-2xl px-4 py-2.5 bg-background/50 border border-border">
                <Loader2 className="h-4 w-4 animate-spin text-gold" />
              </div>
            </div>
          )}
        </div>

        {/* Suggestiechips */}
        <div className="mt-3 flex flex-wrap gap-2">
          {suggestionChips(activeClient?.name).map((s, i) => {
            const Icon = i === 0 ? CalendarPlus : i === 1 ? ListTodo : BarChart3;
            return (
              <button
                key={i}
                type="button"
                onClick={() => submit(s)}
                disabled={send.isPending}
                className="text-xs h-8 px-3 rounded-full border border-gold/20 bg-card hover:bg-gold/10 inline-flex items-center gap-1.5 disabled:opacity-50"
              >
                <Icon className="h-3.5 w-3.5 text-gold" />
                {s}
              </button>
            );
          })}
        </div>

        {/* Composer */}
        <div className="mt-3 rounded-2xl border border-gold/15 bg-card p-2 flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="Vraag de AI om posts in te plannen, taken aan te maken of klantvragen te beantwoorden…"
            rows={1}
            className="flex-1 bg-transparent resize-none px-2 py-2 text-sm outline-none max-h-40"
          />
          <button
            onClick={() => submit()}
            disabled={send.isPending || !input.trim()}
            className="h-9 w-9 rounded-xl bg-gold text-primary-foreground grid place-items-center disabled:opacity-40 shrink-0"
          >
            {send.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
