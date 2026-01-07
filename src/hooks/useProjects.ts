import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Project, Annotation, Calibration } from '@/types/analysis';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export function useProjects() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchProjects = useCallback(async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;

      const mapped: Project[] = (data || []).map(p => ({
        id: p.id,
        userId: p.user_id,
        name: p.name,
        description: p.description || undefined,
        videoFilename: p.video_filename || undefined,
        videoUrl: p.video_url || undefined,
        thumbnailUrl: p.thumbnail_url || undefined,
        durationSeconds: p.duration_seconds ? Number(p.duration_seconds) : undefined,
        createdAt: p.created_at,
        updatedAt: p.updated_at,
      }));

      setProjects(mapped);
    } catch (error) {
      console.error('Error fetching projects:', error);
      toast.error('Failed to load projects');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchProjects();
    }
  }, [user, fetchProjects]);

  const createProject = useCallback(async (name: string, videoFilename?: string) => {
    if (!user) return null;

    try {
      const { data, error } = await supabase
        .from('projects')
        .insert({
          user_id: user.id,
          name,
          video_filename: videoFilename,
        })
        .select()
        .single();

      if (error) throw error;

      const project: Project = {
        id: data.id,
        userId: data.user_id,
        name: data.name,
        description: data.description || undefined,
        videoFilename: data.video_filename || undefined,
        videoUrl: data.video_url || undefined,
        thumbnailUrl: data.thumbnail_url || undefined,
        durationSeconds: data.duration_seconds ? Number(data.duration_seconds) : undefined,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };

      setProjects(prev => [project, ...prev]);
      setCurrentProject(project);
      toast.success('Project created');
      return project;
    } catch (error) {
      console.error('Error creating project:', error);
      toast.error('Failed to create project');
      return null;
    }
  }, [user]);

  const updateProject = useCallback(async (id: string, updates: Partial<Project>) => {
    try {
      const { error } = await supabase
        .from('projects')
        .update({
          name: updates.name,
          description: updates.description,
          video_filename: updates.videoFilename,
          video_url: updates.videoUrl,
          thumbnail_url: updates.thumbnailUrl,
          duration_seconds: updates.durationSeconds,
        })
        .eq('id', id);

      if (error) throw error;

      setProjects(prev => prev.map(p => 
        p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p
      ));

      if (currentProject?.id === id) {
        setCurrentProject(prev => prev ? { ...prev, ...updates } : null);
      }

      toast.success('Project saved');
    } catch (error) {
      console.error('Error updating project:', error);
      toast.error('Failed to save project');
    }
  }, [currentProject]);

  const deleteProject = useCallback(async (id: string) => {
    try {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setProjects(prev => prev.filter(p => p.id !== id));
      
      if (currentProject?.id === id) {
        setCurrentProject(null);
      }

      toast.success('Project deleted');
    } catch (error) {
      console.error('Error deleting project:', error);
      toast.error('Failed to delete project');
    }
  }, [currentProject]);

  const saveAnnotations = useCallback(async (projectId: string, annotations: Annotation[]) => {
    try {
      // Delete existing annotations for this project
      await supabase
        .from('annotations')
        .delete()
        .eq('project_id', projectId);

      // Insert new annotations
      if (annotations.length > 0) {
        const { error } = await supabase
          .from('annotations')
          .insert(annotations.map(a => ({
            project_id: projectId,
            type: a.type,
            label: a.label,
            color: a.color,
            position_x: a.position.x,
            position_y: a.position.y,
            position_z: a.position.z,
            end_position_x: a.endPosition?.x,
            end_position_y: a.endPosition?.y,
            end_position_z: a.endPosition?.z,
            points: a.points as unknown as null,
            radius: a.radius,
            stroke_width: a.strokeWidth,
            timestamp_start: a.timestampStart,
            timestamp_end: a.timestampEnd,
            metadata: a.metadata as unknown as null,
            layer_order: a.layerOrder,
            visible: a.visible,
          })));

        if (error) throw error;
      }

      toast.success('Annotations saved');
    } catch (error) {
      console.error('Error saving annotations:', error);
      toast.error('Failed to save annotations');
    }
  }, []);

  const loadAnnotations = useCallback(async (projectId: string): Promise<Annotation[]> => {
    try {
      const { data, error } = await supabase
        .from('annotations')
        .select('*')
        .eq('project_id', projectId)
        .order('layer_order');

      if (error) throw error;

      return (data || []).map(a => ({
        id: a.id,
        projectId: a.project_id,
        type: a.type as Annotation['type'],
        label: a.label || undefined,
        color: a.color || '#00d4ff',
        position: {
          x: Number(a.position_x) || 0,
          y: Number(a.position_y) || 0,
          z: Number(a.position_z) || 0,
        },
        endPosition: a.end_position_x !== null ? {
          x: Number(a.end_position_x) || 0,
          y: Number(a.end_position_y) || 0,
          z: Number(a.end_position_z) || 0,
        } : undefined,
        points: a.points as unknown as Annotation['points'],
        radius: a.radius ? Number(a.radius) : undefined,
        strokeWidth: Number(a.stroke_width) || 3,
        timestampStart: Number(a.timestamp_start) || 0,
        timestampEnd: a.timestamp_end ? Number(a.timestamp_end) : undefined,
        metadata: (a.metadata as Record<string, unknown>) || {},
        layerOrder: a.layer_order || 0,
        visible: a.visible ?? true,
        createdAt: a.created_at,
        updatedAt: a.updated_at,
      }));
    } catch (error) {
      console.error('Error loading annotations:', error);
      toast.error('Failed to load annotations');
      return [];
    }
  }, []);

  const saveCalibration = useCallback(async (projectId: string, calibration: Omit<Calibration, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      // Update or insert calibration
      const { error } = await supabase
        .from('calibrations')
        .upsert({
          project_id: projectId,
          name: calibration.name,
          camera_x: calibration.cameraX,
          camera_y: calibration.cameraY,
          camera_z: calibration.cameraZ,
          camera_fov: calibration.cameraFov,
          camera_rotation_x: calibration.cameraRotationX,
          camera_rotation_y: calibration.cameraRotationY,
          camera_rotation_z: calibration.cameraRotationZ,
          is_active: calibration.isActive,
        }, { onConflict: 'project_id' });

      if (error) throw error;
      toast.success('Calibration saved');
    } catch (error) {
      console.error('Error saving calibration:', error);
      toast.error('Failed to save calibration');
    }
  }, []);

  return {
    projects,
    currentProject,
    loading,
    setCurrentProject,
    fetchProjects,
    createProject,
    updateProject,
    deleteProject,
    saveAnnotations,
    loadAnnotations,
    saveCalibration,
  };
}
