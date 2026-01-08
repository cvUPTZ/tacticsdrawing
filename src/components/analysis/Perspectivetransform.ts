import * as THREE from 'three';
import { FieldPoint } from './RealTimePitchDrawing';

/**
 * Calculate perspective transformation matrix from field points
 * Uses homography to map 2D screen coordinates to 3D pitch coordinates
 */
export function calculatePerspectiveTransform(
  fieldPoints: FieldPoint[],
  containerWidth: number,
  containerHeight: number
): THREE.Matrix4 | null {
  // Need at least 4 points for perspective transformation
  const setPoints = fieldPoints.filter(p => p.screenX !== undefined && p.screenY !== undefined);
  if (setPoints.length < 4) return null;

  // Use the first 4 points to calculate basic transform
  // In a real implementation, this would use all points with DLT (Direct Linear Transform)
  const corners = setPoints.slice(0, 4);

  // Normalize screen coordinates to [-1, 1]
  const normalized = corners.map(p => ({
    screenX: (p.screenX! / containerWidth) * 2 - 1,
    screenY: -((p.screenY! / containerHeight) * 2 - 1), // Flip Y
    pitchX: p.pitchX,
    pitchZ: p.pitchZ,
  }));

  // Calculate average camera position and rotation
  // This is a simplified approximation
  const avgScreenX = normalized.reduce((sum, p) => sum + p.screenX, 0) / normalized.length;
  const avgScreenY = normalized.reduce((sum, p) => sum + p.screenY, 0) / normalized.length;

  // Estimate camera height based on perspective
  const topPoints = normalized.filter(p => p.pitchZ < 0);
  const bottomPoints = normalized.filter(p => p.pitchZ > 0);
  
  const topAvgY = topPoints.reduce((sum, p) => sum + p.screenY, 0) / topPoints.length;
  const bottomAvgY = bottomPoints.reduce((sum, p) => sum + p.screenY, 0) / bottomPoints.length;
  
  const perspectiveRatio = Math.abs(bottomAvgY - topAvgY);
  const cameraHeight = 20 + perspectiveRatio * 60;

  // Estimate camera angle
  const cameraRotationX = -0.3 - (perspectiveRatio * 0.4);
  const cameraRotationY = -avgScreenX * 0.5;

  // Create transformation matrix
  const matrix = new THREE.Matrix4();
  
  // Apply translation
  matrix.makeTranslation(-avgScreenX * 30, cameraHeight, 50 + perspectiveRatio * 40);
  
  // Apply rotation
  const rotationMatrix = new THREE.Matrix4();
  rotationMatrix.makeRotationFromEuler(new THREE.Euler(cameraRotationX, cameraRotationY, 0));
  matrix.multiply(rotationMatrix);

  return matrix;
}

/**
 * Calculate camera parameters from field points for Three.js camera
 */
export function calculateCameraFromFieldPoints(
  fieldPoints: FieldPoint[],
  containerWidth: number,
  containerHeight: number
): {
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  fov: number;
} | null {
  const setPoints = fieldPoints.filter(p => p.screenX !== undefined && p.screenY !== undefined);
  if (setPoints.length < 4) return null;

  // Normalize coordinates
  const normalized = setPoints.map(p => ({
    screenX: (p.screenX! / containerWidth) * 2 - 1,
    screenY: -((p.screenY! / containerHeight) * 2 - 1),
    pitchX: p.pitchX,
    pitchZ: p.pitchZ,
  }));

  // Calculate center offset
  const avgScreenX = normalized.reduce((sum, p) => sum + p.screenX, 0) / normalized.length;
  const avgScreenY = normalized.reduce((sum, p) => sum + p.screenY, 0) / normalized.length;

  // Calculate perspective (how much smaller top is compared to bottom)
  const topPoints = normalized.filter(p => p.pitchZ < 0);
  const bottomPoints = normalized.filter(p => p.pitchZ > 0);
  
  const topLeftRight = topPoints.reduce((sum, p) => sum + Math.abs(p.screenX), 0) / topPoints.length;
  const bottomLeftRight = bottomPoints.reduce((sum, p) => sum + Math.abs(p.screenX), 0) / bottomPoints.length;
  
  const perspectiveRatio = topLeftRight / (bottomLeftRight || 1);

  // Estimate camera parameters
  const cameraY = 25 + (1 - perspectiveRatio) * 70; // Height
  const cameraZ = 45 + (1 - perspectiveRatio) * 55; // Distance
  const cameraX = -avgScreenX * 40; // Side offset

  const rotationX = -0.35 - ((1 - perspectiveRatio) * 0.3); // Pitch down
  const rotationY = -avgScreenX * 0.6; // Pan left/right
  const rotationZ = 0; // No roll

  // FOV based on how spread out points are
  const spreadX = Math.max(...normalized.map(p => Math.abs(p.screenX)));
  const fov = 45 + (1 - spreadX) * 30; // Narrower FOV if points are close together

  return {
    position: { x: cameraX, y: cameraY, z: cameraZ },
    rotation: { x: rotationX, y: rotationY, z: rotationZ },
    fov: Math.max(30, Math.min(90, fov)),
  };
}

