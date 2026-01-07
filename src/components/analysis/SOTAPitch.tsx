import * as THREE from 'three';

// SOTA Professional Football Pitch Component
// Outline-only pitch with no fill - just clean white lines

interface PitchScale {
  width: number;
  height: number;
}

export function createSOTAPitch(pitchScale: PitchScale): THREE.Group {
  const group = new THREE.Group();
  const pw = 105 * pitchScale.width; // Pitch length
  const ph = 68 * pitchScale.height; // Pitch width

  // Line material - white outline only
  const lineMat = new THREE.LineBasicMaterial({ 
    color: 0xffffff, 
    transparent: true, 
    opacity: 1,
  });

  // Helper to create a line from points
  const createLine = (points: THREE.Vector3[]) => {
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    return new THREE.Line(geometry, lineMat);
  };

  // Helper to create a closed rectangle outline
  const createRect = (x: number, z: number, width: number, height: number) => {
    const points = [
      new THREE.Vector3(x - width / 2, 0.01, z - height / 2),
      new THREE.Vector3(x + width / 2, 0.01, z - height / 2),
      new THREE.Vector3(x + width / 2, 0.01, z + height / 2),
      new THREE.Vector3(x - width / 2, 0.01, z + height / 2),
      new THREE.Vector3(x - width / 2, 0.01, z - height / 2), // Close the loop
    ];
    return createLine(points);
  };

  // === PITCH OUTLINE ===
  group.add(createRect(0, 0, pw, ph));

  // === CENTER LINE ===
  group.add(createLine([
    new THREE.Vector3(0, 0.01, -ph / 2),
    new THREE.Vector3(0, 0.01, ph / 2),
  ]));

  // === CENTER CIRCLE ===
  const centerCircleRadius = 9.15 * pitchScale.width;
  const circlePoints: THREE.Vector3[] = [];
  const segments = 64;
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    circlePoints.push(new THREE.Vector3(
      Math.cos(angle) * centerCircleRadius,
      0.01,
      Math.sin(angle) * centerCircleRadius
    ));
  }
  group.add(createLine(circlePoints));

  // === CENTER SPOT ===
  const spotPoints: THREE.Vector3[] = [];
  for (let i = 0; i <= 16; i++) {
    const angle = (i / 16) * Math.PI * 2;
    spotPoints.push(new THREE.Vector3(
      Math.cos(angle) * 0.3,
      0.01,
      Math.sin(angle) * 0.3
    ));
  }
  group.add(createLine(spotPoints));

  // === PENALTY AREAS ===
  const penaltyDepth = 16.5 * pitchScale.width;
  const penaltyWidth = 40.32 * pitchScale.height;

  // Left penalty area (3 lines - open to goal line)
  group.add(createLine([
    new THREE.Vector3(-pw / 2, 0.01, -penaltyWidth / 2),
    new THREE.Vector3(-pw / 2 + penaltyDepth, 0.01, -penaltyWidth / 2),
    new THREE.Vector3(-pw / 2 + penaltyDepth, 0.01, penaltyWidth / 2),
    new THREE.Vector3(-pw / 2, 0.01, penaltyWidth / 2),
  ]));

  // Right penalty area
  group.add(createLine([
    new THREE.Vector3(pw / 2, 0.01, -penaltyWidth / 2),
    new THREE.Vector3(pw / 2 - penaltyDepth, 0.01, -penaltyWidth / 2),
    new THREE.Vector3(pw / 2 - penaltyDepth, 0.01, penaltyWidth / 2),
    new THREE.Vector3(pw / 2, 0.01, penaltyWidth / 2),
  ]));

  // === GOAL AREAS (6-YARD BOX) ===
  const goalAreaDepth = 5.5 * pitchScale.width;
  const goalAreaWidth = 18.32 * pitchScale.height;

  // Left goal area
  group.add(createLine([
    new THREE.Vector3(-pw / 2, 0.01, -goalAreaWidth / 2),
    new THREE.Vector3(-pw / 2 + goalAreaDepth, 0.01, -goalAreaWidth / 2),
    new THREE.Vector3(-pw / 2 + goalAreaDepth, 0.01, goalAreaWidth / 2),
    new THREE.Vector3(-pw / 2, 0.01, goalAreaWidth / 2),
  ]));

  // Right goal area
  group.add(createLine([
    new THREE.Vector3(pw / 2, 0.01, -goalAreaWidth / 2),
    new THREE.Vector3(pw / 2 - goalAreaDepth, 0.01, -goalAreaWidth / 2),
    new THREE.Vector3(pw / 2 - goalAreaDepth, 0.01, goalAreaWidth / 2),
    new THREE.Vector3(pw / 2, 0.01, goalAreaWidth / 2),
  ]));

  // === PENALTY SPOTS ===
  const penaltySpotDist = 11 * pitchScale.width;
  
  // Left penalty spot
  const leftSpotPoints: THREE.Vector3[] = [];
  for (let i = 0; i <= 16; i++) {
    const angle = (i / 16) * Math.PI * 2;
    leftSpotPoints.push(new THREE.Vector3(
      -pw / 2 + penaltySpotDist + Math.cos(angle) * 0.25,
      0.01,
      Math.sin(angle) * 0.25
    ));
  }
  group.add(createLine(leftSpotPoints));

  // Right penalty spot
  const rightSpotPoints: THREE.Vector3[] = [];
  for (let i = 0; i <= 16; i++) {
    const angle = (i / 16) * Math.PI * 2;
    rightSpotPoints.push(new THREE.Vector3(
      pw / 2 - penaltySpotDist + Math.cos(angle) * 0.25,
      0.01,
      Math.sin(angle) * 0.25
    ));
  }
  group.add(createLine(rightSpotPoints));

  // === PENALTY ARCS ===
  const arcRadius = 9.15 * pitchScale.width;
  const distFromSpotToBoxEdge = penaltyDepth - penaltySpotDist;
  const arcAngle = Math.acos(distFromSpotToBoxEdge / arcRadius);

  // Left arc
  const leftArcPoints: THREE.Vector3[] = [];
  const arcSegments = 32;
  for (let i = 0; i <= arcSegments; i++) {
    const t = i / arcSegments;
    const angle = (Math.PI / 2 - arcAngle) + t * (arcAngle * 2);
    leftArcPoints.push(new THREE.Vector3(
      -pw / 2 + penaltySpotDist + Math.cos(angle) * arcRadius,
      0.01,
      Math.sin(angle) * arcRadius
    ));
  }
  group.add(createLine(leftArcPoints));

  // Right arc
  const rightArcPoints: THREE.Vector3[] = [];
  for (let i = 0; i <= arcSegments; i++) {
    const t = i / arcSegments;
    const angle = (-Math.PI / 2 - arcAngle) + t * (arcAngle * 2);
    rightArcPoints.push(new THREE.Vector3(
      pw / 2 - penaltySpotDist + Math.cos(angle) * arcRadius,
      0.01,
      Math.sin(angle) * arcRadius
    ));
  }
  group.add(createLine(rightArcPoints));

  // === CORNER ARCS ===
  const cornerRadius = 1 * Math.min(pitchScale.width, pitchScale.height);
  const corners = [
    { x: -pw / 2, z: -ph / 2, startAngle: 0 },
    { x: pw / 2, z: -ph / 2, startAngle: Math.PI / 2 },
    { x: pw / 2, z: ph / 2, startAngle: Math.PI },
    { x: -pw / 2, z: ph / 2, startAngle: -Math.PI / 2 },
  ];

  corners.forEach(corner => {
    const cornerPoints: THREE.Vector3[] = [];
    for (let i = 0; i <= 16; i++) {
      const t = i / 16;
      const angle = corner.startAngle + t * (Math.PI / 2);
      cornerPoints.push(new THREE.Vector3(
        corner.x + Math.cos(angle) * cornerRadius,
        0.01,
        corner.z + Math.sin(angle) * cornerRadius
      ));
    }
    group.add(createLine(cornerPoints));
  });

  // === GOALS (outline only) ===
  const goalWidth = 7.32 * pitchScale.height;
  const goalHeight = 2.44;
  const goalDepth = 1.5;

  const createGoalOutline = (xPos: number, isLeft: boolean) => {
    const goalGroup = new THREE.Group();
    const dir = isLeft ? -1 : 1;

    // Front frame (posts + crossbar)
    goalGroup.add(createLine([
      new THREE.Vector3(0, 0, -goalWidth / 2),
      new THREE.Vector3(0, goalHeight, -goalWidth / 2),
      new THREE.Vector3(0, goalHeight, goalWidth / 2),
      new THREE.Vector3(0, 0, goalWidth / 2),
    ]));

    // Back frame
    goalGroup.add(createLine([
      new THREE.Vector3(dir * goalDepth, 0, -goalWidth / 2),
      new THREE.Vector3(dir * goalDepth, goalHeight * 0.8, -goalWidth / 2),
      new THREE.Vector3(dir * goalDepth, goalHeight * 0.8, goalWidth / 2),
      new THREE.Vector3(dir * goalDepth, 0, goalWidth / 2),
    ]));

    // Connecting lines (net frame)
    goalGroup.add(createLine([
      new THREE.Vector3(0, goalHeight, -goalWidth / 2),
      new THREE.Vector3(dir * goalDepth, goalHeight * 0.8, -goalWidth / 2),
    ]));
    goalGroup.add(createLine([
      new THREE.Vector3(0, goalHeight, goalWidth / 2),
      new THREE.Vector3(dir * goalDepth, goalHeight * 0.8, goalWidth / 2),
    ]));
    goalGroup.add(createLine([
      new THREE.Vector3(0, 0, -goalWidth / 2),
      new THREE.Vector3(dir * goalDepth, 0, -goalWidth / 2),
    ]));
    goalGroup.add(createLine([
      new THREE.Vector3(0, 0, goalWidth / 2),
      new THREE.Vector3(dir * goalDepth, 0, goalWidth / 2),
    ]));

    goalGroup.position.x = xPos;
    return goalGroup;
  };

  group.add(createGoalOutline(-pw / 2, true));
  group.add(createGoalOutline(pw / 2, false));

  return group;
}

