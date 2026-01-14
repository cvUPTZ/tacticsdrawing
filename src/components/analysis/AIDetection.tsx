import { useState, useCallback, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { 
  Scan, 
  Users, 
  Circle, 
  Maximize2, 
  Play, 
  Pause, 
  RefreshCw,
  Eye,
  EyeOff,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';

interface DetectedPlayer {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  team: 'home' | 'away' | 'referee' | 'unknown';
  jerseyColor: string;
  confidence: number;
}

interface DetectedBall {
  x: number;
  y: number;
  confidence: number;
  visible: boolean;
}

interface DetectedFieldLine {
  type: string;
  points: Array<{ x: number; y: number }>;
  confidence: number;
}

interface DetectedFieldMask {
  corners: Array<{ x: number; y: number }>;
  isVisible: boolean;
}

interface DetectionResult {
  players: DetectedPlayer[];
  ball: DetectedBall | null;
  fieldLines: DetectedFieldLine[];
  fieldMask: DetectedFieldMask;
  timestamp: number;
}

interface AIDetectionProps {
  videoElement: HTMLVideoElement | null;
  isActive: boolean;
  onToggle: () => void;
  containerWidth: number;
  containerHeight: number;
}

// Team colors for visualization
const TEAM_COLORS: Record<string, { fill: string; stroke: string }> = {
  home: { fill: 'rgba(59, 130, 246, 0.6)', stroke: '#3b82f6' },
  away: { fill: 'rgba(239, 68, 68, 0.6)', stroke: '#ef4444' },
  referee: { fill: 'rgba(255, 215, 0, 0.6)', stroke: '#ffd700' },
  unknown: { fill: 'rgba(156, 163, 175, 0.6)', stroke: '#9ca3af' },
};

const LINE_TYPE_COLORS: Record<string, string> = {
  touchline: '#00ff88',
  goal_line: '#00ff88',
  penalty_box: '#00ffff',
  goal_area: '#00ffff',
  center_circle: '#ffff00',
  center_line: '#ffff00',
  penalty_arc: '#ff00ff',
  corner_arc: '#ff8800',
  unknown: '#ffffff',
};

export function AIDetection({
  videoElement,
  isActive,
  onToggle,
  containerWidth,
  containerHeight,
}: AIDetectionProps) {
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const captureCanvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  
  const [detection, setDetection] = useState<DetectionResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLiveMode, setIsLiveMode] = useState(false);
  const [analyzeInterval, setAnalyzeInterval] = useState(1000); // ms between analyses
  
  // Visibility toggles
  const [showPlayers, setShowPlayers] = useState(true);
  const [showBall, setShowBall] = useState(true);
  const [showFieldLines, setShowFieldLines] = useState(true);
  const [showFieldMask, setShowFieldMask] = useState(false);
  const [showLabels, setShowLabels] = useState(true);
  
  // Team counters
  const homeCount = detection?.players.filter(p => p.team === 'home').length ?? 0;
  const awayCount = detection?.players.filter(p => p.team === 'away').length ?? 0;

  // Capture current frame as base64
  const captureFrame = useCallback((): string | null => {
    if (!videoElement || !captureCanvasRef.current) return null;
    
    const canvas = captureCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    
    // Use a smaller resolution for faster processing
    const maxDim = 640;
    const scale = Math.min(maxDim / videoElement.videoWidth, maxDim / videoElement.videoHeight);
    canvas.width = videoElement.videoWidth * scale;
    canvas.height = videoElement.videoHeight * scale;
    
    ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
    
    return canvas.toDataURL('image/jpeg', 0.8);
  }, [videoElement]);

  // Analyze frame with AI
  const analyzeFrame = useCallback(async () => {
    if (!videoElement || isProcessing) return;
    
    const imageBase64 = captureFrame();
    if (!imageBase64) return;
    
    setIsProcessing(true);
    
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-frame`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ imageBase64, analysisType: 'full' }),
        }
      );
      
      if (!response.ok) {
        const error = await response.json();
        if (response.status === 429) {
          toast.error('Rate limit exceeded. Slowing down...');
          setAnalyzeInterval(prev => Math.min(prev * 2, 5000));
        } else if (response.status === 402) {
          toast.error('AI credits exhausted. Please add credits.');
          setIsLiveMode(false);
        } else {
          throw new Error(error.error || 'Analysis failed');
        }
        return;
      }
      
      const result = await response.json();
      setDetection({
        ...result,
        timestamp: videoElement.currentTime,
      });
      
    } catch (error) {
      console.error('Frame analysis error:', error);
      toast.error('Failed to analyze frame');
    } finally {
      setIsProcessing(false);
    }
  }, [videoElement, isProcessing, captureFrame]);

  // Live mode loop
  useEffect(() => {
    if (!isActive || !isLiveMode || !videoElement) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      return;
    }
    
    let lastAnalysis = 0;
    
    const loop = () => {
      const now = performance.now();
      if (now - lastAnalysis >= analyzeInterval && !videoElement.paused) {
        lastAnalysis = now;
        analyzeFrame();
      }
      animationRef.current = requestAnimationFrame(loop);
    };
    
    animationRef.current = requestAnimationFrame(loop);
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isActive, isLiveMode, videoElement, analyzeInterval, analyzeFrame]);

  // Draw detection overlay
  useEffect(() => {
    if (!overlayRef.current || !isActive) return;
    
    const canvas = overlayRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    canvas.width = containerWidth;
    canvas.height = containerHeight;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (!detection) return;
    
    const scaleX = containerWidth / 100;
    const scaleY = containerHeight / 100;
    
    // Draw field mask
    if (showFieldMask && detection.fieldMask.isVisible && detection.fieldMask.corners.length > 2) {
      ctx.beginPath();
      ctx.moveTo(detection.fieldMask.corners[0].x * scaleX, detection.fieldMask.corners[0].y * scaleY);
      detection.fieldMask.corners.forEach((corner, i) => {
        if (i > 0) ctx.lineTo(corner.x * scaleX, corner.y * scaleY);
      });
      ctx.closePath();
      ctx.fillStyle = 'rgba(0, 255, 0, 0.1)';
      ctx.fill();
      ctx.strokeStyle = '#00ff00';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    
    // Draw field lines
    if (showFieldLines && detection.fieldLines.length > 0) {
      detection.fieldLines.forEach(line => {
        if (line.points.length < 2) return;
        
        ctx.beginPath();
        ctx.moveTo(line.points[0].x * scaleX, line.points[0].y * scaleY);
        
        if (line.type === 'center_circle' || line.type === 'penalty_arc' || line.type === 'corner_arc') {
          // Draw as curve for circular elements
          for (let i = 1; i < line.points.length; i++) {
            ctx.lineTo(line.points[i].x * scaleX, line.points[i].y * scaleY);
          }
        } else {
          // Draw as straight line
          const last = line.points[line.points.length - 1];
          ctx.lineTo(last.x * scaleX, last.y * scaleY);
        }
        
        ctx.strokeStyle = LINE_TYPE_COLORS[line.type] || LINE_TYPE_COLORS.unknown;
        ctx.lineWidth = 2;
        ctx.setLineDash([]);
        ctx.stroke();
      });
    }
    
    // Draw players
    if (showPlayers && detection.players.length > 0) {
      detection.players.forEach(player => {
        const x = player.x * scaleX;
        const y = player.y * scaleY;
        const w = (player.width || 3) * scaleX;
        const h = (player.height || 5) * scaleY;
        
        const colors = TEAM_COLORS[player.team] || TEAM_COLORS.unknown;
        
        // Draw bounding box
        ctx.fillStyle = colors.fill;
        ctx.fillRect(x - w/2, y - h/2, w, h);
        ctx.strokeStyle = colors.stroke;
        ctx.lineWidth = 2;
        ctx.strokeRect(x - w/2, y - h/2, w, h);
        
        // Draw player marker (dot at feet position)
        ctx.beginPath();
        ctx.arc(x, y + h/2 - 3, 4, 0, Math.PI * 2);
        ctx.fillStyle = colors.stroke;
        ctx.fill();
        
        // Draw label
        if (showLabels) {
          const label = `#${player.id}`;
          ctx.font = 'bold 10px sans-serif';
          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'center';
          ctx.fillText(label, x, y - h/2 - 5);
        }
      });
    }
    
    // Draw ball
    if (showBall && detection.ball?.visible) {
      const ball = detection.ball;
      const x = ball.x * scaleX;
      const y = ball.y * scaleY;
      
      // Outer glow
      ctx.beginPath();
      ctx.arc(x, y, 12, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.fill();
      
      // Ball
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.stroke();
      
      // Inner pattern
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.strokeStyle = '#333333';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    
  }, [detection, isActive, containerWidth, containerHeight, showPlayers, showBall, showFieldLines, showFieldMask, showLabels]);

  if (!isActive) return null;

  return (
    <>
      {/* Hidden capture canvas */}
      <canvas ref={captureCanvasRef} className="hidden" />
      
      {/* Detection overlay */}
      <canvas
        ref={overlayRef}
        className="absolute inset-0 pointer-events-none z-20"
        style={{ width: containerWidth, height: containerHeight }}
      />
      
      {/* Controls panel */}
      <div className="absolute top-4 right-4 glass-panel p-3 rounded-lg space-y-3 z-30 w-56">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium flex items-center gap-2">
            <Scan className="w-4 h-4" />
            AI Detection
          </span>
          <Switch checked={isActive} onCheckedChange={onToggle} />
        </div>
        
        {/* Analysis controls */}
        <div className="space-y-2">
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={isLiveMode ? "default" : "outline"}
              onClick={() => setIsLiveMode(!isLiveMode)}
              className="flex-1"
            >
              {isLiveMode ? <Pause className="w-3 h-3 mr-1" /> : <Play className="w-3 h-3 mr-1" />}
              {isLiveMode ? 'Stop' : 'Live'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={analyzeFrame}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <RefreshCw className="w-3 h-3" />
              )}
            </Button>
          </div>
          
          {isLiveMode && (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Analysis Interval</Label>
              <Slider
                value={[analyzeInterval]}
                onValueChange={([v]) => setAnalyzeInterval(v)}
                min={500}
                max={5000}
                step={100}
              />
              <span className="text-xs text-muted-foreground">{analyzeInterval}ms</span>
            </div>
          )}
        </div>
        
        {/* Team counts */}
        {detection && detection.players.length > 0 && (
          <div className="flex gap-2">
            <Badge variant="secondary" className="flex-1 justify-center" style={{ borderColor: TEAM_COLORS.home.stroke }}>
              <Users className="w-3 h-3 mr-1" />
              Home: {homeCount}
            </Badge>
            <Badge variant="secondary" className="flex-1 justify-center" style={{ borderColor: TEAM_COLORS.away.stroke }}>
              <Users className="w-3 h-3 mr-1" />
              Away: {awayCount}
            </Badge>
          </div>
        )}
        
        {/* Visibility toggles */}
        <div className="space-y-2 pt-2 border-t border-border/50">
          <Label className="text-xs text-muted-foreground">Show/Hide</Label>
          
          <div className="grid grid-cols-2 gap-2">
            <Button
              size="sm"
              variant={showPlayers ? "default" : "ghost"}
              onClick={() => setShowPlayers(!showPlayers)}
              className="justify-start"
            >
              <Users className="w-3 h-3 mr-1" />
              Players
            </Button>
            <Button
              size="sm"
              variant={showBall ? "default" : "ghost"}
              onClick={() => setShowBall(!showBall)}
              className="justify-start"
            >
              <Circle className="w-3 h-3 mr-1" />
              Ball
            </Button>
            <Button
              size="sm"
              variant={showFieldLines ? "default" : "ghost"}
              onClick={() => setShowFieldLines(!showFieldLines)}
              className="justify-start"
            >
              <Maximize2 className="w-3 h-3 mr-1" />
              Lines
            </Button>
            <Button
              size="sm"
              variant={showLabels ? "default" : "ghost"}
              onClick={() => setShowLabels(!showLabels)}
              className="justify-start"
            >
              {showLabels ? <Eye className="w-3 h-3 mr-1" /> : <EyeOff className="w-3 h-3 mr-1" />}
              Labels
            </Button>
          </div>
        </div>
        
        {/* Detection info */}
        {detection && (
          <div className="text-xs text-muted-foreground pt-2 border-t border-border/50">
            <div>Players: {detection.players.length}</div>
            <div>Ball: {detection.ball?.visible ? 'Visible' : 'Not found'}</div>
            <div>Lines: {detection.fieldLines.length}</div>
            <div>Frame: {detection.timestamp.toFixed(2)}s</div>
          </div>
        )}
        
        {isProcessing && (
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="w-3 h-3 animate-spin" />
            Analyzing...
          </div>
        )}
      </div>
    </>
  );
}
