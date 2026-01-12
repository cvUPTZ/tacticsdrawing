import { useState, useCallback, useEffect, useRef } from "react";
import * as THREE from "three";
import { SECTION_VISIBLE_AREAS } from "./PitchSectionSelector";

export interface PitchCorners {
  topLeft: { x: number; z: number };
  topRight: { x: number; z: number };
  bottomLeft: { x: number; z: number };
  bottomRight: { x: number; z: number };
}

export interface LockedHandles {
  [key: string]: boolean;
}

export interface GridHandle {
  id: string;
  x: number;
  z: number;
  type: "corner" | "edge" | "center" | "grid";
}

export const DEFAULT_CORNERS: PitchCorners = {
  topLeft: { x: -52.5, z: -34 },
  topRight: { x: 52.5, z: -34 },
  bottomLeft: { x: -52.5, z: 34 },
  bottomRight: { x: 52.5, z: 34 },
};

export const DEFAULT_LOCKED_HANDLES: LockedHandles = {
  topLeft: false,
  topRight: false,
  bottomLeft: false,
  bottomRight: false,
  top: false,
  bottom: false,
  left: false,
  right: false,
  center: false,
};

// Pitch line reference points for snapping
export const PITCH_SNAP_LINES = {
  // Vertical lines (x-values)
  verticals: [
    { x: -52.5, label: "Left touchline" },
    { x: -36, label: "Left penalty box edge" },
    { x: -47, label: "Left goal area edge" },
    { x: 0, label: "Halfway line" },
    { x: 36, label: "Right penalty box edge" },
    { x: 47, label: "Right goal area edge" },
    { x: 52.5, label: "Right touchline" },
  ],
  // Horizontal lines (z-values)
  horizontals: [
    { z: -34, label: "Top goal line" },
    { z: -20.16, label: "Top penalty box" },
    { z: -9.16, label: "Top goal area" },
    { z: 0, label: "Center line" },
    { z: 9.16, label: "Bottom goal area" },
    { z: 20.16, label: "Bottom penalty box" },
    { z: 34, label: "Bottom goal line" },
  ],
};

// Snapping threshold in world units
export const SNAP_THRESHOLD = 3;

export function snapToLine(
  value: number,
  axis: "x" | "z",
  threshold: number = SNAP_THRESHOLD,
): { value: number; snapped: boolean; label?: string } {
  const lines = axis === "x" ? PITCH_SNAP_LINES.verticals : PITCH_SNAP_LINES.horizontals;
  const key = axis === "x" ? "x" : "z";

  for (const line of lines) {
    const lineValue = (line as any)[key];
    if (Math.abs(value - lineValue) < threshold) {
      return { value: lineValue, snapped: true, label: line.label };
    }
  }

  return { value, snapped: false };
}

interface HandleInfo {
  id: string;
  type: "corner" | "edge" | "center" | "grid";
  position: THREE.Vector3;
  cursor: string;
}

