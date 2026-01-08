import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Hand, Grid3X3, Maximize2 } from 'lucide-react';
import { useState } from 'react';

export interface PitchControlPoint {
  id: string;
  label: string;
  // Original pitch coordinates (default position)
  pitchX: number;
  pitchZ: number;
  // Adjusted position (after user manipulation)
  adjustedX?: number;
  adjustedZ?: number;
}

interface DirectPitchManipulationProps {
  isManipulating: boolean;
  onToggleManipulating: () => void;
  controlPoints: PitchControlPoint[];
  activePointId: string | null;
  onSetActivePoint: (id: string | null) => void;
  onUpdatePoint: (id: string, pitchX: number, pitchZ: number) => void;
  onResetPoint: (id: string) => void;
  onResetAll: () => void;
  onAddGridPoints: () => void;
}

export function DirectPitchManipulation({
  isManipulating,
  onToggleManipulating,
  controlPoints,
  activePointId,
  onSetActivePoint,
  onUpdatePoint,
  onResetPoint,
  onResetAll,
  onAddGridPoints,
}: DirectPitchManipulationProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const corners = controlPoints.filter(p => p.label.includes('Corner'));
  const edges = controlPoints.filter(p => p.label.includes('Edge') && !p.label.includes('Corner'));
  const others = controlPoints.filter(p => !p.label.includes('Corner') && !p.label.includes('Edge'));

  const isAdjusted = (point: PitchControlPoint) => 
    point.adjustedX !== undefined || point.adjustedZ !== undefined;

  const adjustedCount = controlPoints.filter(isAdjusted).length;

  return (
    <div className="space-y-3 p-3 rounded-md border border-border">
      <div className="flex items-center justify-between">
        <Label className="text-[11px] font-semibold text-foreground flex items-center gap-1.5">
          <Hand className="h-3.5 w-3.5" />
          Direct Pitch Manipulation
        </Label>
        {adjustedCount > 0 && (
          <span className="text-[9px] text-primary font-medium px-2 py-0.5 bg-primary/10 rounded">
            {adjustedCount} adjusted
          </span>
        )}
      </div>

      <p className="text-[9px] text-muted-foreground leading-tight">
        Click control points on the pitch, then drag them to align with the video
      </p>

      {/* Main toggle button */}
      <Button
        onClick={onToggleManipulating}
        variant={isManipulating ? 'default' : 'outline'}
        className="w-full h-8 text-[10px]"
      >
        <Hand className="h-3 w-3 mr-1.5" />
        {isManipulating ? 'Finish Manipulation' : 'Start Manipulation'}
      </Button>

      {isManipulating && (
        <div className="space-y-3">
          {/* Instructions */}
          <div className="p-2 bg-muted/50 rounded text-[9px] text-muted-foreground space-y-1">
            <p><strong className="text-foreground">Step 1:</strong> Select a control point below</p>
            <p><strong className="text-foreground">Step 2:</strong> Click on the 3D pitch where it should move</p>
            <p><strong className="text-foreground">Step 3:</strong> Repeat for other points</p>
          </div>

          {/* Corner Points - Most Important */}
          {corners.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-[9px] text-muted-foreground font-semibold flex items-center gap-1">
                <Maximize2 className="h-3 w-3" />
                Corner Points (Priority)
              </Label>
              <div className="grid grid-cols-2 gap-1.5">
                {corners.map((point) => {
                  const isActive = activePointId === point.id;
                  const isModified = isAdjusted(point);
                  return (
                    <div key={point.id} className="flex gap-1">
                      <Button
                        onClick={() => onSetActivePoint(isActive ? null : point.id)}
                        variant={isActive ? 'default' : 'outline'}
                        className={`flex-1 h-7 text-[9px] justify-between ${
                          isModified ? 'border-primary/50' : ''
                        }`}
                      >
                        <span>{point.label.replace('Corner', '').trim()}</span>
                        {isModified && <span className="text-[8px]">✓</span>}
                      </Button>
                      {isModified && (
                        <Button
                          onClick={() => onResetPoint(point.id)}
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                          title="Reset this point"
                        >
                          ↺
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Edge Points */}
          {edges.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-[9px] text-muted-foreground font-semibold flex items-center gap-1">
                  Edge Points
                </Label>
                <button
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="text-[8px] text-primary hover:underline"
                >
                  {showAdvanced ? 'Hide' : 'Show'}
                </button>
              </div>
              {showAdvanced && (
                <div className="grid grid-cols-2 gap-1.5">
                  {edges.map((point) => {
                    const isActive = activePointId === point.id;
                    const isModified = isAdjusted(point);
                    return (
                      <div key={point.id} className="flex gap-1">
                        <Button
                          onClick={() => onSetActivePoint(isActive ? null : point.id)}
                          variant={isActive ? 'default' : 'outline'}
                          className={`flex-1 h-6 text-[8px] justify-between ${
                            isModified ? 'border-primary/50' : ''
                          }`}
                        >
                          <span className="truncate">{point.label}</span>
                          {isModified && <span className="text-[7px]">✓</span>}
                        </Button>
                        {isModified && (
                          <Button
                            onClick={() => onResetPoint(point.id)}
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-[8px] text-muted-foreground hover:text-foreground"
                          >
                            ↺
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Grid/Interior Points */}
          {others.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-[9px] text-muted-foreground font-semibold">
                Interior Points ({others.length})
              </Label>
              <div className="grid grid-cols-3 gap-1">
                {others.slice(0, 12).map((point) => {
                  const isActive = activePointId === point.id;
                  const isModified = isAdjusted(point);
                  return (
                    <Button
                      key={point.id}
                      onClick={() => onSetActivePoint(isActive ? null : point.id)}
                      variant={isActive ? 'default' : 'outline'}
                      className={`h-6 text-[8px] p-1 ${
                        isModified ? 'border-primary/50 font-semibold' : ''
                      }`}
                    >
                      {isModified ? '✓' : '○'}
                    </Button>
                  );
                })}
              </div>
              {others.length > 12 && (
                <p className="text-[8px] text-muted-foreground text-center">
                  +{others.length - 12} more points
                </p>
              )}
            </div>
          )}

          {/* Add Grid Points Button */}
          {controlPoints.length < 20 && (
            <Button
              onClick={onAddGridPoints}
              variant="outline"
              className="w-full h-6 text-[9px]"
            >
              <Grid3X3 className="h-3 w-3 mr-1" />
              Add Grid Points (Better Warping)
            </Button>
          )}

          {/* Reset All Button */}
          {adjustedCount > 0 && (
            <Button
              onClick={onResetAll}
              variant="ghost"
              className="w-full h-6 text-[9px] text-destructive hover:text-destructive"
            >
              Reset All Points ({adjustedCount})
            </Button>
          )}

          {/* Active Point Display */}
          {activePointId && (
            <div className="p-2 bg-primary/10 border border-primary/30 rounded text-[9px]">
              <p className="font-semibold text-foreground">
                Active: {controlPoints.find(p => p.id === activePointId)?.label}
              </p>
              <p className="text-muted-foreground mt-0.5">
                Click on the pitch to move this point
              </p>
            </div>
          )}
        </div>
      )}

      {!isManipulating && adjustedCount > 0 && (
        <div className="text-[9px] text-muted-foreground text-center">
          Pitch is currently warped with {adjustedCount} control point{adjustedCount !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}

// Default control points for pitch manipulation
export const DEFAULT_PITCH_CONTROL_POINTS: PitchControlPoint[] = [
  // Four corners (most important)
  { id: 'corner-tl', label: 'Top-Left Corner', pitchX: -52.5, pitchZ: -34 },
  { id: 'corner-tr', label: 'Top-Right Corner', pitchX: 52.5, pitchZ: -34 },
  { id: 'corner-bl', label: 'Bottom-Left Corner', pitchX: -52.5, pitchZ: 34 },
  { id: 'corner-br', label: 'Bottom-Right Corner', pitchX: 52.5, pitchZ: 34 },
  
  // Edge midpoints (for fine-tuning)
  { id: 'edge-top', label: 'Top Edge Center', pitchX: 0, pitchZ: -34 },
  { id: 'edge-bottom', label: 'Bottom Edge Center', pitchX: 0, pitchZ: 34 },
  { id: 'edge-left', label: 'Left Edge Center', pitchX: -52.5, pitchZ: 0 },
  { id: 'edge-right', label: 'Right Edge Center', pitchX: 52.5, pitchZ: 0 },
];

// Generate a denser grid for more precise warping
export function generateGridControlPoints(density: 'low' | 'medium' | 'high' = 'medium'): PitchControlPoint[] {
  const points: PitchControlPoint[] = [...DEFAULT_PITCH_CONTROL_POINTS];
  
  const divisions = density === 'low' ? 3 : density === 'medium' ? 5 : 7;
  const width = 105;
  const height = 68;
  
  for (let i = 1; i < divisions; i++) {
    for (let j = 1; j < divisions; j++) {
      const x = -width/2 + (width / divisions) * i;
      const z = -height/2 + (height / divisions) * j;
      points.push({
        id: `grid-${i}-${j}`,
        label: `Grid ${i},${j}`,
        pitchX: x,
        pitchZ: z,
      });
    }
  }
  
  return points;
}
