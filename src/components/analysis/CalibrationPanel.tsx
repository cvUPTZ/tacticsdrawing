import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { CalibrationState } from '@/types/analysis';
import { RotateCcw, Camera, Move3D } from 'lucide-react';
import { useState } from 'react';

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
  const [activeTab, setActiveTab] = useState<'position' | 'rotation'>('position');

  const radToDeg = (rad: number) => (rad * (180 / Math.PI)).toFixed(1);
  const degToRad = (deg: number) => deg * (Math.PI / 180);

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

      {/* Tab switcher */}
      <div className="flex gap-1 p-0.5 bg-muted rounded-md">
        <button
          onClick={() => setActiveTab('position')}
          className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded text-[10px] font-medium transition-colors ${
            activeTab === 'position' 
              ? 'bg-background text-foreground shadow-sm' 
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Camera className="h-3 w-3" />
          Position
        </button>
        <button
          onClick={() => setActiveTab('rotation')}
          className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded text-[10px] font-medium transition-colors ${
            activeTab === 'rotation' 
              ? 'bg-background text-foreground shadow-sm' 
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Move3D className="h-3 w-3" />
          Rotation
        </button>
      </div>

      {/* Position sliders */}
      {activeTab === 'position' && (
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
        </div>
      )}

      {/* Rotation sliders (Pitch, Yaw, Roll) */}
      {activeTab === 'rotation' && (
        <div className="space-y-3">
          <div className="space-y-1">
            <div className="flex justify-between">
              <Label className="text-[10px] text-muted-foreground">
                Pitch (X) 
                <span className="text-[8px] ml-1 opacity-60">tilt up/down</span>
              </Label>
              <span className="text-[10px] font-mono text-muted-foreground">{radToDeg(calibration.cameraRotationX)}°</span>
            </div>
            <Slider
              value={[calibration.cameraRotationX]}
              onValueChange={([v]) => onUpdate({ cameraRotationX: v })}
              min={-Math.PI / 2}
              max={Math.PI / 2}
              step={0.01}
            />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between">
              <Label className="text-[10px] text-muted-foreground">
                Yaw (Y)
                <span className="text-[8px] ml-1 opacity-60">turn left/right</span>
              </Label>
              <span className="text-[10px] font-mono text-muted-foreground">{radToDeg(calibration.cameraRotationY)}°</span>
            </div>
            <Slider
              value={[calibration.cameraRotationY]}
              onValueChange={([v]) => onUpdate({ cameraRotationY: v })}
              min={-Math.PI}
              max={Math.PI}
              step={0.01}
            />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between">
              <Label className="text-[10px] text-muted-foreground">
                Roll (Z)
                <span className="text-[8px] ml-1 opacity-60">tilt side</span>
              </Label>
              <span className="text-[10px] font-mono text-muted-foreground">{radToDeg(calibration.cameraRotationZ)}°</span>
            </div>
            <Slider
              value={[calibration.cameraRotationZ]}
              onValueChange={([v]) => onUpdate({ cameraRotationZ: v })}
              min={-Math.PI / 4}
              max={Math.PI / 4}
              step={0.01}
            />
          </div>

          {/* Quick reset buttons for each axis */}
          <div className="flex gap-1 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onUpdate({ cameraRotationX: -0.5 })}
              className="flex-1 h-6 text-[9px]"
            >
              Reset Pitch
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onUpdate({ cameraRotationY: 0 })}
              className="flex-1 h-6 text-[9px]"
            >
              Reset Yaw
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onUpdate({ cameraRotationZ: 0 })}
              className="flex-1 h-6 text-[9px]"
            >
              Reset Roll
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
