import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { strToU8, zipSync } from "fflate";
import { importHumanModel, normalizeHumanModel, disposeModel } from "./modelImport";

function glbFixture(extra: Record<string, unknown> = {}) {
  const positions = new Float32Array([-0.5, 0, 0, 0.5, 0, 0, 0, 2, 0]);
  const document = {
    asset: { version: "2.0" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, material: 0 }] }],
    materials: [
      {
        pbrMetallicRoughness: {
          baseColorFactor: [0.4, 0.2, 0.1, 1],
          metallicFactor: 0,
          roughnessFactor: 0.73,
        },
      },
    ],
    buffers: [{ byteLength: positions.byteLength }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: positions.byteLength }],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: 3,
        type: "VEC3",
        min: [-0.5, 0, 0],
        max: [0.5, 2, 0],
      },
    ],
    ...extra,
  };
  const json = new TextEncoder().encode(JSON.stringify(document));
  const paddedLength = Math.ceil(json.length / 4) * 4;
  const buffer = new ArrayBuffer(12 + 8 + paddedLength + 8 + positions.byteLength);
  const header = new DataView(buffer);
  header.setUint32(0, 0x46546c67, true);
  header.setUint32(4, 2, true);
  header.setUint32(8, buffer.byteLength, true);
  header.setUint32(12, paddedLength, true);
  header.setUint32(16, 0x4e4f534a, true);
  new Uint8Array(buffer, 20, paddedLength).fill(32);
  new Uint8Array(buffer, 20, json.length).set(json);
  header.setUint32(20 + paddedLength, positions.byteLength, true);
  header.setUint32(24 + paddedLength, 0x004e4942, true);
  new Uint8Array(buffer, 28 + paddedLength).set(new Uint8Array(positions.buffer));
  return buffer;
}

test("GLB importer loads real geometry and preserves the source PBR material", async () => {
  const model = await importHumanModel(new File([glbFixture()], "test-human.glb"));
  const bounds = new THREE.Box3().setFromObject(model);
  assert.ok(Math.abs(bounds.getSize(new THREE.Vector3()).y - 1.94) < 0.00001);
  assert.ok(Math.abs(bounds.min.y) < 0.00001);
  let material: THREE.MeshStandardMaterial | null = null;
  model.traverse((node) => {
    if (node instanceof THREE.Mesh) material = node.material as THREE.MeshStandardMaterial;
  });
  assert.ok(material);
  assert.equal((material as THREE.MeshStandardMaterial).roughness, 0.73);
  disposeModel(model);
});

test("nested GLB in a Sketchfab-style ZIP is importable", async () => {
  const zip = zipSync({ "source/scene.glb": new Uint8Array(glbFixture()) });
  const model = await importHumanModel(new File([zip.slice().buffer], "joe-export.zip"));
  assert.ok(new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3()).y > 1.9);
  disposeModel(model);
});

test("normalization centers and grounds a model with arbitrary source units", () => {
  const source = new THREE.Group();
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(50, 200, 30));
  mesh.position.set(800, 560, -300);
  source.add(mesh);
  const model = normalizeHumanModel(source);
  const bounds = new THREE.Box3().setFromObject(model);
  const center = bounds.getCenter(new THREE.Vector3());
  assert.ok(Math.abs(center.x) < 0.000001);
  assert.ok(Math.abs(center.z) < 0.000001);
  assert.ok(Math.abs(bounds.min.y) < 0.000001);
  assert.ok(Math.abs(bounds.getSize(new THREE.Vector3()).y - 1.94) < 0.000001);
  disposeModel(model);
});

test("invalid, incomplete, and oversized models fail without replacing the current model", async () => {
  await assert.rejects(importHumanModel(new File(["no model"], "bad.glb")), /valid GLB/);
  await assert.rejects(importHumanModel(new File(["not a model"], "photo.png")), /Choose a .glb/);
  await assert.rejects(
    importHumanModel({ name: "large.glb", size: 101 * 1024 * 1024 } as File),
    /100 MB/,
  );
  const zip = zipSync({ "readme.txt": strToU8("no geometry") });
  await assert.rejects(
    importHumanModel(new File([zip.slice().buffer], "empty.zip")),
    /No .gltf or .glb/,
  );
});

test("untrusted external resources are rejected rather than fetched", async () => {
  const bytes = glbFixture({ images: [{ uri: "https://untrusted.invalid/private-image.png" }] });
  await assert.rejects(importHumanModel(new File([bytes], "external.glb")), /external files/);
});

test("missing ZIP textures produce a useful recovery message", async () => {
  const zip = zipSync({
    "model/scene.gltf": strToU8(
      JSON.stringify({
        asset: { version: "2.0" },
        images: [{ uri: "textures/missing.png" }],
      }),
    ),
  });
  await assert.rejects(
    importHumanModel(new File([zip.slice().buffer], "missing-textures.zip")),
    /Missing model resource: missing.png/,
  );
});
