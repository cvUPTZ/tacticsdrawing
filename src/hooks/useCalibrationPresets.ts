import { useState, useCallback, useEffect } from 'react';
import { CalibrationState } from '@/types/analysis';

interface PitchScale {
  width: number;
  height: number;
}

export interface CalibrationPreset {
  id: string;
  name: string;
  calibration: CalibrationState;
  pitchScale: PitchScale;
  createdAt: string;
}

const STORAGE_KEY = 'calibration-presets';

export function useCalibrationPresets() {
  const [presets, setPresets] = useState<CalibrationPreset[]>([]);

  // Load presets from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setPresets(JSON.parse(stored));
      } catch {
        console.error('Failed to parse calibration presets');
      }
    }
  }, []);

  // Save presets to localStorage
  const savePresets = useCallback((newPresets: CalibrationPreset[]) => {
    setPresets(newPresets);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newPresets));
  }, []);

  const addPreset = useCallback((
    name: string, 
    calibration: CalibrationState, 
    pitchScale: PitchScale
  ) => {
    const newPreset: CalibrationPreset = {
      id: `preset-${Date.now()}`,
      name,
      calibration,
      pitchScale,
      createdAt: new Date().toISOString(),
    };
    savePresets([...presets, newPreset]);
    return newPreset;
  }, [presets, savePresets]);

  const deletePreset = useCallback((id: string) => {
    savePresets(presets.filter(p => p.id !== id));
  }, [presets, savePresets]);

  const renamePreset = useCallback((id: string, newName: string) => {
    savePresets(presets.map(p => 
      p.id === id ? { ...p, name: newName } : p
    ));
  }, [presets, savePresets]);

  const updatePreset = useCallback((
    id: string, 
    calibration: CalibrationState, 
    pitchScale: PitchScale
  ) => {
    savePresets(presets.map(p => 
      p.id === id ? { ...p, calibration, pitchScale } : p
    ));
  }, [presets, savePresets]);

  return {
    presets,
    addPreset,
    deletePreset,
    renamePreset,
    updatePreset,
  };
}
