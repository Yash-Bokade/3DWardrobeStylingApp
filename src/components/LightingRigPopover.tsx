import React from "react";
import { Eye, EyeOff, Lightbulb, Plus, RotateCcw, Sun, Trash2, X } from "lucide-react";
import { StudioEnvironmentConfig, StudioSpotlightConfig } from "../types/studio";
import { kelvinToHex } from "../utils/fabricTextures";

interface LightingRigPopoverProps {
  isOpen: boolean;
  spotlights: StudioSpotlightConfig[];
  activeSpotlightId: string | null;
  environment: StudioEnvironmentConfig;
  onClose: () => void;
  onSelectSpotlight: (id: string) => void;
  onUpdateSpotlight: (id: string, patch: Partial<StudioSpotlightConfig>) => void;
  onAddSpotlight: () => void;
  onRemoveSpotlight: (id: string) => void;
  onResetLighting: () => void;
  onUpdateEnvironment: (patch: Partial<StudioEnvironmentConfig>) => void;
}

export const LightingRigPopover: React.FC<LightingRigPopoverProps> = ({
  isOpen,
  spotlights,
  activeSpotlightId,
  environment,
  onClose,
  onSelectSpotlight,
  onUpdateSpotlight,
  onAddSpotlight,
  onRemoveSpotlight,
  onResetLighting,
  onUpdateEnvironment,
}) => {
  if (!isOpen) return null;

  const activeLight = spotlights.find((s) => s.id === activeSpotlightId) || spotlights[0] || null;

  return (
    <aside className="fixed top-20 right-5 z-20 w-80 max-h-[calc(100dvh-148px)] rounded-2xl bg-white/82 backdrop-blur-xl border border-[#141413]/10 shadow-xl flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#141413]/8">
        <div className="flex items-center gap-2">
          <Sun className="w-4 h-4 text-[#D96B27]" />
          <span className="text-xs font-display font-semibold tracking-tight text-[#141413]">
            3D Studio Lighting Rig
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onResetLighting}
            title="Reset default rig"
            className="p-1.5 rounded-lg text-[#686662] hover:text-[#141413] hover:bg-[#141413]/5 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#686662] hover:text-[#141413] hover:bg-[#141413]/5 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="p-4 overflow-y-auto studio-scroll space-y-4">
        {/* Architectural Room Backdrop & Gizmo Visibility */}
        <div className="space-y-2.5 pb-3 border-b border-[#141413]/8">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#686662]">
              Studio Backdrop Tone
            </span>
            <button
              type="button"
              onClick={() => onUpdateEnvironment({ showLightGizmos: !environment.showLightGizmos })}
              className="flex items-center gap-1 text-[10px] font-mono-tech text-[#141413] px-2 py-0.5 rounded bg-[#141413]/6 hover:bg-[#141413]/12"
            >
              {environment.showLightGizmos ? (
                <>
                  <Eye className="w-3 h-3 text-[#D96B27]" /> 3D Lamps Visible
                </>
              ) : (
                <>
                  <EyeOff className="w-3 h-3 text-[#686662]" /> 3D Lamps Hidden
                </>
              )}
            </button>
          </div>

          <div className="grid grid-cols-3 gap-1.5">
            {(
              [
                { id: "warm-plaster", label: "Plaster", swatch: "#F5F3EF" },
                { id: "concrete-gallery", label: "Concrete", swatch: "#DFE1E3" },
                { id: "obsidian-noir", label: "Noir Dark", swatch: "#18181A" },
              ] as const
            ).map((tone) => (
              <button
                key={tone.id}
                type="button"
                onClick={() => onUpdateEnvironment({ roomTone: tone.id })}
                className={`px-2 py-1.5 rounded-lg border text-[11px] font-medium flex items-center gap-1.5 transition-all ${
                  environment.roomTone === tone.id
                    ? "border-[#141413] bg-[#141413] text-[#F5F3EF]"
                    : "border-[#141413]/10 bg-white/70 text-[#141413] hover:border-[#141413]/30"
                }`}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full border border-black/20 shrink-0"
                  style={{ backgroundColor: tone.swatch }}
                />
                <span className="truncate">{tone.label}</span>
              </button>
            ))}
          </div>

          <div>
            <div className="flex justify-between text-[11px] mt-1">
              <span className="text-[#686662]">Ambient Fill Light</span>
              <span className="font-mono-tech text-[#141413]">
                {Math.round(environment.ambientIntensity * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={0.15}
              max={1.6}
              step={0.05}
              value={environment.ambientIntensity}
              onChange={(e) =>
                onUpdateEnvironment({ ambientIntensity: parseFloat(e.target.value) })
              }
              className="w-full accent-[#141413] h-1.5"
            />
          </div>
        </div>

        {/* Spotlight Selector Pills + Add New Spotlight */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#686662]">
              Track Spotlights (Drag in 3D or Sliders)
            </span>
            {spotlights.length < 4 && (
              <button
                type="button"
                onClick={onAddSpotlight}
                className="flex items-center gap-1 text-[11px] font-semibold text-[#D96B27] hover:underline"
              >
                <Plus className="w-3 h-3" /> Add Spot
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {spotlights.map((sp) => {
              const isSelected = activeLight?.id === sp.id;
              const hex = kelvinToHex(sp.kelvin);
              return (
                <button
                  key={sp.id}
                  type="button"
                  onClick={() => onSelectSpotlight(sp.id)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 border transition-all ${
                    isSelected
                      ? "bg-[#141413] text-[#F5F3EF] border-[#141413]"
                      : "bg-white/75 text-[#141413] border-[#141413]/10 hover:border-[#141413]/30"
                  }`}
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{
                      backgroundColor: sp.enabled ? hex : "#999",
                      boxShadow: sp.enabled ? `0 0 6px ${hex}` : "none",
                    }}
                  />
                  <span>{sp.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Active Spotlight Controls */}
        {activeLight && (
          <div className="p-3 rounded-xl bg-[#F5F3EF]/85 border border-[#141413]/8 space-y-3">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-xs font-semibold text-[#141413] cursor-pointer">
                <input
                  type="checkbox"
                  checked={activeLight.enabled}
                  onChange={(e) => onUpdateSpotlight(activeLight.id, { enabled: e.target.checked })}
                  className="accent-[#D96B27] rounded"
                />
                <Lightbulb className="w-3.5 h-3.5 text-[#D96B27]" />
                <span>{activeLight.name}</span>
              </label>

              {spotlights.length > 1 && (
                <button
                  type="button"
                  onClick={() => onRemoveSpotlight(activeLight.id)}
                  className="p-1 rounded text-[#686662] hover:text-red-600 transition-colors"
                  title="Delete spotlight"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Intensity & Kelvin */}
            <div className="space-y-2">
              <div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-[#686662]">Output Intensity</span>
                  <span className="font-mono-tech text-[#141413]">
                    {Math.round((activeLight.intensity / 140) * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={140}
                  step={2}
                  value={activeLight.intensity}
                  onChange={(e) =>
                    onUpdateSpotlight(activeLight.id, { intensity: parseFloat(e.target.value) })
                  }
                  className="w-full accent-[#141413] h-1.5"
                />
              </div>

              <div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-[#686662]">Color Temp (Warm ↔ Cool)</span>
                  <span className="font-mono-tech text-[#141413]">{activeLight.kelvin}K</span>
                </div>
                <input
                  type="range"
                  min={2700}
                  max={6500}
                  step={100}
                  value={activeLight.kelvin}
                  onChange={(e) =>
                    onUpdateSpotlight(activeLight.id, { kelvin: parseInt(e.target.value, 10) })
                  }
                  className="w-full accent-[#D96B27] h-1.5"
                />
              </div>

              <div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-[#686662]">Beam Cone Angle</span>
                  <span className="font-mono-tech text-[#141413]">{activeLight.angleDeg}°</span>
                </div>
                <input
                  type="range"
                  min={18}
                  max={65}
                  step={1}
                  value={activeLight.angleDeg}
                  onChange={(e) =>
                    onUpdateSpotlight(activeLight.id, { angleDeg: parseInt(e.target.value, 10) })
                  }
                  className="w-full accent-[#141413] h-1.5"
                />
              </div>
            </div>

            {/* 3D Position Sliders (X, Y, Z) */}
            <div className="pt-2 border-t border-[#141413]/8 space-y-1.5">
              <div className="text-[10px] font-mono-tech uppercase text-[#686662]">
                3D Coordinates (Or drag lamp directly in scene)
              </div>
              {(["X", "Y", "Z"] as const).map((axis, idx) => {
                const min = idx === 1 ? 0.8 : -3.2;
                const max = idx === 1 ? 4.2 : 3.5;
                return (
                  <div key={axis} className="flex items-center gap-2">
                    <span className="w-4 text-[11px] font-mono-tech font-semibold text-[#141413]">
                      {axis}
                    </span>
                    <input
                      type="range"
                      min={min}
                      max={max}
                      step={0.05}
                      value={activeLight.position[idx]}
                      onChange={(e) => {
                        const nextPos: [number, number, number] = [...activeLight.position];
                        nextPos[idx] = parseFloat(e.target.value);
                        onUpdateSpotlight(activeLight.id, { position: nextPos });
                      }}
                      className="flex-1 accent-[#141413] h-1.5"
                    />
                    <span className="w-10 text-right text-[10px] font-mono-tech text-[#686662]">
                      {activeLight.position[idx].toFixed(1)}m
                    </span>
                  </div>
                );
              })}

              {/* Quick Aim Target Preset */}
              <div className="flex items-center justify-between pt-1.5">
                <span className="text-[10px] text-[#686662]">Aim Spotlight At:</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onUpdateSpotlight(activeLight.id, { target: [1.12, 1.35, 0.1] })}
                    className="px-2 py-0.5 rounded bg-white border border-[#141413]/12 text-[10px] font-medium hover:bg-[#141413] hover:text-white transition-colors"
                  >
                    Mannequin
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateSpotlight(activeLight.id, { target: [-1.28, 1.4, -0.15] })
                    }
                    className="px-2 py-0.5 rounded bg-white border border-[#141413]/12 text-[10px] font-medium hover:bg-[#141413] hover:text-white transition-colors"
                  >
                    Wardrobe
                  </button>
                  <button
                    type="button"
                    onClick={() => onUpdateSpotlight(activeLight.id, { target: [0, 1.2, 0] })}
                    className="px-2 py-0.5 rounded bg-white border border-[#141413]/12 text-[10px] font-medium hover:bg-[#141413] hover:text-white transition-colors"
                  >
                    Center
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
