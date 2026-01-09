import { useState, useCallback, useEffect, useRef } from "react";
import * as THREE from "three";

export interface PitchCorners {
  topLeft: { x: number; z: number };
  topRight: { x: number; z: number };
  bottomLeft: { x: number; z: number };
  bottomRight: { x: number; z: number };
}

export const DEFAULT_CORNERS: PitchCorners = {
  topLeft: { x: -52.5, z: -34 },
  topRight: { x: 52.5, z: -34 },
  bottomLeft: { x: -52.5, z: 34 },
  bottomRight: { x: 52.5, z: 34 },
};

interface HandleInfo {
  id: string;
  type: "corner" | "edge" | "center";
  position: THREE.Vector3;
  cursor: string;
}

export function createPitchFromCorners(corners: PitchCorners): THREE.Group {
  const group = new THREE.Group();

  const lineMat = new THREE.LineBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 1,
  });

  const createLine = (points: THREE.Vector3[]) => {
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    return new THREE.Line(geometry, lineMat);
  };

  // Helper to interpolate between corners
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const lerpPoint = (p1: { x: number; z: number }, p2: { x: number; z: number }, t: number) => ({
    x: lerp(p1.x, p2.x, t),
    z: lerp(p1.z, p2.z, t),
  });

  // Bilinear interpolation for any point on the pitch
  const getPitchPoint = (u: number, v: number): THREE.Vector3 => {
    const topPoint = lerpPoint(corners.topLeft, corners.topRight, u);
    const bottomPoint = lerpPoint(corners.bottomLeft, corners.bottomRight, u);
    const point = lerpPoint(topPoint, bottomPoint, v);
    return new THREE.Vector3(point.x, 0.01, point.z);
  };

  const pitchLength = 105;
  const pitchWidth = 68;

  const toUV = (x: number, z: number) => ({
    u: (x + pitchLength / 2) / pitchLength,
    v: (z + pitchWidth / 2) / pitchWidth,
  });

  // PITCH OUTLINE
  group.add(
    createLine([
      getPitchPoint(0, 0),
      getPitchPoint(1, 0),
      getPitchPoint(1, 1),
      getPitchPoint(0, 1),
      getPitchPoint(0, 0),
    ]),
  );

  // CENTER LINE
  group.add(createLine([getPitchPoint(0.5, 0), getPitchPoint(0.5, 1)]));

  // CENTER CIRCLE
  const centerCircleRadius = 9.15;
  const circlePoints: THREE.Vector3[] = [];
  for (let i = 0; i <= 64; i++) {
    const angle = (i / 64) * Math.PI * 2;
    const uv = toUV(Math.cos(angle) * centerCircleRadius, Math.sin(angle) * centerCircleRadius);
    circlePoints.push(getPitchPoint(uv.u, uv.v));
  }
  group.add(createLine(circlePoints));

  // CENTER SPOT
  const spotPoints: THREE.Vector3[] = [];
  for (let i = 0; i <= 16; i++) {
    const angle = (i / 16) * Math.PI * 2;
    const uv = toUV(Math.cos(angle) * 0.3, Math.sin(angle) * 0.3);
    spotPoints.push(getPitchPoint(uv.u, uv.v));
  }
  group.add(createLine(spotPoints));

  // PENALTY AREAS
  const penaltyDepth = 16.5;
  const penaltyWidth = 40.32;

  [
    [
      { x: -pitchLength / 2, z: -penaltyWidth / 2 },
      { x: -pitchLength / 2 + penaltyDepth, z: -penaltyWidth / 2 },
      { x: -pitchLength / 2 + penaltyDepth, z: penaltyWidth / 2 },
      { x: -pitchLength / 2, z: penaltyWidth / 2 },
    ],
    [
      { x: pitchLength / 2, z: -penaltyWidth / 2 },
      { x: pitchLength / 2 - penaltyDepth, z: -penaltyWidth / 2 },
      { x: pitchLength / 2 - penaltyDepth, z: penaltyWidth / 2 },
      { x: pitchLength / 2, z: penaltyWidth / 2 },
    ],
  ].forEach((area) => {
    group.add(createLine(area.map((p) => getPitchPoint(toUV(p.x, p.z).u, toUV(p.x, p.z).v))));
  });

  // GOAL AREAS
  const goalAreaDepth = 5.5;
  const goalAreaWidth = 18.32;

  [
    [
      { x: -pitchLength / 2, z: -goalAreaWidth / 2 },
      { x: -pitchLength / 2 + goalAreaDepth, z: -goalAreaWidth / 2 },
      { x: -pitchLength / 2 + goalAreaDepth, z: goalAreaWidth / 2 },
      { x: -pitchLength / 2, z: goalAreaWidth / 2 },
    ],
    [
      { x: pitchLength / 2, z: -goalAreaWidth / 2 },
      { x: pitchLength / 2 - goalAreaDepth, z: -goalAreaWidth / 2 },
      { x: pitchLength / 2 - goalAreaDepth, z: goalAreaWidth / 2 },
      { x: pitchLength / 2, z: goalAreaWidth / 2 },
    ],
  ].forEach((area) => {
    group.add(createLine(area.map((p) => getPitchPoint(toUV(p.x, p.z).u, toUV(p.x, p.z).v))));
  });

  // PENALTY SPOTS & ARCS
  const penaltySpotDist = 11;
  const arcRadius = 9.15;
  const distFromSpotToBoxEdge = penaltyDepth - penaltySpotDist;
  const arcAngle = Math.acos(distFromSpotToBoxEdge / arcRadius);

  [
    { spotX: -pitchLength / 2 + penaltySpotDist, angleOffset: 0 },
    { spotX: pitchLength / 2 - penaltySpotDist, angleOffset: Math.PI },
  ].forEach(({ spotX, angleOffset }) => {
    // Spot
    const spotPts: THREE.Vector3[] = [];
    for (let i = 0; i <= 16; i++) {
      const angle = (i / 16) * Math.PI * 2;
      const uv = toUV(spotX + Math.cos(angle) * 0.25, Math.sin(angle) * 0.25);
      spotPts.push(getPitchPoint(uv.u, uv.v));
    }
    group.add(createLine(spotPts));

    // Arc
    const arcPts: THREE.Vector3[] = [];
    for (let i = 0; i <= 32; i++) {
      const t = i / 32;
      const angle = angleOffset === 0 ? -arcAngle + t * (arcAngle * 2) : Math.PI - arcAngle + t * (arcAngle * 2);
      const uv = toUV(spotX + Math.cos(angle) * arcRadius, Math.sin(angle) * arcRadius);
      arcPts.push(getPitchPoint(uv.u, uv.v));
    }
    group.add(createLine(arcPts));
  });

  // CORNER ARCS
  const cornerRadius = 1;
  [
    { x: -pitchLength / 2, z: -pitchWidth / 2, startAngle: 0 },
    { x: pitchLength / 2, z: -pitchWidth / 2, startAngle: Math.PI / 2 },
    { x: pitchLength / 2, z: pitchWidth / 2, startAngle: Math.PI },
    { x: -pitchLength / 2, z: pitchWidth / 2, startAngle: -Math.PI / 2 },
  ].forEach((corner) => {
    const cornerPts: THREE.Vector3[] = [];
    for (let i = 0; i <= 16; i++) {
      const angle = corner.startAngle + (i / 16) * (Math.PI / 2);
      const uv = toUV(corner.x + Math.cos(angle) * cornerRadius, corner.z + Math.sin(angle) * cornerRadius);
      cornerPts.push(getPitchPoint(uv.u, uv.v));
    }
    group.add(createLine(cornerPts));
  });

  // GOALS
  const goalWidth = 7.32;
  const goalHeight = 2.44;
  const goalDepth = 1.5;

  [-pitchLength / 2, pitchLength / 2].forEach((xPos, idx) => {
    const dir = idx === 0 ? -1 : 1;
    const topPostUV = toUV(xPos, -goalWidth / 2);
    const bottomPostUV = toUV(xPos, goalWidth / 2);
    const topPost = getPitchPoint(topPostUV.u, topPostUV.v);
    const bottomPost = getPitchPoint(bottomPostUV.u, bottomPostUV.v);

    group.add(
      createLine([
        new THREE.Vector3(topPost.x, 0, topPost.z),
        new THREE.Vector3(topPost.x, goalHeight, topPost.z),
        new THREE.Vector3(bottomPost.x, goalHeight, bottomPost.z),
        new THREE.Vector3(bottomPost.x, 0, bottomPost.z),
      ]),
    );

    group.add(
      createLine([
        new THREE.Vector3(topPost.x + dir * goalDepth, 0, topPost.z),
        new THREE.Vector3(topPost.x + dir * goalDepth, goalHeight * 0.8, topPost.z),
        new THREE.Vector3(bottomPost.x + dir * goalDepth, goalHeight * 0.8, bottomPost.z),
        new THREE.Vector3(bottomPost.x + dir * goalDepth, 0, bottomPost.z),
      ]),
    );

    group.add(
      createLine([
        new THREE.Vector3(topPost.x, goalHeight, topPost.z),
        new THREE.Vector3(topPost.x + dir * goalDepth, goalHeight * 0.8, topPost.z),
      ]),
    );
    group.add(
      createLine([
        new THREE.Vector3(bottomPost.x, goalHeight, bottomPost.z),
        new THREE.Vector3(bottomPost.x + dir * goalDepth, goalHeight * 0.8, bottomPost.z),
      ]),
    );
  });

  return group;
}

