import * as THREE from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { GarmentCategory } from "../types/studio";

export type GarmentMode = "rack" | "mannequin";
type TopCategory = Exclude<GarmentCategory, "pants">;

const clamp = THREE.MathUtils.clamp;
const smooth = (a: number, b: number, x: number) => THREE.MathUtils.smoothstep(x, a, b);
const gaussian = (x: number, center: number, width: number) =>
  Math.exp(-Math.pow((x - center) / width, 2));
const geometryTemplates = new Map<string, THREE.BufferGeometry>();

export function hemHeight(category: GarmentCategory) {
  return category === "shirt" ? -0.385 : category === "jacket" ? -0.337 : -0.354;
}

function topPattern(category: TopCategory): THREE.Shape {
  const shape = new THREE.Shape();
  const hem = hemHeight(category);
  const long = category !== "tshirt";
  const halfHem = category === "jacket" ? 0.213 : 0.205;

  shape.moveTo(-halfHem, hem);
  shape.bezierCurveTo(-0.08, hem - 0.009, 0.075, hem + 0.005, halfHem, hem);
  shape.bezierCurveTo(0.2, hem + 0.1, 0.19, -0.08, 0.216, 0.015);
  if (long) {
    shape.bezierCurveTo(0.239, -0.035, 0.25, -0.12, 0.261, -0.19);
    shape.bezierCurveTo(0.271, -0.25, 0.27, -0.3, 0.277, -0.346);
    shape.bezierCurveTo(0.303, -0.351, 0.338, -0.35, 0.36, -0.34);
    shape.bezierCurveTo(0.355, -0.25, 0.349, -0.14, 0.333, -0.045);
    shape.bezierCurveTo(0.321, 0.065, 0.296, 0.146, 0.249, 0.195);
  } else {
    shape.bezierCurveTo(0.244, -0.003, 0.274, -0.035, 0.316, -0.051);
    shape.bezierCurveTo(0.343, -0.017, 0.371, 0.044, 0.387, 0.092);
    shape.bezierCurveTo(0.345, 0.125, 0.287, 0.174, 0.249, 0.195);
  }
  shape.bezierCurveTo(0.198, 0.217, 0.122, 0.254, 0.078, 0.266);
  shape.bezierCurveTo(0.067, 0.227, 0.039, 0.211, 0, 0.21);
  shape.bezierCurveTo(-0.039, 0.211, -0.067, 0.227, -0.078, 0.266);
  shape.bezierCurveTo(-0.122, 0.254, -0.198, 0.217, -0.249, 0.195);
  if (long) {
    shape.bezierCurveTo(-0.296, 0.146, -0.321, 0.065, -0.333, -0.045);
    shape.bezierCurveTo(-0.349, -0.14, -0.355, -0.25, -0.36, -0.34);
    shape.bezierCurveTo(-0.338, -0.35, -0.303, -0.351, -0.277, -0.346);
    shape.bezierCurveTo(-0.27, -0.3, -0.271, -0.25, -0.261, -0.19);
    shape.bezierCurveTo(-0.25, -0.12, -0.239, -0.035, -0.216, 0.015);
  } else {
    shape.bezierCurveTo(-0.287, 0.174, -0.345, 0.125, -0.387, 0.092);
    shape.bezierCurveTo(-0.371, 0.044, -0.343, -0.017, -0.316, -0.051);
    shape.bezierCurveTo(-0.274, -0.035, -0.244, -0.003, -0.216, 0.015);
  }
  shape.bezierCurveTo(-0.19, -0.08, -0.2, hem + 0.1, -halfHem, hem);
  shape.closePath();
  return shape;
}

function trouserPattern() {
  const shape = new THREE.Shape();
  shape.moveTo(-0.162, 0.193);
  shape.bezierCurveTo(-0.08, 0.2, 0.08, 0.2, 0.162, 0.193);
  shape.bezierCurveTo(0.192, 0.12, 0.197, 0.035, 0.191, -0.08);
  shape.bezierCurveTo(0.183, -0.3, 0.192, -0.56, 0.184, -0.77);
  shape.bezierCurveTo(0.139, -0.78, 0.07, -0.784, 0.026, -0.775);
  shape.bezierCurveTo(0.018, -0.58, 0.023, -0.32, 0.012, -0.181);
  shape.bezierCurveTo(0.009, -0.152, -0.009, -0.152, -0.012, -0.181);
  shape.bezierCurveTo(-0.023, -0.32, -0.018, -0.58, -0.026, -0.775);
  shape.bezierCurveTo(-0.07, -0.784, -0.139, -0.78, -0.184, -0.77);
  shape.bezierCurveTo(-0.192, -0.56, -0.183, -0.3, -0.191, -0.08);
  shape.bezierCurveTo(-0.197, 0.035, -0.192, 0.12, -0.162, 0.193);
  shape.closePath();
  return shape;
}

