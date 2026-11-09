import React, { useState } from "react";
import { Check, Plus, Trash2, X } from "lucide-react";
import { EquippedOutfit, GarmentCategory, GarmentItem } from "../types/studio";

interface WardrobeDrawerProps {
  isOpen: boolean;
  garments: GarmentItem[];
  equipped: EquippedOutfit;
  selectedGarmentId: string | null;
  onToggleOpen: () => void;
  onSelectGarment: (id: string) => void;
  onEquipGarment: (id: string) => void;
  onUnequipSlot: (slot: "top" | "outerwear" | "bottom") => void;
  onUpdateGarment: (id: string, patch: Partial<GarmentItem>) => void;
  onDeleteGarment: (id: string) => void;
  onOpenAddModal: () => void;
}

export const WardrobeDrawer: React.FC<WardrobeDrawerProps> = ({
  isOpen,
  garments,
  equipped,
  selectedGarmentId,
  onToggleOpen,
  onSelectGarment,
  onEquipGarment,
  onUnequipSlot,
  onUpdateGarment,
  onDeleteGarment,
  onOpenAddModal,
}) => {
  const [filter, setFilter] = useState<"all" | GarmentCategory>("all");

  const equippedSet = new Set(
    [equipped.top, equipped.outerwear, equipped.bottom].filter(Boolean) as string[],
  );

  const filteredGarments = garments.filter((g) =>
    filter === "all" ? true : g.category === filter,
  );

  const selectedItem = garments.find((g) => g.id === selectedGarmentId) || null;

  return (
    <aside
      aria-hidden={!isOpen}
      inert={!isOpen}
      className={`fixed top-18 left-5 z-20 w-68 max-h-[calc(100dvh-140px)] rounded-2xl bg-white/85 backdrop-blur-xl border border-[#141413]/8 shadow-lg flex flex-col overflow-hidden transition-all duration-200 ${
        isOpen
          ? "opacity-100 translate-x-0 pointer-events-auto"
          : "opacity-0 -translate-x-4 pointer-events-none"
      }`}
    >
      {/* Minimal Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#141413]/6">
        <span className="text-xs font-display font-semibold tracking-tight text-[#141413]">
          Archive ({garments.length})
        </span>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onOpenAddModal}
            title="Add new garment"
            className="p-1.5 rounded-lg text-[#141413] hover:bg-[#141413]/6 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onToggleOpen}
            title="Close archive"
            className="p-1.5 rounded-lg text-[#686662] hover:text-[#141413] hover:bg-[#141413]/6 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Category Filter Pills */}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-[#141413]/5 overflow-x-auto">
        {(
          [
            { id: "all", label: "All" },
            { id: "tshirt", label: "Tees" },
            { id: "shirt", label: "Shirts" },
            { id: "jacket", label: "Jackets" },
            { id: "pants", label: "Pants" },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setFilter(tab.id)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all shrink-0 ${
              filter === tab.id
                ? "bg-[#141413] text-[#F5F3EF]"
                : "text-[#686662] hover:text-[#141413]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Garment List */}
      <div className="flex-1 overflow-y-auto studio-scroll p-2 space-y-1">
        {filteredGarments.map((item) => {
          const isWorn = equippedSet.has(item.id);
          const isSelected = item.id === selectedGarmentId;

          return (
            <div
              key={item.id}
              onClick={() => onSelectGarment(item.id)}
              className={`group px-2.5 py-2 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2 ${
                isSelected
                  ? "bg-white border-[#141413]/25 shadow-xs"
                  : "bg-transparent border-transparent hover:bg-white/70"
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className="w-7 h-7 rounded-lg border border-black/15 shrink-0 overflow-hidden flex items-center justify-center"
                  style={{ backgroundColor: item.color }}
                >
                  {item.textureDataUrl && (
                    <img
                      src={item.textureDataUrl}
                      alt={item.name}
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>

                <div className="min-w-0">
                  <div className="text-xs font-medium text-[#141413] truncate">{item.name}</div>
                  <div className="text-[10px] text-[#686662] capitalize">{item.category}</div>
                </div>
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (isWorn) {
                    onUnequipSlot(item.slot);
                  } else {
                    onEquipGarment(item.id);
                  }
                }}
                className={`px-2 py-1 rounded-lg text-[10px] font-medium transition-all shrink-0 flex items-center gap-1 ${
                  isWorn
                    ? "bg-[#141413] text-[#F5F3EF]"
                    : "bg-[#141413]/6 text-[#141413] hover:bg-[#141413] hover:text-[#F5F3EF]"
                }`}
              >
                {isWorn ? (
                  <>
                    <Check className="w-2.5 h-2.5" /> Worn
                  </>
                ) : (
                  "Wear"
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* Minimal Material Footer for Selected Piece */}
      {selectedItem && (
        <div className="px-3.5 py-2.5 bg-[#F5F3EF]/80 border-t border-[#141413]/8 flex items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-[11px] font-medium text-[#141413] cursor-pointer">
            <input
              type="color"
              value={selectedItem.color}
              onChange={(e) => onUpdateGarment(selectedItem.id, { color: e.target.value })}
              className="w-4 h-4 rounded-full cursor-pointer border-0 bg-transparent"
            />
            <span className="truncate max-w-[120px]">{selectedItem.name}</span>
          </label>

          {garments.length > 2 && (
            <button
              type="button"
              onClick={() => onDeleteGarment(selectedItem.id)}
              className="text-[#686662] hover:text-red-600 transition-colors"
              title="Delete piece"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}
    </aside>
  );
};
