import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Volume2, 
  VolumeX,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { VideoState } from '@/types/analysis';

interface PlaybackControlsProps {
  videoState: VideoState;
  onTogglePlay: () => void;
  onStepFrame: (direction: 'forward' | 'backward') => void;
  onSetPlaybackRate: (rate: number) => void;
  onToggleMute: () => void;
}

const PLAYBACK_RATES = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];

export function PlaybackControls({
  videoState,
  onTogglePlay,
  onStepFrame,
  onSetPlaybackRate,
  onToggleMute,
}: PlaybackControlsProps) {
  return (
    <div className="flex items-center gap-1">
      {/* Frame step backward */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onStepFrame('backward')}
        className="h-8 w-8 text-muted-foreground hover:text-foreground"
        title="Previous frame (←)"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      {/* Skip backward 10s */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onStepFrame('backward')}
        className="h-8 w-8 text-muted-foreground hover:text-foreground"
        title="Skip -10s (J)"
      >
        <SkipBack className="h-4 w-4" />
      </Button>

      {/* Play/Pause */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onTogglePlay}
        className="h-10 w-10 text-primary hover:text-primary hover:bg-primary/20"
        title="Play/Pause (Space)"
      >
        {videoState.isPlaying ? (
          <Pause className="h-5 w-5" />
        ) : (
          <Play className="h-5 w-5" />
        )}
      </Button>

      {/* Skip forward 10s */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onStepFrame('forward')}
        className="h-8 w-8 text-muted-foreground hover:text-foreground"
        title="Skip +10s (L)"
      >
        <SkipForward className="h-4 w-4" />
      </Button>

      {/* Frame step forward */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onStepFrame('forward')}
        className="h-8 w-8 text-muted-foreground hover:text-foreground"
        title="Next frame (→)"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>

      {/* Playback speed */}
      <Select
        value={videoState.playbackRate.toString()}
        onValueChange={(value) => onSetPlaybackRate(parseFloat(value))}
      >
        <SelectTrigger className="w-[70px] h-8 text-xs bg-transparent border-border">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PLAYBACK_RATES.map((rate) => (
            <SelectItem key={rate} value={rate.toString()}>
              {rate}x
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Volume */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onToggleMute}
        className="h-8 w-8 text-muted-foreground hover:text-foreground"
        title="Toggle mute (M)"
      >
        {videoState.isMuted ? (
          <VolumeX className="h-4 w-4" />
        ) : (
          <Volume2 className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
}
