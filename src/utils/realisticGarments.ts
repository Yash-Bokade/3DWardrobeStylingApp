import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { GarmentItem } from "../types/studio";
import { getFabricBumpMap, getGarmentTexture } from "./fabricTextures";
import {
  createGarmentSeam,
  createSewnGarmentGeometry,
  createSurfaceStrip,
  hemHeight,
  sampleGarmentSurface,
  type GarmentMode,
} from "./garmentGeometry";

const point = (x: number, y: number) => new THREE.Vector2(x, y);

function batchDetails(group: THREE.Group) {
  group.updateMatrixWorld(true);
  const batches = new Map<THREE.Material, THREE.Mesh[]>();
  const disposed = new Set<THREE.BufferGeometry>();
  group.traverse((node) => {
    if (
      !(node instanceof THREE.Mesh) ||
      node instanceof THREE.InstancedMesh ||
      Array.isArray(node.material)
    )
      return;
    const batch = batches.get(node.material) || [];
    batch.push(node);
    batches.set(node.material, batch);
  });
  for (const [material, meshes] of batches) {
    if (meshes.length < 2) continue;
    const transformed = meshes.map((mesh) => mesh.geometry.clone().applyMatrix4(mesh.matrixWorld));
    const merged = mergeGeometries(transformed);
    transformed.forEach((geometry) => geometry.dispose());
    if (!merged) continue;
    group.add(new THREE.Mesh(merged, material));
    meshes.forEach((mesh) => {
      mesh.removeFromParent();
      disposed.add(mesh.geometry);
    });
  }
  disposed.forEach((geometry) => geometry.dispose());
}

function hanger(pants: boolean) {
  const group = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: "#93724e", roughness: 0.48 });
  const steel = new THREE.MeshStandardMaterial({
    color: "#a4a09a",
    roughness: 0.29,
    metalness: 0.9,
  });
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.208, 0.195, 0),
    new THREE.Vector3(-0.11, 0.255, 0),
    new THREE.Vector3(0, 0.282, 0),
    new THREE.Vector3(0.11, 0.255, 0),
    new THREE.Vector3(0.208, 0.195, 0),
  ]);
  const shoulderBar = new THREE.Mesh(new THREE.TubeGeometry(curve, 32, 0.009, 10), wood);
  shoulderBar.scale.z = 1.5;
  group.add(shoulderBar);
  const hookCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.28, 0),
    new THREE.Vector3(0, 0.324, 0),
    new THREE.Vector3(-0.019, 0.344, 0),
    new THREE.Vector3(-0.018, 0.363, 0),
    new THREE.Vector3(0, 0.369, 0),
    new THREE.Vector3(0.02, 0.357, 0),
  ]);
  group.add(new THREE.Mesh(new THREE.TubeGeometry(hookCurve, 24, 0.0026, 8), steel));
  if (pants) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.33, 0.012, 0.012), wood);
    bar.position.y = 0.213;
    group.add(bar);
    for (const side of [-1, 1]) {
      const clip = new THREE.Mesh(new THREE.BoxGeometry(0.021, 0.031, 0.016), steel);
      clip.position.set(side * 0.133, 0.202, 0.005);
      group.add(clip);
    }
  }
  return group;
}

