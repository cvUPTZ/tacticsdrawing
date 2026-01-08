import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { CalibrationState } from '@/types/analysis';
import { RotateCcw, Camera, Move3D, Maximize2, MousePointer2, Grid3X3, Wand2, Save, Trash2, Flame, Hand } from 'lucide-react';
import { useState } from 'react';
import { GridOverlayType } from './ThreeCanvas';
import { HeatmapType } from './HeatmapOverlay';
import { CalibrationPreset } from '@/hooks/useCalibrationPresets';
import { PointCalibration, CalibrationPoint } from './PointCalibration';
import { PitchTransformControls, PitchTransform, DEFAULT_TRANSFORM } from './PitchTransformControls';
import { PitchCorners, DEFAULT_CORNERS } from './PitchManipulator';

interface PitchScale {
  width: number;
  height: number;
}

export interface CornerCalibrationPoint {
  id: 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';
  label: string;
  screenX?: number;
  screenY?: number;
}

interface CalibrationPanelProps {
  calibration: CalibrationState;
  isCalibrating: boolean;
  onUpdate: (updates: Partial<CalibrationState>) => void;
  onReset: () => void;
  onToggleCalibrating: () => void;
  onApplyPreset: (preset: 'broadcast' | 'tactical' | 'sideline' | 'behindGoal') => void;
  pitchScale?: PitchScale;
  onPitchScaleChange?: (scale: PitchScale) => void;
  isCornerCalibrating?: boolean;
  onToggleCornerCalibrating?: () => void;
  cornerPoints?: CornerCalibrationPoint[];
  activeCorner?: string | null;
  onSetActiveCorner?: (corner: string | null) => void;
  onAutoCalibrate?: () => void;
  gridOverlay?: GridOverlayType;
  onGridOverlayChange?: (overlay: GridOverlayType) => void;
  // Custom presets
  customPresets?: CalibrationPreset[];
  onSavePreset?: (name: string) => void;
  onLoadPreset?: (preset: CalibrationPreset) => void;
  onDeletePreset?: (id: string) => void;
  // Heatmap
  heatmapType?: HeatmapType;
  onHeatmapChange?: (type: HeatmapType) => void;
  // Point calibration
  isPointCalibrating?: boolean;
  onTogglePointCalibrating?: () => void;
  calibrationPoints?: CalibrationPoint[];
  activeCalibrationPointId?: string | null;
  onSetActiveCalibrationPoint?: (id: string | null) => void;
  onAddCalibrationPoint?: (point: CalibrationPoint) => void;
  onRemoveCalibrationPoint?: (id: string) => void;
  onClearCalibrationPoints?: () => void;
  onPointAutoCalibrate?: () => void;
  // Pitch transform
  pitchTransform?: PitchTransform;
  onPitchTransformChange?: (transform: PitchTransform) => void;
  onPitchTransformReset?: () => void;
  // Pitch manipulation (direct corner dragging)
  isPitchManipulating?: boolean;
  onTogglePitchManipulating?: () => void;
  pitchCorners?: PitchCorners;
  onPitchCornersChange?: (corners: PitchCorners) => void;
  onPitchCornersReset?: () => void;
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
  pitchScale = { width: 1, height: 1 },
  onPitchScaleChange,
  isCornerCalibrating,
  onToggleCornerCalibrating,
  cornerPoints = [],
  activeCorner,
  onSetActiveCorner,
  onAutoCalibrate,
  gridOverlay = 'none',
  onGridOverlayChange,
  customPresets = [],
  onSavePreset,
  onLoadPreset,
  onDeletePreset,
  heatmapType = 'none',
  onHeatmapChange,
  isPointCalibrating = false,
  onTogglePointCalibrating,
  calibrationPoints = [],
  activeCalibrationPointId,
  onSetActiveCalibrationPoint,
  onAddCalibrationPoint,
  onRemoveCalibrationPoint,
  onClearCalibrationPoints,
  onPointAutoCalibrate,
  pitchTransform = DEFAULT_TRANSFORM,
  onPitchTransformChange,
  onPitchTransformReset,
  isPitchManipulating = false,
  onTogglePitchManipulating,
  pitchCorners = DEFAULT_CORNERS,
  onPitchCornersChange,
  onPitchCornersReset,
}: CalibrationPanelProps) {
  const [activeTab, setActiveTab] = useState<'position' | 'rotation' | 'pitch'>('position');
  const [newPresetName, setNewPresetName] = useState('');
  const radToDeg = (rad: number) => (rad * (180 / Math.PI)).toFixed(1);
  const degToRad = (deg: number) => deg * (Math.PI / 180);

  const cornerLabels = [
    { id: 'topLeft', label: 'Top Left', icon: '↖' },
    { id: 'topRight', label: 'Top Right', icon: '↗' },
    { id: 'bottomLeft', label: 'Bottom Left', icon: '↙' },
    { id: 'bottomRight', label: 'Bottom Right', icon: '↘' },
  ];

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

      {/* Built-in Presets */}
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

      {/* Custom Presets */}
      {onSavePreset && (
        <div className="space-y-2">
          <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Save className="h-3 w-3" />
            Custom Presets
          </Label>
          <div className="flex gap-1">
            <Input
              value={newPresetName}
              onChange={(e) => setNewPresetName(e.target.value)}
              placeholder="Preset name..."
              className="h-7 text-[10px] flex-1"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (newPresetName.trim()) {
                  onSavePreset(newPresetName.trim());
                  setNewPresetName('');
                }
              }}
              disabled={!newPresetName.trim()}
              className="h-7 text-[9px] px-2"
            >
              <Save className="h-3 w-3" />
            </Button>
          </div>
          {customPresets.length > 0 && (
            <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
              {customPresets.map((preset) => (
                <div key={preset.id} className="flex items-center gap-0.5">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => onLoadPreset?.(preset)}
                    className="h-6 text-[9px] px-2"
                  >
                    {preset.name}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDeletePreset?.(preset.id)}
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

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
        <button
          onClick={() => setActiveTab('pitch')}
          className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded text-[10px] font-medium transition-colors ${
            activeTab === 'pitch' 
              ? 'bg-background text-foreground shadow-sm' 
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Maximize2 className="h-3 w-3" />
          Pitch
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

      {/* Pitch Scale sliders */}
      {activeTab === 'pitch' && onTogglePointCalibrating && (
        <PointCalibration
          isActive={isPointCalibrating}
          onToggle={onTogglePointCalibrating}
          points={calibrationPoints}
          activePointId={activeCalibrationPointId || null}
          onSetActivePoint={onSetActiveCalibrationPoint || (() => {})}
          onAddPoint={onAddCalibrationPoint || (() => {})}
          onRemovePoint={onRemoveCalibrationPoint || (() => {})}
          onClearPoints={onClearCalibrationPoints || (() => {})}
          onAutoCalibrate={onPointAutoCalibrate || (() => {})}
        />
      )}
      {activeTab === 'pitch' && onTogglePitchManipulating && (
        <div className="space-y-2 p-2 bg-accent/10 rounded-md border border-accent/30">
          <div className="flex items-center justify-between">
            <Label className="text-[10px] text-foreground flex items-center gap-1">
              <Hand className="h-3 w-3" />
              Direct Pitch Manipulation
            </Label>
            <Button
              variant={isPitchManipulating ? "default" : "outline"}
              size="sm"
              onClick={onTogglePitchManipulating}
              className="h-6 text-[9px]"
            >
              {isPitchManipulating ? 'Done' : 'Edit'}
            </Button>
          </div>
          {isPitchManipulating && (
            <div className="space-y-2">
              <p className="text-[9px] text-muted-foreground">
                Drag corners, edges, or center to stretch/move the pitch outline.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={onPitchCornersReset}
                className="w-full h-6 text-[9px] gap-1"
              >
                <RotateCcw className="h-3 w-3" />
                Reset Pitch Shape
              </Button>
            </div>
          )}
        </div>
      )}
      {activeTab === 'pitch' && onPitchTransformChange && !isPitchManipulating && (
        <PitchTransformControls
          transform={pitchTransform}
          onChange={onPitchTransformChange}
          onReset={onPitchTransformReset || (() => {})}
        />
      )}
      {activeTab === 'pitch' && (
        <div className="space-y-3 pt-2 border-t border-border/50">
          {/* Manual Corner Calibration */}
          {onToggleCornerCalibrating && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <MousePointer2 className="h-3 w-3" />
                  Manual Calibration
                </Label>
                <Button
                  variant={isCornerCalibrating ? "default" : "outline"}
                  size="sm"
                  onClick={onToggleCornerCalibrating}
                  className="h-6 text-[9px]"
                >
                  {isCornerCalibrating ? 'Done' : 'Start'}
                </Button>
              </div>
              
              {isCornerCalibrating && (
                <div className="space-y-2 p-2 bg-muted/50 rounded-md">
                  <p className="text-[9px] text-muted-foreground">
                    Click corners below, then click on the video where each corner should be:
                  </p>
                  <div className="grid grid-cols-2 gap-1">
                    {cornerLabels.map((corner) => {
                      const point = cornerPoints.find(p => p.id === corner.id);
                      const isSet = point?.screenX !== undefined;
                      const isActive = activeCorner === corner.id;
                      return (
                        <Button
                          key={corner.id}
                          variant={isActive ? "default" : isSet ? "secondary" : "outline"}
                          size="sm"
                          onClick={() => onSetActiveCorner?.(isActive ? null : corner.id)}
                          className={`h-7 text-[9px] gap-1 ${isSet ? 'border-primary/50' : ''}`}
                        >
                          <span>{corner.icon}</span>
                          <span className="truncate">{corner.label}</span>
                          {isSet && <span className="text-primary">✓</span>}
                        </Button>
                      );
                    })}
                  </div>
                  {/* Auto-calibrate button */}
                  {onAutoCalibrate && cornerPoints.filter(p => p.screenX !== undefined).length === 4 && (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={onAutoCalibrate}
                      className="w-full h-7 text-[9px] gap-1"
                    >
                      <Wand2 className="h-3 w-3" />
                      Auto-Calibrate from Points
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      cornerLabels.forEach(c => onSetActiveCorner?.(null));
                    }}
                    className="w-full h-6 text-[9px] text-muted-foreground"
                  >
                    Clear All Points
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Grid Overlay */}
          {onGridOverlayChange && (
            <div className="space-y-2">
              <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Grid3X3 className="h-3 w-3" />
                Grid Overlay
              </Label>
              <div className="grid grid-cols-3 gap-1">
                {(['none', 'thirds', 'halves', 'channels', 'zones'] as GridOverlayType[]).map((type) => (
                  <Button
                    key={type}
                    variant={gridOverlay === type ? "default" : "outline"}
                    size="sm"
                    onClick={() => onGridOverlayChange(type)}
                    className="h-6 text-[9px] capitalize"
                  >
                    {type === 'none' ? 'Off' : type}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Heatmap Overlay */}
          {onHeatmapChange && (
            <div className="space-y-2">
              <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Flame className="h-3 w-3" />
                Heatmap
              </Label>
              <div className="grid grid-cols-2 gap-1">
                {(['none', 'player_positions', 'ball_movement', 'all_activity'] as const).map((type) => (
                  <Button
                    key={type}
                    variant={heatmapType === type ? "default" : "outline"}
                    size="sm"
                    onClick={() => onHeatmapChange(type)}
                    className="h-6 text-[9px]"
                  >
                    {type === 'none' ? 'Off' : type === 'player_positions' ? 'Players' : type === 'ball_movement' ? 'Ball' : 'All'}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Scale sliders */}
          {onPitchScaleChange && (
            <>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <Label className="text-[10px] text-muted-foreground">
                    Width Scale
                    <span className="text-[8px] ml-1 opacity-60">stretch horizontal</span>
                  </Label>
                  <span className="text-[10px] font-mono text-muted-foreground">{(pitchScale.width * 100).toFixed(0)}%</span>
                </div>
                <Slider
                  value={[pitchScale.width * 100]}
                  onValueChange={([v]) => onPitchScaleChange({ ...pitchScale, width: v / 100 })}
                  min={50}
                  max={200}
                  step={5}
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between">
                  <Label className="text-[10px] text-muted-foreground">
                    Height Scale
                    <span className="text-[8px] ml-1 opacity-60">stretch vertical</span>
                  </Label>
                  <span className="text-[10px] font-mono text-muted-foreground">{(pitchScale.height * 100).toFixed(0)}%</span>
                </div>
                <Slider
                  value={[pitchScale.height * 100]}
                  onValueChange={([v]) => onPitchScaleChange({ ...pitchScale, height: v / 100 })}
                  min={50}
                  max={200}
                  step={5}
                />
              </div>

              {/* Quick presets */}
              <div className="flex gap-1 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onPitchScaleChange({ width: 1, height: 1 })}
                  className="flex-1 h-6 text-[9px]"
                >
                  Reset
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onPitchScaleChange({ width: 1.2, height: 1 })}
                  className="flex-1 h-6 text-[9px]"
                >
                  Wide
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onPitchScaleChange({ width: 1, height: 1.2 })}
                  className="flex-1 h-6 text-[9px]"
                >
                  Tall
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
