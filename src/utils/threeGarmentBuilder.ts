import * as THREE from "three";
import { getFabricBumpMap } from "./fabricTextures";
export { createGarmentMeshGroup } from "./realisticGarments";

/**
 * Builds an Ultra-Minimal Architectural Showroom Wardrobe Rail (Brushed Steel & Travertine Base)
 */
export function createWardrobeRackGroup(): THREE.Group {
  const rack = new THREE.Group();
  rack.name = "wardrobe-rack";

  const steelMat = new THREE.MeshStandardMaterial({
    color: 0x222220,
    roughness: 0.26,
    metalness: 0.88,
  });

  const stoneMat = new THREE.MeshStandardMaterial({
    color: 0xe6e2d8,
    roughness: 0.72,
    metalness: 0.05,
  });

  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xd8d5ce,
    roughness: 0.18,
    metalness: 0.92,
  });

  const width = 2.1;
  const depth = 0.56;
  const height = 2.16;

  const baseGeo = new THREE.BoxGeometry(width + 0.16, 0.045, depth);
  const baseMesh = new THREE.Mesh(baseGeo, stoneMat);
  baseMesh.position.set(0, 0.0225, 0);
  baseMesh.castShadow = true;
  baseMesh.receiveShadow = true;
  rack.add(baseMesh);

  const poleGeo = new THREE.CylinderGeometry(0.015, 0.015, height, 20);
  for (const side of [-1, 1]) {
    const x = (side * width) / 2;
    const post = new THREE.Mesh(poleGeo, steelMat);
    post.position.set(x, height / 2 + 0.02, 0);
    post.castShadow = true;
    rack.add(post);

    const collarGeo = new THREE.CylinderGeometry(0.032, 0.036, 0.04, 20);
    const collar = new THREE.Mesh(collarGeo, steelMat);
    collar.position.set(x, 0.055, 0);
    rack.add(collar);
  }

  const railGeo = new THREE.CylinderGeometry(0.016, 0.016, width + 0.04, 24);
  const rail = new THREE.Mesh(railGeo, chromeMat);
  rail.rotation.z = Math.PI / 2;
  rail.position.set(0, height + 0.02, 0);
  rail.castShadow = true;
  rack.add(rail);

  return rack;
}

/**
 * Creates a continuous, anatomically sculpted Haute-Couture Tailor Mannequin Torso
 */
function createAnatomicalMannequinTorsoGeometry(): THREE.BufferGeometry {
  const radialSegs = 56;
  const heightSegs = 44;
  const height = 0.78;

  const geo = new THREE.CylinderGeometry(1, 1, height, radialSegs, heightSegs, true);
  const pos = geo.attributes.position;

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);

    const t = (y + height / 2) / height;
    const angle = Math.atan2(x, z);
    const cosA = Math.cos(angle);
    const absSin = Math.abs(Math.sin(angle));

    let rX = 0.16;
    if (t < 0.36) {
      const hipSwelling = Math.sin((t / 0.36) * Math.PI) * 0.022;
      rX = THREE.MathUtils.lerp(0.156, 0.142, t / 0.36) + hipSwelling;
    } else if (t < 0.88) {
      const u = (t - 0.36) / 0.52;
      rX = THREE.MathUtils.lerp(0.142, 0.212, Math.pow(u, 1.15));
    } else {
      const u = (t - 0.88) / 0.12;
      rX = THREE.MathUtils.lerp(0.212, 0.062, Math.pow(u, 0.8));
    }

    let rZ = 0.112;
    if (t < 0.36) {
      rZ = THREE.MathUtils.lerp(0.112, 0.098, t / 0.36);
    } else if (t < 0.88) {
      const u = (t - 0.36) / 0.52;
      const pectoral =
        cosA > 0 ? Math.sin(u * Math.PI) * 0.028 * cosA : Math.sin(u * Math.PI) * 0.014 * -cosA;
      rZ = THREE.MathUtils.lerp(0.098, 0.118, u) + pectoral;
    } else {
      const u = (t - 0.88) / 0.12;
      rZ = THREE.MathUtils.lerp(0.118, 0.058, u);
    }

    const spineOffsetZ = Math.sin(t * Math.PI * 1.8) * 0.012;
    const shoulderDropY = t > 0.82 ? -absSin * 0.032 * ((t - 0.82) / 0.18) : 0;

    pos.setXYZ(i, Math.sin(angle) * rX, y + shoulderDropY, Math.cos(angle) * rZ + spineOffsetZ);
  }

  geo.computeVertexNormals();
  return geo;
}

/**
 * Builds the Sculpted Haute-Couture Studio Mannequin on a Travertine Plinth
 */