// Generate specific pitch handles for fine control
export function generateGridHandles(corners: PitchCorners, density: number = 5): GridHandle[] {
  const handles: GridHandle[] = [];

  // Bilinear interpolation helper to place handles correctly in the distorted 3D space
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const getGridPoint = (u: number, v: number) => {
    const topX = lerp(corners.topLeft.x, corners.topRight.x, u);
    const topZ = lerp(corners.topLeft.z, corners.topRight.z, u);
    const botX = lerp(corners.bottomLeft.x, corners.bottomRight.x, u);
    const botZ = lerp(corners.bottomLeft.z, corners.bottomRight.z, u);
    return {
      x: lerp(topX, botX, v),
      z: lerp(topZ, botZ, v),
    };
  };

  const pitchLength = 105;
  const pitchWidth = 68;
  const penaltyDepth = 16.5;
  const penaltyWidth = 40.32;
  const goalAreaDepth = 5.5;
  const goalAreaWidth = 18.32;
  const penaltySpotDist = 11;
  const centerCircleRadius = 9.15;

  const toU = (x: number) => (x + pitchLength / 2) / pitchLength;
  const toV = (z: number) => (z + pitchWidth / 2) / pitchWidth;

  // SPECIFIC POINTS FROM THE USER IMAGE
  const points = [
    // CENTER LINE & CIRCLE (Pink)
    { id: "halfway_t", x: 0, z: -pitchWidth / 2 },
    { id: "halfway_b", x: 0, z: pitchWidth / 2 },
    { id: "center_spot", x: 0, z: 0 },
    { id: "center_circle_t", x: 0, z: -centerCircleRadius },
    { id: "center_circle_b", x: 0, z: centerCircleRadius },
    { id: "center_circle_l", x: -centerCircleRadius, z: 0 },
    { id: "center_circle_r", x: centerCircleRadius, z: 0 },

    // LEFT PENALTY & GOAL AREA (Orange)
    { id: "penalty_l_tl", x: -pitchLength / 2 + penaltyDepth, z: -penaltyWidth / 2 },
    { id: "penalty_l_bl", x: -pitchLength / 2 + penaltyDepth, z: penaltyWidth / 2 },
    { id: "penalty_l_gl_t", x: -pitchLength / 2, z: -penaltyWidth / 2 },
    { id: "penalty_l_gl_b", x: -pitchLength / 2, z: penaltyWidth / 2 },
    { id: "goal_l_tl", x: -pitchLength / 2 + goalAreaDepth, z: -goalAreaWidth / 2 },
    { id: "goal_l_bl", x: -pitchLength / 2 + goalAreaDepth, z: goalAreaWidth / 2 },
    { id: "goal_l_gl_t", x: -pitchLength / 2, z: -goalAreaWidth / 2 },
    { id: "goal_l_gl_b", x: -pitchLength / 2, z: goalAreaWidth / 2 },
    { id: "penalty_spot_l", x: -pitchLength / 2 + penaltySpotDist, z: 0 },

    // RIGHT PENALTY & GOAL AREA (Blue)
    { id: "penalty_r_tr", x: pitchLength / 2 - penaltyDepth, z: -penaltyWidth / 2 },
    { id: "penalty_r_br", x: pitchLength / 2 - penaltyDepth, z: penaltyWidth / 2 },
    { id: "penalty_r_gl_t", x: pitchLength / 2, z: -penaltyWidth / 2 },
    { id: "penalty_r_gl_b", x: pitchLength / 2, z: penaltyWidth / 2 },
    { id: "goal_r_tr", x: pitchLength / 2 - goalAreaDepth, z: -goalAreaWidth / 2 },
    { id: "goal_r_br", x: pitchLength / 2 - goalAreaDepth, z: goalAreaWidth / 2 },
    { id: "goal_r_gl_t", x: pitchLength / 2, z: -goalAreaWidth / 2 },
    { id: "goal_r_gl_b", x: pitchLength / 2, z: goalAreaWidth / 2 },
    { id: "penalty_spot_r", x: pitchLength / 2 - penaltySpotDist, z: 0 },
  ];

  for (const p of points) {
    const gp = getGridPoint(toU(p.x), toV(p.z));
    handles.push({
      id: p.id,
      x: gp.x,
      z: gp.z,
      type: "grid",
    });
  }

  return handles;
}

