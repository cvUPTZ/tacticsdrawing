import { Timeline } from './Timeline';
import { PlaybackControls } from './PlaybackControls';
import { VideoState } from '@/types/analysis';

interface BottomBarProps {
  videoState: VideoState;
  onTogglePlay: () => void;
  onSeek: (time: number) => void;
  onStepFrame: (direction: 'forward' | 'backward') => void;
  onSetPlaybackRate: (rate: number) => void;
  onToggleMute: () => void;
  formatTimecode: (seconds: number) => string;
}

export function BottomBar({
  videoState,
  onTogglePlay,
  onSeek,
  onStepFrame,
  onSetPlaybackRate,
  onToggleMute,
  formatTimecode,
}: BottomBarProps) {
  return (
    <div className="glass-panel h-16 flex items-center px-4 border-t border-border gap-4">
      {/* Playback controls */}
      <PlaybackControls
        videoState={videoState}
        onTogglePlay={onTogglePlay}
        onStepFrame={onStepFrame}
        onSetPlaybackRate={onSetPlaybackRate}
        onToggleMute={onToggleMute}
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
