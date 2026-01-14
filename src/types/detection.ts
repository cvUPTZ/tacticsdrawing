export interface DetectedPlayer {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  team: 'home' | 'away' | 'referee' | 'unknown';
  jerseyColor: string;
  confidence: number;
}

export interface DetectedBall {
  x: number;
  y: number;
  confidence: number;
  visible: boolean;
}

export interface DetectedFieldLine {
  type: 'touchline' | 'goal_line' | 'penalty_box' | 'goal_area' | 'center_circle' | 'center_line' | 'penalty_arc' | 'corner_arc' | 'unknown';
  points: Array<{ x: number; y: number }>;
  confidence: number;
}

export interface DetectedFieldMask {
  corners: Array<{ x: number; y: number }>;
  isVisible: boolean;
}

export interface DetectionResult {
  players: DetectedPlayer[];
  ball: DetectedBall | null;
  fieldLines: DetectedFieldLine[];
  fieldMask: DetectedFieldMask;
  timestamp?: number;
}

export interface DetectionSettings {
  showPlayers: boolean;
  showBall: boolean;
  showFieldLines: boolean;
  showFieldMask: boolean;
  showLabels: boolean;
  isLiveMode: boolean;
  analyzeInterval: number;
}