// Reference UV coordinates for specific pitch handles to support local warping
export const PITCH_HANDLE_UVS: Record<string, { u: number; v: number }> = {
  // CENTER LINE & CIRCLE
  halfway_t: { u: 0.5, v: 0 },
  halfway_b: { u: 0.5, v: 1 },
  center_spot: { u: 0.5, v: 0.5 },
  center_circle_t: { u: 0.5, v: (34 - 9.15) / 68 },
  center_circle_b: { u: 0.5, v: (34 + 9.15) / 68 },
  center_circle_l: { u: (52.5 - 9.15) / 105, v: 0.5 },
  center_circle_r: { u: (52.5 + 9.15) / 105, v: 0.5 },

  // LEFT PENALTY & GOAL AREA
  penalty_l_tl: { u: 16.5 / 105, v: (34 - 20.16) / 68 },
  penalty_l_bl: { u: 16.5 / 105, v: (34 + 20.16) / 68 },
  penalty_l_gl_t: { u: 0, v: (34 - 20.16) / 68 },
  penalty_l_gl_b: { u: 0, v: (34 + 20.16) / 68 },
  goal_l_tl: { u: 5.5 / 105, v: (34 - 9.16) / 68 },
  goal_l_bl: { u: 5.5 / 105, v: (34 + 9.16) / 68 },
  goal_l_gl_t: { u: 0, v: (34 - 9.16) / 68 },
  goal_l_gl_b: { u: 0, v: (34 + 9.16) / 68 },
  penalty_spot_l: { u: 11 / 105, v: 0.5 },

  // RIGHT PENALTY & GOAL AREA
  penalty_r_tr: { u: (105 - 16.5) / 105, v: (34 - 20.16) / 68 },
  penalty_r_br: { u: (105 - 16.5) / 105, v: (34 + 20.16) / 68 },
  penalty_r_gl_t: { u: 1, v: (34 - 20.16) / 68 },
  penalty_r_gl_b: { u: 1, v: (34 + 20.16) / 68 },
  goal_r_tr: { u: (105 - 5.5) / 105, v: (34 - 9.16) / 68 },
  goal_r_br: { u: (105 - 5.5) / 105, v: (34 + 9.16) / 68 },
  goal_r_gl_t: { u: 1, v: (34 - 9.16) / 68 },
  goal_r_gl_b: { u: 1, v: (34 + 9.16) / 68 },
  penalty_spot_r: { u: (105 - 11) / 105, v: 0.5 },
};

// Extended handles state including grid points
export interface ExtendedHandles {
  gridOffsets: Record<string, { dx: number; dz: number }>;
}

export const DEFAULT_EXTENDED_HANDLES: ExtendedHandles = {
  gridOffsets: {},
};

