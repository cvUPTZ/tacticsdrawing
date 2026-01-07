import * as THREE from 'three';

// SOTA Professional Football Pitch Component
// Clean FIFA-standard pitch with visible mowing stripes like broadcast view

interface PitchScale {
  width: number;
  height: number;
}

// Create professional mowing pattern texture with clear stripes
function createGrassTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;

  // Number of stripes across the pitch (matching reference - about 12-14 stripes)
  const numStripes = 12;
  const stripeWidth = canvas.width / numStripes;

  // Draw alternating stripes
  for (let i = 0; i < numStripes; i++) {
    // Alternate between lighter and darker green
    if (i % 2 === 0) {
      ctx.fillStyle = '#2d7a3d'; // Lighter stripe
    } else {
      ctx.fillStyle = '#1f5c2c'; // Darker stripe
    }
    ctx.fillRect(i * stripeWidth, 0, stripeWidth, canvas.height);
  }

  // Add subtle grass texture overlay
  ctx.globalAlpha = 0.03;
  for (let i = 0; i < 3000; i++) {
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    ctx.fillStyle = Math.random() > 0.5 ? '#ffffff' : '#000000';
    ctx.fillRect(x, y, 1, 2);
  }
  ctx.globalAlpha = 1;

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  // Repeat to show stripes along the length of the pitch
  texture.repeat.set(1, 1);
  return texture;
}

