import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Loader2,
  Sparkles,
  Send,
  Calendar,
  ListTodo,
  FileText,
  Bot,
  User as UserIcon,
  Image as ImageIcon,
  X,
  Paperclip,
} from "lucide-react";
import { aiAssistant } from "@/lib/ai.functions";
import { supabase } from "@/integrations/supabase/client";
import { useClientStore } from "@/lib/stores/client-store";
import { cn } from "@/lib/utils";
import type { JsonValue } from "@/lib/ai-provider.server";

type Msg = {
  role: "user" | "assistant";
  content: string;
  actions?: { tool: string; result: JsonValue }[];
};

function isJsonRecord(value: JsonValue): value is { [key: string]: JsonValue } {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const QUICK = [
  {
    id: "caption",
    label: "Caption",
    Icon: Sparkles,
    prompt: "Schrijf een caption voor Instagram en LinkedIn over: ",
  },
  {
    id: "schedule",
    label: "Inplannen",
    Icon: Calendar,
    prompt: "Plan een post in voor morgen 10:00 met deze tekst: ",
  },
  { id: "task", label: "Taak", Icon: ListTodo, prompt: "Maak een taak aan: " },
  { id: "note", label: "Notitie", Icon: FileText, prompt: "Voeg een strategie-notitie toe: " },
];

export function AssistantTab() {
  const { activeClient } = useClientStore();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content:
        "Hoi! Ik ben je AI-assistent. Ik kan captions schrijven, posts inplannen, taken aanmaken en notities opslaan. Sleep ook gerust een foto hierin — ik laad 'm gelijk en je kan 'm daarna inplannen.",
    },
  ]);
  const [input, setInput] = useState("");
  const [media, setMedia] = useState<{ url: string; path: string; type: string; name: string }[]>(
    [],
  );
  const [dragOver, setDragOver] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const assistant = useServerFn(aiAssistant);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, media]);

  const uploadMut = useMutation({
    mutationFn: async (file: File) => {
      if (!activeClient) throw new Error("Selecteer eerst een klant in de sidebar");
      if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
        throw new Error("Alleen afbeeldingen of video's");
      }
      const path = `${activeClient.id}/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from("client-uploads").upload(path, file);
      if (error) throw error;
      const { data } = supabase.storage.from("client-uploads").getPublicUrl(path);
      return { url: data.publicUrl, path, type: file.type, name: file.name };
    },
    onSuccess: (m) => {
      setMedia((prev) => [...prev, m]);
      toast.success(`${m.name} geladen`);
    },
    onError: (e: Error) => toast.error(e.message || "Upload mislukt"),
  });

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach((f) => uploadMut.mutate(f));
  };

  const scheduleWithMedia = () => {
    if (media.length === 0) return;
    sessionStorage.setItem(
      "compose-pending-media",
      JSON.stringify({
        media,
        caption: messages.filter((m) => m.role === "assistant").slice(-1)[0]?.content ?? "",
      }),
    );
    navigate({ to: "/admin/compose" });
  };

  const send = useMutation({
    mutationFn: async (text: string) => {
      const history = [...messages, { role: "user" as const, content: text }];
      setMessages(history);
      setInput("");
      return assistant({
        data: {
          messages: history.map((m) => ({ role: m.role, content: m.content })),
          clientId: activeClient?.id ?? null,
        },
      });
    },
    onSuccess: (r) => {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: r.reply ?? "Klaar.", actions: r.actions },
      ]);
    },
    onError: (e: Error) => toast.error(e.message || "AI fout"),
  });

  const submit = () => {
    const t = input.trim();
    if (!t || send.isPending) return;
    send.mutate(t);
  };

  return (
    <div className="max-w-3xl flex flex-col h-[calc(100vh-14rem)]">
      <p className="mb-2 text-xs text-muted-foreground">
        Captions, planning, taken & notities —{" "}
        {activeClient?.name ?? "selecteer een klant in de sidebar"}
      </p>

      {/* Chat */}
      <div
        ref={scrollRef}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={cn(
          "flex-1 overflow-y-auto rounded-2xl border bg-card p-4 space-y-4 transition",
          dragOver ? "border-gold ring-2 ring-gold/30" : "border-gold/15",
        )}
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
                    ? "bg-gold text-primary-foreground rounded-tr-sm"
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
                      <Sparkles className="h-3 w-3 text-gold" />
                      <span className="font-medium">{a.tool}</span>
                      <span className="text-muted-foreground">
                        ·{" "}
                        {isJsonRecord(a.result) && a.result.ok
                          ? "klaar"
                          : `fout: ${isJsonRecord(a.result) ? String(a.result.error) : ""}`}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {(media.length > 0 || uploadMut.isPending) && (
          <div className="flex gap-3">
            <div className="h-8 w-8 rounded-full bg-gold/20 text-gold grid place-items-center shrink-0">
              <ImageIcon className="h-4 w-4" />
            </div>
            <div className="flex-1 space-y-2">
              <div className="flex flex-wrap gap-2">
                {media.map((m, i) => (
                  <div key={i} className="relative group">
                    <img
                      src={m.url}
                      alt={m.name}
                      className="h-24 w-24 object-cover rounded-lg border border-gold/20"
                    />
                    <button
                      onClick={() => setMedia((p) => p.filter((_, j) => j !== i))}
                      className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-background border border-border grid place-items-center opacity-0 group-hover:opacity-100"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                {uploadMut.isPending && (
                  <div className="h-24 w-24 rounded-lg border border-dashed border-gold/30 grid place-items-center">
                    <Loader2 className="h-5 w-5 animate-spin text-gold" />
                  </div>
                )}
              </div>
              {media.length > 0 && (
                <button
                  onClick={scheduleWithMedia}
                  className="text-xs h-8 px-3 rounded-full bg-gold text-primary-foreground hover:bg-gold/90 inline-flex items-center gap-1.5"
                >
                  <Calendar className="h-3.5 w-3.5" />
                  Inplannen met {media.length === 1 ? "deze foto" : `${media.length} foto's`}
                </button>
              )}
            </div>
          </div>
        )}

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

      {/* Quick actions */}
      <div className="mt-3 flex flex-wrap gap-2">
        {QUICK.map(({ id, label, Icon, prompt }) => (
          <button
            key={id}
            onClick={() => setInput(prompt)}
            className="text-xs h-8 px-3 rounded-full border border-gold/20 bg-card hover:bg-gold/10 inline-flex items-center gap-1.5"
          >
            <Icon className="h-3.5 w-3.5 text-gold" />
            {label}
          </button>
        ))}
      </div>

      {/* Composer */}
      <div className="mt-3 rounded-2xl border border-gold/15 bg-card p-2 flex items-end gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          className="hidden"
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="h-9 w-9 rounded-xl border border-border hover:bg-accent/40 grid place-items-center shrink-0"
          title="Foto toevoegen"
        >
          <Paperclip className="h-4 w-4 text-muted-foreground" />
        </button>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Vraag de AI wat je wil, of sleep een foto…"
          rows={1}
          className="flex-1 bg-transparent resize-none px-2 py-2 text-sm outline-none max-h-40"
        />
        <button
          onClick={submit}
          disabled={send.isPending || !input.trim()}
          className="h-9 w-9 rounded-xl bg-gold text-primary-foreground grid place-items-center disabled:opacity-40"
        >
          {send.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </button>
      </div>
    </div>
  );
}
