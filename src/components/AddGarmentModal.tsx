import React, { useRef, useState } from 'react';
import {
  Check,
  Copy,
  Cpu,
  ImagePlus,
  Layers,
  Sparkles,
  Upload,
  Wand2,
  X,
} from 'lucide-react';
import { GarmentCategory, GarmentItem } from '../types/studio';
import { processUploadedGarmentPhoto } from '../utils/fabricTextures';

interface AddGarmentModalProps {
  isOpen: boolean;
  initialTab?: 'create' | 'ai-guide';
  onClose: () => void;
  onAddGarment: (garment: Omit<GarmentItem, 'id' | 'rackIndex' | 'createdAt'>, equipImmediately: boolean) => void;
}

const CATEGORY_OPTIONS: {
  id: GarmentCategory;
  label: string;
  slot: 'top' | 'outerwear' | 'bottom';
  desc: string;
}[] = [
  { id: 'tshirt', label: 'T-Shirt', slot: 'top', desc: 'Boxy crew or graphic tee' },
  { id: 'shirt', label: 'Shirt', slot: 'top', desc: 'Button-down poplin or oxford' },
  { id: 'jacket', label: 'Jacket', slot: 'outerwear', desc: 'Outerwear layer over tops' },
  { id: 'pants', label: 'Pants', slot: 'bottom', desc: 'Trousers, denim, or cargos' },
];

const FREE_AI_STACK = [
  {
    badge: '100% FREE • IN-BROWSER WASM',
    title: '1. Auto Garment Cutout: @imgly/background-removal (or RMBG-1.4)',
    why: 'Runs directly in the browser via WebAssembly/WebGPU with zero API keys, zero server costs, and instant transparent PNG extraction from phone photos of your clothes.',
    installCmd: 'pnpm add @imgly/background-removal',
    snippet: `import { removeBackground } from '@imgly/background-removal';

// Pass any user-uploaded shirt/pants photo File:
const transparentBlob = await removeBackground(imageFile);
const cleanTextureUrl = URL.createObjectURL(transparentBlob);`,
  },
  {
    badge: 'FREE API • SINGLE PHOTO → 3D .GLB MESH',
    title: '2. Photo to True 3D Mesh: TripoSR / TRELLIS / InstantMesh (Hugging Face Spaces)',
    why: 'Turns a single flat photo of your shirt, jacket, or pants into a full 360° textured .glb 3D model in ~4 seconds using the free @gradio/client SDK against public Hugging Face Spaces.',
    installCmd: 'pnpm add @gradio/client',
    snippet: `import { Client } from '@gradio/client';

// Connect to free TripoSR or TRELLIS Hugging Face Space:
const app = await Client.connect('stabilityai/TripoSR');
const result = await app.predict('/run', [garmentImageBlob]);
const glbModelUrl = result.data[0].url; // Load with THREE.GLTFLoader()`,
  },
  {
    badge: 'FREE TIER API • AUTO TAGGING & STYLING',
    title: '3. Smart Garment Classifier & Stylist: Google Gemini 2.5 Flash (Google AI Studio)',
    why: 'Generous free tier (1,500 requests/day free in Google AI Studio). Drop a photo of any garment and Gemini automatically detects category, fabric weave, hex color, and outfit combinations.',
    installCmd: 'pnpm add @google/genai',
    snippet: `// Prompt Gemini 2.5 Flash with your garment photo:
"Return JSON with { name, category: 'tshirt'|'shirt'|'jacket'|'pants', dominantHex, fabricRoughness }"`,
  },
];

