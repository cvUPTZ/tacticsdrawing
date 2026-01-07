import * as THREE from 'three';

// SOTA Professional Football Pitch Component
// Full FIFA-standard pitch with all markings, goals, corner flags, and stadium elements

interface PitchScale {
  width: number;
  height: number;
}

// Create professional mowing pattern texture with enhanced detail
function createGrassTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;

  // Base grass color gradient
  const gradient = ctx.createLinearGradient(0, 0, 1024, 0);
  gradient.addColorStop(0, '#1a5f2a');
  gradient.addColorStop(0.5, '#1d6b30');
  gradient.addColorStop(1, '#1a5f2a');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1024, 1024);

  // Mowing stripes pattern - alternating light/dark
  const stripeWidth = 128;
  for (let i = 0; i < 8; i++) {
    const shade = i % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)';
    ctx.fillStyle = shade;
    ctx.fillRect(i * stripeWidth, 0, stripeWidth, 1024);
  }

  // Add subtle grass blade texture
  ctx.strokeStyle = 'rgba(0, 80, 20, 0.15)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 2000; i++) {
    const x = Math.random() * 1024;
    const y = Math.random() * 1024;
    const length = 3 + Math.random() * 8;
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.3;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length);
    ctx.stroke();
  }

  // Add subtle noise/texture
  const imageData = ctx.getImageData(0, 0, 1024, 1024);
  for (let i = 0; i < imageData.data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 10;
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

// Create goal net mesh with realistic sagging
function createGoalNet(goalWidth: number, goalHeight: number, goalDepth: number, isLeft: boolean): THREE.Group {
  const group = new THREE.Group();
  const netColor = 0xffffff;
  const netOpacity = 0.3;
  const netDensity = 24;

  // Back net with slight curve for sag effect
  const backNetGeometry = new THREE.PlaneGeometry(goalWidth, goalHeight * 0.9, netDensity, Math.floor(netDensity * 0.6));
  const positions = backNetGeometry.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    const y = positions.getY(i);
    // Create slight sag in the middle
    const sagFactor = (1 - Math.abs(y / (goalHeight * 0.45))) * 0.15;
    positions.setZ(i, positions.getZ(i) - sagFactor);
  }
  backNetGeometry.computeVertexNormals();
  
  const backNetMaterial = new THREE.MeshBasicMaterial({
    color: netColor,
    transparent: true,
    opacity: netOpacity,
    side: THREE.DoubleSide,
    wireframe: true,
  });
  const backNet = new THREE.Mesh(backNetGeometry, backNetMaterial);
  backNet.position.set(isLeft ? -goalDepth : goalDepth, goalHeight * 0.45, 0);
  backNet.rotation.y = isLeft ? 0 : Math.PI;
  group.add(backNet);

  // Side nets
  const sideNetGeometry = new THREE.PlaneGeometry(goalDepth, goalHeight, 10, 14);
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

  // Top net with sag
  const topNetGeometry = new THREE.PlaneGeometry(goalDepth, goalWidth, 10, netDensity);
  const topPositions = topNetGeometry.attributes.position;
  for (let i = 0; i < topPositions.count; i++) {
    const x = topPositions.getX(i);
    const sagAmount = Math.abs(x / goalDepth) * 0.3;
    topPositions.setZ(i, topPositions.getZ(i) - sagAmount);
  }
  topNetGeometry.computeVertexNormals();
  
  const topNetMaterial = new THREE.MeshBasicMaterial({
    color: netColor,
    transparent: true,
    opacity: netOpacity * 0.8,
    side: THREE.DoubleSide,
    wireframe: true,
  });
  const topNet = new THREE.Mesh(topNetGeometry, topNetMaterial);
  topNet.position.set(isLeft ? -goalDepth / 2 : goalDepth / 2, goalHeight * 0.95, 0);
  topNet.rotation.x = Math.PI / 2;
  topNet.rotation.z = Math.PI / 2;
  group.add(topNet);

  return group;
}

