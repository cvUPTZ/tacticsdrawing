import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { CalibrationState } from "@/types/analysis";
import { RotateCcw, Camera, Move3D, Maximize2, MousePointer2, Grid3X3, Wand2, Save, Trash2, Flame } from "lucide-react";
import { useState } from "react";
import { GridOverlayType } from "./ThreeCanvas";
import { HeatmapType } from "./HeatmapOverlay";
import { CalibrationPreset } from "@/hooks/useCalibrationPresets";
import { PointCalibration, CalibrationPoint } from "./PointCalibration";
import { DirectPitchManipulation, PitchControlPoint } from "./DirectPitchManipulation";

interface PitchScale {
  width: number;
  height: number;
}

export interface CornerCalibrationPoint {
  id: "topLeft" | "topRight" | "bottomLeft" | "bottomRight";
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
  onApplyPreset: (preset: "broadcast" | "tactical" | "sideline" | "behindGoal") => void;
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
  customPresets?: CalibrationPreset[];
  onSavePreset?: (name: string) => void;
  onLoadPreset?: (preset: CalibrationPreset) => void;
  onDeletePreset?: (id: string) => void;
  heatmapType?: HeatmapType;
  onHeatmapChange?: (type: HeatmapType) => void;
  isPointCalibrating?: boolean;
  onTogglePointCalibrating?: () => void;
  calibrationPoints?: CalibrationPoint[];
  activeCalibrationPointId?: string | null;
  onSetActiveCalibrationPoint?: (id: string | null) => void;
  onAddCalibrationPoint?: (point: CalibrationPoint) => void;
  onRemoveCalibrationPoint?: (id: string) => void;
  onClearCalibrationPoints?: () => void;
  onPointAutoCalibrate?: () => void;
  isDirectManipulating?: boolean;
  onToggleDirectManipulating?: () => void;
  pitchControlPoints?: PitchControlPoint[];
  activeControlPointId?: string | null;
  onSetActiveControlPoint?: (id: string | null) => void;
  onUpdateControlPoint?: (id: string, x: number, z: number) => void;
  onResetControlPoint?: (id: string) => void;
  onResetAllControlPoints?: () => void;
  onAddGridPoints?: () => void;
}

