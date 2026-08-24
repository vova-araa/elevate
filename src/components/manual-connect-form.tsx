import { useState, type FormEvent } from "react";
import { Loader2, Check, X } from "lucide-react";

/**
 * Tijdelijk alternatief voor de OAuth-koppelknop bij platforms die onder de
 * Meta App Review vallen (zie META_REVIEW_PENDING in feature-flags.ts) — de
 * admin/eigenaar vult zelf de gebruikersnaam in i.p.v. via het platform in te
 * loggen. Geen token, dus dit kan nooit gebruikt worden om te publiceren
 * (social-publish.server.ts accepteert alleen status='active').
 */
export function ManualConnectForm({
  platformLabel,
  busy,
  onSubmit,
  onCancel,
}: {
  platformLabel: string;
  busy: boolean;
  onSubmit: (values: { accountUsername: string; followerCount?: number }) => void;
  onCancel: () => void;
}) {
  const [username, setUsername] = useState("");
  const [followers, setFollowers] = useState("");

  function submit(e: FormEvent) {
    e.preventDefault();
    const trimmed = username.trim();
    if (!trimmed) return;
    const n = followers.trim() ? Number(followers) : undefined;
    onSubmit({
      accountUsername: trimmed,
      followerCount: n !== undefined && Number.isFinite(n) && n >= 0 ? n : undefined,
    });
  }

  return (
    <form onSubmit={submit} className="mt-3 w-full space-y-2" onClick={(e) => e.stopPropagation()}>
      <p className="text-[11px] text-muted-foreground">
        Koppelen via {platformLabel} kan nog niet automatisch (Meta-goedkeuring loopt). Vul de
        accountnaam hieronder in als tijdelijke overbrugging.
      </p>
      <input
        autoFocus
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        placeholder="Gebruikersnaam, bv. @merknaam"
        className="input h-9 text-xs"
        maxLength={120}
      />
      <input
        value={followers}
        onChange={(e) => setFollowers(e.target.value.replace(/[^0-9]/g, ""))}
        placeholder="Aantal volgers (optioneel)"
        inputMode="numeric"
        className="input h-9 text-xs"
        maxLength={10}
      />
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={busy || !username.trim()}
          className="text-xs h-8 px-3 rounded-lg bg-gradient-gold text-primary-foreground font-medium inline-flex items-center gap-1.5 disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Check className="h-3.5 w-3.5" />
          )}
          Handmatig koppelen
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="text-xs h-8 px-3 rounded-lg border border-border text-muted-foreground inline-flex items-center gap-1.5"
        >
          <X className="h-3.5 w-3.5" />
          Annuleren
        </button>
      </div>
    </form>
  );
}
