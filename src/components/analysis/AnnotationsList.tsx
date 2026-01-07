import { Eye, EyeOff, Trash2, User, ArrowRight, Circle, Route, Lightbulb, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Annotation } from '@/types/analysis';
import { cn } from '@/lib/utils';

interface AnnotationsListProps {
  annotations: Annotation[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onToggleVisibility: (id: string) => void;
  onDelete: (id: string) => void;
}

const TYPE_ICONS: Record<Annotation['type'], typeof User> = {
  player: User,
  arrow: ArrowRight,
  zone: Circle,
  freehand: Route,
  spotlight: Lightbulb,
  text: User,
  offside: Minus,
};

const TYPE_LABELS: Record<Annotation['type'], string> = {
  player: 'Player',
  arrow: 'Pass',
  zone: 'Zone',
  freehand: 'Movement',
  spotlight: 'Spotlight',
  text: 'Text',
  offside: 'Offside',
};

export function AnnotationsList({
  annotations,
  selectedId,
  onSelect,
  onToggleVisibility,
  onDelete,
}: AnnotationsListProps) {
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

      <ScrollArea className="h-48">
        <div className="space-y-1">
          {annotations.map((annotation) => {
            const Icon = TYPE_ICONS[annotation.type];
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
                    {annotation.label || TYPE_LABELS[annotation.type]}
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
    </div>
  );
}
