import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import * as THREE from 'three';
import { Annotation, CalibrationState, ToolMode, Vector3 } from '@/types/analysis';
import { HeatmapType, HeatmapOverlay, getHeatmapColor } from './HeatmapOverlay';
import { createSOTAPitch, PITCH_REFERENCE_POINTS } from './SOTAPitch';
import { CalibrationPoint } from './PointCalibration';
import { PitchTransform, DEFAULT_TRANSFORM } from './PitchTransformControls';
import { PitchCorners, DEFAULT_CORNERS, createPitchFromCorners, createManipulationHandles } from './PitchManipulator';

interface PitchScale {
  width: number;
  height: number;
}

export type GridOverlayType = 'none' | 'thirds' | 'halves' | 'channels' | 'zones';

interface ThreeCanvasProps {
  calibration: CalibrationState;
  annotations: Annotation[];
  toolMode: ToolMode;
  isInteractive: boolean;
  onPitchClick?: (position: Vector3) => void;
  pitchScale?: PitchScale;
  gridOverlay?: GridOverlayType;
  heatmapType?: HeatmapType;
  useSOTAPitch?: boolean;
  calibrationPoints?: CalibrationPoint[];
  activeCalibrationPointId?: string | null;
  pitchTransform?: PitchTransform;
  // New pitch manipulation props
  pitchCorners?: PitchCorners;
  onPitchCornersChange?: (corners: PitchCorners) => void;
  isPitchManipulating?: boolean;
}

interface LabelData {
  id: string;
  text: string;
  screenX: number;
  screenY: number;
  color: string;
  visible: boolean;
}

// Create curved arrow path
function createCurvedArrowPath(start: THREE.Vector3, end: THREE.Vector3, curveHeight: number = 3): THREE.QuadraticBezierCurve3 {
  const midPoint = new THREE.Vector3(
    (start.x + end.x) / 2,
    curveHeight,
    (start.z + end.z) / 2
  );
  return new THREE.QuadraticBezierCurve3(start, midPoint, end);
}

// Create tube geometry for thick lines
function createTubeFromCurve(curve: THREE.Curve<THREE.Vector3>, radius: number = 0.15): THREE.TubeGeometry {
  return new THREE.TubeGeometry(curve, 32, radius, 8, false);
}

// Create dashed line material
function createDashedLineMaterial(color: THREE.Color, dashSize: number = 1, gapSize: number = 0.5): THREE.LineDashedMaterial {
  return new THREE.LineDashedMaterial({
    color,
    dashSize,
    gapSize,
    transparent: true,
    opacity: 0.9,
  });
}

