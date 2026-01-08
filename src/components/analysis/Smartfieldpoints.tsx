import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { MapPin, Check, RotateCcw, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useState } from 'react';

export interface FieldPoint {
  id: string;
  label: string;
  description: string;
  // Screen coordinates (where user clicked on video)
  screenX?: number;
  screenY?: number;
  // Known pitch coordinates (meters from center)
  pitchX: number;
  pitchZ: number;
  category: 'corner' | 'edge' | 'penalty' | 'center' | 'box';
  priority: 'required' | 'recommended' | 'optional';
  isVisible?: boolean; // User can mark if visible
}

interface SmartFieldPointsProps {
  isActive: boolean;
  onToggle: () => void;
  fieldPoints: FieldPoint[];
  activePointId: string | null;
  onSetActivePoint: (id: string | null) => void;
  onUpdatePoint: (id: string, screenX: number, screenY: number) => void;
  onResetPoints: () => void;
  onToggleVisibility: (id: string) => void;
}

export function SmartFieldPoints({
  isActive,
  onToggle,
  fieldPoints,
  activePointId,
  onSetActivePoint,
  onUpdatePoint,
  onResetPoints,
  onToggleVisibility,
}: SmartFieldPointsProps) {
  const [showAll, setShowAll] = useState(false);

  // Filter points by visibility
  const visiblePoints = fieldPoints.filter(p => p.isVisible !== false);
  const hiddenPoints = fieldPoints.filter(p => p.isVisible === false);
  
  const setCount = visiblePoints.filter(p => p.screenX !== undefined).length;
  const requiredVisible = visiblePoints.filter(p => p.priority === 'required');
  const requiredSet = requiredVisible.filter(p => p.screenX !== undefined).length;
  
  const canDraw = requiredSet >= Math.min(3, requiredVisible.length);

  // Group by category
  const corners = visiblePoints.filter(p => p.category === 'corner');
  const edges = visiblePoints.filter(p => p.category === 'edge');
  const penalties = visiblePoints.filter(p => p.category === 'penalty');
  const boxes = visiblePoints.filter(p => p.category === 'box');
  const center = visiblePoints.filter(p => p.category === 'center');

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'corner': return 'text-red-500';
      case 'edge': return 'text-blue-500';
      case 'penalty': return 'text-yellow-500';
      case 'box': return 'text-purple-500';
      case 'center': return 'text-green-500';
      default: return 'text-muted-foreground';
    }
  };

  const renderPointButton = (point: FieldPoint) => {
    const isSet = point.screenX !== undefined;
    const isActive = activePointId === point.id;
    
    return (
      <div key={point.id} className="flex gap-1 items-center">
        <Button
          onClick={() => onSetActivePoint(isActive ? null : point.id)}
          variant={isActive ? 'default' : 'outline'}
          className={`flex-1 h-7 text-[8px] justify-between px-2 ${
            isSet ? 'border-primary/50 bg-primary/5' : ''
          }`}
        >
          <span className="truncate flex items-center gap-1">
            <span className={`w-1.5 h-1.5 rounded-full ${getCategoryColor(point.category)} bg-current`} />
            {point.label}
          </span>
          {isSet && <Check className="h-2.5 w-2.5 text-primary ml-1 flex-shrink-0" />}
        </Button>
        <Button
          onClick={() => onToggleVisibility(point.id)}
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          title={point.isVisible === false ? 'Not visible - click to show' : 'Visible - click to hide'}
        >
          {point.isVisible === false ? (
            <EyeOff className="h-3 w-3 text-muted-foreground" />
          ) : (
            <Eye className="h-3 w-3 text-muted-foreground" />
          )}
        </Button>
      </div>
    );
  };

  return (
    <div className="space-y-3 p-3 rounded-md border-2 border-primary/20 bg-primary/5">
      <div className="flex items-center justify-between">
        <Label className="text-[11px] font-semibold text-foreground flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 text-primary" />
          Smart Field Mapping
        </Label>
        {setCount > 0 && (
          <span className="text-[9px] text-primary font-medium px-2 py-0.5 bg-primary/10 rounded">
            {setCount} points
          </span>
        )}
      </div>

      <div className="p-2 bg-blue-500/10 border border-blue-500/30 rounded text-[9px] text-blue-600 dark:text-blue-400 flex items-start gap-2">
        <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
        <div>
          <p className="font-semibold">Only mark points you can see clearly!</p>
          <p className="text-[8px] mt-0.5 opacity-80">Use the eye icon to hide points not visible in your view</p>
        </div>
      </div>

      {/* Main toggle button */}
      <Button
        onClick={onToggle}
        variant={isActive ? 'default' : 'outline'}
        className="w-full h-8 text-[10px]"
      >
        <MapPin className="h-3 w-3 mr-1.5" />
        {isActive ? 'Exit Mapping Mode' : 'Start Field Mapping'}
      </Button>

      {isActive && (
        <div className="space-y-3">
          {/* Status */}
          <div className={`p-2 rounded text-[9px] ${
            canDraw 
              ? 'bg-green-500/10 border border-green-500/30 text-green-600 dark:text-green-400' 
              : 'bg-muted/50 text-muted-foreground border border-border'
          }`}>
            {canDraw ? (
              <div className="flex items-center gap-2">
                <Check className="h-3 w-3" />
                <span className="font-semibold">Ready! Pitch will draw automatically</span>
              </div>
            ) : (
              <div>
                <p className="font-semibold mb-1">
                  Mark {Math.min(3, requiredVisible.length) - requiredSet} more visible point{Math.min(3, requiredVisible.length) - requiredSet !== 1 ? 's' : ''}
                </p>
                <p className="text-[8px] opacity-80">Click a point below, then click where it is in the video</p>
              </div>
            )}
          </div>

          {/* Corners - Always important */}
          {corners.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-[9px] font-semibold flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-red-500" />
                  Corners ({corners.filter(p => p.screenX !== undefined).length}/{corners.length})
                </span>
                <span className="text-[8px] font-normal text-muted-foreground">
                  Mark any visible corners
                </span>
              </Label>
              <div className="grid grid-cols-2 gap-1">
                {corners.map(renderPointButton)}
              </div>
            </div>
          )}

          {/* Edges */}
          {edges.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-[9px] font-semibold flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  Edge Points ({edges.filter(p => p.screenX !== undefined).length}/{edges.length})
                </span>
              </Label>
              <div className="grid grid-cols-2 gap-1">
                {edges.map(renderPointButton)}
              </div>
            </div>
          )}

          {/* Penalty & Center - If visible */}
          {(penalties.length > 0 || center.length > 0) && (
            <div className="space-y-1.5">
              <Label className="text-[9px] font-semibold flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-yellow-500" />
                Key Landmarks
              </Label>
              <div className="grid grid-cols-2 gap-1">
                {[...penalties, ...center].map(renderPointButton)}
              </div>
            </div>
          )}

          {/* Penalty Boxes - Advanced */}
          {boxes.length > 0 && setCount >= 4 && (
            <div className="space-y-1.5">
              <Label className="text-[9px] font-semibold flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-purple-500" />
                  Box Corners (Advanced)
                </span>
                <button
                  onClick={() => setShowAll(!showAll)}
                  className="text-[8px] text-primary hover:underline"
                >
                  {showAll ? 'Hide' : 'Show'}
                </button>
              </Label>
              {showAll && (
                <div className="grid grid-cols-2 gap-1">
                  {boxes.map(renderPointButton)}
                </div>
              )}
            </div>
          )}

          {/* Hidden Points */}
          {hiddenPoints.length > 0 && (
            <div className="p-2 bg-muted/30 rounded">
              <p className="text-[8px] text-muted-foreground">
                {hiddenPoints.length} point{hiddenPoints.length !== 1 ? 's' : ''} hidden (not in view)
              </p>
            </div>
          )}

          {/* Active Point Display */}
          {activePointId && (
            <div className="p-2 bg-accent/10 border border-accent/30 rounded text-[9px]">
              <p className="font-semibold text-foreground">
                Selected: {fieldPoints.find(p => p.id === activePointId)?.label}
              </p>
              <p className="text-muted-foreground mt-0.5 text-[8px]">
                {fieldPoints.find(p => p.id === activePointId)?.description}
              </p>
              <p className="text-accent mt-1 font-medium text-[8px]">
                ▸ Click on the video where this point is located
              </p>
            </div>
          )}

          {/* Reset */}
          {setCount > 0 && (
            <div className="flex gap-1.5">
              <Button
                onClick={onResetPoints}
                variant="ghost"
                className="flex-1 h-6 text-[9px] text-destructive hover:text-destructive"
              >
                <RotateCcw className="h-3 w-3 mr-1" />
                Reset ({setCount})
              </Button>
            </div>
          )}

          {/* Quality Indicator */}
          {canDraw && (
            <div className="p-2 bg-muted/30 rounded text-[8px] space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Accuracy:</span>
                <span className={`font-semibold ${
                  setCount >= 8 ? 'text-green-500' :
                  setCount >= 5 ? 'text-yellow-500' :
                  'text-orange-500'
                }`}>
                  {setCount >= 8 ? 'Excellent' :
                   setCount >= 5 ? 'Good' :
                   'Basic'}
                </span>
              </div>
              <p className="text-muted-foreground">
                {setCount >= 8 ? '✓ Very precise alignment' :
                 setCount >= 5 ? 'Add more points for better precision' :
                 'Works, but add more points if possible'}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Smart default points - comprehensive set that user can hide
export const SMART_FIELD_POINTS: FieldPoint[] = [
  // CORNERS (4) - High priority
  { 
    id: 'corner-tl', 
    label: 'Top-L', 
    description: 'Top-left corner of the pitch',
    pitchX: -52.5, pitchZ: -34,
    category: 'corner',
    priority: 'required',
  },
  { 
    id: 'corner-tr', 
    label: 'Top-R', 
    description: 'Top-right corner of the pitch',
    pitchX: 52.5, pitchZ: -34,
    category: 'corner',
    priority: 'required',
  },
  { 
    id: 'corner-bl', 
    label: 'Bot-L', 
    description: 'Bottom-left corner of the pitch',
    pitchX: -52.5, pitchZ: 34,
    category: 'corner',
    priority: 'required',
  },
  { 
    id: 'corner-br', 
    label: 'Bot-R', 
    description: 'Bottom-right corner of the pitch',
    pitchX: 52.5, pitchZ: 34,
    category: 'corner',
    priority: 'required',
  },
  
  // EDGES (4) - Medium priority
  { 
    id: 'edge-top', 
    label: 'Top Edge', 
    description: 'Halfway line at top edge',
    pitchX: 0, pitchZ: -34,
    category: 'edge',
    priority: 'recommended',
  },
  { 
    id: 'edge-bottom', 
    label: 'Bot Edge', 
    description: 'Halfway line at bottom edge',
    pitchX: 0, pitchZ: 34,
    category: 'edge',
    priority: 'recommended',
  },
  { 
    id: 'edge-left', 
    label: 'Left Edge', 
    description: 'Left goal line at center',
    pitchX: -52.5, pitchZ: 0,
    category: 'edge',
    priority: 'recommended',
  },
  { 
    id: 'edge-right', 
    label: 'Right Edge', 
    description: 'Right goal line at center',
    pitchX: 52.5, pitchZ: 0,
    category: 'edge',
    priority: 'recommended',
  },
  
  // CENTER (1)
  { 
    id: 'center', 
    label: 'Center', 
    description: 'Center spot in the middle',
    pitchX: 0, pitchZ: 0,
    category: 'center',
    priority: 'recommended',
  },
  
  // PENALTY SPOTS (2)
  { 
    id: 'penalty-left', 
    label: 'L Penalty', 
    description: 'Left penalty spot',
    pitchX: -41.5, pitchZ: 0,
    category: 'penalty',
    priority: 'optional',
  },
  { 
    id: 'penalty-right', 
    label: 'R Penalty', 
    description: 'Right penalty spot',
    pitchX: 41.5, pitchZ: 0,
    category: 'penalty',
    priority: 'optional',
  },
  
  // PENALTY BOX CORNERS (8) - Optional for advanced accuracy
  { 
    id: 'box-left-tl', 
    label: 'L Box TL', 
    description: 'Left penalty box top-left',
    pitchX: -52.5, pitchZ: -20.16,
    category: 'box',
    priority: 'optional',
  },
  { 
    id: 'box-left-tr', 
    label: 'L Box TR', 
    description: 'Left penalty box top-right',
    pitchX: -36, pitchZ: -20.16,
    category: 'box',
    priority: 'optional',
  },
  { 
    id: 'box-left-bl', 
    label: 'L Box BL', 
    description: 'Left penalty box bottom-left',
    pitchX: -52.5, pitchZ: 20.16,
    category: 'box',
    priority: 'optional',
  },
  { 
    id: 'box-left-br', 
    label: 'L Box BR', 
    description: 'Left penalty box bottom-right',
    pitchX: -36, pitchZ: 20.16,
    category: 'box',
    priority: 'optional',
  },
  { 
    id: 'box-right-tl', 
    label: 'R Box TL', 
    description: 'Right penalty box top-left',
    pitchX: 36, pitchZ: -20.16,
    category: 'box',
    priority: 'optional',
  },
  { 
    id: 'box-right-tr', 
    label: 'R Box TR', 
    description: 'Right penalty box top-right',
    pitchX: 52.5, pitchZ: -20.16,
    category: 'box',
    priority: 'optional',
  },
  { 
    id: 'box-right-bl', 
    label: 'R Box BL', 
    description: 'Right penalty box bottom-left',
    pitchX: 36, pitchZ: 20.16,
    category: 'box',
    priority: 'optional',
  },
  { 
    id: 'box-right-br', 
    label: 'R Box BR', 
    description: 'Right penalty box bottom-right',
    pitchX: 52.5, pitchZ: 20.16,
    category: 'box',
    priority: 'optional',
  },
];