export function createManipulationHandles(corners: PitchCorners, activeHandle: string | null): THREE.Group {
  const group = new THREE.Group();

  // MUCH LARGER HANDLES
  const cornerHandleSize = 3.5;
  const edgeHandleSize = 2.5;
  const centerHandleSize = 3;

  // BRIGHT COLORS
  const activeColor = 0x00ff88;
  const cornerColor = 0xffaa00;
  const edgeColor = 0x00d4ff;
  const centerColor = 0xff4488;

  const createHandle = (id: string, pos: { x: number; z: number }, isCorner: boolean, baseColor: number) => {
    const isActive = activeHandle === id;
    const size = isCorner ? cornerHandleSize : id === "center" ? centerHandleSize : edgeHandleSize;
    const handleGroup = new THREE.Group();

    // MAIN SPHERE - Large and bright
    const sphereGeometry = new THREE.SphereGeometry(size * 0.6, 24, 24);
    const sphereMaterial = new THREE.MeshBasicMaterial({
      color: isActive ? activeColor : baseColor,
      transparent: true,
      opacity: 1.0,
      depthTest: false,
    });
    const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
    sphere.position.set(pos.x, size, pos.z);
    sphere.userData = { handleId: id };
    sphere.renderOrder = 999;
    handleGroup.add(sphere);

    // OUTER GLOW RING
    const ringGeometry = new THREE.RingGeometry(size * 0.8, size * 1.1, 32);
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: isActive ? activeColor : baseColor,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
      depthTest: false,
    });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(pos.x, 0.1, pos.z);
    ring.userData = { handleId: id };
    ring.renderOrder = 998;
    handleGroup.add(ring);

    // VERTICAL POLE
    const poleHeight = size * 2;
    const poleGeometry = new THREE.CylinderGeometry(size * 0.2, size * 0.2, poleHeight, 12);
    const poleMaterial = new THREE.MeshBasicMaterial({
      color: isActive ? activeColor : baseColor,
      transparent: true,
      opacity: 0.9,
      depthTest: false,
    });
    const pole = new THREE.Mesh(poleGeometry, poleMaterial);
    pole.position.set(pos.x, poleHeight / 2, pos.z);
    pole.userData = { handleId: id };
    pole.renderOrder = 997;
    handleGroup.add(pole);

    // GROUND CIRCLE
    const groundGeometry = new THREE.CircleGeometry(size * 0.5, 32);
    const groundMaterial = new THREE.MeshBasicMaterial({
      color: isActive ? activeColor : baseColor,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
      depthTest: false,
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(pos.x, 0.02, pos.z);
    ground.userData = { handleId: id };
    ground.renderOrder = 996;
    handleGroup.add(ground);

    // EDGE OUTLINE for corners
    if (isCorner) {
      const edgesGeo = new THREE.EdgesGeometry(sphereGeometry);
      const edgesMat = new THREE.LineBasicMaterial({
        color: 0xffffff,
        depthTest: false,
      });
      const edges = new THREE.LineSegments(edgesGeo, edgesMat);
      edges.position.copy(sphere.position);
      edges.userData = { handleId: id };
      edges.renderOrder = 1000;
      handleGroup.add(edges);
    }

    return handleGroup;
  };

  // CORNER HANDLES (4)
  [
    { id: "topLeft", pos: corners.topLeft },
    { id: "topRight", pos: corners.topRight },
    { id: "bottomLeft", pos: corners.bottomLeft },
    { id: "bottomRight", pos: corners.bottomRight },
  ].forEach(({ id, pos }) => {
    group.add(createHandle(id, pos, true, cornerColor));
  });

  // EDGE HANDLES (4)
  [
    {
      id: "top",
      pos: { x: (corners.topLeft.x + corners.topRight.x) / 2, z: (corners.topLeft.z + corners.topRight.z) / 2 },
    },
    {
      id: "bottom",
      pos: {
        x: (corners.bottomLeft.x + corners.bottomRight.x) / 2,
        z: (corners.bottomLeft.z + corners.bottomRight.z) / 2,
      },
    },
    {
      id: "left",
      pos: { x: (corners.topLeft.x + corners.bottomLeft.x) / 2, z: (corners.topLeft.z + corners.bottomLeft.z) / 2 },
    },
    {
      id: "right",
      pos: { x: (corners.topRight.x + corners.bottomRight.x) / 2, z: (corners.topRight.z + corners.bottomRight.z) / 2 },
    },
  ].forEach(({ id, pos }) => {
    group.add(createHandle(id, pos, false, edgeColor));
  });

  // CENTER HANDLE (1)
  const centerX = (corners.topLeft.x + corners.topRight.x + corners.bottomLeft.x + corners.bottomRight.x) / 4;
  const centerZ = (corners.topLeft.z + corners.topRight.z + corners.bottomLeft.z + corners.bottomRight.z) / 4;
  group.add(createHandle("center", { x: centerX, z: centerZ }, false, centerColor));

  console.log("✅ Created manipulation handles:", {
    totalHandles: 9,
    groupChildren: group.children.length,
  });

  return group;
}

