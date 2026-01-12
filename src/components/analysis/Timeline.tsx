import { useCallback, useRef, useState, forwardRef } from 'react';
import { Slider } from '@/components/ui/slider';

interface TimelineProps {
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
  formatTimecode: (seconds: number) => string;
}

export const Timeline = forwardRef<HTMLDivElement, TimelineProps>(({ currentTime, duration, onSeek, formatTimecode }, ref) => {
  const [isDragging, setIsDragging] = useState(false);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const handleValueChange = useCallback((value: number[]) => {
    const time = (value[0] / 100) * duration;
    onSeek(time);
  }, [duration, onSeek]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!trackRef.current || duration === 0) return;
    const rect = trackRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = Math.max(0, Math.min(1, x / rect.width));
    setHoverTime(percent * duration);
  }, [duration]);

  const handleMouseLeave = useCallback(() => {
    setHoverTime(null);
  }, []);

  return (
    <div className="relative flex-1 px-4">
      {/* Hover timecode tooltip */}
      {hoverTime !== null && (
        <div
          className="absolute -top-8 transform -translate-x-1/2 glass-panel px-2 py-1 rounded text-xs font-mono text-primary pointer-events-none z-10"
          style={{
            left: `${(hoverTime / duration) * 100}%`,
          }}
        >
          {formatTimecode(hoverTime)}
        </div>
      )}

      <div
        ref={trackRef}
        className="relative"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <Slider
          value={[progress]}
          onValueChange={handleValueChange}
          onValueCommit={() => setIsDragging(false)}
          onPointerDown={() => setIsDragging(true)}
          max={100}
          step={0.01}
          className="w-full"
        />
      </div>

      {/* Current timecode display */}
      <div className="flex justify-between mt-1">
        <span className="font-mono text-xs text-muted-foreground">
          {formatTimecode(currentTime)}
        </span>
        <span className="font-mono text-xs text-muted-foreground">
          {formatTimecode(duration)}
        </span>
      </div>
    </div>
  );
});

Timeline.displayName = 'Timeline';