export function createPitchFromCorners(
  corners: PitchCorners,
  extendedHandles: ExtendedHandles = DEFAULT_EXTENDED_HANDLES,
  lensDistortion: number = 0,
  selectedSection: string = "full",
): THREE.Group {
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

  // Apply lens distortion correction (barrel/pincushion)
  const applyDistortion = (x: number, z: number): { x: number; z: number } => {
    if (lensDistortion === 0) return { x, z };

    // Normalize to center
    const cx = (corners.topLeft.x + corners.topRight.x + corners.bottomLeft.x + corners.bottomRight.x) / 4;
    const cz = (corners.topLeft.z + corners.topRight.z + corners.bottomLeft.z + corners.bottomRight.z) / 4;

    const dx = x - cx;
    const dz = z - cz;
    const r = Math.sqrt(dx * dx + dz * dz);
    const maxR = 60; // Approximate max distance
    const normalizedR = r / maxR;

    // Barrel distortion formula: r' = r * (1 + k * r^2)
    const k = lensDistortion * 0.01; // Scale the distortion factor
    const factor = 1 + k * normalizedR * normalizedR;

    return {
      x: cx + dx * factor,
      z: cz + dz * factor,
    };
  };

  // Bilinear interpolation for any point on the pitch with grid handle offsets
  const getPitchPoint = (u: number, v: number): THREE.Vector3 => {
    const topPoint = lerpPoint(corners.topLeft, corners.topRight, u);
    const bottomPoint = lerpPoint(corners.bottomLeft, corners.bottomRight, u);
    let point = lerpPoint(topPoint, bottomPoint, v);

    // Apply any grid offsets with weighted influence
    const gridOffsets = extendedHandles.gridOffsets;
    if (Object.keys(gridOffsets).length > 0) {
      let totalWeight = 0;
      let offsetX = 0;
      let offsetZ = 0;

      for (const [handleId, offset] of Object.entries(gridOffsets)) {
        let gridU = -1;
        let gridV = -1;

        // Support for new named handles
        if (PITCH_HANDLE_UVS[handleId]) {
          gridU = PITCH_HANDLE_UVS[handleId].u;
          gridV = PITCH_HANDLE_UVS[handleId].v;
        } else {
          // Fallback to legacy grid pattern if any exist
          const match = handleId.match(/grid_(\d+)_(\d+)/);
          if (match) {
            gridU = parseInt(match[1]) / 5;
            gridV = parseInt(match[2]) / 5;
          }
        }

        if (gridU !== -1) {
          // Calculate distance-based weight (gaussian falloff)
          const distU = u - gridU;
          const distV = v - gridV;
          const dist = Math.sqrt(distU * distU + distV * distV);
          const sigma = 0.25; // Slightly larger influence for named points
          const weight = Math.exp(-(dist * dist) / (2 * sigma * sigma));

          if (weight > 0.01) {
            offsetX += offset.dx * weight;
            offsetZ += offset.dz * weight;
            totalWeight += weight;
          }
        }
      }

      if (totalWeight > 0) {
        point.x += offsetX / totalWeight;
        point.z += offsetZ / totalWeight;
      }
    }

    // Apply lens distortion
    const distorted = applyDistortion(point.x, point.z);
    return new THREE.Vector3(distorted.x, 0.01, distorted.z);
  };

  const pitchLength = 105;
  const pitchWidth = 68;

  // Bounds for clipping based on section
  const area = (SECTION_VISIBLE_AREAS as any)[selectedSection] || SECTION_VISIBLE_AREAS.full;
  const minX = -pitchLength / 2 + area.x1 * pitchLength;
  const maxX = -pitchLength / 2 + area.x2 * pitchLength;
  const minZ = -pitchWidth / 2 + area.y1 * pitchWidth;
  const maxZ = -pitchWidth / 2 + area.y2 * pitchWidth;

  const isPointVisible = (x: number, z: number) => {
    return x >= minX - 0.1 && x <= maxX + 0.1 && z >= minZ - 0.1 && z <= maxZ + 0.1;
  };

  const toUV = (x: number, z: number) => ({
    u: (x + pitchLength / 2) / pitchLength,
    v: (z + pitchWidth / 2) / pitchWidth,
  });

  // PITCH OUTLINE - Segments clipped
  const outlinePoints = [
    { x: -pitchLength / 2, z: -pitchWidth / 2 },
    { x: pitchLength / 2, z: -pitchWidth / 2 },
    { x: pitchLength / 2, z: pitchWidth / 2 },
    { x: -pitchLength / 2, z: pitchWidth / 2 },
    { x: -pitchLength / 2, z: -pitchWidth / 2 },
  ];

  for (let i = 0; i < outlinePoints.length - 1; i++) {
    const p1 = outlinePoints[i];
    const p2 = outlinePoints[i + 1];

    // Simple segment clipping - check if both points are in or at least one is in
    // For better results we'd do line-box clipping, but let's start with checking points
    if (isPointVisible(p1.x, p1.z) || isPointVisible(p2.x, p2.z)) {
      const uv1 = toUV(p1.x, p1.z);
      const uv2 = toUV(p2.x, p2.z);
      group.add(createLine([getPitchPoint(uv1.u, uv1.v), getPitchPoint(uv2.u, uv2.v)]));
    }
  }

  // CENTER LINE
  if (isPointVisible(0, -pitchWidth / 2) || isPointVisible(0, pitchWidth / 2)) {
    group.add(createLine([getPitchPoint(0.5, 0), getPitchPoint(0.5, 1)]));
  }

  // CENTER CIRCLE
  const centerCircleRadius = 9.15;
  for (let i = 0; i < 64; i++) {
    const angle1 = (i / 64) * Math.PI * 2;
    const angle2 = ((i + 1) / 64) * Math.PI * 2;
    const p1 = { x: Math.cos(angle1) * centerCircleRadius, z: Math.sin(angle1) * centerCircleRadius };
    const p2 = { x: Math.cos(angle2) * centerCircleRadius, z: Math.sin(angle2) * centerCircleRadius };

    if (isPointVisible(p1.x, p1.z) || isPointVisible(p2.x, p2.z)) {
      const uv1 = toUV(p1.x, p1.z);
      const uv2 = toUV(p2.x, p2.z);
      group.add(createLine([getPitchPoint(uv1.u, uv1.v), getPitchPoint(uv2.u, uv2.v)]));
    }
  }

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
    for (let i = 0; i < area.length - 1; i++) {
      const p1 = area[i];
      const p2 = area[i + 1];
      if (isPointVisible(p1.x, p1.z) || isPointVisible(p2.x, p2.z)) {
        const uv1 = toUV(p1.x, p1.z);
        const uv2 = toUV(p2.x, p2.z);
        group.add(createLine([getPitchPoint(uv1.u, uv1.v), getPitchPoint(uv2.u, uv2.v)]));
      }
    }
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
    for (let i = 0; i < area.length - 1; i++) {
      const p1 = area[i];
      const p2 = area[i + 1];
      if (isPointVisible(p1.x, p1.z) || isPointVisible(p2.x, p2.z)) {
        const uv1 = toUV(p1.x, p1.z);
        const uv2 = toUV(p2.x, p2.z);
        group.add(createLine([getPitchPoint(uv1.u, uv1.v), getPitchPoint(uv2.u, uv2.v)]));
      }
    }
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
    if (isPointVisible(spotX, 0)) {
      const spotPts: THREE.Vector3[] = [];
      for (let i = 0; i <= 16; i++) {
        const angle = (i / 16) * Math.PI * 2;
        const uv = toUV(spotX + Math.cos(angle) * 0.25, Math.sin(angle) * 0.25);
        spotPts.push(getPitchPoint(uv.u, uv.v));
      }
      group.add(createLine(spotPts));
    }

    // Arc
    for (let i = 0; i < 32; i++) {
      const t1 = i / 32;
      const t2 = (i + 1) / 32;
      const angle1 = angleOffset === 0 ? -arcAngle + t1 * (arcAngle * 2) : Math.PI - arcAngle + t1 * (arcAngle * 2);
      const angle2 = angleOffset === 0 ? -arcAngle + t2 * (arcAngle * 2) : Math.PI - arcAngle + t2 * (arcAngle * 2);

      const p1 = { x: spotX + Math.cos(angle1) * arcRadius, z: Math.sin(angle1) * arcRadius };
      const p2 = { x: spotX + Math.cos(angle2) * arcRadius, z: Math.sin(angle2) * arcRadius };

      if (isPointVisible(p1.x, p1.z) || isPointVisible(p2.x, p2.z)) {
        const uv1 = toUV(p1.x, p1.z);
        const uv2 = toUV(p2.x, p2.z);
        group.add(createLine([getPitchPoint(uv1.u, uv1.v), getPitchPoint(uv2.u, uv2.v)]));
      }
    }
  });

  // CORNER ARCS
  const cornerRadius = 1;
  [
    { x: -pitchLength / 2, z: -pitchWidth / 2, startAngle: 0 },
    { x: pitchLength / 2, z: -pitchWidth / 2, startAngle: Math.PI / 2 },
    { x: pitchLength / 2, z: pitchWidth / 2, startAngle: Math.PI },
    { x: -pitchLength / 2, z: pitchWidth / 2, startAngle: -Math.PI / 2 },
  ].forEach((corner) => {
    for (let i = 0; i < 16; i++) {
      const angle1 = corner.startAngle + (i / 16) * (Math.PI / 2);
      const angle2 = corner.startAngle + ((i + 1) / 16) * (Math.PI / 2);
      const p1 = { x: corner.x + Math.cos(angle1) * cornerRadius, z: corner.z + Math.sin(angle1) * cornerRadius };
      const p2 = { x: corner.x + Math.cos(angle2) * cornerRadius, z: corner.z + Math.sin(angle2) * cornerRadius };

      if (isPointVisible(p1.x, p1.z) || isPointVisible(p2.x, p2.z)) {
        const uv1 = toUV(p1.x, p1.z);
        const uv2 = toUV(p2.x, p2.z);
        group.add(createLine([getPitchPoint(uv1.u, uv1.v), getPitchPoint(uv2.u, uv2.v)]));
      }
    }
  });

  // GOALS
  const goalWidth = 7.32;
  const goalHeight = 2.44;
  const goalDepth = 1.5;

  [-pitchLength / 2, pitchLength / 2].forEach((xPos, idx) => {
    if (!isPointVisible(xPos, 0)) return;

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

export function createManipulationHandles(
  corners: PitchCorners,
  activeHandle: string | null,
  lockedHandles: LockedHandles = DEFAULT_LOCKED_HANDLES,
  showGridHandles: boolean = false,
  extendedHandles: ExtendedHandles = DEFAULT_EXTENDED_HANDLES,
  selectedSection: string = "full",
): THREE.Group {
  const group = new THREE.Group();

  const pitchLength = 105;
  const pitchWidth = 68;

  // Bounds for clipping based on section
  const area = (SECTION_VISIBLE_AREAS as any)[selectedSection] || SECTION_VISIBLE_AREAS.full;
  const minX = -pitchLength / 2 + area.x1 * pitchLength;
  const maxX = -pitchLength / 2 + area.x2 * pitchLength;
  const minZ = -pitchWidth / 2 + area.y1 * pitchWidth;
  const maxZ = -pitchWidth / 2 + area.y2 * pitchWidth;

  const isPointVisible = (x: number, z: number) => {
    // Convert current handle world position to normalized pitch coordinates to check against section
    // Since we are checking the ORIGINAL pitch points for the handles, we use the logical pitch coords
    return x >= minX - 1 && x <= maxX + 1 && z >= minZ - 1 && z <= maxZ + 1;
  };

  // Handle sizes
  const cornerHandleSize = 3.5;
  const edgeHandleSize = 2.5;
  const centerHandleSize = 3;
  const gridHandleSize = 1.8;

  // Colors
  // Colors
  const activeColor = new THREE.Color(0x00ff88);
  const cornerColor = new THREE.Color(0xffaa00);
  const edgeColor = new THREE.Color(0x00d4ff);
  const centerColor = new THREE.Color(0xff4488);
  const lockedColor = new THREE.Color(0x666666);
  const gridColor = new THREE.Color(0x88ff88);

  const blueColor = new THREE.Color("#00bfff");
  const orangeColor = new THREE.Color("#ff7f00");
  const pinkColor = new THREE.Color("#ff007f");

  const createHandle = (
    id: string,
    pos: { x: number; z: number },
    handleType: "corner" | "edge" | "center" | "grid",
    baseColor: THREE.Color,
    isLocked: boolean = false,
  ) => {
    const isActive = activeHandle === id;
    const size =
      handleType === "corner"
        ? cornerHandleSize
        : handleType === "center"
          ? centerHandleSize
          : handleType === "grid"
            ? gridHandleSize
            : edgeHandleSize;
    const handleGroup = new THREE.Group();

    const displayColor = isLocked ? lockedColor : isActive ? activeColor : baseColor;
    const displayOpacity = isLocked ? 0.5 : 1.0;

    // MAIN SPHERE
    const sphereGeometry = new THREE.SphereGeometry(size * 0.6, 24, 24);
    const sphereMaterial = new THREE.MeshBasicMaterial({
      color: displayColor,
      transparent: true,
      opacity: displayOpacity,
      depthTest: false,
    });
    const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
    sphere.position.set(pos.x, size, pos.z);
    sphere.userData = { handleId: id, isLocked, handleType };
    sphere.renderOrder = 999;
    handleGroup.add(sphere);

    // Add ring and pole for all handles now to ensure visibility
    // OUTER GLOW RING
    const ringGeometry = new THREE.RingGeometry(size * 0.8, size * 1.1, 32);
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: displayColor,
      transparent: true,
      opacity: isLocked ? 0.4 : 0.8,
      side: THREE.DoubleSide,
      depthTest: false,
    });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(pos.x, 0.1, pos.z);
    ring.userData = { handleId: id, isLocked, handleType };
    ring.renderOrder = 998;
    handleGroup.add(ring);

    // Add vertical pole ONLY for main handles (corners, edges, center) to reduce clutter
    if (handleType !== "grid") {
      const poleHeight = size * 2;
      const poleGeometry = new THREE.CylinderGeometry(size * 0.2, size * 0.2, poleHeight, 12);
      const poleMaterial = new THREE.MeshBasicMaterial({
        color: displayColor,
        transparent: true,
        opacity: isLocked ? 0.4 : 0.9,
        depthTest: false,
      });
      const pole = new THREE.Mesh(poleGeometry, poleMaterial);
      pole.position.set(pos.x, poleHeight / 2, pos.z);
      pole.userData = { handleId: id, isLocked, handleType };
      pole.renderOrder = 997;
      handleGroup.add(pole);
    }

    // GROUND CIRCLE
    const groundGeometry = new THREE.CircleGeometry(size * 0.5, 32);
    const groundMaterial = new THREE.MeshBasicMaterial({
      color: displayColor,
      transparent: true,
      opacity: isLocked ? 0.2 : 0.5,
      side: THREE.DoubleSide,
      depthTest: false,
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(pos.x, 0.02, pos.z);
    ground.userData = { handleId: id, isLocked, handleType };
    ground.renderOrder = 996;
    handleGroup.add(ground);

    // EDGE OUTLINE for corners (or lock indicator)
    if (handleType === "corner" || isLocked) {
      const edgesGeo = new THREE.EdgesGeometry(sphereGeometry);
      const edgesMat = new THREE.LineBasicMaterial({
        color: isLocked ? 0xff4444 : 0xffffff,
        depthTest: false,
      });
      const edges = new THREE.LineSegments(edgesGeo, edgesMat);
      edges.position.copy(sphere.position);
      edges.userData = { handleId: id, isLocked, handleType };
      edges.renderOrder = 1000;
      handleGroup.add(edges);
    }

    // Lock icon indicator (X pattern for locked handles)
    if (isLocked) {
      const xSize = size * 0.4;
      const xGeom1 = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-xSize, 0, -xSize),
        new THREE.Vector3(xSize, 0, xSize),
      ]);
      const xGeom2 = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-xSize, 0, xSize),
        new THREE.Vector3(xSize, 0, -xSize),
      ]);
      const xMat = new THREE.LineBasicMaterial({ color: 0xff4444, depthTest: false, linewidth: 2 });
      const xLine1 = new THREE.Line(xGeom1, xMat);
      const xLine2 = new THREE.Line(xGeom2, xMat);
      xLine1.position.set(pos.x, size * 1.8, pos.z);
      xLine2.position.set(pos.x, size * 1.8, pos.z);
      xLine1.renderOrder = 1001;
      xLine2.renderOrder = 1001;
      handleGroup.add(xLine1, xLine2);
    }

    return handleGroup;
  };

  // CORNER HANDLES (4)
  [
    { id: "topLeft", pos: corners.topLeft, px: -52.5, pz: -34 },
    { id: "topRight", pos: corners.topRight, px: 52.5, pz: -34 },
    { id: "bottomLeft", pos: corners.bottomLeft, px: -52.5, pz: 34 },
    { id: "bottomRight", pos: corners.bottomRight, px: 52.5, pz: 34 },
  ].forEach(({ id, pos, px, pz }) => {
    if (!isPointVisible(px, pz)) return;
    const isLocked = lockedHandles[id] || false;
    group.add(createHandle(id, pos, "corner", cornerColor, isLocked));
  });

  // EDGE HANDLES (4)
  [
    {
      id: "top",
      pos: { x: (corners.topLeft.x + corners.topRight.x) / 2, z: (corners.topLeft.z + corners.topRight.z) / 2 },
      px: 0,
      pz: -34,
    },
    {
      id: "bottom",
      pos: {
        x: (corners.bottomLeft.x + corners.bottomRight.x) / 2,
        z: (corners.bottomLeft.z + corners.bottomRight.z) / 2,
      },
      px: 0,
      pz: 34,
    },
    {
      id: "left",
      pos: { x: (corners.topLeft.x + corners.bottomLeft.x) / 2, z: (corners.topLeft.z + corners.bottomLeft.z) / 2 },
      px: -52.5,
      pz: 0,
    },
    {
      id: "right",
      pos: { x: (corners.topRight.x + corners.bottomRight.x) / 2, z: (corners.topRight.z + corners.bottomRight.z) / 2 },
      px: 52.5,
      pz: 0,
    },
  ].forEach(({ id, pos, px, pz }) => {
    if (!isPointVisible(px, pz)) return;
    const isLocked = lockedHandles[id] || false;
    group.add(createHandle(id, pos, "edge", edgeColor, isLocked));
  });

  // CENTER HANDLE (1)
  const isCenterLocked = lockedHandles.center || false;
  if (isPointVisible(0, 0)) {
    const centerX = (corners.topLeft.x + corners.topRight.x + corners.bottomLeft.x + corners.bottomRight.x) / 4;
    const centerZ = (corners.topLeft.z + corners.topRight.z + corners.bottomLeft.z + corners.bottomRight.z) / 4;
    group.add(createHandle("center", { x: centerX, z: centerZ }, "center", centerColor, isCenterLocked));
  }

  // GRID HANDLES (25 specific points) - Only shown when enabled
  if (showGridHandles) {
    const gridHandles = generateGridHandles(corners);

    for (const gh of gridHandles) {
      // Find original pitch placement to check visibility in section
      let px = 0,
        pz = 0;
      if (PITCH_HANDLE_UVS[gh.id]) {
        px = (PITCH_HANDLE_UVS[gh.id].u - 0.5) * pitchLength;
        pz = (PITCH_HANDLE_UVS[gh.id].v - 0.5) * pitchWidth;
      }

      if (!isPointVisible(px, pz)) continue;

      // Apply any existing offset
      const offset = extendedHandles.gridOffsets[gh.id] || { dx: 0, dz: 0 };
      const isLocked = lockedHandles[gh.id] || false;

      // Select color based on ID (to match user's diagram)
      let hColor: THREE.Color = gridColor;
      if (gh.id.includes("halfway") || gh.id.includes("center")) {
        hColor = pinkColor;
      } else if (gh.id.includes("_l_") || gh.id.endsWith("_l")) {
        hColor = orangeColor;
      } else if (gh.id.includes("_r_") || gh.id.endsWith("_r")) {
        hColor = blueColor;
      }

      group.add(createHandle(gh.id, { x: gh.x + offset.dx, z: gh.z + offset.dz }, gh.type, hColor, isLocked));
    }
  }

  console.log("✅ Created manipulation handles:", {
    totalHandles: group.children.length,
    showGridHandles,
    lockedHandles: Object.entries(lockedHandles)
      .filter(([_, v]) => v)
      .map(([k]) => k),
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
