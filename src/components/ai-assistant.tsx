import { useState, useRef, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { Sparkles, X, Send, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { aiAssistant } from "@/lib/ai.functions";
import type { JsonValue, ToolLoopResult } from "@/lib/ai-provider.server";
import { cn } from "@/lib/utils";

type AssistantAction = ToolLoopResult["actions"][number];

type Msg = { role: "user" | "assistant"; content: string; actions?: AssistantAction[] };

function actionOk(result: JsonValue): boolean {
  return (
    typeof result === "object" && result !== null && !Array.isArray(result) && result.ok === true
  );
}

export function AiAssistant({ clientId }: { clientId?: string }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content:
        "Hoi! Ik ben AI Bot. Vraag bv: 'Maak een taak voor [klant]: nieuwe reel scripten, deadline vrijdag'.",
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const call = useServerFn(aiAssistant);
  const qc = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const res = await call({
        data: {
          messages: next.map((m) => ({ role: m.role, content: m.content })),
          clientId: clientId ?? null,
        },
      });
      setMessages([
        ...next,
        { role: "assistant", content: res.reply || "Klaar.", actions: res.actions },
      ]);
      if (res.actions?.some((a) => actionOk(a.result))) {
        qc.invalidateQueries();
      }
    } catch (e) {
      setMessages([
        ...next,
        {
          role: "assistant",
          content: e instanceof Error && e.message ? e.message : "Er ging iets mis.",
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-gradient-gold px-4 py-3 text-sm font-medium text-primary-foreground shadow-elegant glow-gold hover:scale-105 transition"
        aria-label="AI assistent"
      >
        <Sparkles className="h-4 w-4" />
        <span className="hidden sm:inline">AI Bot</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-end bg-background/40 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="glass-strong w-full sm:w-[420px] sm:m-5 sm:rounded-2xl rounded-t-2xl flex flex-col h-[80vh] sm:h-[600px] shadow-elegant"
          >
            <div className="flex items-center justify-between border-b border-gold/15 px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-gradient-gold flex items-center justify-center">
                  <Sparkles className="h-4 w-4 text-primary-foreground" />
                </div>
                <div>
                  <div className="font-display text-sm">AI Bot</div>
                  <div className="text-[10px] uppercase tracking-wider text-gold/70">
                    AI assistent
                  </div>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="rounded-full p-2 hover:bg-accent/40"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-3">
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}
                >
                  <div
                    className={cn(
                      "max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap",
                      m.role === "user"
                        ? "bg-gold/20 text-foreground"
                        : "bg-surface-elevated/60 text-foreground",
                    )}
                  >
                    {m.content}
                    {m.actions && m.actions.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {m.actions.map((a, idx: number) => (
                          <div
                            key={idx}
                            className={cn(
                              "text-[11px] rounded-md px-2 py-1 inline-flex items-center gap-1 mr-1",
                              actionOk(a.result)
                                ? "bg-emerald-500/15 text-emerald-300"
                                : "bg-red-500/15 text-red-300",
                            )}
                          >
                            {actionOk(a.result) ? (
                              <CheckCircle2 className="h-3 w-3" />
                            ) : (
                              <AlertTriangle className="h-3 w-3" />
                            )}
                            {a.tool}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {busy && (
                <div className="flex justify-start">
                  <div className="bg-surface-elevated/60 rounded-2xl px-3 py-2">
                    <Loader2 className="h-4 w-4 animate-spin text-gold" />
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-gold/15 p-3 flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder="Vraag AI Bot iets..."
                className="flex-1 rounded-lg bg-input/60 hairline px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gold/40"
              />
              <button
                onClick={send}
                disabled={busy || !input.trim()}
                className="rounded-lg bg-gradient-gold px-3 py-2 text-primary-foreground disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
