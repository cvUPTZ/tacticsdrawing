// Homography computation and transformation utilities
// Uses OpenCV.js for matrix computation

import { VideoCoord, PitchCoord, CalibrationPoint, ValidationMetrics } from '@/types/calibration';

declare global {
  interface Window {
    cv: any;
  }
}

// Load OpenCV.js dynamically
let cvLoadPromise: Promise<void> | null = null;

export function loadOpenCV(): Promise<void> {
  if (cvLoadPromise) return cvLoadPromise;
  
  if (window.cv && window.cv.Mat) {
    return Promise.resolve();
  }

  cvLoadPromise = new Promise((resolve, reject) => {
    // Check if already loading
    const existingScript = document.querySelector('script[src*="opencv"]');
    if (existingScript) {
      const checkInterval = setInterval(() => {
        if (window.cv && window.cv.Mat) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://docs.opencv.org/4.8.0/opencv.js';
    script.async = true;
    
    script.onload = () => {
      // OpenCV.js sets up cv asynchronously
      const checkInterval = setInterval(() => {
        if (window.cv && window.cv.Mat) {
          clearInterval(checkInterval);
          console.log('OpenCV.js loaded successfully');
          resolve();
        }
      }, 100);
      
      // Timeout after 30 seconds
      setTimeout(() => {
        clearInterval(checkInterval);
        if (!window.cv || !window.cv.Mat) {
          reject(new Error('OpenCV.js initialization timeout'));
        }
      }, 30000);
    };
    
    script.onerror = () => {
      reject(new Error('Failed to load OpenCV.js'));
    };
    
    document.head.appendChild(script);
  });

  return cvLoadPromise;
}

// Check if OpenCV is ready
export function isOpenCVReady(): boolean {
  return !!(window.cv && window.cv.Mat);
}

// Compute homography matrix from calibration points
export function computeHomography(points: CalibrationPoint[]): number[][] | null {
  if (points.length < 4) {
    console.error('Need at least 4 points for homography');
    return null;
  }

  if (!isOpenCVReady()) {
    console.error('OpenCV not loaded');
    return null;
  }

  const cv = window.cv;
  
  try {
    // Prepare source points (video coordinates)
    const srcArray: number[] = [];
    points.forEach(p => {
      srcArray.push(p.video_coords.x, p.video_coords.y);
    });
    
    // Prepare destination points (pitch coordinates)
    const dstArray: number[] = [];
    points.forEach(p => {
      dstArray.push(p.pitch_coords.X, p.pitch_coords.Y);
    });
    
    // Create OpenCV matrices
    const srcMat = cv.matFromArray(points.length, 1, cv.CV_32FC2, srcArray);
    const dstMat = cv.matFromArray(points.length, 1, cv.CV_32FC2, dstArray);
    
    // Compute homography using RANSAC for robustness
    const H = cv.findHomography(srcMat, dstMat, cv.RANSAC, 3);
    
    if (H.empty()) {
      console.error('Homography computation failed');
      srcMat.delete();
      dstMat.delete();
      H.delete();
      return null;
    }
    
    // Convert to 2D array
    const matrix: number[][] = [];
    for (let i = 0; i < 3; i++) {
      matrix[i] = [];
      for (let j = 0; j < 3; j++) {
        matrix[i][j] = H.data64F[i * 3 + j];
      }
    }
    
    // Cleanup
    srcMat.delete();
    dstMat.delete();
    H.delete();
    
    return matrix;
  } catch (error) {
    console.error('Error computing homography:', error);
    return null;
  }
}

// Compute inverse homography matrix
export function computeInverseHomography(H: number[][]): number[][] | null {
  if (!isOpenCVReady()) {
    console.error('OpenCV not loaded');
    return null;
  }

  const cv = window.cv;
  
  try {
    const hMat = cv.matFromArray(3, 3, cv.CV_64F, H.flat());
    const hInv = new cv.Mat();
    cv.invert(hMat, hInv);
    
    const inverse: number[][] = [];
    for (let i = 0; i < 3; i++) {
      inverse[i] = [];
      for (let j = 0; j < 3; j++) {
        inverse[i][j] = hInv.data64F[i * 3 + j];
      }
    }
    
    hMat.delete();
    hInv.delete();
    
    return inverse;
  } catch (error) {
    console.error('Error computing inverse homography:', error);
    return null;
  }
}

// Transform video coordinates to pitch coordinates
export function videoToPitch(x: number, y: number, H: number[][]): PitchCoord {
  const w = H[2][0] * x + H[2][1] * y + H[2][2];
  const X = (H[0][0] * x + H[0][1] * y + H[0][2]) / w;
  const Y = (H[1][0] * x + H[1][1] * y + H[1][2]) / w;
  return { X, Y };
}

// Transform pitch coordinates to video coordinates
export function pitchToVideo(X: number, Y: number, H_inv: number[][]): VideoCoord {
  const w = H_inv[2][0] * X + H_inv[2][1] * Y + H_inv[2][2];
  const x = (H_inv[0][0] * X + H_inv[0][1] * Y + H_inv[0][2]) / w;
  const y = (H_inv[1][0] * X + H_inv[1][1] * Y + H_inv[1][2]) / w;
  return { x, y };
}

// Validate calibration accuracy
export function validateCalibration(
  points: CalibrationPoint[],
  H: number[][]
): ValidationMetrics {
  let totalError = 0;
  let maxError = 0;
  
  points.forEach(point => {
    const predicted = videoToPitch(point.video_coords.x, point.video_coords.y, H);
    const actual = point.pitch_coords;
    const error = Math.sqrt(
      Math.pow(predicted.X - actual.X, 2) +
      Math.pow(predicted.Y - actual.Y, 2)
    );
    
    totalError += error;
    maxError = Math.max(maxError, error);
  });
  
  const meanError = totalError / points.length;
  
  return {
    mean_error: meanError,
    max_error: maxError,
    point_count: points.length,
    is_valid: meanError < 2.0, // Acceptable threshold: 2 meters
  };
}

// Generate unique ID
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
