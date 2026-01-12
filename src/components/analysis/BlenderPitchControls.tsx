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
  Focus,
  Crosshair,
  Circle
} from "lucide-react";
import { 
  PitchCorners, 
  DEFAULT_CORNERS, 
  LockedHandles, 
  DEFAULT_LOCKED_HANDLES,
  ExtendedHandles,
  DEFAULT_EXTENDED_HANDLES,
  SNAP_THRESHOLD
} from './PitchManipulator';
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
  // Grid handles
  showGridHandles?: boolean;
  onShowGridHandlesChange?: (show: boolean) => void;
  extendedHandles?: ExtendedHandles;
  onExtendedHandlesChange?: (handles: ExtendedHandles) => void;
  // Snapping
  enableSnapping?: boolean;
  onEnableSnappingChange?: (enable: boolean) => void;
  // Lens distortion
  lensDistortion?: number;
  onLensDistortionChange?: (distortion: number) => void;
}

type ControlMode = 'corners' | 'edges' | 'perspective' | 'distortion';

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
  showGridHandles = false,
  onShowGridHandlesChange,
  extendedHandles = DEFAULT_EXTENDED_HANDLES,
  onExtendedHandlesChange,
  enableSnapping = true,
  onEnableSnappingChange,
  lensDistortion = 0,
  onLensDistortionChange,
}: BlenderPitchControlsProps) {
  const [mode, setMode] = useState<ControlMode>('corners');
  const [lockAspect, setLockAspect] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showSectionSelector, setShowSectionSelector] = useState(!sectionConfirmed);

  // Toggle lock for a specific handle
  const toggleLock = (handleId: string) => {
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

  // Update individual corner - respects lock
  const updateCorner = (corner: keyof PitchCorners, axis: 'x' | 'z', value: number) => {
    // Check if this corner is locked
    if (lockedHandles[corner]) {
      return; // Don't update locked corners
    }
    
    onCornersChange({
      ...corners,
      [corner]: {
        ...corners[corner],
        [axis]: value,
      },
    });
  };

  // Update edge (move two corners together) - respects locks
  const updateEdge = (edge: 'top' | 'bottom' | 'left' | 'right', value: number) => {
    const newCorners = { ...corners };
    
    switch (edge) {
      case 'top':
        if (!lockedHandles.topLeft && !lockedHandles.top) {
          newCorners.topLeft = { ...newCorners.topLeft, z: value };
        }
        if (!lockedHandles.topRight && !lockedHandles.top) {
          newCorners.topRight = { ...newCorners.topRight, z: value };
        }
        break;
      case 'bottom':
        if (!lockedHandles.bottomLeft && !lockedHandles.bottom) {
          newCorners.bottomLeft = { ...newCorners.bottomLeft, z: value };
        }
        if (!lockedHandles.bottomRight && !lockedHandles.bottom) {
          newCorners.bottomRight = { ...newCorners.bottomRight, z: value };
        }
        break;
      case 'left':
        if (!lockedHandles.topLeft && !lockedHandles.left) {
          newCorners.topLeft = { ...newCorners.topLeft, x: value };
        }
        if (!lockedHandles.bottomLeft && !lockedHandles.left) {
          newCorners.bottomLeft = { ...newCorners.bottomLeft, x: value };
        }
        break;
      case 'right':
        if (!lockedHandles.topRight && !lockedHandles.right) {
          newCorners.topRight = { ...newCorners.topRight, x: value };
        }
        if (!lockedHandles.bottomRight && !lockedHandles.right) {
          newCorners.bottomRight = { ...newCorners.bottomRight, x: value };
        }
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
    
    const newCorners = { ...corners };
    if (!lockedHandles.topLeft) {
      newCorners.topLeft = { ...corners.topLeft, x: topCenter - (avgWidth / 2) + topAdjust };
    }
    if (!lockedHandles.topRight) {
      newCorners.topRight = { ...corners.topRight, x: topCenter + (avgWidth / 2) - topAdjust };
    }
    
    onCornersChange(newCorners);
  };

  // Update shear
  const updateShear = (value: number) => {
    const currentBottomCenter = (corners.bottomLeft.x + corners.bottomRight.x) / 2;
    const topWidth = corners.topRight.x - corners.topLeft.x;
    
    const targetTopCenter = currentBottomCenter + value;
    
    const newCorners = { ...corners };
    if (!lockedHandles.topLeft) {
      newCorners.topLeft = { ...corners.topLeft, x: targetTopCenter - topWidth / 2 };
    }
    if (!lockedHandles.topRight) {
      newCorners.topRight = { ...corners.topRight, x: targetTopCenter + topWidth / 2 };
    }
    
    onCornersChange(newCorners);
  };

  // Scale from center
  const updateScale = (axis: 'x' | 'z', scale: number) => {
    const newCorners = { ...corners };
    
    if (axis === 'x') {
      const currentWidth = corners.topRight.x - corners.topLeft.x;
      const scaleFactor = scale / currentWidth;
      
      if (!lockedHandles.topLeft) {
        newCorners.topLeft.x = centerX - (centerX - corners.topLeft.x) * scaleFactor;
      }
      if (!lockedHandles.topRight) {
        newCorners.topRight.x = centerX + (corners.topRight.x - centerX) * scaleFactor;
      }
      if (!lockedHandles.bottomLeft) {
        newCorners.bottomLeft.x = centerX - (centerX - corners.bottomLeft.x) * scaleFactor;
      }
      if (!lockedHandles.bottomRight) {
        newCorners.bottomRight.x = centerX + (corners.bottomRight.x - centerX) * scaleFactor;
      }
      
      if (lockAspect) {
        const zScale = scaleFactor;
        if (!lockedHandles.topLeft) {
          newCorners.topLeft.z = centerZ - (centerZ - corners.topLeft.z) * zScale;
        }
        if (!lockedHandles.topRight) {
          newCorners.topRight.z = centerZ - (centerZ - corners.topRight.z) * zScale;
        }
        if (!lockedHandles.bottomLeft) {
          newCorners.bottomLeft.z = centerZ + (corners.bottomLeft.z - centerZ) * zScale;
        }
        if (!lockedHandles.bottomRight) {
          newCorners.bottomRight.z = centerZ + (corners.bottomRight.z - centerZ) * zScale;
        }
      }
    } else {
      const currentHeight = corners.bottomLeft.z - corners.topLeft.z;
      const scaleFactor = scale / currentHeight;
      
      if (!lockedHandles.topLeft) {
        newCorners.topLeft.z = centerZ - (centerZ - corners.topLeft.z) * scaleFactor;
      }
      if (!lockedHandles.topRight) {
        newCorners.topRight.z = centerZ - (centerZ - corners.topRight.z) * scaleFactor;
      }
      if (!lockedHandles.bottomLeft) {
        newCorners.bottomLeft.z = centerZ + (corners.bottomLeft.z - centerZ) * scaleFactor;
      }
      if (!lockedHandles.bottomRight) {
        newCorners.bottomRight.z = centerZ + (corners.bottomRight.z - centerZ) * scaleFactor;
      }
      
      if (lockAspect) {
        const xScale = scaleFactor;
        if (!lockedHandles.topLeft) {
          newCorners.topLeft.x = centerX - (centerX - corners.topLeft.x) * xScale;
        }
        if (!lockedHandles.topRight) {
          newCorners.topRight.x = centerX + (corners.topRight.x - centerX) * xScale;
        }
        if (!lockedHandles.bottomLeft) {
          newCorners.bottomLeft.x = centerX - (centerX - corners.bottomLeft.x) * xScale;
        }
        if (!lockedHandles.bottomRight) {
          newCorners.bottomRight.x = centerX + (corners.bottomRight.x - centerX) * xScale;
        }
      }
    }
    
    onCornersChange(newCorners);
  };

  // Move entire pitch - respects center lock
  const updatePosition = (axis: 'x' | 'z', delta: number) => {
    if (lockedHandles.center) return;
    
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
                    }}
                  >
                    Change
                  </Button>
                </div>
              )}

              {/* Quick Options */}
              <div className="flex flex-wrap gap-2 p-2 bg-muted/20 rounded-md">
                {/* Grid Handles Toggle */}
                {onShowGridHandlesChange && (
                  <div className="flex items-center gap-1.5">
                    <Switch
                      checked={showGridHandles}
                      onCheckedChange={onShowGridHandlesChange}
                      className="scale-[0.6]"
                    />
                    <Label className="text-[9px] flex items-center gap-1">
                      <Grid3X3 className="h-3 w-3" />
                      Grid Handles
                    </Label>
                  </div>
                )}

                {/* Snapping Toggle */}
                {onEnableSnappingChange && (
                  <div className="flex items-center gap-1.5">
                    <Switch
                      checked={enableSnapping}
                      onCheckedChange={onEnableSnappingChange}
                      className="scale-[0.6]"
                    />
                    <Label className="text-[9px] flex items-center gap-1">
                      <Crosshair className="h-3 w-3" />
                      Line Snap
                    </Label>
                  </div>
                )}
              </div>

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
                <button
                  onClick={() => setMode('distortion')}
                  className={`flex-1 py-1 px-2 text-[9px] rounded transition-colors ${
                    mode === 'distortion' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'
                  }`}
                >
                  Lens
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
                  {/* Edge controls with lock buttons */}
                  {['top', 'bottom', 'left', 'right'].map((edge) => (
                    <div key={edge} className={`space-y-1.5 p-2 rounded ${lockedHandles[edge] ? 'bg-destructive/10 border border-destructive/30' : 'bg-muted/30'}`}>
                      <div className="flex items-center justify-between">
                        <Label className="text-[9px] font-medium capitalize">{edge} Edge</Label>
                        <button
                          onClick={() => toggleLock(edge)}
                          className={`p-1 rounded transition-colors ${lockedHandles[edge] ? 'text-destructive bg-destructive/20' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                          {lockedHandles[edge] ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                        </button>
                      </div>
                      <Slider
                        value={[
                          edge === 'top' ? corners.topLeft.z :
                          edge === 'bottom' ? corners.bottomLeft.z :
                          edge === 'left' ? corners.topLeft.x :
                          corners.topRight.x
                        ]}
                        onValueChange={([v]) => updateEdge(edge as any, v)}
                        min={edge === 'top' || edge === 'left' ? -100 : 0}
                        max={edge === 'top' || edge === 'left' ? 0 : 100}
                        step={0.5}
                        disabled={lockedHandles[edge]}
                      />
                    </div>
                  ))}

                  {/* Center lock */}
                  <div className={`space-y-1.5 p-2 rounded ${lockedHandles.center ? 'bg-destructive/10 border border-destructive/30' : 'bg-muted/30'}`}>
                    <div className="flex items-center justify-between">
                      <Label className="text-[9px] font-medium">Center (Move All)</Label>
                      <button
                        onClick={() => toggleLock('center')}
                        className={`p-1 rounded transition-colors ${lockedHandles.center ? 'text-destructive bg-destructive/20' : 'text-muted-foreground hover:text-foreground'}`}
                      >
                        {lockedHandles.center ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <div className="flex justify-between text-[8px] text-muted-foreground">
                          <span>X</span>
                          <span className="font-mono">{centerX.toFixed(1)}</span>
                        </div>
                        <Slider
                          value={[centerX]}
                          onValueChange={([v]) => updatePosition('x', v)}
                          min={-50}
                          max={50}
                          step={0.5}
                          disabled={lockedHandles.center}
                        />
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-[8px] text-muted-foreground">
                          <span>Z</span>
                          <span className="font-mono">{centerZ.toFixed(1)}</span>
                        </div>
                        <Slider
                          value={[centerZ]}
                          onValueChange={([v]) => updatePosition('z', v)}
                          min={-30}
                          max={30}
                          step={0.5}
                          disabled={lockedHandles.center}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {mode === 'perspective' && (
                <div className="space-y-3">
                  {/* Perspective Controls */}
                  <div className="space-y-1.5 p-2 bg-muted/30 rounded">
                    <Label className="text-[9px] font-medium">Convergence (Top Width)</Label>
                    <div className="flex justify-between text-[8px] text-muted-foreground">
                      <span>Narrow ← → Wide</span>
                      <span className="font-mono">{perspectiveX.toFixed(1)}</span>
                    </div>
                    <Slider
                      value={[perspectiveX]}
                      onValueChange={([v]) => updatePerspective(v)}
                      min={-50}
                      max={50}
                      step={0.5}
                    />
                  </div>

                  <div className="space-y-1.5 p-2 bg-muted/30 rounded">
                    <Label className="text-[9px] font-medium">Horizontal Shear</Label>
                    <div className="flex justify-between text-[8px] text-muted-foreground">
                      <span>Left ← → Right</span>
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

                  <div className="flex items-center gap-2 p-2 bg-muted/30 rounded">
                    <Switch
                      checked={lockAspect}
                      onCheckedChange={setLockAspect}
                      className="scale-75"
                    />
                    <Label className="text-[9px]">Lock Aspect Ratio</Label>
                  </div>

                  <div className="space-y-1.5 p-2 bg-muted/30 rounded">
                    <Label className="text-[9px] font-medium">Scale Width</Label>
                    <div className="flex justify-between text-[8px] text-muted-foreground">
                      <span>Width</span>
                      <span className="font-mono">{width.toFixed(1)}</span>
                    </div>
                    <Slider
                      value={[width]}
                      onValueChange={([v]) => updateScale('x', v)}
                      min={30}
                      max={150}
                      step={0.5}
                    />
                  </div>

                  <div className="space-y-1.5 p-2 bg-muted/30 rounded">
                    <Label className="text-[9px] font-medium">Scale Height</Label>
                    <div className="flex justify-between text-[8px] text-muted-foreground">
                      <span>Height</span>
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
                </div>
              )}

              {mode === 'distortion' && (
                <div className="space-y-3">
                  <p className="text-[9px] text-muted-foreground">
                    Correct lens distortion (barrel/pincushion) from wide-angle cameras.
                  </p>

                  <div className="space-y-1.5 p-2 bg-muted/30 rounded">
                    <Label className="text-[9px] font-medium flex items-center gap-1">
                      <Circle className="h-3 w-3" />
                      Lens Distortion Correction
                    </Label>
                    <div className="flex justify-between text-[8px] text-muted-foreground">
                      <span>Barrel ← → Pincushion</span>
                      <span className="font-mono">{lensDistortion?.toFixed(1) || '0.0'}</span>
                    </div>
                    <Slider
                      value={[lensDistortion || 0]}
                      onValueChange={([v]) => onLensDistortionChange?.(v)}
                      min={-50}
                      max={50}
                      step={0.5}
                    />
                    <div className="flex justify-between text-[8px] text-muted-foreground mt-1">
                      <span>Barrel (curve outward)</span>
                      <span>Pincushion (curve inward)</span>
                    </div>
                  </div>

                  <div className="p-2 bg-muted/20 rounded-md">
                    <p className="text-[9px] text-muted-foreground">
                      <strong>Tip:</strong> Wide-angle cameras typically need negative (barrel) correction. 
                      Telephoto lenses may need positive (pincushion) correction.
                    </p>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full h-7 text-[9px]"
                    onClick={() => onLensDistortionChange?.(0)}
                  >
                    Reset Distortion
                  </Button>
                </div>
              )}

              {/* Advanced toggle */}
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-1 text-[9px] text-muted-foreground hover:text-foreground transition-colors w-full justify-center py-1"
              >
                {showAdvanced ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                {showAdvanced ? 'Hide' : 'Show'} Advanced
              </button>

              {showAdvanced && (
                <div className="space-y-2 p-2 bg-muted/20 rounded-md">
                  <p className="text-[8px] text-muted-foreground font-mono">
                    TL: ({corners.topLeft.x.toFixed(1)}, {corners.topLeft.z.toFixed(1)})
                    TR: ({corners.topRight.x.toFixed(1)}, {corners.topRight.z.toFixed(1)})
                  </p>
                  <p className="text-[8px] text-muted-foreground font-mono">
                    BL: ({corners.bottomLeft.x.toFixed(1)}, {corners.bottomLeft.z.toFixed(1)})
                    BR: ({corners.bottomRight.x.toFixed(1)}, {corners.bottomRight.z.toFixed(1)})
                  </p>
                  <p className="text-[8px] text-muted-foreground font-mono">
                    Size: {width.toFixed(1)} × {height.toFixed(1)}
                  </p>
                  {lensDistortion !== 0 && (
                    <p className="text-[8px] text-muted-foreground font-mono">
                      Lens: {lensDistortion > 0 ? '+' : ''}{lensDistortion?.toFixed(1)}
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
