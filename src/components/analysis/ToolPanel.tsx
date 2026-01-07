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
  Slash,
  MapPin,
  Spline,
  Shield,
  Ruler,
  ArrowLeftRight,
  Footprints,
  Crosshair,
  Box,
  Grid3X3,
  Users,
  Goal,
  Cone,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ToolMode, ANNOTATION_COLORS, PLAYER_COLORS, ZoneShape } from '@/types/analysis';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

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

// Base tools
const BASE_TOOLS: { id: ToolMode; icon: typeof MousePointer2; label: string; shortcut?: string }[] = [
  { id: 'select', icon: MousePointer2, label: 'Select', shortcut: 'V' },
  { id: 'pan', icon: Move, label: 'Pan', shortcut: 'H' },
  { id: 'player', icon: User, label: 'Player', shortcut: 'P' },
  { id: 'arrow', icon: ArrowRight, label: 'Pass', shortcut: 'A' },
  { id: 'freehand', icon: Route, label: 'Movement', shortcut: 'D' },
  { id: 'zone', icon: Circle, label: 'Zone', shortcut: 'Z' },
  { id: 'spotlight', icon: Lightbulb, label: 'Spotlight', shortcut: 'S' },
  { id: 'offside', icon: Minus, label: 'Offside', shortcut: 'O' },
  { id: 'distance', icon: Ruler, label: 'Distance', shortcut: 'I' },
];

// Passing arrows pack
const PASSING_TOOLS: { id: ToolMode; icon: typeof ArrowRight; label: string }[] = [
  { id: 'double_arrow', icon: ArrowLeftRight, label: 'Double Arrow' },
  { id: 'curved_dashed', icon: Spline, label: 'Curved Dashed' },
  { id: 'through_ball', icon: ArrowRight, label: 'Through Ball' },
  { id: 'switch_play', icon: ArrowLeftRight, label: 'Switch Play' },
  { id: 'cross', icon: Crosshair, label: 'Cross' },
];

// Defensive pack
const DEFENSIVE_TOOLS: { id: ToolMode; icon: typeof Shield; label: string }[] = [
  { id: 'pressing', icon: Target, label: 'Press' },
  { id: 'press_trap', icon: Target, label: 'Press Trap' },
  { id: 'cover_shadow', icon: Shield, label: 'Cover Shadow' },
  { id: 'compact_block', icon: Box, label: 'Compact Block' },
  { id: 'line_shift', icon: Minus, label: 'Line Shift' },
  { id: 'marking', icon: User, label: 'Marking' },
  { id: 'shield', icon: Shield, label: 'Block' },
];

// Set-piece pack
const SETPIECE_TOOLS: { id: ToolMode; icon: typeof Users; label: string }[] = [
  { id: 'wall', icon: Users, label: 'Wall' },
  { id: 'run', icon: Footprints, label: 'Run' },
  { id: 'screen', icon: Shield, label: 'Screen' },
  { id: 'decoy', icon: User, label: 'Decoy' },
  { id: 'delivery_zone', icon: Goal, label: 'Delivery Zone' },
];

// Training pack
const TRAINING_TOOLS: { id: ToolMode; icon: typeof Triangle; label: string }[] = [
  { id: 'cone', icon: Triangle, label: 'Cone' },
  { id: 'gate', icon: Box, label: 'Gate' },
  { id: 'grid', icon: Grid3X3, label: 'Grid' },
  { id: 'ladder', icon: Grid3X3, label: 'Ladder' },
  { id: 'target_zone', icon: Target, label: 'Target Zone' },
];

