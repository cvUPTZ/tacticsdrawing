import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useVideoPlayer } from '@/hooks/useVideoPlayer';
import { useAnnotations } from '@/hooks/useAnnotations';
import { useCalibration } from '@/hooks/useCalibration';
import { useProjects } from '@/hooks/useProjects';
import { ToolMode, Vector3 } from '@/types/analysis';
import { VideoCanvas } from '@/components/analysis/VideoCanvas';
import { ThreeCanvas } from '@/components/analysis/ThreeCanvas';
import { TopBar } from '@/components/analysis/TopBar';
import { BottomBar } from '@/components/analysis/BottomBar';
import { ToolPanel } from '@/components/analysis/ToolPanel';
import { CalibrationPanel } from '@/components/analysis/CalibrationPanel';
import { AnnotationsList } from '@/components/analysis/AnnotationsList';
import { ProjectsDialog } from '@/components/analysis/ProjectsDialog';
import { toast } from 'sonner';

export default function Index() {
  const navigate = useNavigate();
  const { user, signOut, loading: authLoading, isAuthenticated } = useAuth();
  
  const {
    videoRef,
    videoState,
    videoSrc,
    togglePlay,
    seek,
    stepFrame,
    setPlaybackRate,
    toggleMute,
    loadVideo,
    formatTimecode,
  } = useVideoPlayer();

  const {
    annotations,
    selectedAnnotationId,
    currentColor,
    setCurrentColor,
    addAnnotation,
    deleteAnnotation,
    clearAnnotations,
    selectAnnotation,
    toggleAnnotationVisibility,
    setAnnotations,
  } = useAnnotations();

  const {
    calibration,
    isCalibrating,
    updateCalibration,
    resetCalibration,
    toggleCalibrating,
    applyPreset,
  } = useCalibration();

  const {
    projects,
    currentProject,
    loading: projectsLoading,
    setCurrentProject,
    createProject,
    updateProject,
    deleteProject,
    saveAnnotations,
    loadAnnotations,
  } = useProjects();

  const [toolMode, setToolMode] = useState<ToolMode>('select');
  const [projectName, setProjectName] = useState('Untitled Analysis');
  const [projectsDialogOpen, setProjectsDialogOpen] = useState(false);
  const [arrowStartPosition, setArrowStartPosition] = useState<Vector3 | null>(null);

  // Redirect to auth if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/auth');
    }
  }, [authLoading, isAuthenticated, navigate]);

  // Sync project name
  useEffect(() => {
    if (currentProject) {
      setProjectName(currentProject.name);
    }
  }, [currentProject]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          stepFrame('backward');
          break;
        case 'ArrowRight':
          e.preventDefault();
          stepFrame('forward');
          break;
        case 'KeyM':
          toggleMute();
          break;
        case 'Escape':
          setToolMode('select');
          setArrowStartPosition(null);
          break;
        case 'Delete':
        case 'Backspace':
          if (selectedAnnotationId) {
            deleteAnnotation(selectedAnnotationId);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay, stepFrame, toggleMute, selectedAnnotationId, deleteAnnotation]);

  const handleUpload = useCallback((file: File) => {
    loadVideo(file);
    if (!currentProject) {
      createProject(file.name.replace(/\.[^.]+$/, ''), file.name);
    } else {
      updateProject(currentProject.id, { videoFilename: file.name });
    }
    toast.success(`Loaded: ${file.name}`);
  }, [loadVideo, currentProject, createProject, updateProject]);

  const handlePitchClick = useCallback((position: Vector3) => {
    if (toolMode === 'player') {
      addAnnotation('player', position, { timestampStart: videoState.currentTime });
    } else if (toolMode === 'arrow') {
      if (!arrowStartPosition) {
        setArrowStartPosition(position);
        toast.info('Click again to set arrow end point');
      } else {
        addAnnotation('arrow', arrowStartPosition, {
          endPosition: position,
          timestampStart: videoState.currentTime,
        });
        setArrowStartPosition(null);
      }
    } else if (toolMode === 'zone') {
      addAnnotation('zone', position, {
        timestampStart: videoState.currentTime,
      });
    } else if (toolMode === 'spotlight') {
      addAnnotation('spotlight', position, {
        timestampStart: videoState.currentTime,
      });
    }
  }, [toolMode, arrowStartPosition, addAnnotation, videoState.currentTime]);

  const handleExport = useCallback(() => {
    // Create composite image
    const video = videoRef.current;
    if (!video) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1920;
    canvas.height = video.videoHeight || 1080;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw video frame
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Get Three.js canvas and composite it
    const threeCanvas = document.querySelector('.three-layer canvas') as HTMLCanvasElement;
    if (threeCanvas) {
      ctx.drawImage(threeCanvas, 0, 0, canvas.width, canvas.height);
    }

    // Download
    const link = document.createElement('a');
    link.download = `${projectName}-${formatTimecode(videoState.currentTime).replace(/:/g, '-')}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();

    toast.success('Exported snapshot');
  }, [videoRef, projectName, formatTimecode, videoState.currentTime]);

  const handleSave = useCallback(async () => {
    if (!currentProject) {
      const project = await createProject(projectName);
      if (project) {
        await saveAnnotations(project.id, annotations);
      }
    } else {
      await updateProject(currentProject.id, { name: projectName });
      await saveAnnotations(currentProject.id, annotations);
    }
  }, [currentProject, projectName, annotations, createProject, updateProject, saveAnnotations]);

  const handleSelectProject = useCallback(async (project: typeof currentProject) => {
    if (!project) return;
    setCurrentProject(project);
    setProjectName(project.name);
    
    // Load annotations
    const loadedAnnotations = await loadAnnotations(project.id);
    setAnnotations(loadedAnnotations);
    
    toast.success(`Loaded: ${project.name}`);
  }, [setCurrentProject, loadAnnotations, setAnnotations]);

  const handleSignOut = useCallback(async () => {
    await signOut();
    navigate('/auth');
  }, [signOut, navigate]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Top Bar */}
      <TopBar
        projectName={projectName}
        userName={user?.email}
        onProjectNameChange={setProjectName}
        onUpload={handleUpload}
        onOpenProjects={() => setProjectsDialogOpen(true)}
        onSignOut={handleSignOut}
      />

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Tools */}
        <aside className="w-48 xl:w-56 p-3 space-y-3 overflow-y-auto">
          <ToolPanel
            currentTool={toolMode}
            currentColor={currentColor}
            onToolChange={setToolMode}
            onColorChange={setCurrentColor}
            onClearAnnotations={clearAnnotations}
            onExport={handleExport}
            onSave={handleSave}
            hasVideo={!!videoSrc}
          />
          <AnnotationsList
            annotations={annotations}
            selectedId={selectedAnnotationId}
            onSelect={selectAnnotation}
            onToggleVisibility={toggleAnnotationVisibility}
            onDelete={deleteAnnotation}
          />
        </aside>

        {/* Video Canvas */}
        <main className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 canvas-container relative">
            <VideoCanvas
              ref={videoRef}
              src={videoSrc}
            />
            <ThreeCanvas
              calibration={calibration}
              annotations={annotations}
              toolMode={toolMode}
              isInteractive={toolMode !== 'select' && toolMode !== 'pan' && !!videoSrc}
              onPitchClick={handlePitchClick}
            />
          </div>
        </main>

        {/* Right Sidebar - Calibration */}
        <aside className="w-56 xl:w-64 p-3 overflow-y-auto">
          <CalibrationPanel
            calibration={calibration}
            isCalibrating={isCalibrating}
            onUpdate={updateCalibration}
            onReset={resetCalibration}
            onToggleCalibrating={toggleCalibrating}
            onApplyPreset={applyPreset}
          />
        </aside>
      </div>

      {/* Bottom Bar - Timeline */}
      <BottomBar
        videoState={videoState}
        onTogglePlay={togglePlay}
        onSeek={seek}
        onStepFrame={stepFrame}
        onSetPlaybackRate={setPlaybackRate}
        onToggleMute={toggleMute}
        formatTimecode={formatTimecode}
      />

      {/* Projects Dialog */}
      <ProjectsDialog
        open={projectsDialogOpen}
        onOpenChange={setProjectsDialogOpen}
        projects={projects}
        loading={projectsLoading}
        onSelectProject={handleSelectProject}
        onDeleteProject={deleteProject}
        onCreateProject={async () => {
          const project = await createProject('New Analysis');
          if (project) {
            setProjectsDialogOpen(false);
          }
        }}
      />
    </div>
  );
}
