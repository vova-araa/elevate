import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import Cropper from "react-easy-crop";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { toast } from "sonner";
import {
  Upload,
  ImageIcon,
  Type,
  Crop as CropIcon,
  Save,
  X,
  Plus,
  Trash2,
  Scissors,
  Camera,
  Square,
  Loader2,
  FolderOpen,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/editor")({
  component: EditorPage,
});

type Source = {
  url: string;
  type: "image" | "video";
  name: string;
  clientId?: string;
  folderId?: string | null;
};

type TextLayer = {
  id: string;
  text: string;
  // position in 0..1 of source pixels
  x: number;
  y: number;
  fontSize: number; // in source pixels
  color: string;
  weight: number;
  family: string;
  shadow: boolean;
};

type Area = { x: number; y: number; width: number; height: number };

const ASPECTS = [
  { label: "Vrij", value: 0 },
  { label: "1:1", value: 1 },
  { label: "4:5", value: 4 / 5 },
  { label: "9:16", value: 9 / 16 },
  { label: "16:9", value: 16 / 9 },
];

const FONTS = ["Inter", "Georgia", "Helvetica", "Times New Roman", "Courier New", "Impact"];

function EditorPage() {
  const [src, setSrc] = useState<Source | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [busy, setBusy] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-gold/80">Studio</p>
          <h1 className="font-display text-5xl mt-2">Editor</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Bijsnijden, tekst toevoegen, video's trimmen en frames extraheren.
          </p>
        </div>
        {src && (
          <button
            onClick={() => setSrc(null)}
            className="flex items-center gap-1.5 rounded-lg hairline bg-input/40 px-3 py-2 text-sm hover:bg-accent/40"
          >
            <X className="h-4 w-4" /> Sluit bestand
          </button>
        )}
      </div>

      {!src && (
        <div className="grid md:grid-cols-2 gap-4">
          <label className="glass-strong block rounded-2xl border-2 border-dashed border-gold/30 p-10 text-center cursor-pointer hover:border-gold/60">
            <Upload className="h-7 w-7 mx-auto text-gold" />
            <div className="mt-3 font-display text-xl">Upload nieuw bestand</div>
            <div className="mt-1 text-sm text-muted-foreground">
              Afbeelding of video van je computer
            </div>
            <input
              type="file"
              accept="image/*,video/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const url = URL.createObjectURL(f);
                setSrc({
                  url,
                  type: f.type.startsWith("video/") ? "video" : "image",
                  name: f.name,
                });
              }}
            />
          </label>
          <button
            onClick={() => setShowPicker(true)}
            className="glass-strong rounded-2xl border-2 border-dashed border-gold/20 p-10 text-center hover:border-gold/50"
          >
            <FolderOpen className="h-7 w-7 mx-auto text-gold" />
            <div className="mt-3 font-display text-xl">Kies uit mediabibliotheek</div>
            <div className="mt-1 text-sm text-muted-foreground">
              Open een bestaand bestand per klant en map
            </div>
          </button>
        </div>
      )}

      {src?.type === "image" && (
        <ImageEditor src={src} busy={busy} setBusy={setBusy} onClose={() => setSrc(null)} />
      )}
      {src?.type === "video" && (
        <VideoEditor
          src={src}
          busy={busy}
          setBusy={setBusy}
          onSwapToImage={(s) => setSrc(s)}
          onClose={() => setSrc(null)}
        />
      )}

      {showPicker && (
        <MediaPicker
          onClose={() => setShowPicker(false)}
          onPick={(picked) => {
            setSrc(picked);
            setShowPicker(false);
          }}
        />
      )}
    </div>
  );
}

/* ---------------- Media picker ---------------- */

