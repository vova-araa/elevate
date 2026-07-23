import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { nl } from "date-fns/locale";
import { Bell, BellOff, CheckCheck } from "lucide-react";
import type { RealtimePostgresInsertPayload } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useAuth } from "@/lib/auth-context";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type Notification = Tables<"notifications">;

const NOTIFICATIONS_LIMIT = 15;

/** Fallback-routes per notificatietype als er geen expliciete link is opgeslagen. */
const TYPE_LINKS: Record<string, string> = {
  new_message: "/admin/messages",
  new_upload: "/admin/media",
  post_published: "/admin/planner",
  post_failed: "/admin/planner",
  awaiting_approval: "/admin/approvals",
  task_assigned: "/admin/tasks",
};

const TYPE_DOT: Record<string, string> = {
  new_upload: "bg-sky-400",
  new_message: "bg-fuchsia-400",
  post_published: "bg-emerald-400",
  post_failed: "bg-red-400",
  awaiting_approval: "bg-amber-400",
  ad_budget: "bg-orange-400",
};

/**
 * Toont een native browser-melding voor een nieuwe notificatie, maar alleen als het tabblad
 * niet zichtbaar is en de gebruiker toestemming heeft gegeven. Faalt stil als de browser
 * de Notification-API niet ondersteunt of blokkeert.
 */
function showBrowserNotification(notification: Notification) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (typeof document === "undefined" || document.visibilityState === "visible") return;
  if (window.Notification.permission !== "granted") return;
  try {
    new window.Notification("Elevate Social", {
      body: notification.body ?? notification.title,
    });
  } catch {
    // browser-meldingen niet beschikbaar; stil negeren
  }
}

/**
 * Hook voor het notificatiecentrum: laadt de laatste meldingen + ongelezen-teller,
 * abonneert op realtime inserts en levert mutaties voor gelezen-markeren.
 * Eén keer aanroepen (in de topbar) en het resultaat doorgeven aan <NotificationCenter />.
 */
export function useNotificationCenter() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const userId = user?.id;
  const [notificationPermission, setNotificationPermission] =
    useState<NotificationPermission | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setNotificationPermission(window.Notification.permission);
    }
  }, []);

  const requestNotificationPermission = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    try {
      const permission = await window.Notification.requestPermission();
      setNotificationPermission(permission);
    } catch {
      // browser-meldingen niet beschikbaar; stil negeren
    }
  };

  const { data, isLoading } = useQuery({
    queryKey: ["notification-center", userId ?? "anon"],
    enabled: !!userId,
    queryFn: async () => {
      const [list, unread] = await Promise.all([
        supabase
          .from("notifications")
          .select("*")
          .eq("user_id", userId!)
          .order("created_at", { ascending: false })
          .limit(NOTIFICATIONS_LIMIT),
        supabase
          .from("notifications")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId!)
          .eq("read", false),
      ]);
      return { items: list.data ?? [], unread: unread.count ?? 0 };
    },
  });

  // Realtime: nieuwe notificaties direct tonen
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`notification-center-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload: RealtimePostgresInsertPayload<Notification>) => {
          qc.invalidateQueries({ queryKey: ["notification-center"] });
          qc.invalidateQueries({ queryKey: ["admin-sidebar-counts"] });
          showBrowserNotification(payload.new);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, qc]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["notification-center"] });
    qc.invalidateQueries({ queryKey: ["admin-sidebar-counts"] });
  };

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("notifications").update({ read: true }).eq("id", id);
    },
    onSuccess: invalidate,
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      if (!userId) return;
      await supabase
        .from("notifications")
        .update({ read: true })
        .eq("user_id", userId)
        .eq("read", false);
    },
    onSuccess: invalidate,
  });

  return {
    notifications: data?.items ?? [],
    unreadCount: data?.unread ?? 0,
    isLoading,
    markRead,
    markAllRead,
    notificationPermission,
    requestNotificationPermission,
  };
}

export type NotificationCenterState = ReturnType<typeof useNotificationCenter>;

/** Dropdown-inhoud van het notificatiecentrum (in een Popover in de admin-topbar). */
export function NotificationCenter({
  center,
  onClose,
}: {
  center: NotificationCenterState;
  onClose: () => void;
}) {
  const router = useRouter();
  const {
    notifications,
    unreadCount,
    isLoading,
    markRead,
    markAllRead,
    notificationPermission,
    requestNotificationPermission,
  } = center;

  function openNotification(n: Notification) {
    if (!n.read) markRead.mutate(n.id);
    const target = n.link ?? TYPE_LINKS[n.type];
    onClose();
    if (target) router.history.push(target);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center justify-between border-b border-gold/10 px-4 py-3">
        <div className="font-display text-sm">
          Meldingen
          {unreadCount > 0 && (
            <span className="ml-2 rounded-full bg-gold/15 px-1.5 py-0.5 text-[10px] font-semibold text-gold">
              {unreadCount} nieuw
            </span>
          )}
        </div>
        <button
          onClick={() => markAllRead.mutate()}
          disabled={unreadCount === 0 || markAllRead.isPending}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-gold transition hover:bg-gold/10 disabled:opacity-40 disabled:hover:bg-transparent"
        >
          <CheckCheck className="h-3.5 w-3.5" />
          Alles gelezen
        </button>
      </div>

      {notificationPermission === "default" && (
        <button
          onClick={() => requestNotificationPermission()}
          className="flex w-full shrink-0 items-center gap-2 border-b border-gold/10 px-4 py-2.5 text-left text-xs text-gold transition hover:bg-gold/10"
        >
          <Bell className="h-3.5 w-3.5 shrink-0" />
          Browser-meldingen aanzetten
        </button>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
        {isLoading ? (
          <div className="space-y-3 p-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="space-y-1.5">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
            <BellOff className="h-6 w-6 text-muted-foreground/60" />
            <p className="text-sm text-muted-foreground">Geen meldingen.</p>
          </div>
        ) : (
          <ul className="divide-y divide-border/50">
            {notifications.map((n) => (
              <li key={n.id}>
                <button
                  onClick={() => openNotification(n)}
                  className={cn(
                    "flex w-full items-start gap-2.5 px-4 py-3 text-left transition hover:bg-accent/40",
                    !n.read && "bg-gold/5",
                  )}
                >
                  <span
                    className={cn(
                      "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                      TYPE_DOT[n.type] ?? "bg-gold/60",
                      n.read && "opacity-40",
                    )}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        "block truncate text-sm",
                        n.read ? "text-foreground/80" : "font-medium",
                      )}
                    >
                      {n.title}
                    </span>
                    {n.body && (
                      <span className="mt-0.5 block text-xs text-muted-foreground line-clamp-2">
                        {n.body}
                      </span>
                    )}
                    <span className="mt-1 block text-[10px] text-muted-foreground/80">
                      {formatDistanceToNow(new Date(n.created_at), {
                        addSuffix: true,
                        locale: nl,
                      })}
                    </span>
                  </span>
                  {!n.read && (
                    <span
                      className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold"
                      aria-hidden
                    />
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