function sleeveDepth(x: number, y: number, long: boolean, mode: GarmentMode) {
  const ax = Math.abs(x);
  const start = new THREE.Vector2(0.221, 0.134);
  const end = long ? new THREE.Vector2(0.316, -0.346) : new THREE.Vector2(0.352, 0.02);
  const direction = end.clone().sub(start);
  const v = new THREE.Vector2(ax, y).sub(start);
  const t = clamp(v.dot(direction) / direction.lengthSq(), 0, 1);
  const center = start.clone().addScaledVector(direction, t);
  const radius = long ? THREE.MathUtils.lerp(0.081, 0.045, t) : 0.077;
  const distance = new THREE.Vector2(ax, y).distanceTo(center);
  const crossSection = Math.sqrt(Math.max(0, 1 - Math.pow(distance / radius, 2)));
  const fullness = radius * (mode === "rack" ? 0.65 : 1);
  const elbow = gaussian(t, 0.6, 0.19);
  const wrinkles = Math.sin(t * 62 + x * 23) * 0.004 * elbow;
  return Math.max(0, (fullness + wrinkles) * crossSection);
}

/** Samples the sewn pattern in 3D. Open edges remain open; no cylinder caps or overlapping sleeves. */
export function sampleGarmentSurface(
  category: GarmentCategory,
  mode: GarmentMode,
  x: number,
  y: number,
  back = false,
): THREE.Vector3 {
  const side = back ? -1 : 1;
  const hanging = mode === "rack";

  if (category === "pants") {
    const pelvisWidth = 0.184 - smooth(0.055, 0.2, y) * 0.022;
    const pelvisProfile = Math.sqrt(Math.max(0, 1 - Math.pow(x / pelvisWidth, 2)));
    const pelvisDepth = (hanging ? 0.06 : 0.128) * pelvisProfile;
    const centerX = Math.sign(x || 1) * (0.098 + smooth(0.4, 0.77, -y) * 0.003);
    const legWidth = 0.084 + smooth(-0.65, -0.12, y) * 0.012;
    const relativeX = (x - centerX) / legWidth;
    const legProfile = Math.sqrt(Math.max(0, 1 - relativeX * relativeX));
    const ankle = gaussian(y, -0.7, 0.1);
    const legDepth =
      (hanging ? 0.05 : 0.09) * legProfile * (1 + Math.sin(y * 70 + x * 10) * 0.045 * ankle);
    const riseBlend = smooth(-0.22, -0.025, y);
    let depth = THREE.MathUtils.lerp(legDepth, pelvisDepth, riseBlend);
    const frontCrease = gaussian(Math.abs(x), 0.095, 0.011) * 0.0055;
    const pleats = Math.sin(Math.abs(x) * 160 + y * 3) * 0.003 * gaussian(y, 0.035, 0.18);
    depth += (frontCrease + pleats) * (back ? 0.45 : 1) * legProfile;
    const softFold = Math.sin(x * 85 + y * 8) * 0.0023 * legProfile;
    const cuffBreak = Math.sin(y * 89 + x * 13) * 0.0034 * ankle * legProfile;
    return new THREE.Vector3(
      x + Math.sin(y * 5 + x * 15) * 0.0016,
      y + Math.sin(x * 72) * 0.002 * (1 - smooth(-0.77, -0.68, y)),
      side * Math.max(0, depth + softFold + cuffBreak),
    );
  }

  const jacket = category === "jacket";
  const hem = hemHeight(category);
  const t = clamp((y - hem) / (0.266 - hem), 0, 1);
  const halfWidth = 0.206 - gaussian(y, -0.08, 0.14) * 0.01 + smooth(0.02, 0.16, y) * 0.019;
  const bodyProfile = Math.sqrt(Math.max(0, 1 - Math.pow(x / halfWidth, 2)));
  const fullDepth = hanging ? 0.079 : jacket ? 0.184 : category === "shirt" ? 0.167 : 0.158;
  const collarDepth = hanging ? 0.047 : 0.071;
  const depthAtHeight = THREE.MathUtils.lerp(fullDepth, collarDepth, smooth(0.115, 0.266, y));
  const shoulderEdge = 0.3 - Math.abs(x) * 0.42;
  const shoulderFalloff = Math.sqrt(clamp((shoulderEdge - y) / 0.047, 0, 1));
  const body = bodyProfile * depthAtHeight * shoulderFalloff;
  const sleeve = sleeveDepth(x, y, category !== "tshirt", mode) * (jacket ? 1.1 : 1);
  // A smooth union makes the sleeve head part of the shirt rather than a tube glued onto it.
  const blend = Math.max(0, 0.018 - Math.abs(body - sleeve)) / 0.018;
  let depth = Math.max(body, sleeve) + blend * blend * 0.0045;
  const bodyWeight = clamp(body / Math.max(0.001, body + sleeve), 0, 1);
  const foldStrength = (hanging ? 0.011 : 0.0085) * (jacket ? 0.7 : 1);
  const drape =
    (Math.sin(x * 48 + y * 4.2) +
      Math.sin(x * 83 - y * 7.5 + 0.8) * 0.38 +
      Math.cos(x * 29 + y * 13) * 0.28) *
    foldStrength *
    (1 - t * 0.55);
  const tension =
    Math.sin((y + Math.abs(x) * 0.72) * 92) *
    gaussian(Math.abs(x), 0.174, 0.07) *
    gaussian(y, 0.025, 0.115) *
    0.0048;
  const waistBreak = Math.sin(y * 65 + x * 11) * gaussian(y, -0.235, 0.07) * 0.0028;
  depth += (drape + tension + waistBreak) * bodyProfile * bodyWeight;
  const hemWave = Math.sin(x * 37 + 0.8) * 0.0045 * (1 - smooth(hem, hem + 0.07, y));
  const shirtTail =
    category === "shirt" ? -Math.cos(x * 8) * 0.016 * (1 - smooth(hem, hem + 0.09, y)) : 0;
  const backNeckLift = back
    ? smooth(0.15, 0.255, y) * (1 - smooth(0.058, 0.091, Math.abs(x))) * 0.034
    : 0;
  return new THREE.Vector3(
    x + Math.sin(y * 14 + x * 18) * 0.0019 * (1 - t),
    y + hemWave + shirtTail + backNeckLift,
    side * Math.max(0, depth * (back ? 0.94 : 1)),
  );
}

