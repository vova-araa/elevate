import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Upload as UploadIcon, Loader2, Play } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import type { Tables } from "@/integrations/supabase/types";

type ClientMember = { client_id: string; clients: { id: string; name: string } | null };

export const Route = createFileRoute("/_authenticated/client/uploads")({
  component: ClientUploads,
});

function ClientUploads() {
  const qc = useQueryClient();
  const { data: members, isLoading: loadingMembers } = useQuery({
    queryKey: ["my-clients"],
    queryFn: async () =>
      (await supabase.from("client_members").select("client_id, clients(id,name)")).data ?? [],
  });
  const [clientId, setClientId] = useState<string>("");
  useEffect(() => {
    if (!clientId && members && members[0]) setClientId(members[0].client_id);
  }, [members, clientId]);

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
    if (!clientId) return;
    const files = Array.from(e.target.files ?? []);
    const { data: u } = await supabase.auth.getUser();
    for (const file of files) {
      // Sanitize bestandsnaam zodat er nooit buiten de map van deze klant geschreven kan worden.
      const safeName = file.name.replace(/[\\/]/g, "_");
      const path = `${clientId}/${Date.now()}-${safeName}`;
      const { error } = await supabase.storage.from("client-uploads").upload(path, file);
      if (error) {
        toast.error(error.message);
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
      });
      if (insertError) {
        toast.error(insertError.message);
        await supabase.storage.from("client-uploads").remove([path]);
      }
    }
    toast.success("Geüpload — wacht op goedkeuring door je Elevate-team");
    qc.invalidateQueries({ queryKey: ["uploads-client", clientId] });
  }

  if (loadingMembers) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-gold" />
      </div>
    );
  }

  if (!members || members.length === 0) {
    return (
      <EmptyState
        icon={<UploadIcon className="h-5 w-5" />}
        title="Geen actieve klantkoppeling"
        description="Zodra je gekoppeld bent aan een bedrijf kun je hier beeld en video aanleveren."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-gold/80">Beeld & video</p>
          <h1 className="font-display text-4xl sm:text-5xl mt-2">Uploads</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Deel je materiaal met je Elevate-team — je upload wacht op goedkeuring voordat hij in de
            mediabibliotheek verschijnt.
          </p>
        </div>
        {members.length > 1 && (
          <select
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className="w-full sm:w-auto min-h-11 rounded-lg bg-input/60 hairline px-4 py-2 text-sm"
          >
            {members.map((m: ClientMember) => (
              <option key={m.client_id} value={m.client_id}>
                {m.clients?.name}
              </option>
            ))}
          </select>
        )}
      </div>

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