// Create 3D goal posts with proper thickness and crossbar
function createGoalPosts(goalWidth: number, goalHeight: number, goalDepth: number, isLeft: boolean): THREE.Group {
  const group = new THREE.Group();
  const postRadius = 0.06;
  const postMaterial = new THREE.MeshPhongMaterial({
    color: 0xffffff,
    emissive: 0x444444,
    shininess: 100,
  });

  // Left post
  const leftPostGeom = new THREE.CylinderGeometry(postRadius, postRadius, goalHeight, 16);
  const leftPost = new THREE.Mesh(leftPostGeom, postMaterial);
  leftPost.position.set(0, goalHeight / 2, -goalWidth / 2);
  leftPost.castShadow = true;
  group.add(leftPost);

  // Right post
  const rightPostGeom = new THREE.CylinderGeometry(postRadius, postRadius, goalHeight, 16);
  const rightPost = new THREE.Mesh(rightPostGeom, postMaterial);
  rightPost.position.set(0, goalHeight / 2, goalWidth / 2);
  rightPost.castShadow = true;
  group.add(rightPost);

  // Crossbar
  const crossbarGeom = new THREE.CylinderGeometry(postRadius, postRadius, goalWidth + postRadius * 2, 16);
  const crossbar = new THREE.Mesh(crossbarGeom, postMaterial);
  crossbar.rotation.x = Math.PI / 2;
  crossbar.position.set(0, goalHeight, 0);
  crossbar.castShadow = true;
  group.add(crossbar);

  // Back support structure
  const backPostMaterial = new THREE.MeshPhongMaterial({
    color: 0xcccccc,
    emissive: 0x333333,
    shininess: 50,
  });

  // Back vertical posts
  const backPostGeom = new THREE.CylinderGeometry(postRadius * 0.7, postRadius * 0.7, goalHeight * 0.9, 8);
  const backLeftPost = new THREE.Mesh(backPostGeom, backPostMaterial);
  backLeftPost.position.set(isLeft ? -goalDepth : goalDepth, goalHeight * 0.45, -goalWidth / 2);
  group.add(backLeftPost);

  const backRightPost = new THREE.Mesh(backPostGeom, backPostMaterial);
  backRightPost.position.set(isLeft ? -goalDepth : goalDepth, goalHeight * 0.45, goalWidth / 2);
  group.add(backRightPost);

  // Back crossbar
  const backCrossbarGeom = new THREE.CylinderGeometry(postRadius * 0.7, postRadius * 0.7, goalWidth, 8);
  const backCrossbar = new THREE.Mesh(backCrossbarGeom, backPostMaterial);
  backCrossbar.rotation.x = Math.PI / 2;
  backCrossbar.position.set(isLeft ? -goalDepth : goalDepth, goalHeight * 0.9, 0);
  group.add(backCrossbar);

  // Diagonal support struts
  const strutLength = Math.sqrt(goalDepth * goalDepth + goalHeight * goalHeight * 0.25);
  const strutGeom = new THREE.CylinderGeometry(postRadius * 0.5, postRadius * 0.5, strutLength, 6);
  const strutAngle = Math.atan2(goalHeight * 0.5, goalDepth);

  const leftStrut = new THREE.Mesh(strutGeom, backPostMaterial);
  leftStrut.position.set(isLeft ? -goalDepth / 2 : goalDepth / 2, goalHeight * 0.75, -goalWidth / 2);
  leftStrut.rotation.z = isLeft ? -strutAngle : strutAngle;
  group.add(leftStrut);

  const rightStrut = new THREE.Mesh(strutGeom, backPostMaterial);
  rightStrut.position.set(isLeft ? -goalDepth / 2 : goalDepth / 2, goalHeight * 0.75, goalWidth / 2);
  rightStrut.rotation.z = isLeft ? -strutAngle : strutAngle;
  group.add(rightStrut);

  return group;
}

