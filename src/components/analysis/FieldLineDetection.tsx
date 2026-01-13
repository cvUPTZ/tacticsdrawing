import { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Scan, Eye, EyeOff, RotateCcw, Maximize2 } from 'lucide-react';

interface DetectedLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  angle: number;
  length: number;
  isExtended?: boolean;
}

interface FieldLineDetectionProps {
  videoElement: HTMLVideoElement | null;
  isActive: boolean;
  onToggle: () => void;
  containerWidth: number;
  containerHeight: number;
}

// Sobel kernels for edge detection
const SOBEL_X = [
  [-1, 0, 1],
  [-2, 0, 2],
  [-1, 0, 1],
];

const SOBEL_Y = [
  [-1, -2, -1],
  [0, 0, 0],
  [1, 2, 1],
];

// Apply Gaussian blur for noise reduction
function gaussianBlur(imageData: ImageData, radius: number = 1): ImageData {
  const { data, width, height } = imageData;
  const output = new Uint8ClampedArray(data.length);
  
  const kernel = generateGaussianKernel(radius);
  const kSize = kernel.length;
  const half = Math.floor(kSize / 2);
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0, g = 0, b = 0, weightSum = 0;
      
      for (let ky = 0; ky < kSize; ky++) {
        for (let kx = 0; kx < kSize; kx++) {
          const px = Math.min(width - 1, Math.max(0, x + kx - half));
          const py = Math.min(height - 1, Math.max(0, y + ky - half));
          const idx = (py * width + px) * 4;
          const weight = kernel[ky][kx];
          
          r += data[idx] * weight;
          g += data[idx + 1] * weight;
          b += data[idx + 2] * weight;
          weightSum += weight;
        }
      }
      
      const outIdx = (y * width + x) * 4;
      output[outIdx] = r / weightSum;
      output[outIdx + 1] = g / weightSum;
      output[outIdx + 2] = b / weightSum;
      output[outIdx + 3] = 255;
    }
  }
  
  return new ImageData(output, width, height);
}

function generateGaussianKernel(radius: number): number[][] {
  const size = radius * 2 + 1;
  const kernel: number[][] = [];
  const sigma = radius / 2;
  
  for (let y = 0; y < size; y++) {
    kernel[y] = [];
    for (let x = 0; x < size; x++) {
      const dx = x - radius;
      const dy = y - radius;
      kernel[y][x] = Math.exp(-(dx * dx + dy * dy) / (2 * sigma * sigma));
    }
  }
  
  return kernel;
}

// Convert to grayscale
function toGrayscale(imageData: ImageData): Float32Array {
  const { data, width, height } = imageData;
  const gray = new Float32Array(width * height);
  
  for (let i = 0; i < gray.length; i++) {
    const idx = i * 4;
    // Use luminosity method for better results
    gray[i] = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
  }
  
  return gray;
}

// Apply Sobel edge detection
function sobelEdgeDetection(gray: Float32Array, width: number, height: number): {
  magnitude: Float32Array;
  direction: Float32Array;
} {
  const magnitude = new Float32Array(width * height);
  const direction = new Float32Array(width * height);
  
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let gx = 0, gy = 0;
      
      for (let ky = 0; ky < 3; ky++) {
        for (let kx = 0; kx < 3; kx++) {
          const idx = (y + ky - 1) * width + (x + kx - 1);
          gx += gray[idx] * SOBEL_X[ky][kx];
          gy += gray[idx] * SOBEL_Y[ky][kx];
        }
      }
      
      const idx = y * width + x;
      magnitude[idx] = Math.sqrt(gx * gx + gy * gy);
      direction[idx] = Math.atan2(gy, gx);
    }
  }
  
  return { magnitude, direction };
}

// Non-maximum suppression for edge thinning
function nonMaxSuppression(
  magnitude: Float32Array,
  direction: Float32Array,
  width: number,
  height: number
): Float32Array {
  const output = new Float32Array(width * height);
  
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      const angle = direction[idx] * (180 / Math.PI);
      const mag = magnitude[idx];
      
      let neighbor1 = 0, neighbor2 = 0;
      
      // Determine neighbors based on gradient direction
      if ((angle >= -22.5 && angle < 22.5) || (angle >= 157.5 || angle < -157.5)) {
        neighbor1 = magnitude[idx - 1];
        neighbor2 = magnitude[idx + 1];
      } else if ((angle >= 22.5 && angle < 67.5) || (angle >= -157.5 && angle < -112.5)) {
        neighbor1 = magnitude[(y - 1) * width + (x + 1)];
        neighbor2 = magnitude[(y + 1) * width + (x - 1)];
      } else if ((angle >= 67.5 && angle < 112.5) || (angle >= -112.5 && angle < -67.5)) {
        neighbor1 = magnitude[(y - 1) * width + x];
        neighbor2 = magnitude[(y + 1) * width + x];
      } else {
        neighbor1 = magnitude[(y - 1) * width + (x - 1)];
        neighbor2 = magnitude[(y + 1) * width + (x + 1)];
      }
      
      output[idx] = (mag >= neighbor1 && mag >= neighbor2) ? mag : 0;
    }
  }
  
  return output;
}