function MediaPicker({ onClose, onPick }: { onClose: () => void; onPick: (s: Source) => void }) {
  const [clientId, setClientId] = useState("");
  const [folderId, setFolderId] = useState<string | null>(null);

  const { data: clients } = useQuery({
    queryKey: ["admin-clients-list"],
    queryFn: async () =>
      (await supabase.from("clients").select("id,name").order("name")).data ?? [],
  });
  const { data: folders } = useQuery({
    queryKey: ["media-folders", clientId],
    enabled: !!clientId,
    queryFn: async () =>
      (await supabase.from("media_folders").select("*").eq("client_id", clientId).order("name"))
        .data ?? [],
  });
  const { data: uploads } = useQuery({
    queryKey: ["pick-media", clientId, folderId],
    enabled: !!clientId,
    queryFn: async () => {
      let q = supabase
        .from("uploads")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(300);
      q = folderId ? q.eq("folder_id", folderId) : q.is("folder_id", null);
      return (await q).data ?? [];
    },
  });

  return (
    <div
      className="fixed inset-0 z-50 bg-background/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass-strong rounded-2xl w-full max-w-5xl max-h-[85vh] flex flex-col"
      >
        <div className="flex items-center justify-between p-4 border-b border-gold/10">
          <div className="font-display text-xl">Kies bestand</div>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-accent/40">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-4 flex flex-wrap gap-2 border-b border-gold/10">
          <select
            value={clientId}
            onChange={(e) => {
              setClientId(e.target.value);
              setFolderId(null);
            }}
            className="rounded-lg bg-input/60 hairline px-3 py-2 text-sm"
          >
            <option value="">Kies klant…</option>
            {clients?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {clientId && (
            <select
              value={folderId ?? ""}
              onChange={(e) => setFolderId(e.target.value || null)}
              className="rounded-lg bg-input/60 hairline px-3 py-2 text-sm"
            >
              <option value="">Hoofdmap</option>
              {folders?.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          )}
        </div>
        <div className="p-4 overflow-y-auto">
          {!clientId ? (
            <div className="text-center text-muted-foreground py-12">Kies eerst een klant</div>
          ) : !uploads?.length ? (
            <div className="text-center text-muted-foreground py-12">Geen bestanden</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {uploads.map((u) => (
                <PickTile
                  key={u.id}
                  u={u}
                  onPick={async () => {
                    const { data } = await supabase.storage
                      .from("client-uploads")
                      .createSignedUrl(u.file_path, 3600);
                    if (!data?.signedUrl) return toast.error("Kon bestand niet openen");
                    onPick({
                      url: data.signedUrl,
                      type: u.file_type?.startsWith("video/") ? "video" : "image",
                      name: u.file_name,
                      clientId: u.client_id,
                      folderId: u.folder_id,
                    });
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PickTile({ u, onPick }: { u: Tables<"uploads">; onPick: () => void }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    supabase.storage
      .from("client-uploads")
      .createSignedUrl(u.file_path, 3600)
      .then(({ data }) => setUrl(data?.signedUrl || ""));
  }, [u.file_path]);
  const isVideo = u.file_type?.startsWith("video/");
  return (
    <button
      onClick={onPick}
      className="group aspect-square overflow-hidden rounded-xl glass relative text-left"
    >
      {url &&
        (isVideo ? (
          <video src={url} className="h-full w-full object-cover" />
        ) : (
          <img src={url} alt={u.file_name} className="h-full w-full object-cover" />
        ))}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2">
        <div className="text-[11px] text-white/90 truncate">{u.file_name}</div>
      </div>
    </button>
  );
}

/* ---------------- Image editor ---------------- */

function ImageEditor({
  src,
  busy,
  setBusy,
  onClose,
}: {
  src: Source;
  busy: boolean;
  setBusy: (b: boolean) => void;
  onClose: () => void;
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [aspect, setAspect] = useState<number>(0);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);
  const [naturalSize, setNaturalSize] = useState({ w: 0, h: 0 });
  const [layers, setLayers] = useState<TextLayer[]>([]);
  const [selectedLayer, setSelectedLayer] = useState<string | null>(null);
  const [mode, setMode] = useState<"crop" | "text">("crop");
  const previewRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ id: string; dx: number; dy: number } | null>(null);

  useEffect(() => {
    const i = new Image();
    i.onload = () => setNaturalSize({ w: i.naturalWidth, h: i.naturalHeight });
    i.src = src.url;
  }, [src.url]);

  function addLayer() {
    const id = crypto.randomUUID();
    setLayers((l) => [
      ...l,
      {
        id,
        text: "Nieuwe tekst",
        x: 0.5,
        y: 0.5,
        fontSize: Math.max(48, Math.round((naturalSize.w || 1080) / 18)),
        color: "#ffffff",
        weight: 700,
        family: "Inter",
        shadow: true,
      },
    ]);
    setSelectedLayer(id);
    setMode("text");
  }

  function onPointerDown(e: React.PointerEvent, id: string) {
    if (mode !== "text") return;
    const el = previewRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const layer = layers.find((l) => l.id === id);
    if (!layer) return;
    const px = layer.x * rect.width,
      py = layer.y * rect.height;
    dragRef.current = { id, dx: e.clientX - rect.left - px, dy: e.clientY - rect.top - py };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setSelectedLayer(id);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!dragRef.current) return;
    const el = previewRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - rect.left - dragRef.current.dx) / rect.width));
    const y = Math.min(1, Math.max(0, (e.clientY - rect.top - dragRef.current.dy) / rect.height));
    setLayers((ls) => ls.map((l) => (l.id === dragRef.current!.id ? { ...l, x, y } : l)));
  }
  function onPointerUp() {
    dragRef.current = null;
  }

  async function exportImage(): Promise<Blob> {
    const img = await loadImage(src.url);
    const area = croppedArea ?? { x: 0, y: 0, width: img.naturalWidth, height: img.naturalHeight };
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(area.width);
    canvas.height = Math.round(area.height);
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, area.x, area.y, area.width, area.height, 0, 0, canvas.width, canvas.height);
    for (const l of layers) {
      ctx.save();
      ctx.font = `${l.weight} ${l.fontSize}px ${l.family}, sans-serif`;
      ctx.fillStyle = l.color;
      ctx.textBaseline = "middle";
      ctx.textAlign = "center";
      if (l.shadow) {
        ctx.shadowColor = "rgba(0,0,0,0.55)";
        ctx.shadowBlur = l.fontSize * 0.25;
        ctx.shadowOffsetY = l.fontSize * 0.05;
      }
      // position is relative to original image (pre-crop). Convert to canvas coords.
      const px = l.x * img.naturalWidth - area.x;
      const py = l.y * img.naturalHeight - area.y;
      const lines = l.text.split("\n");
      lines.forEach((line, i) => {
        ctx.fillText(line, px, py + (i - (lines.length - 1) / 2) * l.fontSize * 1.15);
      });
      ctx.restore();
    }
    return await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), "image/png", 0.95));
  }

  const sel = layers.find((l) => l.id === selectedLayer) ?? null;

  return (
    <div className="grid lg:grid-cols-[1fr_320px] gap-4">
      <div className="glass rounded-2xl p-3 space-y-3">
        <div className="flex flex-wrap gap-2">
          <Tab
            active={mode === "crop"}
            onClick={() => setMode("crop")}
            icon={CropIcon}
            label="Bijsnijden"
          />
          <Tab active={mode === "text"} onClick={() => setMode("text")} icon={Type} label="Tekst" />
          <div className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
            {naturalSize.w > 0 && (
              <span>
                {naturalSize.w}×{naturalSize.h}
              </span>
            )}
          </div>
        </div>

        {mode === "crop" ? (
          <>
            <div className="relative w-full aspect-[4/3] bg-black/40 rounded-xl overflow-hidden">
              <Cropper
                image={src.url}
                crop={crop}
                zoom={zoom}
                aspect={aspect || undefined}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={(_, areaPx) => setCroppedArea(areaPx as Area)}
                restrictPosition={false}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {ASPECTS.map((a) => (
                <button
                  key={a.label}
                  onClick={() => setAspect(a.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs hairline ${aspect === a.value ? "bg-gold/20 text-gold" : "bg-input/40 hover:bg-accent/40"}`}
                >
                  {a.label}
                </button>
              ))}
              <label className="ml-2 text-xs text-muted-foreground flex items-center gap-2">
                Zoom{" "}
                <input
                  type="range"
                  min={1}
                  max={4}
                  step={0.01}
                  value={zoom}
                  onChange={(e) => setZoom(parseFloat(e.target.value))}
                />
              </label>
            </div>
          </>
        ) : (
          <div
            ref={previewRef}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            className="relative w-full bg-black/40 rounded-xl overflow-hidden select-none"
            style={{
              aspectRatio:
                naturalSize.w && naturalSize.h ? `${naturalSize.w}/${naturalSize.h}` : "4/3",
            }}
          >
            {/* show CROPPED preview if a crop is active */}
            <CroppedPreview src={src.url} area={croppedArea} naturalSize={naturalSize} />
            {/* text layers overlay (positioned over full natural; if cropped we still show but they may sit outside) */}
            {layers.map((l) => {
              // when a crop exists, position relative to crop area
              const area = croppedArea ?? {
                x: 0,
                y: 0,
                width: naturalSize.w || 1,
                height: naturalSize.h || 1,
              };
              const relX = (l.x * (naturalSize.w || 1) - area.x) / area.width;
              const relY = (l.y * (naturalSize.h || 1) - area.y) / area.height;
              const visible = relX >= -0.1 && relX <= 1.1 && relY >= -0.1 && relY <= 1.1;
              if (!visible) return null;
              return (
                <div
                  key={l.id}
                  onPointerDown={(e) => onPointerDown(e, l.id)}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 cursor-move px-1 ${selectedLayer === l.id ? "outline outline-1 outline-gold" : ""}`}
                  style={{
                    left: `${relX * 100}%`,
                    top: `${relY * 100}%`,
                    fontSize: `${(l.fontSize / area.width) * 100}cqw`,
                    fontWeight: l.weight,
                    color: l.color,
                    fontFamily: `${l.family}, sans-serif`,
                    textShadow: l.shadow ? "0 2px 8px rgba(0,0,0,0.55)" : "none",
                    whiteSpace: "pre",
                    lineHeight: 1.15,
                    containerType: "inline-size",
                  }}
                >
                  {l.text}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="glass rounded-2xl p-4 space-y-4">
        {mode === "text" ? (
          <>
            <div className="flex items-center justify-between">
              <div className="font-display text-lg">Tekstlagen</div>
              <button
                onClick={addLayer}
                className="flex items-center gap-1 rounded-lg bg-gold/15 text-gold hairline px-2 py-1 text-xs hover:bg-gold/25"
              >
                <Plus className="h-3 w-3" /> Nieuw
              </button>
            </div>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {layers.map((l) => (
                <button
                  key={l.id}
                  onClick={() => setSelectedLayer(l.id)}
                  className={`w-full text-left text-xs rounded-lg px-2 py-1.5 truncate ${selectedLayer === l.id ? "bg-gold/15 text-gold" : "hover:bg-accent/40"}`}
                >
                  {l.text.split("\n")[0] || "(leeg)"}
                </button>
              ))}
              {layers.length === 0 && (
                <div className="text-xs text-muted-foreground">Nog geen tekst</div>
              )}
            </div>
            {sel && (
              <div className="space-y-2 pt-2 border-t border-gold/10">
                <textarea
                  value={sel.text}
                  onChange={(e) =>
                    setLayers((ls) =>
                      ls.map((x) => (x.id === sel.id ? { ...x, text: e.target.value } : x)),
                    )
                  }
                  className="w-full rounded-lg bg-input/60 hairline px-2 py-1.5 text-sm"
                  rows={2}
                />
                <Field label="Lettertype">
                  <select
                    value={sel.family}
                    onChange={(e) => updateLayer(setLayers, sel.id, { family: e.target.value })}
                    className="w-full rounded-lg bg-input/60 hairline px-2 py-1 text-sm"
                  >
                    {FONTS.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={`Grootte (${sel.fontSize}px)`}>
                  <input
                    type="range"
                    min={12}
                    max={400}
                    value={sel.fontSize}
                    onChange={(e) =>
                      updateLayer(setLayers, sel.id, { fontSize: parseInt(e.target.value) })
                    }
                    className="w-full"
                  />
                </Field>
                <Field label="Gewicht">
                  <select
                    value={sel.weight}
                    onChange={(e) =>
                      updateLayer(setLayers, sel.id, { weight: parseInt(e.target.value) })
                    }
                    className="w-full rounded-lg bg-input/60 hairline px-2 py-1 text-sm"
                  >
                    {[300, 400, 500, 600, 700, 800, 900].map((w) => (
                      <option key={w} value={w}>
                        {w}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Kleur">
                  <input
                    type="color"
                    value={sel.color}
                    onChange={(e) => updateLayer(setLayers, sel.id, { color: e.target.value })}
                    className="h-8 w-full rounded"
                  />
                </Field>
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={sel.shadow}
                    onChange={(e) => updateLayer(setLayers, sel.id, { shadow: e.target.checked })}
                  />
                  Schaduw
                </label>
                <button
                  onClick={() => {
                    setLayers((ls) => ls.filter((x) => x.id !== sel.id));
                    setSelectedLayer(null);
                  }}
                  className="flex items-center gap-1 text-xs text-destructive hover:underline"
                >
                  <Trash2 className="h-3 w-3" /> Verwijder laag
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="text-xs text-muted-foreground">
            Sleep om bij te snijden, kies een verhouding of zoom in. Schakel daarna naar{" "}
            <b>Tekst</b>.
          </div>
        )}

        <div className="pt-2 border-t border-gold/10">
          <SaveBar
            disabled={busy}
            defaultName={`bewerkt-${src.name.replace(/\.[^.]+$/, "")}.png`}
            defaultClientId={src.clientId}
            defaultFolderId={src.folderId ?? null}
            onSave={async ({ clientId, folderId, name }) => {
              setBusy(true);
              try {
                const blob = await exportImage();
                await uploadToLibrary({ blob, name, type: "image/png", clientId, folderId });
                toast.success("Opgeslagen in mediabibliotheek");
                onClose();
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Opslaan mislukt");
              } finally {
                setBusy(false);
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}

function CroppedPreview({
  src,
  area,
  naturalSize,
}: {
  src: string;
  area: Area | null;
  naturalSize: { w: number; h: number };
}) {
  if (!area || !naturalSize.w)
    return <img src={src} className="absolute inset-0 w-full h-full object-contain" alt="" />;
  // CSS-only crop preview using transform
  const scaleX = naturalSize.w / area.width;
  const scaleY = naturalSize.h / area.height;
  const scale = Math.min(scaleX, scaleY);
  return (
    <div className="absolute inset-0 overflow-hidden">
      <img
        src={src}
        alt=""
        className="absolute"
        style={{
          width: `${scaleX * 100}%`,
          height: `${scaleY * 100}%`,
          left: `${(-area.x / area.width) * 100}%`,
          top: `${(-area.y / area.height) * 100}%`,
          maxWidth: "none",
        }}
      />
    </div>
  );
}

/* ---------------- Video editor ---------------- */

function VideoEditor({
  src,
  busy,
  setBusy,
  onSwapToImage,
  onClose,
}: {
  src: Source;
  busy: boolean;
  setBusy: (b: boolean) => void;
  onSwapToImage: (s: Source) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onMeta = () => {
      setDuration(v.duration);
      setTrimEnd(v.duration);
    };
    const onTime = () => setCurrent(v.currentTime);
    v.addEventListener("loadedmetadata", onMeta);
    v.addEventListener("timeupdate", onTime);
    return () => {
      v.removeEventListener("loadedmetadata", onMeta);
      v.removeEventListener("timeupdate", onTime);
    };
  }, []);

  function seek(t: number) {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(duration, t));
  }

  async function extractFrame() {
    const v = videoRef.current;
    if (!v) return;
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    canvas.getContext("2d")!.drawImage(v, 0, 0);
    const blob = await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), "image/png", 0.95));
    const url = URL.createObjectURL(blob);
    toast.success("Frame ingeladen — voeg tekst toe of snij bij");
    onSwapToImage({
      url,
      type: "image",
      name: `frame-${src.name.replace(/\.[^.]+$/, "")}.png`,
      clientId: src.clientId,
      folderId: src.folderId,
    });
  }

  async function exportTrim(): Promise<Blob> {
    const v = videoRef.current;
    if (!v) throw new Error("Geen video");
    // capture using MediaRecorder by playing through the trim range
    const stream = (
      v as HTMLVideoElement & { captureStream?: () => MediaStream }
    ).captureStream?.();
    if (!stream) throw new Error("Browser ondersteunt captureStream niet");
    const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
      ? "video/webm;codecs=vp9"
      : "video/webm";
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 5_000_000 });
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    const done = new Promise<Blob>((res) => {
      rec.onstop = () => res(new Blob(chunks, { type: mime }));
    });
    v.muted = true;
    v.currentTime = trimStart;
    await new Promise((r) => setTimeout(r, 100));
    rec.start();
    await v.play();
    await new Promise<void>((res) => {
      const onT = () => {
        if (v.currentTime >= trimEnd) {
          v.removeEventListener("timeupdate", onT);
          v.pause();
          res();
        }
      };
      v.addEventListener("timeupdate", onT);
    });
    rec.stop();
    return done;
  }

  const startPct = duration ? (trimStart / duration) * 100 : 0;
  const endPct = duration ? (trimEnd / duration) * 100 : 100;

  return (
    <div className="grid lg:grid-cols-[1fr_320px] gap-4">
      <div className="glass rounded-2xl p-3 space-y-3">
        <video ref={videoRef} src={src.url} controls className="w-full rounded-xl bg-black" />
        <div>
          <div className="text-xs text-muted-foreground mb-1 flex justify-between">
            <span>
              {fmt(current)} / {fmt(duration)}
            </span>
            <span>
              Trim: {fmt(trimStart)} → {fmt(trimEnd)} ({fmt(trimEnd - trimStart)})
            </span>
          </div>
          <div className="relative h-8 rounded-lg bg-input/40 hairline">
            <div
              className="absolute top-0 bottom-0 bg-gold/25"
              style={{ left: `${startPct}%`, right: `${100 - endPct}%` }}
            />
            <div
              className="absolute top-0 bottom-0 w-px bg-foreground"
              style={{ left: `${duration ? (current / duration) * 100 : 0}%` }}
            />
          </div>
          <div className="mt-2 grid grid-cols-2 gap-3 text-xs">
            <label>
              Start
              <input
                type="range"
                min={0}
                max={duration || 0}
                step={0.05}
                value={trimStart}
                onChange={(e) => {
                  const t = Math.min(parseFloat(e.target.value), trimEnd - 0.1);
                  setTrimStart(t);
                  seek(t);
                }}
                className="w-full"
              />
            </label>
            <label>
              Einde
              <input
                type="range"
                min={0}
                max={duration || 0}
                step={0.05}
                value={trimEnd}
                onChange={(e) => {
                  const t = Math.max(parseFloat(e.target.value), trimStart + 0.1);
                  setTrimEnd(t);
                  seek(t);
                }}
                className="w-full"
              />
            </label>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => seek(trimStart)}
            className="rounded-lg hairline bg-input/40 px-3 py-1.5 text-xs"
          >
            Naar start
          </button>
          <button
            onClick={() => seek(trimEnd)}
            className="rounded-lg hairline bg-input/40 px-3 py-1.5 text-xs"
          >
            Naar einde
          </button>
          <button
            onClick={() => setTrimStart(current)}
            className="rounded-lg hairline bg-input/40 px-3 py-1.5 text-xs"
          >
            Zet start hier
          </button>
          <button
            onClick={() => setTrimEnd(current)}
            className="rounded-lg hairline bg-input/40 px-3 py-1.5 text-xs"
          >
            Zet einde hier
          </button>
        </div>
      </div>

      <div className="glass rounded-2xl p-4 space-y-4">
        <div>
          <div className="font-display text-lg flex items-center gap-2">
            <Scissors className="h-4 w-4 text-gold" /> Video bewerken
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Stel start- en eindpunt in, of pak het huidige frame als afbeelding om tekst toe te
            voegen.
          </p>
        </div>
        <button
          onClick={extractFrame}
          className="w-full flex items-center justify-center gap-2 rounded-lg bg-gold/15 text-gold hairline px-3 py-2 text-sm hover:bg-gold/25"
        >
          <Camera className="h-4 w-4" /> Pak frame als afbeelding
        </button>
        <div className="pt-2 border-t border-gold/10">
          <SaveBar
            disabled={busy}
            defaultName={`getrimd-${src.name.replace(/\.[^.]+$/, "")}.webm`}
            defaultClientId={src.clientId}
            defaultFolderId={src.folderId ?? null}
            saveLabel="Trim & opslaan"
            onSave={async ({ clientId, folderId, name }) => {
              if (trimEnd - trimStart < 0.2) {
                toast.error("Selecteer minstens 0,2 sec.");
                return;
              }
              setBusy(true);
              try {
                toast("Trimmen…", {
                  description: "Dit duurt ongeveer net zo lang als de selectie.",
                });
                const blob = await exportTrim();
                await uploadToLibrary({ blob, name, type: "video/webm", clientId, folderId });
                toast.success("Opgeslagen in mediabibliotheek");
                onClose();
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Opslaan mislukt");
              } finally {
                setBusy(false);
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}

/* ---------------- Save bar ---------------- */

function SaveBar({
  onSave,
  disabled,
  defaultName,
  defaultClientId,
  defaultFolderId,
  saveLabel = "Opslaan in bibliotheek",
}: {
  onSave: (p: { clientId: string; folderId: string | null; name: string }) => void | Promise<void>;
  disabled: boolean;
  defaultName: string;
  defaultClientId?: string;
  defaultFolderId?: string | null;
  saveLabel?: string;
}) {
  const [clientId, setClientId] = useState(defaultClientId ?? "");
  const [folderId, setFolderId] = useState<string | null>(defaultFolderId ?? null);
  const [name, setName] = useState(defaultName);
  const { data: clients } = useQuery({
    queryKey: ["admin-clients-list"],
    queryFn: async () =>
      (await supabase.from("clients").select("id,name").order("name")).data ?? [],
  });
  const { data: folders } = useQuery({
    queryKey: ["media-folders", clientId],
    enabled: !!clientId,
    queryFn: async () =>
      (await supabase.from("media_folders").select("*").eq("client_id", clientId).order("name"))
        .data ?? [],
  });
  return (
    <div className="space-y-2">
      <Field label="Bestandsnaam">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg bg-input/60 hairline px-2 py-1.5 text-sm"
        />
      </Field>
      <Field label="Klant">
        <select
          value={clientId}
          onChange={(e) => {
            setClientId(e.target.value);
            setFolderId(null);
          }}
          className="w-full rounded-lg bg-input/60 hairline px-2 py-1.5 text-sm"
        >
          <option value="">Kies klant…</option>
          {clients?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>
      {clientId && (
        <Field label="Map">
          <select
            value={folderId ?? ""}
            onChange={(e) => setFolderId(e.target.value || null)}
            className="w-full rounded-lg bg-input/60 hairline px-2 py-1.5 text-sm"
          >
            <option value="">Hoofdmap</option>
            {folders?.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </Field>
      )}
      <button
        disabled={disabled || !clientId || !name.trim()}
        onClick={() => onSave({ clientId, folderId, name: name.trim() })}
        className="w-full flex items-center justify-center gap-2 rounded-lg bg-gold/20 text-gold hairline px-3 py-2 text-sm hover:bg-gold/30 disabled:opacity-50"
      >
        {disabled ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{" "}
        {saveLabel}
      </button>
    </div>
  );
}

/* ---------------- Helpers ---------------- */

function Tab({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm hairline ${active ? "bg-gold/20 text-gold" : "bg-input/40 hover:bg-accent/40"}`}
    >
      <Icon className="h-4 w-4" /> {label}
    </button>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">{label}</div>
      {children}
    </label>
  );
}
function updateLayer(
  setLayers: React.Dispatch<React.SetStateAction<TextLayer[]>>,
  id: string,
  patch: Partial<TextLayer>,
) {
  setLayers((ls: TextLayer[]) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)));
}
function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const i = new Image();
    i.crossOrigin = "anonymous";
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = url;
  });
}
function fmt(t: number) {
  if (!isFinite(t)) return "0:00";
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

async function uploadToLibrary({
  blob,
  name,
  type,
  clientId,
  folderId,
}: {
  blob: Blob;
  name: string;
  type: string;
  clientId: string;
  folderId: string | null;
}) {
  const path = `${clientId}/${Date.now()}-${name}`;
  const { error: upErr } = await supabase.storage
    .from("client-uploads")
    .upload(path, blob, { contentType: type, upsert: false });
  if (upErr) throw upErr;
  const { data: u } = await supabase.auth.getUser();
  const { error } = await supabase.from("uploads").insert({
    client_id: clientId,
    folder_id: folderId,
    file_path: path,
    file_name: name,
    file_type: type,
    file_size: blob.size,
    uploader_id: u.user?.id ?? null,
  });
  if (error) throw error;
}
