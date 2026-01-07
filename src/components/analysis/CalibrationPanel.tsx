import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { CalibrationState } from '@/types/analysis';
import { RotateCcw, Camera } from 'lucide-react';

interface CalibrationPanelProps {
  calibration: CalibrationState;
  isCalibrating: boolean;
  onUpdate: (updates: Partial<CalibrationState>) => void;
  onReset: () => void;
  onToggleCalibrating: () => void;
  onApplyPreset: (preset: 'broadcast' | 'tactical' | 'sideline' | 'behindGoal') => void;
}

const PRESETS = [
  { id: 'broadcast' as const, label: 'Broadcast' },
  { id: 'tactical' as const, label: 'Tactical' },
  { id: 'sideline' as const, label: 'Sideline' },
  { id: 'behindGoal' as const, label: 'Behind Goal' },
];

export function CalibrationPanel({
  calibration,
  isCalibrating,
  onUpdate,
  onReset,
  onToggleCalibrating,
  onApplyPreset,
}: CalibrationPanelProps) {
  return (
    <div className="glass-panel rounded-lg p-3 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Camera className="h-4 w-4 text-primary" />
          <span className="hud-text text-[10px]">Camera Calibration</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onReset}
          className="h-6 w-6"
          title="Reset calibration"
        >
          <RotateCcw className="h-3 w-3" />
        </Button>
      </div>

      {/* Presets */}
      <div className="flex flex-wrap gap-1">
        {PRESETS.map((preset) => (
          <Button
            key={preset.id}
            variant="outline"
            size="sm"
            onClick={() => onApplyPreset(preset.id)}
            className="h-6 text-[10px] px-2"
          >
            {preset.label}
          </Button>
        ))}
      </div>

      {/* Position sliders */}
      <div className="space-y-3">
        <div className="space-y-1">
          <div className="flex justify-between">
            <Label className="text-[10px] text-muted-foreground">X Position</Label>
            <span className="text-[10px] font-mono text-muted-foreground">{calibration.cameraX.toFixed(1)}</span>
          </div>
          <Slider
            value={[calibration.cameraX]}
            onValueChange={([v]) => onUpdate({ cameraX: v })}
            min={-100}
            max={100}
            step={0.5}
          />
        </div>

        <div className="space-y-1">
          <div className="flex justify-between">
            <Label className="text-[10px] text-muted-foreground">Y Height</Label>
            <span className="text-[10px] font-mono text-muted-foreground">{calibration.cameraY.toFixed(1)}</span>
          </div>
          <Slider
            value={[calibration.cameraY]}
            onValueChange={([v]) => onUpdate({ cameraY: v })}
            min={5}
            max={150}
            step={0.5}
          />
        </div>

        <div className="space-y-1">
          <div className="flex justify-between">
            <Label className="text-[10px] text-muted-foreground">Z Depth</Label>
            <span className="text-[10px] font-mono text-muted-foreground">{calibration.cameraZ.toFixed(1)}</span>
          </div>
          <Slider
            value={[calibration.cameraZ]}
            onValueChange={([v]) => onUpdate({ cameraZ: v })}
            min={-100}
            max={150}
            step={0.5}
          />
        </div>

        <div className="space-y-1">
          <div className="flex justify-between">
            <Label className="text-[10px] text-muted-foreground">FOV</Label>
            <span className="text-[10px] font-mono text-muted-foreground">{calibration.cameraFov.toFixed(0)}°</span>
          </div>
          <Slider
            value={[calibration.cameraFov]}
            onValueChange={([v]) => onUpdate({ cameraFov: v })}
            min={20}
            max={120}
            step={1}
          />
        </div>

        <div className="space-y-1">
          <div className="flex justify-between">
            <Label className="text-[10px] text-muted-foreground">Tilt</Label>
            <span className="text-[10px] font-mono text-muted-foreground">{(calibration.cameraRotationX * (180/Math.PI)).toFixed(1)}°</span>
          </div>
          <Slider
            value={[calibration.cameraRotationX]}
            onValueChange={([v]) => onUpdate({ cameraRotationX: v })}
            min={-1.5}
            max={0}
            step={0.01}
          />
        </div>

        <div className="space-y-1">
          <div className="flex justify-between">
            <Label className="text-[10px] text-muted-foreground">Pan</Label>
            <span className="text-[10px] font-mono text-muted-foreground">{(calibration.cameraRotationY * (180/Math.PI)).toFixed(1)}°</span>
          </div>
          <Slider
            value={[calibration.cameraRotationY]}
            onValueChange={([v]) => onUpdate({ cameraRotationY: v })}
            min={-Math.PI}
            max={Math.PI}
            step={0.01}
          />
        </div>
      </div>
    </div>
  );
}
