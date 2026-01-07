// Core types for the video analysis platform

export type AnnotationType = 'player' | 'arrow' | 'zone' | 'freehand' | 'spotlight' | 'text' | 'offside' | 'pressing' | 'line' | 'marker' | 'curve' | 'shield' | 'distance';

export type ToolMode = 'select' | 'player' | 'arrow' | 'zone' | 'freehand' | 'spotlight' | 'text' | 'pan' | 'offside' | 'pressing' | 'line' | 'marker' | 'curve' | 'shield' | 'distance';

export type ZoneShape = 'circle' | 'rectangle' | 'triangle' | 'polygon';

export interface FormationInfo {
  name: string;
  pattern: string;
  confidence: number;
}

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface Annotation {
  id: string;
  projectId: string;
  type: AnnotationType;
  label?: string;
  color: string;
  position: Vector3;
  endPosition?: Vector3;
  points?: Vector3[];
  radius?: number;
  strokeWidth: number;
  timestampStart: number;
  timestampEnd?: number;
  metadata: Record<string, unknown>;
  layerOrder: number;
  visible: boolean;
  createdAt: string;
  updatedAt: string;
  zoneShape?: ZoneShape;
  targetPlayerId?: string; // For pressing - links to player annotation
}

export interface Calibration {
  id: string;
  projectId: string;
  name: string;
  cameraX: number;
  cameraY: number;
  cameraZ: number;
  cameraFov: number;
  cameraRotationX: number;
  cameraRotationY: number;
  cameraRotationZ: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  userId: string;
  name: string;
  description?: string;
  videoFilename?: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  durationSeconds?: number;
  createdAt: string;
  updatedAt: string;
}

export interface VideoState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  playbackRate: number;
  volume: number;
  isMuted: boolean;
}

export interface CalibrationState {
  cameraX: number;
  cameraY: number;
  cameraZ: number;
  cameraFov: number;
  cameraRotationX: number;
  cameraRotationY: number;
  cameraRotationZ: number;
}

export const DEFAULT_CALIBRATION: CalibrationState = {
  cameraX: 0,
  cameraY: 50,
  cameraZ: 80,
  cameraFov: 45,
  cameraRotationX: -0.5,
  cameraRotationY: 0,
  cameraRotationZ: 0,
};

export const PLAYER_COLORS = {
  home: ['#00d4ff', '#00b8e6', '#00ffcc', '#00ccff', '#33e6ff'],
  away: ['#ff4444', '#ff6666', '#ff8800', '#ff0066', '#ff3366'],
};

export const ANNOTATION_COLORS = [
  '#00d4ff', // Cyan (primary - home)
  '#ff4444', // Red (away)
  '#ff8800', // Orange (accent - passes)
  '#00ff88', // Green (movement)
  '#ffff00', // Yellow
  '#aa44ff', // Purple
  '#ff44aa', // Pink
  '#ffffff', // White
  '#1a1a1a', // Black
];

// Arrow styles
export type ArrowStyle = 'solid' | 'dashed' | 'dotted';
