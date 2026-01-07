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
    updateAnnotation,
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
  const [freehandPoints, setFreehandPoints] = useState<Vector3[]>([]);
  const [isDrawingFreehand, setIsDrawingFreehand] = useState(false);

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
          if (isDrawingFreehand && freehandPoints.length > 1) {
            addAnnotation('freehand', freehandPoints[0], {
              timestampStart: videoState.currentTime,
            });
            // Update the last annotation with points
            setTimeout(() => {
              const lastAnnotation = annotations[annotations.length - 1];
              if (lastAnnotation) {
                updateAnnotation(lastAnnotation.id, { points: freehandPoints });
              }
            }, 0);
          }
          setIsDrawingFreehand(false);
          setFreehandPoints([]);
          break;
        case 'Delete':
        case 'Backspace':
          if (selectedAnnotationId) {
            deleteAnnotation(selectedAnnotationId);
          }
          break;
        // Tool shortcuts
        case 'KeyV':
          setToolMode('select');
          break;
        case 'KeyP':
          setToolMode('player');
          break;
        case 'KeyA':
          setToolMode('arrow');
          break;
        case 'KeyD':
          setToolMode('freehand');
          break;
        case 'KeyZ':
          setToolMode('zone');
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay, stepFrame, toggleMute, selectedAnnotationId, deleteAnnotation, isDrawingFreehand, freehandPoints, addAnnotation, videoState.currentTime, annotations, updateAnnotation]);

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
      const playerNumber = (annotations.filter(a => a.type === 'player').length + 1).toString();
      addAnnotation('player', position, { 
        label: playerNumber,
        timestampStart: videoState.currentTime,
      });
    } else if (toolMode === 'arrow') {
      if (!arrowStartPosition) {
        setArrowStartPosition(position);
        toast.info('Click to set pass end point', { duration: 2000 });
      } else {
        addAnnotation('arrow', arrowStartPosition, {
          endPosition: position,
          timestampStart: videoState.currentTime,
        });
        setArrowStartPosition(null);
      }
    } else if (toolMode === 'freehand') {
      if (!isDrawingFreehand) {
        setIsDrawingFreehand(true);
        setFreehandPoints([position]);
        toast.info('Click to add path points, press Escape to finish', { duration: 3000 });
      } else {
        const newPoints = [...freehandPoints, position];
        setFreehandPoints(newPoints);
      }
    } else if (toolMode === 'zone') {
      addAnnotation('zone', position, {
        radius: 12,
        timestampStart: videoState.currentTime,
      });
    } else if (toolMode === 'spotlight') {
      addAnnotation('spotlight', position, {
        timestampStart: videoState.currentTime,
      });
    }
  }, [toolMode, arrowStartPosition, addAnnotation, videoState.currentTime, isDrawingFreehand, freehandPoints, annotations]);

  // Finalize freehand when tool changes
  useEffect(() => {
    if (toolMode !== 'freehand' && isDrawingFreehand && freehandPoints.length > 1) {
      const annotation = addAnnotation('freehand', freehandPoints[0], {
        timestampStart: videoState.currentTime,
      });
      if (annotation) {
        updateAnnotation(annotation.id, { points: freehandPoints });
      }
      setIsDrawingFreehand(false);
      setFreehandPoints([]);
    }
  }, [toolMode, isDrawingFreehand, freehandPoints, addAnnotation, updateAnnotation, videoState.currentTime]);

  const handleExport = useCallback(() => {
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
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center animate-pulse">
            <span className="text-primary-foreground font-bold text-xl">TA</span>
          </div>
          <div className="text-muted-foreground">Loading...</div>
        </div>
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
        <aside className="w-48 xl:w-56 p-3 space-y-3 overflow-y-auto border-r border-border/50">
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
            
            {/* Tool mode indicator */}
            {toolMode !== 'select' && toolMode !== 'pan' && videoSrc && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 glass-panel px-4 py-2 rounded-full flex items-center gap-2">
                <div 
                  className="w-2 h-2 rounded-full animate-pulse"
                  style={{ backgroundColor: currentColor }}
                />
                <span className="text-sm font-medium capitalize">{toolMode} Mode</span>
                {arrowStartPosition && <span className="text-xs text-muted-foreground">| Click end point</span>}
                {isDrawingFreehand && <span className="text-xs text-muted-foreground">| {freehandPoints.length} points (Esc to finish)</span>}
              </div>
            )}
          </div>
        </main>

        {/* Right Sidebar - Calibration */}
        <aside className="w-56 xl:w-64 p-3 overflow-y-auto border-l border-border/50">
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
