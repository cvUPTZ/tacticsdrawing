import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Volume2, 
  VolumeX,
  Volume1,
  ChevronLeft,
  ChevronRight,
  Maximize,
  Minimize,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { VideoState } from '@/types/analysis';
import { useState } from 'react';

interface PlaybackControlsProps {
  videoState: VideoState;
  onTogglePlay: () => void;
  onStepFrame: (direction: 'forward' | 'backward') => void;
  onSkip: (seconds: number) => void;
  onSetPlaybackRate: (rate: number) => void;
  onSetVolume: (volume: number) => void;
  onToggleMute: () => void;
  onToggleFullscreen?: () => void;
  isFullscreen?: boolean;
}

const PLAYBACK_RATES = [0.1, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 4];

export function PlaybackControls({
  videoState,
  onTogglePlay,
  onStepFrame,
  onSkip,
  onSetPlaybackRate,
  onSetVolume,
  onToggleMute,
  onToggleFullscreen,
  isFullscreen = false,
}: PlaybackControlsProps) {
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);

  const VolumeIcon = videoState.isMuted || videoState.volume === 0 
    ? VolumeX 
    : videoState.volume < 0.5 
      ? Volume1 
      : Volume2;

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
        onClick={() => onSkip(-10)}
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
        onClick={() => onSkip(10)}
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

      {/* Volume with slider */}
      <div 
        className="relative flex items-center"
        onMouseEnter={() => setShowVolumeSlider(true)}
        onMouseLeave={() => setShowVolumeSlider(false)}
      >
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleMute}
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          title="Toggle mute (M)"
        >
          <VolumeIcon className="h-4 w-4" />
        </Button>
        
        {showVolumeSlider && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-2 glass-panel rounded-lg">
            <div className="h-24 flex items-center justify-center">
              <Slider
                orientation="vertical"
                value={[videoState.isMuted ? 0 : videoState.volume * 100]}
                onValueChange={([v]) => onSetVolume(v / 100)}
                min={0}
                max={100}
                step={1}
                className="h-20"
              />
            </div>
            <div className="text-center text-xs text-muted-foreground mt-1">
              {Math.round((videoState.isMuted ? 0 : videoState.volume) * 100)}%
            </div>
          </div>
        )}
      </div>

      {/* Fullscreen toggle */}
      {onToggleFullscreen && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleFullscreen}
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          title="Toggle fullscreen (F)"
        >
          {isFullscreen ? (
            <Minimize className="h-4 w-4" />
          ) : (
            <Maximize className="h-4 w-4" />
          )}
        </Button>
      )}
    </div>
  );
}