export function createMannequinGroup(): {
  root: THREE.Group;
  bodyPivot: THREE.Group;
  formGroup: THREE.Group;
  importedSlot: THREE.Group;
  highlightRing: THREE.Mesh;
  slots: {
    top: THREE.Group;
    outerwear: THREE.Group;
    bottom: THREE.Group;
  };
} {
  const root = new THREE.Group();
  root.name = "mannequin-root";

  const plinthMat = new THREE.MeshStandardMaterial({
    color: 0xe8e4dc,
    roughness: 0.72,
    metalness: 0.04,
  });
  const plinthGeo = new THREE.CylinderGeometry(0.48, 0.5, 0.08, 48);
  const plinth = new THREE.Mesh(plinthGeo, plinthMat);
  plinth.position.y = 0.04;
  plinth.castShadow = true;
  plinth.receiveShadow = true;
  root.add(plinth);

  const ringGeo = new THREE.RingGeometry(0.51, 0.535, 56);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xd96b27,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.0,
  });
  const highlightRing = new THREE.Mesh(ringGeo, ringMat);
  highlightRing.rotation.x = -Math.PI / 2;
  highlightRing.position.y = 0.008;
  root.add(highlightRing);

  const bodyPivot = new THREE.Group();
  bodyPivot.position.y = 0.08;
  root.add(bodyPivot);

  const formGroup = new THREE.Group();
  formGroup.name = "default-tailor-form";
  const importedSlot = new THREE.Group();
  bodyPivot.add(formGroup, importedSlot);

  const linenBump = getFabricBumpMap("solid");
  const linenFormMat = new THREE.MeshPhysicalMaterial({
    color: 0xebe5da,
    bumpMap: linenBump,
    bumpScale: 0.0004,
    roughness: 0.76,
    metalness: 0.02,
    sheen: 0.45,
    sheenColor: new THREE.Color("#fffcf5"),
    sheenRoughness: 0.85,
  });

  const porcelainLimbMat = new THREE.MeshPhysicalMaterial({
    color: 0xded7cb,
    roughness: 0.62,
    metalness: 0.02,
    clearcoat: 0.06,
    clearcoatRoughness: 0.6,
  });

  const torsoGeo = createAnatomicalMannequinTorsoGeometry();
  const torsoMesh = new THREE.Mesh(torsoGeo, linenFormMat);
  torsoMesh.position.y = 1.21;
  torsoMesh.castShadow = true;
  torsoMesh.receiveShadow = true;
  formGroup.add(torsoMesh);

  const neckGeo = new THREE.CylinderGeometry(0.054, 0.062, 0.12, 28);
  const neck = new THREE.Mesh(neckGeo, linenFormMat);
  neck.position.y = 1.64;
  neck.castShadow = true;
  formGroup.add(neck);

  const headGeo = new THREE.SphereGeometry(0.104, 64, 56);
  const hPos = headGeo.attributes.position;
  for (let i = 0; i < hPos.count; i++) {
    const hx = hPos.getX(i);
    const hy = hPos.getY(i);
    const hz = hPos.getZ(i);
    const jawTaper = hy < 0 ? THREE.MathUtils.lerp(1, 0.68, Math.min(1, -hy / 0.104)) : 1;
    const chinForward = hy < -0.03 && hz > 0 ? 0.012 * ((-hy - 0.03) / 0.07) : 0;
    const front = Math.max(0, hz / 0.104);
    const nose = Math.exp(-Math.pow(hx / 0.018, 2) - Math.pow((hy + 0.005) / 0.035, 2)) * 0.023;
    const eyeSocket =
      Math.exp(-Math.pow((Math.abs(hx) - 0.039) / 0.019, 2) - Math.pow((hy - 0.021) / 0.014, 2)) *
      0.009;
    const mouth = Math.exp(-Math.pow(hx / 0.031, 2) - Math.pow((hy + 0.045) / 0.006, 2)) * 0.003;
    hPos.setXYZ(
      i,
      hx * 0.84 * jawTaper,
      hy * 1.24,
      hz * 0.96 * jawTaper + chinForward + (nose - eyeSocket - mouth) * front,
    );
  }
  headGeo.computeVertexNormals();
  const head = new THREE.Mesh(headGeo, porcelainLimbMat);
  head.position.y = 1.81;
  head.castShadow = true;
  formGroup.add(head);

  for (const side of [-1, 1]) {
    const shoulderBall = new THREE.Mesh(new THREE.SphereGeometry(0.047, 24, 20), porcelainLimbMat);
    shoulderBall.position.set(side * 0.215, 1.51, 0);
    shoulderBall.castShadow = true;
    formGroup.add(shoulderBall);

    const armCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.225, 1.49, 0),
      new THREE.Vector3(side * 0.265, 1.26, -0.015),
      new THREE.Vector3(side * 0.28, 1.02, 0.035),
    ]);
    const armGeo = new THREE.TubeGeometry(armCurve, 20, 0.038, 18, false);
    const aPos = armGeo.attributes.position;
    const aCenter = new THREE.Vector3();
    for (let i = 0; i < aPos.count; i++) {
      const u = Math.min(1, Math.floor(i / 19) / 20);
      armCurve.getPointAt(u, aCenter);
      const taper = THREE.MathUtils.lerp(1.05, 0.68, u);
      aPos.setXYZ(
        i,
        aCenter.x + (aPos.getX(i) - aCenter.x) * taper,
        aCenter.y + (aPos.getY(i) - aCenter.y) * taper,
        aCenter.z + (aPos.getZ(i) - aCenter.z) * taper,
      );
    }
    armGeo.computeVertexNormals();
    const arm = new THREE.Mesh(armGeo, porcelainLimbMat);
    arm.castShadow = true;
    formGroup.add(arm);

    const handGeo = new THREE.SphereGeometry(0.028, 16, 16);
    handGeo.scale(0.65, 1.65, 0.85);
    const hand = new THREE.Mesh(handGeo, porcelainLimbMat);
    hand.position.set(side * 0.282, 0.97, 0.045);
    hand.castShadow = true;
    formGroup.add(hand);
    for (let finger = 0; finger < 4; finger++) {
      const length = [0.036, 0.045, 0.042, 0.033][finger];
      const fingerMesh = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.0036, length, 5, 8),
        porcelainLimbMat,
      );
      fingerMesh.position.set(side * (0.267 + finger * 0.009), 0.937 - length / 2, 0.047);
      fingerMesh.castShadow = true;
      formGroup.add(fingerMesh);
    }
    const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.005, 0.028, 5, 8), porcelainLimbMat);
    thumb.position.set(side * 0.256, 0.955, 0.053);
    thumb.rotation.z = side * -0.45;
    formGroup.add(thumb);

    const legCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.086, 0.86, 0),
      new THREE.Vector3(side * 0.09, 0.48, 0.01),
      new THREE.Vector3(side * 0.092, 0.06, -0.005),
    ]);
    const legGeo = new THREE.TubeGeometry(legCurve, 24, 0.064, 20, false);
    const lPos = legGeo.attributes.position;
    const lCenter = new THREE.Vector3();
    for (let i = 0; i < lPos.count; i++) {
      const u = Math.min(1, Math.floor(i / 21) / 24);
      legCurve.getPointAt(u, lCenter);
      const calfSwell = u > 0.5 && u < 0.85 ? Math.sin(((u - 0.5) / 0.35) * Math.PI) * 0.12 : 0;
      const taper = THREE.MathUtils.lerp(1.06, 0.56, u) + calfSwell;
      lPos.setXYZ(
        i,
        lCenter.x + (lPos.getX(i) - lCenter.x) * taper,
        lCenter.y + (lPos.getY(i) - lCenter.y) * taper,
        lCenter.z + (lPos.getZ(i) - lCenter.z) * taper,
      );
    }
    legGeo.computeVertexNormals();
    const leg = new THREE.Mesh(legGeo, porcelainLimbMat);
    leg.castShadow = true;
    formGroup.add(leg);
    const foot = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 20), porcelainLimbMat);
    foot.scale.set(0.043, 0.04, 0.105);
    foot.position.set(side * 0.092, 0.04, 0.05);
    foot.castShadow = true;
    foot.receiveShadow = true;
    formGroup.add(foot);
    const ear = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 20), porcelainLimbMat);
    ear.scale.set(0.011, 0.024, 0.016);
    ear.position.set(side * 0.084, 1.81, -0.002);
    formGroup.add(ear);
  }

  // Tag all mannequin meshes for raycast drop detection
  root.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) {
      obj.userData = { type: "mannequin" };
    }
  });

  // Outfit attachment anchor groups aligned to mannequin anatomy
  const topSlot = new THREE.Group();
  topSlot.position.set(0, 1.36, 0.006);
  bodyPivot.add(topSlot);

  const outerwearSlot = new THREE.Group();
  outerwearSlot.position.set(0, 1.37, 0.008);
  bodyPivot.add(outerwearSlot);

  const bottomSlot = new THREE.Group();
  bottomSlot.position.set(0, 0.85, 0.004);
  bodyPivot.add(bottomSlot);

  return {
    root,
    bodyPivot,
    formGroup,
    importedSlot,
    highlightRing,
    slots: {
      top: topSlot,
      outerwear: outerwearSlot,
      bottom: bottomSlot,
    },
  };
}