// Reference points for calibration
export const PITCH_REFERENCE_POINTS = [
  { id: 'corner_tl', label: 'Top-Left Corner', x: -52.5, z: -34 },
  { id: 'corner_tr', label: 'Top-Right Corner', x: 52.5, z: -34 },
  { id: 'corner_bl', label: 'Bottom-Left Corner', x: -52.5, z: 34 },
  { id: 'corner_br', label: 'Bottom-Right Corner', x: 52.5, z: 34 },
  { id: 'center', label: 'Center Spot', x: 0, z: 0 },
  { id: 'center_left', label: 'Center Circle Left', x: -9.15, z: 0 },
  { id: 'center_right', label: 'Center Circle Right', x: 9.15, z: 0 },
  { id: 'center_top', label: 'Center Circle Top', x: 0, z: -9.15 },
  { id: 'center_bottom', label: 'Center Circle Bottom', x: 0, z: 9.15 },
  { id: 'halfway_top', label: 'Halfway Line Top', x: 0, z: -34 },
  { id: 'halfway_bottom', label: 'Halfway Line Bottom', x: 0, z: 34 },
  { id: 'penalty_left', label: 'Left Penalty Spot', x: -41.5, z: 0 },
  { id: 'penalty_right', label: 'Right Penalty Spot', x: 41.5, z: 0 },
  { id: 'penalty_left_tl', label: 'Left Penalty Box TL', x: -52.5, z: -20.16 },
  { id: 'penalty_left_tr', label: 'Left Penalty Box TR', x: -36, z: -20.16 },
  { id: 'penalty_left_bl', label: 'Left Penalty Box BL', x: -52.5, z: 20.16 },
  { id: 'penalty_left_br', label: 'Left Penalty Box BR', x: -36, z: 20.16 },
  { id: 'penalty_right_tl', label: 'Right Penalty Box TL', x: 36, z: -20.16 },
  { id: 'penalty_right_tr', label: 'Right Penalty Box TR', x: 52.5, z: -20.16 },
  { id: 'penalty_right_bl', label: 'Right Penalty Box BL', x: 36, z: 20.16 },
  { id: 'penalty_right_br', label: 'Right Penalty Box BR', x: 52.5, z: 20.16 },
  { id: 'goalbox_left_tl', label: 'Left 6-Yard TL', x: -52.5, z: -9.16 },
  { id: 'goalbox_left_tr', label: 'Left 6-Yard TR', x: -47, z: -9.16 },
  { id: 'goalbox_left_bl', label: 'Left 6-Yard BL', x: -52.5, z: 9.16 },
  { id: 'goalbox_left_br', label: 'Left 6-Yard BR', x: -47, z: 9.16 },
  { id: 'goalbox_right_tl', label: 'Right 6-Yard TL', x: 47, z: -9.16 },
  { id: 'goalbox_right_tr', label: 'Right 6-Yard TR', x: 52.5, z: -9.16 },
  { id: 'goalbox_right_bl', label: 'Right 6-Yard BL', x: 47, z: 9.16 },
  { id: 'goalbox_right_br', label: 'Right 6-Yard BR', x: 52.5, z: 9.16 },
  { id: 'goal_left_top', label: 'Left Goal Top Post', x: -52.5, z: -3.66 },
  { id: 'goal_left_bottom', label: 'Left Goal Bottom Post', x: -52.5, z: 3.66 },
  { id: 'goal_right_top', label: 'Right Goal Top Post', x: 52.5, z: -3.66 },
  { id: 'goal_right_bottom', label: 'Right Goal Bottom Post', x: 52.5, z: 3.66 },
];
