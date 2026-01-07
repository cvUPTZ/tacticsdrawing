import { Eye, EyeOff, Trash2 } from 'lucide-react';
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

const TYPE_LABELS: Record<Annotation['type'], string> = {
  player: 'Player',
  arrow: 'Arrow',
  zone: 'Zone',
  freehand: 'Drawing',
  spotlight: 'Spotlight',
  text: 'Text',
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
        <p className="mt-2 text-sm text-muted-foreground text-center py-4">
          No annotations yet
        </p>
      </div>
    );
  }

  return (
    <div className="glass-panel rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="hud-text text-[10px] text-muted-foreground">Annotations</span>
        <span className="text-[10px] text-muted-foreground">{annotations.length}</span>
      </div>

      <ScrollArea className="h-48">
        <div className="space-y-1">
          {annotations.map((annotation) => (
            <div
              key={annotation.id}
              className={cn(
                "group flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors",
                selectedId === annotation.id
                  ? "bg-primary/20 border border-primary/50"
                  : "hover:bg-secondary/50"
              )}
              onClick={() => onSelect(annotation.id)}
            >
              {/* Color indicator */}
              <div
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: annotation.color }}
              />

              {/* Label */}
              <div className="flex-1 min-w-0">
                <span className="text-xs truncate block">
                  {annotation.label || TYPE_LABELS[annotation.type]}
                </span>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
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
                  className="h-6 w-6 text-destructive hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(annotation.id);
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
