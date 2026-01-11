import { useState } from 'react';
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { 
  Move, 
  RotateCcw, 
  Maximize2, 
  Lock, 
  Unlock,
  Grid3X3,
  Square,
  ChevronDown,
  ChevronUp,
  Focus
} from "lucide-react";
import { PitchCorners, DEFAULT_CORNERS, LockedHandles, DEFAULT_LOCKED_HANDLES } from './PitchManipulator';
import { 
  PitchSectionSelector, 
  PitchSection, 
  ZoomLevel, 
  getInitialCornersForSection 
} from './PitchSectionSelector';

interface BlenderPitchControlsProps {
  isActive: boolean;
  onToggle: () => void;
  corners: PitchCorners;
  onCornersChange: (corners: PitchCorners) => void;
  onReset: () => void;
  lockedHandles?: LockedHandles;
  onLockedHandlesChange?: (locked: LockedHandles) => void;
  // Section selection
  selectedSection?: PitchSection;
  selectedZoom?: ZoomLevel;
  onSectionChange?: (section: PitchSection) => void;
  onZoomChange?: (zoom: ZoomLevel) => void;
  sectionConfirmed?: boolean;
  onSectionConfirm?: () => void;
}

type ControlMode = 'corners' | 'edges' | 'perspective';

export function BlenderPitchControls({
  isActive,
  onToggle,
  corners,
  onCornersChange,
  onReset,
  lockedHandles = DEFAULT_LOCKED_HANDLES,
  onLockedHandlesChange,
  selectedSection = 'full',
  selectedZoom = 'wide',
  onSectionChange,
  onZoomChange,
  sectionConfirmed = false,
  onSectionConfirm,
}: BlenderPitchControlsProps) {
  const [mode, setMode] = useState<ControlMode>('corners');
  const [lockAspect, setLockAspect] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showSectionSelector, setShowSectionSelector] = useState(!sectionConfirmed);

  // Toggle lock for a specific handle
  const toggleLock = (handleId: keyof LockedHandles) => {
    if (onLockedHandlesChange) {
      onLockedHandlesChange({
        ...lockedHandles,
        [handleId]: !lockedHandles[handleId],
      });
    }
  };

  // Count locked handles
  const lockedCount = Object.values(lockedHandles).filter(Boolean).length;

  // Calculate derived values
  const width = Math.abs(corners.topRight.x - corners.topLeft.x);
  const height = Math.abs(corners.bottomLeft.z - corners.topLeft.z);
  const centerX = (corners.topLeft.x + corners.topRight.x + corners.bottomLeft.x + corners.bottomRight.x) / 4;
  const centerZ = (corners.topLeft.z + corners.topRight.z + corners.bottomLeft.z + corners.bottomRight.z) / 4;
  
  // Perspective values (difference between top and bottom widths)
  const topWidth = corners.topRight.x - corners.topLeft.x;
  const bottomWidth = corners.bottomRight.x - corners.bottomLeft.x;
  const perspectiveX = bottomWidth - topWidth;
  
  // Shear (horizontal offset of top relative to bottom)
  const topCenterX = (corners.topLeft.x + corners.topRight.x) / 2;
  const bottomCenterX = (corners.bottomLeft.x + corners.bottomRight.x) / 2;
  const shearX = topCenterX - bottomCenterX;

  // Update individual corner
  const updateCorner = (corner: keyof PitchCorners, axis: 'x' | 'z', value: number) => {
    onCornersChange({
      ...corners,
      [corner]: {
        ...corners[corner],
        [axis]: value,
      },
    });
  };

  // Update edge (move two corners together)
  const updateEdge = (edge: 'top' | 'bottom' | 'left' | 'right', value: number) => {
    const newCorners = { ...corners };
    
    switch (edge) {
      case 'top':
        newCorners.topLeft.z = value;
        newCorners.topRight.z = value;
        break;
      case 'bottom':
        newCorners.bottomLeft.z = value;
        newCorners.bottomRight.z = value;
        break;
      case 'left':
        newCorners.topLeft.x = value;
        newCorners.bottomLeft.x = value;
        break;
      case 'right':
        newCorners.topRight.x = value;
        newCorners.bottomRight.x = value;
        break;
    }
    
    onCornersChange(newCorners);
  };

  // Update perspective (convergence)
  const updatePerspective = (value: number) => {
    const currentTopWidth = corners.topRight.x - corners.topLeft.x;
    const currentBottomWidth = corners.bottomRight.x - corners.bottomLeft.x;
    const avgWidth = (currentTopWidth + currentBottomWidth) / 2;
    
    // Adjust top corners symmetrically
    const topAdjust = value / 2;
    const topCenter = (corners.topLeft.x + corners.topRight.x) / 2;
    
    onCornersChange({
      ...corners,
      topLeft: { ...corners.topLeft, x: topCenter - (avgWidth / 2) + topAdjust },
      topRight: { ...corners.topRight, x: topCenter + (avgWidth / 2) - topAdjust },
    });
  };

  // Update shear
  const updateShear = (value: number) => {
    const currentTopCenter = (corners.topLeft.x + corners.topRight.x) / 2;
    const currentBottomCenter = (corners.bottomLeft.x + corners.bottomRight.x) / 2;
    const topWidth = corners.topRight.x - corners.topLeft.x;
    
    const targetTopCenter = currentBottomCenter + value;
    
    onCornersChange({
      ...corners,
      topLeft: { ...corners.topLeft, x: targetTopCenter - topWidth / 2 },
      topRight: { ...corners.topRight, x: targetTopCenter + topWidth / 2 },
    });
  };

  // Scale from center
  const updateScale = (axis: 'x' | 'z', scale: number) => {
    const newCorners = { ...corners };
    
    if (axis === 'x') {
      const currentWidth = corners.topRight.x - corners.topLeft.x;
      const scaleFactor = scale / currentWidth;
      
      newCorners.topLeft.x = centerX - (centerX - corners.topLeft.x) * scaleFactor;
      newCorners.topRight.x = centerX + (corners.topRight.x - centerX) * scaleFactor;
      newCorners.bottomLeft.x = centerX - (centerX - corners.bottomLeft.x) * scaleFactor;
      newCorners.bottomRight.x = centerX + (corners.bottomRight.x - centerX) * scaleFactor;
      
      if (lockAspect) {
        const zScale = scaleFactor;
        newCorners.topLeft.z = centerZ - (centerZ - corners.topLeft.z) * zScale;
        newCorners.topRight.z = centerZ - (centerZ - corners.topRight.z) * zScale;
        newCorners.bottomLeft.z = centerZ + (corners.bottomLeft.z - centerZ) * zScale;
        newCorners.bottomRight.z = centerZ + (corners.bottomRight.z - centerZ) * zScale;
      }
    } else {
      const currentHeight = corners.bottomLeft.z - corners.topLeft.z;
      const scaleFactor = scale / currentHeight;
      
      newCorners.topLeft.z = centerZ - (centerZ - corners.topLeft.z) * scaleFactor;
      newCorners.topRight.z = centerZ - (centerZ - corners.topRight.z) * scaleFactor;
      newCorners.bottomLeft.z = centerZ + (corners.bottomLeft.z - centerZ) * scaleFactor;
      newCorners.bottomRight.z = centerZ + (corners.bottomRight.z - centerZ) * scaleFactor;
      
      if (lockAspect) {
        const xScale = scaleFactor;
        newCorners.topLeft.x = centerX - (centerX - corners.topLeft.x) * xScale;
        newCorners.topRight.x = centerX + (corners.topRight.x - centerX) * xScale;
        newCorners.bottomLeft.x = centerX - (centerX - corners.bottomLeft.x) * xScale;
        newCorners.bottomRight.x = centerX + (corners.bottomRight.x - centerX) * xScale;
      }
    }
    
    onCornersChange(newCorners);
  };

  // Move entire pitch
  const updatePosition = (axis: 'x' | 'z', delta: number) => {
    const offsetX = axis === 'x' ? delta - centerX : 0;
    const offsetZ = axis === 'z' ? delta - centerZ : 0;
    
    onCornersChange({
      topLeft: { x: corners.topLeft.x + offsetX, z: corners.topLeft.z + offsetZ },
      topRight: { x: corners.topRight.x + offsetX, z: corners.topRight.z + offsetZ },
      bottomLeft: { x: corners.bottomLeft.x + offsetX, z: corners.bottomLeft.z + offsetZ },
      bottomRight: { x: corners.bottomRight.x + offsetX, z: corners.bottomRight.z + offsetZ },
    });
  };

  return (
    <div className="space-y-3 p-2.5 rounded-lg border border-border/50 bg-muted/20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Square className="h-4 w-4 text-primary" />
          <Label className="text-xs font-semibold">Pitch Shape Control</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            checked={isActive}
            onCheckedChange={onToggle}
            className="scale-75"
          />
          <Button onClick={onReset} variant="ghost" size="sm" className="h-6 px-2 text-[9px]">
            <RotateCcw className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {isActive && (
        <>
          {/* Section Selector - Show first if not confirmed */}
          {showSectionSelector && !sectionConfirmed && onSectionChange && onZoomChange && onSectionConfirm && (
            <PitchSectionSelector
              selectedSection={selectedSection}
              selectedZoom={selectedZoom}
              onSectionChange={(section) => {
                onSectionChange(section);
                // Apply initial corners based on section
                const initialCorners = getInitialCornersForSection(section);
                onCornersChange(initialCorners);
              }}
              onZoomChange={onZoomChange}
              onConfirm={() => {
                onSectionConfirm();
                setShowSectionSelector(false);
              }}
              onCancel={() => {
                setShowSectionSelector(false);
                onToggle();
              }}
            />
          )}

          {/* Show controls only after section is confirmed */}
          {(sectionConfirmed || !onSectionConfirm) && (
            <>
              {/* Section indicator */}
              {onSectionChange && (
                <div className="flex items-center justify-between p-2 bg-muted/30 rounded-md">
                  <div className="flex items-center gap-2">
                    <Focus className="h-3.5 w-3.5 text-primary" />
                    <div>
                      <p className="text-[10px] font-medium">
                        {selectedSection === 'full' ? 'Full Pitch' : 
                         selectedSection === 'left_half' ? 'Left Half' :
                         selectedSection === 'right_half' ? 'Right Half' :
                         selectedSection === 'left_penalty' ? 'Left Penalty Box' :
                         selectedSection === 'right_penalty' ? 'Right Penalty Box' :
                         selectedSection === 'center_circle' ? 'Center Circle' :
                         selectedSection.replace(/_/g, ' ')}
                      </p>
                      <p className="text-[8px] text-muted-foreground">
                        {selectedZoom.charAt(0).toUpperCase() + selectedZoom.slice(1).replace('_', ' ')} zoom
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[9px]"
                    onClick={() => {
                      setShowSectionSelector(true);
                      if (onSectionConfirm) {
                        // Reset confirmation to show selector
                      }
                    }}
                  >
                    Change
                  </Button>
                </div>
              )}

              {/* Mode selector */}
              <div className="flex gap-1 p-0.5 bg-muted/50 rounded">
            <button
              onClick={() => setMode('corners')}
              className={`flex-1 py-1 px-2 text-[9px] rounded transition-colors ${
                mode === 'corners' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'
              }`}
            >
              Corners
            </button>
            <button
              onClick={() => setMode('edges')}
              className={`flex-1 py-1 px-2 text-[9px] rounded transition-colors ${
                mode === 'edges' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'
              }`}
            >
              Edges
            </button>
            <button
              onClick={() => setMode('perspective')}
              className={`flex-1 py-1 px-2 text-[9px] rounded transition-colors ${
                mode === 'perspective' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'
              }`}
            >
              Perspective
            </button>
          </div>

          {mode === 'corners' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[9px] text-muted-foreground">
                  Click 🔒 to freeze handles. {lockedCount > 0 && `(${lockedCount} locked)`}
                </p>
              </div>
              
              {/* Top Left Corner */}
              <div className={`space-y-1.5 p-2 rounded ${lockedHandles.topLeft ? 'bg-destructive/10 border border-destructive/30' : 'bg-muted/30'}`}>
                <div className="flex items-center justify-between">
                  <Label className="text-[9px] font-medium flex items-center gap-1">
                    ↖ Top Left
                  </Label>
                  <button
                    onClick={() => toggleLock('topLeft')}
                    className={`p-1 rounded transition-colors ${lockedHandles.topLeft ? 'text-destructive bg-destructive/20' : 'text-muted-foreground hover:text-foreground'}`}
                    title={lockedHandles.topLeft ? 'Unlock handle' : 'Lock handle'}
                  >
                    {lockedHandles.topLeft ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <div className="flex justify-between text-[8px] text-muted-foreground">
                      <span>X</span>
                      <span className="font-mono">{corners.topLeft.x.toFixed(1)}</span>
                    </div>
                    <Slider
                      value={[corners.topLeft.x]}
                      onValueChange={([v]) => updateCorner('topLeft', 'x', v)}
                      min={-100}
                      max={0}
                      step={0.5}
                      disabled={lockedHandles.topLeft}
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-[8px] text-muted-foreground">
                      <span>Z</span>
                      <span className="font-mono">{corners.topLeft.z.toFixed(1)}</span>
                    </div>
                    <Slider
                      value={[corners.topLeft.z]}
                      onValueChange={([v]) => updateCorner('topLeft', 'z', v)}
                      min={-80}
                      max={0}
                      step={0.5}
                      disabled={lockedHandles.topLeft}
                    />
                  </div>
                </div>
              </div>

              {/* Top Right Corner */}
              <div className={`space-y-1.5 p-2 rounded ${lockedHandles.topRight ? 'bg-destructive/10 border border-destructive/30' : 'bg-muted/30'}`}>
                <div className="flex items-center justify-between">
                  <Label className="text-[9px] font-medium flex items-center gap-1">
                    ↗ Top Right
                  </Label>
                  <button
                    onClick={() => toggleLock('topRight')}
                    className={`p-1 rounded transition-colors ${lockedHandles.topRight ? 'text-destructive bg-destructive/20' : 'text-muted-foreground hover:text-foreground'}`}
                    title={lockedHandles.topRight ? 'Unlock handle' : 'Lock handle'}
                  >
                    {lockedHandles.topRight ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <div className="flex justify-between text-[8px] text-muted-foreground">
                      <span>X</span>
                      <span className="font-mono">{corners.topRight.x.toFixed(1)}</span>
                    </div>
                    <Slider
                      value={[corners.topRight.x]}
                      onValueChange={([v]) => updateCorner('topRight', 'x', v)}
                      min={0}
                      max={100}
                      step={0.5}
                      disabled={lockedHandles.topRight}
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-[8px] text-muted-foreground">
                      <span>Z</span>
                      <span className="font-mono">{corners.topRight.z.toFixed(1)}</span>
                    </div>
                    <Slider
                      value={[corners.topRight.z]}
                      onValueChange={([v]) => updateCorner('topRight', 'z', v)}
                      min={-80}
                      max={0}
                      step={0.5}
                      disabled={lockedHandles.topRight}
                    />
                  </div>
                </div>
              </div>

              {/* Bottom Left Corner */}
              <div className={`space-y-1.5 p-2 rounded ${lockedHandles.bottomLeft ? 'bg-destructive/10 border border-destructive/30' : 'bg-muted/30'}`}>
                <div className="flex items-center justify-between">
                  <Label className="text-[9px] font-medium flex items-center gap-1">
                    ↙ Bottom Left
                  </Label>
                  <button
                    onClick={() => toggleLock('bottomLeft')}
                    className={`p-1 rounded transition-colors ${lockedHandles.bottomLeft ? 'text-destructive bg-destructive/20' : 'text-muted-foreground hover:text-foreground'}`}
                    title={lockedHandles.bottomLeft ? 'Unlock handle' : 'Lock handle'}
                  >
                    {lockedHandles.bottomLeft ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <div className="flex justify-between text-[8px] text-muted-foreground">
                      <span>X</span>
                      <span className="font-mono">{corners.bottomLeft.x.toFixed(1)}</span>
                    </div>
                    <Slider
                      value={[corners.bottomLeft.x]}
                      onValueChange={([v]) => updateCorner('bottomLeft', 'x', v)}
                      min={-100}
                      max={0}
                      step={0.5}
                      disabled={lockedHandles.bottomLeft}
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-[8px] text-muted-foreground">
                      <span>Z</span>
                      <span className="font-mono">{corners.bottomLeft.z.toFixed(1)}</span>
                    </div>
                    <Slider
                      value={[corners.bottomLeft.z]}
                      onValueChange={([v]) => updateCorner('bottomLeft', 'z', v)}
                      min={0}
                      max={80}
                      step={0.5}
                      disabled={lockedHandles.bottomLeft}
                    />
                  </div>
                </div>
              </div>

              {/* Bottom Right Corner */}
              <div className={`space-y-1.5 p-2 rounded ${lockedHandles.bottomRight ? 'bg-destructive/10 border border-destructive/30' : 'bg-muted/30'}`}>
                <div className="flex items-center justify-between">
                  <Label className="text-[9px] font-medium flex items-center gap-1">
                    ↘ Bottom Right
                  </Label>
                  <button
                    onClick={() => toggleLock('bottomRight')}
                    className={`p-1 rounded transition-colors ${lockedHandles.bottomRight ? 'text-destructive bg-destructive/20' : 'text-muted-foreground hover:text-foreground'}`}
                    title={lockedHandles.bottomRight ? 'Unlock handle' : 'Lock handle'}
                  >
                    {lockedHandles.bottomRight ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <div className="flex justify-between text-[8px] text-muted-foreground">
                      <span>X</span>
                      <span className="font-mono">{corners.bottomRight.x.toFixed(1)}</span>
                    </div>
                    <Slider
                      value={[corners.bottomRight.x]}
                      onValueChange={([v]) => updateCorner('bottomRight', 'x', v)}
                      min={0}
                      max={100}
                      step={0.5}
                      disabled={lockedHandles.bottomRight}
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-[8px] text-muted-foreground">
                      <span>Z</span>
                      <span className="font-mono">{corners.bottomRight.z.toFixed(1)}</span>
                    </div>
                    <Slider
                      value={[corners.bottomRight.z]}
                      onValueChange={([v]) => updateCorner('bottomRight', 'z', v)}
                      min={0}
                      max={80}
                      step={0.5}
                      disabled={lockedHandles.bottomRight}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {mode === 'edges' && (
            <div className="space-y-3">
              <p className="text-[9px] text-muted-foreground">
                Move entire edges to stretch the pitch uniformly on each side.
              </p>

              <div className="space-y-1.5">
                <div className="flex justify-between text-[9px]">
                  <Label className="text-muted-foreground">Top Edge (Z)</Label>
                  <span className="font-mono">{corners.topLeft.z.toFixed(1)}</span>
                </div>
                <Slider
                  value={[corners.topLeft.z]}
                  onValueChange={([v]) => updateEdge('top', v)}
                  min={-80}
                  max={0}
                  step={0.5}
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-[9px]">
                  <Label className="text-muted-foreground">Bottom Edge (Z)</Label>
                  <span className="font-mono">{corners.bottomLeft.z.toFixed(1)}</span>
                </div>
                <Slider
                  value={[corners.bottomLeft.z]}
                  onValueChange={([v]) => updateEdge('bottom', v)}
                  min={0}
                  max={80}
                  step={0.5}
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-[9px]">
                  <Label className="text-muted-foreground">Left Edge (X)</Label>
                  <span className="font-mono">{corners.topLeft.x.toFixed(1)}</span>
                </div>
                <Slider
                  value={[corners.topLeft.x]}
                  onValueChange={([v]) => updateEdge('left', v)}
                  min={-100}
                  max={0}
                  step={0.5}
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-[9px]">
                  <Label className="text-muted-foreground">Right Edge (X)</Label>
                  <span className="font-mono">{corners.topRight.x.toFixed(1)}</span>
                </div>
                <Slider
                  value={[corners.topRight.x]}
                  onValueChange={([v]) => updateEdge('right', v)}
                  min={0}
                  max={100}
                  step={0.5}
                />
              </div>
            </div>
          )}

          {mode === 'perspective' && (
            <div className="space-y-3">
              <p className="text-[9px] text-muted-foreground">
                Adjust perspective to match camera angle. Use for partial field views.
              </p>

              <div className="space-y-1.5">
                <div className="flex justify-between text-[9px]">
                  <Label className="text-muted-foreground">Perspective (Convergence)</Label>
                  <span className="font-mono">{perspectiveX.toFixed(1)}</span>
                </div>
                <Slider
                  value={[perspectiveX]}
                  onValueChange={([v]) => updatePerspective(-v)}
                  min={-50}
                  max={50}
                  step={0.5}
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-[9px]">
                  <Label className="text-muted-foreground">Shear (Horizontal Tilt)</Label>
                  <span className="font-mono">{shearX.toFixed(1)}</span>
                </div>
                <Slider
                  value={[shearX]}
                  onValueChange={([v]) => updateShear(v)}
                  min={-30}
                  max={30}
                  step={0.5}
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-[9px]">
                  <Label className="text-muted-foreground">Width</Label>
                  <span className="font-mono">{width.toFixed(1)}</span>
                </div>
                <Slider
                  value={[width]}
                  onValueChange={([v]) => updateScale('x', v)}
                  min={20}
                  max={150}
                  step={0.5}
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-[9px]">
                  <Label className="text-muted-foreground">Height</Label>
                  <span className="font-mono">{height.toFixed(1)}</span>
                </div>
                <Slider
                  value={[height]}
                  onValueChange={([v]) => updateScale('z', v)}
                  min={20}
                  max={100}
                  step={0.5}
                />
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  checked={lockAspect}
                  onCheckedChange={setLockAspect}
                  className="scale-75"
                />
                <Label className="text-[9px] text-muted-foreground flex items-center gap-1">
                  {lockAspect ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                  Lock Aspect Ratio
                </Label>
              </div>
            </div>
          )}

          {/* Advanced: Position */}
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-1 text-[9px] text-muted-foreground hover:text-foreground transition-colors w-full"
          >
            {showAdvanced ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            Position Controls
          </button>

          {showAdvanced && (
            <div className="space-y-2 p-2 bg-muted/30 rounded">
              <div className="space-y-1.5">
                <div className="flex justify-between text-[9px]">
                  <Label className="text-muted-foreground">Center X</Label>
                  <span className="font-mono">{centerX.toFixed(1)}</span>
                </div>
                <Slider
                  value={[centerX]}
                  onValueChange={([v]) => updatePosition('x', v)}
                  min={-50}
                  max={50}
                  step={0.5}
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-[9px]">
                  <Label className="text-muted-foreground">Center Z</Label>
                  <span className="font-mono">{centerZ.toFixed(1)}</span>
                </div>
                <Slider
                  value={[centerZ]}
                  onValueChange={([v]) => updatePosition('z', v)}
                  min={-50}
                  max={50}
                  step={0.5}
                />
              </div>
            </div>
          )}

          <p className="text-[8px] text-muted-foreground/70 italic">
            Tip: Drag corner handles directly on the pitch for quick adjustments
          </p>
            </>
          )}
        </>
      )}
    </div>
  );
}