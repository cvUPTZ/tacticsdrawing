// Standard football pitch dimensions and features
// All measurements in meters

export const PITCH_DIMENSIONS = {
  length: 105,
  width: 68,
};

// Known pitch features with real-world coordinates
// Origin (0,0) is top-left corner of the pitch
// X increases towards right (along length)
// Y increases towards bottom (along width)
export const PITCH_FEATURES: Record<string, { X: number; Y: number; label: string }> = {
  // Corners
  top_left_corner: { X: 0, Y: 0, label: 'Top Left Corner' },
  top_right_corner: { X: 105, Y: 0, label: 'Top Right Corner' },
  bottom_left_corner: { X: 0, Y: 68, label: 'Bottom Left Corner' },
  bottom_right_corner: { X: 105, Y: 68, label: 'Bottom Right Corner' },
  
  // Center
  center_spot: { X: 52.5, Y: 34, label: 'Center Spot' },
  center_line_top: { X: 52.5, Y: 0, label: 'Center Line Top' },
  center_line_bottom: { X: 52.5, Y: 68, label: 'Center Line Bottom' },
  
  // Left penalty area (16.5m from goal line, 40.3m wide)
  left_penalty_top: { X: 16.5, Y: 13.85, label: 'Left Penalty Top' },
  left_penalty_bottom: { X: 16.5, Y: 54.15, label: 'Left Penalty Bottom' },
  left_penalty_spot: { X: 11, Y: 34, label: 'Left Penalty Spot' },
  left_goal_area_top: { X: 5.5, Y: 24.85, label: 'Left Goal Area Top' },
  left_goal_area_bottom: { X: 5.5, Y: 43.15, label: 'Left Goal Area Bottom' },
  left_goal_top: { X: 0, Y: 30.34, label: 'Left Goal Post Top' },
  left_goal_bottom: { X: 0, Y: 37.66, label: 'Left Goal Post Bottom' },
  
  // Right penalty area
  right_penalty_top: { X: 88.5, Y: 13.85, label: 'Right Penalty Top' },
  right_penalty_bottom: { X: 88.5, Y: 54.15, label: 'Right Penalty Bottom' },
  right_penalty_spot: { X: 94, Y: 34, label: 'Right Penalty Spot' },
  right_goal_area_top: { X: 99.5, Y: 24.85, label: 'Right Goal Area Top' },
  right_goal_area_bottom: { X: 99.5, Y: 43.15, label: 'Right Goal Area Bottom' },
  right_goal_top: { X: 105, Y: 30.34, label: 'Right Goal Post Top' },
  right_goal_bottom: { X: 105, Y: 37.66, label: 'Right Goal Post Bottom' },
  
  // Additional penalty box corners
  left_penalty_box_tl: { X: 0, Y: 13.85, label: 'Left Penalty Box TL' },
  left_penalty_box_tr: { X: 16.5, Y: 13.85, label: 'Left Penalty Box TR' },
  left_penalty_box_bl: { X: 0, Y: 54.15, label: 'Left Penalty Box BL' },
  left_penalty_box_br: { X: 16.5, Y: 54.15, label: 'Left Penalty Box BR' },
  
  right_penalty_box_tl: { X: 88.5, Y: 13.85, label: 'Right Penalty Box TL' },
  right_penalty_box_tr: { X: 105, Y: 13.85, label: 'Right Penalty Box TR' },
  right_penalty_box_bl: { X: 88.5, Y: 54.15, label: 'Right Penalty Box BL' },
  right_penalty_box_br: { X: 105, Y: 54.15, label: 'Right Penalty Box BR' },
  
  // Goal area corners (6-yard box)
  left_goal_area_tl: { X: 0, Y: 24.85, label: 'Left Goal Area TL' },
  left_goal_area_tr: { X: 5.5, Y: 24.85, label: 'Left Goal Area TR' },
  left_goal_area_bl: { X: 0, Y: 43.15, label: 'Left Goal Area BL' },
  left_goal_area_br: { X: 5.5, Y: 43.15, label: 'Left Goal Area BR' },
  
  right_goal_area_tl: { X: 99.5, Y: 24.85, label: 'Right Goal Area TL' },
  right_goal_area_tr: { X: 105, Y: 24.85, label: 'Right Goal Area TR' },
  right_goal_area_bl: { X: 99.5, Y: 43.15, label: 'Right Goal Area BL' },
  right_goal_area_br: { X: 105, Y: 43.15, label: 'Right Goal Area BR' },
};

// Get pitch zone from coordinates
export function getPitchZone(X: number, Y: number): string {
  const thirdLength = PITCH_DIMENSIONS.length / 3;
  const thirdWidth = PITCH_DIMENSIONS.width / 3;
  
  let horizontal: string;
  if (X < thirdLength) horizontal = 'Defensive';
  else if (X < thirdLength * 2) horizontal = 'Middle';
  else horizontal = 'Attacking';
  
  let vertical: string;
  if (Y < thirdWidth) vertical = 'Left';
  else if (Y < thirdWidth * 2) vertical = 'Central';
  else vertical = 'Right';
  
  return `${horizontal} ${vertical}`;
}

// Check if coordinates are within pitch bounds
export function isWithinPitch(X: number, Y: number): boolean {
  return X >= 0 && X <= PITCH_DIMENSIONS.length && Y >= 0 && Y <= PITCH_DIMENSIONS.width;
}

// Get distance from nearest goal
export function getDistanceFromGoal(X: number, Y: number, side: 'left' | 'right' = 'left'): number {
  const goalX = side === 'left' ? 0 : PITCH_DIMENSIONS.length;
  const goalY = PITCH_DIMENSIONS.width / 2;
  return Math.sqrt(Math.pow(X - goalX, 2) + Math.pow(Y - goalY, 2));
}
