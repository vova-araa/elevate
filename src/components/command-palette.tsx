import { useEffect, useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard,
  CalendarDays,
  Send,
  FileText,
  Image as ImageIcon,
  Sparkles,
  Clock,
  TrendingUp,
  Heart,
  FileBarChart,
  CheckSquare,
  MessageSquare,
  Building2,
  Settings as SettingsIcon,
  PenSquare,
  UserPlus,
  Moon,
  Sun,
  PanelLeft,
  ListChecks,
  Plug,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { supabase } from "@/integrations/supabase/client";
import { useClientStore } from "@/lib/stores/client-store";
import { useUIStore } from "@/lib/stores/ui-store";
import { useTheme } from "@/lib/theme";

const NAV_ITEMS = [
  { to: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard, keywords: "home overzicht" },
  {
    to: "/admin/planner",
    label: "Planner",
    icon: CalendarDays,
    keywords: "kalender agenda content",
  },
  {
    to: "/admin/compose",
    label: "Nieuwe post",
    icon: PenSquare,
    keywords: "schrijven maken opstellen",
  },
  { to: "/admin/postiz", label: "Posts", icon: Send, keywords: "gepland gepubliceerd" },
  { to: "/admin/queue", label: "Concepten", icon: FileText, keywords: "drafts wachtrij" },
  { to: "/admin/media", label: "Media", icon: ImageIcon, keywords: "bibliotheek fotos videos" },
  {
    to: "/admin/ai",
    label: "AI Studio",
    icon: Sparkles,
    keywords: "assistent captions hashtags hooks hergebruik",
  },
  { to: "/admin/besttime", label: "Best time", icon: Clock, keywords: "beste tijd posten" },
  {
    to: "/admin/reach",
    label: "Bereik & groei",
    icon: TrendingUp,
    keywords: "analytics statistieken",
  },
  {
    to: "/admin/engagement",
    label: "Engagement",
    icon: Heart,
    keywords: "likes reacties interactie",
  },
  { to: "/admin/reports", label: "Rapporten", icon: FileBarChart, keywords: "maandrapport pdf" },
  {
    to: "/admin/approvals",
    label: "Goedkeuring",
    icon: CheckSquare,
    keywords: "akkoord feedback review",
  },
  { to: "/admin/messages", label: "Berichten", icon: MessageSquare, keywords: "chat inbox" },
  { to: "/admin/tasks", label: "Taken", icon: ListChecks, keywords: "todo actiepunten" },
  { to: "/admin/clients", label: "Klanten", icon: Building2, keywords: "accounts bedrijven" },
  {
    to: "/admin/webhooks",
    label: "Kanalen",
    icon: Plug,
    keywords: "koppelingen integraties webhooks",
  },
  {
    to: "/admin/settings",
    label: "Instellingen",
    icon: SettingsIcon,
    keywords: "voorkeuren configuratie",
  },
];

export function CommandPalette() {
  const open = useUIStore((s) => s.commandPaletteOpen);
  const setOpen = useUIStore((s) => s.setCommandPaletteOpen);
  const navigate = useNavigate();
  const { setActiveClient } = useClientStore();
  const { toggleSidebar } = useUIStore();
  const { theme, toggle: toggleTheme } = useTheme();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(!useUIStore.getState().commandPaletteOpen);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setOpen]);

  const { data: clients } = useQuery({
    queryKey: ["command-palette-clients"],
    queryFn: async () => {
      const { data } = await supabase
        .from("clients")
        .select("id, name, brand_color, logo_url, industry")
        .order("name");
      return data ?? [];
    },
    enabled: open,
    staleTime: 60_000,
  });

  const run = useMemo(
    () => (fn: () => void) => {
      setOpen(false);
      fn();
    },
    [],
  );

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Zoek een pagina, klant of actie…" />
      <CommandList>
        <CommandEmpty>Geen resultaten gevonden.</CommandEmpty>

        <CommandGroup heading="Snelle acties">
          <CommandItem
            keywords={["post", "schrijven", "maken"]}
            onSelect={() => run(() => navigate({ to: "/admin/compose" }))}
          >
            <PenSquare className="mr-2 text-gold" />
            Nieuwe post maken
          </CommandItem>
          <CommandItem
            keywords={["klant", "toevoegen", "aanmaken"]}
            onSelect={() => run(() => navigate({ to: "/admin/clients/new" }))}
          >
            <UserPlus className="mr-2 text-gold" />
            Nieuwe klant toevoegen
          </CommandItem>
          <CommandItem
            keywords={["thema", "dark", "licht", "donker"]}
            onSelect={() => run(toggleTheme)}
          >
            {theme === "dark" ? (
              <Sun className="mr-2 text-gold" />
            ) : (
              <Moon className="mr-2 text-gold" />
            )}
            {theme === "dark" ? "Licht thema" : "Donker thema"}
          </CommandItem>
          <CommandItem
            keywords={["sidebar", "menu", "inklappen"]}
            onSelect={() => run(toggleSidebar)}
          >
            <PanelLeft className="mr-2 text-gold" />
            Sidebar in-/uitklappen
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Navigatie">
          {NAV_ITEMS.map((item) => (
            <CommandItem
              key={item.to}
              keywords={item.keywords.split(" ")}
              onSelect={() => run(() => navigate({ to: item.to }))}
            >
              <item.icon className="mr-2 text-muted-foreground" />
              {item.label}
            </CommandItem>
          ))}
        </CommandGroup>

        {clients && clients.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Klanten">
              {clients.map((c) => (
                <CommandItem
                  key={c.id}
                  keywords={[c.industry ?? ""]}
                  onSelect={() =>
                    run(() => {
                      setActiveClient({
                        id: c.id,
                        name: c.name,
                        color: c.brand_color,
                        logo_url: c.logo_url,
                        initials: c.name
                          .split(" ")
                          .slice(0, 2)
                          .map((w: string) => w[0])
                          .join("")
                          .toUpperCase(),
                      });
                      navigate({ to: "/admin/clients/$id", params: { id: c.id } });
                    })
                  }
                >
                  <span
                    className="mr-2 inline-block h-3 w-3 rounded-full border border-border"
                    style={{ backgroundColor: c.brand_color ?? "var(--gold)" }}
                  />
                  {c.name}
                  {c.industry && (
                    <span className="ml-2 text-xs text-muted-foreground">{c.industry}</span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
