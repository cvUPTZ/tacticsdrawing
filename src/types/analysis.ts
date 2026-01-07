// Core types for the video analysis platform

export type AnnotationType = 'player' | 'arrow' | 'zone' | 'freehand' | 'spotlight' | 'text';

export type ToolMode = 'select' | 'player' | 'arrow' | 'zone' | 'freehand' | 'spotlight' | 'text' | 'pan';

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
  home: ['#00d4ff', '#0099cc', '#00ffcc', '#00ccff', '#33e6ff'],
  away: ['#ff4444', '#ff6666', '#ff8800', '#ff0066', '#ff3366'],
};

export const ANNOTATION_COLORS = [
  '#00d4ff', // Cyan (primary)
  '#ff8800', // Orange (accent)
  '#00ff88', // Green
  '#ff4488', // Pink
  '#ffff00', // Yellow
  '#aa44ff', // Purple
  '#ffffff', // White
];
