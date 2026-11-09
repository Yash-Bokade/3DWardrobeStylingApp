import * as THREE from "three";
import { GarmentItem } from "../types/studio";

const textureCache = new Map<string, THREE.Texture>();
const bumpCache = new Map<string, THREE.Texture>();
const textureListeners = new Set<() => void>();

export function subscribeFabricTextureUpdates(listener: () => void) {
  textureListeners.add(listener);
  return () => {
    textureListeners.delete(listener);
  };
}

/**
 * Convert Kelvin temperature (2500K - 7000K) to an RGB hex string
 */
export function kelvinToHex(kelvin: number): string {
  const temp = kelvin / 100;
  let r: number;
  let g: number;
  let b: number;

  if (temp <= 66) {
    r = 255;
    g = Math.min(255, Math.max(0, 99.4708025861 * Math.log(temp) - 161.1195681661));
    if (temp <= 19) {
      b = 0;
    } else {
      b = Math.min(255, Math.max(0, 138.5177312231 * Math.log(temp - 10) - 305.0447927307));
    }
  } else {
    r = Math.min(255, Math.max(0, 329.698727446 * Math.pow(temp - 60, -0.1332047592)));
    g = Math.min(255, Math.max(0, 288.1221695283 * Math.pow(temp - 60, -0.0755148492)));
    b = 255;
  }

  const toHex = (n: number) => Math.round(n).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Generates a high-frequency textile micro-weave bump map for realistic cloth normal relief
 */
export function getFabricBumpMap(pattern: GarmentItem["patternType"] = "solid"): THREE.Texture {
  const key = pattern || "solid";
  const cached = bumpCache.get(key);
  if (cached) return cached;

  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#808080";
  ctx.fillRect(0, 0, size, size);

  if (key === "denim") {
    // Diagonal twill weave
    ctx.strokeStyle = "#a8a8a8";
    ctx.lineWidth = 1.5;
    for (let i = -size; i < size * 2; i += 4) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i - size, size);
      ctx.stroke();
    }
  } else if (key === "nylon-tech") {
    // Ripstop micro grid
    ctx.strokeStyle = "#9e9e9e";
    ctx.lineWidth = 1;
    for (let i = 0; i < size; i += 8) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, size);
      ctx.moveTo(0, i);
      ctx.lineTo(size, i);
      ctx.stroke();
    }
  } else {
    // Fine combed cotton jersey / wool gabardine micro-knit
    const imgData = ctx.getImageData(0, 0, size, size);
    const data = imgData.data;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const idx = (y * size + x) * 4;
        const weave =
          Math.sin(x * 1.57) * 14 + Math.cos(y * 1.57) * 14 + ((x + y) % 2 === 0 ? 6 : -6);
        const val = Math.min(255, Math.max(0, 128 + weave));
        data[idx] = val;
        data[idx + 1] = val;
        data[idx + 2] = val;
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(imgData, 0, 0);
  }

  const bumpTex = new THREE.CanvasTexture(canvas);
  bumpTex.wrapS = THREE.RepeatWrapping;
  bumpTex.wrapT = THREE.RepeatWrapping;
  bumpTex.repeat.set(6, 6);
  bumpTex.needsUpdate = true;

  bumpCache.set(key, bumpTex);
  return bumpTex;
}

/**
 * Builds a seamless cylindrical UV garment texture (1024x1024).
 * Note: In cylindrical UV mapping, u=0.5 is the front chest center, and u=0.0/1.0 is the back center.
 */
