import { useEffect, useRef, useMemo } from 'react';
import { PITCH_DIMENSIONS } from '@/utils/pitchConstants';
import { VideoCoord } from '@/types/calibration';

interface PitchGridOverlayProps {
  width: number;
  height: number;
  inverseMatrix: number[][] | null;
  showGrid?: boolean;
  showLines?: boolean;
  opacity?: number;
}

// Transform pitch coordinates to video coordinates
function pitchToVideo(X: number, Y: number, H_inv: number[][]): VideoCoord {
  const w = H_inv[2][0] * X + H_inv[2][1] * Y + H_inv[2][2];
  const x = (H_inv[0][0] * X + H_inv[0][1] * Y + H_inv[0][2]) / w;
  const y = (H_inv[1][0] * X + H_inv[1][1] * Y + H_inv[1][2]) / w;
  return { x, y };
}

// Generate pitch line segments
function generatePitchLines(pitchLength: number, pitchWidth: number) {
  const lines: { start: { X: number; Y: number }; end: { X: number; Y: number }; color: string }[] = [];
  
  const mainColor = 'rgba(255, 255, 255, 0.7)';
  const boxColor = 'rgba(255, 255, 255, 0.6)';
  
  // Pitch outline
  lines.push({ start: { X: 0, Y: 0 }, end: { X: pitchLength, Y: 0 }, color: mainColor });
  lines.push({ start: { X: pitchLength, Y: 0 }, end: { X: pitchLength, Y: pitchWidth }, color: mainColor });
  lines.push({ start: { X: pitchLength, Y: pitchWidth }, end: { X: 0, Y: pitchWidth }, color: mainColor });
  lines.push({ start: { X: 0, Y: pitchWidth }, end: { X: 0, Y: 0 }, color: mainColor });
  
  // Center line
  lines.push({ start: { X: pitchLength / 2, Y: 0 }, end: { X: pitchLength / 2, Y: pitchWidth }, color: mainColor });
  
  // Left penalty box (16.5m from goal line, 40.3m wide centered)
  const penaltyDepth = 16.5;
  const penaltyWidth = 40.32;
  const penaltyTop = (pitchWidth - penaltyWidth) / 2;
  const penaltyBottom = penaltyTop + penaltyWidth;
  
  // Left penalty box
  lines.push({ start: { X: 0, Y: penaltyTop }, end: { X: penaltyDepth, Y: penaltyTop }, color: boxColor });
  lines.push({ start: { X: penaltyDepth, Y: penaltyTop }, end: { X: penaltyDepth, Y: penaltyBottom }, color: boxColor });
  lines.push({ start: { X: penaltyDepth, Y: penaltyBottom }, end: { X: 0, Y: penaltyBottom }, color: boxColor });
  
  // Right penalty box
  lines.push({ start: { X: pitchLength, Y: penaltyTop }, end: { X: pitchLength - penaltyDepth, Y: penaltyTop }, color: boxColor });
  lines.push({ start: { X: pitchLength - penaltyDepth, Y: penaltyTop }, end: { X: pitchLength - penaltyDepth, Y: penaltyBottom }, color: boxColor });
  lines.push({ start: { X: pitchLength - penaltyDepth, Y: penaltyBottom }, end: { X: pitchLength, Y: penaltyBottom }, color: boxColor });
  
  // Goal boxes (5.5m from goal line, 18.32m wide centered)
  const goalBoxDepth = 5.5;
  const goalBoxWidth = 18.32;
  const goalBoxTop = (pitchWidth - goalBoxWidth) / 2;
  const goalBoxBottom = goalBoxTop + goalBoxWidth;
  
  // Left goal box
  lines.push({ start: { X: 0, Y: goalBoxTop }, end: { X: goalBoxDepth, Y: goalBoxTop }, color: boxColor });
  lines.push({ start: { X: goalBoxDepth, Y: goalBoxTop }, end: { X: goalBoxDepth, Y: goalBoxBottom }, color: boxColor });
  lines.push({ start: { X: goalBoxDepth, Y: goalBoxBottom }, end: { X: 0, Y: goalBoxBottom }, color: boxColor });
  
  // Right goal box
  lines.push({ start: { X: pitchLength, Y: goalBoxTop }, end: { X: pitchLength - goalBoxDepth, Y: goalBoxTop }, color: boxColor });
  lines.push({ start: { X: pitchLength - goalBoxDepth, Y: goalBoxTop }, end: { X: pitchLength - goalBoxDepth, Y: goalBoxBottom }, color: boxColor });
  lines.push({ start: { X: pitchLength - goalBoxDepth, Y: goalBoxBottom }, end: { X: pitchLength, Y: goalBoxBottom }, color: boxColor });
  
  return lines;
}

