import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MapPin, Target, Wand2, X, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { PITCH_REFERENCE_POINTS } from './SOTAPitch';

export interface CalibrationPoint {
  id: string;
  label: string;
  pitchX: number; // Known pitch coordinate
  pitchZ: number;
  screenX?: number; // User-placed screen coordinate
  screenY?: number;
}

interface PointCalibrationProps {
  isActive: boolean;
  onToggle: () => void;
  points: CalibrationPoint[];
  activePointId: string | null;
  onSetActivePoint: (id: string | null) => void;
  onAddPoint: (point: CalibrationPoint) => void;
  onRemovePoint: (id: string) => void;
  onClearPoints: () => void;
  onAutoCalibrate: () => void;
}

// Categorized reference points
const POINT_CATEGORIES = [
  {
    label: 'Corners',
    points: ['corner_tl', 'corner_tr', 'corner_bl', 'corner_br'],
  },
  {
    label: 'Center',
    points: ['center', 'center_left', 'center_right', 'center_top', 'center_bottom'],
  },
  {
    label: 'Penalty Spots',
    points: ['penalty_left', 'penalty_right'],
  },
  {
    label: 'Left Penalty Box',
    points: ['penalty_left_tl', 'penalty_left_tr', 'penalty_left_bl', 'penalty_left_br'],
  },
  {
    label: 'Right Penalty Box',
    points: ['penalty_right_tl', 'penalty_right_tr', 'penalty_right_bl', 'penalty_right_br'],
  },
  {
    label: 'Left Goal Box',
    points: ['goalbox_left_tl', 'goalbox_left_tr', 'goalbox_left_bl', 'goalbox_left_br'],
  },
  {
    label: 'Right Goal Box',
    points: ['goalbox_right_tl', 'goalbox_right_tr', 'goalbox_right_bl', 'goalbox_right_br'],
  },
  {
    label: 'Goals',
    points: ['goal_left_tl', 'goal_left_bl', 'goal_right_tl', 'goal_right_bl'],
  },
];

export function PointCalibration({
  isActive,
  onToggle,
  points,
  activePointId,
  onSetActivePoint,
  onAddPoint,
  onRemovePoint,
  onClearPoints,
  onAutoCalibrate,
}: PointCalibrationProps) {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  
  const setPoints = points.filter(p => p.screenX !== undefined);
  const canCalibrate = setPoints.length >= 4;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
          <Target className="h-3 w-3" />
          Reference Point Calibration
        </Label>
        <Button
          variant={isActive ? "default" : "outline"}
          size="sm"
          onClick={onToggle}
          className="h-6 text-[9px]"
        >
          {isActive ? 'Done' : 'Start'}
        </Button>
      </div>

      {isActive && (
        <div className="space-y-2 p-2 bg-muted/50 rounded-md">
          <p className="text-[9px] text-muted-foreground">
            Select reference points from the pitch and click where they appear on the video. Need at least 4 points.
          </p>

          {/* Active points summary */}
          {setPoints.length > 0 && (
            <div className="flex flex-wrap gap-1 p-1 bg-background/50 rounded">
              {setPoints.map(point => (
                <div
                  key={point.id}
                  className="flex items-center gap-0.5 bg-primary/20 text-primary px-1.5 py-0.5 rounded text-[8px]"
                >
                  <MapPin className="h-2 w-2" />
                  <span className="truncate max-w-[60px]">{point.label}</span>
                  <button
                    onClick={() => onRemovePoint(point.id)}
                    className="hover:text-destructive"
                  >
                    <X className="h-2 w-2" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Reference point selector */}
          <ScrollArea className="h-40">
            <div className="space-y-1">
              {POINT_CATEGORIES.map(category => {
                const isExpanded = expandedCategory === category.label;
                const categoryPoints = PITCH_REFERENCE_POINTS.filter(p => 
                  category.points.includes(p.id)
                );
                const setInCategory = points.filter(p => 
                  category.points.includes(p.id) && p.screenX !== undefined
                ).length;

                return (
                  <div key={category.label}>
                    <button
                      onClick={() => setExpandedCategory(isExpanded ? null : category.label)}
                      className="w-full flex items-center justify-between p-1.5 bg-background/70 hover:bg-background rounded text-[9px] font-medium"
                    >
                      <span>{category.label}</span>
                      <div className="flex items-center gap-1">
                        {setInCategory > 0 && (
                          <span className="text-primary text-[8px]">{setInCategory} set</span>
                        )}
                        {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      </div>
                    </button>
                    
                    {isExpanded && (
                      <div className="grid grid-cols-2 gap-0.5 mt-1 pl-2">
                        {categoryPoints.map(refPoint => {
                          const existingPoint = points.find(p => p.id === refPoint.id);
                          const isSet = existingPoint?.screenX !== undefined;
                          const isActivePoint = activePointId === refPoint.id;

                          return (
                            <Button
                              key={refPoint.id}
                              variant={isActivePoint ? "default" : isSet ? "secondary" : "outline"}
                              size="sm"
                              onClick={() => {
                                if (!existingPoint) {
                                  onAddPoint({
                                    id: refPoint.id,
                                    label: refPoint.label,
                                    pitchX: refPoint.x,
                                    pitchZ: refPoint.z,
                                  });
                                }
                                onSetActivePoint(isActivePoint ? null : refPoint.id);
                              }}
                              className={`h-6 text-[8px] justify-start gap-1 ${isSet ? 'border-primary/50' : ''}`}
                            >
                              <MapPin className="h-2 w-2 flex-shrink-0" />
                              <span className="truncate">{refPoint.label.split(' ').slice(-2).join(' ')}</span>
                              {isSet && <span className="text-primary ml-auto">✓</span>}
                            </Button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>

          {/* Action buttons */}
          <div className="flex gap-1">
            {canCalibrate && (
              <Button
                variant="default"
                size="sm"
                onClick={onAutoCalibrate}
                className="flex-1 h-7 text-[9px] gap-1"
              >
                <Wand2 className="h-3 w-3" />
                Calibrate ({setPoints.length} pts)
              </Button>
            )}
            {setPoints.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClearPoints}
                className="h-7 text-[9px] text-muted-foreground"
              >
                Clear All
              </Button>
            )}
          </div>

          {!canCalibrate && setPoints.length > 0 && (
            <p className="text-[8px] text-muted-foreground text-center">
              Need {4 - setPoints.length} more point{4 - setPoints.length > 1 ? 's' : ''} to calibrate
            </p>
          )}
        </div>
      )}
    </div>
  );
}