export function usePitchManipulation(initialCorners: PitchCorners = DEFAULT_CORNERS) {
  const [corners, setCorners] = useState<PitchCorners>(initialCorners);
  const [activeHandle, setActiveHandle] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; z: number } | null>(null);
  const cornersStartRef = useRef<PitchCorners | null>(null);

  const startDrag = useCallback(
    (handleId: string, worldPos: { x: number; z: number }) => {
      setActiveHandle(handleId);
      setIsDragging(true);
      dragStartRef.current = worldPos;
      cornersStartRef.current = { ...corners };
    },
    [corners],
  );

  const updateDrag = useCallback(
    (worldPos: { x: number; z: number }) => {
      if (!isDragging || !activeHandle || !dragStartRef.current || !cornersStartRef.current) return;

      const deltaX = worldPos.x - dragStartRef.current.x;
      const deltaZ = worldPos.z - dragStartRef.current.z;
      const start = cornersStartRef.current;

      setCorners((prev) => {
        const newCorners = { ...prev };

        switch (activeHandle) {
          case "topLeft":
            newCorners.topLeft = { x: start.topLeft.x + deltaX, z: start.topLeft.z + deltaZ };
            break;
          case "topRight":
            newCorners.topRight = { x: start.topRight.x + deltaX, z: start.topRight.z + deltaZ };
            break;
          case "bottomLeft":
            newCorners.bottomLeft = { x: start.bottomLeft.x + deltaX, z: start.bottomLeft.z + deltaZ };
            break;
          case "bottomRight":
            newCorners.bottomRight = { x: start.bottomRight.x + deltaX, z: start.bottomRight.z + deltaZ };
            break;
          case "top":
            newCorners.topLeft = { x: start.topLeft.x, z: start.topLeft.z + deltaZ };
            newCorners.topRight = { x: start.topRight.x, z: start.topRight.z + deltaZ };
            break;
          case "bottom":
            newCorners.bottomLeft = { x: start.bottomLeft.x, z: start.bottomLeft.z + deltaZ };
            newCorners.bottomRight = { x: start.bottomRight.x, z: start.bottomRight.z + deltaZ };
            break;
          case "left":
            newCorners.topLeft = { x: start.topLeft.x + deltaX, z: start.topLeft.z };
            newCorners.bottomLeft = { x: start.bottomLeft.x + deltaX, z: start.bottomLeft.z };
            break;
          case "right":
            newCorners.topRight = { x: start.topRight.x + deltaX, z: start.topRight.z };
            newCorners.bottomRight = { x: start.bottomRight.x + deltaX, z: start.bottomRight.z };
            break;
          case "center":
            newCorners.topLeft = { x: start.topLeft.x + deltaX, z: start.topLeft.z + deltaZ };
            newCorners.topRight = { x: start.topRight.x + deltaX, z: start.topRight.z + deltaZ };
            newCorners.bottomLeft = { x: start.bottomLeft.x + deltaX, z: start.bottomLeft.z + deltaZ };
            newCorners.bottomRight = { x: start.bottomRight.x + deltaX, z: start.bottomRight.z + deltaZ };
            break;
        }

        return newCorners;
      });
    },
    [isDragging, activeHandle],
  );

  const endDrag = useCallback(() => {
    setActiveHandle(null);
    setIsDragging(false);
    dragStartRef.current = null;
    cornersStartRef.current = null;
  }, []);

  const resetCorners = useCallback(() => {
    setCorners(DEFAULT_CORNERS);
  }, []);

  return {
    corners,
    setCorners,
    activeHandle,
    isDragging,
    startDrag,
    updateDrag,
    endDrag,
    resetCorners,
  };
}