export const AddGarmentModal: React.FC<AddGarmentModalProps> = ({
  isOpen,
  initialTab = 'create',
  onClose,
  onAddGarment,
}) => {
  const [activeTab, setActiveTab] = useState<'create' | 'ai-guide'>(initialTab);
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('PERSONAL ARCHIVE');
  const [category, setCategory] = useState<GarmentCategory>('tshirt');
  const [color, setColor] = useState('#232528');
  const [secondaryColor, setSecondaryColor] = useState('#EAE6DF');
  const [roughness, setRoughness] = useState(0.8);
  const [patternType, setPatternType] = useState<GarmentItem['patternType']>('solid');
  const [textureDataUrl, setTextureDataUrl] = useState<string | undefined>(undefined);
  const [autoCutout, setAutoCutout] = useState(true);
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
  const [equipImmediately, setEquipImmediately] = useState(true);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingPhoto(true);
    try {
      const { dataUrl, dominantHex } = await processUploadedGarmentPhoto(file, autoCutout);
      setTextureDataUrl(dataUrl);
      setColor(dominantHex);
      if (!name.trim()) {
        const baseName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
        setName(baseName.charAt(0).toUpperCase() + baseName.slice(1));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessingPhoto(false);
    }
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const selectedCat = CATEGORY_OPTIONS.find((c) => c.id === category)!;
    const finalName =
      name.trim() ||
      `Custom ${selectedCat.label} #${Math.floor(100 + Math.random() * 899)}`;

    onAddGarment(
      {
        name: finalName,
        brand: brand.trim() || 'ATELIER',
        category,
        slot: selectedCat.slot,
        color,
        secondaryColor,
        roughness,
        patternType,
        textureDataUrl,
        notes: textureDataUrl
          ? 'Custom photo-mapped 3D garment mesh.'
          : 'Procedural tailored 3D studio piece.',
      },
      equipImmediately
    );

    // Reset form
    setName('');
    setTextureDataUrl(undefined);
    onClose();
  };

  const copySnippet = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 1800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#141413]/45 backdrop-blur-md p-4">
      <div className="relative w-full max-w-2xl rounded-2xl bg-[#FAF8F5] border border-[#141413]/12 shadow-2xl overflow-hidden flex flex-col max-h-[88dvh]">
        {/* Modal Header + Tab Switcher */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#141413]/10 bg-white/70">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('create')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                activeTab === 'create'
                  ? 'bg-[#141413] text-[#F5F3EF] shadow-sm'
                  : 'text-[#686662] hover:text-[#141413] hover:bg-[#141413]/5'
              }`}
            >
              <ImagePlus className="w-3.5 h-3.5" />
              Digitize Cloth into 3D
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('ai-guide')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                activeTab === 'ai-guide'
                  ? 'bg-[#D96B27] text-white shadow-sm'
                  : 'text-[#686662] hover:text-[#141413] hover:bg-[#141413]/5'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              Recommended Free AI Models
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#686662] hover:text-[#141413] hover:bg-[#141413]/5 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab 1: Add New Garment from Photo or Studio Preset */}
        {activeTab === 'create' ? (
          <form
            onSubmit={handleCreateSubmit}
            className="p-6 overflow-y-auto studio-scroll space-y-5"
          >
            <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
              {/* Left Column: Photo Upload Dropzone */}
              <div className="md:col-span-5 flex flex-col gap-3">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-[#686662]">
                  Garment Photo (Optional)
                </label>

                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="relative group cursor-pointer rounded-xl border-2 border-dashed border-[#141413]/15 hover:border-[#D96B27] bg-[#F2EFE9]/70 transition-all h-52 flex flex-col items-center justify-center p-4 text-center overflow-hidden"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />

                  {textureDataUrl ? (
                    <>
                      <img
                        src={textureDataUrl}
                        alt="Uploaded garment preview"
                        className="w-full h-full object-contain rounded-lg"
                      />
                      <div className="absolute inset-0 bg-[#141413]/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-xs font-medium text-white">
                        Click to replace photo
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center mb-2.5 text-[#141413] group-hover:scale-105 transition-transform">
                        <Upload className="w-4 h-4 text-[#D96B27]" />
                      </div>
                      <p className="text-xs font-medium text-[#141413]">
                        Upload photo of your Shirt, Tee, or Pants
                      </p>
                      <p className="text-[11px] text-[#686662] mt-1">
                        Maps directly onto the 3D garment mesh & extracts fabric tone
                      </p>
                    </>
                  )}

                  {isProcessingPhoto && (
                    <div className="absolute inset-0 bg-white/85 backdrop-blur-sm flex items-center justify-center text-xs font-mono-tech text-[#141413]">
                      Extracting garment texture...
                    </div>
                  )}
                </div>

                {/* Smart Cutout Toggle */}
                <label className="flex items-center justify-between px-3 py-2 rounded-lg bg-white border border-[#141413]/8 text-xs cursor-pointer">
                  <span className="flex items-center gap-1.5 text-[#141413] font-medium">
                    <Wand2 className="w-3.5 h-3.5 text-[#D96B27]" />
                    Smart Backdrop Cutout
                  </span>
                  <input
                    type="checkbox"
                    checked={autoCutout}
                    onChange={(e) => setAutoCutout(e.target.checked)}
                    className="accent-[#141413] rounded"
                  />
                </label>

                {textureDataUrl && (
                  <button
                    type="button"
                    onClick={() => setTextureDataUrl(undefined)}
                    className="text-[11px] text-[#686662] hover:text-[#141413] underline text-left"
                  >
                    Clear uploaded photo & use procedural weave
                  </button>
                )}
              </div>

              {/* Right Column: 3D Silhouette & Material Parameters */}
              <div className="md:col-span-7 space-y-4">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#686662] mb-1.5">
                    3D Garment Silhouette
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {CATEGORY_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setCategory(opt.id)}
                        className={`p-2.5 rounded-xl border text-left transition-all ${
                          category === opt.id
                            ? 'border-[#141413] bg-[#141413] text-[#F5F3EF]'
                            : 'border-[#141413]/10 bg-white text-[#141413] hover:border-[#141413]/30'
                        }`}
                      >
                        <div className="text-xs font-semibold">{opt.label}</div>
                        <div
                          className={`text-[10px] mt-0.5 ${
                            category === opt.id ? 'text-[#C8C4BC]' : 'text-[#686662]'
                          }`}
                        >
                          {opt.desc}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#686662] mb-1">
                      Piece Name
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Vintage Graphic Tee"
                      className="w-full px-3 py-2 rounded-lg bg-white border border-[#141413]/12 text-xs text-[#141413] focus:outline-none focus:border-[#141413]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#686662] mb-1">
                      Label / Archive Tag
                    </label>
                    <input
                      type="text"
                      value={brand}
                      onChange={(e) => setBrand(e.target.value)}
                      placeholder="e.g. ARCHIVE 02"
                      className="w-full px-3 py-2 rounded-lg bg-white border border-[#141413]/12 text-xs text-[#141413] font-mono-tech focus:outline-none focus:border-[#141413]"
                    />
                  </div>
                </div>

                {/* Color & Textile Pattern */}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#686662] mb-1">
                      Base Color
                    </label>
                    <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white border border-[#141413]/12">
                      <input
                        type="color"
                        value={color}
                        onChange={(e) => setColor(e.target.value)}
                        className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent"
                      />
                      <span className="text-[11px] font-mono-tech uppercase">{color}</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#686662] mb-1">
                      Detail / Stitch
                    </label>
                    <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white border border-[#141413]/12">
                      <input
                        type="color"
                        value={secondaryColor}
                        onChange={(e) => setSecondaryColor(e.target.value)}
                        className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent"
                      />
                      <span className="text-[11px] font-mono-tech uppercase">{secondaryColor}</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#686662] mb-1">
                      Surface Weave
                    </label>
                    <select
                      value={patternType}
                      onChange={(e) =>
                        setPatternType(e.target.value as GarmentItem['patternType'])
                      }
                      className="w-full px-2.5 py-2 rounded-lg bg-white border border-[#141413]/12 text-xs text-[#141413] focus:outline-none"
                    >
                      <option value="solid">Fine Cotton</option>
                      <option value="graphic-tee">Atelier Print</option>
                      <option value="pinstripe">Pinstripe</option>
                      <option value="denim">Selvedge Denim</option>
                      <option value="nylon-tech">Ripstop Nylon</option>
                      <option value="flannel">Plaid Weave</option>
                    </select>
                  </div>
                </div>

                {/* Fabric Finish Slider */}
                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="font-semibold uppercase tracking-wider text-[#686662]">
                      Fabric Sheen (Technical Nylon ↔ Matte Wool)
                    </span>
                    <span className="font-mono-tech text-[#141413]">
                      {Math.round(roughness * 100)}% Matte
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.2}
                    max={0.95}
                    step={0.05}
                    value={roughness}
                    onChange={(e) => setRoughness(parseFloat(e.target.value))}
                    className="w-full accent-[#141413]"
                  />
                </div>

                <label className="flex items-center gap-2 pt-1 text-xs text-[#141413] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={equipImmediately}
                    onChange={(e) => setEquipImmediately(e.target.checked)}
                    className="accent-[#D96B27] rounded"
                  />
                  <span>Put directly on the 3D Mannequin (otherwise hang on Wardrobe Rack)</span>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-[#141413]/10">
              <button
                type="button"
                onClick={() => setActiveTab('ai-guide')}
                className="text-xs text-[#D96B27] hover:underline font-medium flex items-center gap-1.5"
              >
                <Cpu className="w-3.5 h-3.5" />
                Want full AI 3D mesh generation? View the free AI stack →
              </button>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-[#686662] hover:bg-[#141413]/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-semibold bg-[#141413] text-[#F5F3EF] hover:bg-[#2a2a28] shadow-md transition-all flex items-center gap-1.5"
                >
                  <Layers className="w-3.5 h-3.5" />
                  Add 3D Cloth to Studio
                </button>
              </div>
            </div>
          </form>
        ) : (
          /* Tab 2: Free AI Recommendations & Drop-In Snippets */
          <div className="p-6 overflow-y-auto studio-scroll space-y-4">
            <div className="p-4 rounded-xl bg-[#141413] text-[#F5F3EF] flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-mono-tech uppercase tracking-wider text-[#D96B27] mb-1">
                  Zero-Cost AI Architecture for Your 3D Wardrobe
                </div>
                <h3 className="text-sm font-display font-semibold">
                  Which Free AI Models Should You Add?
                </h3>
                <p className="text-xs text-[#C8C4BC] mt-1 leading-relaxed">
                   right now your studio already runs instant client-side photo cutout & 3D UV projection. When you are ready to connect external AI, these 3 tools are completely free and plug directly into Three.js:
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {FREE_AI_STACK.map((item, idx) => (
                <div
                  key={item.title}
                  className="p-4 rounded-xl bg-white border border-[#141413]/10 space-y-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono-tech font-medium bg-[#D96B27]/12 text-[#D96B27]">
                      {item.badge}
                    </span>
                    <span className="text-[11px] font-mono-tech text-[#686662]">
                      {item.installCmd}
                    </span>
                  </div>
                  <div className="text-xs font-semibold text-[#141413]">{item.title}</div>
                  <p className="text-xs text-[#686662] leading-relaxed">{item.why}</p>

                  <div className="relative rounded-lg bg-[#18181A] text-[#EAE6DF] p-3 font-mono-tech text-[11px] overflow-x-auto">
                    <button
                      type="button"
                      onClick={() => copySnippet(item.snippet, idx)}
                      className="absolute top-2 right-2 px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-[10px] flex items-center gap-1 text-white"
                    >
                      {copiedIndex === idx ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          Copy
                        </>
                      )}
                    </button>
                    <pre className="leading-relaxed pr-16">{item.snippet}</pre>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setActiveTab('create')}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#141413] text-[#F5F3EF]"
              >
                ← Back to Digitize Cloth
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
