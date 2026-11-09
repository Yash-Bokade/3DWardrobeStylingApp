import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { HumanModelFit, ImportedHumanModel } from "../utils/modelImport";
import {
  CameraPreset,
  EquippedOutfit,
  GarmentItem,
  StudioEnvironmentConfig,
  StudioSpotlightConfig,
} from "../types/studio";
import { kelvinToHex, subscribeFabricTextureUpdates } from "../utils/fabricTextures";
import {
  createGarmentMeshGroup,
  createMannequinGroup,
  createWardrobeRackGroup,
} from "../utils/threeGarmentBuilder";

/**
 * Creates a seamless curved photography studio cyclorama (infinity cove)
 * that transitions smoothly from the horizontal floor up into the vertical backdrop wall.
 */
function createCycloramaGeometry(): THREE.BufferGeometry {
  const width = 16;
  const segsY = 120;
  const geo = new THREE.PlaneGeometry(width, 12, 16, segsY);
  const pos = geo.attributes.position;

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const v = (pos.getY(i) + 6) / 12;

    let y = 0;
    let z = 0;
    if (v < 0.45) {
      const u = v / 0.45;
      z = THREE.MathUtils.lerp(18, -1.1, u);
      y = 0;
    } else if (v < 0.65) {
      const u = (v - 0.45) / 0.2;
      const theta = u * (Math.PI / 2);
      z = -1.1 - Math.sin(theta) * 1.1;
      y = 1.1 - Math.cos(theta) * 1.1;
    } else {
      const u = (v - 0.65) / 0.35;
      z = -2.2;
      y = THREE.MathUtils.lerp(1.1, 5.4, u);
    }

    pos.setXYZ(i, x, y, z);
  }

  geo.computeVertexNormals();
  return geo;
}

