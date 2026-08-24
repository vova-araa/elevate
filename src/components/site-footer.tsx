import { Link } from "@tanstack/react-router";
import { Instagram, Music2 } from "lucide-react";
import elevateLogoUrl from "@/assets/elevate-logo.png";
import { BUSINESS } from "@/config/business";

// Officiële Elevate Design-accounts.
const SOCIAL_LINKS = [
  { label: "Instagram", href: BUSINESS.instagram, icon: Instagram },
  { label: "TikTok", href: BUSINESS.tiktok, icon: Music2 },
];

/**
 * Gedeelde footer voor alle publieke pagina's (S05) — inclusief het
 * NAP-blok (naam, adres, KvK, btw-id) dat wettelijk verplicht is bij
 * commerciële online dienstverlening (art. 3:15d BW, Handelsregisterwet
 * art. 25). Minimaal 13px, niet de eerdere 10px-behandeling elders in de
 * footer.
 */
export function SiteFooter() {
  return (
    <footer className="relative z-10 border-t border-gold/10 py-8">
      <div className="mx-auto max-w-6xl px-6 space-y-6">
        <div className="flex flex-col items-center justify-between gap-4 text-[11px] text-muted-foreground sm:flex-row">
          <div className="flex items-center gap-2">
            <img src={elevateLogoUrl} alt="" className="h-5 w-5 object-contain" />
            <span>© {new Date().getFullYear()} Elevate Design. Alle rechten voorbehouden.</span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/contact" className="transition-colors hover:text-gold">
              Contact
            </Link>
            <Link to="/terms" className="transition-colors hover:text-gold">
              Voorwaarden
            </Link>
            <Link to="/privacy" className="transition-colors hover:text-gold">
              Privacy
            </Link>
            <Link to="/data-deletion" className="transition-colors hover:text-gold">
              Gegevens verwijderen
            </Link>
            <Link to="/dashboard" className="transition-colors hover:text-gold">
              Portaal
            </Link>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70">
              Volg ons
            </span>
            {SOCIAL_LINKS.map((s) => (
              <a
                key={s.label}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={s.label}
                title={s.label}
                className="grid h-8 w-8 place-items-center rounded-lg border border-gold/10 bg-card/60 text-muted-foreground transition-colors hover:border-gold/30 hover:text-gold"
              >
                <s.icon className="h-4 w-4" />
              </a>
            ))}
          </div>
        </div>

        {/* NAP-blok: naam, adres, KvK, btw-id, telefoon, e-mail. Minimaal 13px. */}
        <div className="border-t border-gold/10 pt-5 text-[13px] leading-relaxed text-muted-foreground">
          <p className="font-medium text-foreground/80">
            {BUSINESS.tradeName}
            {BUSINESS.legalName !== BUSINESS.tradeName && ` (${BUSINESS.legalName})`}
          </p>
          <p>
            {BUSINESS.street}, {BUSINESS.postalCode} {BUSINESS.city}
          </p>
          <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
            <span>KvK {BUSINESS.kvk}</span>
            <span>BTW {BUSINESS.vat}</span>
            <a href={`tel:${BUSINESS.phone}`} className="hover:text-gold">
              {BUSINESS.phone}
            </a>
            <a href={`mailto:${BUSINESS.email}`} className="hover:text-gold">
              {BUSINESS.email}
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
