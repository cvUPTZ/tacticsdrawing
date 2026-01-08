import { useState, useCallback, useEffect, useRef } from 'react';
import * as THREE from 'three';

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
  type: 'corner' | 'edge' | 'center';
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
  const lerpPoint = (
    p1: { x: number; z: number },
    p2: { x: number; z: number },
    t: number
  ) => ({
    x: lerp(p1.x, p2.x, t),
    z: lerp(p1.z, p2.z, t),
  });

  // Bilinear interpolation for any point on the pitch
  const getPitchPoint = (u: number, v: number): THREE.Vector3 => {
    // u: 0 = left, 1 = right
    // v: 0 = top, 1 = bottom
    const topPoint = lerpPoint(corners.topLeft, corners.topRight, u);
    const bottomPoint = lerpPoint(corners.bottomLeft, corners.bottomRight, u);
    const point = lerpPoint(topPoint, bottomPoint, v);
    return new THREE.Vector3(point.x, 0.01, point.z);
  };

  // Standard pitch dimensions for reference
  const pitchLength = 105;
  const pitchWidth = 68;

  // Convert standard coordinates to UV space
  const toUV = (x: number, z: number) => ({
    u: (x + pitchLength / 2) / pitchLength,
    v: (z + pitchWidth / 2) / pitchWidth,
  });

  // === PITCH OUTLINE ===
  group.add(createLine([
    getPitchPoint(0, 0),
    getPitchPoint(1, 0),
    getPitchPoint(1, 1),
    getPitchPoint(0, 1),
    getPitchPoint(0, 0),
  ]));

  // === CENTER LINE ===
  group.add(createLine([
    getPitchPoint(0.5, 0),
    getPitchPoint(0.5, 1),
  ]));

  // === CENTER CIRCLE ===
  const centerCircleRadius = 9.15;
  const circlePoints: THREE.Vector3[] = [];
  const segments = 64;
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    const x = Math.cos(angle) * centerCircleRadius;
    const z = Math.sin(angle) * centerCircleRadius;
    const uv = toUV(x, z);
    circlePoints.push(getPitchPoint(uv.u, uv.v));
  }
  group.add(createLine(circlePoints));

  // === CENTER SPOT ===
  const spotPoints: THREE.Vector3[] = [];
  for (let i = 0; i <= 16; i++) {
    const angle = (i / 16) * Math.PI * 2;
    const x = Math.cos(angle) * 0.3;
    const z = Math.sin(angle) * 0.3;
    const uv = toUV(x, z);
    spotPoints.push(getPitchPoint(uv.u, uv.v));
  }
  group.add(createLine(spotPoints));

  // === PENALTY AREAS ===
  const penaltyDepth = 16.5;
  const penaltyWidth = 40.32;

  // Left penalty area
  const leftPenalty = [
    { x: -pitchLength / 2, z: -penaltyWidth / 2 },
    { x: -pitchLength / 2 + penaltyDepth, z: -penaltyWidth / 2 },
    { x: -pitchLength / 2 + penaltyDepth, z: penaltyWidth / 2 },
    { x: -pitchLength / 2, z: penaltyWidth / 2 },
  ];
  group.add(createLine(leftPenalty.map(p => {
    const uv = toUV(p.x, p.z);
    return getPitchPoint(uv.u, uv.v);
  })));

  // Right penalty area
  const rightPenalty = [
    { x: pitchLength / 2, z: -penaltyWidth / 2 },
    { x: pitchLength / 2 - penaltyDepth, z: -penaltyWidth / 2 },
    { x: pitchLength / 2 - penaltyDepth, z: penaltyWidth / 2 },
    { x: pitchLength / 2, z: penaltyWidth / 2 },
  ];
  group.add(createLine(rightPenalty.map(p => {
    const uv = toUV(p.x, p.z);
    return getPitchPoint(uv.u, uv.v);
  })));

  // === GOAL AREAS ===
  const goalAreaDepth = 5.5;
  const goalAreaWidth = 18.32;

  // Left goal area
  const leftGoalArea = [
    { x: -pitchLength / 2, z: -goalAreaWidth / 2 },
    { x: -pitchLength / 2 + goalAreaDepth, z: -goalAreaWidth / 2 },
    { x: -pitchLength / 2 + goalAreaDepth, z: goalAreaWidth / 2 },
    { x: -pitchLength / 2, z: goalAreaWidth / 2 },
  ];
  group.add(createLine(leftGoalArea.map(p => {
    const uv = toUV(p.x, p.z);
    return getPitchPoint(uv.u, uv.v);
  })));

  // Right goal area
  const rightGoalArea = [
    { x: pitchLength / 2, z: -goalAreaWidth / 2 },
    { x: pitchLength / 2 - goalAreaDepth, z: -goalAreaWidth / 2 },
    { x: pitchLength / 2 - goalAreaDepth, z: goalAreaWidth / 2 },
    { x: pitchLength / 2, z: goalAreaWidth / 2 },
  ];
  group.add(createLine(rightGoalArea.map(p => {
    const uv = toUV(p.x, p.z);
    return getPitchPoint(uv.u, uv.v);
  })));

  // === PENALTY SPOTS ===
  const penaltySpotDist = 11;
  
  [{ x: -pitchLength / 2 + penaltySpotDist, z: 0 }, { x: pitchLength / 2 - penaltySpotDist, z: 0 }].forEach(spot => {
    const spotPts: THREE.Vector3[] = [];
    for (let i = 0; i <= 16; i++) {
      const angle = (i / 16) * Math.PI * 2;
      const uv = toUV(spot.x + Math.cos(angle) * 0.25, spot.z + Math.sin(angle) * 0.25);
      spotPts.push(getPitchPoint(uv.u, uv.v));
    }
    group.add(createLine(spotPts));
  });

  // === PENALTY ARCS ===
  const arcRadius = 9.15;
  const distFromSpotToBoxEdge = penaltyDepth - penaltySpotDist;
  const arcAngle = Math.acos(distFromSpotToBoxEdge / arcRadius);
  const arcSegments = 32;

  // Left arc
  const leftArcPoints: THREE.Vector3[] = [];
  const leftSpotX = -pitchLength / 2 + penaltySpotDist;
  for (let i = 0; i <= arcSegments; i++) {
    const t = i / arcSegments;
    const angle = -arcAngle + t * (arcAngle * 2);
    const uv = toUV(leftSpotX + Math.cos(angle) * arcRadius, Math.sin(angle) * arcRadius);
    leftArcPoints.push(getPitchPoint(uv.u, uv.v));
  }
  group.add(createLine(leftArcPoints));

  // Right arc
  const rightArcPoints: THREE.Vector3[] = [];
  const rightSpotX = pitchLength / 2 - penaltySpotDist;
  for (let i = 0; i <= arcSegments; i++) {
    const t = i / arcSegments;
    const angle = (Math.PI - arcAngle) + t * (arcAngle * 2);
    const uv = toUV(rightSpotX + Math.cos(angle) * arcRadius, Math.sin(angle) * arcRadius);
    rightArcPoints.push(getPitchPoint(uv.u, uv.v));
  }
  group.add(createLine(rightArcPoints));

  // === CORNER ARCS ===
  const cornerRadius = 1;
  const cornerConfigs = [
    { x: -pitchLength / 2, z: -pitchWidth / 2, startAngle: 0 },
    { x: pitchLength / 2, z: -pitchWidth / 2, startAngle: Math.PI / 2 },
    { x: pitchLength / 2, z: pitchWidth / 2, startAngle: Math.PI },
    { x: -pitchLength / 2, z: pitchWidth / 2, startAngle: -Math.PI / 2 },
  ];

  cornerConfigs.forEach(corner => {
    const cornerPoints: THREE.Vector3[] = [];
    for (let i = 0; i <= 16; i++) {
      const t = i / 16;
      const angle = corner.startAngle + t * (Math.PI / 2);
      const uv = toUV(corner.x + Math.cos(angle) * cornerRadius, corner.z + Math.sin(angle) * cornerRadius);
      cornerPoints.push(getPitchPoint(uv.u, uv.v));
    }
    group.add(createLine(cornerPoints));
  });

  // === GOALS ===
  const goalWidth = 7.32;
  const goalHeight = 2.44;
  const goalDepth = 1.5;

  const createGoal = (xPos: number, isLeft: boolean) => {
    const goalGroup = new THREE.Group();
    const dir = isLeft ? -1 : 1;
    
    // Get base positions
    const topPostUV = toUV(xPos, -goalWidth / 2);
    const bottomPostUV = toUV(xPos, goalWidth / 2);
    const topPost = getPitchPoint(topPostUV.u, topPostUV.v);
    const bottomPost = getPitchPoint(bottomPostUV.u, bottomPostUV.v);

    // Front frame
    goalGroup.add(createLine([
      new THREE.Vector3(topPost.x, 0, topPost.z),
      new THREE.Vector3(topPost.x, goalHeight, topPost.z),
      new THREE.Vector3(bottomPost.x, goalHeight, bottomPost.z),
      new THREE.Vector3(bottomPost.x, 0, bottomPost.z),
    ]));

    // Back frame
    goalGroup.add(createLine([
      new THREE.Vector3(topPost.x + dir * goalDepth, 0, topPost.z),
      new THREE.Vector3(topPost.x + dir * goalDepth, goalHeight * 0.8, topPost.z),
      new THREE.Vector3(bottomPost.x + dir * goalDepth, goalHeight * 0.8, bottomPost.z),
      new THREE.Vector3(bottomPost.x + dir * goalDepth, 0, bottomPost.z),
    ]));

    // Connectors
    goalGroup.add(createLine([
      new THREE.Vector3(topPost.x, goalHeight, topPost.z),
      new THREE.Vector3(topPost.x + dir * goalDepth, goalHeight * 0.8, topPost.z),
    ]));
    goalGroup.add(createLine([
      new THREE.Vector3(bottomPost.x, goalHeight, bottomPost.z),
      new THREE.Vector3(bottomPost.x + dir * goalDepth, goalHeight * 0.8, bottomPost.z),
    ]));

    return goalGroup;
  };

  group.add(createGoal(-pitchLength / 2, true));
  group.add(createGoal(pitchLength / 2, false));

  return group;
}