function collarLeaf(side: number, material: THREE.Material) {
  const corners = [
    new THREE.Vector3(side * 0.01, 0.238, 0.085),
    new THREE.Vector3(side * 0.078, 0.262, 0.025),
    new THREE.Vector3(side * 0.123, 0.177, 0.119),
    new THREE.Vector3(side * 0.055, 0.142, 0.148),
  ];
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const segments = 14;
  for (let y = 0; y <= segments; y++) {
    const v = y / segments;
    const left = corners[0].clone().lerp(corners[3], v);
    const right = corners[1].clone().lerp(corners[2], v);
    for (let x = 0; x <= segments; x++) {
      const u = x / segments;
      const p = left.clone().lerp(right, u);
      p.z += Math.sin(u * Math.PI) * Math.sin(v * Math.PI) * 0.008;
      positions.push(p.x, p.y, p.z);
      uvs.push(u, v);
      if (x < segments && y < segments) {
        const i = y * (segments + 1) + x;
        indices.push(i, i + 1, i + segments + 1, i + 1, i + segments + 2, i + segments + 1);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, material);
}

export function createGarmentMeshGroup(item: GarmentItem, mode: GarmentMode, includeHanger = true) {
  const group = new THREE.Group();
  group.name = `garment-${item.id}-${mode}`;
  const bump = getFabricBumpMap(item.patternType);
  const color = new THREE.Color(item.color);
  const technical = item.patternType === "nylon-tech";
  const material = new THREE.MeshPhysicalMaterial({
    map: getGarmentTexture(item),
    bumpMap: bump,
    bumpScale: technical ? 0.00025 : 0.00065,
    roughness: item.roughness,
    metalness: 0,
    sheen: technical ? 0.12 : 0.35,
    sheenColor: color.clone().lerp(new THREE.Color("white"), 0.05),
    sheenRoughness: 0.86,
    side: THREE.DoubleSide,
  });
  const backMaterial = material.clone();
  backMaterial.map = getGarmentTexture({
    ...item,
    id: `${item.id}-back`,
    textureDataUrl: undefined,
    patternType: item.patternType === "graphic-tee" ? "solid" : item.patternType,
  });
  const trim = new THREE.MeshPhysicalMaterial({
    color: color.clone().multiplyScalar(0.91),
    bumpMap: bump,
    bumpScale: 0.0007,
    roughness: Math.min(1, item.roughness + 0.07),
    sheen: 0.3,
    sheenColor: color.clone().lerp(new THREE.Color("white"), 0.04),
    side: THREE.DoubleSide,
  });
  const thread = new THREE.MeshStandardMaterial({
    color: color.clone().lerp(new THREE.Color(item.secondaryColor || item.color), 0.16),
    roughness: 0.94,
  });
  const metal = new THREE.MeshStandardMaterial({
    color: "#aea494",
    roughness: 0.27,
    metalness: 0.88,
  });

  group.add(
    new THREE.Mesh(createSewnGarmentGeometry(item.category, mode), [material, backMaterial]),
  );
  if (includeHanger) group.add(hanger(item.category === "pants"));

  const sample = (x: number, y: number, offset = 0.002) => {
    const p = sampleGarmentSurface(item.category, mode, x, y);
    p.z += offset;
    return p;
  };
  const seam = (points: THREE.Vector2[], radius = 0.00065, back = false) => {
    const mesh = new THREE.Mesh(
      createGarmentSeam(item.category, mode, points, radius, back),
      thread,
    );
    group.add(mesh);
  };
  const strip = (
    center: (t: number) => THREE.Vector2,
    width: number,
    mat: THREE.Material = trim,
    offset = 0.002,
  ) => {
    group.add(new THREE.Mesh(createSurfaceStrip(item.category, mode, center, width, offset), mat));
  };

  if (item.category !== "pants") {
    const hem = hemHeight(item.category);
    for (const back of [false, true]) {
      seam(
        [point(-0.197, hem + 0.013), point(0, hem + 0.013), point(0.197, hem + 0.013)],
        0.0007,
        back,
      );
      seam(
        [point(-0.196, hem + 0.019), point(0, hem + 0.019), point(0.196, hem + 0.019)],
        0.0005,
        back,
      );
      for (const side of [-1, 1]) {
        seam(
          [point(side * 0.086, 0.261), point(side * 0.165, 0.23), point(side * 0.246, 0.192)],
          0.0008,
          back,
        );
      }
    }

    // A narrow knitted band follows the actual open neckline, rather than a thick torus.
    const neck = new THREE.SplineCurve([
      point(-0.078, 0.266),
      point(-0.054, 0.225),
      point(0, 0.211),
      point(0.054, 0.225),
      point(0.078, 0.266),
    ]);
    strip((t) => neck.getPoint(t), item.category === "jacket" ? 0.018 : 0.01);
    group.add(
      new THREE.Mesh(
        createSurfaceStrip(item.category, mode, (t) => neck.getPoint(t), 0.01, 0.0015, true),
        trim,
      ),
    );

    if (item.category === "shirt") {
      const leftLeaf = collarLeaf(-1, trim);
      const rightLeaf = collarLeaf(1, trim);
      if (mode === "rack") {
        leftLeaf.scale.z = 0.58;
        rightLeaf.scale.z = 0.58;
      }
      group.add(leftLeaf, rightLeaf);
      strip((t) => point(0, THREE.MathUtils.lerp(hem + 0.01, 0.213, t)), 0.02);
      const pearl = new THREE.MeshPhysicalMaterial({
        color: "#e5e0d5",
        roughness: 0.24,
        clearcoat: 0.45,
      });
      const buttonGeometry = new THREE.CylinderGeometry(0.0048, 0.0048, 0.002, 16);
      buttonGeometry.rotateX(Math.PI / 2);
      for (let i = 0; i < 6; i++) {
        const button = new THREE.Mesh(buttonGeometry, pearl);
        button.position.copy(sample(0, 0.167 - i * 0.094, 0.004));
        group.add(button);
      }
    }
    if (item.category === "jacket") {
      strip((t) => point(0, THREE.MathUtils.lerp(hem + 0.012, 0.223, t)), 0.009, trim, 0.003);
      const teethGeometry = new THREE.BoxGeometry(0.004, 0.0023, 0.002);
      const teeth = new THREE.InstancedMesh(teethGeometry, metal, 108);
      const transform = new THREE.Matrix4();
      for (let i = 0; i < 108; i++) {
        const p = sample(i % 2 === 0 ? -0.0026 : 0.0026, hem + 0.017 + i * 0.005, 0.0048);
        transform.makeTranslation(p.x, p.y, p.z);
        teeth.setMatrixAt(i, transform);
      }
      group.add(teeth);
      const pull = new THREE.Mesh(new THREE.TorusGeometry(0.004, 0.0011, 6, 14), metal);
      pull.scale.y = 1.7;
      pull.position.copy(sample(0, 0.16, 0.008));
      group.add(pull);
      for (const side of [-1, 1]) {
        const pocket = new THREE.SplineCurve([
          point(side * 0.087, -0.22),
          point(side * 0.124, -0.174),
          point(side * 0.163, -0.134),
        ]);
        strip((t) => pocket.getPoint(t), 0.009);
        seam(pocket.getPoints(8), 0.0008);
      }
    }
  } else {
    for (const back of [false, true]) {
      for (const y of [0.152, 0.186]) {
        seam([point(-0.162, y), point(0, y + 0.003), point(0.162, y)], 0.00075, back);
      }
      for (const side of [-1, 1]) {
        seam(
          [point(side * 0.03, -0.756), point(side * 0.103, -0.762), point(side * 0.18, -0.751)],
          0.00075,
          back,
        );
      }
    }
    seam([point(0.009, 0.15), point(0.014, 0.04), point(0.007, -0.065)]);
    for (const side of [-1, 1]) {
      seam(
        [point(side * 0.102, 0.151), point(side * 0.141, 0.073), point(side * 0.176, 0.018)],
        0.001,
      );
      for (const x of [0.077, 0.143]) {
        strip((t) => point(side * x, THREE.MathUtils.lerp(0.142, 0.194, t)), 0.008, trim, 0.004);
      }
    }
    const button = new THREE.Mesh(new THREE.SphereGeometry(0.005, 12, 8), metal);
    button.scale.z = 0.45;
    button.position.copy(sample(0, 0.174, 0.003));
    group.add(button);
  }

  batchDetails(group);
  group.traverse((object) => {
    object.userData = { type: "garment", garmentId: item.id, mode };
    if (object instanceof THREE.Mesh) {
      object.castShadow = true;
      object.receiveShadow = true;
    }
  });
  return group;
}
