import { useMemo } from 'react';
import { Annotation, Vector3 } from '@/types/analysis';

export type HeatmapType = 'none' | 'player_positions' | 'ball_movement' | 'all_activity';

interface HeatmapOverlayProps {
  annotations: Annotation[];
  heatmapType: HeatmapType;
  pitchWidth: number;
  pitchHeight: number;
}

interface HeatmapCell {
  x: number;
  z: number;
  intensity: number;
}

export function HeatmapOverlay({
  annotations,
  heatmapType,
  pitchWidth,
  pitchHeight,
}: HeatmapOverlayProps) {
  const heatmapData = useMemo(() => {
    if (heatmapType === 'none') return [];

    const gridSize = 10; // meters per cell
    const cols = Math.ceil(pitchWidth / gridSize);
    const rows = Math.ceil(pitchHeight / gridSize);
    const grid: number[][] = Array(rows).fill(null).map(() => Array(cols).fill(0));

    // Filter relevant annotations based on heatmap type
    let relevantAnnotations = annotations;
    if (heatmapType === 'player_positions') {
      relevantAnnotations = annotations.filter(a => a.type === 'player');
    } else if (heatmapType === 'ball_movement') {
      relevantAnnotations = annotations.filter(a => 
        ['arrow', 'curve', 'freehand', 'through_ball', 'cross', 'switch_play'].includes(a.type)
      );
    }

    // Accumulate positions
    relevantAnnotations.forEach(annotation => {
      const addToGrid = (pos: Vector3) => {
        const col = Math.floor((pos.x + pitchWidth / 2) / gridSize);
        const row = Math.floor((pos.z + pitchHeight / 2) / gridSize);
        if (col >= 0 && col < cols && row >= 0 && row < rows) {
          grid[row][col] += 1;
        }
      };

      addToGrid(annotation.position);
      
      if (annotation.endPosition) {
        addToGrid(annotation.endPosition);
        // Add interpolated points along the path
        const steps = 5;
        for (let i = 1; i < steps; i++) {
          const t = i / steps;
          addToGrid({
            x: annotation.position.x + (annotation.endPosition.x - annotation.position.x) * t,
            y: 0,
            z: annotation.position.z + (annotation.endPosition.z - annotation.position.z) * t,
          });
        }
      }

      if (annotation.points) {
        annotation.points.forEach(p => addToGrid(p));
      }
    });

    // Normalize and convert to cell data
    const maxIntensity = Math.max(...grid.flat(), 1);
    const cells: HeatmapCell[] = [];

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        if (grid[row][col] > 0) {
          cells.push({
            x: -pitchWidth / 2 + col * gridSize + gridSize / 2,
            z: -pitchHeight / 2 + row * gridSize + gridSize / 2,
            intensity: grid[row][col] / maxIntensity,
          });
        }
      }
    }

    return cells;
  }, [annotations, heatmapType, pitchWidth, pitchHeight]);

  return { heatmapData };
}

// Color gradient for heatmap
export function getHeatmapColor(intensity: number): string {
  // Blue -> Cyan -> Green -> Yellow -> Red
  if (intensity < 0.25) {
    const t = intensity / 0.25;
    return `hsl(${200 + t * 20}, 100%, ${40 + t * 10}%)`;
  } else if (intensity < 0.5) {
    const t = (intensity - 0.25) / 0.25;
    return `hsl(${120 + (1 - t) * 100}, 100%, ${50 + t * 10}%)`;
  } else if (intensity < 0.75) {
    const t = (intensity - 0.5) / 0.25;
    return `hsl(${60 + (1 - t) * 60}, 100%, 50%)`;
  } else {
    const t = (intensity - 0.75) / 0.25;
    return `hsl(${60 - t * 60}, 100%, ${50 - t * 10}%)`;
  }
}