// Create corner flag
function createCornerFlag(x: number, z: number): THREE.Group {
  const group = new THREE.Group();

  // Flag pole
  const poleHeight = 1.5;
  const poleGeom = new THREE.CylinderGeometry(0.02, 0.02, poleHeight, 8);
  const poleMaterial = new THREE.MeshPhongMaterial({ color: 0xffff00, emissive: 0x666600 });
  const pole = new THREE.Mesh(poleGeom, poleMaterial);
  pole.position.set(x, poleHeight / 2, z);
  pole.castShadow = true;
  group.add(pole);

  // Triangular flag
  const flagShape = new THREE.Shape();
  flagShape.moveTo(0, 0);
  flagShape.lineTo(0.4, 0.15);
  flagShape.lineTo(0, 0.3);
  flagShape.lineTo(0, 0);

  const flagGeom = new THREE.ShapeGeometry(flagShape);
  const flagMaterial = new THREE.MeshBasicMaterial({ 
    color: 0xff4444, 
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.9,
  });
  const flag = new THREE.Mesh(flagGeom, flagMaterial);
  flag.position.set(x, poleHeight - 0.15, z + 0.02);
  flag.rotation.y = -Math.PI / 4;
  group.add(flag);

  return group;
}

// Create technical area marking
function createTechnicalArea(x: number, z: number, isLeft: boolean, pitchScale: PitchScale): THREE.Group {
  const group = new THREE.Group();
  const areaWidth = 1;
  const areaDepth = 10 * pitchScale.height;
  const lineWidth = 0.08;
  
  const lineMat = new THREE.MeshBasicMaterial({ 
    color: 0xffffff, 
    transparent: true, 
    opacity: 0.6,
    side: THREE.DoubleSide,
  });

  // Side lines
  const sideGeom = new THREE.PlaneGeometry(areaWidth, lineWidth);
  const leftLine = new THREE.Mesh(sideGeom, lineMat);
  leftLine.rotation.x = -Math.PI / 2;
  leftLine.position.set(x - areaWidth / 2, 0.003, z - areaDepth / 2);
  leftLine.rotation.z = Math.PI / 2;
  group.add(leftLine);

  const rightLine = new THREE.Mesh(sideGeom, lineMat);
  rightLine.rotation.x = -Math.PI / 2;
  rightLine.position.set(x - areaWidth / 2, 0.003, z + areaDepth / 2);
  rightLine.rotation.z = Math.PI / 2;
  group.add(rightLine);

  // Front line
  const frontGeom = new THREE.PlaneGeometry(areaDepth, lineWidth);
  const frontLine = new THREE.Mesh(frontGeom, lineMat);
  frontLine.rotation.x = -Math.PI / 2;
  frontLine.position.set(x - areaWidth, 0.003, z);
  group.add(frontLine);

  return group;
}

