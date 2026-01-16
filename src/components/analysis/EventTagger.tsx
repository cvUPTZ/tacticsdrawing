import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import {
  Keyboard,
  MapPin,
  Clock,
  Trash2,
  Download,
  X,
} from 'lucide-react';
import { TaggedEvent, EVENT_TYPES, PitchCoord, VideoCoord } from '@/types/calibration';
import { PITCH_DIMENSIONS, getPitchZone } from '@/utils/pitchConstants';
import { generateId } from '@/utils/homography';

interface EventTaggerProps {
  isActive: boolean;
  hasCalibration: boolean;
  currentTime: number;
  mousePosition: VideoCoord | null;
  pitchPosition: PitchCoord | null;
  events: TaggedEvent[];
  selectedTeam: 'home' | 'away';
  onAddEvent: (event: TaggedEvent) => void;
  onRemoveEvent: (eventId: string) => void;
  onClearEvents: () => void;
  onExportEvents: () => void;
  onTeamChange: (team: 'home' | 'away') => void;
}

export function EventTagger({
  isActive,
  hasCalibration,
  currentTime,
  mousePosition,
  pitchPosition,
  events,
  selectedTeam,
  onAddEvent,
  onRemoveEvent,
  onClearEvents,
  onExportEvents,
  onTeamChange,
}: EventTaggerProps) {
  const [lastKeyPressed, setLastKeyPressed] = useState<string | null>(null);

  // Handle hotkey events
  const handleHotkey = useCallback(
    (eventType: string) => {
      if (!hasCalibration || !mousePosition || !pitchPosition) return;

      const newEvent: TaggedEvent = {
        id: generateId(),
        timestamp: currentTime,
        video_coords: mousePosition,
        pitch_coords: pitchPosition,
        event_type: eventType,
        team: selectedTeam,
        created_at: new Date().toISOString(),
      };

      onAddEvent(newEvent);
      setLastKeyPressed(eventType);
      setTimeout(() => setLastKeyPressed(null), 500);
    },
    [hasCalibration, mousePosition, pitchPosition, currentTime, selectedTeam, onAddEvent]
  );

  // Listen for keyboard events
  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      const key = e.key.toUpperCase();
      const eventType = Object.entries(EVENT_TYPES).find(([_, config]) => config.key === key);

      if (eventType) {
        e.preventDefault();
        handleHotkey(eventType[0]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isActive, handleHotkey]);

  // Format time as MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isActive) return null;

  return (
    <div className="space-y-3">
      {/* Real-time position display */}
      {hasCalibration && pitchPosition && (
        <div className="p-3 bg-muted/50 rounded-lg border border-border/50">
          <div className="flex items-center justify-between mb-2">
            <Label className="text-xs font-medium flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" />
              Cursor Position
            </Label>
          </div>

          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="p-2 bg-background/50 rounded">
              <div className="text-lg font-mono font-bold">
                {pitchPosition.X.toFixed(1)}m
              </div>
              <div className="text-[10px] text-muted-foreground">X (Length)</div>
            </div>
            <div className="p-2 bg-background/50 rounded">
              <div className="text-lg font-mono font-bold">
                {pitchPosition.Y.toFixed(1)}m
              </div>
              <div className="text-[10px] text-muted-foreground">Y (Width)</div>
            </div>
          </div>

          <div className="mt-2 text-center">
            <Badge variant="outline" className="text-[10px]">
              {getPitchZone(pitchPosition.X, pitchPosition.Y)}
            </Badge>
          </div>
        </div>
      )}

      {/* Team selector */}
      <div className="flex gap-2">
        <Button
          variant={selectedTeam === 'home' ? 'default' : 'outline'}
          size="sm"
          onClick={() => onTeamChange('home')}
          className="flex-1 h-8 text-xs"
        >
          Home
        </Button>
        <Button
          variant={selectedTeam === 'away' ? 'default' : 'outline'}
          size="sm"
          onClick={() => onTeamChange('away')}
          className="flex-1 h-8 text-xs"
        >
          Away
        </Button>
      </div>

      {/* Hotkey legend */}
      <div className="p-3 bg-muted/50 rounded-lg border border-border/50">
        <Label className="text-xs font-medium flex items-center gap-1.5 mb-2">
          <Keyboard className="h-3.5 w-3.5" />
          Event Hotkeys
        </Label>

        <div className="grid grid-cols-2 gap-1">
          {Object.entries(EVENT_TYPES).map(([type, config]) => (
            <div
              key={type}
              className={`flex items-center gap-1.5 p-1.5 rounded text-xs transition-all ${
                lastKeyPressed === type
                  ? 'bg-primary text-primary-foreground scale-105'
                  : 'bg-background/50'
              }`}
            >
              <kbd
                className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold"
                style={{ backgroundColor: config.color + '30', color: config.color }}
              >
                {config.key}
              </kbd>
              <span className="truncate">{config.label}</span>
            </div>
          ))}
        </div>

        {!hasCalibration && (
          <p className="text-[10px] text-muted-foreground mt-2 text-center">
            Calibrate the pitch first to enable event tagging
          </p>
        )}
      </div>

      {/* Event list */}
      {events.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-medium">
              Tagged Events ({events.length})
            </Label>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={onExportEvents}
                className="h-6 text-[10px] gap-1"
              >
                <Download className="h-3 w-3" />
                Export
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClearEvents}
                className="h-6 text-[10px] gap-1 text-destructive"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>

          <ScrollArea className="h-40">
            <div className="space-y-1">
              {events
                .slice()
                .reverse()
                .map(event => {
                  const config = EVENT_TYPES[event.event_type];
                  return (
                    <div
                      key={event.id}
                      className="flex items-center gap-2 p-2 bg-muted/30 rounded text-xs group"
                    >
                      <Badge
                        variant="outline"
                        className="text-[9px] shrink-0"
                        style={{
                          backgroundColor: config?.color + '20',
                          borderColor: config?.color,
                          color: config?.color,
                        }}
                      >
                        {config?.label || event.event_type}
                      </Badge>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Clock className="h-2.5 w-2.5" />
                          <span>{formatTime(event.timestamp)}</span>
                        </div>
                        <div className="truncate text-[10px]">
                          ({event.pitch_coords.X.toFixed(1)}, {event.pitch_coords.Y.toFixed(1)})
                        </div>
                      </div>
                      <Badge
                        variant="secondary"
                        className="text-[8px] shrink-0"
                      >
                        {event.team}
                      </Badge>
                      <button
                        onClick={() => onRemoveEvent(event.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                      </button>
                    </div>
                  );
                })}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Pitch diagram with events */}
      {events.length > 0 && (
        <div className="relative aspect-[105/68] bg-green-900/30 rounded border border-border/50 overflow-hidden">
          <svg
            viewBox={`0 0 ${PITCH_DIMENSIONS.length} ${PITCH_DIMENSIONS.width}`}
            className="absolute inset-0 w-full h-full"
          >
            {/* Pitch outline */}
            <rect
              x="0"
              y="0"
              width={PITCH_DIMENSIONS.length}
              height={PITCH_DIMENSIONS.width}
              fill="none"
              stroke="rgba(255,255,255,0.3)"
              strokeWidth="0.5"
            />
            {/* Center line */}
            <line
              x1={PITCH_DIMENSIONS.length / 2}
              y1="0"
              x2={PITCH_DIMENSIONS.length / 2}
              y2={PITCH_DIMENSIONS.width}
              stroke="rgba(255,255,255,0.3)"
              strokeWidth="0.3"
            />
            {/* Center circle */}
            <circle
              cx={PITCH_DIMENSIONS.length / 2}
              cy={PITCH_DIMENSIONS.width / 2}
              r="9.15"
              fill="none"
              stroke="rgba(255,255,255,0.3)"
              strokeWidth="0.3"
            />
            {/* Events */}
            {events.map(event => {
              const config = EVENT_TYPES[event.event_type];
              return (
                <circle
                  key={event.id}
                  cx={event.pitch_coords.X}
                  cy={event.pitch_coords.Y}
                  r="1.5"
                  fill={config?.color || '#fff'}
                  stroke="white"
                  strokeWidth="0.3"
                  opacity="0.8"
                />
              );
            })}
          </svg>
        </div>
      )}
    </div>
  );
}
