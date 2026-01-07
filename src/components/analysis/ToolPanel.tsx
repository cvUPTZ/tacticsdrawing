import { 
  MousePointer2, 
  User, 
  ArrowRight, 
  Circle, 
  Lightbulb,
  Move,
  Trash2,
  Download,
  Save,
  Route,
  Minus,
  Target,
  Square,
  Triangle,
  Hexagon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ToolMode, ANNOTATION_COLORS, PLAYER_COLORS, ZoneShape } from '@/types/analysis';
import { cn } from '@/lib/utils';

interface ToolPanelProps {
  currentTool: ToolMode;
  currentColor: string;
  isDashed: boolean;
  zoneShape: ZoneShape;
  onToolChange: (tool: ToolMode) => void;
  onColorChange: (color: string) => void;
  onDashedChange: (dashed: boolean) => void;
  onZoneShapeChange: (shape: ZoneShape) => void;
  onClearAnnotations: () => void;
  onExport: () => void;
  onSave: () => void;
  hasVideo: boolean;
}

const TOOLS: { id: ToolMode; icon: typeof MousePointer2; label: string; shortcut: string }[] = [
  { id: 'select', icon: MousePointer2, label: 'Select', shortcut: 'V' },
  { id: 'pan', icon: Move, label: 'Pan', shortcut: 'H' },
  { id: 'player', icon: User, label: 'Player', shortcut: 'P' },
  { id: 'arrow', icon: ArrowRight, label: 'Pass', shortcut: 'A' },
  { id: 'freehand', icon: Route, label: 'Movement', shortcut: 'D' },
  { id: 'zone', icon: Circle, label: 'Zone', shortcut: 'Z' },
  { id: 'spotlight', icon: Lightbulb, label: 'Spotlight', shortcut: 'S' },
  { id: 'offside', icon: Minus, label: 'Offside', shortcut: 'O' },
  { id: 'pressing', icon: Target, label: 'Press', shortcut: 'R' },
];

const ZONE_SHAPES: { id: ZoneShape; icon: typeof Circle; label: string }[] = [
  { id: 'circle', icon: Circle, label: 'Circle' },
  { id: 'rectangle', icon: Square, label: 'Rectangle' },
  { id: 'triangle', icon: Triangle, label: 'Triangle' },
];

const QUICK_COLORS = {
  home: PLAYER_COLORS.home[0],
  away: PLAYER_COLORS.away[0],
  pass: '#ff8800',
};

