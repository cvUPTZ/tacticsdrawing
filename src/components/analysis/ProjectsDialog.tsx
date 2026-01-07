import { format } from 'date-fns';
import { Folder, Trash2, Plus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Project } from '@/types/analysis';

interface ProjectsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projects: Project[];
  loading: boolean;
  onSelectProject: (project: Project) => void;
  onDeleteProject: (id: string) => void;
  onCreateProject: () => void;
}

export function ProjectsDialog({
  open,
  onOpenChange,
  projects,
  loading,
  onSelectProject,
  onDeleteProject,
  onCreateProject,
}: ProjectsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Folder className="h-5 w-5" />
            Your Projects
          </DialogTitle>
        </DialogHeader>

        <div className="flex justify-end mb-4">
          <Button onClick={onCreateProject} className="gap-2">
            <Plus className="h-4 w-4" />
            New Project
          </Button>
        </div>

        <ScrollArea className="h-[400px] pr-4">
          {loading ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground">
              Loading projects...
            </div>
          ) : projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
              <Folder className="h-12 w-12 mb-2 opacity-50" />
              <p>No projects yet</p>
              <p className="text-sm">Create your first analysis project</p>
            </div>
          ) : (
            <div className="space-y-2">
              {projects.map((project) => (
                <div
                  key={project.id}
                  className="group flex items-center justify-between p-3 rounded-lg border border-border hover:border-primary/50 hover:bg-card cursor-pointer transition-colors"
                  onClick={() => {
                    onSelectProject(project);
                    onOpenChange(false);
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium truncate">{project.name}</h3>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      {project.videoFilename && (
                        <span className="truncate max-w-[200px]">
                          {project.videoFilename}
                        </span>
                      )}
                      <span>•</span>
                      <span>{format(new Date(project.updatedAt), 'MMM d, yyyy')}</span>
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteProject(project.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
