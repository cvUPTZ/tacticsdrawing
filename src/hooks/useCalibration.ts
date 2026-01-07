import { useState, useCallback } from 'react';
import { CalibrationState, DEFAULT_CALIBRATION } from '@/types/analysis';

export function useCalibration() {
  const [calibration, setCalibration] = useState<CalibrationState>(DEFAULT_CALIBRATION);
  const [isCalibrating, setIsCalibrating] = useState(false);

  const updateCalibration = useCallback((updates: Partial<CalibrationState>) => {
    setCalibration(prev => ({ ...prev, ...updates }));
  }, []);

  const resetCalibration = useCallback(() => {
    setCalibration(DEFAULT_CALIBRATION);
  }, []);

  const toggleCalibrating = useCallback(() => {
    setIsCalibrating(prev => !prev);
  }, []);

  // Preset calibrations for common camera angles
  const presets = {
    broadcast: {
      cameraX: 0,
      cameraY: 45,
      cameraZ: 70,
      cameraFov: 50,
      cameraRotationX: -0.4,
      cameraRotationY: 0,
      cameraRotationZ: 0,
    },
    tactical: {
      cameraX: 0,
      cameraY: 80,
      cameraZ: 50,
      cameraFov: 60,
      cameraRotationX: -0.8,
      cameraRotationY: 0,
      cameraRotationZ: 0,
    },
    sideline: {
      cameraX: -60,
      cameraY: 20,
      cameraZ: 40,
      cameraFov: 45,
      cameraRotationX: -0.2,
      cameraRotationY: 0.5,
      cameraRotationZ: 0,
    },
    behindGoal: {
      cameraX: 0,
      cameraY: 25,
      cameraZ: -70,
      cameraFov: 55,
      cameraRotationX: -0.3,
      cameraRotationY: Math.PI,
      cameraRotationZ: 0,
    },
  };

  const applyPreset = useCallback((preset: keyof typeof presets) => {
    setCalibration(presets[preset]);
  }, []);

  return {
    calibration,
    isCalibrating,
    updateCalibration,
    resetCalibration,
    toggleCalibrating,
    applyPreset,
    presets,
  };
}
