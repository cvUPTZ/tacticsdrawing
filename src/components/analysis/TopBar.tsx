import { Upload, FolderOpen, User, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useRef } from 'react';

interface TopBarProps {
  projectName: string;
  userName?: string;
  onProjectNameChange: (name: string) => void;
  onUpload: (file: File) => void;
  onOpenProjects: () => void;
  onSignOut: () => void;
}

export function TopBar({
  projectName,
  userName,
  onProjectNameChange,
  onUpload,
  onOpenProjects,
  onSignOut,
}: TopBarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUpload(file);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <header className="glass-panel h-12 flex items-center justify-between px-4 border-b border-border">
      {/* Left: Logo + Project Name */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm">TA</span>
          </div>
          <span className="hidden md:block text-sm font-semibold text-foreground">
            Tactical Analysis
          </span>
        </div>

        <div className="h-6 w-px bg-border hidden md:block" />

        <Input
          value={projectName}
          onChange={(e) => onProjectNameChange(e.target.value)}
          className="h-8 w-48 bg-transparent border-transparent hover:border-border focus:border-primary text-sm"
          placeholder="Untitled Analysis"
        />
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          onChange={handleFileChange}
          className="hidden"
        />

        <Button
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          className="gap-2"
        >
          <Upload className="h-4 w-4" />
          <span className="hidden md:inline">Upload Video</span>
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={onOpenProjects}
          className="gap-2"
        >
          <FolderOpen className="h-4 w-4" />
          <span className="hidden md:inline">Projects</span>
        </Button>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <User className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {userName && (
              <>
                <div className="px-2 py-1.5 text-sm text-muted-foreground truncate">
                  {userName}
                </div>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem onClick={onSignOut} className="gap-2 text-destructive">
              <LogOut className="h-4 w-4" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
