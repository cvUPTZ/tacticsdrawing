import { useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { Annotation, CalibrationState, ToolMode, Vector3 } from '@/types/analysis';

interface ThreeCanvasProps {
  calibration: CalibrationState;
  annotations: Annotation[];
  toolMode: ToolMode;
  isInteractive: boolean;
  onPitchClick?: (position: Vector3) => void;
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
      opacity: 0.05,
      side: THREE.DoubleSide,
    });
    const pitchPlane = new THREE.Mesh(pitchGeometry, pitchMaterial);
    pitchPlane.rotation.x = -Math.PI / 2;
    pitchPlane.position.y = 0;
    scene.add(pitchPlane);
    pitchPlaneRef.current = pitchPlane;

    // Pitch lines with glow effect
    const linesMaterial = new THREE.LineBasicMaterial({ 
      color: 0xffffff, 
      transparent: true, 
      opacity: 0.5,
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
    const centerCircle = new THREE.RingGeometry(9, 9.15, 64);
    const centerCircleMesh = new THREE.Mesh(
      centerCircle,
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, side: THREE.DoubleSide })
    );
    centerCircleMesh.rotation.x = -Math.PI / 2;
    centerCircleMesh.position.y = 0.01;
    scene.add(centerCircleMesh);

    // Penalty areas (16.5m x 40.3m)
    const penaltyWidth = 40.3;
    const penaltyDepth = 16.5;
    
    // Left penalty area
    const leftPenaltyPoints = [
      new THREE.Vector3(-pitchWidth/2, 0.01, -penaltyWidth/2),
      new THREE.Vector3(-pitchWidth/2 + penaltyDepth, 0.01, -penaltyWidth/2),
      new THREE.Vector3(-pitchWidth/2 + penaltyDepth, 0.01, penaltyWidth/2),
      new THREE.Vector3(-pitchWidth/2, 0.01, penaltyWidth/2),
    ];
    const leftPenaltyGeometry = new THREE.BufferGeometry().setFromPoints(leftPenaltyPoints);
    scene.add(new THREE.Line(leftPenaltyGeometry, linesMaterial));

    // Right penalty area
    const rightPenaltyPoints = [
      new THREE.Vector3(pitchWidth/2, 0.01, -penaltyWidth/2),
      new THREE.Vector3(pitchWidth/2 - penaltyDepth, 0.01, -penaltyWidth/2),
      new THREE.Vector3(pitchWidth/2 - penaltyDepth, 0.01, penaltyWidth/2),
      new THREE.Vector3(pitchWidth/2, 0.01, penaltyWidth/2),
    ];
    const rightPenaltyGeometry = new THREE.BufferGeometry().setFromPoints(rightPenaltyPoints);
    scene.add(new THREE.Line(rightPenaltyGeometry, linesMaterial));

    // 6-yard boxes
    const sixYardWidth = 18.32;
    const sixYardDepth = 5.5;

    // Left 6-yard box
    const leftSixYardPoints = [
      new THREE.Vector3(-pitchWidth/2, 0.01, -sixYardWidth/2),
      new THREE.Vector3(-pitchWidth/2 + sixYardDepth, 0.01, -sixYardWidth/2),
      new THREE.Vector3(-pitchWidth/2 + sixYardDepth, 0.01, sixYardWidth/2),
      new THREE.Vector3(-pitchWidth/2, 0.01, sixYardWidth/2),
    ];
    const leftSixYardGeometry = new THREE.BufferGeometry().setFromPoints(leftSixYardPoints);
    scene.add(new THREE.Line(leftSixYardGeometry, linesMaterial));

    // Right 6-yard box
    const rightSixYardPoints = [
      new THREE.Vector3(pitchWidth/2, 0.01, -sixYardWidth/2),
      new THREE.Vector3(pitchWidth/2 - sixYardDepth, 0.01, -sixYardWidth/2),
      new THREE.Vector3(pitchWidth/2 - sixYardDepth, 0.01, sixYardWidth/2),
      new THREE.Vector3(pitchWidth/2, 0.01, sixYardWidth/2),
    ];
    const rightSixYardGeometry = new THREE.BufferGeometry().setFromPoints(rightSixYardPoints);
    scene.add(new THREE.Line(rightSixYardGeometry, linesMaterial));

    // Annotation group
    const annotationGroup = new THREE.Group();
    scene.add(annotationGroup);
    annotationGroupRef.current = annotationGroup;

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);
      renderer.render(scene, camera);
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

  // Update camera based on calibration
  useEffect(() => {
    const camera = cameraRef.current;
    if (!camera) return;

    camera.position.set(calibration.cameraX, calibration.cameraY, calibration.cameraZ);
    camera.rotation.set(calibration.cameraRotationX, calibration.cameraRotationY, calibration.cameraRotationZ);
    camera.fov = calibration.cameraFov;
    camera.updateProjectionMatrix();
  }, [calibration]);

  // Update annotations with enhanced visuals
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
      const isHomeTeam = annotation.metadata?.team === 'home';

      if (annotation.type === 'player') {
        // Player marker - 3D disc with number
        const playerNumber = annotation.label || '?';
        
        // Outer glow ring
        const glowRingGeometry = new THREE.RingGeometry(2.2, 3, 32);
        const glowRingMaterial = new THREE.MeshBasicMaterial({ 
          color, 
          transparent: true, 
          opacity: 0.3,
          side: THREE.DoubleSide,
        });
        const glowRing = new THREE.Mesh(glowRingGeometry, glowRingMaterial);
        glowRing.rotation.x = -Math.PI / 2;
        glowRing.position.set(annotation.position.x, 0.02, annotation.position.z);
        group.add(glowRing);

        // Main disc
        const discGeometry = new THREE.CylinderGeometry(2, 2, 0.3, 32);
        const discMaterial = new THREE.MeshBasicMaterial({ 
          color,
          transparent: true,
          opacity: 0.95,
        });
        const disc = new THREE.Mesh(discGeometry, discMaterial);
        disc.position.set(annotation.position.x, 0.15, annotation.position.z);
        group.add(disc);

        // Inner circle (darker)
        const innerCircleGeometry = new THREE.CircleGeometry(1.3, 32);
        const innerCircleMaterial = new THREE.MeshBasicMaterial({ 
          color: new THREE.Color(color).multiplyScalar(0.3), 
          side: THREE.DoubleSide,
        });
        const innerCircle = new THREE.Mesh(innerCircleGeometry, innerCircleMaterial);
        innerCircle.rotation.x = -Math.PI / 2;
        innerCircle.position.set(annotation.position.x, 0.32, annotation.position.z);
        group.add(innerCircle);

        // Direction indicator (small triangle at edge)
        if (annotation.endPosition) {
          const direction = new THREE.Vector2(
            annotation.endPosition.x - annotation.position.x,
            annotation.endPosition.z - annotation.position.z
          ).normalize();
          
          const indicatorGeometry = new THREE.ConeGeometry(0.5, 1, 3);
          const indicatorMaterial = new THREE.MeshBasicMaterial({ color });
          const indicator = new THREE.Mesh(indicatorGeometry, indicatorMaterial);
          indicator.position.set(
            annotation.position.x + direction.x * 2.5,
            0.5,
            annotation.position.z + direction.y * 2.5
          );
          indicator.rotation.x = Math.PI / 2;
          indicator.rotation.z = -Math.atan2(direction.x, direction.y);
          group.add(indicator);
        }
      }

      if (annotation.type === 'arrow' && annotation.endPosition) {
        const startVec = new THREE.Vector3(annotation.position.x, 0.5, annotation.position.z);
        const endVec = new THREE.Vector3(annotation.endPosition.x, 0.5, annotation.endPosition.z);
        
        // Calculate curve height based on distance
        const distance = startVec.distanceTo(endVec);
        const curveHeight = Math.min(distance * 0.15, 5);
        
        // Create curved path
        const curve = createCurvedArrowPath(startVec, endVec, curveHeight);
        
        // Tube geometry for thick curved line
        const tubeGeometry = createTubeFromCurve(curve, 0.2);
        const tubeMaterial = new THREE.MeshBasicMaterial({ 
          color,
          transparent: true,
          opacity: 0.9,
        });
        const tube = new THREE.Mesh(tubeGeometry, tubeMaterial);
        group.add(tube);

        // Glow tube (larger, more transparent)
        const glowTubeGeometry = createTubeFromCurve(curve, 0.4);
        const glowTubeMaterial = new THREE.MeshBasicMaterial({ 
          color,
          transparent: true,
          opacity: 0.3,
        });
        const glowTube = new THREE.Mesh(glowTubeGeometry, glowTubeMaterial);
        group.add(glowTube);

        // Arrowhead
        const direction = new THREE.Vector3(
          annotation.endPosition.x - annotation.position.x,
          0,
          annotation.endPosition.z - annotation.position.z
        ).normalize();
        
        const arrowHeadGeometry = new THREE.ConeGeometry(0.8, 2.5, 8);
        const arrowHeadMaterial = new THREE.MeshBasicMaterial({ color });
        const arrowHead = new THREE.Mesh(arrowHeadGeometry, arrowHeadMaterial);
        arrowHead.position.copy(endVec);
        arrowHead.rotation.x = Math.PI / 2;
        arrowHead.rotation.z = -Math.atan2(direction.x, direction.z);
        group.add(arrowHead);
      }

      if (annotation.type === 'zone') {
        const radius = annotation.radius || 10;
        
        // Filled zone
        const circleGeometry = new THREE.CircleGeometry(radius, 48);
        const circleMaterial = new THREE.MeshBasicMaterial({ 
          color, 
          transparent: true, 
          opacity: 0.2,
          side: THREE.DoubleSide,
        });
        const circle = new THREE.Mesh(circleGeometry, circleMaterial);
        circle.rotation.x = -Math.PI / 2;
        circle.position.set(annotation.position.x, 0.02, annotation.position.z);
        group.add(circle);

        // Zone outline with glow
        const ringGeometry = new THREE.RingGeometry(radius - 0.3, radius, 64);
        const ringMaterial = new THREE.MeshBasicMaterial({ 
          color, 
          transparent: true, 
          opacity: 0.8,
          side: THREE.DoubleSide,
        });
        const ring = new THREE.Mesh(ringGeometry, ringMaterial);
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(annotation.position.x, 0.03, annotation.position.z);
        group.add(ring);

        // Outer glow
        const glowRingGeometry = new THREE.RingGeometry(radius, radius + 1, 64);
        const glowRingMaterial = new THREE.MeshBasicMaterial({ 
          color, 
          transparent: true, 
          opacity: 0.3,
          side: THREE.DoubleSide,
        });
        const glowRing = new THREE.Mesh(glowRingGeometry, glowRingMaterial);
        glowRing.rotation.x = -Math.PI / 2;
        glowRing.position.set(annotation.position.x, 0.03, annotation.position.z);
        group.add(glowRing);
      }

      if (annotation.type === 'freehand' && annotation.points && annotation.points.length > 1) {
        // Movement path / freehand drawing
        const points = annotation.points.map(p => new THREE.Vector3(p.x, 0.3, p.z));
        
        // Create smooth curve through points
        const curve = new THREE.CatmullRomCurve3(points);
        const tubeGeometry = new THREE.TubeGeometry(curve, 64, 0.15, 8, false);
        const tubeMaterial = new THREE.MeshBasicMaterial({ 
          color,
          transparent: true,
          opacity: 0.85,
        });
        const tube = new THREE.Mesh(tubeGeometry, tubeMaterial);
        group.add(tube);

        // Glow effect
        const glowTubeGeometry = new THREE.TubeGeometry(curve, 64, 0.35, 8, false);
        const glowTubeMaterial = new THREE.MeshBasicMaterial({ 
          color,
          transparent: true,
          opacity: 0.25,
        });
        const glowTube = new THREE.Mesh(glowTubeGeometry, glowTubeMaterial);
        group.add(glowTube);

        // End marker (small sphere)
        if (points.length > 0) {
          const lastPoint = points[points.length - 1];
          const endMarkerGeometry = new THREE.SphereGeometry(0.5, 16, 16);
          const endMarkerMaterial = new THREE.MeshBasicMaterial({ color });
          const endMarker = new THREE.Mesh(endMarkerGeometry, endMarkerMaterial);
          endMarker.position.copy(lastPoint);
          group.add(endMarker);
        }
      }

      if (annotation.type === 'spotlight') {
        // Volumetric spotlight effect
        const coneHeight = 25;
        const coneRadius = 6;
        
        // Light cone
        const coneGeometry = new THREE.ConeGeometry(coneRadius, coneHeight, 32, 1, true);
        const coneMaterial = new THREE.MeshBasicMaterial({ 
          color, 
          transparent: true, 
          opacity: 0.1,
          side: THREE.DoubleSide,
        });
        const cone = new THREE.Mesh(coneGeometry, coneMaterial);
        cone.position.set(annotation.position.x, coneHeight / 2, annotation.position.z);
        cone.rotation.x = Math.PI;
        group.add(cone);

        // Ground highlight
        const groundCircle = new THREE.CircleGeometry(coneRadius, 32);
        const groundMaterial = new THREE.MeshBasicMaterial({ 
          color, 
          transparent: true, 
          opacity: 0.4,
          side: THREE.DoubleSide,
        });
        const ground = new THREE.Mesh(groundCircle, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.position.set(annotation.position.x, 0.02, annotation.position.z);
        group.add(ground);

        // Outer glow on ground
        const groundGlow = new THREE.RingGeometry(coneRadius, coneRadius + 2, 32);
        const groundGlowMaterial = new THREE.MeshBasicMaterial({ 
          color, 
          transparent: true, 
          opacity: 0.2,
          side: THREE.DoubleSide,
        });
        const groundGlowMesh = new THREE.Mesh(groundGlow, groundGlowMaterial);
        groundGlowMesh.rotation.x = -Math.PI / 2;
        groundGlowMesh.position.set(annotation.position.x, 0.02, annotation.position.z);
        group.add(groundGlowMesh);
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
    />
  );
}
