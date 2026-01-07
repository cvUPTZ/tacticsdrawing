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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ToolMode, ANNOTATION_COLORS } from '@/types/analysis';
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

const TOOLS: { id: ToolMode; icon: typeof MousePointer2; label: string }[] = [
  { id: 'select', icon: MousePointer2, label: 'Select' },
  { id: 'pan', icon: Move, label: 'Pan' },
  { id: 'player', icon: User, label: 'Player' },
  { id: 'arrow', icon: ArrowRight, label: 'Arrow' },
  { id: 'zone', icon: Circle, label: 'Zone' },
  { id: 'freehand', icon: Pencil, label: 'Draw' },
  { id: 'spotlight', icon: Lightbulb, label: 'Spotlight' },
  { id: 'text', icon: Type, label: 'Text' },
];

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
              title={tool.label}
            >
              <tool.icon className="h-4 w-4" />
              <span className="hidden xl:inline">{tool.label}</span>
            </Button>
          ))}
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
                "w-6 h-6 rounded-full border-2 transition-transform hover:scale-110",
                currentColor === color 
                  ? "border-foreground scale-110" 
                  : "border-transparent"
              )}
              style={{ backgroundColor: color }}
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
            Export
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onSave}
            className="w-full justify-start gap-2 text-xs text-primary hover:text-primary hover:bg-primary/10"
          >
            <Save className="h-4 w-4" />
            Save Project
          </Button>
        </div>
      </div>
    </div>
  );
}
