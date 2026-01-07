import { Timeline } from './Timeline';
import { PlaybackControls } from './PlaybackControls';
import { VideoState } from '@/types/analysis';

interface BottomBarProps {
  videoState: VideoState;
  onTogglePlay: () => void;
  onSeek: (time: number) => void;
  onStepFrame: (direction: 'forward' | 'backward') => void;
  onSkip: (seconds: number) => void;
  onSetPlaybackRate: (rate: number) => void;
  onSetVolume: (volume: number) => void;
  onToggleMute: () => void;
  onToggleFullscreen?: () => void;
  isFullscreen?: boolean;
  formatTimecode: (seconds: number) => string;
}

export function BottomBar({
  videoState,
  onTogglePlay,
  onSeek,
  onStepFrame,
  onSkip,
  onSetPlaybackRate,
  onSetVolume,
  onToggleMute,
  onToggleFullscreen,
  isFullscreen = false,
  formatTimecode,
}: BottomBarProps) {
  return (
    <div className="glass-panel h-16 flex items-center px-4 border-t border-border gap-4">
      {/* Playback controls */}
      <PlaybackControls
        videoState={videoState}
        onTogglePlay={onTogglePlay}
        onStepFrame={onStepFrame}
        onSkip={onSkip}
        onSetPlaybackRate={onSetPlaybackRate}
        onSetVolume={onSetVolume}
        onToggleMute={onToggleMute}
        onToggleFullscreen={onToggleFullscreen}
        isFullscreen={isFullscreen}
      />

      {/* Timeline */}
      <Timeline
        currentTime={videoState.currentTime}
        duration={videoState.duration}
        onSeek={onSeek}
        formatTimecode={formatTimecode}
      />

      {/* Current timecode large display */}
      <div className="font-mono text-primary text-lg tracking-wider min-w-[140px] text-right">
        {formatTimecode(videoState.currentTime)}
      </div>
    </div>
  );
}