function averageSeamNormals(geometry: THREE.BufferGeometry) {
  const position = geometry.getAttribute("position");
  const normal = geometry.getAttribute("normal");
  const sums = new Map<string, THREE.Vector3>();
  const keyFor = (i: number) =>
    `${Math.round(position.getX(i) * 10000)},${Math.round(position.getY(i) * 10000)},${Math.round(position.getZ(i) * 10000)}`;
  for (let i = 0; i < position.count; i++) {
    const key = keyFor(i);
    const sum = sums.get(key) || new THREE.Vector3();
    sum.x += normal.getX(i);
    sum.y += normal.getY(i);
    sum.z += normal.getZ(i);
    sums.set(key, sum);
  }
  for (let i = 0; i < position.count; i++) {
    const n = sums.get(keyFor(i))!.clone().normalize();
    normal.setXYZ(i, n.x, n.y, n.z);
  }
}

/** Two curved, continuously joined cloth panels, with distinct front/back UVs. */
export function createSewnGarmentGeometry(category: GarmentCategory, mode: GarmentMode) {
  const cacheKey = `${category}:${mode}`;
  const cached = geometryTemplates.get(cacheKey);
  if (cached) return cached.clone();
  const pattern = category === "pants" ? trouserPattern() : topPattern(category);
  const outline = pattern.extractPoints(5).shape;
  if (outline[0].distanceTo(outline[outline.length - 1]) < 0.00001) outline.pop();
  const triangles = THREE.ShapeUtils.triangulateShape(outline, []);
  const positions: number[] = [];
  const uvs: number[] = [];
  const geometry = new THREE.BufferGeometry();

  const emit = (point: THREE.Vector2, back: boolean) => {
    const p = sampleGarmentSurface(category, mode, point.x, point.y, back);
    positions.push(p.x, p.y, p.z);
    const v = category === "pants" ? (point.y + 0.79) / 0.99 : (point.y + 0.4) / 0.68;
    uvs.push(0.5 + point.x * (back ? -0.85 : 0.85), v);
  };
  const subdivide = (
    a: THREE.Vector2,
    b: THREE.Vector2,
    c: THREE.Vector2,
    levels: number,
    back: boolean,
  ) => {
    if (levels === 0) {
      // Pattern triangulation is counterclockwise; reverse the back panel.
      emit(a, back);
      emit(back ? c : b, back);
      emit(back ? b : c, back);
      return;
    }
    const ab = a.clone().add(b).multiplyScalar(0.5);
    const bc = b.clone().add(c).multiplyScalar(0.5);
    const ca = c.clone().add(a).multiplyScalar(0.5);
    subdivide(a, ab, ca, levels - 1, back);
    subdivide(ab, b, bc, levels - 1, back);
    subdivide(ca, bc, c, levels - 1, back);
    subdivide(ab, bc, ca, levels - 1, back);
  };
  for (const back of [false, true]) {
    const start = positions.length / 3;
    for (const [a, b, c] of triangles) {
      subdivide(outline[a], outline[b], outline[c], 4, back);
    }
    geometry.addGroup(start, positions.length / 3 - start, back ? 1 : 0);
  }
  const seamStart = positions.length / 3;
  const clockwise = THREE.ShapeUtils.isClockWise(outline);
  const pushWallVertex = (p: THREE.Vector3, u: number, v: number) => {
    positions.push(p.x, p.y, p.z);
    uvs.push(u, v);
  };
  for (let edge = 0; edge < outline.length; edge++) {
    const a = outline[edge];
    const b = outline[(edge + 1) % outline.length];
    const middle = a.clone().lerp(b, 0.5);
    const ax = Math.abs(middle.x);
    const hem = hemHeight(category);
    // Neck, waist/hem, and sleeve/trouser cuffs are genuine openings.
    const opening =
      category === "pants"
        ? middle.y > 0.187 || middle.y < -0.75
        : (middle.y < hem + 0.018 && ax < 0.21) ||
          (middle.y > 0.202 && ax < 0.08) ||
          (category === "tshirt" ? ax > 0.312 && middle.y < 0.094 : ax > 0.27 && middle.y < -0.33);
    if (opening) continue;
    const tangent = b.clone().sub(a).normalize();
    const outward = clockwise
      ? new THREE.Vector2(-tangent.y, tangent.x)
      : new THREE.Vector2(tangent.y, -tangent.x);
    const sampleWall = (along: number, across: number) => {
      const xy = a.clone().lerp(b, along);
      const front = sampleGarmentSurface(category, mode, xy.x, xy.y);
      const back = sampleGarmentSurface(category, mode, xy.x, xy.y, true);
      const p = front.clone().lerp(back, across);
      const roundness = Math.sin(across * Math.PI) * Math.min(0.008, front.distanceTo(back) * 0.14);
      p.x += outward.x * roundness;
      p.y += outward.y * roundness;
      return p;
    };
    for (let lengthStep = 0; lengthStep < 16; lengthStep++) {
      for (let crossStep = 0; crossStep < 6; crossStep++) {
        const t0 = lengthStep / 16;
        const t1 = (lengthStep + 1) / 16;
        const u0 = crossStep / 6;
        const u1 = (crossStep + 1) / 6;
        const p00 = sampleWall(t0, u0);
        const p10 = sampleWall(t1, u0);
        const p01 = sampleWall(t0, u1);
        const p11 = sampleWall(t1, u1);
        const vertices = clockwise
          ? [p00, p10, p01, p10, p11, p01]
          : [p00, p01, p10, p10, p01, p11];
        for (const p of vertices) {
          pushWallVertex(p, 0.18 + crossStep * 0.012, (p.y + 0.8) / 1.1);
        }
      }
    }
  }
  geometry.addGroup(seamStart, positions.length / 3 - seamStart, 1);
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  const welded = mergeVertices(geometry, 0.00001);
  geometry.dispose();
  welded.computeVertexNormals();
  averageSeamNormals(welded);
  welded.computeBoundingBox();
  welded.computeBoundingSphere();
  geometryTemplates.set(cacheKey, welded.clone());
  return welded;
}

