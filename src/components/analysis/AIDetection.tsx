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
  Loader2,
  Settings2
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

// Team colors for visualization - more distinct colors
const TEAM_COLORS: Record<string, { fill: string; stroke: string; label: string }> = {
  home: { fill: 'rgba(34, 197, 94, 0.5)', stroke: '#22c55e', label: '#ffffff' },
  away: { fill: 'rgba(239, 68, 68, 0.5)', stroke: '#ef4444', label: '#ffffff' },
  referee: { fill: 'rgba(250, 204, 21, 0.5)', stroke: '#facc15', label: '#000000' },
  unknown: { fill: 'rgba(148, 163, 184, 0.5)', stroke: '#94a3b8', label: '#ffffff' },
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
  const [analyzeInterval, setAnalyzeInterval] = useState(2000);
  const [showSettings, setShowSettings] = useState(false);
  
  // Visibility toggles
  const [showPlayers, setShowPlayers] = useState(true);
  const [showBall, setShowBall] = useState(true);
  const [showFieldLines, setShowFieldLines] = useState(true);
  const [showFieldMask, setShowFieldMask] = useState(false);
  const [showLabels, setShowLabels] = useState(true);
  
  // Team counters
  const homeCount = detection?.players.filter(p => p.team === 'home').length ?? 0;
  const awayCount = detection?.players.filter(p => p.team === 'away').length ?? 0;

  // Capture current frame as base64 - use higher resolution for accuracy
  const captureFrame = useCallback((): string | null => {
    if (!videoElement || !captureCanvasRef.current) return null;
    
    const canvas = captureCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    
    // Use native video resolution for better accuracy (capped at 1280)
    const maxDim = 1280;
    const scaleRatio = Math.min(1, maxDim / Math.max(videoElement.videoWidth, videoElement.videoHeight));
    canvas.width = videoElement.videoWidth * scaleRatio;
    canvas.height = videoElement.videoHeight * scaleRatio;
    
    ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
    
    return canvas.toDataURL('image/jpeg', 0.85);
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
    
    // Set canvas to match container
    canvas.width = containerWidth;
    canvas.height = containerHeight;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (!detection) return;
    
    // Scale coordinates from percentage (0-100) to pixels
    const scaleX = containerWidth / 100;
    const scaleY = containerHeight / 100;
    
    // Draw field mask
    if (showFieldMask && detection.fieldMask.isVisible && detection.fieldMask.corners.length > 2) {
      ctx.beginPath();
      const firstCorner = detection.fieldMask.corners[0];
      ctx.moveTo(firstCorner.x * scaleX, firstCorner.y * scaleY);
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
        
        for (let i = 1; i < line.points.length; i++) {
          ctx.lineTo(line.points[i].x * scaleX, line.points[i].y * scaleY);
        }
        
        ctx.strokeStyle = LINE_TYPE_COLORS[line.type] || LINE_TYPE_COLORS.unknown;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
      });
    }
    
    // Draw players with improved visualization
    if (showPlayers && detection.players.length > 0) {
      detection.players.forEach(player => {
        const x = player.x * scaleX;
        const y = player.y * scaleY;
        const w = Math.max((player.width || 2) * scaleX, 20);
        const h = Math.max((player.height || 4) * scaleY, 40);
        
        const colors = TEAM_COLORS[player.team] || TEAM_COLORS.unknown;
        
        // Draw bounding box with rounded corners
        ctx.beginPath();
        const radius = 4;
        ctx.roundRect(x - w/2, y - h/2, w, h, radius);
        ctx.fillStyle = colors.fill;
        ctx.fill();
        ctx.strokeStyle = colors.stroke;
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Draw team indicator dot at bottom
        ctx.beginPath();
        ctx.arc(x, y + h/2 + 6, 5, 0, Math.PI * 2);
        ctx.fillStyle = colors.stroke;
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.stroke();
        
        // Draw label with background
        if (showLabels) {
          const label = `${player.team === 'referee' ? 'REF' : '#' + player.id}`;
          ctx.font = 'bold 11px system-ui, sans-serif';
          const textWidth = ctx.measureText(label).width;
          
          // Label background
          ctx.fillStyle = colors.stroke;
          ctx.beginPath();
          ctx.roundRect(x - textWidth/2 - 4, y - h/2 - 18, textWidth + 8, 16, 3);
          ctx.fill();
          
          // Label text
          ctx.fillStyle = colors.label;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(label, x, y - h/2 - 10);
        }
      });
    }
    
    // Draw ball with pulse effect
    if (showBall && detection.ball?.visible) {
      const ball = detection.ball;
      const x = ball.x * scaleX;
      const y = ball.y * scaleY;
      
      // Outer pulse glow
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, 20);
      gradient.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
      gradient.addColorStop(0.5, 'rgba(255, 255, 0, 0.4)');
      gradient.addColorStop(1, 'rgba(255, 255, 0, 0)');
      ctx.beginPath();
      ctx.arc(x, y, 20, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();
      
      // Ball circle
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.stroke();
      
      // Pentagon pattern
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const angle = (i * 72 - 90) * Math.PI / 180;
        const px = x + Math.cos(angle) * 4;
        const py = y + Math.sin(angle) * 4;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fillStyle = '#333333';
      ctx.fill();
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
      <div className="absolute top-4 right-4 glass-panel p-3 rounded-lg space-y-3 z-30 w-60">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium flex items-center gap-2">
            <Scan className="w-4 h-4 text-primary" />
            AI Detection
          </span>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0"
              onClick={() => setShowSettings(!showSettings)}
            >
              <Settings2 className="w-3 h-3" />
            </Button>
            <Switch checked={isActive} onCheckedChange={onToggle} />
          </div>
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
              title="Analyze current frame"
            >
              {isProcessing ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <RefreshCw className="w-3 h-3" />
              )}
            </Button>
          </div>
          
          {showSettings && (
            <div className="space-y-2 pt-2 border-t border-border/50">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Interval: {analyzeInterval}ms</Label>
                <Slider
                  value={[analyzeInterval]}
                  onValueChange={([v]) => setAnalyzeInterval(v)}
                  min={1000}
                  max={5000}
                  step={500}
                />
              </div>
            </div>
          )}
        </div>
        
        {/* Team counts */}
        {detection && detection.players.length > 0 && (
          <div className="flex gap-2">
            <Badge variant="secondary" className="flex-1 justify-center gap-1 py-1" style={{ backgroundColor: 'rgba(34, 197, 94, 0.2)', borderColor: '#22c55e' }}>
              <Users className="w-3 h-3" />
              {homeCount}
            </Badge>
            <Badge variant="secondary" className="flex-1 justify-center gap-1 py-1" style={{ backgroundColor: 'rgba(239, 68, 68, 0.2)', borderColor: '#ef4444' }}>
              <Users className="w-3 h-3" />
              {awayCount}
            </Badge>
          </div>
        )}
        
        {/* Visibility toggles */}
        <div className="space-y-2 pt-2 border-t border-border/50">
          <Label className="text-xs text-muted-foreground">Visibility</Label>
          
          <div className="grid grid-cols-2 gap-1">
            <Button
              size="sm"
              variant={showPlayers ? "default" : "ghost"}
              onClick={() => setShowPlayers(!showPlayers)}
              className="justify-start h-7 text-xs"
            >
              <Users className="w-3 h-3 mr-1" />
              Players
            </Button>
            <Button
              size="sm"
              variant={showBall ? "default" : "ghost"}
              onClick={() => setShowBall(!showBall)}
              className="justify-start h-7 text-xs"
            >
              <Circle className="w-3 h-3 mr-1" />
              Ball
            </Button>
            <Button
              size="sm"
              variant={showFieldLines ? "default" : "ghost"}
              onClick={() => setShowFieldLines(!showFieldLines)}
              className="justify-start h-7 text-xs"
            >
              <Maximize2 className="w-3 h-3 mr-1" />
              Lines
            </Button>
            <Button
              size="sm"
              variant={showLabels ? "default" : "ghost"}
              onClick={() => setShowLabels(!showLabels)}
              className="justify-start h-7 text-xs"
            >
              {showLabels ? <Eye className="w-3 h-3 mr-1" /> : <EyeOff className="w-3 h-3 mr-1" />}
              Labels
            </Button>
          </div>
        </div>
        
        {/* Detection summary */}
        {detection && (
          <div className="text-[10px] text-muted-foreground pt-2 border-t border-border/50 grid grid-cols-2 gap-x-2">
            <div>Players: {detection.players.length}</div>
            <div>Ball: {detection.ball?.visible ? '✓' : '✗'}</div>
            <div>Lines: {detection.fieldLines.length}</div>
            <div>Time: {detection.timestamp.toFixed(1)}s</div>
          </div>
        )}
        
        {isProcessing && (
          <div className="flex items-center justify-center gap-2 text-xs text-primary">
            <Loader2 className="w-3 h-3 animate-spin" />
            Analyzing frame...
          </div>
        )}
      </div>
    </>
  );
}