export function createSOTAPitch(pitchScale: PitchScale): THREE.Group {
  const group = new THREE.Group();
  const pw = 105 * pitchScale.width; // Pitch length
  const ph = 68 * pitchScale.height; // Pitch width

  // === GRASS SURFACE WITH MOWING STRIPES ===
  const grassTexture = createGrassTexture();
  const grassGeometry = new THREE.PlaneGeometry(pw, ph);
  const grassMaterial = new THREE.MeshLambertMaterial({
    map: grassTexture,
    color: 0xffffff,
  });
  const grass = new THREE.Mesh(grassGeometry, grassMaterial);
  grass.rotation.x = -Math.PI / 2;
  grass.position.y = 0;
  grass.receiveShadow = true;
  group.add(grass);

  // === SURROUNDING DARKER GRASS ===
  const borderWidth = 5;
  const outerGeometry = new THREE.PlaneGeometry(pw + borderWidth * 2, ph + borderWidth * 2);
  const outerMaterial = new THREE.MeshLambertMaterial({
    color: 0x1a4a25,
  });
  const outerGrass = new THREE.Mesh(outerGeometry, outerMaterial);
  outerGrass.rotation.x = -Math.PI / 2;
  outerGrass.position.y = -0.01;
  outerGrass.receiveShadow = true;
  group.add(outerGrass);

  // === LINE MATERIAL ===
  const lineWidth = 0.12;
  const lineMat = new THREE.MeshBasicMaterial({ 
    color: 0xffffff, 
    transparent: true, 
    opacity: 1,
    side: THREE.DoubleSide 
  });

  // Helper to create a line as a thin rectangle
  const createLine = (x1: number, z1: number, x2: number, z2: number, width: number = lineWidth) => {
    const dx = x2 - x1;
    const dz = z2 - z1;
    const length = Math.sqrt(dx * dx + dz * dz);
    const angle = Math.atan2(dz, dx);
    
    const geometry = new THREE.PlaneGeometry(length, width);
    const mesh = new THREE.Mesh(geometry, lineMat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.rotation.z = -angle;
    mesh.position.set((x1 + x2) / 2, 0.01, (z1 + z2) / 2);
    return mesh;
  };

  // === PITCH OUTLINE ===
  // Top line
  group.add(createLine(-pw / 2, -ph / 2, pw / 2, -ph / 2));
  // Bottom line
  group.add(createLine(-pw / 2, ph / 2, pw / 2, ph / 2));
  // Left line
  group.add(createLine(-pw / 2, -ph / 2, -pw / 2, ph / 2));
  // Right line
  group.add(createLine(pw / 2, -ph / 2, pw / 2, ph / 2));

  // === CENTER LINE ===
  group.add(createLine(0, -ph / 2, 0, ph / 2));

  // === CENTER CIRCLE ===
  const centerCircleRadius = 9.15 * pitchScale.width;
  const circleSegments = 64;
  const circleGeom = new THREE.RingGeometry(
    centerCircleRadius - lineWidth / 2, 
    centerCircleRadius + lineWidth / 2, 
    circleSegments
  );
  const circle = new THREE.Mesh(circleGeom, lineMat);
  circle.rotation.x = -Math.PI / 2;
  circle.position.y = 0.01;
  group.add(circle);

  // === CENTER SPOT ===
  const centerSpotGeom = new THREE.CircleGeometry(0.3, 32);
  const centerSpot = new THREE.Mesh(centerSpotGeom, lineMat);
  centerSpot.rotation.x = -Math.PI / 2;
  centerSpot.position.y = 0.01;
  group.add(centerSpot);

  // === PENALTY AREAS ===
  const penaltyDepth = 16.5 * pitchScale.width;
  const penaltyWidth = 40.32 * pitchScale.height;

  // Left penalty area
  group.add(createLine(-pw / 2, -penaltyWidth / 2, -pw / 2 + penaltyDepth, -penaltyWidth / 2)); // Top
  group.add(createLine(-pw / 2 + penaltyDepth, -penaltyWidth / 2, -pw / 2 + penaltyDepth, penaltyWidth / 2)); // Right
  group.add(createLine(-pw / 2, penaltyWidth / 2, -pw / 2 + penaltyDepth, penaltyWidth / 2)); // Bottom

  // Right penalty area
  group.add(createLine(pw / 2, -penaltyWidth / 2, pw / 2 - penaltyDepth, -penaltyWidth / 2)); // Top
  group.add(createLine(pw / 2 - penaltyDepth, -penaltyWidth / 2, pw / 2 - penaltyDepth, penaltyWidth / 2)); // Left
  group.add(createLine(pw / 2, penaltyWidth / 2, pw / 2 - penaltyDepth, penaltyWidth / 2)); // Bottom

  // === GOAL AREAS (6-YARD BOX) ===
  const goalAreaDepth = 5.5 * pitchScale.width;
  const goalAreaWidth = 18.32 * pitchScale.height;

  // Left goal area
  group.add(createLine(-pw / 2, -goalAreaWidth / 2, -pw / 2 + goalAreaDepth, -goalAreaWidth / 2));
  group.add(createLine(-pw / 2 + goalAreaDepth, -goalAreaWidth / 2, -pw / 2 + goalAreaDepth, goalAreaWidth / 2));
  group.add(createLine(-pw / 2, goalAreaWidth / 2, -pw / 2 + goalAreaDepth, goalAreaWidth / 2));

  // Right goal area
  group.add(createLine(pw / 2, -goalAreaWidth / 2, pw / 2 - goalAreaDepth, -goalAreaWidth / 2));
  group.add(createLine(pw / 2 - goalAreaDepth, -goalAreaWidth / 2, pw / 2 - goalAreaDepth, goalAreaWidth / 2));
  group.add(createLine(pw / 2, goalAreaWidth / 2, pw / 2 - goalAreaDepth, goalAreaWidth / 2));

  // === PENALTY SPOTS ===
  const penaltySpotDist = 11 * pitchScale.width;
  const spotGeom = new THREE.CircleGeometry(0.25, 32);

  const leftSpot = new THREE.Mesh(spotGeom, lineMat);
  leftSpot.rotation.x = -Math.PI / 2;
  leftSpot.position.set(-pw / 2 + penaltySpotDist, 0.01, 0);
  group.add(leftSpot);

  const rightSpot = new THREE.Mesh(spotGeom, lineMat);
  rightSpot.rotation.x = -Math.PI / 2;
  rightSpot.position.set(pw / 2 - penaltySpotDist, 0.01, 0);
  group.add(rightSpot);

  // === PENALTY ARCS ===
  const arcRadius = 9.15 * pitchScale.width;
  // Calculate angle where arc intersects penalty box edge
  const distFromSpotToBoxEdge = penaltyDepth - penaltySpotDist;
  const arcAngle = Math.acos(distFromSpotToBoxEdge / arcRadius);

  // Left arc (outside penalty area only)
  const leftArcGeom = new THREE.RingGeometry(
    arcRadius - lineWidth / 2,
    arcRadius + lineWidth / 2,
    32,
    1,
    Math.PI / 2 - arcAngle,
    arcAngle * 2
  );
  const leftArc = new THREE.Mesh(leftArcGeom, lineMat);
  leftArc.rotation.x = -Math.PI / 2;
  leftArc.position.set(-pw / 2 + penaltySpotDist, 0.01, 0);
  group.add(leftArc);

  // Right arc
  const rightArcGeom = new THREE.RingGeometry(
    arcRadius - lineWidth / 2,
    arcRadius + lineWidth / 2,
    32,
    1,
    -Math.PI / 2 - arcAngle,
    arcAngle * 2
  );
  const rightArc = new THREE.Mesh(rightArcGeom, lineMat);
  rightArc.rotation.x = -Math.PI / 2;
  rightArc.position.set(pw / 2 - penaltySpotDist, 0.01, 0);
  group.add(rightArc);

  // === CORNER ARCS ===
  const cornerRadius = 1 * Math.min(pitchScale.width, pitchScale.height);
  const corners = [
    { x: -pw / 2, z: -ph / 2, startAngle: 0 },
    { x: pw / 2, z: -ph / 2, startAngle: Math.PI / 2 },
    { x: pw / 2, z: ph / 2, startAngle: Math.PI },
    { x: -pw / 2, z: ph / 2, startAngle: -Math.PI / 2 },
  ];

  corners.forEach(corner => {
    const cornerArcGeom = new THREE.RingGeometry(
      cornerRadius - lineWidth / 2,
      cornerRadius + lineWidth / 2,
      16,
      1,
      corner.startAngle,
      Math.PI / 2
    );
    const cornerArc = new THREE.Mesh(cornerArcGeom, lineMat);
    cornerArc.rotation.x = -Math.PI / 2;
    cornerArc.position.set(corner.x, 0.01, corner.z);
    group.add(cornerArc);
  });

  // === GOALS (simple clean version matching reference) ===
  const goalWidth = 7.32 * pitchScale.height;
  const goalHeight = 2.44;
  const goalDepth = 1.5;
  const postRadius = 0.06;
  const postMat = new THREE.MeshPhongMaterial({ color: 0xffffff, emissive: 0x444444 });

  // Left goal
  const createGoal = (xPos: number, isLeft: boolean) => {
    const goalGroup = new THREE.Group();

    // Posts
    const postGeom = new THREE.CylinderGeometry(postRadius, postRadius, goalHeight, 12);
    
    const leftPost = new THREE.Mesh(postGeom, postMat);
    leftPost.position.set(0, goalHeight / 2, -goalWidth / 2);
    goalGroup.add(leftPost);

    const rightPost = new THREE.Mesh(postGeom, postMat);
    rightPost.position.set(0, goalHeight / 2, goalWidth / 2);
    goalGroup.add(rightPost);

    // Crossbar
    const crossbarGeom = new THREE.CylinderGeometry(postRadius, postRadius, goalWidth, 12);
    const crossbar = new THREE.Mesh(crossbarGeom, postMat);
    crossbar.rotation.x = Math.PI / 2;
    crossbar.position.set(0, goalHeight, 0);
    goalGroup.add(crossbar);

    // Net back
    const netMat = new THREE.MeshBasicMaterial({ 
      color: 0xffffff, 
      transparent: true, 
      opacity: 0.2,
      side: THREE.DoubleSide,
      wireframe: true 
    });

    const backNetGeom = new THREE.PlaneGeometry(goalWidth, goalHeight, 20, 10);
    const backNet = new THREE.Mesh(backNetGeom, netMat);
    backNet.position.set(isLeft ? -goalDepth : goalDepth, goalHeight / 2, 0);
    goalGroup.add(backNet);

    // Side nets
    const sideNetGeom = new THREE.PlaneGeometry(goalDepth, goalHeight, 6, 10);
    
    const leftSideNet = new THREE.Mesh(sideNetGeom, netMat);
    leftSideNet.rotation.y = Math.PI / 2;
    leftSideNet.position.set(isLeft ? -goalDepth / 2 : goalDepth / 2, goalHeight / 2, -goalWidth / 2);
    goalGroup.add(leftSideNet);

    const rightSideNet = new THREE.Mesh(sideNetGeom, netMat);
    rightSideNet.rotation.y = Math.PI / 2;
    rightSideNet.position.set(isLeft ? -goalDepth / 2 : goalDepth / 2, goalHeight / 2, goalWidth / 2);
    goalGroup.add(rightSideNet);

    // Top net
    const topNetGeom = new THREE.PlaneGeometry(goalDepth, goalWidth, 6, 20);
    const topNet = new THREE.Mesh(topNetGeom, netMat);
    topNet.rotation.x = Math.PI / 2;
    topNet.rotation.z = Math.PI / 2;
    topNet.position.set(isLeft ? -goalDepth / 2 : goalDepth / 2, goalHeight, 0);
    goalGroup.add(topNet);

    goalGroup.position.x = xPos;
    return goalGroup;
  };

  group.add(createGoal(-pw / 2, true));
  group.add(createGoal(pw / 2, false));

  return group;
}

// Reference points for calibration (base coordinates on 105x68 pitch)
export const PITCH_REFERENCE_POINTS = [
  // Corners
  { id: 'corner_tl', label: 'Top-Left Corner', x: -52.5, z: -34 },
  { id: 'corner_tr', label: 'Top-Right Corner', x: 52.5, z: -34 },
  { id: 'corner_bl', label: 'Bottom-Left Corner', x: -52.5, z: 34 },
  { id: 'corner_br', label: 'Bottom-Right Corner', x: 52.5, z: 34 },

  // Center
  { id: 'center', label: 'Center Spot', x: 0, z: 0 },
  { id: 'center_left', label: 'Center Circle Left', x: -9.15, z: 0 },
  { id: 'center_right', label: 'Center Circle Right', x: 9.15, z: 0 },
  { id: 'center_top', label: 'Center Circle Top', x: 0, z: -9.15 },
  { id: 'center_bottom', label: 'Center Circle Bottom', x: 0, z: 9.15 },
  { id: 'halfway_top', label: 'Halfway Line Top', x: 0, z: -34 },
  { id: 'halfway_bottom', label: 'Halfway Line Bottom', x: 0, z: 34 },

  // Penalty spots
  { id: 'penalty_left', label: 'Left Penalty Spot', x: -41.5, z: 0 },
  { id: 'penalty_right', label: 'Right Penalty Spot', x: 41.5, z: 0 },

  // Penalty area corners
  { id: 'penalty_left_tl', label: 'Left Penalty Box TL', x: -52.5, z: -20.16 },
  { id: 'penalty_left_tr', label: 'Left Penalty Box TR', x: -36, z: -20.16 },
  { id: 'penalty_left_bl', label: 'Left Penalty Box BL', x: -52.5, z: 20.16 },
  { id: 'penalty_left_br', label: 'Left Penalty Box BR', x: -36, z: 20.16 },
  { id: 'penalty_right_tl', label: 'Right Penalty Box TL', x: 36, z: -20.16 },
  { id: 'penalty_right_tr', label: 'Right Penalty Box TR', x: 52.5, z: -20.16 },
  { id: 'penalty_right_bl', label: 'Right Penalty Box BL', x: 36, z: 20.16 },
  { id: 'penalty_right_br', label: 'Right Penalty Box BR', x: 52.5, z: 20.16 },

  // Goal area corners
  { id: 'goalbox_left_tl', label: 'Left 6-Yard TL', x: -52.5, z: -9.16 },
  { id: 'goalbox_left_tr', label: 'Left 6-Yard TR', x: -47, z: -9.16 },
  { id: 'goalbox_left_bl', label: 'Left 6-Yard BL', x: -52.5, z: 9.16 },
  { id: 'goalbox_left_br', label: 'Left 6-Yard BR', x: -47, z: 9.16 },
  { id: 'goalbox_right_tl', label: 'Right 6-Yard TL', x: 47, z: -9.16 },
  { id: 'goalbox_right_tr', label: 'Right 6-Yard TR', x: 52.5, z: -9.16 },
  { id: 'goalbox_right_bl', label: 'Right 6-Yard BL', x: 47, z: 9.16 },
  { id: 'goalbox_right_br', label: 'Right 6-Yard BR', x: 52.5, z: 9.16 },

  // Goal posts
  { id: 'goal_left_top', label: 'Left Goal Top Post', x: -52.5, z: -3.66 },
  { id: 'goal_left_bottom', label: 'Left Goal Bottom Post', x: -52.5, z: 3.66 },
  { id: 'goal_right_top', label: 'Right Goal Top Post', x: 52.5, z: -3.66 },
  { id: 'goal_right_bottom', label: 'Right Goal Bottom Post', x: 52.5, z: 3.66 },
];