// Double threshold and hysteresis
function doubleThreshold(
  edges: Float32Array,
  lowThreshold: number,
  highThreshold: number
): Uint8Array {
  const output = new Uint8Array(edges.length);
  
  for (let i = 0; i < edges.length; i++) {
    if (edges[i] >= highThreshold) {
      output[i] = 255; // Strong edge
    } else if (edges[i] >= lowThreshold) {
      output[i] = 128; // Weak edge
    }
  }
  
  return output;
}

// Hough Transform for line detection
function houghTransform(
  edges: Uint8Array,
  width: number,
  height: number,
  threshold: number,
  minLineLength: number
): DetectedLine[] {
  const diagonal = Math.sqrt(width * width + height * height);
  const rhoMax = Math.ceil(diagonal);
  const thetaSteps = 180;
  
  // Accumulator array
  const accumulator = new Int32Array(2 * rhoMax * thetaSteps);
  
  // Vote for each edge point
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (edges[y * width + x] > 0) {
        for (let t = 0; t < thetaSteps; t++) {
          const theta = (t * Math.PI) / thetaSteps;
          const rho = Math.round(x * Math.cos(theta) + y * Math.sin(theta)) + rhoMax;
          accumulator[rho * thetaSteps + t]++;
        }
      }
    }
  }
  
  // Find peaks in accumulator
  const lines: DetectedLine[] = [];
  const visited = new Set<string>();
  
  for (let r = 0; r < 2 * rhoMax; r++) {
    for (let t = 0; t < thetaSteps; t++) {
      const votes = accumulator[r * thetaSteps + t];
      
      if (votes >= threshold) {
        // Check if this is a local maximum
        let isMax = true;
        for (let dr = -2; dr <= 2 && isMax; dr++) {
          for (let dt = -2; dt <= 2 && isMax; dt++) {
            if (dr === 0 && dt === 0) continue;
            const nr = r + dr;
            const nt = t + dt;
            if (nr >= 0 && nr < 2 * rhoMax && nt >= 0 && nt < thetaSteps) {
              if (accumulator[nr * thetaSteps + nt] > votes) {
                isMax = false;
              }
            }
          }
        }
        
        if (isMax) {
          const key = `${Math.round(r / 5)}_${Math.round(t / 5)}`;
          if (!visited.has(key)) {
            visited.add(key);
            
            const theta = (t * Math.PI) / thetaSteps;
            const rho = r - rhoMax;
            
            // Convert to line endpoints
            const line = rhoThetaToLine(rho, theta, width, height);
            if (line && line.length >= minLineLength) {
              lines.push(line);
            }
          }
        }
      }
    }
  }
  
  return lines;
}

// Convert rho-theta to line segment
function rhoThetaToLine(
  rho: number,
  theta: number,
  width: number,
  height: number
): DetectedLine | null {
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  
  const points: { x: number; y: number }[] = [];
  
  // Check intersection with all four edges
  if (Math.abs(sin) > 0.001) {
    // Top edge (y = 0)
    const x1 = rho / cos;
    if (x1 >= 0 && x1 <= width) points.push({ x: x1, y: 0 });
    
    // Bottom edge (y = height)
    const x2 = (rho - height * sin) / cos;
    if (x2 >= 0 && x2 <= width) points.push({ x: x2, y: height });
  }
  
  if (Math.abs(cos) > 0.001) {
    // Left edge (x = 0)
    const y1 = rho / sin;
    if (y1 >= 0 && y1 <= height) points.push({ x: 0, y: y1 });
    
    // Right edge (x = width)
    const y2 = (rho - width * cos) / sin;
    if (y2 >= 0 && y2 <= height) points.push({ x: width, y: y2 });
  }
  
  if (points.length < 2) return null;
  
  // Take first two valid points
  const p1 = points[0];
  const p2 = points[1];
  
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);
  
  return {
    x1: p1.x,
    y1: p1.y,
    x2: p2.x,
    y2: p2.y,
    angle,
    length,
  };
}

