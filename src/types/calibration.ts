// Types for homography-based pitch calibration system

// Video coordinate (pixels)
export interface VideoCoord {
  x: number;
  y: number;
}

// Pitch coordinate (meters)
export interface PitchCoord {
  X: number;
  Y: number;
}

// Calibration point - links video pixel to known pitch location
export interface CalibrationPoint {
  id: string;
  video_coords: VideoCoord;
  pitch_coords: PitchCoord;
  frame_number: number;
  feature_name: string;
  timestamp?: number;
}

// Validation metrics after homography computation
export interface ValidationMetrics {
  mean_error: number;  // meters
  max_error: number;   // meters
  point_count: number;
  is_valid: boolean;
}

// Complete calibration data
export interface HomographyCalibration {
  id: string;
  video_id: string;
  homography_matrix: number[][];  // 3x3 matrix
  inverse_matrix: number[][];     // 3x3 inverse matrix for pitch-to-video
  calibration_points: CalibrationPoint[];
  validation_metrics: ValidationMetrics;
  created_at: string;
  updated_at: string;
}

// Tagged event with both coordinate systems
export interface TaggedEvent {
  id: string;
  timestamp: number;        // seconds in video
  video_coords: VideoCoord;
  pitch_coords: PitchCoord;
  event_type: string;
  team?: 'home' | 'away';
  player_number?: number;
  description?: string;
  created_at: string;
}

// Event type definitions for hotkey tagging
export interface EventTypeConfig {
  key: string;
  label: string;
  color: string;
  icon?: string;
}

export const EVENT_TYPES: Record<string, EventTypeConfig> = {
  pass: { key: 'P', label: 'Pass', color: '#22c55e' },
  shot: { key: 'S', label: 'Shot', color: '#ef4444' },
  tackle: { key: 'T', label: 'Tackle', color: '#f97316' },
  dribble: { key: 'D', label: 'Dribble', color: '#3b82f6' },
  cross: { key: 'C', label: 'Cross', color: '#8b5cf6' },
  header: { key: 'H', label: 'Header', color: '#ec4899' },
  foul: { key: 'F', label: 'Foul', color: '#eab308' },
  save: { key: 'G', label: 'Save', color: '#06b6d4' },
  interception: { key: 'I', label: 'Interception', color: '#14b8a6' },
  clearance: { key: 'L', label: 'Clearance', color: '#a855f7' },
};

// OpenCV ready state
export interface OpenCVState {
  isLoaded: boolean;
  isLoading: boolean;
  error: string | null;
}