// Drawing tools
const DRAWING_TOOLS: { id: ToolMode; icon: typeof Slash; label: string }[] = [
  { id: 'line', icon: Slash, label: 'Line' },
  { id: 'marker', icon: MapPin, label: 'Marker' },
  { id: 'curve', icon: Spline, label: 'Curve' },
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

interface ToolGroupProps {
  title: string;
  tools: { id: ToolMode; icon: typeof MousePointer2; label: string; shortcut?: string }[];
  currentTool: ToolMode;
  onToolChange: (tool: ToolMode) => void;
  hasVideo: boolean;
  defaultOpen?: boolean;
}

function ToolGroup({ title, tools, currentTool, onToolChange, hasVideo, defaultOpen = false }: ToolGroupProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const hasActiveTool = tools.some(t => t.id === currentTool);

  return (
    <Collapsible open={isOpen || hasActiveTool} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <button className="flex items-center justify-between w-full text-[10px] text-muted-foreground hover:text-foreground py-1 px-1 rounded hover:bg-secondary/50 transition-colors">
          <span className="font-medium">{title}</span>
          {isOpen || hasActiveTool ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="grid grid-cols-2 gap-0.5 pt-1">
          {tools.map((tool) => (
            <Button
              key={tool.id}
              variant="ghost"
              size="sm"
              onClick={() => onToolChange(tool.id)}
              disabled={!hasVideo && tool.id !== 'select'}
              className={cn(
                "h-7 justify-start gap-1.5 text-[10px] px-2",
                currentTool === tool.id && "tool-active"
              )}
              title={tool.shortcut ? `${tool.label} (${tool.shortcut})` : tool.label}
            >
              <tool.icon className="h-3 w-3" />
              <span className="truncate">{tool.label}</span>
            </Button>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

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
    <div className="glass-panel rounded-lg p-3 flex flex-col gap-2">
      {/* Base Tools */}
      <ToolGroup 
        title="Basic Tools" 
        tools={BASE_TOOLS} 
        currentTool={currentTool} 
        onToolChange={onToolChange}
        hasVideo={hasVideo}
        defaultOpen={true}
      />

      <Separator className="bg-border/50" />

      {/* Drawing Tools */}
      <ToolGroup 
        title="Drawing" 
        tools={DRAWING_TOOLS} 
        currentTool={currentTool} 
        onToolChange={onToolChange}
        hasVideo={hasVideo}
      />

      {/* Passing Pack */}
      <ToolGroup 
        title="Passing Arrows" 
        tools={PASSING_TOOLS} 
        currentTool={currentTool} 
        onToolChange={onToolChange}
        hasVideo={hasVideo}
      />

      {/* Defensive Pack */}
      <ToolGroup 
        title="Defensive" 
        tools={DEFENSIVE_TOOLS} 
        currentTool={currentTool} 
        onToolChange={onToolChange}
        hasVideo={hasVideo}
      />

      {/* Set-piece Pack */}
      <ToolGroup 
        title="Set-Pieces" 
        tools={SETPIECE_TOOLS} 
        currentTool={currentTool} 
        onToolChange={onToolChange}
        hasVideo={hasVideo}
      />

      {/* Training Pack */}
      <ToolGroup 
        title="Training" 
        tools={TRAINING_TOOLS} 
        currentTool={currentTool} 
        onToolChange={onToolChange}
        hasVideo={hasVideo}
      />

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
              "flex-1 h-6 text-[9px] px-1 gap-1",
              currentColor === QUICK_COLORS.home && "border-primary bg-primary/10"
            )}
          >
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: QUICK_COLORS.home }} />
            Home
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onColorChange(QUICK_COLORS.away)}
            className={cn(
              "flex-1 h-6 text-[9px] px-1 gap-1",
              currentColor === QUICK_COLORS.away && "border-primary bg-primary/10"
            )}
          >
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: QUICK_COLORS.away }} />
            Away
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onColorChange(QUICK_COLORS.pass)}
            className={cn(
              "flex-1 h-6 text-[9px] px-1 gap-1",
              currentColor === QUICK_COLORS.pass && "border-primary bg-primary/10"
            )}
          >
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: QUICK_COLORS.pass }} />
            Pass
          </Button>
        </div>
      </div>

      {/* All Colors */}
      <div className="space-y-1">
        <span className="hud-text text-[10px] text-muted-foreground">Colors</span>
        <div className="flex flex-wrap gap-1">
          {ANNOTATION_COLORS.map((color) => (
            <button
              key={color}
              onClick={() => onColorChange(color)}
              className={cn(
                "w-4 h-4 rounded-full border-2 transition-all hover:scale-110",
                currentColor === color 
                  ? "border-foreground scale-110" 
                  : "border-transparent hover:border-foreground/50"
              )}
              style={{ 
                backgroundColor: color,
                boxShadow: currentColor === color ? `0 0 8px ${color}` : undefined,
              }}
              title={color}
            />
          ))}
        </div>
      </div>

      <Separator className="bg-border/50" />

      {/* Zone Shape (show only when zone tool active) */}
      {(currentTool === 'zone' || currentTool === 'delivery_zone' || currentTool === 'target_zone') && (
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
                    "flex-1 h-7 px-2 gap-1",
                    zoneShape === shape.id && "border-primary bg-primary/10"
                  )}
                >
                  <shape.icon className="h-3 w-3" />
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
        <div className="flex items-center justify-between py-0.5">
          <Label htmlFor="dashed-mode" className="text-[10px] flex items-center gap-2">
            <span className="w-6 h-0.5 bg-current" style={{ 
              backgroundImage: isDashed ? 'repeating-linear-gradient(90deg, currentColor 0, currentColor 3px, transparent 3px, transparent 6px)' : undefined 
            }} />
            {isDashed ? 'Dashed' : 'Solid'}
          </Label>
          <Switch
            id="dashed-mode"
            checked={isDashed}
            onCheckedChange={onDashedChange}
            className="scale-75"
          />
        </div>
      </div>

      <Separator className="bg-border/50" />

      {/* Actions */}
      <div className="space-y-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearAnnotations}
          className="w-full justify-start gap-2 text-[10px] h-7 text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          <Trash2 className="h-3 w-3" />
          Clear All
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onExport}
          disabled={!hasVideo}
          className="w-full justify-start gap-2 text-[10px] h-7"
        >
          <Download className="h-3 w-3" />
          Export Snapshot
        </Button>
        <Button
          variant="default"
          size="sm"
          onClick={onSave}
          className="w-full justify-start gap-2 text-[10px] h-7"
        >
          <Save className="h-3 w-3" />
          Save Project
        </Button>
      </div>
    </div>
  );
}