export function ToolPanel({
  currentTool,
  currentColor,
  isDashed,
  zoneShape,
  onToolChange,
  onColorChange,
  onDashedChange,
  onZoneShapeChange,
  onClearAnnotations,
  onExport,
  onSave,
  hasVideo,
}: ToolPanelProps) {
  return (
    <div className="glass-panel rounded-lg p-3 flex flex-col gap-3">
      {/* Tools */}
      <div className="space-y-1">
        <span className="hud-text text-[10px] text-muted-foreground">Tools</span>
        <div className="grid grid-cols-2 gap-1">
          {TOOLS.map((tool) => (
            <Button
              key={tool.id}
              variant="ghost"
              size="sm"
              onClick={() => onToolChange(tool.id)}
              disabled={!hasVideo && tool.id !== 'select'}
              className={cn(
                "h-9 justify-start gap-2 text-xs",
                currentTool === tool.id && "tool-active"
              )}
              title={`${tool.label} (${tool.shortcut})`}
            >
              <tool.icon className="h-4 w-4" />
              <span className="hidden xl:inline">{tool.label}</span>
            </Button>
          ))}
        </div>
      </div>

      <Separator className="bg-border/50" />

      {/* Quick Team Colors */}
      <div className="space-y-1">
        <span className="hud-text text-[10px] text-muted-foreground">Quick Colors</span>
        <div className="flex gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onColorChange(QUICK_COLORS.home)}
            className={cn(
              "flex-1 h-7 text-[10px] px-2 gap-1",
              currentColor === QUICK_COLORS.home && "border-primary bg-primary/10"
            )}
          >
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: QUICK_COLORS.home }} />
            Home
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onColorChange(QUICK_COLORS.away)}
            className={cn(
              "flex-1 h-7 text-[10px] px-2 gap-1",
              currentColor === QUICK_COLORS.away && "border-primary bg-primary/10"
            )}
          >
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: QUICK_COLORS.away }} />
            Away
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onColorChange(QUICK_COLORS.pass)}
            className={cn(
              "flex-1 h-7 text-[10px] px-2 gap-1",
              currentColor === QUICK_COLORS.pass && "border-primary bg-primary/10"
            )}
          >
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: QUICK_COLORS.pass }} />
            Pass
          </Button>
        </div>
      </div>

      <Separator className="bg-border/50" />

      {/* All Colors */}
      <div className="space-y-1">
        <span className="hud-text text-[10px] text-muted-foreground">Colors</span>
        <div className="flex flex-wrap gap-1">
          {ANNOTATION_COLORS.map((color) => (
            <button
              key={color}
              onClick={() => onColorChange(color)}
              className={cn(
                "w-5 h-5 rounded-full border-2 transition-all hover:scale-110",
                currentColor === color 
                  ? "border-foreground scale-110" 
                  : "border-transparent hover:border-foreground/50"
              )}
              style={{ 
                backgroundColor: color,
                boxShadow: currentColor === color ? `0 0 10px ${color}` : undefined,
              }}
              title={color}
            />
          ))}
        </div>
      </div>

      <Separator className="bg-border/50" />

      {/* Zone Shape (show only when zone tool active) */}
      {currentTool === 'zone' && (
        <>
          <div className="space-y-1">
            <span className="hud-text text-[10px] text-muted-foreground">Zone Shape</span>
            <div className="flex gap-1">
              {ZONE_SHAPES.map((shape) => (
                <Button
                  key={shape.id}
                  variant="outline"
                  size="sm"
                  onClick={() => onZoneShapeChange(shape.id)}
                  className={cn(
                    "flex-1 h-8 px-2 gap-1",
                    zoneShape === shape.id && "border-primary bg-primary/10"
                  )}
                >
                  <shape.icon className="h-3.5 w-3.5" />
                </Button>
              ))}
            </div>
          </div>
          <Separator className="bg-border/50" />
        </>
      )}

      {/* Line Style */}
      <div className="space-y-1">
        <span className="hud-text text-[10px] text-muted-foreground">Line Style</span>
        <div className="flex items-center justify-between py-1">
          <Label htmlFor="dashed-mode" className="text-xs flex items-center gap-2">
            <span className="w-8 h-0.5 bg-current" style={{ 
              backgroundImage: isDashed ? 'repeating-linear-gradient(90deg, currentColor 0, currentColor 4px, transparent 4px, transparent 8px)' : undefined 
            }} />
            {isDashed ? 'Dashed' : 'Solid'}
          </Label>
          <Switch
            id="dashed-mode"
            checked={isDashed}
            onCheckedChange={onDashedChange}
          />
        </div>
      </div>

      <Separator className="bg-border/50" />

      {/* Actions */}
      <div className="space-y-1">
        <span className="hud-text text-[10px] text-muted-foreground">Actions</span>
        <div className="space-y-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearAnnotations}
            className="w-full justify-start gap-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-4 w-4" />
            Clear All
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onExport}
            disabled={!hasVideo}
            className="w-full justify-start gap-2 text-xs"
          >
            <Download className="h-4 w-4" />
            Export Snapshot
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={onSave}
            className="w-full justify-start gap-2 text-xs"
          >
            <Save className="h-4 w-4" />
            Save Project
          </Button>
        </div>
      </div>
    </div>
  );
}
