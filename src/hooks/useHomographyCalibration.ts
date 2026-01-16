import { useState, useCallback, useEffect } from 'react';
import {
  CalibrationPoint,
  HomographyCalibration,
  ValidationMetrics,
  VideoCoord,
  PitchCoord,
} from '@/types/calibration';
import {
  loadOpenCV,
  isOpenCVReady,
  computeHomography,
  computeInverseHomography,
  videoToPitch,
  pitchToVideo,
  validateCalibration,
  generateId,
} from '@/utils/homography';
import { PITCH_FEATURES } from '@/utils/pitchConstants';

interface UseHomographyCalibrationReturn {
  // State
  isCalibrationMode: boolean;
  selectedFeature: string | null;
  calibrationPoints: CalibrationPoint[];
  homographyMatrix: number[][] | null;
  inverseMatrix: number[][] | null;
  validationMetrics: ValidationMetrics | null;
  isOpenCVLoaded: boolean;
  isComputing: boolean;
  error: string | null;
  
  // Actions
  startCalibration: () => void;
  stopCalibration: () => void;
  selectFeature: (featureId: string | null) => void;
  addCalibrationPoint: (videoX: number, videoY: number, frameNumber: number) => void;
  removeCalibrationPoint: (pointId: string) => void;
  clearCalibrationPoints: () => void;
  computeCalibration: () => Promise<boolean>;
  
  // Transformation functions
  transformVideoToPitch: (x: number, y: number) => PitchCoord | null;
  transformPitchToVideo: (X: number, Y: number) => VideoCoord | null;
  
  // Persistence
  saveCalibration: (videoId: string) => void;
  loadCalibration: (videoId: string) => boolean;
  clearSavedCalibration: (videoId: string) => void;
}

