import { useState, useCallback } from 'react';
import { Annotation, AnnotationType, Vector3, ANNOTATION_COLORS } from '@/types/analysis';

export function useAnnotations(projectId?: string) {
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);
  const [currentColor, setCurrentColor] = useState(ANNOTATION_COLORS[0]);

  const generateId = () => crypto.randomUUID();

  const addAnnotation = useCallback((
    type: AnnotationType,
    position: Vector3,
    options?: {
      endPosition?: Vector3;
      label?: string;
      color?: string;
      timestampStart?: number;
      radius?: number;
      points?: Vector3[];
    }
  ) => {
    const newAnnotation: Annotation = {
      id: generateId(),
      projectId: projectId || '',
      type,
      label: options?.label || '',
      color: options?.color || currentColor,
      position,
      endPosition: options?.endPosition,
      points: options?.points,
      radius: options?.radius,
      strokeWidth: 3,
      timestampStart: options?.timestampStart || 0,
      metadata: {},
      layerOrder: annotations.length,
      visible: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setAnnotations(prev => [...prev, newAnnotation]);
    setSelectedAnnotationId(newAnnotation.id);
    return newAnnotation;
  }, [annotations.length, currentColor, projectId]);

  const updateAnnotation = useCallback((id: string, updates: Partial<Annotation>) => {
    setAnnotations(prev => prev.map(ann => 
      ann.id === id 
        ? { ...ann, ...updates, updatedAt: new Date().toISOString() }
        : ann
    ));
  }, []);

  const deleteAnnotation = useCallback((id: string) => {
    setAnnotations(prev => prev.filter(ann => ann.id !== id));
    if (selectedAnnotationId === id) {
      setSelectedAnnotationId(null);
    }
  }, [selectedAnnotationId]);

  const clearAnnotations = useCallback(() => {
    setAnnotations([]);
    setSelectedAnnotationId(null);
  }, []);

  const selectAnnotation = useCallback((id: string | null) => {
    setSelectedAnnotationId(id);
  }, []);

  const getAnnotationsAtTime = useCallback((time: number) => {
    return annotations.filter(ann => {
      if (ann.timestampEnd !== undefined) {
        return time >= ann.timestampStart && time <= ann.timestampEnd;
      }
      return true; // Persistent annotations
    });
  }, [annotations]);

  const toggleAnnotationVisibility = useCallback((id: string) => {
    setAnnotations(prev => prev.map(ann =>
      ann.id === id ? { ...ann, visible: !ann.visible } : ann
    ));
  }, []);

  const selectedAnnotation = annotations.find(a => a.id === selectedAnnotationId) || null;

  return {
    annotations,
    selectedAnnotation,
    selectedAnnotationId,
    currentColor,
    setCurrentColor,
    addAnnotation,
    updateAnnotation,
    deleteAnnotation,
    clearAnnotations,
    selectAnnotation,
    getAnnotationsAtTime,
    toggleAnnotationVisibility,
    setAnnotations,
  };
}