export function createSurfaceStrip(
  category: GarmentCategory,
  mode: GarmentMode,
  center: (t: number) => THREE.Vector2,
  width: number,
  offset = 0.002,
  back = false,
) {
  const positions: number[] = [];
  const uv: number[] = [];
  const indices: number[] = [];
  const samples = 40;
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const p = center(t);
    const next = center(Math.min(1, t + 0.001));
    const prev = center(Math.max(0, t - 0.001));
    const tangent = next.sub(prev).normalize();
    const normal = new THREE.Vector2(-tangent.y, tangent.x);
    for (const side of [-1, 1]) {
      const sample = p.clone().addScaledVector(normal, (side * width) / 2);
      const point = sampleGarmentSurface(category, mode, sample.x, sample.y, back);
      point.z += (back ? -1 : 1) * offset;
      positions.push(point.x, point.y, point.z);
      uv.push(side === -1 ? 0 : 1, t);
    }
    if (i < samples) {
      const j = i * 2;
      indices.push(j, j + 1, j + 2, j + 1, j + 3, j + 2);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

export function createGarmentSeam(
  category: GarmentCategory,
  mode: GarmentMode,
  points: THREE.Vector2[],
  radius = 0.0007,
  back = false,
) {
  const curve2d = new THREE.SplineCurve(points);
  const samples = curve2d.getPoints(64).map((p) => {
    const vertex = sampleGarmentSurface(category, mode, p.x, p.y, back);
    vertex.z += back ? -0.002 : 0.002;
    return vertex;
  });
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(samples), 64, radius, 5, false);
}
