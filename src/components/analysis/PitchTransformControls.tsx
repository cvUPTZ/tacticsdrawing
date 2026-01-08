import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { RotateCcw, Move, RotateCw, Maximize2 } from 'lucide-react';
import { useState } from 'react';

export interface PitchTransform {
  positionX: number;
  positionY: number;
  positionZ: number;
  rotationX: number;
  rotationY: number;
  rotationZ: number;
  scaleX: number;
  scaleY: number;
  scaleZ: number;
}

interface PitchTransformControlsProps {
  transform: PitchTransform;
  onChange: (transform: PitchTransform) => void;
  onReset: () => void;
}

const DEFAULT_TRANSFORM: PitchTransform = {
  positionX: 0,
  positionY: 0,
  positionZ: 0,
  rotationX: 0,
  rotationY: 0,
  rotationZ: 0,
  scaleX: 1,
  scaleY: 1,
  scaleZ: 1,
};

export function PitchTransformControls({
  transform,
  onChange,
  onReset,
}: PitchTransformControlsProps) {
  const [activeTab, setActiveTab] = useState<'position' | 'rotation' | 'scale'>('position');

  const radToDeg = (rad: number) => (rad * (180 / Math.PI)).toFixed(1);

  const update = (key: keyof PitchTransform, value: number) => {
    onChange({ ...transform, [key]: value });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
          <Maximize2 className="h-3 w-3" />
          Pitch Transform
        </Label>
        <Button
          variant="ghost"
          size="icon"
          onClick={onReset}
          className="h-5 w-5"
          title="Reset transform"
        >
          <RotateCcw className="h-3 w-3" />
        </Button>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 p-0.5 bg-muted rounded-md">
        <button
          onClick={() => setActiveTab('position')}
          className={`flex-1 flex items-center justify-center gap-1 py-1 px-2 rounded text-[9px] font-medium transition-colors ${
            activeTab === 'position'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Move className="h-3 w-3" />
          Position
        </button>
        <button
          onClick={() => setActiveTab('rotation')}
          className={`flex-1 flex items-center justify-center gap-1 py-1 px-2 rounded text-[9px] font-medium transition-colors ${
            activeTab === 'rotation'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <RotateCw className="h-3 w-3" />
          Rotation
        </button>
        <button
          onClick={() => setActiveTab('scale')}
          className={`flex-1 flex items-center justify-center gap-1 py-1 px-2 rounded text-[9px] font-medium transition-colors ${
            activeTab === 'scale'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Maximize2 className="h-3 w-3" />
          Scale
        </button>
      </div>

      {/* Position controls */}
      {activeTab === 'position' && (
        <div className="space-y-2">
          <div className="space-y-1">
            <div className="flex justify-between">
              <Label className="text-[9px] text-muted-foreground">X Position</Label>
              <span className="text-[9px] font-mono text-muted-foreground">{transform.positionX.toFixed(1)}</span>
            </div>
            <Slider
              value={[transform.positionX]}
              onValueChange={([v]) => update('positionX', v)}
              min={-100}
              max={100}
              step={0.5}
            />
          </div>
          <div className="space-y-1">
            <div className="flex justify-between">
              <Label className="text-[9px] text-muted-foreground">Y Position</Label>
              <span className="text-[9px] font-mono text-muted-foreground">{transform.positionY.toFixed(1)}</span>
            </div>
            <Slider
              value={[transform.positionY]}
              onValueChange={([v]) => update('positionY', v)}
              min={-50}
              max={50}
              step={0.5}
            />
          </div>
          <div className="space-y-1">
            <div className="flex justify-between">
              <Label className="text-[9px] text-muted-foreground">Z Position</Label>
              <span className="text-[9px] font-mono text-muted-foreground">{transform.positionZ.toFixed(1)}</span>
            </div>
            <Slider
              value={[transform.positionZ]}
              onValueChange={([v]) => update('positionZ', v)}
              min={-100}
              max={100}
              step={0.5}
            />
          </div>
        </div>
      )}

      {/* Rotation controls */}
      {activeTab === 'rotation' && (
        <div className="space-y-2">
          <div className="space-y-1">
            <div className="flex justify-between">
              <Label className="text-[9px] text-muted-foreground">X Rotation (Pitch)</Label>
              <span className="text-[9px] font-mono text-muted-foreground">{radToDeg(transform.rotationX)}°</span>
            </div>
            <Slider
              value={[transform.rotationX]}
              onValueChange={([v]) => update('rotationX', v)}
              min={-Math.PI / 2}
              max={Math.PI / 2}
              step={0.01}
            />
          </div>
          <div className="space-y-1">
            <div className="flex justify-between">
              <Label className="text-[9px] text-muted-foreground">Y Rotation (Yaw)</Label>
              <span className="text-[9px] font-mono text-muted-foreground">{radToDeg(transform.rotationY)}°</span>
            </div>
            <Slider
              value={[transform.rotationY]}
              onValueChange={([v]) => update('rotationY', v)}
              min={-Math.PI}
              max={Math.PI}
              step={0.01}
            />
          </div>
          <div className="space-y-1">
            <div className="flex justify-between">
              <Label className="text-[9px] text-muted-foreground">Z Rotation (Roll)</Label>
              <span className="text-[9px] font-mono text-muted-foreground">{radToDeg(transform.rotationZ)}°</span>
            </div>
            <Slider
              value={[transform.rotationZ]}
              onValueChange={([v]) => update('rotationZ', v)}
              min={-Math.PI / 4}
              max={Math.PI / 4}
              step={0.01}
            />
          </div>
        </div>
      )}

      {/* Scale controls */}
      {activeTab === 'scale' && (
        <div className="space-y-2">
          <div className="space-y-1">
            <div className="flex justify-between">
              <Label className="text-[9px] text-muted-foreground">X Scale (Width)</Label>
              <span className="text-[9px] font-mono text-muted-foreground">{(transform.scaleX * 100).toFixed(0)}%</span>
            </div>
            <Slider
              value={[transform.scaleX]}
              onValueChange={([v]) => update('scaleX', v)}
              min={0.2}
              max={2}
              step={0.01}
            />
          </div>
          <div className="space-y-1">
            <div className="flex justify-between">
              <Label className="text-[9px] text-muted-foreground">Y Scale (Height)</Label>
              <span className="text-[9px] font-mono text-muted-foreground">{(transform.scaleY * 100).toFixed(0)}%</span>
            </div>
            <Slider
              value={[transform.scaleY]}
              onValueChange={([v]) => update('scaleY', v)}
              min={0.2}
              max={2}
              step={0.01}
            />
          </div>
          <div className="space-y-1">
            <div className="flex justify-between">
              <Label className="text-[9px] text-muted-foreground">Z Scale (Depth)</Label>
              <span className="text-[9px] font-mono text-muted-foreground">{(transform.scaleZ * 100).toFixed(0)}%</span>
            </div>
            <Slider
              value={[transform.scaleZ]}
              onValueChange={([v]) => update('scaleZ', v)}
              min={0.2}
              max={2}
              step={0.01}
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const avg = (transform.scaleX + transform.scaleY + transform.scaleZ) / 3;
              onChange({ ...transform, scaleX: avg, scaleY: avg, scaleZ: avg });
            }}
            className="w-full h-6 text-[9px] mt-2"
          >
            Uniform Scale
          </Button>
        </div>
      )}
    </div>
  );
}

export { DEFAULT_TRANSFORM };
