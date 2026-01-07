import { 
  MousePointer2, 
  User, 
  ArrowRight, 
  Circle, 
  Pencil, 
  Lightbulb,
  Type,
  Move,
  Trash2,
  Download,
  Save,
  Route,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ToolMode, ANNOTATION_COLORS, PLAYER_COLORS } from '@/types/analysis';
import { cn } from '@/lib/utils';

interface ToolPanelProps {
  currentTool: ToolMode;
  currentColor: string;
  onToolChange: (tool: ToolMode) => void;
  onColorChange: (color: string) => void;
  onClearAnnotations: () => void;
  onExport: () => void;
  onSave: () => void;
  hasVideo: boolean;
}

const TOOLS: { id: ToolMode; icon: typeof MousePointer2; label: string; description: string }[] = [
  { id: 'select', icon: MousePointer2, label: 'Select', description: 'Select & move' },
  { id: 'pan', icon: Move, label: 'Pan', description: 'Pan view' },
  { id: 'player', icon: User, label: 'Player', description: 'Add player marker' },
  { id: 'arrow', icon: ArrowRight, label: 'Pass', description: 'Draw pass arrow' },
  { id: 'freehand', icon: Route, label: 'Movement', description: 'Draw run path' },
  { id: 'zone', icon: Circle, label: 'Zone', description: 'Mark zone' },
  { id: 'spotlight', icon: Lightbulb, label: 'Spotlight', description: 'Highlight area' },
  { id: 'text', icon: Type, label: 'Text', description: 'Add label' },
];

const QUICK_COLORS = {
  home: PLAYER_COLORS.home[0],
  away: PLAYER_COLORS.away[0],
};

export function ToolPanel({
  currentTool,
  currentColor,
  onToolChange,
  onColorChange,
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
              title={tool.description}
            >
              <tool.icon className="h-4 w-4" />
              <span className="hidden xl:inline">{tool.label}</span>
            </Button>
          ))}
        </div>
      </div>

      <Separator className="bg-border/50" />

      {/* Team Colors */}
      <div className="space-y-1">
        <span className="hud-text text-[10px] text-muted-foreground">Team</span>
        <div className="flex gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onColorChange(QUICK_COLORS.home)}
            className={cn(
              "flex-1 h-8 text-xs gap-1",
              currentColor === QUICK_COLORS.home && "border-primary"
            )}
          >
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: QUICK_COLORS.home }} />
            Home
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onColorChange(QUICK_COLORS.away)}
            className={cn(
              "flex-1 h-8 text-xs gap-1",
              currentColor === QUICK_COLORS.away && "border-primary"
            )}
          >
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: QUICK_COLORS.away }} />
            Away
          </Button>
        </div>
      </div>

      <Separator className="bg-border/50" />

      {/* Colors */}
      <div className="space-y-1">
        <span className="hud-text text-[10px] text-muted-foreground">Color</span>
        <div className="flex flex-wrap gap-1">
          {ANNOTATION_COLORS.map((color) => (
            <button
              key={color}
              onClick={() => onColorChange(color)}
              className={cn(
                "w-6 h-6 rounded-full border-2 transition-all hover:scale-110",
                currentColor === color 
                  ? "border-foreground scale-110 shadow-lg" 
                  : "border-transparent hover:border-foreground/50"
              )}
              style={{ 
                backgroundColor: color,
                boxShadow: currentColor === color ? `0 0 12px ${color}` : undefined,
              }}
              title={color}
            />
          ))}
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