export function createSOTAPitch(pitchScale: PitchScale): THREE.Group {
  const group = new THREE.Group();
  const pw = 105 * pitchScale.width; // Pitch width (length)
  const ph = 68 * pitchScale.height; // Pitch height (width)

  // === GRASS SURFACE ===
  const grassTexture = createGrassTexture();
  const grassGeometry = new THREE.PlaneGeometry(pw + 12, ph + 12);
  const grassMaterial = new THREE.MeshLambertMaterial({
    map: grassTexture,
    color: 0xffffff,
  });
  const grass = new THREE.Mesh(grassGeometry, grassMaterial);
  grass.rotation.x = -Math.PI / 2;
  grass.position.y = -0.01;
  grass.receiveShadow = true;
  group.add(grass);

  // Surrounding area (darker grass/track)
  const surroundGeometry = new THREE.RingGeometry(
    Math.max(pw, ph) / 2 + 5,
    Math.max(pw, ph) / 2 + 15,
    64
  );
  const surroundMaterial = new THREE.MeshBasicMaterial({
    color: 0x2a4a35,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.5,
  });

  // === PITCH MARKINGS ===
  const lineWidth = 0.12;
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, side: THREE.DoubleSide });

  // Helper to create line rectangle
  const createLineRect = (x: number, z: number, width: number, height: number) => {
    const geometry = new THREE.PlaneGeometry(width, height);
    const mesh = new THREE.Mesh(geometry, lineMat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, 0.005, z);
    return mesh;
  };

  // Pitch outline - 4 sides
  group.add(createLineRect(0, -ph / 2, pw, lineWidth)); // Top line
  group.add(createLineRect(0, ph / 2, pw, lineWidth)); // Bottom line
  group.add(createLineRect(-pw / 2, 0, lineWidth, ph)); // Left line
  group.add(createLineRect(pw / 2, 0, lineWidth, ph)); // Right line

  // Center line (halfway line)
  group.add(createLineRect(0, 0, lineWidth, ph));

  // Center circle
  const centerCircleRadius = 9.15 * pitchScale.width;
  const circleGeom = new THREE.RingGeometry(centerCircleRadius - lineWidth / 2, centerCircleRadius + lineWidth / 2, 64);
  const circle = new THREE.Mesh(circleGeom, lineMat);
  circle.rotation.x = -Math.PI / 2;
  circle.position.y = 0.005;
  group.add(circle);

  // Center spot
  const centerSpotGeom = new THREE.CircleGeometry(0.22, 32);
  const centerSpot = new THREE.Mesh(centerSpotGeom, lineMat);
  centerSpot.rotation.x = -Math.PI / 2;
  centerSpot.position.y = 0.006;
  group.add(centerSpot);

  // === PENALTY AREAS ===
  const penaltyDepth = 16.5 * pitchScale.width;
  const penaltyWidth = 40.32 * pitchScale.height;

  // Left penalty area (3 lines)
  group.add(createLineRect(-pw / 2 + penaltyDepth / 2, -penaltyWidth / 2, penaltyDepth, lineWidth)); // Top
  group.add(createLineRect(-pw / 2 + penaltyDepth, 0, lineWidth, penaltyWidth)); // Right side
  group.add(createLineRect(-pw / 2 + penaltyDepth / 2, penaltyWidth / 2, penaltyDepth, lineWidth)); // Bottom

  // Right penalty area
  group.add(createLineRect(pw / 2 - penaltyDepth / 2, -penaltyWidth / 2, penaltyDepth, lineWidth)); // Top
  group.add(createLineRect(pw / 2 - penaltyDepth, 0, lineWidth, penaltyWidth)); // Left side
  group.add(createLineRect(pw / 2 - penaltyDepth / 2, penaltyWidth / 2, penaltyDepth, lineWidth)); // Bottom

  // === GOAL AREAS (6-YARD BOX) ===
  const goalAreaDepth = 5.5 * pitchScale.width;
  const goalAreaWidth = 18.32 * pitchScale.height;

  // Left goal area
  group.add(createLineRect(-pw / 2 + goalAreaDepth / 2, -goalAreaWidth / 2, goalAreaDepth, lineWidth));
  group.add(createLineRect(-pw / 2 + goalAreaDepth, 0, lineWidth, goalAreaWidth));
  group.add(createLineRect(-pw / 2 + goalAreaDepth / 2, goalAreaWidth / 2, goalAreaDepth, lineWidth));

  // Right goal area
  group.add(createLineRect(pw / 2 - goalAreaDepth / 2, -goalAreaWidth / 2, goalAreaDepth, lineWidth));
  group.add(createLineRect(pw / 2 - goalAreaDepth, 0, lineWidth, goalAreaWidth));
  group.add(createLineRect(pw / 2 - goalAreaDepth / 2, goalAreaWidth / 2, goalAreaDepth, lineWidth));

  // === PENALTY SPOTS ===
  const penaltySpotDist = 11 * pitchScale.width;
  const spotGeom = new THREE.CircleGeometry(0.22, 32);

  const leftSpot = new THREE.Mesh(spotGeom, lineMat);
  leftSpot.rotation.x = -Math.PI / 2;
  leftSpot.position.set(-pw / 2 + penaltySpotDist, 0.006, 0);
  group.add(leftSpot);

  const rightSpot = new THREE.Mesh(spotGeom, lineMat);
  rightSpot.rotation.x = -Math.PI / 2;
  rightSpot.position.set(pw / 2 - penaltySpotDist, 0.006, 0);
  group.add(rightSpot);

  // === PENALTY ARCS (D) ===
  const arcRadius = 9.15 * pitchScale.width;
  const arcStartAngle = Math.acos((penaltyDepth - penaltySpotDist) / arcRadius);

  // Left arc (only the part outside the penalty area)
  const leftArcGeom = new THREE.RingGeometry(
    arcRadius - lineWidth / 2,
    arcRadius + lineWidth / 2,
    32,
    1,
    Math.PI / 2 - arcStartAngle,
    arcStartAngle * 2
  );
  const leftArc = new THREE.Mesh(leftArcGeom, lineMat);
  leftArc.rotation.x = -Math.PI / 2;
  leftArc.position.set(-pw / 2 + penaltySpotDist, 0.005, 0);
  group.add(leftArc);

  // Right arc
  const rightArcGeom = new THREE.RingGeometry(
    arcRadius - lineWidth / 2,
    arcRadius + lineWidth / 2,
    32,
    1,
    -Math.PI / 2 - arcStartAngle,
    arcStartAngle * 2
  );
  const rightArc = new THREE.Mesh(rightArcGeom, lineMat);
  rightArc.rotation.x = -Math.PI / 2;
  rightArc.position.set(pw / 2 - penaltySpotDist, 0.005, 0);
  group.add(rightArc);

  // === CORNER ARCS ===
  const cornerRadius = 1 * Math.min(pitchScale.width, pitchScale.height);
  const corners = [
    { x: -pw / 2, z: -ph / 2, startAngle: 0 },           // Top-left
    { x: pw / 2, z: -ph / 2, startAngle: Math.PI / 2 },  // Top-right
    { x: pw / 2, z: ph / 2, startAngle: Math.PI },       // Bottom-right
    { x: -pw / 2, z: ph / 2, startAngle: -Math.PI / 2 }, // Bottom-left
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
    cornerArc.position.set(corner.x, 0.005, corner.z);
    group.add(cornerArc);
  });

  // === CORNER FLAGS ===
  group.add(createCornerFlag(-pw / 2, -ph / 2));
  group.add(createCornerFlag(pw / 2, -ph / 2));
  group.add(createCornerFlag(pw / 2, ph / 2));
  group.add(createCornerFlag(-pw / 2, ph / 2));

  // Halfway line flags (optional - 1m outside)
  group.add(createCornerFlag(0, -ph / 2 - 1));
  group.add(createCornerFlag(0, ph / 2 + 1));

  // === TECHNICAL AREAS ===
  group.add(createTechnicalArea(-pw / 2 - 1, 0, true, pitchScale));
  group.add(createTechnicalArea(pw / 2 + 1, 0, false, pitchScale));

  // === GOALS ===
  const goalWidth = 7.32 * pitchScale.height;
  const goalHeight = 2.44;
  const goalDepth = 2 * pitchScale.width;

  // Left goal
  const leftGoalPosts = createGoalPosts(goalWidth, goalHeight, goalDepth, true);
  leftGoalPosts.position.x = -pw / 2;
  group.add(leftGoalPosts);

  const leftGoalNet = createGoalNet(goalWidth, goalHeight, goalDepth, true);
  leftGoalNet.position.x = -pw / 2;
  group.add(leftGoalNet);

  // Right goal
  const rightGoalPosts = createGoalPosts(goalWidth, goalHeight, goalDepth, false);
  rightGoalPosts.position.x = pw / 2;
  group.add(rightGoalPosts);

  const rightGoalNet = createGoalNet(goalWidth, goalHeight, goalDepth, false);
  rightGoalNet.position.x = pw / 2;
  group.add(rightGoalNet);

  // === PENALTY AREA KICK-OFF MARKS (optional 9.15m marks) ===
  const kickOffMarkLength = 0.3;
  const kickOffMarkDist = 9.15 * pitchScale.width;

  // Marks near penalty area for kick-off distance
  [-1, 1].forEach(side => {
    const markGeom = new THREE.PlaneGeometry(kickOffMarkLength, lineWidth);
    
    // Left side marks
    const leftMark = new THREE.Mesh(markGeom, lineMat);
    leftMark.rotation.x = -Math.PI / 2;
    leftMark.position.set(-pw / 2 + penaltyDepth, 0.005, side * (penaltyWidth / 2 + 0.2));
    group.add(leftMark);

    // Right side marks
    const rightMark = new THREE.Mesh(markGeom, lineMat);
    rightMark.rotation.x = -Math.PI / 2;
    rightMark.position.set(pw / 2 - penaltyDepth, 0.005, side * (penaltyWidth / 2 + 0.2));
    group.add(rightMark);
  });

  return group;
}