export function getGarmentTexture(item: GarmentItem): THREE.Texture {
  const cacheKey = `${item.id}_${item.color}_${item.secondaryColor || ""}_${item.patternType || "solid"}_${
    item.textureDataUrl ? item.textureDataUrl.slice(-32) : "proc"
  }`;

  const cached = textureCache.get(cacheKey);
  if (cached) return cached;

  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext("2d")!;

  const drawBaseFabric = () => {
    ctx.fillStyle = item.color;
    ctx.fillRect(0, 0, 1024, 1024);

    // Subtle vertical ambient shading gradient for natural fabric depth
    const grad = ctx.createLinearGradient(0, 0, 0, 1024);
    grad.addColorStop(0, "rgba(255,255,255,0.04)");
    grad.addColorStop(0.5, "rgba(0,0,0,0)");
    grad.addColorStop(1, "rgba(0,0,0,0.08)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1024, 1024);

    // Micro textile grain
    ctx.fillStyle = "rgba(255,255,255,0.022)";
    for (let y = 0; y < 1024; y += 3) {
      ctx.fillRect(0, y, 1024, 1);
    }
    ctx.fillStyle = "rgba(0,0,0,0.022)";
    for (let x = 0; x < 1024; x += 3) {
      ctx.fillRect(x, 0, 1, 1024);
    }

    const accent = item.secondaryColor || "#F5F3EF";

    if (item.patternType === "pinstripe") {
      ctx.strokeStyle = accent;
      ctx.globalAlpha = 0.25;
      ctx.lineWidth = 2;
      for (let x = 8; x < 1024; x += 20) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, 1024);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    } else if (item.patternType === "flannel") {
      ctx.fillStyle = accent;
      ctx.globalAlpha = 0.14;
      for (let i = 0; i < 1024; i += 64) {
        ctx.fillRect(i, 0, 26, 1024);
        ctx.fillRect(0, i, 1024, 26);
      }
      ctx.globalAlpha = 1;
    } else if (item.patternType === "denim") {
      ctx.strokeStyle = "rgba(255,255,255,0.065)";
      ctx.lineWidth = 1.5;
      for (let i = -1024; i < 1024; i += 5) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i + 1024, 1024);
        ctx.stroke();
      }
      // Subtle selvedge copper topstitch along side seams (u=0.25 & u=0.75)
      ctx.strokeStyle = "#C87D32";
      ctx.lineWidth = 2.5;
      ctx.setLineDash([8, 5]);
      ctx.beginPath();
      ctx.moveTo(256, 0);
      ctx.lineTo(256, 1024);
      ctx.moveTo(768, 0);
      ctx.lineTo(768, 1024);
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (item.patternType === "graphic-tee") {
      // Subtle woven chest label / minimalist graphic centered on front chest (u=0.5 -> x=512)
      ctx.save();
      ctx.fillStyle = accent;
      ctx.strokeStyle = accent;
      ctx.globalAlpha = 0.88;
      ctx.lineWidth = 2;
      ctx.font = '600 22px "Space Grotesk", sans-serif';
      ctx.textAlign = "center";
      ctx.fillText("A T E L I E R", 512, 340);
      ctx.font = '400 12px "JetBrains Mono", monospace';
      ctx.fillText("COLLECTION // 01", 512, 366);
      ctx.restore();
    }
  };

  drawBaseFabric();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;

  // If user uploaded a custom garment photo, project it cleanly onto the front chest UV region (centered at x=512)
  if (item.textureDataUrl) {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      drawBaseFabric();

      // Front torso spans roughly x = 300..724 (width 424), y = 140..840
      const targetW = 390;
      const targetH = 620;
      const scale = Math.min(targetW / img.width, targetH / img.height);
      const drawW = img.width * scale;
      const drawH = img.height * scale;
      const dx = 512 - drawW / 2;
      const dy = 460 - drawH / 2;

      ctx.drawImage(img, dx, dy, drawW, drawH);
      texture.needsUpdate = true;
      textureListeners.forEach((listener) => listener());
    };
    img.src = item.textureDataUrl;
  }

  textureCache.set(cacheKey, texture);
  return texture;
}

/**
 * Extracts dominant garment color and optionally strips bright/uniform backgrounds from an uploaded photo
 */
export async function processUploadedGarmentPhoto(
  file: File,
  removeBackground: boolean,
): Promise<{ dataUrl: string; dominantHex: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read image"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Invalid image file"));
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const maxDim = 640;
        const ratio = Math.min(1, maxDim / Math.max(img.width, img.height));
        canvas.width = Math.max(1, Math.round(img.width * ratio));
        canvas.height = Math.max(1, Math.round(img.height * ratio));

        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;

        // Sample corner pixels to estimate backdrop color
        const corners = [
          0,
          (canvas.width - 1) * 4,
          canvas.width * (canvas.height - 1) * 4,
          (canvas.width * canvas.height - 1) * 4,
        ];
        let bgR = 0;
        let bgG = 0;
        let bgB = 0;
        for (const idx of corners) {
          bgR += data[idx];
          bgG += data[idx + 1];
          bgB += data[idx + 2];
        }
        bgR /= corners.length;
        bgG /= corners.length;
        bgB /= corners.length;

        // Accumulate center region color for dominant garment tone
        let sumR = 0;
        let sumG = 0;
        let sumB = 0;
        let count = 0;

        for (let y = 0; y < canvas.height; y++) {
          for (let x = 0; x < canvas.width; x++) {
            const i = (y * canvas.width + x) * 4;
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];

            const distToBg = Math.hypot(r - bgR, g - bgG, b - bgB);

            if (removeBackground && distToBg < 44) {
              // Feather alpha out for clean studio cutout
              data[i + 3] = Math.max(0, Math.round(((distToBg - 18) / 26) * 255));
            }

            // Sample interior pixels for dominant fabric color
            if (
              x > canvas.width * 0.28 &&
              x < canvas.width * 0.72 &&
              y > canvas.height * 0.25 &&
              y < canvas.height * 0.75 &&
              data[i + 3] > 150
            ) {
              sumR += r;
              sumG += g;
              sumB += b;
              count++;
            }
          }
        }

        if (removeBackground) {
          ctx.putImageData(imgData, 0, 0);
        }

        let dominantHex = "#2C3038";
        if (count > 0) {
          const avgR = Math.round(sumR / count);
          const avgG = Math.round(sumG / count);
          const avgB = Math.round(sumB / count);
          const toHex = (n: number) => Math.min(255, Math.max(0, n)).toString(16).padStart(2, "0");
          dominantHex = `#${toHex(avgR)}${toHex(avgG)}${toHex(avgB)}`;
        }

        resolve({
          dataUrl: canvas.toDataURL("image/png"),
          dominantHex,
        });
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
