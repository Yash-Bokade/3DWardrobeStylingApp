import * as THREE from "three";
import { unzip } from "fflate";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

export const JOE_MODEL = {
  title: "Joe | Realistic Human 3D Model",
  author: "Arjun P Krishna",
  url: "https://sketchfab.com/3d-models/joe-realistic-human-3d-model-2a108401fe5547409a3ad666b9b7d6b3",
  authorUrl: "https://sketchfab.com/arjunpkrishna",
  license: "https://creativecommons.org/licenses/by/4.0/",
};

export interface ImportedHumanModel {
  name: string;
  object: THREE.Group;
  creditsJoe: boolean;
}

export interface HumanModelFit {
  width: number;
  depth: number;
  rotation: number;
}

export const DEFAULT_MODEL_FIT: HumanModelFit = { width: 1, depth: 1, rotation: 0 };
const MAX_FILE_SIZE = 100 * 1024 * 1024;
const MAX_UNPACKED_SIZE = 300 * 1024 * 1024;

interface GltfDocument {
  asset?: { version?: string };
  buffers?: { uri?: string }[];
  images?: { uri?: string }[];
}

function validateDocument(document: GltfDocument) {
  if (document.asset?.version !== "2.0") {
    throw new Error("Please export this model as glTF 2.0 or GLB.");
  }
  for (const resource of [...(document.buffers || []), ...(document.images || [])]) {
    if (resource.uri && /^(?:https?:|file:|\/\/|blob:)/i.test(resource.uri)) {
      throw new Error(
        "The model references external files. Please use a self-contained GLB or ZIP.",
      );
    }
  }
}

function glbDocument(buffer: ArrayBuffer): GltfDocument {
  const view = new DataView(buffer);
  if (buffer.byteLength < 20 || view.getUint32(0, true) !== 0x46546c67) {
    throw new Error("This is not a valid GLB file.");
  }
  if (view.getUint32(4, true) !== 2 || view.getUint32(12, true) + 20 > buffer.byteLength) {
    throw new Error("This GLB is incomplete or uses an unsupported version.");
  }
  const json = new TextDecoder().decode(new Uint8Array(buffer, 20, view.getUint32(12, true)));
  return JSON.parse(json.trim()) as GltfDocument;
}

function unpack(bytes: Uint8Array): Promise<Record<string, Uint8Array>> {
  return new Promise((resolve, reject) => {
    let total = 0;
    unzip(
      bytes,
      {
        filter(file) {
          if (!/\.(gltf|glb|bin|png|jpe?g|webp|ktx2)$/i.test(file.name)) return false;
          total += file.originalSize;
          if (total > MAX_UNPACKED_SIZE) {
            throw new Error("The unpacked model exceeds 300 MB. Please export a smaller model.");
          }
          return true;
        },
      },
      (error, files) => (error ? reject(error) : resolve(files)),
    );
  });
}

export function normalizeHumanModel(object: THREE.Group) {
  object.updateMatrixWorld(true);
  let bounds = new THREE.Box3().setFromObject(object);
  let size = bounds.getSize(new THREE.Vector3());
  if (size.z > size.y * 1.8) {
    object.rotation.x -= Math.PI / 2;
    object.updateMatrixWorld(true);
    bounds = new THREE.Box3().setFromObject(object);
    size = bounds.getSize(new THREE.Vector3());
  }
  if (!Number.isFinite(size.y) || size.y < 0.001) {
    throw new Error("No usable 3D geometry was found in this file.");
  }
  const center = bounds.getCenter(new THREE.Vector3());
  const translated = new THREE.Group();
  translated.add(object);
  translated.position.set(-center.x, -bounds.min.y, -center.z);
  const normalized = new THREE.Group();
  normalized.add(translated);
  normalized.scale.setScalar(1.94 / size.y);
  normalized.name = "imported-human-model";
  normalized.traverse((node) => {
    node.userData = { ...node.userData, type: "mannequin" };
    if (node instanceof THREE.Mesh) {
      node.castShadow = true;
      node.receiveShadow = true;
    }
  });
  return normalized;
}

