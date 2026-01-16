import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Target,
  Play,
  Pause,
  Trash2,
  Check,
  AlertTriangle,
  Loader2,
  Grid3X3,
  MapPin,
  X,
  RefreshCw,
  Save,
  ChevronDown,
  ChevronUp,
  Activity,
  ScanEye,
  Ruler,
} from 'lucide-react';
import { useState, useMemo } from 'react';
import { PITCH_FEATURES, PITCH_DIMENSIONS } from '@/utils/pitchConstants';
import { CalibrationPoint, ValidationMetrics } from '@/types/calibration';

interface HomographyCalibrationPanelProps {
  isCalibrationMode: boolean;
  selectedFeature: string | null;
  calibrationPoints: CalibrationPoint[];
  validationMetrics: ValidationMetrics | null;
  isOpenCVLoaded: boolean;
  isComputing: boolean;
  error: string | null;
  onStartCalibration: () => void;
  onStopCalibration: () => void;
  onSelectFeature: (featureId: string | null) => void;
  onRemovePoint: (pointId: string) => void;
  onClearPoints: () => void;
  onComputeCalibration: () => void;
  onSaveCalibration: () => void;
  // Zoom Diagnosis Props
  isZoomMonitoring: boolean;
  isSettingZoomReference: boolean;
  zoomStatus: {
    scale: number;
    status: 'stable' | 'zoom-detected' | 'error';
    currentDistance: number;
    initialDistance: number;
  } | null;
  onStartSettingZoomReference: () => void;
  onCancelSettingZoomReference: () => void;
  onStartZoomMonitoring: () => void;
  onStopZoomMonitoring: () => void;
  canStartMonitoring: boolean;
}

// Categorized pitch features for UI
const FEATURE_CATEGORIES = [
  {
    label: 'Corners',
    features: ['top_left_corner', 'top_right_corner', 'bottom_left_corner', 'bottom_right_corner'],
  },
  {
    label: 'Center',
    features: ['center_spot', 'center_line_top', 'center_line_bottom'],
  },
  {
    label: 'Penalty Spots',
    features: ['left_penalty_spot', 'right_penalty_spot'],
  },
  {
    label: 'Left Penalty Box',
    features: ['left_penalty_box_tl', 'left_penalty_box_tr', 'left_penalty_box_bl', 'left_penalty_box_br'],
  },
  {
    label: 'Right Penalty Box',
    features: ['right_penalty_box_tl', 'right_penalty_box_tr', 'right_penalty_box_bl', 'right_penalty_box_br'],
  },
  {
    label: 'Left Goal Area',
    features: ['left_goal_area_tl', 'left_goal_area_tr', 'left_goal_area_bl', 'left_goal_area_br'],
  },
  {
    label: 'Right Goal Area',
    features: ['right_goal_area_tl', 'right_goal_area_tr', 'right_goal_area_bl', 'right_goal_area_br'],
  },
  {
    label: 'Goals',
    features: ['left_goal_top', 'left_goal_bottom', 'right_goal_top', 'right_goal_bottom'],
  },
];

