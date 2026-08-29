import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Mail, Send, Loader2, CheckCircle2, XCircle, FileText } from "lucide-react";
import {
  listEmailTemplates,
  sendClientEmail,
  listClientEmailLog,
} from "@/lib/client-email.functions";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "@tanstack/react-router";

type Props = { clientId: string; clientName: string };

export function SendEmailPanel({ clientId, clientName }: Props) {
  const qc = useQueryClient();
  const listTemplatesFn = useServerFn(listEmailTemplates);
  const sendFn = useServerFn(sendClientEmail);
  const listLogFn = useServerFn(listClientEmailLog);

  const { data: templates } = useQuery({
    queryKey: ["email-templates"],
    queryFn: () => listTemplatesFn(),
  });
  const { data: log } = useQuery({
    queryKey: ["email-log", clientId],
    queryFn: () => listLogFn({ data: { clientId } }),
  });
  const { data: members } = useQuery({
    queryKey: ["client-members-email", clientId],
    queryFn: async () => {
      const { data: links } = await supabase
        .from("client_members")
        .select("user_id")
        .eq("client_id", clientId);
      const ids = (links ?? []).map((l) => l.user_id);
      if (ids.length === 0) return [];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", ids);
      return (profiles ?? []).filter((p) => !!p.email);
    },
  });

  const [templateId, setTemplateId] = useState<string>("");
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (members && members.length > 0 && !to) setTo(members[0].email ?? "");
  }, [members, to]);

  function applyTemplate(id: string) {
    setTemplateId(id);
    const t = templates?.find((x) => x.id === id);
    if (t) {
      setSubject(t.subject);
      setBody(t.body);
    }
  }

  function preview(text: string) {
    return text
      .replace(/\{\{\s*klant_naam\s*\}\}/g, clientName)
      .replace(
        /\{\{\s*vandaag\s*\}\}/g,
        new Date().toLocaleDateString("nl-NL", { dateStyle: "long" }),
      );
  }

  async function send() {
    if (!to.trim() || !subject.trim() || !body.trim()) {
      toast.error("Vul ontvanger, onderwerp en bericht in");
      return;
    }
    setSending(true);
    try {
      await sendFn({
        data: {
          clientId,
          to: to.trim(),
          subject: subject.trim(),
          body: body.trim(),
          templateId: templateId || undefined,
        },
      });
      toast.success("E-mail verstuurd");
      setSubject("");
      setBody("");
      setTemplateId("");
      qc.invalidateQueries({ queryKey: ["email-log", clientId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Versturen mislukt");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="glass-strong rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs uppercase tracking-[0.22em] text-gold/70 inline-flex items-center gap-2">
            <Mail className="h-3.5 w-3.5" /> Nieuwe e-mail
          </div>
          <Link
            to="/admin/settings"
            search={{ tab: "email" }}
            className="text-xs text-muted-foreground hover:text-gold inline-flex items-center gap-1"
          >
            <FileText className="h-3 w-3" /> Sjablonen beheren
          </Link>
        </div>

        <div className="grid gap-2 md:grid-cols-2">
          <select
            value={templateId}
            onChange={(e) => applyTemplate(e.target.value)}
            className="rounded-lg bg-background/60 hairline px-3 py-2 text-sm"
          >
            <option value="">Geen sjabloon — vrije tekst</option>
            {templates?.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <div>
            <input
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="ontvanger@voorbeeld.nl"
              type="email"
              list="client-email-members"
              className="w-full rounded-lg bg-background/60 hairline px-3 py-2 text-sm"
            />
            <datalist id="client-email-members">
              {members?.map((m) => (
                <option key={m.id} value={m.email ?? ""}>
                  {m.full_name}
                </option>
              ))}
            </datalist>
          </div>
        </div>

        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Onderwerp"
          className="w-full rounded-lg bg-background/60 hairline px-3 py-2 text-sm"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={`Schrijf je bericht… gebruik {{klant_naam}} of {{vandaag}} voor variabelen.`}
          rows={6}
          className="w-full rounded-lg bg-background/60 hairline px-3 py-2 text-sm resize-y"
        />

        {(subject || body) && (
          <div className="rounded-lg border border-gold/10 bg-background/40 p-3 text-xs text-muted-foreground">
            <div className="uppercase tracking-wider text-[10px] mb-1">Voorbeeld</div>
            <div className="font-medium text-foreground">{preview(subject)}</div>
            <div className="whitespace-pre-wrap mt-1">{preview(body)}</div>
          </div>
        )}

        <div className="flex justify-end">
          <button
            onClick={send}
            disabled={sending}
            className="inline-flex items-center gap-2 rounded-full bg-gradient-gold px-5 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}{" "}
            {sending ? "Versturen…" : "Verstuur"}
          </button>
        </div>
      </div>

      <div className="glass rounded-xl p-4">
        <div className="text-xs uppercase tracking-[0.22em] text-gold/70 mb-3">
          Verzendgeschiedenis
        </div>
        {(!log || log.length === 0) && (
          <p className="text-sm text-muted-foreground">
            Nog geen e-mails verstuurd naar deze klant.
          </p>
        )}
        <div className="space-y-2">
          {log?.map((l) => (
            <div
              key={l.id}
              className="flex items-start justify-between gap-3 rounded-lg bg-background/40 px-3 py-2 text-xs"
            >
              <div className="min-w-0">
                <div className="font-medium truncate">{l.subject}</div>
                <div className="text-muted-foreground truncate">{l.to_email}</div>
                {l.status === "failed" && l.error && (
                  <div className="text-destructive mt-0.5 truncate">{l.error}</div>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0 text-muted-foreground">
                <span>
                  {new Date(l.created_at).toLocaleDateString("nl-NL", {
                    day: "numeric",
                    month: "short",
                  })}
                </span>
                {l.status === "sent" ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                ) : (
                  <XCircle className="h-3.5 w-3.5 text-destructive" />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
