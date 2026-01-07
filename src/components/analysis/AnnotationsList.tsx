import { 
  Eye, EyeOff, Trash2, User, ArrowRight, Circle, Route, Lightbulb, Minus, Target, 
  Slash, MapPin, Spline, Shield, Ruler, RotateCw, Maximize2, ArrowLeftRight, 
  Footprints, Crosshair, Box, Grid3X3, Users, Goal 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import { Annotation, AnnotationType } from '@/types/analysis';
import { cn } from '@/lib/utils';

interface AnnotationsListProps {
  annotations: Annotation[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onToggleVisibility: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdate?: (id: string, updates: Partial<Annotation>) => void;
}

// Use a default icon for new types
const DEFAULT_ICON = Circle;

const TYPE_ICONS: Partial<Record<AnnotationType, typeof User>> = {
  player: User,
  arrow: ArrowRight,
  zone: Circle,
  freehand: Route,
  spotlight: Lightbulb,
  text: User,
  offside: Minus,
  pressing: Target,
  line: Slash,
  marker: MapPin,
  curve: Spline,
  shield: Shield,
  distance: Ruler,
  // Passing arrows
  double_arrow: ArrowLeftRight,
  curved_dashed: Spline,
  through_ball: ArrowRight,
  switch_play: ArrowLeftRight,
  cross: Crosshair,
  // Defensive
  press_trap: Target,
  cover_shadow: Shield,
  compact_block: Box,
  line_shift: Minus,
  marking: User,
  // Set-piece
  wall: Users,
  run: Footprints,
  screen: Shield,
  decoy: User,
  delivery_zone: Goal,
  // Training
  cone: Triangle,
  gate: Box,
  grid: Grid3X3,
  ladder: Grid3X3,
  target_zone: Target,
};

// Need to import Triangle
import { Triangle } from 'lucide-react';

const TYPE_LABELS: Record<AnnotationType, string> = {
  player: 'Player',
  arrow: 'Pass',
  zone: 'Zone',
  freehand: 'Movement',
  spotlight: 'Spotlight',
  text: 'Text',
  offside: 'Offside',
  pressing: 'Press',
  line: 'Line',
  marker: 'Marker',
  curve: 'Curve',
  shield: 'Block',
  distance: 'Distance',
  // Passing arrows
  double_arrow: 'Double Arrow',
  curved_dashed: 'Curved Dashed',
  through_ball: 'Through Ball',
  switch_play: 'Switch Play',
  cross: 'Cross',
  // Defensive
  press_trap: 'Press Trap',
  cover_shadow: 'Cover Shadow',
  compact_block: 'Compact Block',
  line_shift: 'Line Shift',
  marking: 'Marking',
  // Set-piece
  wall: 'Wall',
  run: 'Run',
  screen: 'Screen',
  decoy: 'Decoy',
  delivery_zone: 'Delivery Zone',
  // Training
  cone: 'Cone',
  gate: 'Gate',
  grid: 'Grid',
  ladder: 'Ladder',
  target_zone: 'Target Zone',
};

export function AnnotationsList({
  annotations,
  selectedId,
  onSelect,
  onToggleVisibility,
  onDelete,
  onUpdate,
}: AnnotationsListProps) {
  const selectedAnnotation = annotations.find(a => a.id === selectedId);
  const isZoneSelected = selectedAnnotation?.type === 'zone';
  const isShieldSelected = selectedAnnotation?.type === 'shield';
  const canResize = isZoneSelected || isShieldSelected;

  if (annotations.length === 0) {
    return (
      <div className="glass-panel rounded-lg p-3">
        <span className="hud-text text-[10px] text-muted-foreground">Annotations</span>
        <p className="mt-2 text-xs text-muted-foreground text-center py-4">
          No annotations yet
        </p>
      </div>
    );
  }

  return (
    <div className="glass-panel rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="hud-text text-[10px] text-muted-foreground">Annotations</span>
        <span className="text-[10px] text-muted-foreground font-mono">{annotations.length}</span>
      </div>

      <ScrollArea className="h-36">
        <div className="space-y-1">
          {annotations.map((annotation) => {
            const Icon = TYPE_ICONS[annotation.type] || DEFAULT_ICON;
            return (
              <div
                key={annotation.id}
                className={cn(
                  "group flex items-center gap-2 p-1.5 rounded-md cursor-pointer transition-colors",
                  selectedId === annotation.id
                    ? "bg-primary/20 border border-primary/50"
                    : "hover:bg-secondary/50",
                  !annotation.visible && "opacity-50"
                )}
                onClick={() => onSelect(annotation.id)}
              >
                {/* Color indicator */}
                <div
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: annotation.color }}
                />

                {/* Icon */}
                <Icon className="w-3 h-3 text-muted-foreground shrink-0" />

                {/* Label */}
                <div className="flex-1 min-w-0">
                  <span className="text-[11px] truncate block">
                    {annotation.label || TYPE_LABELS[annotation.type] || annotation.type}
                  </span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleVisibility(annotation.id);
                    }}
                  >
                    {annotation.visible ? (
                      <Eye className="h-3 w-3" />
                    ) : (
                      <EyeOff className="h-3 w-3 text-muted-foreground" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 text-destructive hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(annotation.id);
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>

      {/* Zone/Shield Edit Controls */}
      {canResize && selectedAnnotation && onUpdate && (
        <div className="mt-3 pt-3 border-t border-border/50 space-y-3">
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <Maximize2 className="h-3 w-3" />
            <span>Edit {TYPE_LABELS[selectedAnnotation.type]}</span>
          </div>

          {/* Scale slider */}
          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Maximize2 className="h-2.5 w-2.5" />
                Scale
              </span>
              <span className="text-[10px] font-mono text-muted-foreground">
                {((selectedAnnotation.scale || 1) * 100).toFixed(0)}%
              </span>
            </div>
            <Slider
              value={[(selectedAnnotation.scale || 1) * 100]}
              onValueChange={([v]) => onUpdate(selectedAnnotation.id, { scale: v / 100 })}
              min={25}
              max={300}
              step={5}
            />
          </div>

          {/* Rotation slider */}
          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                <RotateCw className="h-2.5 w-2.5" />
                Rotation
              </span>
              <span className="text-[10px] font-mono text-muted-foreground">
                {((selectedAnnotation.rotation || 0) * (180 / Math.PI)).toFixed(0)}°
              </span>
            </div>
            <Slider
              value={[(selectedAnnotation.rotation || 0) * (180 / Math.PI)]}
              onValueChange={([v]) => onUpdate(selectedAnnotation.id, { rotation: v * (Math.PI / 180) })}
              min={-180}
              max={180}
              step={5}
            />
          </div>

          {/* Quick actions */}
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onUpdate(selectedAnnotation.id, { scale: 1, rotation: 0 })}
              className="flex-1 h-6 text-[9px]"
            >
              Reset
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onUpdate(selectedAnnotation.id, { rotation: (selectedAnnotation.rotation || 0) + Math.PI / 4 })}
              className="flex-1 h-6 text-[9px]"
            >
              +45°
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onUpdate(selectedAnnotation.id, { scale: (selectedAnnotation.scale || 1) * 1.25 })}
              className="flex-1 h-6 text-[9px]"
            >
              +25%
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
