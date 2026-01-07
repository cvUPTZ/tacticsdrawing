import { useEffect, useRef, useCallback, useState } from 'react';
import * as THREE from 'three';
import { Annotation, CalibrationState, ToolMode, Vector3 } from '@/types/analysis';

interface ThreeCanvasProps {
  calibration: CalibrationState;
  annotations: Annotation[];
  toolMode: ToolMode;
  isInteractive: boolean;
  onPitchClick?: (position: Vector3) => void;
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
}: ThreeCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const annotationGroupRef = useRef<THREE.Group | null>(null);
  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster());
  const pitchPlaneRef = useRef<THREE.Mesh | null>(null);
  const animationTimeRef = useRef(0);
  const [labels, setLabels] = useState<LabelData[]>([]);

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

    // Renderer with enhanced settings
    const renderer = new THREE.WebGLRenderer({ 
      antialias: true, 
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Football pitch (105m x 68m scaled down)
    const pitchWidth = 105;
    const pitchHeight = 68;
    
    // Pitch plane (invisible, for raycasting)
    const pitchGeometry = new THREE.PlaneGeometry(pitchWidth, pitchHeight);
    const pitchMaterial = new THREE.MeshBasicMaterial({ 
      color: 0x2d8a3e,
      transparent: true,
      opacity: 0.02,
      side: THREE.DoubleSide,
    });
    const pitchPlane = new THREE.Mesh(pitchGeometry, pitchMaterial);
    pitchPlane.rotation.x = -Math.PI / 2;
    pitchPlane.position.y = 0;
    scene.add(pitchPlane);
    pitchPlaneRef.current = pitchPlane;

    // Pitch lines with subtle visibility
    const linesMaterial = new THREE.LineBasicMaterial({ 
      color: 0xffffff, 
      transparent: true, 
      opacity: 0.3,
    });

    // Draw pitch outline
    const outlinePoints = [
      new THREE.Vector3(-pitchWidth/2, 0.01, -pitchHeight/2),
      new THREE.Vector3(pitchWidth/2, 0.01, -pitchHeight/2),
      new THREE.Vector3(pitchWidth/2, 0.01, pitchHeight/2),
      new THREE.Vector3(-pitchWidth/2, 0.01, pitchHeight/2),
      new THREE.Vector3(-pitchWidth/2, 0.01, -pitchHeight/2),
    ];
    const outlineGeometry = new THREE.BufferGeometry().setFromPoints(outlinePoints);
    const outlineLine = new THREE.Line(outlineGeometry, linesMaterial);
    scene.add(outlineLine);

    // Center line
    const centerLinePoints = [
      new THREE.Vector3(0, 0.01, -pitchHeight/2),
      new THREE.Vector3(0, 0.01, pitchHeight/2),
    ];
    const centerLineGeometry = new THREE.BufferGeometry().setFromPoints(centerLinePoints);
    const centerLine = new THREE.Line(centerLineGeometry, linesMaterial);
    scene.add(centerLine);

    // Center circle
    const centerCircle = new THREE.RingGeometry(9, 9.1, 64);
    const centerCircleMesh = new THREE.Mesh(
      centerCircle,
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3, side: THREE.DoubleSide })
    );
    centerCircleMesh.rotation.x = -Math.PI / 2;
    centerCircleMesh.position.y = 0.01;
    scene.add(centerCircleMesh);

    // Penalty areas
    const penaltyWidth = 40.3;
    const penaltyDepth = 16.5;
    
    const leftPenaltyPoints = [
      new THREE.Vector3(-pitchWidth/2, 0.01, -penaltyWidth/2),
      new THREE.Vector3(-pitchWidth/2 + penaltyDepth, 0.01, -penaltyWidth/2),
      new THREE.Vector3(-pitchWidth/2 + penaltyDepth, 0.01, penaltyWidth/2),
      new THREE.Vector3(-pitchWidth/2, 0.01, penaltyWidth/2),
    ];
    const leftPenaltyGeometry = new THREE.BufferGeometry().setFromPoints(leftPenaltyPoints);
    scene.add(new THREE.Line(leftPenaltyGeometry, linesMaterial));

    const rightPenaltyPoints = [
      new THREE.Vector3(pitchWidth/2, 0.01, -penaltyWidth/2),
      new THREE.Vector3(pitchWidth/2 - penaltyDepth, 0.01, -penaltyWidth/2),
      new THREE.Vector3(pitchWidth/2 - penaltyDepth, 0.01, penaltyWidth/2),
      new THREE.Vector3(pitchWidth/2, 0.01, penaltyWidth/2),
    ];
    const rightPenaltyGeometry = new THREE.BufferGeometry().setFromPoints(rightPenaltyPoints);
    scene.add(new THREE.Line(rightPenaltyGeometry, linesMaterial));

    // Annotation group
    const annotationGroup = new THREE.Group();
    scene.add(annotationGroup);
    annotationGroupRef.current = annotationGroup;

    // Animation loop with label updates
    const animate = () => {
      requestAnimationFrame(animate);
      animationTimeRef.current += 0.016; // ~60fps
      
      // Animate objects
      annotationGroup.children.forEach(child => {
        // Spotlight dashed ring - rotating with pulse
        if ((child as any).isSpotlightRing) {
          const startTime = (child as any).spotlightStartTime || 0;
          const elapsed = animationTimeRef.current - startTime;
          // Deceleration: speed decreases over time (fast start, slow end)
          const speed = Math.max(0.01, 0.4 * Math.exp(-elapsed * 0.25));
          child.rotation.y += speed;
          
          // Pulse effect on scale
          const pulse = 1 + Math.sin(animationTimeRef.current * 3) * 0.08;
          child.scale.set(pulse, 1, pulse);
          
          // Pulse opacity
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
      
      // Update label positions
      updateLabelPositions();
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
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, []);

  // Update label positions from 3D to screen space
  const updateLabelPositions = useCallback(() => {
    const camera = cameraRef.current;
    const container = containerRef.current;
    if (!camera || !container) return;

    const newLabels: LabelData[] = [];
    
    annotations.forEach(annotation => {
      if (!annotation.visible) return;
      if (annotation.type !== 'player' && annotation.type !== 'spotlight') return;
      if (!annotation.label) return;

      const pos = new THREE.Vector3(annotation.position.x, 2, annotation.position.z);
      const projected = pos.clone().project(camera);
      
      const x = (projected.x * 0.5 + 0.5) * container.clientWidth;
      const y = (-projected.y * 0.5 + 0.5) * container.clientHeight;
      
      newLabels.push({
        id: annotation.id,
        text: annotation.label,
        screenX: x,
        screenY: y - 30, // Offset above marker
        color: annotation.color,
        visible: projected.z < 1,
      });
    });

    setLabels(newLabels);
  }, [annotations]);

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

      // ZONE - Different shapes (circle, rectangle, triangle)
      if (annotation.type === 'zone') {
        const radius = annotation.radius || 8;
        const zoneShape = annotation.zoneShape || 'circle';
        
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
          circle.position.set(annotation.position.x, 0.02, annotation.position.z);
          group.add(circle);

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
          inner.position.set(annotation.position.x, 0.025, annotation.position.z);
          group.add(inner);

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
          ring.position.set(annotation.position.x, 0.03, annotation.position.z);
          group.add(ring);
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
          rect.position.set(annotation.position.x, 0.02, annotation.position.z);
          group.add(rect);

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
          border.position.set(annotation.position.x, 0, annotation.position.z);
          group.add(border);
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
          tri.position.set(annotation.position.x, 0.02, annotation.position.z);
          group.add(tri);

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
          triBorder.position.set(annotation.position.x, 0, annotation.position.z);
          group.add(triBorder);
        }
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
        const distance = startVec.distanceTo(endVec);
        
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

        // Store distance in metadata for label display
        (annotation as any).calculatedDistance = distance.toFixed(1);
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