// Standard reference points on a pitch for calibration (normalized to base 105x68)
export const PITCH_REFERENCE_POINTS = [
  // Corners (pitch outline)
  { id: 'corner_tl', label: 'Top-Left Corner', x: -52.5, z: -34 },
  { id: 'corner_tr', label: 'Top-Right Corner', x: 52.5, z: -34 },
  { id: 'corner_bl', label: 'Bottom-Left Corner', x: -52.5, z: 34 },
  { id: 'corner_br', label: 'Bottom-Right Corner', x: 52.5, z: 34 },

  // Center elements
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

  // Left penalty area corners
  { id: 'penalty_left_tl', label: 'Left Penalty Box TL', x: -52.5, z: -20.16 },
  { id: 'penalty_left_tr', label: 'Left Penalty Box TR', x: -36, z: -20.16 },
  { id: 'penalty_left_bl', label: 'Left Penalty Box BL', x: -52.5, z: 20.16 },
  { id: 'penalty_left_br', label: 'Left Penalty Box BR', x: -36, z: 20.16 },

  // Right penalty area corners
  { id: 'penalty_right_tl', label: 'Right Penalty Box TL', x: 36, z: -20.16 },
  { id: 'penalty_right_tr', label: 'Right Penalty Box TR', x: 52.5, z: -20.16 },
  { id: 'penalty_right_bl', label: 'Right Penalty Box BL', x: 36, z: 20.16 },
  { id: 'penalty_right_br', label: 'Right Penalty Box BR', x: 52.5, z: 20.16 },

  // Left goal area (6-yard box) corners
  { id: 'goalbox_left_tl', label: 'Left 6-Yard Box TL', x: -52.5, z: -9.16 },
  { id: 'goalbox_left_tr', label: 'Left 6-Yard Box TR', x: -47, z: -9.16 },
  { id: 'goalbox_left_bl', label: 'Left 6-Yard Box BL', x: -52.5, z: 9.16 },
  { id: 'goalbox_left_br', label: 'Left 6-Yard Box BR', x: -47, z: 9.16 },

  // Right goal area (6-yard box) corners
  { id: 'goalbox_right_tl', label: 'Right 6-Yard Box TL', x: 47, z: -9.16 },
  { id: 'goalbox_right_tr', label: 'Right 6-Yard Box TR', x: 52.5, z: -9.16 },
  { id: 'goalbox_right_bl', label: 'Right 6-Yard Box BL', x: 47, z: 9.16 },
  { id: 'goalbox_right_br', label: 'Right 6-Yard Box BR', x: 52.5, z: 9.16 },

  // Goal posts
  { id: 'goal_left_top', label: 'Left Goal Post Top', x: -52.5, z: -3.66 },
  { id: 'goal_left_bottom', label: 'Left Goal Post Bottom', x: -52.5, z: 3.66 },
  { id: 'goal_right_top', label: 'Right Goal Post Top', x: 52.5, z: -3.66 },
  { id: 'goal_right_bottom', label: 'Right Goal Post Bottom', x: 52.5, z: 3.66 },

  // Penalty arc D intersections (where arc meets penalty box line)
  { id: 'arc_left_top', label: 'Left Arc Top', x: -36, z: -8.5 },
  { id: 'arc_left_bottom', label: 'Left Arc Bottom', x: -36, z: 8.5 },
  { id: 'arc_right_top', label: 'Right Arc Top', x: 36, z: -8.5 },
  { id: 'arc_right_bottom', label: 'Right Arc Bottom', x: 36, z: 8.5 },
];