function disposeMeshTree(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  root.traverse((node) => {
    if (!(node instanceof THREE.Mesh) || node.userData.importedHuman) return;
    geometries.add(node.geometry);
    (Array.isArray(node.material) ? node.material : [node.material]).forEach((m) =>
      materials.add(m),
    );
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
}

function presetPosition(preset: CameraPreset, aspect: number) {
  if (preset === "mannequin") {
    const narrow = aspect < 0.8;
    return {
      position: new THREE.Vector3(1.38, 1.4, Math.max(narrow ? 4.1 : 3.6, 0.48 / (0.325 * aspect))),
      target: new THREE.Vector3(1.12, narrow ? 1 : 1.08, 0.1),
    };
  }
  if (preset === "rack") {
    return {
      position: new THREE.Vector3(-1.13, 1.55, Math.max(3.3, 1.3 / (0.325 * aspect))),
      target: new THREE.Vector3(-1.28, 1.18, -0.15),
    };
  }
  return {
    position: new THREE.Vector3(-0.18, 1.6, Math.max(5.2, 2.5 / (0.325 * aspect))),
    target: new THREE.Vector3(-0.25, 1.1, 0),
  };
}

interface AtelierViewport3DProps {
  garments: GarmentItem[];
  equipped: EquippedOutfit;
  selectedGarmentId: string | null;
  activeSpotlightId: string | null;
  isLightingPanelOpen: boolean;
  spotlights: StudioSpotlightConfig[];
  environment: StudioEnvironmentConfig;
  cameraPreset: CameraPreset;
  humanModel: ImportedHumanModel | null;
  modelFit: HumanModelFit;
  onSelectGarment: (id: string | null) => void;
  onEquipGarment: (id: string) => void;
  onUnequipSlot: (slot: "top" | "outerwear" | "bottom") => void;
  onSelectSpotlight: (id: string) => void;
  onUpdateSpotlightPosition: (id: string, position: [number, number, number]) => void;
  onCameraMovedManually: () => void;
}

const RACK_POS = new THREE.Vector3(-1.28, 0, -0.15);
const MANNEQUIN_POS = new THREE.Vector3(1.12, 0, 0.1);

export const AtelierViewport3D: React.FC<AtelierViewport3DProps> = ({
  garments,
  equipped,
  selectedGarmentId,
  activeSpotlightId,
  isLightingPanelOpen,
  spotlights,
  environment,
  cameraPreset,
  humanModel,
  modelFit,
  onSelectGarment,
  onEquipGarment,
  onUnequipSlot,
  onSelectSpotlight,
  onUpdateSpotlightPosition,
  onCameraMovedManually,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Hover & drag HUD feedback state
  const [hoveredLabel, setHoveredLabel] = useState<{
    text: string;
    subtext: string;
    x: number;
    y: number;
  } | null>(null);
  const [dragState, setDragState] = useState<{
    kind: "garment" | "spotlight";
    id: string;
    name: string;
    fromMode?: "rack" | "mannequin";
    overDropZone: boolean;
  } | null>(null);

  // Mutable refs for event handlers inside animation loop
  const garmentsRef = useRef(garments);
  garmentsRef.current = garments;
  const equippedRef = useRef(equipped);
  equippedRef.current = equipped;
  const spotlightsRef = useRef(spotlights);
  spotlightsRef.current = spotlights;
  const environmentRef = useRef(environment);
  environmentRef.current = environment;
  const lightingOpenRef = useRef(isLightingPanelOpen);
  lightingOpenRef.current = isLightingPanelOpen;
  const callbacksRef = useRef({
    onSelectGarment,
    onEquipGarment,
    onUnequipSlot,
    onSelectSpotlight,
    onUpdateSpotlightPosition,
    onCameraMovedManually,
  });
  callbacksRef.current = {
    onSelectGarment,
    onEquipGarment,
    onUnequipSlot,
    onSelectSpotlight,
    onUpdateSpotlightPosition,
    onCameraMovedManually,
  };

  // Three.js object references
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const needsRenderRef = useRef(true);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const rackGarmentsGroupRef = useRef<THREE.Group | null>(null);
  const mannequinRefs = useRef<ReturnType<typeof createMannequinGroup> | null>(null);
  const spotlightObjsRef = useRef<
    Map<
      string,
      {
        light: THREE.SpotLight;
        targetObj: THREE.Object3D;
        housingGroup: THREE.Group;
        coneMesh: THREE.Mesh;
        ringMesh: THREE.Mesh;
      }
    >
  >(new Map());
  const ambientLightRef = useRef<THREE.AmbientLight | null>(null);
  const hemiLightRef = useRef<THREE.HemisphereLight | null>(null);
  const softboxRef = useRef<THREE.DirectionalLight | null>(null);
  const importedModelRef = useRef<THREE.Group | null>(null);
  const roomMaterialsRef = useRef<{
    surface: THREE.MeshStandardMaterial;
  } | null>(null);

  // Smooth camera transition target
  const cameraTransitionRef = useRef<{
    active: boolean;
    targetPos: THREE.Vector3;
    targetLookAt: THREE.Vector3;
  }>({
    active: false,
    targetPos: new THREE.Vector3(0, 1.65, 4.35),
    targetLookAt: new THREE.Vector3(0, 1.15, 0),
  });

  // Initialize Three.js Studio Scene
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#F5F3EF");
    scene.fog = new THREE.Fog("#F5F3EF", 9.5, 20);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      36,
      container.clientWidth / container.clientHeight,
      0.1,
      50,
    );
    const initialPose = presetPosition(cameraPreset, camera.aspect);
    camera.position.copy(initialPose.position);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });
    rendererRef.current = renderer;
    const unsubscribeTextures = subscribeFabricTextureUpdates(() => {
      needsRenderRef.current = true;
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.VSMShadowMap;
    renderer.shadowMap.autoUpdate = false;
    renderer.toneMapping = THREE.AgXToneMapping;
    renderer.toneMappingExposure = 1.05;
    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    // Physically Based Studio Softbox Reflections (IBL)
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const studioEnvironment = new RoomEnvironment();
    const envTarget = pmremGenerator.fromScene(studioEnvironment, 0.04);
    studioEnvironment.dispose();
    scene.environment = envTarget.texture;
    scene.environmentIntensity = 0.85;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.maxPolarAngle = Math.PI / 2 - 0.02; // Stay above studio floor
    controls.minDistance = 1.6;
    controls.maxDistance = 20;
    controls.minAzimuthAngle = -Math.PI * 0.55;
    controls.maxAzimuthAngle = Math.PI * 0.55;
    controls.target.copy(initialPose.target);
    controlsRef.current = controls;

    const handleUserControlStart = () => {
      cameraTransitionRef.current.active = false;
      callbacksRef.current.onCameraMovedManually();
    };
    controls.addEventListener("start", handleUserControlStart);

    // --- Minimalist Seamless Photography Cyclorama Cove ---
    const floorMat = new THREE.MeshStandardMaterial({
      color: "#e7e3db",
      roughness: 0.96,
      metalness: 0,
    });
    roomMaterialsRef.current = { surface: floorMat };

    const coveGeo = createCycloramaGeometry();
    const coveMesh = new THREE.Mesh(coveGeo, floorMat);
    coveMesh.receiveShadow = true;
    scene.add(coveMesh);

    // --- Ambient & Hemisphere Fill Lighting ---
    const ambientLight = new THREE.AmbientLight(0xfffcf7, 0.24);
    scene.add(ambientLight);
    ambientLightRef.current = ambientLight;

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0xdcd6ca, 0.42);
    hemiLight.position.set(0, 6, 0);
    scene.add(hemiLight);
    hemiLightRef.current = hemiLight;

    // A broad, neutral softbox supplies readable form and soft floor contact shadows.
    const softbox = new THREE.DirectionalLight("#fffaf2", 1.25);
    softbox.position.set(-2.8, 5.5, 4.5);
    softbox.target.position.set(0, 1, 0);
    softbox.castShadow = true;
    softbox.shadow.mapSize.set(1024, 1024);
    softbox.shadow.camera.left = -4;
    softbox.shadow.camera.right = 4;
    softbox.shadow.camera.top = 3.5;
    softbox.shadow.camera.bottom = -3;
    softbox.shadow.camera.near = 0.5;
    softbox.shadow.camera.far = 14;
    softbox.shadow.bias = -0.00015;
    softbox.shadow.normalBias = 0.016;
    softbox.shadow.radius = 5;
    softbox.shadow.blurSamples = 4;
    scene.add(softbox, softbox.target);
    softboxRef.current = softbox;

    // --- 3D Wardrobe Rack (Left Stage) ---
    const rackGroup = createWardrobeRackGroup();
    rackGroup.position.copy(RACK_POS);
    rackGroup.rotation.y = 0.14;
    scene.add(rackGroup);

    const rackGarmentsGroup = new THREE.Group();
    rackGarmentsGroup.position.copy(RACK_POS);
    rackGarmentsGroup.rotation.y = 0.14;
    scene.add(rackGarmentsGroup);
    rackGarmentsGroupRef.current = rackGarmentsGroup;

    // --- 3D Articulated Mannequin (Right Stage) ---
    const mannequin = createMannequinGroup();
    mannequin.root.position.copy(MANNEQUIN_POS);
    mannequin.root.rotation.y = -0.22;
    scene.add(mannequin.root);
    mannequinRefs.current = mannequin;

    // --- Raycasting & Direct 3D Drag-and-Drop Interaction ---
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const dragPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const dragIntersectPoint = new THREE.Vector3();

    let activeDrag: {
      kind: "garment" | "spotlight";
      id: string;
      fromMode?: "rack" | "mannequin";
      slot?: "top" | "outerwear" | "bottom";
      floatingGroup?: THREE.Group;
      originalObject?: THREE.Object3D;
      startPointer: { x: number; y: number };
      moved: boolean;
    } | null = null;

    const updatePointer = (e: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    };

    const findInteractiveHit = () => {
      raycaster.setFromCamera(pointer, camera);

      // 1. Check spotlight gizmo handles first when visible
      if (environmentRef.current.showLightGizmos && lightingOpenRef.current) {
        const gizmoRoots: THREE.Object3D[] = [];
        spotlightObjsRef.current.forEach((entry) => {
          gizmoRoots.push(entry.housingGroup);
        });
        const gizmoHits = raycaster.intersectObjects(gizmoRoots, true);
        if (gizmoHits.length > 0) {
          let obj: THREE.Object3D | null = gizmoHits[0].object;
          while (obj && !obj.userData?.spotlightId) {
            obj = obj.parent;
          }
          if (obj?.userData?.spotlightId) {
            return {
              kind: "spotlight" as const,
              id: obj.userData.spotlightId as string,
              point: gizmoHits[0].point,
            };
          }
        }
      }

      // 2. Check rack garments and mannequin-equipped garments
      const garmentRoots: THREE.Object3D[] = [];
      if (rackGarmentsGroupRef.current) {
        garmentRoots.push(...rackGarmentsGroupRef.current.children);
      }
      if (mannequinRefs.current) {
        garmentRoots.push(
          ...mannequinRefs.current.slots.outerwear.children,
          ...mannequinRefs.current.slots.top.children,
          ...mannequinRefs.current.slots.bottom.children,
        );
      }

      const hits = raycaster.intersectObjects(garmentRoots, true);
      if (hits.length > 0) {
        let obj: THREE.Object3D | null = hits[0].object;
        while (obj && !obj.userData?.garmentId) {
          obj = obj.parent;
        }
        if (obj?.userData?.garmentId) {
          let garmentObject: THREE.Object3D = obj;
          while (
            garmentObject.parent &&
            garmentObject.parent.userData.garmentId === garmentObject.userData.garmentId
          ) {
            garmentObject = garmentObject.parent;
          }
          return {
            kind: "garment" as const,
            id: garmentObject.userData.garmentId as string,
            mode: (garmentObject.userData.mode as "rack" | "mannequin") || "rack",
            point: hits[0].point,
            object: garmentObject,
          };
        }
      }

      return null;
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      updatePointer(e);
      const hit = findInteractiveHit();
      if (!hit) return;

      // Pause camera orbit while dragging a 3D garment or spotlight
      controls.enabled = false;
      cameraTransitionRef.current.active = false;
      callbacksRef.current.onCameraMovedManually();

      if (hit.kind === "spotlight") {
        callbacksRef.current.onSelectSpotlight(hit.id);
        const sp = spotlightsRef.current.find((s) => s.id === hit.id);
        const camDir = new THREE.Vector3();
        camera.getWorldDirection(camDir);
        dragPlane.setFromNormalAndCoplanarPoint(camDir.negate(), hit.point);

        activeDrag = {
          kind: "spotlight",
          id: hit.id,
          startPointer: { x: e.clientX, y: e.clientY },
          moved: false,
        };
        setDragState({
          kind: "spotlight",
          id: hit.id,
          name: sp?.name || "Spotlight",
          overDropZone: false,
        });
      } else if (hit.kind === "garment") {
        const item = garmentsRef.current.find((g) => g.id === hit.id);
        if (!item) return;

        // Create a floating 3D garment mesh that follows the pointer in 3D space
        const floatingMesh = createGarmentMeshGroup(item, hit.mode, hit.mode === "rack");
        floatingMesh.position.copy(hit.point);
        floatingMesh.visible = false;
        scene.add(floatingMesh);

        // Drag plane facing camera passing through garment pickup point
        const planeNormal = new THREE.Vector3(0, 0, 1);
        dragPlane.setFromNormalAndCoplanarPoint(planeNormal, new THREE.Vector3(0, 1.3, 0.25));

        activeDrag = {
          kind: "garment",
          id: item.id,
          fromMode: hit.mode,
          slot: item.slot,
          floatingGroup: floatingMesh,
          originalObject: hit.object,
          startPointer: { x: e.clientX, y: e.clientY },
          moved: false,
        };

        setDragState({
          kind: "garment",
          id: item.id,
          name: item.name,
          fromMode: hit.mode,
          overDropZone: false,
        });
        setHoveredLabel(null);
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!activeDrag && e.target !== renderer.domElement) {
        setHoveredLabel(null);
        return;
      }
      updatePointer(e);

      if (activeDrag) {
        const distMoved = Math.hypot(
          e.clientX - activeDrag.startPointer.x,
          e.clientY - activeDrag.startPointer.y,
        );
        if (distMoved > 5) {
          activeDrag.moved = true;
          if (activeDrag.floatingGroup) activeDrag.floatingGroup.visible = true;
          if (activeDrag.originalObject) activeDrag.originalObject.visible = false;
        }

        raycaster.setFromCamera(pointer, camera);
        if (raycaster.ray.intersectPlane(dragPlane, dragIntersectPoint)) {
          if (activeDrag.kind === "spotlight") {
            const clampedX = Math.max(-3.1, Math.min(3.4, Number(dragIntersectPoint.x.toFixed(2))));
            const clampedY = Math.max(0.8, Math.min(4.2, Number(dragIntersectPoint.y.toFixed(2))));
            const clampedZ = Math.max(-1.0, Math.min(3.5, Number(dragIntersectPoint.z.toFixed(2))));
            callbacksRef.current.onUpdateSpotlightPosition(activeDrag.id, [
              clampedX,
              clampedY,
              clampedZ,
            ]);
          } else if (activeDrag.kind === "garment" && activeDrag.floatingGroup) {
            activeDrag.floatingGroup.position.set(
              dragIntersectPoint.x,
              Math.max(0.55, Math.min(2.3, dragIntersectPoint.y)),
              0.35,
            );
            // Gentle tilt while dragging
            activeDrag.floatingGroup.rotation.z = -pointer.x * 0.12;
            activeDrag.floatingGroup.rotation.y = pointer.x * 0.28;

            // Check proximity to Mannequin drop zone or Wardrobe Rack drop zone
            const distToMannequin = Math.hypot(
              dragIntersectPoint.x - MANNEQUIN_POS.x,
              dragIntersectPoint.y - 1.25,
            );
            const distToRack = Math.hypot(
              dragIntersectPoint.x - RACK_POS.x,
              dragIntersectPoint.y - 1.35,
            );

            const overTarget =
              activeDrag.fromMode === "rack" ? distToMannequin < 0.95 : distToRack < 1.1;

            setDragState((prev) => (prev ? { ...prev, overDropZone: overTarget } : null));

            if (mannequinRefs.current) {
              const ringMat = mannequinRefs.current.highlightRing
                .material as THREE.MeshBasicMaterial;
              ringMat.opacity = distToMannequin < 0.95 ? 0.75 : 0.22;
              mannequinRefs.current.highlightRing.scale.setScalar(
                distToMannequin < 0.95 ? 1.06 : 1.0,
              );
            }
          }
        }
        return;
      }

      // Standard Hover Detection
      const hit = findInteractiveHit();
      if (hit) {
        renderer.domElement.style.cursor = "grab";
        if (hit.kind === "garment") {
          const item = garmentsRef.current.find((g) => g.id === hit.id);
          if (item) {
            setHoveredLabel({
              text: item.name,
              subtext:
                hit.mode === "rack"
                  ? "Drag to mannequin to wear • Click to inspect"
                  : "Wearing on mannequin • Drag to rack to remove",
              x: e.clientX,
              y: e.clientY,
            });
          }
        } else if (hit.kind === "spotlight") {
          const sp = spotlightsRef.current.find((s) => s.id === hit.id);
          if (sp) {
            setHoveredLabel({
              text: sp.name,
              subtext: `Drag 3D lamp to reposition • ${sp.kelvin}K`,
              x: e.clientX,
              y: e.clientY,
            });
          }
        }
      } else {
        renderer.domElement.style.cursor = "default";
        setHoveredLabel(null);
      }
    };

    const finishPointerInteraction = () => {
      if (!activeDrag) return;
      controls.enabled = true;

      if (activeDrag.kind === "garment") {
        if (activeDrag.floatingGroup) {
          const dropPos = activeDrag.floatingGroup.position.clone();
          scene.remove(activeDrag.floatingGroup);
          disposeMeshTree(activeDrag.floatingGroup);
          if (activeDrag.originalObject) activeDrag.originalObject.visible = true;

          if (!activeDrag.moved) {
            // Simple click selects the garment for inspection
            callbacksRef.current.onSelectGarment(activeDrag.id);
          } else {
            const distToMannequin = Math.hypot(dropPos.x - MANNEQUIN_POS.x, dropPos.y - 1.25);
            const distToRack = Math.hypot(dropPos.x - RACK_POS.x, dropPos.y - 1.35);

            if (activeDrag.fromMode === "rack" && distToMannequin < 0.98) {
              callbacksRef.current.onEquipGarment(activeDrag.id);
              callbacksRef.current.onSelectGarment(activeDrag.id);
            } else if (
              activeDrag.fromMode === "mannequin" &&
              distToRack < 1.15 &&
              activeDrag.slot
            ) {
              callbacksRef.current.onUnequipSlot(activeDrag.slot);
            }
          }
        }
      }

      if (mannequinRefs.current) {
        const ringMat = mannequinRefs.current.highlightRing.material as THREE.MeshBasicMaterial;
        ringMat.opacity = 0.0;
        mannequinRefs.current.highlightRing.scale.setScalar(1.0);
      }

      activeDrag = null;
      setDragState(null);
      needsRenderRef.current = true;
      renderer.shadowMap.needsUpdate = true;
    };

    const domElem = renderer.domElement;
    domElem.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", finishPointerInteraction);
    const cancelPointerInteraction = () => {
      if (activeDrag) activeDrag.moved = false;
      finishPointerInteraction();
    };
    window.addEventListener("pointercancel", cancelPointerInteraction);

    // Resize listener
    const handleResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
      needsRenderRef.current = true;
    };
    window.addEventListener("resize", handleResize);

    // Animation Loop
    let reqId = 0;
    const clock = new THREE.Clock();

    const animate = () => {
      reqId = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      const easing = 1 - Math.exp(-8 * delta);
      const transitioning = cameraTransitionRef.current.active;

      // Smooth preset camera transitions
      if (cameraTransitionRef.current.active) {
        camera.position.lerp(cameraTransitionRef.current.targetPos, easing);
        controls.target.lerp(cameraTransitionRef.current.targetLookAt, easing);
        if (
          camera.position.distanceTo(cameraTransitionRef.current.targetPos) < 0.02 &&
          controls.target.distanceTo(cameraTransitionRef.current.targetLookAt) < 0.02
        ) {
          cameraTransitionRef.current.active = false;
        }
      }

      // Mannequin turntable or editorial stance
      if (mannequinRefs.current) {
        const pose = environmentRef.current.mannequinPose;
        if (pose === "turntable") {
          mannequinRefs.current.bodyPivot.rotation.y += delta * 0.42;
          needsRenderRef.current = true;
          renderer.shadowMap.needsUpdate = true;
        } else if (pose === "relaxed") {
          if (Math.abs(mannequinRefs.current.bodyPivot.rotation.y - 0.28) > 0.001) {
            needsRenderRef.current = true;
            renderer.shadowMap.needsUpdate = true;
          }
          mannequinRefs.current.bodyPivot.rotation.y = THREE.MathUtils.lerp(
            mannequinRefs.current.bodyPivot.rotation.y,
            0.28,
            easing,
          );
        } else {
          if (Math.abs(mannequinRefs.current.bodyPivot.rotation.y) > 0.001) {
            needsRenderRef.current = true;
            renderer.shadowMap.needsUpdate = true;
          }
          mannequinRefs.current.bodyPivot.rotation.y = THREE.MathUtils.lerp(
            mannequinRefs.current.bodyPivot.rotation.y,
            0,
            easing,
          );
        }
      }

      if (activeDrag?.moved) {
        needsRenderRef.current = true;
        renderer.shadowMap.needsUpdate = true;
      }

      const cameraChanged = controls.update();
      if (
        cameraChanged ||
        transitioning ||
        needsRenderRef.current ||
        renderer.shadowMap.needsUpdate
      ) {
        renderer.render(scene, camera);
        needsRenderRef.current = false;
      }
    };
    animate();

    return () => {
      cancelAnimationFrame(reqId);
      unsubscribeTextures();
      controls.removeEventListener("start", handleUserControlStart);
      domElem.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", finishPointerInteraction);
      window.removeEventListener("pointercancel", cancelPointerInteraction);
      window.removeEventListener("resize", handleResize);
      controls.dispose();
      disposeMeshTree(scene);
      spotlightObjsRef.current.forEach(({ light }) => light.dispose());
      spotlightObjsRef.current.clear();
      softbox.dispose();
      envTarget.dispose();
      pmremGenerator.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      mannequinRefs.current = null;
      rackGarmentsGroupRef.current = null;
      importedModelRef.current = null;
      rendererRef.current = null;
    };
  }, []);

  // Rebuild 3D Wardrobe Rack Garments & Equipped Mannequin Garments whenever `garments` or `equipped` changes
  useEffect(() => {
    const rackGroup = rackGarmentsGroupRef.current;
    const mannequin = mannequinRefs.current;
    if (!rackGroup || !mannequin) return;

    // Clear previous meshes
    for (const root of [
      rackGroup,
      mannequin.slots.top,
      mannequin.slots.outerwear,
      mannequin.slots.bottom,
    ]) {
      disposeMeshTree(root);
      root.clear();
    }

    const equippedIds = new Set(
      [equipped.top, equipped.outerwear, equipped.bottom].filter(Boolean) as string[],
    );

    // 1. Place unequipped garments along the 3D brass wardrobe rail
    const rackItems = garments.filter((g) => !equippedIds.has(g.id));
    const maxSpan = 1.68;
    const count = rackItems.length;

    rackItems.forEach((item, index) => {
      const meshGroup = createGarmentMeshGroup(item, "rack", true);
      const offsetX = count === 1 ? 0 : -maxSpan / 2 + (index / Math.max(1, count - 1)) * maxSpan;

      // Hang slightly angled like real boutique hangers on a rail
      meshGroup.position.set(offsetX, 1.813, 0);
      meshGroup.rotation.y = 0.94;

      rackGroup.add(meshGroup);
    });

    // 2. Equip worn garments onto the 3D Mannequin anatomy slots
    if (equipped.top) {
      const topItem = garments.find((g) => g.id === equipped.top);
      if (topItem) {
        const topMesh = createGarmentMeshGroup(topItem, "mannequin", false);
        mannequin.slots.top.add(topMesh);
      }
    }

    if (equipped.outerwear) {
      const outerItem = garments.find((g) => g.id === equipped.outerwear);
      if (outerItem) {
        const outerMesh = createGarmentMeshGroup(outerItem, "mannequin", false);
        mannequin.slots.outerwear.add(outerMesh);
      }
    }

    if (equipped.bottom) {
      const bottomItem = garments.find((g) => g.id === equipped.bottom);
      if (bottomItem) {
        const bottomMesh = createGarmentMeshGroup(bottomItem, "mannequin", false);
        mannequin.slots.bottom.add(bottomMesh);
      }
    }
    needsRenderRef.current = true;
    if (rendererRef.current) rendererRef.current.shadowMap.needsUpdate = true;
  }, [garments, equipped]);

  useEffect(() => {
    rackGarmentsGroupRef.current?.children.forEach((object) => {
      object.position.z = object.userData.garmentId === selectedGarmentId ? 0.025 : 0;
    });
    needsRenderRef.current = true;
    if (rendererRef.current) rendererRef.current.shadowMap.needsUpdate = true;
  }, [garments, equipped, selectedGarmentId]);

  useEffect(() => {
    const mannequin = mannequinRefs.current;
    if (!mannequin) return;
    mannequin.formGroup.visible = !humanModel;
    mannequin.importedSlot.clear();
    importedModelRef.current = null;
    if (humanModel) {
      const object = cloneSkeleton(humanModel.object);
      object.traverse((node) => {
        node.userData.importedHuman = true;
      });
      const fitGroup = new THREE.Group();
      fitGroup.add(object);
      mannequin.importedSlot.add(fitGroup);
      importedModelRef.current = fitGroup;
    }
    needsRenderRef.current = true;
    if (rendererRef.current) rendererRef.current.shadowMap.needsUpdate = true;
  }, [humanModel]);

  useEffect(() => {
    if (!importedModelRef.current) return;
    importedModelRef.current.scale.set(modelFit.width, 1, modelFit.depth);
    importedModelRef.current.rotation.y = THREE.MathUtils.degToRad(modelFit.rotation);
    needsRenderRef.current = true;
    if (rendererRef.current) rendererRef.current.shadowMap.needsUpdate = true;
  }, [humanModel, modelFit]);

  // Synchronize Draggable 3D Spotlights & Light Cones
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    const map = spotlightObjsRef.current;
    const incomingIds = new Set(spotlights.map((s) => s.id));

    // Remove deleted lights
    for (const [id, entry] of map.entries()) {
      if (!incomingIds.has(id)) {
        scene.remove(entry.light);
        scene.remove(entry.targetObj);
        scene.remove(entry.housingGroup);
        disposeMeshTree(entry.housingGroup);
        entry.light.dispose();
        map.delete(id);
      }
    }

    // Create or update spotlights
    spotlights.forEach((cfg) => {
      let entry = map.get(cfg.id);
      const hexColor = kelvinToHex(cfg.kelvin);

      if (!entry) {
        const light = new THREE.SpotLight(hexColor, cfg.intensity);
        light.castShadow = false;
        light.shadow.mapSize.width = 512;
        light.shadow.mapSize.height = 512;
        light.shadow.bias = -0.0004;
        light.shadow.normalBias = 0.012;
        light.shadow.radius = 4;
        light.shadow.blurSamples = 4;
        light.distance = 12;
        light.decay = 1.6;

        const targetObj = new THREE.Object3D();
        scene.add(targetObj);
        light.target = targetObj;
        scene.add(light);

        // 3D Track Spotlight Housing + Draggable Gizmo Ring + Light Cone
        const housingGroup = new THREE.Group();
        housingGroup.userData = { spotlightId: cfg.id };

        const bodyMat = new THREE.MeshStandardMaterial({
          color: 0x181817,
          roughness: 0.35,
          metalness: 0.8,
        });
        const canGeo = new THREE.CylinderGeometry(0.048, 0.062, 0.18, 20);
        canGeo.rotateX(Math.PI / 2);
        const canMesh = new THREE.Mesh(canGeo, bodyMat);
        canMesh.userData = { spotlightId: cfg.id };
        housingGroup.add(canMesh);

        // Glowing lens front
        const lensGeo = new THREE.CircleGeometry(0.055, 20);
        const lensMat = new THREE.MeshBasicMaterial({
          color: hexColor,
          side: THREE.DoubleSide,
        });
        const lensMesh = new THREE.Mesh(lensGeo, lensMat);
        lensMesh.position.z = 0.092;
        lensMesh.userData = { spotlightId: cfg.id };
        housingGroup.add(lensMesh);

        // Selection / drag halo ring around spotlight housing
        const ringGeo = new THREE.TorusGeometry(0.09, 0.005, 12, 32);
        const ringMat = new THREE.MeshBasicMaterial({
          color: 0xd96b27,
          transparent: true,
          opacity: 0.5,
        });
        const ringMesh = new THREE.Mesh(ringGeo, ringMat);
        ringMesh.userData = { spotlightId: cfg.id };
        housingGroup.add(ringMesh);

        // Subtle volumetric light beam cone
        const coneGeo = new THREE.ConeGeometry(0.65, 1.6, 24, 1, true);
        coneGeo.translate(0, -0.8, 0);
        coneGeo.rotateX(-Math.PI / 2);
        const coneMat = new THREE.MeshBasicMaterial({
          color: hexColor,
          transparent: true,
          opacity: 0.045,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        const coneMesh = new THREE.Mesh(coneGeo, coneMat);
        coneMesh.raycast = () => {};
        housingGroup.add(coneMesh);

        scene.add(housingGroup);
        entry = { light, targetObj, housingGroup, coneMesh, ringMesh };
        map.set(cfg.id, entry);
      }

      // Apply live parameters
      entry.light.visible = cfg.enabled;
      entry.light.castShadow = isLightingPanelOpen && cfg.id === activeSpotlightId;
      entry.light.color.set(hexColor);
      entry.light.intensity = cfg.enabled ? cfg.intensity * 0.16 : 0;
      entry.light.angle = THREE.MathUtils.degToRad(cfg.angleDeg);
      entry.light.penumbra = cfg.penumbra;
      entry.light.position.set(...cfg.position);
      entry.targetObj.position.set(...cfg.target);

      entry.housingGroup.position.set(...cfg.position);
      entry.housingGroup.lookAt(...cfg.target);
      entry.housingGroup.visible = environment.showLightGizmos && isLightingPanelOpen;
      entry.housingGroup.children.forEach((child) => {
        if (child instanceof THREE.Mesh && child.geometry instanceof THREE.CircleGeometry) {
          (child.material as THREE.MeshBasicMaterial).color.set(hexColor);
        }
      });

      const coneScale = Math.tan(THREE.MathUtils.degToRad(cfg.angleDeg)) * 1.45;
      entry.coneMesh.scale.set(coneScale, coneScale, 1);
      const isSelected = cfg.id === activeSpotlightId;
      entry.coneMesh.visible =
        cfg.enabled && cfg.showCone && environment.showLightGizmos && isLightingPanelOpen;
      (entry.coneMesh.material as THREE.MeshBasicMaterial).color.set(hexColor);

      (entry.ringMesh.material as THREE.MeshBasicMaterial).color.set(
        isSelected ? "#D96B27" : "#8C8982",
      );
      (entry.ringMesh.material as THREE.MeshBasicMaterial).opacity = isLightingPanelOpen
        ? isSelected
          ? 0.9
          : 0.35
        : 0.0;
    });
    needsRenderRef.current = true;
    if (rendererRef.current) rendererRef.current.shadowMap.needsUpdate = true;
  }, [spotlights, activeSpotlightId, isLightingPanelOpen, environment.showLightGizmos]);

  // Synchronize Room Tone & Ambient Light
  useEffect(() => {
    const scene = sceneRef.current;
    const roomMats = roomMaterialsRef.current;
    if (!scene || !roomMats) return;

    if (ambientLightRef.current) {
      ambientLightRef.current.intensity = environment.ambientIntensity * 0.28;
    }
    const noir = environment.roomTone === "obsidian-noir";
    scene.environmentIntensity = environment.ambientIntensity * (noir ? 0.5 : 1);
    if (hemiLightRef.current) hemiLightRef.current.intensity = environment.ambientIntensity * 0.5;
    if (softboxRef.current) softboxRef.current.intensity = environment.ambientIntensity * 1.45;

    if (environment.roomTone === "warm-plaster") {
      scene.background = new THREE.Color("#F5F3EF");
      scene.fog = new THREE.Fog("#F5F3EF", 8.5, 18);
      roomMats.surface.color.set("#e7e3db");
    } else if (environment.roomTone === "concrete-gallery") {
      scene.background = new THREE.Color("#E6E7E8");
      scene.fog = new THREE.Fog("#E6E7E8", 8.5, 18);
      roomMats.surface.color.set("#d8dadd");
    } else if (environment.roomTone === "obsidian-noir") {
      scene.background = new THREE.Color("#18181A");
      scene.fog = new THREE.Fog("#18181A", 8.5, 18);
      roomMats.surface.color.set("#303033");
    }
    needsRenderRef.current = true;
  }, [environment.ambientIntensity, environment.roomTone]);

  // Trigger smooth camera interpolation when `cameraPreset` changes
  useEffect(() => {
    if (cameraPreset === "free") return;
    const transition = cameraTransitionRef.current;
    transition.active = true;

    const pose =
      isLightingPanelOpen && cameraPreset === "room"
        ? { position: new THREE.Vector3(-0.15, 2.25, 8.5), target: new THREE.Vector3(0, 1.65, 0) }
        : presetPosition(cameraPreset, cameraRef.current?.aspect || 1.5);
    transition.targetPos.copy(pose.position);
    transition.targetLookAt.copy(pose.target);
  }, [cameraPreset, isLightingPanelOpen]);

  return (
    <div className="relative w-full h-full overflow-hidden select-none">
      {/* Fullscreen Three.js Canvas Mount */}
      <div ref={containerRef} className="w-full h-full" />

      {/* Floating Hover Tooltip in 3D Space */}
      {hoveredLabel && !dragState && (
        <div
          className="pointer-events-none fixed z-30 px-3 py-1.5 rounded-lg bg-[#141413]/90 text-[#F5F3EF] backdrop-blur-md shadow-lg border border-white/10 transition-opacity duration-75"
          style={{
            left: Math.min(window.innerWidth - 260, hoveredLabel.x + 14),
            top: Math.max(16, hoveredLabel.y - 44),
          }}
        >
          <div className="text-xs font-medium tracking-tight">{hoveredLabel.text}</div>
          <div className="text-[10px] text-[#B8B4AC] font-mono-tech">{hoveredLabel.subtext}</div>
        </div>
      )}

      {/* Active 3D Drag Status Pill */}
      {dragState && (
        <div className="pointer-events-none fixed top-20 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2.5 px-4 py-2 rounded-full bg-[#141413]/90 text-[#F5F3EF] backdrop-blur-xl shadow-xl border border-white/15">
          <span
            className={`w-2 h-2 rounded-full ${
              dragState.overDropZone ? "bg-[#2D7A53] animate-ping" : "bg-[#D96B27]"
            }`}
          />
          <span className="text-xs font-medium">
            {dragState.kind === "spotlight"
              ? `Moving ${dragState.name} in 3D Space`
              : dragState.fromMode === "rack"
                ? dragState.overDropZone
                  ? `Release to dress Mannequin with ${dragState.name}`
                  : `Dragging ${dragState.name} → Drop on Mannequin`
                : dragState.overDropZone
                  ? `Release to return ${dragState.name} to Wardrobe Rack`
                  : `Dragging ${dragState.name} → Drop on Rack to unequip`}
          </span>
        </div>
      )}
    </div>
  );
};
