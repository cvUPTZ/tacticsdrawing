import * as THREE from 'three';

// SOTA Professional Pitch Component
// Creates a high-quality stadium pitch with grass textures, mowing patterns, goals with nets

interface PitchScale {
  width: number;
  height: number;
}

// Create professional mowing pattern texture
function createGrassTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Base grass color
  ctx.fillStyle = '#1a5f2a';
  ctx.fillRect(0, 0, 512, 512);

  // Mowing stripes pattern
  const stripeWidth = 64;
  for (let i = 0; i < 8; i++) {
    const shade = i % 2 === 0 ? '#1d6b30' : '#176127';
    ctx.fillStyle = shade;
    ctx.fillRect(i * stripeWidth, 0, stripeWidth, 512);
  }

  // Add subtle noise/texture
  const imageData = ctx.getImageData(0, 0, 512, 512);
  for (let i = 0; i < imageData.data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 15;
    imageData.data[i] = Math.max(0, Math.min(255, imageData.data[i] + noise));
    imageData.data[i + 1] = Math.max(0, Math.min(255, imageData.data[i + 1] + noise));
    imageData.data[i + 2] = Math.max(0, Math.min(255, imageData.data[i + 2] + noise));
  }
  ctx.putImageData(imageData, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(8, 5);
  return texture;
}

// Create goal net mesh
function createGoalNet(goalWidth: number, goalHeight: number, goalDepth: number, isLeft: boolean): THREE.Group {
  const group = new THREE.Group();
  const netColor = 0xffffff;
  const netOpacity = 0.25;
  const netSpacing = 0.3;

  // Back net (plane with grid)
  const backNetGeometry = new THREE.PlaneGeometry(goalWidth, goalHeight * 0.85, 20, 12);
  const backNetMaterial = new THREE.MeshBasicMaterial({
    color: netColor,
    transparent: true,
    opacity: netOpacity,
    side: THREE.DoubleSide,
    wireframe: true,
  });
  const backNet = new THREE.Mesh(backNetGeometry, backNetMaterial);
  backNet.position.set(isLeft ? -goalDepth : goalDepth, goalHeight * 0.425, 0);
  backNet.rotation.y = isLeft ? 0 : Math.PI;
  group.add(backNet);

  // Side nets
  const sideNetGeometry = new THREE.PlaneGeometry(goalDepth, goalHeight, 8, 12);
  const sideNetMaterial = new THREE.MeshBasicMaterial({
    color: netColor,
    transparent: true,
    opacity: netOpacity * 0.8,
    side: THREE.DoubleSide,
    wireframe: true,
  });

  const leftSide = new THREE.Mesh(sideNetGeometry, sideNetMaterial);
  leftSide.position.set(isLeft ? -goalDepth / 2 : goalDepth / 2, goalHeight / 2, -goalWidth / 2);
  leftSide.rotation.y = Math.PI / 2;
  group.add(leftSide);

  const rightSide = new THREE.Mesh(sideNetGeometry, sideNetMaterial);
  rightSide.position.set(isLeft ? -goalDepth / 2 : goalDepth / 2, goalHeight / 2, goalWidth / 2);
  rightSide.rotation.y = Math.PI / 2;
  group.add(rightSide);

  // Top net
  const topNetGeometry = new THREE.PlaneGeometry(goalDepth, goalWidth, 8, 20);
  const topNetMaterial = new THREE.MeshBasicMaterial({
    color: netColor,
    transparent: true,
    opacity: netOpacity * 0.8,
    side: THREE.DoubleSide,
    wireframe: true,
  });
  const topNet = new THREE.Mesh(topNetGeometry, topNetMaterial);
  topNet.position.set(isLeft ? -goalDepth / 2 : goalDepth / 2, goalHeight * 0.92, 0);
  topNet.rotation.x = Math.PI / 2;
  topNet.rotation.z = Math.PI / 2;
  group.add(topNet);

  return group;
}

// Create 3D goal posts with proper thickness
function createGoalPosts(goalWidth: number, goalHeight: number, isLeft: boolean): THREE.Group {
  const group = new THREE.Group();
  const postRadius = 0.06;
  const postMaterial = new THREE.MeshPhongMaterial({
    color: 0xffffff,
    emissive: 0x333333,
    shininess: 100,
  });

  // Left post
  const leftPostGeom = new THREE.CylinderGeometry(postRadius, postRadius, goalHeight, 16);
  const leftPost = new THREE.Mesh(leftPostGeom, postMaterial);
  leftPost.position.set(0, goalHeight / 2, -goalWidth / 2);
  group.add(leftPost);

  // Right post
  const rightPostGeom = new THREE.CylinderGeometry(postRadius, postRadius, goalHeight, 16);
  const rightPost = new THREE.Mesh(rightPostGeom, postMaterial);
  rightPost.position.set(0, goalHeight / 2, goalWidth / 2);
  group.add(rightPost);

  // Crossbar
  const crossbarGeom = new THREE.CylinderGeometry(postRadius, postRadius, goalWidth + postRadius * 2, 16);
  const crossbar = new THREE.Mesh(crossbarGeom, postMaterial);
  crossbar.rotation.x = Math.PI / 2;
  crossbar.position.set(0, goalHeight, 0);
  group.add(crossbar);

  return group;
}