/** Imports only user-provided assets; never scrapes Sketchfab's protected viewer files. */
export async function importHumanModel(file: File): Promise<THREE.Group> {
  if (file.size > MAX_FILE_SIZE) throw new Error("Please use a GLB or ZIP smaller than 100 MB.");
  if (!/\.(glb|zip)$/i.test(file.name))
    throw new Error("Choose a .glb model or a glTF .zip export.");
  const objectUrls: string[] = [];
  let failedResource = false;
  const manager = new THREE.LoadingManager();
  manager.onError = () => {
    failedResource = true;
  };
  const draco = new DRACOLoader(manager).setDecoderPath("/draco/");
  const loader = new GLTFLoader(manager).setDRACOLoader(draco).setMeshoptDecoder(MeshoptDecoder);
  let parsedObject: THREE.Group | null = null;
  try {
    const buffer = await file.arrayBuffer();
    let payload: ArrayBuffer | string = buffer;
    if (/\.zip$/i.test(file.name)) {
      const files = await unpack(new Uint8Array(buffer));
      const entry = Object.keys(files)
        .filter((name) => /\.(glb|gltf)$/i.test(name))
        .sort((a, b) => a.split("/").length - b.split("/").length || a.localeCompare(b))[0];
      if (!entry) throw new Error("No .gltf or .glb file was found inside this ZIP.");
      if (/\.glb$/i.test(entry)) {
        payload = files[entry].slice().buffer as ArrayBuffer;
      } else {
        const document = JSON.parse(new TextDecoder().decode(files[entry])) as GltfDocument;
        validateDocument(document);
        const root = entry.slice(0, Math.max(0, entry.lastIndexOf("/") + 1));
        for (const resource of [...(document.buffers || []), ...(document.images || [])]) {
          if (!resource.uri || resource.uri.startsWith("data:")) continue;
          const path = decodeURIComponent(
            new URL(
              resource.uri.replace(/\\/g, "/"),
              `https://local.invalid/${root}`,
            ).pathname.slice(1),
          );
          const data = files[path];
          if (!data)
            throw new Error(
              `Missing model resource: ${path.split("/").pop()}. Include the textures and .bin in the ZIP.`,
            );
          const type = /\.png$/i.test(path)
            ? "image/png"
            : /\.jpe?g$/i.test(path)
              ? "image/jpeg"
              : /\.webp$/i.test(path)
                ? "image/webp"
                : "application/octet-stream";
          const url = URL.createObjectURL(new Blob([data.slice().buffer as ArrayBuffer], { type }));
          objectUrls.push(url);
          resource.uri = url;
        }
        payload = JSON.stringify(document);
      }
    }
    if (typeof payload !== "string") {
      const document = glbDocument(payload);
      validateDocument(document);
      const external = [...(document.buffers || []), ...(document.images || [])].some(
        (resource) => resource.uri && !resource.uri.startsWith("data:"),
      );
      if (external)
        throw new Error(
          "This GLB has separate textures. Please ZIP the model together with all its resources.",
        );
    }
    const gltf = await loader.parseAsync(payload, "");
    parsedObject = gltf.scene;
    if (failedResource) {
      throw new Error(
        "A model texture could not be decoded. Re-export with valid PNG or JPEG textures and try again.",
      );
    }
    return normalizeHumanModel(gltf.scene);
  } catch (error) {
    if (parsedObject) disposeModel(parsedObject);
    if (error instanceof Error && !/Unexpected token|JSON|THREE/.test(error.message)) throw error;
    throw new Error(
      "This model could not be opened. Try a fresh self-contained GLB export with PNG or JPEG textures.",
    );
  } finally {
    objectUrls.forEach((url) => URL.revokeObjectURL(url));
    draco.dispose();
  }
}

export function disposeModel(object: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  object.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    geometries.add(node.geometry);
    const list = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of list) {
      materials.add(material);
      Object.values(material).forEach((value) => {
        if (value instanceof THREE.Texture) textures.add(value);
      });
    }
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
  textures.forEach((texture) => texture.dispose());
}
