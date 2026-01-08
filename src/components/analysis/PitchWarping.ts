import * as THREE from 'three';
import { PitchControlPoint } from './DirectPitchManipulation';

/**
 * Create a warped pitch mesh based on control points
 * Uses mesh deformation to match user-adjusted control points
 */
export function createWarpedPitchMesh(
  controlPoints: PitchControlPoint[],
  pitchScale: { width: number; height: number }
): THREE.Group {
  const group = new THREE.Group();
  
  const pw = 105 * pitchScale.width;
  const ph = 68 * pitchScale.height;
  
  // Create a plane geometry with enough subdivisions for warping
  const segments = 32; // More segments = smoother warping
  const planeGeometry = new THREE.PlaneGeometry(pw, ph, segments, segments);
  
  // Get the position attribute
  const positions = planeGeometry.attributes.position;
  
  // Apply warping based on control points
  if (controlPoints.some(p => p.adjustedX !== undefined || p.adjustedZ !== undefined)) {
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const z = positions.getZ(i);
      
      // Calculate warped position using inverse distance weighting
      const warpedPos = calculateWarpedPosition(x, z, controlPoints);
      positions.setX(i, warpedPos.x);
      positions.setZ(i, warpedPos.z);
    }
    
    positions.needsUpdate = true;
    planeGeometry.computeVertexNormals();
  }
  
  // Create the pitch material (transparent so video shows through)
  const pitchMaterial = new THREE.MeshBasicMaterial({
    color: 0x2d8a3e,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
  });
  
  const pitchMesh = new THREE.Mesh(planeGeometry, pitchMaterial);
  pitchMesh.rotation.x = -Math.PI / 2;
  pitchMesh.position.y = 0;
  group.add(pitchMesh);
  
  return group;
}

/**
 * Calculate warped position for a point using inverse distance weighting
 * from all adjusted control points
 */
function calculateWarpedPosition(
  x: number,
  z: number,
  controlPoints: PitchControlPoint[]
): { x: number; z: number } {
  // Filter to only adjusted points
  const adjustedPoints = controlPoints.filter(
    p => p.adjustedX !== undefined || p.adjustedZ !== undefined
  );
  
  if (adjustedPoints.length === 0) {
    return { x, z };
  }
  
  // Inverse distance weighting
  let totalWeight = 0;
  let weightedDx = 0;
  let weightedDz = 0;
  
  for (const point of adjustedPoints) {
    const dx = x - point.pitchX;
    const dz = z - point.pitchZ;
    const distance = Math.sqrt(dx * dx + dz * dz);
    
    // Avoid division by zero - if we're exactly at a control point, use it directly
    if (distance < 0.01) {
      return {
        x: point.adjustedX ?? point.pitchX,
        z: point.adjustedZ ?? point.pitchZ,
      };
    }
    
    // Weight is inverse of distance (closer points have more influence)
    // Power of 2 gives smoother falloff
    const weight = 1 / (distance * distance);
    totalWeight += weight;
    
    const targetX = point.adjustedX ?? point.pitchX;
    const targetZ = point.adjustedZ ?? point.pitchZ;
    
    const offsetX = targetX - point.pitchX;
    const offsetZ = targetZ - point.pitchZ;
    
    weightedDx += offsetX * weight;
    weightedDz += offsetZ * weight;
  }
  
  // Apply weighted average offset
  return {
    x: x + (weightedDx / totalWeight),
    z: z + (weightedDz / totalWeight),
  };
}

/**
 * Create visual markers for control points on the pitch
 */
export function createControlPointMarkers(
  controlPoints: PitchControlPoint[],
  activePointId: string | null,
  pitchScale: { width: number; height: number }
): THREE.Group {
  const group = new THREE.Group();
  
  controlPoints.forEach(point => {
    const isActive = point.id === activePointId;
    const isAdjusted = point.adjustedX !== undefined || point.adjustedZ !== undefined;
    
    const x = (point.adjustedX ?? point.pitchX) * pitchScale.width;
    const z = (point.adjustedZ ?? point.pitchZ) * pitchScale.height;
    
    // Marker color based on state
    let color: number;
    if (isActive) {
      color = 0x00ff88; // Bright green for active
    } else if (isAdjusted) {
      color = 0xffaa00; // Orange for adjusted
    } else {
      color = 0x4488ff; // Blue for default
    }
    
    // Outer ring
    const ringGeometry = new THREE.RingGeometry(1.5, 2, 32);
    const ringMaterial = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: isActive ? 0.9 : 0.6,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, 0.1, z);
    group.add(ring);
    
    // Center dot
    const dotGeometry = new THREE.CircleGeometry(0.8, 16);
    const dotMaterial = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
    });
    const dot = new THREE.Mesh(dotGeometry, dotMaterial);
    dot.rotation.x = -Math.PI / 2;
    dot.position.set(x, 0.11, z);
    group.add(dot);
    
    // Connection line showing displacement if adjusted
    if (isAdjusted) {
      const originalX = point.pitchX * pitchScale.width;
      const originalZ = point.pitchZ * pitchScale.height;
      
      const lineGeometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(originalX, 0.15, originalZ),
        new THREE.Vector3(x, 0.15, z),
      ]);
      const lineMaterial = new THREE.LineDashedMaterial({
        color: 0xffaa00,
        dashSize: 0.5,
        gapSize: 0.3,
        transparent: true,
        opacity: 0.7,
      });
      const line = new THREE.Line(lineGeometry, lineMaterial);
      line.computeLineDistances();
      group.add(line);
      
      // Small marker at original position
      const originalDot = new THREE.Mesh(
        new THREE.CircleGeometry(0.4, 16),
        new THREE.MeshBasicMaterial({
          color: 0x888888,
          transparent: true,
          opacity: 0.5,
          side: THREE.DoubleSide,
        })
      );
      originalDot.rotation.x = -Math.PI / 2;
      originalDot.position.set(originalX, 0.08, originalZ);
      group.add(originalDot);
    }
    
    // Vertical indicator for active point
    if (isActive) {
      const poleGeometry = new THREE.CylinderGeometry(0.15, 0.15, 8, 8);
      const poleMaterial = new THREE.MeshBasicMaterial({
        color: 0x00ff88,
        transparent: true,
        opacity: 0.7,
      });
      const pole = new THREE.Mesh(poleGeometry, poleMaterial);
      pole.position.set(x, 4, z);
      group.add(pole);
      
      // Pulsing top sphere
      const sphereGeometry = new THREE.SphereGeometry(0.5, 16, 16);
      const sphereMaterial = new THREE.MeshBasicMaterial({
        color: 0x00ff88,
        transparent: true,
        opacity: 0.8,
      });
      const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
      sphere.position.set(x, 8, z);
      group.add(sphere);
    }
  });
  
  return group;
}