export function createSOTAPitch(pitchScale: PitchScale): THREE.Group {
  const group = new THREE.Group();
  const pw = 105 * pitchScale.width;
  const ph = 68 * pitchScale.height;

  // === GRASS SURFACE ===
  const grassTexture = createGrassTexture();
  const grassGeometry = new THREE.PlaneGeometry(pw + 10, ph + 10);
  const grassMaterial = new THREE.MeshLambertMaterial({
    map: grassTexture,
    color: 0xffffff,
  });
  const grass = new THREE.Mesh(grassGeometry, grassMaterial);
  grass.rotation.x = -Math.PI / 2;
  grass.position.y = -0.01;
  grass.receiveShadow = true;
  group.add(grass);

  // === PITCH MARKINGS ===
  const lineWidth = 0.12;
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95 });

  // Helper to create line segments
  const createLine = (points: THREE.Vector3[], width: number = lineWidth) => {
    const shape = new THREE.Shape();
    for (let i = 0; i < points.length - 1; i++) {
      const start = points[i];
      const end = points[i + 1];
      const dx = end.x - start.x;
      const dz = end.z - start.z;
      const len = Math.sqrt(dx * dx + dz * dz);
      const nx = -dz / len * width / 2;
      const nz = dx / len * width / 2;

      if (i === 0) {
        shape.moveTo(start.x + nx, start.z + nz);
      }
      shape.lineTo(end.x + nx, end.z + nz);
    }
    for (let i = points.length - 1; i > 0; i--) {
      const start = points[i];
      const end = points[i - 1];
      const dx = end.x - start.x;
      const dz = end.z - start.z;
      const len = Math.sqrt(dx * dx + dz * dz);
      const nx = -dz / len * width / 2;
      const nz = dx / len * width / 2;
      shape.lineTo(start.x - nx, start.z - nz);
    }
    shape.closePath();
    const geometry = new THREE.ShapeGeometry(shape);
    const mesh = new THREE.Mesh(geometry, lineMat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 0.005;
    return mesh;
  };

  // Outline
  group.add(createLine([
    new THREE.Vector3(-pw/2, 0, -ph/2),
    new THREE.Vector3(pw/2, 0, -ph/2),
  ]));
  group.add(createLine([
    new THREE.Vector3(pw/2, 0, -ph/2),
    new THREE.Vector3(pw/2, 0, ph/2),
  ]));
  group.add(createLine([
    new THREE.Vector3(pw/2, 0, ph/2),
    new THREE.Vector3(-pw/2, 0, ph/2),
  ]));
  group.add(createLine([
    new THREE.Vector3(-pw/2, 0, ph/2),
    new THREE.Vector3(-pw/2, 0, -ph/2),
  ]));

  // Center line
  group.add(createLine([
    new THREE.Vector3(0, 0, -ph/2),
    new THREE.Vector3(0, 0, ph/2),
  ]));

  // Center circle
  const centerCircleRadius = 9.15 * pitchScale.width;
  const circlePoints: THREE.Vector3[] = [];
  for (let i = 0; i <= 64; i++) {
    const angle = (i / 64) * Math.PI * 2;
    circlePoints.push(new THREE.Vector3(
      Math.cos(angle) * centerCircleRadius,
      0,
      Math.sin(angle) * centerCircleRadius
    ));
  }
  const circleShape = new THREE.RingGeometry(centerCircleRadius - lineWidth/2, centerCircleRadius + lineWidth/2, 64);
  const circle = new THREE.Mesh(circleShape, lineMat);
  circle.rotation.x = -Math.PI / 2;
  circle.position.y = 0.005;
  group.add(circle);

  // Center spot
  const centerSpotGeom = new THREE.CircleGeometry(0.22, 32);
  const centerSpot = new THREE.Mesh(centerSpotGeom, lineMat);
  centerSpot.rotation.x = -Math.PI / 2;
  centerSpot.position.y = 0.006;
  group.add(centerSpot);

  // Penalty areas
  const penaltyDepth = 16.5 * pitchScale.width;
  const penaltyWidth = 40.3 * pitchScale.height;

  // Left penalty area
  group.add(createLine([
    new THREE.Vector3(-pw/2, 0, -penaltyWidth/2),
    new THREE.Vector3(-pw/2 + penaltyDepth, 0, -penaltyWidth/2),
  ]));
  group.add(createLine([
    new THREE.Vector3(-pw/2 + penaltyDepth, 0, -penaltyWidth/2),
    new THREE.Vector3(-pw/2 + penaltyDepth, 0, penaltyWidth/2),
  ]));
  group.add(createLine([
    new THREE.Vector3(-pw/2 + penaltyDepth, 0, penaltyWidth/2),
    new THREE.Vector3(-pw/2, 0, penaltyWidth/2),
  ]));

  // Right penalty area
  group.add(createLine([
    new THREE.Vector3(pw/2, 0, -penaltyWidth/2),
    new THREE.Vector3(pw/2 - penaltyDepth, 0, -penaltyWidth/2),
  ]));
  group.add(createLine([
    new THREE.Vector3(pw/2 - penaltyDepth, 0, -penaltyWidth/2),
    new THREE.Vector3(pw/2 - penaltyDepth, 0, penaltyWidth/2),
  ]));
  group.add(createLine([
    new THREE.Vector3(pw/2 - penaltyDepth, 0, penaltyWidth/2),
    new THREE.Vector3(pw/2, 0, penaltyWidth/2),
  ]));

  // Goal areas (6-yard box)
  const goalAreaDepth = 5.5 * pitchScale.width;
  const goalAreaWidth = 18.32 * pitchScale.height;

  // Left goal area
  group.add(createLine([
    new THREE.Vector3(-pw/2, 0, -goalAreaWidth/2),
    new THREE.Vector3(-pw/2 + goalAreaDepth, 0, -goalAreaWidth/2),
  ]));
  group.add(createLine([
    new THREE.Vector3(-pw/2 + goalAreaDepth, 0, -goalAreaWidth/2),
    new THREE.Vector3(-pw/2 + goalAreaDepth, 0, goalAreaWidth/2),
  ]));
  group.add(createLine([
    new THREE.Vector3(-pw/2 + goalAreaDepth, 0, goalAreaWidth/2),
    new THREE.Vector3(-pw/2, 0, goalAreaWidth/2),
  ]));

  // Right goal area
  group.add(createLine([
    new THREE.Vector3(pw/2, 0, -goalAreaWidth/2),
    new THREE.Vector3(pw/2 - goalAreaDepth, 0, -goalAreaWidth/2),
  ]));
  group.add(createLine([
    new THREE.Vector3(pw/2 - goalAreaDepth, 0, -goalAreaWidth/2),
    new THREE.Vector3(pw/2 - goalAreaDepth, 0, goalAreaWidth/2),
  ]));
  group.add(createLine([
    new THREE.Vector3(pw/2 - goalAreaDepth, 0, goalAreaWidth/2),
    new THREE.Vector3(pw/2, 0, goalAreaWidth/2),
  ]));

  // Penalty spots
  const penaltySpotDist = 11 * pitchScale.width;
  const spotGeom = new THREE.CircleGeometry(0.22, 32);
  
  const leftSpot = new THREE.Mesh(spotGeom, lineMat);
  leftSpot.rotation.x = -Math.PI / 2;
  leftSpot.position.set(-pw/2 + penaltySpotDist, 0.006, 0);
  group.add(leftSpot);

  const rightSpot = new THREE.Mesh(spotGeom, lineMat);
  rightSpot.rotation.x = -Math.PI / 2;
  rightSpot.position.set(pw/2 - penaltySpotDist, 0.006, 0);
  group.add(rightSpot);

  // Penalty arcs
  const arcRadius = 9.15 * pitchScale.width;
  const arcAngle = Math.acos(penaltyDepth / arcRadius);

  // Left arc
  const leftArcGeom = new THREE.RingGeometry(arcRadius - lineWidth/2, arcRadius + lineWidth/2, 32, 1, Math.PI/2 - arcAngle, arcAngle * 2);
  const leftArc = new THREE.Mesh(leftArcGeom, lineMat);
  leftArc.rotation.x = -Math.PI / 2;
  leftArc.rotation.z = 0;
  leftArc.position.set(-pw/2 + penaltySpotDist, 0.005, 0);
  group.add(leftArc);

  // Right arc
  const rightArcGeom = new THREE.RingGeometry(arcRadius - lineWidth/2, arcRadius + lineWidth/2, 32, 1, -Math.PI/2 - arcAngle, arcAngle * 2);
  const rightArc = new THREE.Mesh(rightArcGeom, lineMat);
  rightArc.rotation.x = -Math.PI / 2;
  rightArc.rotation.z = 0;
  rightArc.position.set(pw/2 - penaltySpotDist, 0.005, 0);
  group.add(rightArc);

  // Corner arcs
  const cornerRadius = 1 * Math.min(pitchScale.width, pitchScale.height);
  const corners = [
    { x: -pw/2, z: -ph/2, startAngle: 0 },
    { x: pw/2, z: -ph/2, startAngle: Math.PI/2 },
    { x: pw/2, z: ph/2, startAngle: Math.PI },
    { x: -pw/2, z: ph/2, startAngle: -Math.PI/2 },
  ];

  corners.forEach(corner => {
    const cornerArcGeom = new THREE.RingGeometry(cornerRadius - lineWidth/2, cornerRadius + lineWidth/2, 16, 1, corner.startAngle, Math.PI/2);
    const cornerArc = new THREE.Mesh(cornerArcGeom, lineMat);
    cornerArc.rotation.x = -Math.PI / 2;
    cornerArc.position.set(corner.x, 0.005, corner.z);
    group.add(cornerArc);
  });

  // === GOALS ===
  const goalWidth = 7.32 * pitchScale.height;
  const goalHeight = 2.44;
  const goalDepth = 2.44 * pitchScale.width;

  // Left goal
  const leftGoalPosts = createGoalPosts(goalWidth, goalHeight, true);
  leftGoalPosts.position.x = -pw/2;
  group.add(leftGoalPosts);

  const leftGoalNet = createGoalNet(goalWidth, goalHeight, goalDepth, true);
  leftGoalNet.position.x = -pw/2;
  group.add(leftGoalNet);

  // Right goal
  const rightGoalPosts = createGoalPosts(goalWidth, goalHeight, false);
  rightGoalPosts.position.x = pw/2;
  group.add(rightGoalPosts);

  const rightGoalNet = createGoalNet(goalWidth, goalHeight, goalDepth, false);
  rightGoalNet.position.x = pw/2;
  group.add(rightGoalNet);

  return group;
}

