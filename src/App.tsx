import React, { useEffect, useRef, useState } from "react";
import { Layers, Plus, RotateCw, Shuffle, Sparkles, Sun, UserRound, X } from "lucide-react";
import { AddGarmentModal } from "./components/AddGarmentModal";
import { AtelierViewport3D } from "./components/AtelierViewport3D";
import { LightingRigPopover } from "./components/LightingRigPopover";
import { WardrobeDrawer } from "./components/WardrobeDrawer";
import { HumanModelModal } from "./components/HumanModelModal";
import {
  DEFAULT_MODEL_FIT,
  disposeModel,
  JOE_MODEL,
  type ImportedHumanModel,
} from "./utils/modelImport";
import {
  INITIAL_ENVIRONMENT,
  INITIAL_EQUIPPED,
  INITIAL_GARMENTS,
  INITIAL_SPOTLIGHTS,
} from "./data/initialWardrobe";
import {
  CameraPreset,
  EquippedOutfit,
  GarmentItem,
  StudioEnvironmentConfig,
  StudioSpotlightConfig,
} from "./types/studio";

const STORAGE_KEY_GARMENTS = "atelier_3d_wardrobe_garments_v1";
const STORAGE_KEY_EQUIPPED = "atelier_3d_wardrobe_equipped_v1";