export function createManipulationHandles(
  corners: PitchCorners,
  activeHandle: string | null
): THREE.Group {
  const group = new THREE.Group();
  
  const handleSize = 2;
  const activeColor = 0x00ff88;
  const inactiveColor = 0xffaa00;
  const edgeColor = 0x00aaff;

  // Corner handles
  const cornerPositions = [
    { id: 'topLeft', pos: corners.topLeft, cursor: 'nw-resize' },
    { id: 'topRight', pos: corners.topRight, cursor: 'ne-resize' },
    { id: 'bottomLeft', pos: corners.bottomLeft, cursor: 'sw-resize' },
    { id: 'bottomRight', pos: corners.bottomRight, cursor: 'se-resize' },
  ];

  cornerPositions.forEach(({ id, pos }) => {
    const isActive = activeHandle === id;
    const geometry = new THREE.BoxGeometry(handleSize, handleSize, handleSize);
    const material = new THREE.MeshBasicMaterial({
      color: isActive ? activeColor : inactiveColor,
      transparent: true,
      opacity: isActive ? 1 : 0.8,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(pos.x, handleSize / 2, pos.z);
    mesh.userData = { handleId: id, type: 'corner' };
    group.add(mesh);

    // Outline
    const edgesGeo = new THREE.EdgesGeometry(geometry);
    const edgesMat = new THREE.LineBasicMaterial({ color: 0xffffff });
    const edges = new THREE.LineSegments(edgesGeo, edgesMat);
    edges.position.copy(mesh.position);
    group.add(edges);
  });

  // Edge handles (midpoints)
  const edgePositions = [
    { id: 'top', pos: { x: (corners.topLeft.x + corners.topRight.x) / 2, z: (corners.topLeft.z + corners.topRight.z) / 2 }, cursor: 'n-resize' },
    { id: 'bottom', pos: { x: (corners.bottomLeft.x + corners.bottomRight.x) / 2, z: (corners.bottomLeft.z + corners.bottomRight.z) / 2 }, cursor: 's-resize' },
    { id: 'left', pos: { x: (corners.topLeft.x + corners.bottomLeft.x) / 2, z: (corners.topLeft.z + corners.bottomLeft.z) / 2 }, cursor: 'w-resize' },
    { id: 'right', pos: { x: (corners.topRight.x + corners.bottomRight.x) / 2, z: (corners.topRight.z + corners.bottomRight.z) / 2 }, cursor: 'e-resize' },
  ];

  edgePositions.forEach(({ id, pos }) => {
    const isActive = activeHandle === id;
    const geometry = new THREE.SphereGeometry(handleSize * 0.6, 16, 16);
    const material = new THREE.MeshBasicMaterial({
      color: isActive ? activeColor : edgeColor,
      transparent: true,
      opacity: isActive ? 1 : 0.7,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(pos.x, handleSize / 2, pos.z);
    mesh.userData = { handleId: id, type: 'edge' };
    group.add(mesh);
  });

  // Center handle (for moving entire pitch)
  const centerX = (corners.topLeft.x + corners.topRight.x + corners.bottomLeft.x + corners.bottomRight.x) / 4;
  const centerZ = (corners.topLeft.z + corners.topRight.z + corners.bottomLeft.z + corners.bottomRight.z) / 4;
  const isActiveCenter = activeHandle === 'center';
  const centerGeo = new THREE.OctahedronGeometry(handleSize * 0.8);
  const centerMat = new THREE.MeshBasicMaterial({
    color: isActiveCenter ? activeColor : 0xff4488,
    transparent: true,
    opacity: isActiveCenter ? 1 : 0.8,
  });
  const centerMesh = new THREE.Mesh(centerGeo, centerMat);
  centerMesh.position.set(centerX, handleSize, centerZ);
  centerMesh.userData = { handleId: 'center', type: 'center' };
  group.add(centerMesh);

  return group;
}

export function usePitchManipulation(
  initialCorners: PitchCorners = DEFAULT_CORNERS
) {
  const [corners, setCorners] = useState<PitchCorners>(initialCorners);
  const [activeHandle, setActiveHandle] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; z: number } | null>(null);
  const cornersStartRef = useRef<PitchCorners | null>(null);

  const startDrag = useCallback((handleId: string, worldPos: { x: number; z: number }) => {
    setActiveHandle(handleId);
    setIsDragging(true);
    dragStartRef.current = worldPos;
    cornersStartRef.current = { ...corners };
  }, [corners]);

  const updateDrag = useCallback((worldPos: { x: number; z: number }) => {
    if (!isDragging || !activeHandle || !dragStartRef.current || !cornersStartRef.current) return;

    const deltaX = worldPos.x - dragStartRef.current.x;
    const deltaZ = worldPos.z - dragStartRef.current.z;
    const start = cornersStartRef.current;

    setCorners(prev => {
      const newCorners = { ...prev };

      switch (activeHandle) {
        case 'topLeft':
          newCorners.topLeft = { x: start.topLeft.x + deltaX, z: start.topLeft.z + deltaZ };
          break;
        case 'topRight':
          newCorners.topRight = { x: start.topRight.x + deltaX, z: start.topRight.z + deltaZ };
          break;
        case 'bottomLeft':
          newCorners.bottomLeft = { x: start.bottomLeft.x + deltaX, z: start.bottomLeft.z + deltaZ };
          break;
        case 'bottomRight':
          newCorners.bottomRight = { x: start.bottomRight.x + deltaX, z: start.bottomRight.z + deltaZ };
          break;
        case 'top':
          newCorners.topLeft = { x: start.topLeft.x, z: start.topLeft.z + deltaZ };
          newCorners.topRight = { x: start.topRight.x, z: start.topRight.z + deltaZ };
          break;
        case 'bottom':
          newCorners.bottomLeft = { x: start.bottomLeft.x, z: start.bottomLeft.z + deltaZ };
          newCorners.bottomRight = { x: start.bottomRight.x, z: start.bottomRight.z + deltaZ };
          break;
        case 'left':
          newCorners.topLeft = { x: start.topLeft.x + deltaX, z: start.topLeft.z };
          newCorners.bottomLeft = { x: start.bottomLeft.x + deltaX, z: start.bottomLeft.z };
          break;
        case 'right':
          newCorners.topRight = { x: start.topRight.x + deltaX, z: start.topRight.z };
          newCorners.bottomRight = { x: start.bottomRight.x + deltaX, z: start.bottomRight.z };
          break;
        case 'center':
          newCorners.topLeft = { x: start.topLeft.x + deltaX, z: start.topLeft.z + deltaZ };
          newCorners.topRight = { x: start.topRight.x + deltaX, z: start.topRight.z + deltaZ };
          newCorners.bottomLeft = { x: start.bottomLeft.x + deltaX, z: start.bottomLeft.z + deltaZ };
          newCorners.bottomRight = { x: start.bottomRight.x + deltaX, z: start.bottomRight.z + deltaZ };
          break;
      }

      return newCorners;
    });
  }, [isDragging, activeHandle]);

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