/**
 * Calculate pitch scale based on field points
 */
export function calculatePitchScale(
  fieldPoints: FieldPoint[],
  containerWidth: number,
  containerHeight: number
): { width: number; height: number } {
  const setPoints = fieldPoints.filter(p => p.screenX !== undefined && p.screenY !== undefined);
  if (setPoints.length < 4) return { width: 1, height: 1 };

  // Find corners if available
  const topLeft = setPoints.find(p => p.pitchX < 0 && p.pitchZ < 0);
  const topRight = setPoints.find(p => p.pitchX > 0 && p.pitchZ < 0);
  const bottomLeft = setPoints.find(p => p.pitchX < 0 && p.pitchZ > 0);
  const bottomRight = setPoints.find(p => p.pitchX > 0 && p.pitchZ > 0);

  if (!topLeft || !topRight || !bottomLeft || !bottomRight) {
    return { width: 1, height: 1 };
  }

  // Calculate screen distances
  const topWidth = Math.abs(topRight.screenX! - topLeft.screenX!) / containerWidth;
  const bottomWidth = Math.abs(bottomRight.screenX! - bottomLeft.screenX!) / containerWidth;
  const leftHeight = Math.abs(bottomLeft.screenY! - topLeft.screenY!) / containerHeight;
  const rightHeight = Math.abs(bottomRight.screenY! - topRight.screenY!) / containerHeight;

  // Average dimensions
  const avgWidth = (topWidth + bottomWidth) / 2;
  const avgHeight = (leftHeight + rightHeight) / 2;

  // Calculate aspect ratio
  const screenAspect = avgWidth / avgHeight;
  const pitchAspect = 105 / 68; // Real pitch aspect ratio

  // Scale factors
  const widthScale = screenAspect / pitchAspect;
  const heightScale = 1.0;

  return {
    width: Math.max(0.5, Math.min(2, widthScale)),
    height: Math.max(0.5, Math.min(2, heightScale)),
  };
}

/**
 * Validate field points - check if they make geometric sense
 */
export function validateFieldPoints(fieldPoints: FieldPoint[]): {
  isValid: boolean;
  warnings: string[];
} {
  const setPoints = fieldPoints.filter(p => p.screenX !== undefined && p.screenY !== undefined);
  const warnings: string[] = [];

  if (setPoints.length < 4) {
    return {
      isValid: false,
      warnings: ['Need at least 4 points to draw the pitch'],
    };
  }

  // Check if corners form a quadrilateral (not crossed)
  const corners = [
    setPoints.find(p => p.pitchX < 0 && p.pitchZ < 0), // TL
    setPoints.find(p => p.pitchX > 0 && p.pitchZ < 0), // TR
    setPoints.find(p => p.pitchX > 0 && p.pitchZ > 0), // BR
    setPoints.find(p => p.pitchX < 0 && p.pitchZ > 0), // BL
  ];

  if (corners.every(c => c)) {
    // Check if top-left is actually top-left on screen, etc.
    const tl = corners[0]!;
    const tr = corners[1]!;
    const br = corners[2]!;
    const bl = corners[3]!;

    if (tl.screenX! > tr.screenX!) {
      warnings.push('Top corners seem reversed (left is right of right)');
    }
    if (bl.screenX! > br.screenX!) {
      warnings.push('Bottom corners seem reversed');
    }
    if (tl.screenY! > bl.screenY!) {
      warnings.push('Vertical order seems wrong (top is below bottom)');
    }
  }

  return {
    isValid: warnings.length === 0,
    warnings,
  };
}