// Filter lines to keep only field-relevant ones (white/green contrast)
function filterFieldLines(
  lines: DetectedLine[],
  imageData: ImageData,
  greenThreshold: number
): DetectedLine[] {
  const { data, width, height } = imageData;
  
  return lines.filter((line) => {
    // Sample points along the line
    const samples = 10;
    let greenNearby = 0;
    let whiteOnLine = 0;
    
    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      const x = Math.round(line.x1 + t * (line.x2 - line.x1));
      const y = Math.round(line.y1 + t * (line.y2 - line.y1));
      
      if (x >= 0 && x < width && y >= 0 && y < height) {
        const idx = (y * width + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        
        // Check if pixel is white-ish (field line)
        if (r > 180 && g > 180 && b > 180) {
          whiteOnLine++;
        }
        
        // Check nearby for green (field)
        for (let dy = -5; dy <= 5; dy += 5) {
          for (let dx = -5; dx <= 5; dx += 5) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              const nIdx = (ny * width + nx) * 4;
              const nr = data[nIdx];
              const ng = data[nIdx + 1];
              const nb = data[nIdx + 2];
              
              // Green detection
              if (ng > nr * 1.2 && ng > nb * 1.1 && ng > greenThreshold) {
                greenNearby++;
              }
            }
          }
        }
      }
    }
    
    // Keep lines that have white pixels and green nearby
    return whiteOnLine >= 2 && greenNearby >= 5;
  });
}

// Extend lines to find continuation
function extendLines(
  lines: DetectedLine[],
  width: number,
  height: number,
  extensionFactor: number
): DetectedLine[] {
  const extended: DetectedLine[] = [];
  
  for (const line of lines) {
    const dx = line.x2 - line.x1;
    const dy = line.y2 - line.y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    
    if (len === 0) continue;
    
    // Normalize direction
    const ux = dx / len;
    const uy = dy / len;
    
    // Extend in both directions
    const extLen = len * extensionFactor;
    let newX1 = line.x1 - ux * extLen;
    let newY1 = line.y1 - uy * extLen;
    let newX2 = line.x2 + ux * extLen;
    let newY2 = line.y2 + uy * extLen;
    
    // Clip to bounds
    newX1 = Math.max(0, Math.min(width, newX1));
    newY1 = Math.max(0, Math.min(height, newY1));
    newX2 = Math.max(0, Math.min(width, newX2));
    newY2 = Math.max(0, Math.min(height, newY2));
    
    extended.push({
      ...line,
      x1: newX1,
      y1: newY1,
      x2: newX2,
      y2: newY2,
      isExtended: true,
    });
  }
  
  return extended;
}

// Merge similar lines
function mergeLines(lines: DetectedLine[], angleThreshold: number, distThreshold: number): DetectedLine[] {
  const merged: DetectedLine[] = [];
  const used = new Set<number>();
  
  for (let i = 0; i < lines.length; i++) {
    if (used.has(i)) continue;
    
    const line = lines[i];
    let bestLine = { ...line };
    let count = 1;
    
    for (let j = i + 1; j < lines.length; j++) {
      if (used.has(j)) continue;
      
      const other = lines[j];
      
      // Check angle similarity
      const angleDiff = Math.abs(line.angle - other.angle);
      if (angleDiff > angleThreshold && angleDiff < 180 - angleThreshold) continue;
      
      // Check distance
      const midX1 = (line.x1 + line.x2) / 2;
      const midY1 = (line.y1 + line.y2) / 2;
      const midX2 = (other.x1 + other.x2) / 2;
      const midY2 = (other.y1 + other.y2) / 2;
      const dist = Math.sqrt((midX1 - midX2) ** 2 + (midY1 - midY2) ** 2);
      
      if (dist < distThreshold) {
        used.add(j);
        count++;
        
        // Extend the line to cover both
        bestLine.x1 = Math.min(bestLine.x1, other.x1, other.x2);
        bestLine.y1 = Math.min(bestLine.y1, other.y1, other.y2);
        bestLine.x2 = Math.max(bestLine.x2, other.x1, other.x2);
        bestLine.y2 = Math.max(bestLine.y2, other.y1, other.y2);
      }
    }
    
    bestLine.length = Math.sqrt(
      (bestLine.x2 - bestLine.x1) ** 2 + (bestLine.y2 - bestLine.y1) ** 2
    );
    merged.push(bestLine);
    used.add(i);
  }
  
  return merged;
}