export function HomographyCalibrationPanel({
  isCalibrationMode,
  selectedFeature,
  calibrationPoints,
  validationMetrics,
  isOpenCVLoaded,
  isComputing,
  error,
  onStartCalibration,
  onStopCalibration,
  onSelectFeature,
  onRemovePoint,
  onClearPoints,
  onComputeCalibration,
  onSaveCalibration,
  isZoomMonitoring,
  isSettingZoomReference,
  zoomStatus,
  onStartSettingZoomReference,
  onCancelSettingZoomReference,
  onStartZoomMonitoring,
  onStopZoomMonitoring,
  canStartMonitoring,
}: HomographyCalibrationPanelProps) {
  const [expandedCategory, setExpandedCategory] = useState<string | null>('Corners');
  const [showZoomMonitor, setShowZoomMonitor] = useState(false);

  const canCompute = calibrationPoints.length >= 4;
  const hasCalibration = validationMetrics !== null;

  // Count points per category
  const pointCountByCategory = useMemo(() => {
    const counts: Record<string, number> = {};
    FEATURE_CATEGORIES.forEach(cat => {
      counts[cat.label] = calibrationPoints.filter(p =>
        cat.features.includes(p.feature_name)
      ).length;
    });
    return counts;
  }, [calibrationPoints]);

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium flex items-center gap-1.5">
          <Grid3X3 className="h-3.5 w-3.5" />
          Homography Calibration
        </Label>

        {!isOpenCVLoaded ? (
          <Badge variant="outline" className="text-[10px] gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            Loading OpenCV...
          </Badge>
        ) : (
          <Button
            variant={isCalibrationMode ? 'default' : 'outline'}
            size="sm"
            onClick={isCalibrationMode ? onStopCalibration : onStartCalibration}
            className="h-7 text-xs gap-1"
          >
            {isCalibrationMode ? (
              <>
                <Pause className="h-3 w-3" />
                Done
              </>
            ) : (
              <>
                <Play className="h-3 w-3" />
                Calibrate
              </>
            )}
          </Button>
        )}
      </div>

      {/* Error display */}
      {error && (
        <div className="flex items-start gap-2 p-2 bg-destructive/10 border border-destructive/20 rounded-md text-destructive text-xs">
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Calibration Mode UI */}
      {isCalibrationMode && (
        <div className="space-y-3 p-3 bg-muted/50 rounded-lg border border-border/50">
          {/* Instructions */}
          <p className="text-xs text-muted-foreground">
            1. Select a pitch feature below<br />
            2. Click on that feature in the video<br />
            3. Repeat for at least 4 points
          </p>

          {/* Progress indicator */}
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${calibrationPoints.length >= 4 ? 'bg-primary' : 'bg-primary/50'
                  }`}
                style={{ width: `${Math.min(100, (calibrationPoints.length / 4) * 100)}%` }}
              />
            </div>
            <span className="text-xs font-medium">
              {calibrationPoints.length}/4
              {calibrationPoints.length >= 4 && ' ✓'}
            </span>
          </div>

          {/* Selected feature indicator */}
          {selectedFeature && (
            <div className="flex items-center gap-2 p-2 bg-primary/10 border border-primary/20 rounded-md">
              <Target className="h-4 w-4 text-primary animate-pulse" />
              <span className="text-xs font-medium text-primary">
                Click on: {PITCH_FEATURES[selectedFeature]?.label}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onSelectFeature(null)}
                className="h-5 w-5 p-0 ml-auto"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}

          {/* Current points */}
          {calibrationPoints.length > 0 && (
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Collected Points</Label>
              <div className="flex flex-wrap gap-1">
                {calibrationPoints.map(point => (
                  <Badge
                    key={point.id}
                    variant="secondary"
                    className="text-[10px] gap-1 pr-1"
                  >
                    <MapPin className="h-2.5 w-2.5" />
                    {PITCH_FEATURES[point.feature_name]?.label.split(' ').slice(-2).join(' ')}
                    <button
                      onClick={() => onRemovePoint(point.id)}
                      className="hover:text-destructive ml-1"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Feature selector */}
          <ScrollArea className="h-48">
            <div className="space-y-1">
              {FEATURE_CATEGORIES.map(category => {
                const isExpanded = expandedCategory === category.label;
                const pointCount = pointCountByCategory[category.label];

                return (
                  <div key={category.label}>
                    <button
                      onClick={() => setExpandedCategory(isExpanded ? null : category.label)}
                      className="w-full flex items-center justify-between p-2 bg-background/70 hover:bg-background rounded text-xs font-medium"
                    >
                      <span>{category.label}</span>
                      <div className="flex items-center gap-1.5">
                        {pointCount > 0 && (
                          <Badge variant="default" className="text-[9px] h-4 px-1">
                            {pointCount}
                          </Badge>
                        )}
                        {isExpanded ? (
                          <ChevronUp className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5" />
                        )}
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="grid grid-cols-2 gap-1 mt-1 pl-2 pr-1">
                        {category.features.map(featureId => {
                          const feature = PITCH_FEATURES[featureId];
                          if (!feature) return null;

                          const isSet = calibrationPoints.some(
                            p => p.feature_name === featureId
                          );
                          const isActive = selectedFeature === featureId;

                          return (
                            <Button
                              key={featureId}
                              variant={isActive ? 'default' : isSet ? 'secondary' : 'outline'}
                              size="sm"
                              onClick={() => onSelectFeature(isActive ? null : featureId)}
                              className={`h-7 text-[10px] justify-start gap-1 ${isSet ? 'border-primary/50' : ''
                                }`}
                            >
                              <MapPin className="h-2.5 w-2.5 flex-shrink-0" />
                              <span className="truncate">
                                {feature.label.replace(/^(Left|Right)\s/, '')}
                              </span>
                              {isSet && <Check className="h-2.5 w-2.5 ml-auto text-primary" />}
                            </Button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>

          {/* Action buttons */}
          <div className="flex gap-2">
            <Button
              variant="default"
              size="sm"
              disabled={!canCompute || isComputing}
              onClick={onComputeCalibration}
              className="flex-1 h-8 text-xs gap-1"
            >
              {isComputing ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Computing...
                </>
              ) : (
                <>
                  <Target className="h-3.5 w-3.5" />
                  Compute ({calibrationPoints.length} pts)
                </>
              )}
            </Button>

            {calibrationPoints.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClearPoints}
                className="h-8 text-xs text-muted-foreground"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Validation metrics */}
      {validationMetrics && (
        <div className={`p-3 rounded-lg border ${validationMetrics.is_valid
          ? 'bg-primary/5 border-primary/20'
          : 'bg-destructive/5 border-destructive/20'
          }`}>
          <div className="flex items-center justify-between mb-2">
            <Label className="text-xs font-medium flex items-center gap-1.5">
              {validationMetrics.is_valid ? (
                <Check className="h-3.5 w-3.5 text-primary" />
              ) : (
                <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
              )}
              Calibration Results
            </Label>
            <Button
              variant="ghost"
              size="sm"
              onClick={onSaveCalibration}
              className="h-6 text-[10px] gap-1"
            >
              <Save className="h-3 w-3" />
              Save
            </Button>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-lg font-bold">
                {validationMetrics.mean_error.toFixed(2)}m
              </div>
              <div className="text-[10px] text-muted-foreground">Mean Error</div>
            </div>
            <div>
              <div className="text-lg font-bold">
                {validationMetrics.max_error.toFixed(2)}m
              </div>
              <div className="text-[10px] text-muted-foreground">Max Error</div>
            </div>
            <div>
              <div className="text-lg font-bold">
                {validationMetrics.point_count}
              </div>
              <div className="text-[10px] text-muted-foreground">Points</div>
            </div>
          </div>

          {!validationMetrics.is_valid && (
            <p className="text-[10px] text-destructive mt-2">
              High error detected. Try adding more points or adjusting existing ones.
            </p>
          )}
        </div>
      )}

      {/* Pitch preview minimap */}
      {calibrationPoints.length > 0 && (
        <div className="relative aspect-[105/68] bg-green-900/30 rounded border border-border/50 overflow-hidden">
          {/* Pitch markings */}
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
            {/* Calibration points */}
            {calibrationPoints.map(point => (
              <circle
                key={point.id}
                cx={point.pitch_coords.X}
                cy={point.pitch_coords.Y}
                r="2"
                fill="hsl(var(--primary))"
                stroke="white"
                strokeWidth="0.5"
              />
            ))}
          </svg>
        </div>
      )}
      {/* Zoom Diagnosis Monitor */}
      <div className="pt-2 border-t border-border/50">
        <button
          onClick={() => setShowZoomMonitor(!showZoomMonitor)}
          className="w-full flex items-center justify-between p-2 hover:bg-muted/50 rounded-lg transition-colors"
        >
          <Label className="text-xs font-medium flex items-center gap-1.5 cursor-pointer">
            <Activity className="h-3.5 w-3.5" />
            Zoom Monitoring
          </Label>
          {showZoomMonitor ? (
            <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </button>

        {showZoomMonitor && (
          <div className="mt-2 space-y-3 p-3 bg-muted/30 rounded-lg border border-border/50">
            {/* Monitoring Controls */}
            {!isZoomMonitoring ? (
              <div className="space-y-2">
                <p className="text-[10px] text-muted-foreground">
                  Track pixel distance between two points to detect zoom changes.
                </p>

                {isSettingZoomReference ? (
                  <div className="bg-primary/10 p-2 rounded border border-primary/20 animate-pulse">
                    <div className="flex items-center gap-2 mb-1">
                      <Ruler className="h-3.5 w-3.5 text-primary" />
                      <span className="text-xs font-bold text-primary">Select 2 Points</span>
                    </div>
                    <p className="text-[10px] text-primary/80 mb-2">
                      Click two stable points on the video (e.g., across center circle).
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={onCancelSettingZoomReference}
                      className="w-full h-6 text-[10px]"
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={onStartSettingZoomReference}
                      className="h-8 text-[10px] gap-1"
                    >
                      <Ruler className="h-3 w-3" />
                      Set Reference
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={onStartZoomMonitoring}
                      disabled={!canStartMonitoring}
                      className="h-8 text-[10px] gap-1"
                    >
                      <ScanEye className="h-3 w-3" />
                      Start Monitor
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${zoomStatus?.status === 'zoom-detected' ? 'bg-destructive' : 'bg-green-500'
                        }`}></span>
                      <span className={`relative inline-flex rounded-full h-2 w-2 ${zoomStatus?.status === 'zoom-detected' ? 'bg-destructive' : 'bg-green-500'
                        }`}></span>
                    </span>
                    <span className="text-xs font-medium">Monitoring Zoom...</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onStopZoomMonitoring}
                    className="h-6 w-6 p-0"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>

                {zoomStatus && (
                  <div className="grid grid-cols-2 gap-2 text-center bg-background rounded border p-2">
                    <div>
                      <div className={`text-lg font-bold ${zoomStatus.status === 'zoom-detected' ? 'text-destructive' : 'text-primary'
                        }`}>
                        {zoomStatus.scale.toFixed(3)}x
                      </div>
                      <div className="text-[9px] text-muted-foreground">Scale Factor</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-muted-foreground">
                        {Math.round(zoomStatus.currentDistance)}px
                      </div>
                      <div className="text-[9px] text-muted-foreground">Ref. Distance</div>
                    </div>
                  </div>
                )}

                {zoomStatus?.status === 'zoom-detected' && (
                  <div className="flex items-start gap-2 p-2 bg-destructive/10 border border-destructive/20 rounded text-[10px] text-destructive">
                    <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                    <span>Zoom change detected! Calibration may be invalid.</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