export function PitchGridOverlay({
  width,
  height,
  inverseMatrix,
  showGrid = true,
  showLines = true,
  opacity = 0.8,
}: PitchGridOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const pitchLines = useMemo(
    () => generatePitchLines(PITCH_DIMENSIONS.length, PITCH_DIMENSIONS.width),
    []
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !inverseMatrix) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    ctx.globalAlpha = opacity;

    // Draw pitch lines
    if (showLines) {
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      pitchLines.forEach(line => {
        try {
          const start = pitchToVideo(line.start.X, line.start.Y, inverseMatrix);
          const end = pitchToVideo(line.end.X, line.end.Y, inverseMatrix);

          // Check if points are within reasonable bounds
          if (
            isFinite(start.x) && isFinite(start.y) &&
            isFinite(end.x) && isFinite(end.y) &&
            Math.abs(start.x) < width * 3 && Math.abs(start.y) < height * 3 &&
            Math.abs(end.x) < width * 3 && Math.abs(end.y) < height * 3
          ) {
            ctx.strokeStyle = line.color;
            ctx.beginPath();
            ctx.moveTo(start.x, start.y);
            ctx.lineTo(end.x, end.y);
            ctx.stroke();
          }
        } catch (e) {
          // Skip invalid transformations
        }
      });

      // Draw center circle
      try {
        const centerRadius = 9.15; // meters
        const segments = 32;
        const centerX = PITCH_DIMENSIONS.length / 2;
        const centerY = PITCH_DIMENSIONS.width / 2;

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.beginPath();

        for (let i = 0; i <= segments; i++) {
          const angle = (i / segments) * Math.PI * 2;
          const px = centerX + Math.cos(angle) * centerRadius;
          const py = centerY + Math.sin(angle) * centerRadius;
          const point = pitchToVideo(px, py, inverseMatrix);

          if (isFinite(point.x) && isFinite(point.y)) {
            if (i === 0) {
              ctx.moveTo(point.x, point.y);
            } else {
              ctx.lineTo(point.x, point.y);
            }
          }
        }
        ctx.stroke();

        // Center spot
        const centerSpot = pitchToVideo(centerX, centerY, inverseMatrix);
        if (isFinite(centerSpot.x) && isFinite(centerSpot.y)) {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
          ctx.beginPath();
          ctx.arc(centerSpot.x, centerSpot.y, 4, 0, Math.PI * 2);
          ctx.fill();
        }

        // Penalty spots
        const leftPenalty = pitchToVideo(11, PITCH_DIMENSIONS.width / 2, inverseMatrix);
        const rightPenalty = pitchToVideo(PITCH_DIMENSIONS.length - 11, PITCH_DIMENSIONS.width / 2, inverseMatrix);
        
        [leftPenalty, rightPenalty].forEach(spot => {
          if (isFinite(spot.x) && isFinite(spot.y)) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.beginPath();
            ctx.arc(spot.x, spot.y, 3, 0, Math.PI * 2);
            ctx.fill();
          }
        });
      } catch (e) {
        // Skip if transformation fails
      }
    }

    // Draw grid
    if (showGrid) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 1;

      // Horizontal grid lines (every 10 meters)
      for (let y = 10; y < PITCH_DIMENSIONS.width; y += 10) {
        try {
          const start = pitchToVideo(0, y, inverseMatrix);
          const end = pitchToVideo(PITCH_DIMENSIONS.length, y, inverseMatrix);

          if (
            isFinite(start.x) && isFinite(start.y) &&
            isFinite(end.x) && isFinite(end.y)
          ) {
            ctx.beginPath();
            ctx.moveTo(start.x, start.y);
            ctx.lineTo(end.x, end.y);
            ctx.stroke();
          }
        } catch (e) {}
      }

      // Vertical grid lines (every 10 meters)
      for (let x = 10; x < PITCH_DIMENSIONS.length; x += 10) {
        if (x === PITCH_DIMENSIONS.length / 2) continue; // Skip center line

        try {
          const start = pitchToVideo(x, 0, inverseMatrix);
          const end = pitchToVideo(x, PITCH_DIMENSIONS.width, inverseMatrix);

          if (
            isFinite(start.x) && isFinite(start.y) &&
            isFinite(end.x) && isFinite(end.y)
          ) {
            ctx.beginPath();
            ctx.moveTo(start.x, start.y);
            ctx.lineTo(end.x, end.y);
            ctx.stroke();
          }
        } catch (e) {}
      }
    }
  }, [width, height, inverseMatrix, showGrid, showLines, opacity, pitchLines]);

  if (!inverseMatrix) return null;

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="absolute inset-0 pointer-events-none z-10"
      style={{ mixBlendMode: 'screen' }}
    />
  );
}
