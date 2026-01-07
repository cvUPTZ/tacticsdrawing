import { useState, useCallback, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useVideoPlayer } from '@/hooks/useVideoPlayer';
import { useAnnotations } from '@/hooks/useAnnotations';
import { useCalibration } from '@/hooks/useCalibration';
import { useProjects } from '@/hooks/useProjects';
import { ToolMode, Vector3, ZoneShape, FormationInfo } from '@/types/analysis';
import { VideoCanvas } from '@/components/analysis/VideoCanvas';
import { ThreeCanvas } from '@/components/analysis/ThreeCanvas';
import { TopBar } from '@/components/analysis/TopBar';
import { BottomBar } from '@/components/analysis/BottomBar';
import { ToolPanel } from '@/components/analysis/ToolPanel';
import { CalibrationPanel } from '@/components/analysis/CalibrationPanel';
import { AnnotationsList } from '@/components/analysis/AnnotationsList';
import { ProjectsDialog } from '@/components/analysis/ProjectsDialog';
import { toast } from 'sonner';

// Formation detection utility
function detectFormation(players: { x: number; z: number }[]): FormationInfo | null {
  if (players.length < 3) return null;
  
  // Sort players by x position (left to right / defense to attack)
  const sorted = [...players].sort((a, b) => a.x - b.x);
  
  // Determine zones based on x position
  const halfX = 52.5; // Half pitch
  const zones = {
    defense: sorted.filter(p => p.x < -15),
    midfield: sorted.filter(p => p.x >= -15 && p.x <= 15),
    attack: sorted.filter(p => p.x > 15),
  };
  
  const pattern = `${zones.defense.length}-${zones.midfield.length}-${zones.attack.length}`;
  
  const formations: Record<string, string> = {
    '4-3-3': '4-3-3',
    '4-4-2': '4-4-2',
    '3-5-2': '3-5-2',
    '4-2-3-1': '4-2-3-1',
    '3-4-3': '3-4-3',
    '5-3-2': '5-3-2',
    '4-1-4-1': '4-1-4-1',
  };
  
  // Find closest matching formation
  let bestMatch = pattern;
  let confidence = 0.5;
  
  for (const [key, name] of Object.entries(formations)) {
    const parts = key.split('-').map(Number);
    const total = parts.reduce((a, b) => a + b, 0);
    if (total === players.length) {
      bestMatch = name;
      confidence = 0.85;
      break;
    }
  }
  
  return {
    name: bestMatch,
    pattern,
    confidence,
  };
}

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
  const [isDashed, setIsDashed] = useState(false);
  const [playerCounter, setPlayerCounter] = useState(1);
  const [zoneShape, setZoneShape] = useState<ZoneShape>('circle');
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);

  // Detect formation from selected players
  const detectedFormation = useMemo(() => {
    if (selectedPlayerIds.length < 3) return null;
    
    const selectedPlayers = annotations
      .filter(a => a.type === 'player' && selectedPlayerIds.includes(a.id))
      .map(a => ({ x: a.position.x, z: a.position.z }));
    
    return detectFormation(selectedPlayers);
  }, [selectedPlayerIds, annotations]);

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
          finalizeFreehand();
          break;
        case 'Delete':
        case 'Backspace':
          if (selectedAnnotationId) {
            deleteAnnotation(selectedAnnotationId);
          }
          break;
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
        case 'KeyS':
          if (!e.ctrlKey && !e.metaKey) {
            setToolMode('spotlight');
          }
          break;
        case 'KeyO':
          setToolMode('offside');
          break;
        case 'KeyH':
          setToolMode('pan');
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay, stepFrame, toggleMute, selectedAnnotationId, deleteAnnotation]);

  const finalizeFreehand = useCallback(() => {
    if (isDrawingFreehand && freehandPoints.length > 1) {
      const annotationType = toolMode === 'curve' ? 'curve' : 'freehand';
      const annotation = addAnnotation(annotationType, freehandPoints[0], {
        timestampStart: videoState.currentTime,
        points: freehandPoints,
      });
      if (annotation && isDashed) {
        updateAnnotation(annotation.id, { metadata: { dashed: true } });
      }
    }
    setIsDrawingFreehand(false);
    setFreehandPoints([]);
  }, [isDrawingFreehand, freehandPoints, addAnnotation, videoState.currentTime, isDashed, updateAnnotation, toolMode]);

  const handleUpload = useCallback((file: File) => {
    loadVideo(file);
    if (!currentProject) {
      createProject(file.name.replace(/\.[^.]+$/, ''), file.name);
    } else {
      updateProject(currentProject.id, { videoFilename: file.name });
    }
    setPlayerCounter(1);
    toast.success(`Loaded: ${file.name}`);
  }, [loadVideo, currentProject, createProject, updateProject]);

  const handlePitchClick = useCallback((position: Vector3) => {
    if (toolMode === 'player') {
      const label = playerCounter.toString();
      addAnnotation('player', position, { 
        label,
        timestampStart: videoState.currentTime,
      });
      setPlayerCounter(prev => prev + 1);
    } else if (toolMode === 'arrow') {
      if (!arrowStartPosition) {
        setArrowStartPosition(position);
        toast.info('Click to set pass end point', { duration: 2000 });
      } else {
        const annotation = addAnnotation('arrow', arrowStartPosition, {
          endPosition: position,
          timestampStart: videoState.currentTime,
        });
        if (annotation && isDashed) {
          updateAnnotation(annotation.id, { metadata: { dashed: true } });
        }
        setArrowStartPosition(null);
      }
    } else if (toolMode === 'freehand') {
      if (!isDrawingFreehand) {
        setIsDrawingFreehand(true);
        setFreehandPoints([position]);
        toast.info('Click to add points. Press Escape to finish.', { duration: 3000 });
      } else {
        setFreehandPoints(prev => [...prev, position]);
      }
    } else if (toolMode === 'zone') {
      const newAnnotation = addAnnotation('zone', position, {
        radius: 8,
        timestampStart: videoState.currentTime,
      });
      if (newAnnotation) {
        updateAnnotation(newAnnotation.id, { zoneShape });
      }
    } else if (toolMode === 'spotlight') {
      const spotlightNumber = annotations.filter(a => a.type === 'spotlight').length + 1;
      addAnnotation('spotlight', position, {
        label: `Spotlight ${spotlightNumber}`,
        timestampStart: videoState.currentTime,
      });
    } else if (toolMode === 'offside') {
      if (!arrowStartPosition) {
        setArrowStartPosition(position);
        toast.info('Click to set offside line end point', { duration: 2000 });
      } else {
        addAnnotation('offside', arrowStartPosition, {
          endPosition: position,
          timestampStart: videoState.currentTime,
        });
        setArrowStartPosition(null);
      }
    } else if (toolMode === 'pressing') {
      addAnnotation('pressing', position, {
        timestampStart: videoState.currentTime,
        radius: 5,
      });
    } else if (toolMode === 'line') {
      // Straight line tool
      if (!arrowStartPosition) {
        setArrowStartPosition(position);
        toast.info('Click to set line end point', { duration: 2000 });
      } else {
        const annotation = addAnnotation('line', arrowStartPosition, {
          endPosition: position,
          timestampStart: videoState.currentTime,
        });
        if (annotation && isDashed) {
          updateAnnotation(annotation.id, { metadata: { dashed: true } });
        }
        setArrowStartPosition(null);
      }
    } else if (toolMode === 'marker') {
      // Simple marker/dot
      addAnnotation('marker', position, {
        timestampStart: videoState.currentTime,
      });
    } else if (toolMode === 'curve') {
      // Curved line (uses freehand points but renders as smooth curve)
      if (!isDrawingFreehand) {
        setIsDrawingFreehand(true);
        setFreehandPoints([position]);
        toast.info('Click to add curve points. Press Escape to finish.', { duration: 3000 });
      } else {
        setFreehandPoints(prev => [...prev, position]);
      }
    } else if (toolMode === 'shield') {
      // Defensive block shape
      addAnnotation('shield', position, {
        timestampStart: videoState.currentTime,
        radius: 4,
      });
    } else if (toolMode === 'distance') {
      // Distance measurement line
      if (!arrowStartPosition) {
        setArrowStartPosition(position);
        toast.info('Click to set measurement end point', { duration: 2000 });
      } else {
        addAnnotation('distance', arrowStartPosition, {
          endPosition: position,
          timestampStart: videoState.currentTime,
        });
        setArrowStartPosition(null);
      }
    } else if (toolMode === 'select') {
      // Multi-select players
      const playerAnnotations = annotations.filter(a => a.type === 'player');
      let clickedPlayer = null;
      
      for (const player of playerAnnotations) {
        const dist = Math.sqrt(
          Math.pow(player.position.x - position.x, 2) + 
          Math.pow(player.position.z - position.z, 2)
        );
        if (dist < 3) {
          clickedPlayer = player;
          break;
        }
      }
      
      if (clickedPlayer) {
        setSelectedPlayerIds(prev => {
          if (prev.includes(clickedPlayer!.id)) {
            return prev.filter(id => id !== clickedPlayer!.id);
          }
          return [...prev, clickedPlayer!.id];
        });
      } else {
        setSelectedPlayerIds([]);
      }
    }
  }, [toolMode, arrowStartPosition, addAnnotation, videoState.currentTime, isDrawingFreehand, isDashed, updateAnnotation, playerCounter, annotations, zoneShape]);

  // Finalize freehand/curve when tool changes
  useEffect(() => {
    if (toolMode !== 'freehand' && toolMode !== 'curve') {
      finalizeFreehand();
    }
  }, [toolMode, finalizeFreehand]);

  const handleExport = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1920;
    canvas.height = video.videoHeight || 1080;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const threeCanvas = document.querySelector('.three-layer canvas') as HTMLCanvasElement;
    if (threeCanvas) {
      ctx.drawImage(threeCanvas, 0, 0, canvas.width, canvas.height);
    }

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
    
    const loadedAnnotations = await loadAnnotations(project.id);
    setAnnotations(loadedAnnotations);
    setPlayerCounter(loadedAnnotations.filter(a => a.type === 'player').length + 1);
    
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

  const getToolModeLabel = () => {
    switch (toolMode) {
      case 'player': return 'Click to place player marker';
      case 'arrow': return arrowStartPosition ? 'Click end point' : 'Click start point';
      case 'freehand': return isDrawingFreehand ? `${freehandPoints.length} points (Esc to finish)` : 'Click to start path';
      case 'zone': return `Click to place ${zoneShape} zone`;
      case 'spotlight': return 'Click to place spotlight';
      case 'offside': return arrowStartPosition ? 'Click end point' : 'Click start point';
      case 'pressing': return 'Click to add press indicator';
      case 'line': return arrowStartPosition ? 'Click end point' : 'Click start point';
      case 'marker': return 'Click to place marker';
      case 'curve': return isDrawingFreehand ? `${freehandPoints.length} points (Esc to finish)` : 'Click to start curve';
      case 'shield': return 'Click to place defensive block';
      case 'distance': return arrowStartPosition ? 'Click end point' : 'Click start point for measurement';
      case 'select': return selectedPlayerIds.length > 0 ? `${selectedPlayerIds.length} selected` : 'Click players to select';
      default: return '';
    }
  };

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
            isDashed={isDashed}
            zoneShape={zoneShape}
            onToolChange={setToolMode}
            onColorChange={setCurrentColor}
            onDashedChange={setIsDashed}
            onZoneShapeChange={setZoneShape}
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
              <div className="absolute top-4 left-1/2 -translate-x-1/2 glass-panel px-4 py-2 rounded-full flex items-center gap-3 fade-in">
                <div 
                  className="w-3 h-3 rounded-full animate-pulse"
                  style={{ backgroundColor: currentColor }}
                />
                <span className="text-sm font-medium capitalize">{toolMode}</span>
                <span className="text-xs text-muted-foreground">| {getToolModeLabel()}</span>
                {isDashed && <span className="text-xs text-accent">Dashed</span>}
              </div>
            )}

            {/* Player counter */}
            {toolMode === 'player' && videoSrc && (
              <div className="absolute top-16 left-1/2 -translate-x-1/2 glass-panel px-3 py-1 rounded-full">
                <span className="text-xs text-muted-foreground">Next: Player #{playerCounter}</span>
              </div>
            )}

            {/* Formation detection indicator */}
            {detectedFormation && selectedPlayerIds.length >= 3 && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 glass-panel px-4 py-2 rounded-lg flex items-center gap-3 fade-in">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Formation:</span>
                  <span className="text-sm font-bold text-primary">{detectedFormation.name}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  ({selectedPlayerIds.length} players)
                </div>
                <div 
                  className="w-2 h-2 rounded-full"
                  style={{ 
                    backgroundColor: detectedFormation.confidence > 0.7 ? '#00ff88' : '#ffaa00'
                  }}
                  title={`${Math.round(detectedFormation.confidence * 100)}% confidence`}
                />
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
