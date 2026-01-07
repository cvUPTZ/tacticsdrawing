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

      // ZONE - Red/colored circular area
      if (annotation.type === 'zone') {
        const radius = annotation.radius || 8;
        
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

      // SPOTLIGHT - Vertical column highlighting player
      if (annotation.type === 'spotlight') {
        const columnHeight = 30;
        const columnRadius = 3;
        
        // Vertical transparent column
        const columnGeometry = new THREE.CylinderGeometry(columnRadius, columnRadius, columnHeight, 32, 1, true);
        const columnMaterial = new THREE.MeshBasicMaterial({ 
          color, 
          transparent: true, 
          opacity: 0.12,
          side: THREE.DoubleSide,
        });
        const column = new THREE.Mesh(columnGeometry, columnMaterial);
        column.position.set(annotation.position.x, columnHeight / 2, annotation.position.z);
        group.add(column);

        // Brighter inner column
        const innerColumnGeometry = new THREE.CylinderGeometry(columnRadius * 0.6, columnRadius * 0.6, columnHeight, 32, 1, true);
        const innerColumnMaterial = new THREE.MeshBasicMaterial({ 
          color, 
          transparent: true, 
          opacity: 0.08,
          side: THREE.DoubleSide,
        });
        const innerColumn = new THREE.Mesh(innerColumnGeometry, innerColumnMaterial);
        innerColumn.position.set(annotation.position.x, columnHeight / 2, annotation.position.z);
        group.add(innerColumn);

        // Ground circle
        const groundGeometry = new THREE.CircleGeometry(columnRadius, 32);
        const groundMaterial = new THREE.MeshBasicMaterial({ 
          color, 
          transparent: true, 
          opacity: 0.25,
          side: THREE.DoubleSide,
        });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.position.set(annotation.position.x, 0.02, annotation.position.z);
        group.add(ground);
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
    });
  }, [annotations]);

  // Handle clicks on pitch
  const handleClick = useCallback((event: React.MouseEvent) => {
    if (!isInteractive || !onPitchClick) return;
    if (toolMode === 'select' || toolMode === 'pan') return;

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
