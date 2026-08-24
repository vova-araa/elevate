import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Upload as UploadIcon, Play } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { DeliveryChecklist } from "@/components/client-portal/delivery-checklist";
import { DriveImportCard } from "@/components/drive-import-card";
import type { Tables } from "@/integrations/supabase/types";
import { uploadMedia, resetFileInput } from "@/lib/upload-media";
import { useActiveClient } from "@/hooks/use-active-client";

export const Route = createFileRoute("/_authenticated/client/uploads")({
  component: ClientUploads,
});

function ClientUploads() {
  const qc = useQueryClient();
  const { clientId } = useActiveClient();

  // Openstaande media-verzoeken: een upload kan er direct aan gekoppeld worden,
  // zodat de voortgang op de aanleverlijst vanzelf meeloopt.
  const [requestId, setRequestId] = useState<string>("");
  const { data: openRequests } = useQuery({
    queryKey: ["delivery-requests-open", clientId],
    enabled: !!clientId,
    queryFn: async () =>
      (
        await supabase
          .from("delivery_requests")
          .select("id, title")
          .eq("client_id", clientId)
          .eq("kind", "media")
          .neq("status", "done")
          .order("due_date", { ascending: true, nullsFirst: false })
      ).data ?? [],
  });

  const { data: uploads } = useQuery({
    queryKey: ["uploads-client", clientId],
    enabled: !!clientId,
    queryFn: async () =>
      (
        await supabase
          .from("uploads")
          .select("*")
          .eq("client_id", clientId)
          .order("created_at", { ascending: false })
      ).data ?? [],
  });

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    resetFileInput(e.target);
    if (!clientId || !files.length) return;
    const { data: u } = await supabase.auth.getUser();
    for (const file of files) {
      // Groottecontrole, veilige naam en tijdslimiet zitten in uploadMedia;
      // originelen blijven vol kwaliteit, er wordt niets gecomprimeerd.
      let path: string;
      try {
        ({ path } = await uploadMedia(file, { clientId }));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : String(err));
        continue;
      }
      const { error: insertError } = await supabase.from("uploads").insert({
        client_id: clientId,
        file_path: path,
        file_name: file.name,
        file_type: file.type,
        file_size: file.size,
        uploader_id: u.user?.id ?? null,
        status: "pending",
        delivery_request_id: requestId || null,
      });
      if (insertError) {
        toast.error(insertError.message);
        await supabase.storage.from("client-uploads").remove([path]);
      }
    }
    toast.success("Geüpload — wacht op goedkeuring door je Elevate-team");
    qc.invalidateQueries({ queryKey: ["uploads-client", clientId] });
    qc.invalidateQueries({ queryKey: ["delivery-overview", clientId] });
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.22em] text-gold/80">Beeld & video</p>
        <h1 className="font-display text-4xl sm:text-5xl mt-2">Uploads</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Deel je materiaal met je Elevate-team — je upload wacht op goedkeuring voordat hij in de
          mediabibliotheek verschijnt.
        </p>
      </div>

      <DeliveryChecklist clientId={clientId} />

      {(openRequests?.length ?? 0) > 0 && (
        <label className="block rounded-xl border border-gold/10 bg-card p-4">
          <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Hoort bij aanvraag
          </span>
          <select
            value={requestId}
            onChange={(e) => setRequestId(e.target.value)}
            className="mt-2 w-full min-h-11 rounded-lg bg-input/60 hairline px-4 py-2 text-sm"
          >
            <option value="">Geen — los materiaal</option>
            {openRequests?.map((r) => (
              <option key={r.id} value={r.id}>
                {r.title}
              </option>
            ))}
          </select>
        </label>
      )}

      {clientId && <DriveImportCard clientId={clientId} deliveryRequestId={requestId || null} />}

      <label className="glass-strong block rounded-2xl border-2 border-dashed border-gold/30 p-6 sm:p-10 text-center cursor-pointer hover:border-gold/60">
        <Plus className="h-6 w-6 mx-auto text-gold" />
        <div className="mt-2 text-sm">Sleep of klik om beeld of video toe te voegen</div>
        <input
          type="file"
          multiple
          accept="image/*,video/*"
          onChange={handleFile}
          className="hidden"
        />
      </label>

      {(uploads?.length ?? 0) === 0 ? (
        <EmptyState
          icon={<UploadIcon className="h-5 w-5" />}
          title="Nog geen uploads"
          description="Sleep hierboven je eerste bestand naartoe om te delen met je Elevate-team."
        />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {uploads?.map((u) => (
            <Tile key={u.id} u={u} />
          ))}
        </div>
      )}
    </div>
  );
}

function Tile({ u }: { u: Tables<"uploads"> }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    supabase.storage
      .from("client-uploads")
      .createSignedUrl(u.file_path, 3600)
      .then(({ data }) => setUrl(data?.signedUrl || ""));
  }, [u.file_path]);
  const isVideo = u.file_type?.startsWith("video/");
  return (
    <a
      href={url}
      target="_blank"
      className="group block aspect-square overflow-hidden rounded-xl glass relative"
    >
      {url &&
        (isVideo ? (
          <>
            <video src={url} className="h-full w-full object-cover" />
            <div className="pointer-events-none absolute inset-0 grid place-items-center">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-black/50 text-white ring-1 ring-white/30 backdrop-blur-sm transition group-hover:bg-black/70">
                <Play className="h-5 w-5 translate-x-0.5 fill-current" />
              </span>
            </div>
          </>
        ) : (
          <img
            src={url}
            loading="lazy"
            alt={u.file_name}
            className="h-full w-full object-cover transition group-hover:scale-105"
          />
        ))}
      {u.status === "pending" && (
        <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/70 to-transparent p-2">
          <span className="rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/30 px-2 py-0.5 text-[10px]">
            Wacht op goedkeuring
          </span>
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3">
        <div className="text-xs text-white/90 truncate">{u.file_name}</div>
      </div>
    </a>
  );
}
