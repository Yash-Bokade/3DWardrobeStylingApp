export type GarmentCategory = 'tshirt' | 'shirt' | 'jacket' | 'pants';

export type CameraPreset = 'room' | 'mannequin' | 'rack' | 'free';

export interface GarmentItem {
  id: string;
  name: string;
  brand?: string;
  category: GarmentCategory;
  slot: 'top' | 'outerwear' | 'bottom';
  color: string;
  secondaryColor?: string;
  roughness: number;
  metalness?: number;
  textureDataUrl?: string;
  patternType?: 'solid' | 'pinstripe' | 'graphic-tee' | 'denim' | 'nylon-tech' | 'flannel';
  rackIndex: number;
  notes?: string;
  createdAt: string;
}

export interface EquippedOutfit {
  top: string | null;
  outerwear: string | null;
  bottom: string | null;
}

export interface StudioSpotlightConfig {
  id: string;
  name: string;
  enabled: boolean;
  position: [number, number, number];
  target: [number, number, number];
  intensity: number; // 0 to 120
  kelvin: number; // 2700 to 6500
  angleDeg: number; // 18 to 65
  penumbra: number;
  showCone: boolean;
}

export interface StudioEnvironmentConfig {
  ambientIntensity: number;
  roomTone: 'warm-plaster' | 'concrete-gallery' | 'obsidian-noir';
  mannequinPose: 'editorial' | 'relaxed' | 'turntable';
  showLightGizmos: boolean;
}