// Standard reference points on a pitch (can be used for calibration)
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
  // Penalty areas
  { id: 'penalty_left', label: 'Left Penalty Spot', x: -41.5, z: 0 },
  { id: 'penalty_right', label: 'Right Penalty Spot', x: 41.5, z: 0 },
  { id: 'penalty_left_tl', label: 'Left Penalty Box TL', x: -52.5, z: -20.15 },
  { id: 'penalty_left_tr', label: 'Left Penalty Box TR', x: -36, z: -20.15 },
  { id: 'penalty_left_bl', label: 'Left Penalty Box BL', x: -52.5, z: 20.15 },
  { id: 'penalty_left_br', label: 'Left Penalty Box BR', x: -36, z: 20.15 },
  { id: 'penalty_right_tl', label: 'Right Penalty Box TL', x: 36, z: -20.15 },
  { id: 'penalty_right_tr', label: 'Right Penalty Box TR', x: 52.5, z: -20.15 },
  { id: 'penalty_right_bl', label: 'Right Penalty Box BL', x: 36, z: 20.15 },
  { id: 'penalty_right_br', label: 'Right Penalty Box BR', x: 52.5, z: 20.15 },
  // Goal boxes
  { id: 'goalbox_left_tl', label: 'Left Goal Box TL', x: -52.5, z: -9.16 },
  { id: 'goalbox_left_tr', label: 'Left Goal Box TR', x: -47, z: -9.16 },
  { id: 'goalbox_left_bl', label: 'Left Goal Box BL', x: -52.5, z: 9.16 },
  { id: 'goalbox_left_br', label: 'Left Goal Box BR', x: -47, z: 9.16 },
  { id: 'goalbox_right_tl', label: 'Right Goal Box TL', x: 47, z: -9.16 },
  { id: 'goalbox_right_tr', label: 'Right Goal Box TR', x: 52.5, z: -9.16 },
  { id: 'goalbox_right_bl', label: 'Right Goal Box BL', x: 47, z: 9.16 },
  { id: 'goalbox_right_br', label: 'Right Goal Box BR', x: 52.5, z: 9.16 },
  // Goal posts
  { id: 'goal_left_tl', label: 'Left Goal Post Top', x: -52.5, z: -3.66 },
  { id: 'goal_left_bl', label: 'Left Goal Post Bottom', x: -52.5, z: 3.66 },
  { id: 'goal_right_tl', label: 'Right Goal Post Top', x: 52.5, z: -3.66 },
  { id: 'goal_right_bl', label: 'Right Goal Post Bottom', x: 52.5, z: 3.66 },
];