export function FieldLineDetection({
  videoElement,
  isActive,
  onToggle,
  containerWidth,
  containerHeight,
}: FieldLineDetectionProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const [detectedLines, setDetectedLines] = useState<DetectedLine[]>([]);
  const [extendedLines, setExtendedLines] = useState<DetectedLine[]>([]);
  const [showExtended, setShowExtended] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Detection parameters
  const [edgeThreshold, setEdgeThreshold] = useState(50);
  const [houghThreshold, setHoughThreshold] = useState(80);
  const [minLineLength, setMinLineLength] = useState(50);
  const [greenSensitivity, setGreenSensitivity] = useState(60);
  const [extensionFactor, setExtensionFactor] = useState(0.3);
  
  const detectLines = useCallback(() => {
    if (!videoElement || !canvasRef.current || !overlayRef.current) return;
    
    setIsProcessing(true);
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    
    // Set canvas size to match video
    const videoWidth = videoElement.videoWidth || 640;
    const videoHeight = videoElement.videoHeight || 360;
    
    // Use smaller resolution for performance
    const scale = Math.min(1, 640 / videoWidth);
    canvas.width = Math.round(videoWidth * scale);
    canvas.height = Math.round(videoHeight * scale);
    
    // Draw current video frame
    ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
    
    // Get image data
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    
    // Process in next frame to avoid blocking
    requestAnimationFrame(() => {
      try {
        // 1. Gaussian blur
        const blurred = gaussianBlur(imageData, 1);
        
        // 2. Convert to grayscale
        const gray = toGrayscale(blurred);
        
        // 3. Sobel edge detection
        const { magnitude, direction } = sobelEdgeDetection(gray, canvas.width, canvas.height);
        
        // 4. Non-maximum suppression
        const thinEdges = nonMaxSuppression(magnitude, direction, canvas.width, canvas.height);
        
        // 5. Double threshold
        const lowThreshold = edgeThreshold * 0.5;
        const highThreshold = edgeThreshold * 1.5;
        const edges = doubleThreshold(thinEdges, lowThreshold, highThreshold);
        
        // 6. Hough Transform
        let lines = houghTransform(
          edges,
          canvas.width,
          canvas.height,
          houghThreshold,
          minLineLength * scale
        );
        
        // 7. Filter to field lines only
        lines = filterFieldLines(lines, imageData, greenSensitivity);
        
        // 8. Merge similar lines
        lines = mergeLines(lines, 15, 30);
        
        // Scale back to original size for display
        const scaleBack = 1 / scale;
        lines = lines.map((line) => ({
          ...line,
          x1: line.x1 * scaleBack,
          y1: line.y1 * scaleBack,
          x2: line.x2 * scaleBack,
          y2: line.y2 * scaleBack,
          length: line.length * scaleBack,
        }));
        
        setDetectedLines(lines);
        
        // 9. Extend lines for continuation
        const extended = extendLines(
          lines,
          videoElement.videoWidth,
          videoElement.videoHeight,
          extensionFactor
        );
        setExtendedLines(extended);
        
      } catch (error) {
        console.error('Line detection error:', error);
      } finally {
        setIsProcessing(false);
      }
    });
  }, [videoElement, edgeThreshold, houghThreshold, minLineLength, greenSensitivity, extensionFactor]);
  
  // Draw overlay
  useEffect(() => {
    if (!overlayRef.current || !isActive) return;
    
    const overlay = overlayRef.current;
    const ctx = overlay.getContext('2d');
    if (!ctx) return;
    
    overlay.width = containerWidth;
    overlay.height = containerHeight;
    
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    
    const linesToDraw = showExtended ? extendedLines : detectedLines;
    
    // Scale factor from video to container
    const videoWidth = videoElement?.videoWidth || containerWidth;
    const videoHeight = videoElement?.videoHeight || containerHeight;
    const scaleX = containerWidth / videoWidth;
    const scaleY = containerHeight / videoHeight;
    
    // Draw detected lines
    linesToDraw.forEach((line, i) => {
      ctx.beginPath();
      ctx.moveTo(line.x1 * scaleX, line.y1 * scaleY);
      ctx.lineTo(line.x2 * scaleX, line.y2 * scaleY);
      
      if (line.isExtended) {
        ctx.strokeStyle = 'rgba(255, 165, 0, 0.7)'; // Orange for extended
        ctx.setLineDash([8, 4]);
      } else {
        ctx.strokeStyle = 'rgba(0, 255, 128, 0.9)'; // Green for detected
        ctx.setLineDash([]);
      }
      
      ctx.lineWidth = 2;
      ctx.stroke();
      
      // Draw endpoints
      ctx.fillStyle = line.isExtended ? 'rgba(255, 165, 0, 0.8)' : 'rgba(0, 255, 128, 1)';
      ctx.beginPath();
      ctx.arc(line.x1 * scaleX, line.y1 * scaleY, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(line.x2 * scaleX, line.y2 * scaleY, 4, 0, Math.PI * 2);
      ctx.fill();
    });
    
    ctx.setLineDash([]);
  }, [detectedLines, extendedLines, showExtended, isActive, containerWidth, containerHeight, videoElement]);
  
  // Auto-detect on video time change
  useEffect(() => {
    if (!isActive || !videoElement) return;
    
    const handleTimeUpdate = () => {
      detectLines();
    };
    
    // Detect on enable
    detectLines();
    
    // Detect on seek
    videoElement.addEventListener('seeked', handleTimeUpdate);
    
    return () => {
      videoElement.removeEventListener('seeked', handleTimeUpdate);
    };
  }, [isActive, videoElement, detectLines]);
  
  return (
    <>
      {/* Hidden processing canvas */}
      <canvas ref={canvasRef} className="hidden" />
      
      {/* Overlay canvas - positioned over video */}
      {isActive && (
        <canvas
          ref={overlayRef}
          className="absolute inset-0 pointer-events-none z-10"
          style={{ width: containerWidth, height: containerHeight }}
        />
      )}
      
      {/* Controls Panel */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Field Line Detection</Label>
          <Switch checked={isActive} onCheckedChange={onToggle} />
        </div>
        
        {isActive && (
          <div className="space-y-4 p-3 bg-muted/30 rounded-lg">
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={detectLines}
                disabled={isProcessing}
                className="flex-1"
              >
                <Scan className="w-4 h-4 mr-2" />
                {isProcessing ? 'Detecting...' : 'Detect Lines'}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setDetectedLines([]);
                  setExtendedLines([]);
                }}
              >
                <RotateCcw className="w-4 h-4" />
              </Button>
            </div>
            
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                Detected: {detectedLines.length} lines
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowExtended(!showExtended)}
                  className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
                >
                  {showExtended ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                  <span>Extended</span>
                </button>
              </div>
            </div>
            
            <div className="space-y-3">
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span>Edge Sensitivity</span>
                  <span className="text-muted-foreground">{edgeThreshold}</span>
                </div>
                <Slider
                  value={[edgeThreshold]}
                  onValueChange={([v]) => setEdgeThreshold(v)}
                  min={10}
                  max={150}
                  step={5}
                />
              </div>
              
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span>Line Threshold</span>
                  <span className="text-muted-foreground">{houghThreshold}</span>
                </div>
                <Slider
                  value={[houghThreshold]}
                  onValueChange={([v]) => setHoughThreshold(v)}
                  min={20}
                  max={200}
                  step={5}
                />
              </div>
              
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span>Min Line Length</span>
                  <span className="text-muted-foreground">{minLineLength}px</span>
                </div>
                <Slider
                  value={[minLineLength]}
                  onValueChange={([v]) => setMinLineLength(v)}
                  min={20}
                  max={200}
                  step={10}
                />
              </div>
              
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span>Green Sensitivity</span>
                  <span className="text-muted-foreground">{greenSensitivity}</span>
                </div>
                <Slider
                  value={[greenSensitivity]}
                  onValueChange={([v]) => setGreenSensitivity(v)}
                  min={20}
                  max={150}
                  step={5}
                />
              </div>
              
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span>Line Extension</span>
                  <span className="text-muted-foreground">{Math.round(extensionFactor * 100)}%</span>
                </div>
                <Slider
                  value={[extensionFactor * 100]}
                  onValueChange={([v]) => setExtensionFactor(v / 100)}
                  min={0}
                  max={100}
                  step={5}
                />
              </div>
            </div>
            
            <div className="flex items-center gap-2 pt-2 border-t border-border">
              <Maximize2 className="w-3 h-3 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground">
                Green = detected • Orange = extended continuation
              </span>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export type { DetectedLine };