export function ThreeCanvas({
  calibration,
  annotations,
  toolMode,
  isInteractive,
  onPitchClick,
  pitchScale = { width: 1, height: 1 },
  gridOverlay = 'none',
  heatmapType = 'none',
  useSOTAPitch = true,
  calibrationPoints = [],
  activeCalibrationPointId = null,
  pitchTransform = DEFAULT_TRANSFORM,
  pitchCorners = DEFAULT_CORNERS,
  onPitchCornersChange,
  isPitchManipulating = false,
}: ThreeCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const annotationGroupRef = useRef<THREE.Group | null>(null);
  const pitchGroupRef = useRef<THREE.Group | null>(null);
  const gridGroupRef = useRef<THREE.Group | null>(null);
  const heatmapGroupRef = useRef<THREE.Group | null>(null);
  const calibrationMarkersRef = useRef<THREE.Group | null>(null);
  const handlesGroupRef = useRef<THREE.Group | null>(null);
  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster());
  const pitchPlaneRef = useRef<THREE.Mesh | null>(null);
  const animationTimeRef = useRef(0);
  const [labels, setLabels] = useState<LabelData[]>([]);
  const updateLabelPositionsRef = useRef<() => void>(() => {});
  
  // Pitch manipulation state
  const [activeHandle, setActiveHandle] = useState<string | null>(null);
  const isDraggingHandleRef = useRef(false);
  const dragStartRef = useRef<{ x: number; z: number } | null>(null);
  const cornersStartRef = useRef<PitchCorners | null>(null);

  // Mouse control state refs
  const isDraggingRef = useRef(false);
  const lastMouseRef = useRef({ x: 0, y: 0 });
  const orbitRef = useRef({ theta: 0, phi: Math.PI / 4, radius: 80 }); // Spherical coords

  // Initialize Three.js scene
  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(calibration.cameraFov, width / height, 0.1, 1000);
    cameraRef.current = camera;

    // Set initial camera position from orbit
    const { theta, phi, radius } = orbitRef.current;
    camera.position.set(
      radius * Math.sin(phi) * Math.cos(theta),
      radius * Math.cos(phi),
      radius * Math.sin(phi) * Math.sin(theta)
    );
    camera.lookAt(0, 0, 0);

    // Renderer with enhanced settings
    const renderer = new THREE.WebGLRenderer({ 
      antialias: true, 
      alpha: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Create pitch group
    const pitchGroup = new THREE.Group();
    scene.add(pitchGroup);
    pitchGroupRef.current = pitchGroup;

    // Invisible pitch plane for raycasting
    const pitchGeometry = new THREE.PlaneGeometry(200, 150);
    const pitchMaterial = new THREE.MeshBasicMaterial({ 
      color: 0x2d8a3e,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
    });
    const pitchPlane = new THREE.Mesh(pitchGeometry, pitchMaterial);
    pitchPlane.rotation.x = -Math.PI / 2;
    pitchPlane.position.y = 0;
    scene.add(pitchPlane);
    pitchPlaneRef.current = pitchPlane;

    // Annotation group
    const annotationGroup = new THREE.Group();
    scene.add(annotationGroup);
    annotationGroupRef.current = annotationGroup;

    // Grid overlay group
    const gridGroup = new THREE.Group();
    scene.add(gridGroup);
    gridGroupRef.current = gridGroup;

    // Heatmap group
    const heatmapGroup = new THREE.Group();
    scene.add(heatmapGroup);
    heatmapGroupRef.current = heatmapGroup;

    // Calibration markers group
    const calibrationMarkers = new THREE.Group();
    scene.add(calibrationMarkers);
    calibrationMarkersRef.current = calibrationMarkers;

    // Pitch manipulation handles group
    const handlesGroup = new THREE.Group();
    scene.add(handlesGroup);
    handlesGroupRef.current = handlesGroup;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(50, 100, 50);
    scene.add(directionalLight);

    // Mouse controls for rotation
    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 0) { // Left click
        isDraggingRef.current = true;
        lastMouseRef.current = { x: e.clientX, y: e.clientY };
        container.style.cursor = 'grabbing';
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;

      const deltaX = e.clientX - lastMouseRef.current.x;
      const deltaY = e.clientY - lastMouseRef.current.y;
      lastMouseRef.current = { x: e.clientX, y: e.clientY };

      // Update spherical coordinates
      orbitRef.current.theta -= deltaX * 0.005;
      orbitRef.current.phi -= deltaY * 0.005;
      
      // Clamp phi to prevent flipping
      orbitRef.current.phi = Math.max(0.1, Math.min(Math.PI / 2 - 0.1, orbitRef.current.phi));

      // Update camera position
      const { theta, phi, radius } = orbitRef.current;
      camera.position.set(
        radius * Math.sin(phi) * Math.cos(theta),
        radius * Math.cos(phi),
        radius * Math.sin(phi) * Math.sin(theta)
      );
      camera.lookAt(0, 0, 0);
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      container.style.cursor = 'grab';
    };

    const handleMouseLeave = () => {
      isDraggingRef.current = false;
      container.style.cursor = 'default';
    };

    // Wheel for zoom
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      orbitRef.current.radius += e.deltaY * 0.1;
      orbitRef.current.radius = Math.max(20, Math.min(200, orbitRef.current.radius));

      const { theta, phi, radius } = orbitRef.current;
      camera.position.set(
        radius * Math.sin(phi) * Math.cos(theta),
        radius * Math.cos(phi),
        radius * Math.sin(phi) * Math.sin(theta)
      );
      camera.lookAt(0, 0, 0);
    };

    container.style.cursor = 'grab';
    container.addEventListener('mousedown', handleMouseDown);
    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('mouseup', handleMouseUp);
    container.addEventListener('mouseleave', handleMouseLeave);
    container.addEventListener('wheel', handleWheel, { passive: false });

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);
      animationTimeRef.current += 0.016;
      
      annotationGroup.children.forEach(child => {
        if ((child as any).isSpotlightRing) {
          const startTime = (child as any).spotlightStartTime || 0;
          const elapsed = animationTimeRef.current - startTime;
          const speed = Math.max(0.01, 0.4 * Math.exp(-elapsed * 0.25));
          child.rotation.y += speed;
          const pulse = 1 + Math.sin(animationTimeRef.current * 3) * 0.08;
          child.scale.set(pulse, 1, pulse);
          const mat = (child as THREE.Line).material;
          if (mat && 'opacity' in mat) {
            (mat as THREE.LineBasicMaterial).opacity = 0.6 + Math.sin(animationTimeRef.current * 4) * 0.3;
          }
        }
        if ((child as any).isPressing) {
          const pulseScale = 1 + Math.sin(animationTimeRef.current * 4) * 0.15;
          child.scale.set(pulseScale, pulseScale, pulseScale);
          const mat = (child as THREE.Mesh).material;
          if (mat && 'opacity' in mat) {
            (mat as THREE.MeshBasicMaterial).opacity = 0.3 + Math.sin(animationTimeRef.current * 3) * 0.15;
          }
        }
      });
      
      renderer.render(scene, camera);
      updateLabelPositionsRef.current();
    };
    animate();

    // Handle resize
    const handleResize = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      container.removeEventListener('mousedown', handleMouseDown);
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('mouseup', handleMouseUp);
      container.removeEventListener('mouseleave', handleMouseLeave);
      container.removeEventListener('wheel', handleWheel);
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, []);

  // Update pitch when scale/corners change
  useEffect(() => {
    const pitchGroup = pitchGroupRef.current;
    if (!pitchGroup) return;
    while (pitchGroup.children.length > 0) {
      const child = pitchGroup.children[0];
      pitchGroup.remove(child);
      if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
        if ('geometry' in child) child.geometry.dispose();
        if ('material' in child && child.material instanceof THREE.Material) child.material.dispose();
      }
    }

    // Use corner-based pitch when manipulating, otherwise use SOTA
    if (isPitchManipulating) {
      const cornerPitch = createPitchFromCorners(pitchCorners);
      pitchGroup.add(cornerPitch);
    } else if (useSOTAPitch) {
      const sotaPitch = createSOTAPitch(pitchScale);
      pitchGroup.add(sotaPitch);
    } else {
      // Basic pitch fallback
      const pw = 105 * pitchScale.width;
      const ph = 68 * pitchScale.height;
      const mat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4 });
      const matBright = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 });

      pitchGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-pw/2, 0.01, -ph/2), new THREE.Vector3(pw/2, 0.01, -ph/2),
        new THREE.Vector3(pw/2, 0.01, ph/2), new THREE.Vector3(-pw/2, 0.01, ph/2),
        new THREE.Vector3(-pw/2, 0.01, -ph/2),
      ]), matBright));

      pitchGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0.01, -ph/2), new THREE.Vector3(0, 0.01, ph/2),
      ]), mat));

      const centerCircleRadius = 9.15 * pitchScale.width;
      const circle = new THREE.Mesh(
        new THREE.RingGeometry(centerCircleRadius - 0.15, centerCircleRadius, 64),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4, side: THREE.DoubleSide })
      );
      circle.rotation.x = -Math.PI / 2;
      circle.position.y = 0.01;
      pitchGroup.add(circle);
    }

    // Apply pitch transform only when not manipulating corners
    if (!isPitchManipulating) {
      pitchGroup.position.set(pitchTransform.positionX, pitchTransform.positionY, pitchTransform.positionZ);
      pitchGroup.rotation.set(pitchTransform.rotationX, pitchTransform.rotationY, pitchTransform.rotationZ);
      pitchGroup.scale.set(pitchTransform.scaleX, pitchTransform.scaleY, pitchTransform.scaleZ);
    } else {
      pitchGroup.position.set(0, 0, 0);
      pitchGroup.rotation.set(0, 0, 0);
      pitchGroup.scale.set(1, 1, 1);
    }
  }, [pitchScale, useSOTAPitch, pitchTransform, isPitchManipulating, pitchCorners]);

  // Render manipulation handles when in manipulation mode
  useEffect(() => {
    const handlesGroup = handlesGroupRef.current;
    if (!handlesGroup) return;
    
    while (handlesGroup.children.length > 0) {
      const child = handlesGroup.children[0];
      handlesGroup.remove(child);
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (child.material instanceof THREE.Material) child.material.dispose();
      }
    }

    if (!isPitchManipulating) return;

    const handles = createManipulationHandles(pitchCorners, activeHandle);
    handlesGroup.add(handles);
  }, [isPitchManipulating, pitchCorners, activeHandle]);

  // Handle mouse events for pitch manipulation
  useEffect(() => {
    const container = containerRef.current;
    const camera = cameraRef.current;
    const scene = sceneRef.current;
    if (!container || !camera || !scene || !isPitchManipulating) return;

    const raycaster = raycasterRef.current;

    const getWorldPosition = (e: MouseEvent): { x: number; z: number } | null => {
      const rect = container.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );
      raycaster.setFromCamera(mouse, camera);
      
      // Intersect with ground plane
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      const intersection = new THREE.Vector3();
      raycaster.ray.intersectPlane(plane, intersection);
      
      if (intersection) {
        return { x: intersection.x, z: intersection.z };
      }
      return null;
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      
      const rect = container.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );
      raycaster.setFromCamera(mouse, camera);
      
      const handlesGroup = handlesGroupRef.current;
      if (!handlesGroup) return;
      
      const intersects = raycaster.intersectObjects(handlesGroup.children, true);
      
      for (const intersect of intersects) {
        let obj: THREE.Object3D | null = intersect.object;
        while (obj) {
          if (obj.userData?.handleId) {
            const handleId = obj.userData.handleId;
            const worldPos = getWorldPosition(e);
            if (worldPos) {
              setActiveHandle(handleId);
              isDraggingHandleRef.current = true;
              dragStartRef.current = worldPos;
              cornersStartRef.current = { ...pitchCorners };
              e.stopPropagation();
              e.preventDefault();
            }
            return;
          }
          obj = obj.parent;
        }
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingHandleRef.current || !activeHandle || !dragStartRef.current || !cornersStartRef.current) return;

      const worldPos = getWorldPosition(e);
      if (!worldPos) return;

      const deltaX = worldPos.x - dragStartRef.current.x;
      const deltaZ = worldPos.z - dragStartRef.current.z;
      const start = cornersStartRef.current;

      let newCorners = { ...pitchCorners };

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

      onPitchCornersChange?.(newCorners);
    };

    const handleMouseUp = () => {
      if (isDraggingHandleRef.current) {
        setActiveHandle(null);
        isDraggingHandleRef.current = false;
        dragStartRef.current = null;
        cornersStartRef.current = null;
      }
    };

    container.addEventListener('mousedown', handleMouseDown, { capture: true });
    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('mouseup', handleMouseUp);

    return () => {
      container.removeEventListener('mousedown', handleMouseDown, { capture: true });
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isPitchManipulating, pitchCorners, activeHandle, onPitchCornersChange]);

  // Render calibration point markers on pitch
  useEffect(() => {
    const markersGroup = calibrationMarkersRef.current;
    if (!markersGroup) return;
    while (markersGroup.children.length > 0) {
      const child = markersGroup.children[0];
      markersGroup.remove(child);
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (child.material instanceof THREE.Material) child.material.dispose();
      }
    }

    if (calibrationPoints.length === 0) return;

    calibrationPoints.forEach(point => {
      const isActive = point.id === activeCalibrationPointId;
      const isSet = point.screenX !== undefined;
      
      // Marker ring
      const ringGeometry = new THREE.RingGeometry(1.5, 2, 32);
      const ringColor = isActive ? 0x00ff88 : isSet ? 0x00aaff : 0xffaa00;
      const ringMaterial = new THREE.MeshBasicMaterial({
        color: ringColor,
        transparent: true,
        opacity: isActive ? 0.9 : 0.6,
        side: THREE.DoubleSide,
      });
      const ring = new THREE.Mesh(ringGeometry, ringMaterial);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(point.pitchX * pitchScale.width, 0.1, point.pitchZ * pitchScale.height);
      markersGroup.add(ring);

      // Center dot
      const dotGeometry = new THREE.CircleGeometry(0.5, 16);
      const dotMaterial = new THREE.MeshBasicMaterial({
        color: ringColor,
        transparent: true,
        opacity: 0.8,
        side: THREE.DoubleSide,
      });
      const dot = new THREE.Mesh(dotGeometry, dotMaterial);
      dot.rotation.x = -Math.PI / 2;
      dot.position.set(point.pitchX * pitchScale.width, 0.11, point.pitchZ * pitchScale.height);
      markersGroup.add(dot);

      // Vertical indicator pole for active point
      if (isActive) {
        const poleGeometry = new THREE.CylinderGeometry(0.1, 0.1, 5, 8);
        const poleMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff88, transparent: true, opacity: 0.7 });
        const pole = new THREE.Mesh(poleGeometry, poleMaterial);
        pole.position.set(point.pitchX * pitchScale.width, 2.5, point.pitchZ * pitchScale.height);
        markersGroup.add(pole);
      }
    });
  }, [calibrationPoints, activeCalibrationPointId, pitchScale]);

  // Grid overlay effect
  useEffect(() => {
    const gridGroup = gridGroupRef.current;
    if (!gridGroup) return;
    while (gridGroup.children.length > 0) gridGroup.remove(gridGroup.children[0]);

    if (gridOverlay === 'none') return;

    const pw = 105 * pitchScale.width;
    const ph = 68 * pitchScale.height;
    
    const gridColors = {
      thirds: 0x00ff88,
      halves: 0x00d4ff,
      channels: 0xffaa00,
      zones: 0xff44aa,
    };
    const gridColor = gridColors[gridOverlay as keyof typeof gridColors] || 0xffffff;
    const gridMat = new THREE.LineBasicMaterial({ color: gridColor, transparent: true, opacity: 0.5 });
    const fillMat = new THREE.MeshBasicMaterial({ color: gridColor, transparent: true, opacity: 0.08, side: THREE.DoubleSide });

    if (gridOverlay === 'thirds') {
      const thirdWidth = pw / 3;
      for (let i = 1; i < 3; i++) {
        const x = -pw/2 + thirdWidth * i;
        gridGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(x, 0.02, -ph/2),
          new THREE.Vector3(x, 0.02, ph/2),
        ]), gridMat));
      }
      for (let i = 0; i < 3; i++) {
        if (i % 2 === 0) {
          const zoneGeometry = new THREE.PlaneGeometry(thirdWidth, ph);
          const zone = new THREE.Mesh(zoneGeometry, fillMat);
          zone.rotation.x = -Math.PI / 2;
          zone.position.set(-pw/2 + thirdWidth * (i + 0.5), 0.015, 0);
          gridGroup.add(zone);
        }
      }
    }

    if (gridOverlay === 'halves') {
      gridGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-pw/2, 0.02, 0),
        new THREE.Vector3(pw/2, 0.02, 0),
      ]), gridMat));
      gridGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0.02, -ph/2),
        new THREE.Vector3(0, 0.02, ph/2),
      ]), gridMat));
      const quadrantGeometry = new THREE.PlaneGeometry(pw/2, ph/2);
      [[1, 1], [-1, -1]].forEach(([mx, mz]) => {
        const quad = new THREE.Mesh(quadrantGeometry, fillMat);
        quad.rotation.x = -Math.PI / 2;
        quad.position.set(mx * pw/4, 0.015, mz * ph/4);
        gridGroup.add(quad);
      });
    }

    if (gridOverlay === 'channels') {
      const channelWidth = ph / 5;
      for (let i = 1; i < 5; i++) {
        const z = -ph/2 + channelWidth * i;
        gridGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(-pw/2, 0.02, z),
          new THREE.Vector3(pw/2, 0.02, z),
        ]), gridMat));
      }
      for (let i = 0; i < 5; i++) {
        if (i % 2 === 0) {
          const channelGeometry = new THREE.PlaneGeometry(pw, channelWidth);
          const channel = new THREE.Mesh(channelGeometry, fillMat);
          channel.rotation.x = -Math.PI / 2;
          channel.position.set(0, 0.015, -ph/2 + channelWidth * (i + 0.5));
          gridGroup.add(channel);
        }
      }
    }

    if (gridOverlay === 'zones') {
      const zoneWidth = pw / 6;
      const zoneHeight = ph / 3;
      for (let i = 1; i < 6; i++) {
        const x = -pw/2 + zoneWidth * i;
        gridGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(x, 0.02, -ph/2),
          new THREE.Vector3(x, 0.02, ph/2),
        ]), gridMat));
      }
      for (let i = 1; i < 3; i++) {
        const z = -ph/2 + zoneHeight * i;
        gridGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(-pw/2, 0.02, z),
          new THREE.Vector3(pw/2, 0.02, z),
        ]), gridMat));
      }
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 6; col++) {
          if ((row + col) % 2 === 0) {
            const zoneGeometry = new THREE.PlaneGeometry(zoneWidth, zoneHeight);
            const zone = new THREE.Mesh(zoneGeometry, fillMat);
            zone.rotation.x = -Math.PI / 2;
            zone.position.set(-pw/2 + zoneWidth * (col + 0.5), 0.015, -ph/2 + zoneHeight * (row + 0.5));
            gridGroup.add(zone);
          }
        }
      }
    }
  }, [gridOverlay, pitchScale]);

  // Heatmap overlay
  const { heatmapData } = HeatmapOverlay({
    annotations,
    heatmapType,
    pitchWidth: 105 * pitchScale.width,
    pitchHeight: 68 * pitchScale.height,
  });

  useEffect(() => {
    const heatmapGroup = heatmapGroupRef.current;
    if (!heatmapGroup) return;
    while (heatmapGroup.children.length > 0) heatmapGroup.remove(heatmapGroup.children[0]);

    if (heatmapType === 'none' || heatmapData.length === 0) return;

    const cellSize = 10;

    heatmapData.forEach(cell => {
      const color = getHeatmapColor(cell.intensity);
      const geometry = new THREE.PlaneGeometry(cellSize, cellSize);
      const material = new THREE.MeshBasicMaterial({
        color: new THREE.Color(color),
        transparent: true,
        opacity: 0.3 + cell.intensity * 0.4,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(cell.x, 0.005, cell.z);
      heatmapGroup.add(mesh);
    });
  }, [heatmapType, heatmapData]);

  const updateLabelPositions = useCallback(() => {
    const camera = cameraRef.current;
    const container = containerRef.current;
    if (!camera || !container) return;

    const newLabels: LabelData[] = [];
    
    annotations.forEach(annotation => {
      if (!annotation.visible) return;
      
      // Player and spotlight labels
      if ((annotation.type === 'player' || annotation.type === 'spotlight') && annotation.label) {
        const pos = new THREE.Vector3(annotation.position.x, 2, annotation.position.z);
        const projected = pos.clone().project(camera);
        
        const x = (projected.x * 0.5 + 0.5) * container.clientWidth;
        const y = (-projected.y * 0.5 + 0.5) * container.clientHeight;
        
        newLabels.push({
          id: annotation.id,
          text: annotation.label,
          screenX: x,
          screenY: y - 30,
          color: annotation.color,
          visible: projected.z < 1,
        });
      }
      
      // Distance measurement labels
      if (annotation.type === 'distance' && annotation.endPosition) {
        const midX = (annotation.position.x + annotation.endPosition.x) / 2;
        const midZ = (annotation.position.z + annotation.endPosition.z) / 2;
        
        // Calculate real distance (pitch is 105m x 68m, scaled to 105 x 68 in Three.js)
        const dx = annotation.endPosition.x - annotation.position.x;
        const dz = annotation.endPosition.z - annotation.position.z;
        const distanceMeters = Math.sqrt(dx * dx + dz * dz);
        
        const pos = new THREE.Vector3(midX, 1, midZ);
        const projected = pos.clone().project(camera);
        
        const x = (projected.x * 0.5 + 0.5) * container.clientWidth;
        const y = (-projected.y * 0.5 + 0.5) * container.clientHeight;
        
        newLabels.push({
          id: `${annotation.id}-distance`,
          text: `${distanceMeters.toFixed(1)}m`,
          screenX: x,
          screenY: y,
          color: annotation.color,
          visible: projected.z < 1,
        });
      }
    });

    setLabels(newLabels);
  }, [annotations]);

  // Keep the animation loop calling the latest label updater
  useEffect(() => {
    updateLabelPositionsRef.current = updateLabelPositions;
  }, [updateLabelPositions]);

  // Update camera based on calibration
  useEffect(() => {
    const camera = cameraRef.current;
    if (!camera) return;

    camera.position.set(calibration.cameraX, calibration.cameraY, calibration.cameraZ);
    camera.rotation.set(calibration.cameraRotationX, calibration.cameraRotationY, calibration.cameraRotationZ);
    camera.fov = calibration.cameraFov;
    camera.updateProjectionMatrix();
  }, [calibration]);

  // Update annotations with Metrica Play style visuals
  useEffect(() => {
    const group = annotationGroupRef.current;
    if (!group) return;

    // Clear existing annotations
    while (group.children.length > 0) {
      const child = group.children[0];
      group.remove(child);
      if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
        child.geometry.dispose();
        if (child.material instanceof THREE.Material) {
          child.material.dispose();
        } else if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose());
        }
      }
    }

    // Add new annotations
    annotations.forEach(annotation => {
      if (!annotation.visible) return;

      const color = new THREE.Color(annotation.color);
      const isDashed = annotation.metadata?.dashed === true;

      // PLAYER MARKER - Red/Cyan circle with number
      if (annotation.type === 'player') {
        // Ground shadow/glow
        const shadowGeometry = new THREE.CircleGeometry(2.8, 32);
        const shadowMaterial = new THREE.MeshBasicMaterial({ 
          color: 0x000000, 
          transparent: true, 
          opacity: 0.3,
          side: THREE.DoubleSide,
        });
        const shadow = new THREE.Mesh(shadowGeometry, shadowMaterial);
        shadow.rotation.x = -Math.PI / 2;
        shadow.position.set(annotation.position.x, 0.01, annotation.position.z);
        group.add(shadow);

        // Main colored circle (filled)
        const circleGeometry = new THREE.CircleGeometry(2.2, 32);
        const circleMaterial = new THREE.MeshBasicMaterial({ 
          color,
          transparent: true,
          opacity: 0.85,
          side: THREE.DoubleSide,
        });
        const circle = new THREE.Mesh(circleGeometry, circleMaterial);
        circle.rotation.x = -Math.PI / 2;
        circle.position.set(annotation.position.x, 0.02, annotation.position.z);
        group.add(circle);

        // Bright edge ring
        const ringGeometry = new THREE.RingGeometry(2.0, 2.3, 32);
        const ringMaterial = new THREE.MeshBasicMaterial({ 
          color: new THREE.Color(color).multiplyScalar(1.3), 
          transparent: true, 
          opacity: 0.95,
          side: THREE.DoubleSide,
        });
        const ring = new THREE.Mesh(ringGeometry, ringMaterial);
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(annotation.position.x, 0.03, annotation.position.z);
        group.add(ring);
      }

      // PASS ARROW - Curved orange arrow with optional dashing
      if (annotation.type === 'arrow' && annotation.endPosition) {
        const startVec = new THREE.Vector3(annotation.position.x, 0.3, annotation.position.z);
        const endVec = new THREE.Vector3(annotation.endPosition.x, 0.3, annotation.endPosition.z);
        
        const distance = startVec.distanceTo(endVec);
        const curveHeight = Math.min(distance * 0.12, 8);
        
        // Create curved path
        const curve = createCurvedArrowPath(startVec, endVec, curveHeight);
        const points = curve.getPoints(50);

        if (isDashed) {
          // Dashed curved line
          const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
          const dashedMaterial = createDashedLineMaterial(color, 1.5, 1);
          const dashedLine = new THREE.Line(lineGeometry, dashedMaterial);
          dashedLine.computeLineDistances();
          group.add(dashedLine);
        } else {
          // Solid tube
          const tubeGeometry = createTubeFromCurve(curve, 0.25);
          const tubeMaterial = new THREE.MeshBasicMaterial({ 
            color,
            transparent: true,
            opacity: 0.95,
          });
          const tube = new THREE.Mesh(tubeGeometry, tubeMaterial);
          group.add(tube);

          // Glow effect
          const glowTubeGeometry = createTubeFromCurve(curve, 0.5);
          const glowTubeMaterial = new THREE.MeshBasicMaterial({ 
            color,
            transparent: true,
            opacity: 0.2,
          });
          const glowTube = new THREE.Mesh(glowTubeGeometry, glowTubeMaterial);
          group.add(glowTube);
        }

        // Arrowhead
        const direction = new THREE.Vector3(
          annotation.endPosition.x - annotation.position.x,
          0,
          annotation.endPosition.z - annotation.position.z
        ).normalize();
        
        const arrowHeadGeometry = new THREE.ConeGeometry(0.9, 2.5, 8);
        const arrowHeadMaterial = new THREE.MeshBasicMaterial({ color });
        const arrowHead = new THREE.Mesh(arrowHeadGeometry, arrowHeadMaterial);
        arrowHead.position.copy(endVec);
        arrowHead.rotation.x = Math.PI / 2;
        arrowHead.rotation.z = -Math.atan2(direction.x, direction.z);
        group.add(arrowHead);
      }

      // ZONE - Different shapes (circle, rectangle, triangle) with scale and rotation
      if (annotation.type === 'zone') {
        const baseRadius = annotation.radius || 8;
        const scale = annotation.scale || 1;
        const rotation = annotation.rotation || 0;
        const radius = baseRadius * scale;
        const zoneShape = annotation.zoneShape || 'circle';
        
        // Create a container group for rotation
        const zoneGroup = new THREE.Group();
        zoneGroup.position.set(annotation.position.x, 0, annotation.position.z);
        zoneGroup.rotation.y = rotation;
        
        if (zoneShape === 'circle') {
          // Filled zone with gradient-like effect
          const circleGeometry = new THREE.CircleGeometry(radius, 48);
          const circleMaterial = new THREE.MeshBasicMaterial({ 
            color, 
            transparent: true, 
            opacity: 0.35,
            side: THREE.DoubleSide,
          });
          const circle = new THREE.Mesh(circleGeometry, circleMaterial);
          circle.rotation.x = -Math.PI / 2;
          circle.position.y = 0.02;
          zoneGroup.add(circle);

          // Darker inner area
          const innerGeometry = new THREE.CircleGeometry(radius * 0.6, 48);
          const innerMaterial = new THREE.MeshBasicMaterial({ 
            color, 
            transparent: true, 
            opacity: 0.25,
            side: THREE.DoubleSide,
          });
          const inner = new THREE.Mesh(innerGeometry, innerMaterial);
          inner.rotation.x = -Math.PI / 2;
          inner.position.y = 0.025;
          zoneGroup.add(inner);

          // Edge ring
          const ringGeometry = new THREE.RingGeometry(radius - 0.2, radius, 64);
          const ringMaterial = new THREE.MeshBasicMaterial({ 
            color, 
            transparent: true, 
            opacity: 0.7,
            side: THREE.DoubleSide,
          });
          const ring = new THREE.Mesh(ringGeometry, ringMaterial);
          ring.rotation.x = -Math.PI / 2;
          ring.position.y = 0.03;
          zoneGroup.add(ring);
        } else if (zoneShape === 'rectangle') {
          const rectWidth = radius * 2;
          const rectHeight = radius * 1.5;
          
          const rectGeometry = new THREE.PlaneGeometry(rectWidth, rectHeight);
          const rectMaterial = new THREE.MeshBasicMaterial({ 
            color, 
            transparent: true, 
            opacity: 0.35,
            side: THREE.DoubleSide,
          });
          const rect = new THREE.Mesh(rectGeometry, rectMaterial);
          rect.rotation.x = -Math.PI / 2;
          rect.position.y = 0.02;
          zoneGroup.add(rect);

          // Border
          const borderPoints = [
            new THREE.Vector3(-rectWidth/2, 0.03, -rectHeight/2),
            new THREE.Vector3(rectWidth/2, 0.03, -rectHeight/2),
            new THREE.Vector3(rectWidth/2, 0.03, rectHeight/2),
            new THREE.Vector3(-rectWidth/2, 0.03, rectHeight/2),
            new THREE.Vector3(-rectWidth/2, 0.03, -rectHeight/2),
          ];
          const borderGeometry = new THREE.BufferGeometry().setFromPoints(borderPoints);
          const borderMaterial = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.8 });
          const border = new THREE.Line(borderGeometry, borderMaterial);
          zoneGroup.add(border);
        } else if (zoneShape === 'triangle') {
          const triShape = new THREE.Shape();
          triShape.moveTo(0, radius);
          triShape.lineTo(-radius * 0.866, -radius * 0.5);
          triShape.lineTo(radius * 0.866, -radius * 0.5);
          triShape.closePath();
          
          const triGeometry = new THREE.ShapeGeometry(triShape);
          const triMaterial = new THREE.MeshBasicMaterial({ 
            color, 
            transparent: true, 
            opacity: 0.35,
            side: THREE.DoubleSide,
          });
          const tri = new THREE.Mesh(triGeometry, triMaterial);
          tri.rotation.x = -Math.PI / 2;
          tri.position.y = 0.02;
          zoneGroup.add(tri);

          // Border
          const triPoints = [
            new THREE.Vector3(0, 0.03, -radius),
            new THREE.Vector3(-radius * 0.866, 0.03, radius * 0.5),
            new THREE.Vector3(radius * 0.866, 0.03, radius * 0.5),
            new THREE.Vector3(0, 0.03, -radius),
          ];
          const triBorderGeometry = new THREE.BufferGeometry().setFromPoints(triPoints);
          const triBorderMaterial = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.8 });
          const triBorder = new THREE.Line(triBorderGeometry, triBorderMaterial);
          zoneGroup.add(triBorder);
        }
        
        group.add(zoneGroup);
      }

      // FREEHAND / MOVEMENT PATH
      if (annotation.type === 'freehand' && annotation.points && annotation.points.length > 1) {
        const points = annotation.points.map(p => new THREE.Vector3(p.x, 0.3, p.z));
        const curve = new THREE.CatmullRomCurve3(points);
        
        if (isDashed) {
          const linePoints = curve.getPoints(64);
          const lineGeometry = new THREE.BufferGeometry().setFromPoints(linePoints);
          const dashedMaterial = createDashedLineMaterial(color, 1.2, 0.8);
          const dashedLine = new THREE.Line(lineGeometry, dashedMaterial);
          dashedLine.computeLineDistances();
          group.add(dashedLine);
        } else {
          const tubeGeometry = new THREE.TubeGeometry(curve, 64, 0.2, 8, false);
          const tubeMaterial = new THREE.MeshBasicMaterial({ 
            color,
            transparent: true,
            opacity: 0.9,
          });
          const tube = new THREE.Mesh(tubeGeometry, tubeMaterial);
          group.add(tube);
        }

        // End marker
        if (points.length > 0) {
          const lastPoint = points[points.length - 1];
          const endMarkerGeometry = new THREE.ConeGeometry(0.6, 1.5, 8);
          const endMarkerMaterial = new THREE.MeshBasicMaterial({ color });
          const endMarker = new THREE.Mesh(endMarkerGeometry, endMarkerMaterial);
          
          // Calculate direction for arrow
          if (points.length >= 2) {
            const prevPoint = points[points.length - 2];
            const direction = new THREE.Vector3().subVectors(lastPoint, prevPoint).normalize();
            endMarker.position.copy(lastPoint);
            endMarker.rotation.x = Math.PI / 2;
            endMarker.rotation.z = -Math.atan2(direction.x, direction.z);
          } else {
            endMarker.position.copy(lastPoint);
          }
          group.add(endMarker);
        }
      }

      // SPOTLIGHT - Column with rotating dashed ring and pulse
      if (annotation.type === 'spotlight') {
        const columnHeight = 10;
        const columnRadius = 3.5;
        
        // Vertical transparent column
        const columnGeometry = new THREE.CylinderGeometry(columnRadius * 0.8, columnRadius, columnHeight, 32, 1, true);
        const columnMaterial = new THREE.MeshBasicMaterial({ 
          color, 
          transparent: true, 
          opacity: 0.1,
          side: THREE.DoubleSide,
        });
        const column = new THREE.Mesh(columnGeometry, columnMaterial);
        column.position.set(annotation.position.x, columnHeight / 2, annotation.position.z);
        group.add(column);

        // Ground fill with glow
        const groundGeometry = new THREE.CircleGeometry(columnRadius, 32);
        const groundMaterial = new THREE.MeshBasicMaterial({ 
          color, 
          transparent: true, 
          opacity: 0.3,
          side: THREE.DoubleSide,
        });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.position.set(annotation.position.x, 0.02, annotation.position.z);
        group.add(ground);

        // ROTATING DASHED CIRCLE at base
        const dashCount = 12;
        const dashAngle = (Math.PI * 2) / dashCount;
        const dashLength = dashAngle * 0.6;
        
        for (let i = 0; i < dashCount; i++) {
          const startAngle = i * dashAngle;
          const endAngle = startAngle + dashLength;
          
          const arcPoints: THREE.Vector3[] = [];
          const arcSegments = 8;
          for (let j = 0; j <= arcSegments; j++) {
            const angle = startAngle + (endAngle - startAngle) * (j / arcSegments);
            arcPoints.push(new THREE.Vector3(
              Math.cos(angle) * columnRadius * 1.1,
              0,
              Math.sin(angle) * columnRadius * 1.1
            ));
          }
          
          const arcGeometry = new THREE.BufferGeometry().setFromPoints(arcPoints);
          const arcMaterial = new THREE.LineBasicMaterial({ 
            color, 
            transparent: true, 
            opacity: 0.9,
          });
          const arc = new THREE.Line(arcGeometry, arcMaterial);
          arc.position.set(annotation.position.x, 0.05, annotation.position.z);
          (arc as any).isSpotlightRing = true;
          (arc as any).spotlightStartTime = animationTimeRef.current;
          group.add(arc);
        }

        // Inner solid ring
        const innerRingGeometry = new THREE.RingGeometry(columnRadius * 0.85, columnRadius * 0.9, 32);
        const innerRingMaterial = new THREE.MeshBasicMaterial({ 
          color, 
          transparent: true, 
          opacity: 0.5,
          side: THREE.DoubleSide,
        });
        const innerRing = new THREE.Mesh(innerRingGeometry, innerRingMaterial);
        innerRing.rotation.x = -Math.PI / 2;
        innerRing.position.set(annotation.position.x, 0.03, annotation.position.z);
        group.add(innerRing);
      }

      // OFFSIDE LINE - Dashed horizontal line
      if (annotation.type === 'offside' && annotation.endPosition) {
        const startVec = new THREE.Vector3(annotation.position.x, 0.2, annotation.position.z);
        const endVec = new THREE.Vector3(annotation.endPosition.x, 0.2, annotation.endPosition.z);
        
        const lineGeometry = new THREE.BufferGeometry().setFromPoints([startVec, endVec]);
        const dashedMaterial = createDashedLineMaterial(color, 2, 1);
        const dashedLine = new THREE.Line(lineGeometry, dashedMaterial);
        dashedLine.computeLineDistances();
        group.add(dashedLine);

        // Vertical markers at endpoints
        const markerGeometry = new THREE.CylinderGeometry(0.15, 0.15, 3, 8);
        const markerMaterial = new THREE.MeshBasicMaterial({ color });
        
        const startMarker = new THREE.Mesh(markerGeometry, markerMaterial);
        startMarker.position.set(startVec.x, 1.5, startVec.z);
        group.add(startMarker);
        
        const endMarker = new THREE.Mesh(markerGeometry, markerMaterial.clone());
        endMarker.position.set(endVec.x, 1.5, endVec.z);
        group.add(endMarker);
      }

      // PRESSING VISUALIZATION - Animated concentric circles
      if (annotation.type === 'pressing') {
        const pressRadius = annotation.radius || 5;
        
        // Multiple concentric rings for pressing effect
        for (let i = 0; i < 3; i++) {
          const ringRadius = pressRadius * (0.4 + i * 0.3);
          const ringGeometry = new THREE.RingGeometry(ringRadius - 0.3, ringRadius, 32);
          const ringMaterial = new THREE.MeshBasicMaterial({ 
            color, 
            transparent: true, 
            opacity: 0.5 - i * 0.15,
            side: THREE.DoubleSide,
          });
          const ring = new THREE.Mesh(ringGeometry, ringMaterial);
          ring.rotation.x = -Math.PI / 2;
          ring.position.set(annotation.position.x, 0.02 + i * 0.01, annotation.position.z);
          (ring as any).isPressing = true;
          group.add(ring);
        }

        // Center dot
        const centerGeometry = new THREE.CircleGeometry(0.8, 16);
        const centerMaterial = new THREE.MeshBasicMaterial({ 
          color, 
          transparent: true, 
          opacity: 0.8,
          side: THREE.DoubleSide,
        });
        const center = new THREE.Mesh(centerGeometry, centerMaterial);
        center.rotation.x = -Math.PI / 2;
        center.position.set(annotation.position.x, 0.05, annotation.position.z);
        group.add(center);

        // Arrow lines pointing inward (pressing direction indicators)
        const arrowCount = 4;
        for (let i = 0; i < arrowCount; i++) {
          const angle = (i / arrowCount) * Math.PI * 2;
          const outerX = annotation.position.x + Math.cos(angle) * pressRadius;
          const outerZ = annotation.position.z + Math.sin(angle) * pressRadius;
          const innerX = annotation.position.x + Math.cos(angle) * pressRadius * 0.5;
          const innerZ = annotation.position.z + Math.sin(angle) * pressRadius * 0.5;
          
          const arrowPoints = [
            new THREE.Vector3(outerX, 0.3, outerZ),
            new THREE.Vector3(innerX, 0.3, innerZ),
          ];
          const arrowGeometry = new THREE.BufferGeometry().setFromPoints(arrowPoints);
          const arrowMaterial = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.7 });
          const arrow = new THREE.Line(arrowGeometry, arrowMaterial);
          group.add(arrow);

          // Arrowhead
          const headGeometry = new THREE.ConeGeometry(0.4, 1, 6);
          const headMaterial = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8 });
          const head = new THREE.Mesh(headGeometry, headMaterial);
          head.position.set(innerX, 0.3, innerZ);
          head.rotation.x = Math.PI / 2;
          head.rotation.z = -angle - Math.PI / 2;
          group.add(head);
        }
      }

      // LINE - Simple straight line
      if (annotation.type === 'line' && annotation.endPosition) {
        const startVec = new THREE.Vector3(annotation.position.x, 0.2, annotation.position.z);
        const endVec = new THREE.Vector3(annotation.endPosition.x, 0.2, annotation.endPosition.z);
        
        if (isDashed) {
          const lineGeometry = new THREE.BufferGeometry().setFromPoints([startVec, endVec]);
          const dashedMaterial = createDashedLineMaterial(color, 1.5, 1);
          const dashedLine = new THREE.Line(lineGeometry, dashedMaterial);
          dashedLine.computeLineDistances();
          group.add(dashedLine);
        } else {
          // Solid tube line
          const lineCurve = new THREE.LineCurve3(startVec, endVec);
          const tubeGeometry = new THREE.TubeGeometry(lineCurve, 8, 0.2, 8, false);
          const tubeMaterial = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 });
          const tube = new THREE.Mesh(tubeGeometry, tubeMaterial);
          group.add(tube);
        }
      }

      // MARKER - Simple dot/pin marker
      if (annotation.type === 'marker') {
        // Outer glow
        const glowGeometry = new THREE.CircleGeometry(1.8, 24);
        const glowMaterial = new THREE.MeshBasicMaterial({ 
          color, 
          transparent: true, 
          opacity: 0.3,
          side: THREE.DoubleSide,
        });
        const glow = new THREE.Mesh(glowGeometry, glowMaterial);
        glow.rotation.x = -Math.PI / 2;
        glow.position.set(annotation.position.x, 0.01, annotation.position.z);
        group.add(glow);

        // Inner dot
        const dotGeometry = new THREE.CircleGeometry(0.8, 24);
        const dotMaterial = new THREE.MeshBasicMaterial({ 
          color, 
          transparent: true, 
          opacity: 0.95,
          side: THREE.DoubleSide,
        });
        const dot = new THREE.Mesh(dotGeometry, dotMaterial);
        dot.rotation.x = -Math.PI / 2;
        dot.position.set(annotation.position.x, 0.02, annotation.position.z);
        group.add(dot);

        // Vertical pin
        const pinGeometry = new THREE.CylinderGeometry(0.1, 0.1, 2, 8);
        const pinMaterial = new THREE.MeshBasicMaterial({ color });
        const pin = new THREE.Mesh(pinGeometry, pinMaterial);
        pin.position.set(annotation.position.x, 1, annotation.position.z);
        group.add(pin);

        // Pin head
        const headGeometry = new THREE.SphereGeometry(0.4, 16, 16);
        const headMaterial = new THREE.MeshBasicMaterial({ color });
        const head = new THREE.Mesh(headGeometry, headMaterial);
        head.position.set(annotation.position.x, 2.2, annotation.position.z);
        group.add(head);
      }

      // CURVE - Smooth curved line (like freehand but different visual)
      if (annotation.type === 'curve' && annotation.points && annotation.points.length > 1) {
        const points = annotation.points.map(p => new THREE.Vector3(p.x, 0.25, p.z));
        const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.5);
        
        const tubeGeometry = new THREE.TubeGeometry(curve, 64, 0.15, 8, false);
        const tubeMaterial = new THREE.MeshBasicMaterial({ 
          color,
          transparent: true,
          opacity: 0.9,
        });
        const tube = new THREE.Mesh(tubeGeometry, tubeMaterial);
        group.add(tube);

        // Glow
        const glowTubeGeometry = new THREE.TubeGeometry(curve, 64, 0.35, 8, false);
        const glowMaterial = new THREE.MeshBasicMaterial({ 
          color,
          transparent: true,
          opacity: 0.2,
        });
        const glowTube = new THREE.Mesh(glowTubeGeometry, glowMaterial);
        group.add(glowTube);
      }

      // SHIELD - Defensive block shape (arc)
      if (annotation.type === 'shield') {
        const shieldRadius = annotation.radius || 4;
        
        // Arc shape
        const arcPoints: THREE.Vector3[] = [];
        const arcSegments = 32;
        const arcAngle = Math.PI * 0.7; // ~126 degrees
        for (let i = 0; i <= arcSegments; i++) {
          const angle = -arcAngle / 2 + (arcAngle * i / arcSegments);
          arcPoints.push(new THREE.Vector3(
            Math.sin(angle) * shieldRadius,
            0,
            -Math.cos(angle) * shieldRadius
          ));
        }
        
        // Outer arc
        const arcGeometry = new THREE.BufferGeometry().setFromPoints(arcPoints);
        const arcMaterial = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 });
        const arc = new THREE.Line(arcGeometry, arcMaterial);
        arc.position.set(annotation.position.x, 0.1, annotation.position.z);
        group.add(arc);

        // Filled arc area
        const shape = new THREE.Shape();
        shape.moveTo(0, 0);
        for (let i = 0; i <= arcSegments; i++) {
          const angle = -arcAngle / 2 + (arcAngle * i / arcSegments);
          shape.lineTo(Math.sin(angle) * shieldRadius, -Math.cos(angle) * shieldRadius);
        }
        shape.lineTo(0, 0);
        
        const shapeGeometry = new THREE.ShapeGeometry(shape);
        const shapeMaterial = new THREE.MeshBasicMaterial({ 
          color, 
          transparent: true, 
          opacity: 0.25,
          side: THREE.DoubleSide,
        });
        const shieldMesh = new THREE.Mesh(shapeGeometry, shapeMaterial);
        shieldMesh.rotation.x = -Math.PI / 2;
        shieldMesh.position.set(annotation.position.x, 0.02, annotation.position.z);
        group.add(shieldMesh);
      }

      // DISTANCE - Measurement line with distance label
      if (annotation.type === 'distance' && annotation.endPosition) {
        const startVec = new THREE.Vector3(annotation.position.x, 0.15, annotation.position.z);
        const endVec = new THREE.Vector3(annotation.endPosition.x, 0.15, annotation.endPosition.z);
        
        // Main line
        const lineGeometry = new THREE.BufferGeometry().setFromPoints([startVec, endVec]);
        const lineMaterial = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.8 });
        const line = new THREE.Line(lineGeometry, lineMaterial);
        group.add(line);

        // End caps (perpendicular lines)
        const direction = new THREE.Vector3().subVectors(endVec, startVec).normalize();
        const perpendicular = new THREE.Vector3(-direction.z, 0, direction.x).multiplyScalar(0.8);
        
        const startCap1 = startVec.clone().add(perpendicular);
        const startCap2 = startVec.clone().sub(perpendicular);
        const startCapGeometry = new THREE.BufferGeometry().setFromPoints([startCap1, startCap2]);
        group.add(new THREE.Line(startCapGeometry, lineMaterial.clone()));

        const endCap1 = endVec.clone().add(perpendicular);
        const endCap2 = endVec.clone().sub(perpendicular);
        const endCapGeometry = new THREE.BufferGeometry().setFromPoints([endCap1, endCap2]);
        group.add(new THREE.Line(endCapGeometry, lineMaterial.clone()));
      }

      // DOUBLE ARROW - Two-headed arrow
      if (annotation.type === 'double_arrow' && annotation.endPosition) {
        const startVec = new THREE.Vector3(annotation.position.x, 0.3, annotation.position.z);
        const endVec = new THREE.Vector3(annotation.endPosition.x, 0.3, annotation.endPosition.z);
        
        // Line
        const lineCurve = new THREE.LineCurve3(startVec, endVec);
        const tubeGeometry = new THREE.TubeGeometry(lineCurve, 8, 0.2, 8, false);
        const tubeMaterial = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 });
        group.add(new THREE.Mesh(tubeGeometry, tubeMaterial));
        
        // Two arrowheads
        const direction = new THREE.Vector3().subVectors(endVec, startVec).normalize();
        const arrowHeadGeometry = new THREE.ConeGeometry(0.7, 2, 8);
        
        // End arrowhead
        const endHead = new THREE.Mesh(arrowHeadGeometry, new THREE.MeshBasicMaterial({ color }));
        endHead.position.copy(endVec);
        endHead.rotation.x = Math.PI / 2;
        endHead.rotation.z = -Math.atan2(direction.x, direction.z);
        group.add(endHead);
        
        // Start arrowhead (reversed)
        const startHead = new THREE.Mesh(arrowHeadGeometry.clone(), new THREE.MeshBasicMaterial({ color }));
        startHead.position.copy(startVec);
        startHead.rotation.x = -Math.PI / 2;
        startHead.rotation.z = -Math.atan2(direction.x, direction.z);
        group.add(startHead);
      }

      // CURVED DASHED - Curved dashed arrow
      if (annotation.type === 'curved_dashed' && annotation.endPosition) {
        const startVec = new THREE.Vector3(annotation.position.x, 0.3, annotation.position.z);
        const endVec = new THREE.Vector3(annotation.endPosition.x, 0.3, annotation.endPosition.z);
        const distance = startVec.distanceTo(endVec);
        const curveHeight = Math.min(distance * 0.15, 8);
        
        const curve = createCurvedArrowPath(startVec, endVec, curveHeight);
        const points = curve.getPoints(50);
        const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
        const dashedMaterial = createDashedLineMaterial(color, 1.5, 1);
        const dashedLine = new THREE.Line(lineGeometry, dashedMaterial);
        dashedLine.computeLineDistances();
        group.add(dashedLine);
      }

      // THROUGH BALL - Straight arrow with special styling
      if (annotation.type === 'through_ball' && annotation.endPosition) {
        const startVec = new THREE.Vector3(annotation.position.x, 0.3, annotation.position.z);
        const endVec = new THREE.Vector3(annotation.endPosition.x, 0.3, annotation.endPosition.z);
        
        // Dashed line for through ball
        const lineGeometry = new THREE.BufferGeometry().setFromPoints([startVec, endVec]);
        const dashedMaterial = createDashedLineMaterial(color, 2, 1);
        const line = new THREE.Line(lineGeometry, dashedMaterial);
        line.computeLineDistances();
        group.add(line);
        
        // Sharp arrowhead
        const direction = new THREE.Vector3().subVectors(endVec, startVec).normalize();
        const arrowHead = new THREE.Mesh(
          new THREE.ConeGeometry(0.6, 2.5, 4),
          new THREE.MeshBasicMaterial({ color })
        );
        arrowHead.position.copy(endVec);
        arrowHead.rotation.x = Math.PI / 2;
        arrowHead.rotation.z = -Math.atan2(direction.x, direction.z);
        group.add(arrowHead);
      }

      // SWITCH PLAY - Long curved arrow
      if (annotation.type === 'switch_play' && annotation.endPosition) {
        const startVec = new THREE.Vector3(annotation.position.x, 0.3, annotation.position.z);
        const endVec = new THREE.Vector3(annotation.endPosition.x, 0.3, annotation.endPosition.z);
        const distance = startVec.distanceTo(endVec);
        
        const curve = createCurvedArrowPath(startVec, endVec, Math.min(distance * 0.2, 12));
        const tubeGeometry = createTubeFromCurve(curve, 0.3);
        const tubeMaterial = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8 });
        group.add(new THREE.Mesh(tubeGeometry, tubeMaterial));
        
        const direction = new THREE.Vector3().subVectors(endVec, startVec).normalize();
        const arrowHead = new THREE.Mesh(
          new THREE.ConeGeometry(1, 3, 8),
          new THREE.MeshBasicMaterial({ color })
        );
        arrowHead.position.copy(endVec);
        arrowHead.rotation.x = Math.PI / 2;
        arrowHead.rotation.z = -Math.atan2(direction.x, direction.z);
        group.add(arrowHead);
      }

      // CROSS - Cross/delivery arrow
      if (annotation.type === 'cross' && annotation.endPosition) {
        const startVec = new THREE.Vector3(annotation.position.x, 0.3, annotation.position.z);
        const endVec = new THREE.Vector3(annotation.endPosition.x, 0.3, annotation.endPosition.z);
        const distance = startVec.distanceTo(endVec);
        
        const curve = createCurvedArrowPath(startVec, endVec, Math.min(distance * 0.25, 10));
        const tubeGeometry = createTubeFromCurve(curve, 0.25);
        const tubeMaterial = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 });
        group.add(new THREE.Mesh(tubeGeometry, tubeMaterial));
        
        // Target circle at end
        const targetGeometry = new THREE.RingGeometry(1.5, 2, 32);
        const targetMaterial = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6, side: THREE.DoubleSide });
        const target = new THREE.Mesh(targetGeometry, targetMaterial);
        target.rotation.x = -Math.PI / 2;
        target.position.set(annotation.endPosition.x, 0.05, annotation.endPosition.z);
        group.add(target);
      }

      // CONE - Training cone
      if (annotation.type === 'cone') {
        const coneGeometry = new THREE.ConeGeometry(0.8, 1.5, 16);
        const coneMaterial = new THREE.MeshBasicMaterial({ color });
        const cone = new THREE.Mesh(coneGeometry, coneMaterial);
        cone.position.set(annotation.position.x, 0.75, annotation.position.z);
        group.add(cone);
        
        // Base circle
        const baseGeometry = new THREE.CircleGeometry(1, 16);
        const baseMaterial = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5, side: THREE.DoubleSide });
        const base = new THREE.Mesh(baseGeometry, baseMaterial);
        base.rotation.x = -Math.PI / 2;
        base.position.set(annotation.position.x, 0.01, annotation.position.z);
        group.add(base);
      }

      // GATE - Training gate (two cones with line)
      if (annotation.type === 'gate' && annotation.endPosition) {
        const startVec = new THREE.Vector3(annotation.position.x, 0, annotation.position.z);
        const endVec = new THREE.Vector3(annotation.endPosition.x, 0, annotation.endPosition.z);
        
        // Two cones
        [startVec, endVec].forEach(pos => {
          const coneGeometry = new THREE.ConeGeometry(0.6, 1.2, 16);
          const coneMaterial = new THREE.MeshBasicMaterial({ color });
          const cone = new THREE.Mesh(coneGeometry, coneMaterial);
          cone.position.set(pos.x, 0.6, pos.z);
          group.add(cone);
        });
        
        // Connecting line
        const lineGeometry = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(annotation.position.x, 1.2, annotation.position.z),
          new THREE.Vector3(annotation.endPosition.x, 1.2, annotation.endPosition.z)
        ]);
        const lineMaterial = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.7 });
        group.add(new THREE.Line(lineGeometry, lineMaterial));
      }

      // GRID - Training grid
      if (annotation.type === 'grid') {
        const gridSize = (annotation.radius || 8) * (annotation.scale || 1);
        const divisions = 4;
        const step = gridSize / divisions;
        
        for (let i = 0; i <= divisions; i++) {
          // Horizontal lines
          const hStart = new THREE.Vector3(annotation.position.x - gridSize/2, 0.05, annotation.position.z - gridSize/2 + i * step);
          const hEnd = new THREE.Vector3(annotation.position.x + gridSize/2, 0.05, annotation.position.z - gridSize/2 + i * step);
          const hGeometry = new THREE.BufferGeometry().setFromPoints([hStart, hEnd]);
          group.add(new THREE.Line(hGeometry, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.6 })));
          
          // Vertical lines
          const vStart = new THREE.Vector3(annotation.position.x - gridSize/2 + i * step, 0.05, annotation.position.z - gridSize/2);
          const vEnd = new THREE.Vector3(annotation.position.x - gridSize/2 + i * step, 0.05, annotation.position.z + gridSize/2);
          const vGeometry = new THREE.BufferGeometry().setFromPoints([vStart, vEnd]);
          group.add(new THREE.Line(vGeometry, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.6 })));
        }
      }

      // LADDER - Agility ladder
      if (annotation.type === 'ladder') {
        const ladderLength = (annotation.radius || 6) * (annotation.scale || 1);
        const ladderWidth = 2;
        const rungs = 8;
        const rungSpacing = ladderLength / rungs;
        
        // Side rails
        const leftRail = [
          new THREE.Vector3(annotation.position.x - ladderWidth/2, 0.05, annotation.position.z - ladderLength/2),
          new THREE.Vector3(annotation.position.x - ladderWidth/2, 0.05, annotation.position.z + ladderLength/2)
        ];
        const rightRail = [
          new THREE.Vector3(annotation.position.x + ladderWidth/2, 0.05, annotation.position.z - ladderLength/2),
          new THREE.Vector3(annotation.position.x + ladderWidth/2, 0.05, annotation.position.z + ladderLength/2)
        ];
        group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(leftRail), new THREE.LineBasicMaterial({ color })));
        group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(rightRail), new THREE.LineBasicMaterial({ color })));
        
        // Rungs
        for (let i = 0; i <= rungs; i++) {
          const z = annotation.position.z - ladderLength/2 + i * rungSpacing;
          const rungPoints = [
            new THREE.Vector3(annotation.position.x - ladderWidth/2, 0.05, z),
            new THREE.Vector3(annotation.position.x + ladderWidth/2, 0.05, z)
          ];
          group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(rungPoints), new THREE.LineBasicMaterial({ color })));
        }
      }

      // WALL - Defensive wall (multiple players)
      if (annotation.type === 'wall') {
        const wallWidth = (annotation.radius || 10) * (annotation.scale || 1);
        const playerCount = 4;
        const spacing = wallWidth / (playerCount - 1);
        
        for (let i = 0; i < playerCount; i++) {
          const x = annotation.position.x - wallWidth/2 + i * spacing;
          
          // Player circle
          const circleGeometry = new THREE.CircleGeometry(1.5, 32);
          const circleMaterial = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7, side: THREE.DoubleSide });
          const circle = new THREE.Mesh(circleGeometry, circleMaterial);
          circle.rotation.x = -Math.PI / 2;
          circle.position.set(x, 0.02, annotation.position.z);
          group.add(circle);
        }
        
        // Connecting line
        const linePoints = [
          new THREE.Vector3(annotation.position.x - wallWidth/2, 0.05, annotation.position.z),
          new THREE.Vector3(annotation.position.x + wallWidth/2, 0.05, annotation.position.z)
        ];
        group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(linePoints), new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.5 })));
      }

      // RUN - Movement run path
      if (annotation.type === 'run' && annotation.endPosition) {
        const startVec = new THREE.Vector3(annotation.position.x, 0.2, annotation.position.z);
        const endVec = new THREE.Vector3(annotation.endPosition.x, 0.2, annotation.endPosition.z);
        
        // Dashed line with arrow
        const lineGeometry = new THREE.BufferGeometry().setFromPoints([startVec, endVec]);
        const dashedMaterial = createDashedLineMaterial(color, 1, 0.5);
        const line = new THREE.Line(lineGeometry, dashedMaterial);
        line.computeLineDistances();
        group.add(line);
        
        const direction = new THREE.Vector3().subVectors(endVec, startVec).normalize();
        const arrowHead = new THREE.Mesh(
          new THREE.ConeGeometry(0.5, 1.5, 8),
          new THREE.MeshBasicMaterial({ color })
        );
        arrowHead.position.copy(endVec);
        arrowHead.rotation.x = Math.PI / 2;
        arrowHead.rotation.z = -Math.atan2(direction.x, direction.z);
        group.add(arrowHead);
      }

      // COMPACT BLOCK - Vertical rectangle (defensive block formation)
      if (annotation.type === 'compact_block') {
        const scale = annotation.scale || 1;
        const rotation = annotation.rotation || 0;
        const width = 6 * scale; // Narrower width
        const height = 12 * scale; // Taller height (vertical)
        
        // Create a group for rotation
        const blockGroup = new THREE.Group();
        blockGroup.position.set(annotation.position.x, 0, annotation.position.z);
        blockGroup.rotation.y = rotation;
        
        // Filled rectangle (vertical orientation - long on Z axis)
        const rectShape = new THREE.Shape();
        rectShape.moveTo(-width/2, -height/2);
        rectShape.lineTo(width/2, -height/2);
        rectShape.lineTo(width/2, height/2);
        rectShape.lineTo(-width/2, height/2);
        rectShape.closePath();
        
        const rectGeometry = new THREE.ShapeGeometry(rectShape);
        const rectMaterial = new THREE.MeshBasicMaterial({ 
          color, 
          transparent: true, 
          opacity: 0.35,
          side: THREE.DoubleSide,
        });
        const rect = new THREE.Mesh(rectGeometry, rectMaterial);
        rect.rotation.x = -Math.PI / 2;
        rect.position.y = 0.02;
        blockGroup.add(rect);
        
        // Border outline
        const borderPoints = [
          new THREE.Vector3(-width/2, 0.03, -height/2),
          new THREE.Vector3(width/2, 0.03, -height/2),
          new THREE.Vector3(width/2, 0.03, height/2),
          new THREE.Vector3(-width/2, 0.03, height/2),
          new THREE.Vector3(-width/2, 0.03, -height/2),
        ];
        const borderGeometry = new THREE.BufferGeometry().setFromPoints(borderPoints);
        const borderMaterial = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.8 });
        const border = new THREE.Line(borderGeometry, borderMaterial);
        blockGroup.add(border);
        
        // Inner lines to show block structure (player lines)
        const lineCount = 3;
        for (let i = 1; i < lineCount; i++) {
          const zPos = -height/2 + (height / lineCount) * i;
          const linePoints = [
            new THREE.Vector3(-width/2, 0.04, zPos),
            new THREE.Vector3(width/2, 0.04, zPos),
          ];
          const lineGeometry = new THREE.BufferGeometry().setFromPoints(linePoints);
          const lineMaterial = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.5 });
          blockGroup.add(new THREE.Line(lineGeometry, lineMaterial));
        }
        
        group.add(blockGroup);
      }

      // FUTURE TRAIL - Fading predicted movement path
      if (annotation.type === 'future_trail' && annotation.points && annotation.points.length > 1) {
        const points = annotation.points.map(p => new THREE.Vector3(p.x, 0.15, p.z));
        
        // Create segmented line with fading opacity
        for (let i = 0; i < points.length - 1; i++) {
          const segmentStart = points[i];
          const segmentEnd = points[i + 1];
          const progress = i / (points.length - 1);
          const opacity = 0.9 - progress * 0.7; // Fade from 0.9 to 0.2
          
          // Dashed segment
          const segmentGeometry = new THREE.BufferGeometry().setFromPoints([segmentStart, segmentEnd]);
          const segmentMaterial = new THREE.LineDashedMaterial({
            color,
            dashSize: 0.8,
            gapSize: 0.4,
            transparent: true,
            opacity,
          });
          const segment = new THREE.Line(segmentGeometry, segmentMaterial);
          segment.computeLineDistances();
          group.add(segment);
        }
        
        // Add fading dots at each point
        for (let i = 0; i < points.length; i++) {
          const progress = i / (points.length - 1);
          const opacity = 0.8 - progress * 0.6;
          const size = 0.6 - progress * 0.3;
          
          const dotGeometry = new THREE.CircleGeometry(size, 16);
          const dotMaterial = new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity,
            side: THREE.DoubleSide,
          });
          const dot = new THREE.Mesh(dotGeometry, dotMaterial);
          dot.rotation.x = -Math.PI / 2;
          dot.position.copy(points[i]);
          dot.position.y = 0.02;
          group.add(dot);
        }
        
        // Arrow at the end
        if (points.length >= 2) {
          const lastPoint = points[points.length - 1];
          const prevPoint = points[points.length - 2];
          const direction = new THREE.Vector3().subVectors(lastPoint, prevPoint).normalize();
          
          const arrowHead = new THREE.Mesh(
            new THREE.ConeGeometry(0.4, 1.2, 6),
            new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.4 })
          );
          arrowHead.position.copy(lastPoint);
          arrowHead.position.y = 0.15;
          arrowHead.rotation.x = Math.PI / 2;
          arrowHead.rotation.z = -Math.atan2(direction.x, direction.z);
          group.add(arrowHead);
        }
      }

      // Other zone types
      const basicZoneTypes = ['delivery_zone', 'target_zone'];
      if (basicZoneTypes.includes(annotation.type)) {
        const radius = (annotation.radius || 8) * (annotation.scale || 1);
        const circleGeometry = new THREE.CircleGeometry(radius, 48);
        const circleMaterial = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.3, side: THREE.DoubleSide });
        const circle = new THREE.Mesh(circleGeometry, circleMaterial);
        circle.rotation.x = -Math.PI / 2;
        circle.position.set(annotation.position.x, 0.02, annotation.position.z);
        group.add(circle);
        
        const ringGeometry = new THREE.RingGeometry(radius - 0.3, radius, 64);
        const ringMaterial = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7, side: THREE.DoubleSide });
        const ring = new THREE.Mesh(ringGeometry, ringMaterial);
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(annotation.position.x, 0.03, annotation.position.z);
        group.add(ring);
      }

      const basicMarkerTypes = ['decoy', 'screen', 'cover_shadow', 'press_trap', 'line_shift', 'marking'];
      if (basicMarkerTypes.includes(annotation.type)) {
        const radius = annotation.radius || 3;
        const circleGeometry = new THREE.CircleGeometry(radius, 32);
        const circleMaterial = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5, side: THREE.DoubleSide });
        const circle = new THREE.Mesh(circleGeometry, circleMaterial);
        circle.rotation.x = -Math.PI / 2;
        circle.position.set(annotation.position.x, 0.02, annotation.position.z);
        group.add(circle);
      }
    });
  }, [annotations]);

  // Handle clicks on pitch
  const handleClick = useCallback((event: React.MouseEvent) => {
    if (!isInteractive || !onPitchClick) return;
    if (toolMode === 'pan') return;

    const container = containerRef.current;
    const camera = cameraRef.current;
    const pitchPlane = pitchPlaneRef.current;
    if (!container || !camera || !pitchPlane) return;

    const rect = container.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );

    raycasterRef.current.setFromCamera(mouse, camera);
    const intersects = raycasterRef.current.intersectObject(pitchPlane);

    if (intersects.length > 0) {
      const point = intersects[0].point;
      onPitchClick({ x: point.x, y: point.y, z: point.z });
    }
  }, [isInteractive, toolMode, onPitchClick]);

  return (
    <div
      ref={containerRef}
      className={`three-layer ${isInteractive ? 'interactive' : ''}`}
      onClick={handleClick}
    >
      {/* HTML Labels for player names */}
      {labels.map(label => (
        label.visible && (
          <div
            key={label.id}
            className="absolute pointer-events-none z-10 transform -translate-x-1/2"
            style={{
              left: label.screenX,
              top: label.screenY,
            }}
          >
            <div 
              className="px-2 py-0.5 rounded text-xs font-bold text-white whitespace-nowrap"
              style={{ 
                backgroundColor: 'rgba(0, 0, 0, 0.85)',
                border: `1px solid ${label.color}`,
                boxShadow: `0 0 8px ${label.color}40`,
              }}
            >
              {label.text}
            </div>
          </div>
        )
      ))}
    </div>
  );
}