export function useHomographyCalibration(): UseHomographyCalibrationReturn {
  const [isCalibrationMode, setIsCalibrationMode] = useState(false);
  const [selectedFeature, setSelectedFeature] = useState<string | null>(null);
  const [calibrationPoints, setCalibrationPoints] = useState<CalibrationPoint[]>([]);
  const [homographyMatrix, setHomographyMatrix] = useState<number[][] | null>(null);
  const [inverseMatrix, setInverseMatrix] = useState<number[][] | null>(null);
  const [validationMetrics, setValidationMetrics] = useState<ValidationMetrics | null>(null);
  const [isOpenCVLoaded, setIsOpenCVLoaded] = useState(false);
  const [isComputing, setIsComputing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load OpenCV on mount
  useEffect(() => {
    loadOpenCV()
      .then(() => {
        setIsOpenCVLoaded(true);
        setError(null);
      })
      .catch((err) => {
        setError(`Failed to load OpenCV: ${err.message}`);
        console.error(err);
      });
  }, []);

  const startCalibration = useCallback(() => {
    setIsCalibrationMode(true);
    setError(null);
  }, []);

  const stopCalibration = useCallback(() => {
    setIsCalibrationMode(false);
    setSelectedFeature(null);
  }, []);

  const selectFeature = useCallback((featureId: string | null) => {
    setSelectedFeature(featureId);
    setError(null);
  }, []);

  const addCalibrationPoint = useCallback((videoX: number, videoY: number, frameNumber: number) => {
    if (!selectedFeature) {
      setError('Please select a pitch feature first');
      return;
    }

    const feature = PITCH_FEATURES[selectedFeature];
    if (!feature) {
      setError('Invalid pitch feature selected');
      return;
    }

    // Check for duplicate feature
    const existingPoint = calibrationPoints.find(p => p.feature_name === selectedFeature);
    if (existingPoint) {
      // Update existing point
      setCalibrationPoints(prev =>
        prev.map(p =>
          p.feature_name === selectedFeature
            ? {
                ...p,
                video_coords: { x: videoX, y: videoY },
                frame_number: frameNumber,
              }
            : p
        )
      );
    } else {
      // Add new point
      const newPoint: CalibrationPoint = {
        id: generateId(),
        video_coords: { x: videoX, y: videoY },
        pitch_coords: { X: feature.X, Y: feature.Y },
        frame_number: frameNumber,
        feature_name: selectedFeature,
      };
      setCalibrationPoints(prev => [...prev, newPoint]);
    }

    setSelectedFeature(null); // Reset for next point
    setError(null);
  }, [selectedFeature, calibrationPoints]);

  const removeCalibrationPoint = useCallback((pointId: string) => {
    setCalibrationPoints(prev => prev.filter(p => p.id !== pointId));
  }, []);

  const clearCalibrationPoints = useCallback(() => {
    setCalibrationPoints([]);
    setHomographyMatrix(null);
    setInverseMatrix(null);
    setValidationMetrics(null);
    setError(null);
  }, []);

  const computeCalibration = useCallback(async (): Promise<boolean> => {
    if (calibrationPoints.length < 4) {
      setError(`Need at least 4 points (have ${calibrationPoints.length})`);
      return false;
    }

    if (!isOpenCVReady()) {
      setError('OpenCV is not ready. Please wait or refresh the page.');
      return false;
    }

    setIsComputing(true);
    setError(null);

    try {
      // Compute homography
      const H = computeHomography(calibrationPoints);
      if (!H) {
        setError('Failed to compute homography. Try different points.');
        setIsComputing(false);
        return false;
      }

      // Compute inverse
      const H_inv = computeInverseHomography(H);
      if (!H_inv) {
        setError('Failed to compute inverse homography.');
        setIsComputing(false);
        return false;
      }

      // Validate
      const metrics = validateCalibration(calibrationPoints, H);
      
      setHomographyMatrix(H);
      setInverseMatrix(H_inv);
      setValidationMetrics(metrics);
      setIsComputing(false);

      if (metrics.mean_error > 2.0) {
        setError(`Warning: High calibration error (${metrics.mean_error.toFixed(2)}m). Consider adding more points.`);
      }

      return metrics.is_valid;
    } catch (err) {
      setError(`Computation error: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setIsComputing(false);
      return false;
    }
  }, [calibrationPoints]);

  const transformVideoToPitch = useCallback((x: number, y: number): PitchCoord | null => {
    if (!homographyMatrix) return null;
    return videoToPitch(x, y, homographyMatrix);
  }, [homographyMatrix]);

  const transformPitchToVideo = useCallback((X: number, Y: number): VideoCoord | null => {
    if (!inverseMatrix) return null;
    return pitchToVideo(X, Y, inverseMatrix);
  }, [inverseMatrix]);

  // Persistence functions
  const saveCalibration = useCallback((videoId: string) => {
    if (!homographyMatrix || !inverseMatrix || !validationMetrics) {
      setError('No calibration to save');
      return;
    }

    const calibration: HomographyCalibration = {
      id: generateId(),
      video_id: videoId,
      homography_matrix: homographyMatrix,
      inverse_matrix: inverseMatrix,
      calibration_points: calibrationPoints,
      validation_metrics: validationMetrics,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    try {
      localStorage.setItem(`calibration:${videoId}`, JSON.stringify(calibration));
    } catch (err) {
      console.error('Failed to save calibration:', err);
    }
  }, [homographyMatrix, inverseMatrix, validationMetrics, calibrationPoints]);

  const loadCalibration = useCallback((videoId: string): boolean => {
    try {
      const data = localStorage.getItem(`calibration:${videoId}`);
      if (!data) return false;

      const calibration: HomographyCalibration = JSON.parse(data);
      setCalibrationPoints(calibration.calibration_points);
      setHomographyMatrix(calibration.homography_matrix);
      setInverseMatrix(calibration.inverse_matrix);
      setValidationMetrics(calibration.validation_metrics);
      return true;
    } catch (err) {
      console.error('Failed to load calibration:', err);
      return false;
    }
  }, []);

  const clearSavedCalibration = useCallback((videoId: string) => {
    try {
      localStorage.removeItem(`calibration:${videoId}`);
    } catch (err) {
      console.error('Failed to clear calibration:', err);
    }
  }, []);

  return {
    isCalibrationMode,
    selectedFeature,
    calibrationPoints,
    homographyMatrix,
    inverseMatrix,
    validationMetrics,
    isOpenCVLoaded,
    isComputing,
    error,
    startCalibration,
    stopCalibration,
    selectFeature,
    addCalibrationPoint,
    removeCalibrationPoint,
    clearCalibrationPoints,
    computeCalibration,
    transformVideoToPitch,
    transformPitchToVideo,
    saveCalibration,
    loadCalibration,
    clearSavedCalibration,
  };
}
