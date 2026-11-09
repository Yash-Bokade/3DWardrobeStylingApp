import { useEffect, useRef, useState } from "react";
import { ExternalLink, LoaderCircle, Upload, UserRound, X } from "lucide-react";
import {
  DEFAULT_MODEL_FIT,
  importHumanModel,
  disposeModel,
  JOE_MODEL,
  type HumanModelFit,
  type ImportedHumanModel,
} from "../utils/modelImport";

interface Props {
  isOpen: boolean;
  model: ImportedHumanModel | null;
  fit: HumanModelFit;
  onClose: () => void;
  onImport: (model: ImportedHumanModel | null) => void;
  onFitChange: (fit: HumanModelFit) => void;
}

export function HumanModelModal({ isOpen, model, fit, onClose, onImport, onFitChange }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [creditsJoe, setCreditsJoe] = useState(true);
  const [dragging, setDragging] = useState(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !loading) onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, loading, onClose]);

  if (!isOpen) return null;
  const load = async (file?: File) => {
    if (!file || loading) return;
    setLoading(true);
    setError("");
    try {
      const object = await importHumanModel(file);
      if (!mounted.current) {
        disposeModel(object);
        return;
      }
      onImport({ name: file.name.replace(/\.(zip|glb)$/i, ""), object, creditsJoe });
      onFitChange(DEFAULT_MODEL_FIT);
    } catch (err) {
      if (mounted.current)
        setError(err instanceof Error ? err.message : "Unable to load this model.");
    } finally {
      if (mounted.current) setLoading(false);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 p-5 backdrop-blur-sm"
      onClick={() => !loading && onClose()}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="human-model-title"
        aria-busy={loading}
        className="studio-scroll max-h-[90dvh] w-full max-w-[440px] overflow-y-auto rounded-2xl border border-black/10 bg-[#faf8f5] p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserRound size={16} strokeWidth={1.5} />
            <h2 id="human-model-title" className="font-display text-base font-semibold">
              Human model
            </h2>
          </div>
          <button
            aria-label="Close human model"
            onClick={onClose}
            disabled={loading}
            className="rounded-full p-2 hover:bg-black/5 disabled:opacity-30"
          >
            <X size={15} />
          </button>
        </div>
        <div className="space-y-2 border-b border-black/10 pb-5 text-xs leading-relaxed">
          <a
            href={JOE_MODEL.url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between text-sm font-medium hover:underline"
          >
            {JOE_MODEL.title}
            <ExternalLink size={13} />
          </a>
          <p className="text-[#77716a]">
            By{" "}
            <a
              className="underline underline-offset-2"
              href={JOE_MODEL.authorUrl}
              target="_blank"
              rel="noreferrer"
            >
              {JOE_MODEL.author}
            </a>
            {" · "}
            <a
              className="underline underline-offset-2"
              href={JOE_MODEL.license}
              target="_blank"
              rel="noreferrer"
            >
              CC BY 4.0
            </a>
          </p>
          <p className="text-[#77716a]">
            Sketchfab requires sign-in to download this model. Download its GLB or glTF ZIP from the
            link above, then import it here. Joe is not bundled with this app.
          </p>
        </div>
        <button
          className={`my-5 flex w-full flex-col items-center gap-2 rounded-xl border border-dashed p-7 transition-colors ${dragging ? "border-black bg-black/5" : "border-black/20 hover:bg-black/[0.025]"}`}
          disabled={loading}
          onClick={() => input.current?.click()}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            void load(event.dataTransfer.files[0]);
          }}
        >
          {loading ? (
            <LoaderCircle size={22} strokeWidth={1.3} className="animate-spin" />
          ) : (
            <Upload size={22} strokeWidth={1.3} />
          )}
          <span className="text-xs font-medium">
            {loading ? "Loading geometry & textures…" : "Import a GLB or glTF ZIP"}
          </span>
          <span className="text-[11px] text-[#8a837b]">
            Drop a file or click to browse · up to 100 MB
          </span>
        </button>
        <input
          ref={input}
          aria-label="Import human model file"
          type="file"
          accept=".glb,.zip"
          className="hidden"
          onChange={(event) => void load(event.target.files?.[0])}
        />
        <label className="flex items-center gap-2 text-[11px] text-[#77716a]">
          <input
            type="checkbox"
            checked={creditsJoe}
            onChange={(event) => setCreditsJoe(event.target.checked)}
            className="accent-[#25231f]"
          />
          This is Joe by Arjun P Krishna — show the required credit.
        </label>
        {error && (
          <p
            role="alert"
            className="mt-3 rounded-lg bg-red-50 p-3 text-xs leading-relaxed text-red-700"
          >
            {error}
          </p>
        )}
        {model && (
          <div className="mt-5 space-y-3 border-t border-black/10 pt-4">
            <div className="flex items-center justify-between gap-3">
              <span className="truncate text-xs font-medium" title={model.name}>
                {model.name}
              </span>
              <button
                onClick={() => onImport(null)}
                className="shrink-0 text-[11px] text-[#77716a] underline underline-offset-2"
              >
                Use tailor form
              </button>
            </div>
            {(["width", "depth", "rotation"] as const).map((key) => (
              <label
                key={key}
                className="grid grid-cols-[55px_1fr_40px] items-center gap-3 text-[11px]"
              >
                <span className="capitalize text-[#77716a]">
                  {key === "rotation" ? "Facing" : key}
                </span>
                <input
                  aria-label={`Model ${key}`}
                  type="range"
                  min={key === "rotation" ? 0 : 0.7}
                  max={key === "rotation" ? 360 : 1.4}
                  step={key === "rotation" ? 5 : 0.01}
                  value={fit[key]}
                  onChange={(event) => onFitChange({ ...fit, [key]: Number(event.target.value) })}
                  className="w-full accent-[#292621]"
                />
                <span className="text-right tabular-nums">
                  {key === "rotation" ? `${fit[key]}°` : `${Math.round(fit[key] * 100)}%`}
                </span>
              </label>
            ))}
            <p className="text-[11px] leading-relaxed text-[#8a837b]">
              Your model’s original pose and PBR textures are preserved. Garments use studio-sized
              templates; an exact body fit needs matching garment meshes. Imported models stay in
              this tab, not on a server.
            </p>
          </div>
        )}
        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            disabled={loading}
            className="rounded-full bg-[#26231f] px-5 py-2 text-xs text-white hover:bg-black disabled:opacity-40"
          >
            Done
          </button>
        </div>
      </section>
    </div>
  );
}