const PRESETS = [
  { id: "broadcast" as const, label: "Broadcast" },
  { id: "tactical" as const, label: "Tactical" },
  { id: "sideline" as const, label: "Sideline" },
  { id: "behindGoal" as const, label: "Behind Goal" },
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
  gridOverlay = "none",
  onGridOverlayChange,
  customPresets = [],
  onSavePreset,
  onLoadPreset,
  onDeletePreset,
  heatmapType = "none",
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
  isDirectManipulating = false,
  onToggleDirectManipulating,
  pitchControlPoints = [],
  activeControlPointId,
  onSetActiveControlPoint,
  onUpdateControlPoint,
  onResetControlPoint,
  onResetAllControlPoints,
  onAddGridPoints,
}: CalibrationPanelProps) {
  const [activeTab, setActiveTab] = useState<"position" | "rotation" | "pitch">("position");
  const [newPresetName, setNewPresetName] = useState("");

  const radToDeg = (rad: number) => (rad * (180 / Math.PI)).toFixed(1);

  const cornerLabels = [
    { id: "topLeft", label: "Top Left", icon: "↖" },
    { id: "topRight", label: "Top Right", icon: "↗" },
    { id: "bottomLeft", label: "Bottom Left", icon: "↙" },
    { id: "bottomRight", label: "Bottom Right", icon: "↘" },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-1.5">
          <Camera className="h-3.5 w-3.5" />
          Camera Calibration
        </h3>
        <Button onClick={onReset} variant="ghost" size="sm" className="h-7 px-2 text-[10px]">
          <RotateCcw className="h-3 w-3 mr-1" />
          Reset
        </Button>
      </div>

      <div className="flex gap-1.5">
        {PRESETS.map((preset) => (
          <Button
            key={preset.id}
            onClick={() => onApplyPreset(preset.id)}
            variant="outline"
            className="h-6 text-[10px] px-2"
          >
            {preset.label}
          </Button>
        ))}
      </div>

      {onSavePreset && (
        <div className="space-y-2 p-2 rounded-md border border-border/50">
          <div className="flex items-center gap-1.5 justify-between">
            <Label className="text-[10px] font-semibold text-muted-foreground">Custom Presets</Label>
          </div>
          <div className="flex gap-1.5">
            <Input
              value={newPresetName}
              onChange={(e) => setNewPresetName(e.target.value)}
              placeholder="Preset name..."
              className="h-7 text-[10px] flex-1"
            />
            <Button
              onClick={() => {
                if (newPresetName.trim()) {
                  onSavePreset(newPresetName.trim());
                  setNewPresetName("");
                }
              }}
              disabled={!newPresetName.trim()}
              variant="outline"
              className="h-7 text-[9px] px-2"
            >
              <Save className="h-3 w-3" />
            </Button>
          </div>
          {customPresets.length > 0 && (
            <div className="space-y-1">
              {customPresets.map((preset) => (
                <div key={preset.id} className="flex items-center gap-1.5">
                  <Button onClick={() => onLoadPreset?.(preset)} variant="ghost" className="h-6 text-[9px] px-2">
                    {preset.name}
                  </Button>
                  <Button
                    onClick={() => onDeletePreset?.(preset.id)}
                    variant="ghost"
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

      <div className="flex gap-1 p-1 bg-muted/30 rounded-md">
        <button
          onClick={() => setActiveTab("position")}
          className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded text-[10px] font-medium transition-colors ${
            activeTab === "position"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Move3D className="h-3 w-3" />
          Position
        </button>
        <button
          onClick={() => setActiveTab("rotation")}
          className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded text-[10px] font-medium transition-colors ${
            activeTab === "rotation"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <RotateCcw className="h-3 w-3" />
          Rotation
        </button>
        <button
          onClick={() => setActiveTab("pitch")}
          className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded text-[10px] font-medium transition-colors ${
            activeTab === "pitch"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Maximize2 className="h-3 w-3" />
          Pitch
        </button>
      </div>

      {activeTab === "position" && (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-[10px] text-muted-foreground">X Position</Label>
              <span className="text-[10px] font-mono text-foreground">{calibration.cameraX.toFixed(1)}</span>
            </div>
            <Slider
              value={[calibration.cameraX]}
              onValueChange={(v) => onUpdate({ cameraX: v[0] })}
              min={-100}
              max={100}
              step={0.5}
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-[10px] text-muted-foreground">Y Height</Label>
              <span className="text-[10px] font-mono text-foreground">{calibration.cameraY.toFixed(1)}</span>
            </div>
            <Slider
              value={[calibration.cameraY]}
              onValueChange={(v) => onUpdate({ cameraY: v[0] })}
              min={5}
              max={150}
              step={0.5}
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-[10px] text-muted-foreground">Z Depth</Label>
              <span className="text-[10px] font-mono text-foreground">{calibration.cameraZ.toFixed(1)}</span>
            </div>
            <Slider
              value={[calibration.cameraZ]}
              onValueChange={(v) => onUpdate({ cameraZ: v[0] })}
              min={-100}
              max={150}
              step={0.5}
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-[10px] text-muted-foreground">FOV</Label>
              <span className="text-[10px] font-mono text-foreground">{calibration.cameraFov.toFixed(0)}°</span>
            </div>
            <Slider
              value={[calibration.cameraFov]}
              onValueChange={(v) => onUpdate({ cameraFov: v[0] })}
              min={20}
              max={120}
              step={1}
            />
          </div>
        </div>
      )}

      {activeTab === "rotation" && (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-[10px] text-muted-foreground">Pitch (X) tilt up/down</Label>
              <span className="text-[10px] font-mono text-foreground">{radToDeg(calibration.cameraRotationX)}°</span>
            </div>
            <Slider
              value={[calibration.cameraRotationX]}
              onValueChange={(v) => onUpdate({ cameraRotationX: v[0] })}
              min={-Math.PI / 2}
              max={Math.PI / 2}
              step={0.01}
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-[10px] text-muted-foreground">Yaw (Y) turn left/right</Label>
              <span className="text-[10px] font-mono text-foreground">{radToDeg(calibration.cameraRotationY)}°</span>
            </div>
            <Slider
              value={[calibration.cameraRotationY]}
              onValueChange={(v) => onUpdate({ cameraRotationY: v[0] })}
              min={-Math.PI}
              max={Math.PI}
              step={0.01}
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-[10px] text-muted-foreground">Roll (Z) tilt side</Label>
              <span className="text-[10px] font-mono text-foreground">{radToDeg(calibration.cameraRotationZ)}°</span>
            </div>
            <Slider
              value={[calibration.cameraRotationZ]}
              onValueChange={(v) => onUpdate({ cameraRotationZ: v[0] })}
              min={-Math.PI / 4}
              max={Math.PI / 4}
              step={0.01}
            />
          </div>

          <div className="flex gap-1.5 pt-1">
            <Button
              onClick={() => onUpdate({ cameraRotationX: -0.5 })}
              variant="outline"
              className="flex-1 h-6 text-[9px]"
            >
              Reset Pitch
            </Button>
            <Button
              onClick={() => onUpdate({ cameraRotationY: 0 })}
              variant="outline"
              className="flex-1 h-6 text-[9px]"
            >
              Reset Yaw
            </Button>
            <Button
              onClick={() => onUpdate({ cameraRotationZ: 0 })}
              variant="outline"
              className="flex-1 h-6 text-[9px]"
            >
              Reset Roll
            </Button>
          </div>
        </div>
      )}

      {activeTab === "pitch" && (
        <div className="space-y-3">
          {onToggleDirectManipulating && (
            <DirectPitchManipulation
              isManipulating={isDirectManipulating}
              onToggleManipulating={onToggleDirectManipulating}
              controlPoints={pitchControlPoints}
              activePointId={activeControlPointId}
              onSetActivePoint={onSetActiveControlPoint || (() => {})}
              onUpdatePoint={onUpdateControlPoint || (() => {})}
              onResetPoint={onResetControlPoint || (() => {})}
              onResetAll={onResetAllControlPoints || (() => {})}
              onAddGridPoints={onAddGridPoints || (() => {})}
            />
          )}

          {onTogglePointCalibrating && (
            <PointCalibration
              isCalibrating={isPointCalibrating}
              points={calibrationPoints}
              activePointId={activeCalibrationPointId}
              onToggleCalibrating={onTogglePointCalibrating}
              onSetActivePoint={onSetActiveCalibrationPoint || (() => {})}
              onAddPoint={onAddCalibrationPoint || (() => {})}
              onRemovePoint={onRemoveCalibrationPoint || (() => {})}
              onClearPoints={onClearCalibrationPoints || (() => {})}
              onAutoCalibrate={onPointAutoCalibrate || (() => {})}
            />
          )}

          {onToggleCornerCalibrating && (
            <div className="space-y-2">
              <Button
                onClick={onToggleCornerCalibrating}
                variant={isCornerCalibrating ? "default" : "outline"}
                className="w-full h-7 text-[10px]"
              >
                <MousePointer2 className="h-3 w-3 mr-1.5" />
                Manual Calibration
                <span className="ml-auto text-[9px]">{isCornerCalibrating ? "Done" : "Start"}</span>
              </Button>

              {isCornerCalibrating && (
                <div className="space-y-2 p-2 bg-muted/30 rounded-md">
                  <p className="text-[9px] text-muted-foreground leading-tight">
                    Click corners below, then click on the video where each corner should be:
                  </p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {cornerLabels.map((corner) => {
                      const point = cornerPoints.find((p) => p.id === corner.id);
                      const isSet = point?.screenX !== undefined;
                      const isActive = activeCorner === corner.id;
                      return (
                        <Button
                          key={corner.id}
                          onClick={() => onSetActiveCorner?.(isActive ? null : corner.id)}
                          variant={isActive ? "default" : "outline"}
                          className={`h-7 text-[9px] gap-1 ${isSet ? "border-primary/50" : ""}`}
                        >
                          {corner.icon} {corner.label}
                          {isSet && <span className="ml-auto">✓</span>}
                        </Button>
                      );
                    })}
                  </div>

                  {onAutoCalibrate && cornerPoints.filter((p) => p.screenX !== undefined).length === 4 && (
                    <Button onClick={onAutoCalibrate} className="w-full h-6 text-[9px]" variant="default">
                      <Wand2 className="h-3 w-3 mr-1" />
                      Auto-Calibrate from Points
                    </Button>
                  )}

                  <Button
                    onClick={() => {
                      cornerLabels.forEach((c) => onSetActiveCorner?.(null));
                    }}
                    variant="ghost"
                    className="w-full h-6 text-[9px] text-muted-foreground"
                  >
                    Clear All Points
                  </Button>
                </div>
              )}
            </div>
          )}

          {onGridOverlayChange && (
            <div className="space-y-2">
              <Label className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1.5">
                <Grid3X3 className="h-3 w-3" />
                Grid Overlay
              </Label>
              <div className="grid grid-cols-3 gap-1.5">
                {(["none", "thirds", "halves", "channels", "zones"] as GridOverlayType[]).map((type) => (
                  <Button
                    key={type}
                    onClick={() => onGridOverlayChange(type)}
                    variant={gridOverlay === type ? "default" : "outline"}
                    className="h-6 text-[9px] capitalize"
                  >
                    {type === "none" ? "Off" : type}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {onHeatmapChange && (
            <div className="space-y-2">
              <Label className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1.5">
                <Flame className="h-3 w-3" />
                Heatmap
              </Label>
              <div className="grid grid-cols-2 gap-1.5">
                {(["none", "player_positions", "ball_movement", "all_activity"] as const).map((type) => (
                  <Button
                    key={type}
                    onClick={() => onHeatmapChange(type)}
                    variant={heatmapType === type ? "default" : "outline"}
                    className="h-6 text-[9px]"
                  >
                    {type === "none"
                      ? "Off"
                      : type === "player_positions"
                        ? "Players"
                        : type === "ball_movement"
                          ? "Ball"
                          : "All"}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {onPitchScaleChange && (
            <>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-[10px] text-muted-foreground">Width Scale</Label>
                  <span className="text-[10px] font-mono text-foreground">{(pitchScale.width * 100).toFixed(0)}%</span>
                </div>
                <Slider
                  value={[pitchScale.width * 100]}
                  onValueChange={(v) => onPitchScaleChange({ ...pitchScale, width: v[0] / 100 })}
                  min={50}
                  max={200}
                  step={5}
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-[10px] text-muted-foreground">Height Scale</Label>
                  <span className="text-[10px] font-mono text-foreground">{(pitchScale.height * 100).toFixed(0)}%</span>
                </div>
                <Slider
                  value={[pitchScale.height * 100]}
                  onValueChange={(v) => onPitchScaleChange({ ...pitchScale, height: v[0] / 100 })}
                  min={50}
                  max={200}
                  step={5}
                />
              </div>

              <div className="flex gap-1.5">
                <Button
                  onClick={() => onPitchScaleChange({ width: 1, height: 1 })}
                  className="flex-1 h-6 text-[9px]"
                  variant="outline"
                >
                  Reset
                </Button>
                <Button
                  onClick={() => onPitchScaleChange({ width: 1.2, height: 1 })}
                  className="flex-1 h-6 text-[9px]"
                  variant="outline"
                >
                  Wide
                </Button>
                <Button
                  onClick={() => onPitchScaleChange({ width: 1, height: 1.2 })}
                  className="flex-1 h-6 text-[9px]"
                  variant="outline"
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