export function App() {
  const [garments, setGarments] = useState<GarmentItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_GARMENTS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore storage errors
    }
    return INITIAL_GARMENTS;
  });

  const [equipped, setEquipped] = useState<EquippedOutfit>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_EQUIPPED);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return INITIAL_EQUIPPED;
  });

  const [selectedGarmentId, setSelectedGarmentId] = useState<string | null>(INITIAL_GARMENTS[0].id);
  const [spotlights, setSpotlights] = useState<StudioSpotlightConfig[]>(INITIAL_SPOTLIGHTS);
  const [activeSpotlightId, setActiveSpotlightId] = useState<string | null>(
    INITIAL_SPOTLIGHTS[0].id,
  );
  const [environment, setEnvironment] = useState<StudioEnvironmentConfig>(INITIAL_ENVIRONMENT);
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>(() =>
    window.innerWidth < 700 ? "mannequin" : "room",
  );
  const [humanModel, setHumanModel] = useState<ImportedHumanModel | null>(null);
  const [modelFit, setModelFit] = useState(DEFAULT_MODEL_FIT);
  const [isModelOpen, setIsModelOpen] = useState(false);
  const modelRef = useRef<ImportedHumanModel | null>(null);

  useEffect(
    () => () => {
      if (modelRef.current) disposeModel(modelRef.current.object);
    },
    [],
  );

  const handleImportModel = (model: ImportedHumanModel | null) => {
    const previous = modelRef.current;
    modelRef.current = model;
    setHumanModel(model);
    if (previous && previous !== model) disposeModel(previous.object);
    setModelFit(DEFAULT_MODEL_FIT);
    setCameraPreset("mannequin");
  };

  // Keep drawers closed by default so the 3D wardrobe & mannequin stage is completely unobstructed
  const [isWardrobeOpen, setIsWardrobeOpen] = useState(false);
  const [isLightingOpen, setIsLightingOpen] = useState(false);
  const [addModalState, setAddModalState] = useState<{
    open: boolean;
    tab: "create" | "ai-guide";
  }>({ open: false, tab: "create" });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_GARMENTS, JSON.stringify(garments));
    } catch {
      // ignore quota warnings when large data URLs are stored
    }
  }, [garments]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_EQUIPPED, JSON.stringify(equipped));
    } catch {
      // ignore
    }
  }, [equipped]);

  const handleEquipGarment = (id: string) => {
    const item = garments.find((g) => g.id === id);
    if (!item) return;
    setEquipped((prev) => ({
      ...prev,
      [item.slot]: item.id,
    }));
  };

  const handleUnequipSlot = (slot: "top" | "outerwear" | "bottom") => {
    setEquipped((prev) => ({
      ...prev,
      [slot]: null,
    }));
  };

  const handleAddGarment = (
    newItem: Omit<GarmentItem, "id" | "rackIndex" | "createdAt">,
    equipImmediately: boolean,
  ) => {
    const id = `garment-custom-${Date.now()}`;
    const created: GarmentItem = {
      ...newItem,
      id,
      rackIndex: garments.length,
      createdAt: new Date().toISOString().slice(0, 10),
    };
    setGarments((prev) => [created, ...prev]);
    setSelectedGarmentId(id);
    if (equipImmediately) {
      setEquipped((prev) => ({
        ...prev,
        [created.slot]: created.id,
      }));
      setCameraPreset("mannequin");
    } else {
      setCameraPreset("rack");
    }
  };

  const handleUpdateGarment = (id: string, patch: Partial<GarmentItem>) => {
    setGarments((prev) => prev.map((g) => (g.id === id ? { ...g, ...patch } : g)));
  };

  const handleDeleteGarment = (id: string) => {
    setGarments((prev) => prev.filter((g) => g.id !== id));
    setEquipped((prev) => ({
      top: prev.top === id ? null : prev.top,
      outerwear: prev.outerwear === id ? null : prev.outerwear,
      bottom: prev.bottom === id ? null : prev.bottom,
    }));
    if (selectedGarmentId === id) {
      setSelectedGarmentId(null);
    }
  };

  const handleShuffleOutfit = () => {
    const tops = garments.filter((g) => g.slot === "top");
    const outers = garments.filter((g) => g.slot === "outerwear");
    const bottoms = garments.filter((g) => g.slot === "bottom");

    const randomPick = <T,>(arr: T[]): T | null =>
      arr.length > 0 ? arr[Math.floor(Math.random() * arr.length)] : null;

    const nextTop = randomPick(tops);
    const nextOuter = Math.random() > 0.35 ? randomPick(outers) : null;
    const nextBottom = randomPick(bottoms);

    setEquipped({
      top: nextTop?.id || null,
      outerwear: nextOuter?.id || null,
      bottom: nextBottom?.id || null,
    });
  };

  const handleUpdateSpotlight = (id: string, patch: Partial<StudioSpotlightConfig>) => {
    setSpotlights((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  const handleUpdateSpotlightPosition = (id: string, position: [number, number, number]) => {
    setSpotlights((prev) => prev.map((s) => (s.id === id ? { ...s, position } : s)));
  };

  const handleAddSpotlight = () => {
    if (spotlights.length >= 4) return;
    const idx = spotlights.length + 1;
    const newSpot: StudioSpotlightConfig = {
      id: `spot-custom-${Date.now()}`,
      name: `Accent Spot ${String.fromCharCode(64 + idx)}`,
      enabled: true,
      position: [0.2, 3.4, 2.5],
      target: [1.1, 1.3, 0.1],
      intensity: 68,
      kelvin: 3800,
      angleDeg: 35,
      penumbra: 0.7,
      showCone: true,
    };
    setSpotlights((prev) => [...prev, newSpot]);
    setActiveSpotlightId(newSpot.id);
  };

  const handleRemoveSpotlight = (id: string) => {
    setSpotlights((prev) => {
      const next = prev.filter((s) => s.id !== id);
      if (activeSpotlightId === id && next.length > 0) {
        setActiveSpotlightId(next[0].id);
      }
      return next;
    });
  };

  const equippedTop = garments.find((g) => g.id === equipped.top) || null;
  const equippedOuter = garments.find((g) => g.id === equipped.outerwear) || null;
  const equippedBottom = garments.find((g) => g.id === equipped.bottom) || null;

  return (
    <main className="relative w-screen h-dvh overflow-hidden select-none bg-[#F5F3EF]">
      {/* Fullscreen Interactive Three.js 3D Atelier Stage */}
      <AtelierViewport3D
        garments={garments}
        equipped={equipped}
        selectedGarmentId={selectedGarmentId}
        activeSpotlightId={activeSpotlightId}
        isLightingPanelOpen={isLightingOpen}
        spotlights={spotlights}
        environment={environment}
        cameraPreset={cameraPreset}
        humanModel={humanModel}
        modelFit={modelFit}
        onSelectGarment={setSelectedGarmentId}
        onEquipGarment={handleEquipGarment}
        onUnequipSlot={handleUnequipSlot}
        onSelectSpotlight={(id) => {
          setActiveSpotlightId(id);
          setIsLightingOpen(true);
        }}
        onUpdateSpotlightPosition={handleUpdateSpotlightPosition}
        onCameraMovedManually={() => setCameraPreset("free")}
      />

      {/* Ultra-Minimal Floating Studio Top Bar */}
      <header className="fixed top-4 left-5 right-5 z-20 flex items-center justify-between pointer-events-none">
        {/* Left: Minimal Brand + Archive Toggle */}
        <div className="pointer-events-auto flex items-center gap-2">
          <div className="px-3.5 py-1.5 rounded-full bg-white/75 backdrop-blur-md border border-[#141413]/8 text-xs font-display font-semibold tracking-wider text-[#141413]">
            ATELIER
          </div>

          <button
            type="button"
            onClick={() => setIsWardrobeOpen((prev) => !prev)}
            aria-label="Wardrobe archive"
            className={`px-3.5 py-1.5 rounded-full backdrop-blur-md border text-xs font-medium transition-all flex items-center gap-1.5 ${
              isWardrobeOpen
                ? "bg-[#141413] text-[#F5F3EF] border-[#141413]"
                : "bg-white/75 text-[#141413] border-[#141413]/8 hover:bg-white"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Archive ({garments.length})</span>
            <span className="sm:hidden">{garments.length}</span>
          </button>
        </div>

        {/* Center: Clean Camera View Switcher */}
        <div className="pointer-events-auto hidden md:flex items-center gap-0.5 p-1 rounded-full bg-white/75 backdrop-blur-md border border-[#141413]/8">
          {(
            [
              { id: "room", label: "Studio" },
              { id: "mannequin", label: "Mannequin" },
              { id: "rack", label: "Rack" },
            ] as const
          ).map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => setCameraPreset(preset.id)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                cameraPreset === preset.id
                  ? "bg-[#141413] text-[#F5F3EF]"
                  : "text-[#686662] hover:text-[#141413]"
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>

        {/* Right: Minimal Actions */}
        <div className="pointer-events-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setIsModelOpen(true)}
            aria-label="Human model"
            title="Import the Joe human model"
            className="flex items-center gap-1.5 rounded-full border border-[#141413]/8 bg-white/75 px-3 py-1.5 text-xs font-medium text-[#141413] backdrop-blur-md transition-all hover:bg-white"
          >
            <UserRound className="h-3.5 w-3.5" />
            <span className="hidden lg:inline">Model</span>
          </button>
          <button
            type="button"
            onClick={() => setAddModalState({ open: true, tab: "ai-guide" })}
            className="px-3 py-1.5 rounded-full bg-white/75 backdrop-blur-md border border-[#141413]/8 text-xs font-medium text-[#141413] hover:bg-white transition-all flex items-center gap-1.5"
            title="Recommended Free AI Models"
            aria-label="Recommended Free AI Models"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#D96B27]" />
            <span className="hidden sm:inline">AI</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (!isLightingOpen) setCameraPreset("room");
              setIsLightingOpen((prev) => !prev);
            }}
            aria-label="Studio lights"
            className={`px-3 py-1.5 rounded-full backdrop-blur-md border text-xs font-medium transition-all flex items-center gap-1.5 ${
              isLightingOpen
                ? "bg-[#141413] text-[#F5F3EF] border-[#141413]"
                : "bg-white/75 text-[#141413] border-[#141413]/8 hover:bg-white"
            }`}
          >
            <Sun className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Lights</span>
          </button>

          <button
            type="button"
            onClick={() => setAddModalState({ open: true, tab: "create" })}
            className="px-3.5 py-1.5 rounded-full bg-[#141413] text-[#F5F3EF] hover:bg-[#292927] text-xs font-medium transition-all flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Add Cloth</span>
            <span className="sm:hidden">Add</span>
          </button>
        </div>
      </header>

      <nav
        aria-label="Camera view"
        className="fixed bottom-17 left-1/2 z-20 flex -translate-x-1/2 gap-1 rounded-full border border-black/8 bg-white/75 p-1 backdrop-blur-md md:hidden"
      >
        {(
          [
            { id: "room", label: "Studio" },
            { id: "mannequin", label: "Mannequin" },
            { id: "rack", label: "Rack" },
          ] as const
        ).map((preset) => (
          <button
            key={preset.id}
            onClick={() => setCameraPreset(preset.id)}
            className={`rounded-full px-3 py-1.5 text-[11px] ${cameraPreset === preset.id ? "bg-[#25231f] text-white" : "text-[#77716a]"}`}
          >
            {preset.label}
          </button>
        ))}
      </nav>

      {/* Left Floating Wardrobe Archive Drawer */}
      <WardrobeDrawer
        isOpen={isWardrobeOpen}
        garments={garments}
        equipped={equipped}
        selectedGarmentId={selectedGarmentId}
        onToggleOpen={() => setIsWardrobeOpen((prev) => !prev)}
        onSelectGarment={setSelectedGarmentId}
        onEquipGarment={handleEquipGarment}
        onUnequipSlot={handleUnequipSlot}
        onUpdateGarment={handleUpdateGarment}
        onDeleteGarment={handleDeleteGarment}
        onOpenAddModal={() => setAddModalState({ open: true, tab: "create" })}
      />

      {/* Right Floating Studio Lighting Rig Popover */}
      <LightingRigPopover
        isOpen={isLightingOpen}
        spotlights={spotlights}
        activeSpotlightId={activeSpotlightId}
        environment={environment}
        onClose={() => setIsLightingOpen(false)}
        onSelectSpotlight={setActiveSpotlightId}
        onUpdateSpotlight={handleUpdateSpotlight}
        onAddSpotlight={handleAddSpotlight}
        onRemoveSpotlight={handleRemoveSpotlight}
        onResetLighting={() => {
          setSpotlights(INITIAL_SPOTLIGHTS);
          setEnvironment(INITIAL_ENVIRONMENT);
        }}
        onUpdateEnvironment={(patch) => setEnvironment((prev) => ({ ...prev, ...patch }))}
      />

      {/* Minimal Bottom Center Outfit Pill */}
      <footer className="fixed bottom-4 left-1/2 -translate-x-1/2 z-20 max-w-[95vw]">
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-white/78 backdrop-blur-xl border border-[#141413]/8 shadow-sm">
          {(
            [
              { slot: "top", label: "Top", item: equippedTop },
              { slot: "outerwear", label: "Outer", item: equippedOuter },
              { slot: "bottom", label: "Bottom", item: equippedBottom },
            ] as const
          ).map(({ slot, label, item }) => (
            <div
              key={slot}
              onClick={() => item && setSelectedGarmentId(item.id)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs transition-all ${
                item
                  ? "bg-white/90 border border-[#141413]/10 cursor-pointer"
                  : "text-[#686662] px-2"
              }`}
            >
              {item ? (
                <>
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="hidden max-w-[96px] truncate font-medium text-[#141413] sm:inline">
                    {item.name}
                  </span>
                  <span className="text-[11px] sm:hidden">{label}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleUnequipSlot(slot);
                    }}
                    title={`Remove ${item.name}`}
                    className="text-[#686662] hover:text-[#141413]"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </>
              ) : (
                <span className="text-[11px] text-[#8C8982]">{label}</span>
              )}
            </div>
          ))}

          <div className="h-3.5 w-px bg-[#141413]/10 mx-0.5" />

          <button
            type="button"
            onClick={handleShuffleOutfit}
            title="Shuffle outfit"
            className="p-1.5 rounded-full text-[#686662] hover:text-[#141413] hover:bg-[#141413]/6 transition-colors"
          >
            <Shuffle className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() =>
              setEnvironment((prev) => ({
                ...prev,
                mannequinPose: prev.mannequinPose === "turntable" ? "editorial" : "turntable",
              }))
            }
            title="Toggle 360° Mannequin Turntable"
            className={`p-1.5 rounded-full transition-colors ${
              environment.mannequinPose === "turntable"
                ? "bg-[#141413] text-[#F5F3EF]"
                : "text-[#686662] hover:text-[#141413] hover:bg-[#141413]/6"
            }`}
          >
            <RotateCw
              className={`w-3.5 h-3.5 ${
                environment.mannequinPose === "turntable" ? "animate-spin" : ""
              }`}
            />
          </button>
        </div>
      </footer>

      {humanModel?.creditsJoe && (
        <a
          href={JOE_MODEL.url}
          target="_blank"
          rel="noreferrer"
          className="fixed bottom-16 right-5 z-10 text-[10px] text-[#77716a] underline decoration-black/20 underline-offset-4"
          title="Joe by Arjun P Krishna, CC BY 4.0. Display scale and rotation adjusted."
        >
          Joe · Arjun P Krishna · CC BY 4.0
        </a>
      )}

      <HumanModelModal
        isOpen={isModelOpen}
        model={humanModel}
        fit={modelFit}
        onClose={() => setIsModelOpen(false)}
        onImport={handleImportModel}
        onFitChange={setModelFit}
      />

      {/* Add Garment Photo & Free AI Stack Modal */}
      <AddGarmentModal
        isOpen={addModalState.open}
        initialTab={addModalState.tab}
        onClose={() => setAddModalState((prev) => ({ ...prev, open: false }))}
        onAddGarment={handleAddGarment}
      />
    </main>
  );
}

export default App;
