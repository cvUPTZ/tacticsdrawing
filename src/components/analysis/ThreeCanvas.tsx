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

    // Renderer
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
      opacity: 0.1,
      side: THREE.DoubleSide,
    });
    const pitchPlane = new THREE.Mesh(pitchGeometry, pitchMaterial);
    pitchPlane.rotation.x = -Math.PI / 2;
    pitchPlane.position.y = 0;
    scene.add(pitchPlane);
    pitchPlaneRef.current = pitchPlane;

    // Pitch lines
    const linesMaterial = new THREE.LineBasicMaterial({ 
      color: 0xffffff, 
      transparent: true, 
      opacity: 0.6,
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
    const centerCircle = new THREE.RingGeometry(9, 9.2, 64);
    const centerCircleMesh = new THREE.Mesh(
      centerCircle,
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, side: THREE.DoubleSide })
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

  // Update annotations
  useEffect(() => {
    const group = annotationGroupRef.current;
    if (!group) return;

    // Clear existing annotations
    while (group.children.length > 0) {
      const child = group.children[0];
      group.remove(child);
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (child.material instanceof THREE.Material) {
          child.material.dispose();
        }
      }
    }

    // Add new annotations
    annotations.forEach(annotation => {
      if (!annotation.visible) return;

      const color = new THREE.Color(annotation.color);

      if (annotation.type === 'player') {
        // Player marker (cylinder + number)
        const cylinderGeometry = new THREE.CylinderGeometry(1.5, 1.5, 0.5, 32);
        const cylinderMaterial = new THREE.MeshBasicMaterial({ 
          color, 
          transparent: true, 
          opacity: 0.9,
        });
        const cylinder = new THREE.Mesh(cylinderGeometry, cylinderMaterial);
        cylinder.position.set(annotation.position.x, 0.25, annotation.position.z);
        group.add(cylinder);

        // Glow ring
        const ringGeometry = new THREE.RingGeometry(1.5, 2, 32);
        const ringMaterial = new THREE.MeshBasicMaterial({ 
          color, 
          transparent: true, 
          opacity: 0.4,
          side: THREE.DoubleSide,
        });
        const ring = new THREE.Mesh(ringGeometry, ringMaterial);
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(annotation.position.x, 0.02, annotation.position.z);
        group.add(ring);
      }

      if (annotation.type === 'arrow' && annotation.endPosition) {
        // Arrow line
        const points = [
          new THREE.Vector3(annotation.position.x, 0.5, annotation.position.z),
          new THREE.Vector3(annotation.endPosition.x, 0.5, annotation.endPosition.z),
        ];
        const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
        const lineMaterial = new THREE.LineBasicMaterial({ 
          color, 
          linewidth: 2,
        });
        const line = new THREE.Line(lineGeometry, lineMaterial);
        group.add(line);

        // Arrowhead
        const direction = new THREE.Vector3(
          annotation.endPosition.x - annotation.position.x,
          0,
          annotation.endPosition.z - annotation.position.z
        ).normalize();
        
        const arrowHeadGeometry = new THREE.ConeGeometry(1, 3, 8);
        const arrowHeadMaterial = new THREE.MeshBasicMaterial({ color });
        const arrowHead = new THREE.Mesh(arrowHeadGeometry, arrowHeadMaterial);
        arrowHead.position.set(annotation.endPosition.x, 0.5, annotation.endPosition.z);
        arrowHead.rotation.x = Math.PI / 2;
        arrowHead.rotation.z = -Math.atan2(direction.x, direction.z);
        group.add(arrowHead);
      }

      if (annotation.type === 'zone') {
        // Zone (transparent circle)
        const radius = annotation.radius || 10;
        const circleGeometry = new THREE.CircleGeometry(radius, 32);
        const circleMaterial = new THREE.MeshBasicMaterial({ 
          color, 
          transparent: true, 
          opacity: 0.3,
          side: THREE.DoubleSide,
        });
        const circle = new THREE.Mesh(circleGeometry, circleMaterial);
        circle.rotation.x = -Math.PI / 2;
        circle.position.set(annotation.position.x, 0.02, annotation.position.z);
        group.add(circle);

        // Zone outline
        const ringGeometry = new THREE.RingGeometry(radius - 0.2, radius, 64);
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
      }

      if (annotation.type === 'spotlight') {
        // Spotlight cone
        const coneGeometry = new THREE.ConeGeometry(5, 20, 32, 1, true);
        const coneMaterial = new THREE.MeshBasicMaterial({ 
          color, 
          transparent: true, 
          opacity: 0.15,
          side: THREE.DoubleSide,
        });
        const cone = new THREE.Mesh(coneGeometry, coneMaterial);
        cone.position.set(annotation.position.x, 10, annotation.position.z);
        cone.rotation.x = Math.PI;
        group.add(cone);

        // Ground circle
        const groundCircle = new THREE.CircleGeometry(5, 32);
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
