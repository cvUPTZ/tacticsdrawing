import { useState, useCallback, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useVideoPlayer } from "@/hooks/useVideoPlayer";
import { useAnnotations } from "@/hooks/useAnnotations";
import { useCalibration } from "@/hooks/useCalibration";
import { useProjects } from "@/hooks/useProjects";
import { useCalibrationPresets } from "@/hooks/useCalibrationPresets";
import { ToolMode, Vector3, ZoneShape, FormationInfo } from "@/types/analysis";
import { VideoCanvas } from "@/components/analysis/VideoCanvas";
import { ThreeCanvas, GridOverlayType } from "@/components/analysis/ThreeCanvas";
import { TopBar } from "@/components/analysis/TopBar";
import { BottomBar } from "@/components/analysis/BottomBar";
import { ToolPanel } from "@/components/analysis/ToolPanel";
import { CalibrationPanel, CornerCalibrationPoint } from "@/components/analysis/CalibrationPanel";
import { PitchTransform, DEFAULT_TRANSFORM } from "@/components/analysis/PitchTransformControls";
import {
  PitchCorners,
  DEFAULT_CORNERS,
  LockedHandles,
  DEFAULT_LOCKED_HANDLES,
  ExtendedHandles,
  DEFAULT_EXTENDED_HANDLES,
} from "@/components/analysis/PitchManipulator";
import { PitchSection, ZoomLevel } from "@/components/analysis/PitchSectionSelector";
import {
  PitchControlPoint,
  DEFAULT_PITCH_CONTROL_POINTS,
  generateGridControlPoints,
} from "@/components/analysis/DirectPitchManipulation";
import { AnnotationsList } from "@/components/analysis/AnnotationsList";
import { ProjectsDialog } from "@/components/analysis/ProjectsDialog";
import { HeatmapType } from "@/components/analysis/HeatmapOverlay";
import { toast } from "sonner";

// Formation detection utility
function detectFormation(players: { x: number; z: number }[]): FormationInfo | null {
  if (players.length < 3) return null;

  // Sort players by x position (left to right / defense to attack)
  const sorted = [...players].sort((a, b) => a.x - b.x);

  // Determine zones based on x position
  const halfX = 52.5; // Half pitch
  const zones = {
    defense: sorted.filter((p) => p.x < -15),
    midfield: sorted.filter((p) => p.x >= -15 && p.x <= 15),
    attack: sorted.filter((p) => p.x > 15),
  };

  const pattern = `${zones.defense.length}-${zones.midfield.length}-${zones.attack.length}`;

  const formations: Record<string, string> = {
    "4-3-3": "4-3-3",
    "4-4-2": "4-4-2",
    "3-5-2": "3-5-2",
    "4-2-3-1": "4-2-3-1",
    "3-4-3": "3-4-3",
    "5-3-2": "5-3-2",
    "4-1-4-1": "4-1-4-1",
  };

  // Find closest matching formation
  let bestMatch = pattern;
  let confidence = 0.5;

  for (const [key, name] of Object.entries(formations)) {
    const parts = key.split("-").map(Number);
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
    skip,
    stepFrame,
    setPlaybackRate,
    setVolume,
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

  const { calibration, isCalibrating, updateCalibration, resetCalibration, toggleCalibrating, applyPreset } =
    useCalibration();

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

  const { presets: customPresets, addPreset, deletePreset: deleteCustomPreset } = useCalibrationPresets();

  const [toolMode, setToolMode] = useState<ToolMode>("select");
  const [projectName, setProjectName] = useState("Untitled Analysis");
  const [projectsDialogOpen, setProjectsDialogOpen] = useState(false);
  const [arrowStartPosition, setArrowStartPosition] = useState<Vector3 | null>(null);
  const [freehandPoints, setFreehandPoints] = useState<Vector3[]>([]);
  const [isDrawingFreehand, setIsDrawingFreehand] = useState(false);
  const [isDashed, setIsDashed] = useState(false);
  const [playerCounter, setPlayerCounter] = useState(1);
  const [zoneShape, setZoneShape] = useState<ZoneShape>("circle");
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [pitchScale, setPitchScale] = useState({ width: 1, height: 1 });
  const [isCornerCalibrating, setIsCornerCalibrating] = useState(false);
  const [activeCorner, setActiveCorner] = useState<string | null>(null);
  const [cornerPoints, setCornerPoints] = useState<CornerCalibrationPoint[]>([
    { id: "topLeft", label: "Top Left" },
    { id: "topRight", label: "Top Right" },
    { id: "bottomLeft", label: "Bottom Left" },
    { id: "bottomRight", label: "Bottom Right" },
  ]);
  const [gridOverlay, setGridOverlay] = useState<GridOverlayType>("none");
  const [draggingCorner, setDraggingCorner] = useState<string | null>(null);
  const [heatmapType, setHeatmapType] = useState<HeatmapType>("none");
  const [pitchTransform, setPitchTransform] = useState<PitchTransform>(DEFAULT_TRANSFORM);

  // Pitch manipulation state
  const [isPitchManipulating, setIsPitchManipulating] = useState(false);
  const [pitchCorners, setPitchCorners] = useState<PitchCorners>(DEFAULT_CORNERS);
  const [lockedHandles, setLockedHandles] = useState<LockedHandles>(DEFAULT_LOCKED_HANDLES);

  // Pitch section selection state
  const [selectedPitchSection, setSelectedPitchSection] = useState<PitchSection>("full");
  const [selectedZoomLevel, setSelectedZoomLevel] = useState<ZoomLevel>("wide");
  const [pitchSectionConfirmed, setPitchSectionConfirmed] = useState(false);

  // New pitch manipulation state
  const [showGridHandles, setShowGridHandles] = useState(false);
  const [enableSnapping, setEnableSnapping] = useState(true);
  const [lensDistortion, setLensDistortion] = useState(0);
  const [extendedHandles, setExtendedHandles] = useState<ExtendedHandles>(DEFAULT_EXTENDED_HANDLES);

  // Direct Pitch Manipulation state - NEW
  const [isDirectManipulating, setIsDirectManipulating] = useState(false);
  const [pitchControlPoints, setPitchControlPoints] = useState<PitchControlPoint[]>(DEFAULT_PITCH_CONTROL_POINTS);
  const [activeControlPointId, setActiveControlPointId] = useState<string | null>(null);

  const handlePitchTransformReset = useCallback(() => {
    setPitchTransform(DEFAULT_TRANSFORM);
  }, []);

  const handlePitchCornersReset = useCallback(() => {
    setPitchCorners(DEFAULT_CORNERS);
  }, []);

  // Direct Pitch Manipulation handlers - NEW
  const handleUpdateControlPoint = useCallback((id: string, pitchX: number, pitchZ: number) => {
    setPitchControlPoints((prev) =>
      prev.map((p) => (p.id === id ? { ...p, adjustedX: pitchX, adjustedZ: pitchZ } : p)),
    );
    setActiveControlPointId(null); // Auto-deselect after placing
    toast.success("Control point updated");
  }, []);

  const handleResetControlPoint = useCallback((id: string) => {
    setPitchControlPoints((prev) =>
      prev.map((p) => (p.id === id ? { ...p, adjustedX: undefined, adjustedZ: undefined } : p)),
    );
    toast.success("Control point reset");
  }, []);

  const handleResetAllControlPoints = useCallback(() => {
    setPitchControlPoints((prev) => prev.map((p) => ({ ...p, adjustedX: undefined, adjustedZ: undefined })));
    toast.success("All control points reset");
  }, []);

  const handleAddGridPoints = useCallback(() => {
    setPitchControlPoints(generateGridControlPoints("medium"));
    toast.success("Added grid control points for precise warping");
  }, []);

  // Auto-calibrate from corner points
  const handleAutoCalibrate = useCallback(() => {
    const allSet = cornerPoints.every((p) => p.screenX !== undefined && p.screenY !== undefined);
    if (!allSet) {
      toast.error("Please set all 4 corner points first");
      return;
    }

    const container = document.querySelector(".canvas-container");
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const containerW = rect.width;
    const containerH = rect.height;

    const tl = cornerPoints.find((p) => p.id === "topLeft")!;
    const tr = cornerPoints.find((p) => p.id === "topRight")!;
    const bl = cornerPoints.find((p) => p.id === "bottomLeft")!;
    const br = cornerPoints.find((p) => p.id === "bottomRight")!;

    const topWidth = (tr.screenX! - tl.screenX!) / containerW;
    const bottomWidth = (br.screenX! - bl.screenX!) / containerW;
    const leftHeight = (bl.screenY! - tl.screenY!) / containerH;
    const rightHeight = (br.screenY! - tr.screenY!) / containerH;

    const perspectiveRatio = topWidth / bottomWidth;
    const estimatedHeight = 30 + (1 - perspectiveRatio) * 80;
    const avgHeight = (leftHeight + rightHeight) / 2;
    const estimatedZ = 40 + (1 - avgHeight) * 60;

    const topCenter = (tl.screenX! + tr.screenX!) / 2 / containerW;
    const bottomCenter = (bl.screenX! + br.screenX!) / 2 / containerW;
    const horizontalOffset = (topCenter + bottomCenter) / 2 - 0.5;
    const estimatedRotY = -horizontalOffset * 0.5;

    const verticalCenter = ((tl.screenY! + tr.screenY!) / 2 + (bl.screenY! + br.screenY!) / 2) / 2 / containerH;
    const estimatedRotX = -(verticalCenter - 0.3) * 1.2;

    const avgWidth = (topWidth + bottomWidth) / 2;
    const avgAspect = avgWidth / avgHeight;
    const pitchAspect = 105 / 68;
    const widthScale = Math.max(0.5, Math.min(2, avgAspect / pitchAspect));

    updateCalibration({
      cameraX: horizontalOffset * -50,
      cameraY: estimatedHeight,
      cameraZ: estimatedZ,
      cameraRotationX: estimatedRotX,
      cameraRotationY: estimatedRotY,
    });

    setPitchScale({ width: widthScale, height: 1 });
    toast.success("Camera calibrated from corner points!");
  }, [cornerPoints, updateCalibration]);

  // Detect formation from selected players
  const detectedFormation = useMemo(() => {
    if (selectedPlayerIds.length < 3) return null;

    const selectedPlayers = annotations
      .filter((a) => a.type === "player" && selectedPlayerIds.includes(a.id))
      .map((a) => ({ x: a.position.x, z: a.position.z }));

    return detectFormation(selectedPlayers);
  }, [selectedPlayerIds, annotations]);

  // Redirect to auth if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate("/auth");
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
        case "Space":
          e.preventDefault();
          togglePlay();
          break;
        case "ArrowLeft":
          e.preventDefault();
          stepFrame("backward");
          break;
        case "ArrowRight":
          e.preventDefault();
          stepFrame("forward");
          break;
        case "KeyJ":
          e.preventDefault();
          skip(-10);
          break;
        case "KeyL":
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            skip(10);
          }
          break;
        case "KeyM":
          toggleMute();
          break;
        case "Escape":
          setToolMode("select");
          setArrowStartPosition(null);
          finalizeFreehand();
          break;
        case "Delete":
        case "Backspace":
          if (selectedAnnotationId) {
            deleteAnnotation(selectedAnnotationId);
          }
          break;
        case "KeyV":
          setToolMode("select");
          break;
        case "KeyP":
          setToolMode("player");
          break;
        case "KeyA":
          setToolMode("arrow");
          break;
        case "KeyD":
          setToolMode("freehand");
          break;
        case "KeyZ":
          if (!e.ctrlKey && !e.metaKey) {
            setToolMode("zone");
          }
          break;
        case "KeyS":
          if (!e.ctrlKey && !e.metaKey) {
            setToolMode("spotlight");
          }
          break;
        case "KeyO":
          setToolMode("offside");
          break;
        case "KeyH":
          setToolMode("pan");
          break;
        case "KeyI":
          setToolMode("distance");
          break;
        case "KeyC":
          if (!e.ctrlKey && !e.metaKey) {
            setToolMode("curve");
          }
          break;
        case "KeyB":
          setToolMode("shield");
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [togglePlay, stepFrame, skip, toggleMute, selectedAnnotationId, deleteAnnotation]);

  const finalizeFreehand = useCallback(() => {
    if (isDrawingFreehand && freehandPoints.length > 1) {
      const annotationType = toolMode === "curve" ? "curve" : "freehand";
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

  const handleUpload = useCallback(
    (file: File) => {
      loadVideo(file);
      if (!currentProject) {
        createProject(file.name.replace(/\.[^.]+$/, ""), file.name);
      } else {
        updateProject(currentProject.id, { videoFilename: file.name });
      }
      setPlayerCounter(1);
      toast.success(`Loaded: ${file.name}`);
    },
    [loadVideo, currentProject, createProject, updateProject],
  );

  const handlePitchClick = useCallback(
    (position: Vector3) => {
      // Handle Direct Pitch Manipulation clicks - NEW
      if (isDirectManipulating && activeControlPointId) {
        handleUpdateControlPoint(activeControlPointId, position.x, position.z);
        return;
      }

      // Two-point tools (arrows, lines, etc.)
      const twoPointTools: ToolMode[] = [
        "arrow",
        "line",
        "offside",
        "distance",
        "double_arrow",
        "curved_dashed",
        "through_ball",
        "switch_play",
        "cross",
        "line_shift",
        "run",
        "gate",
      ];

      // Single-point zone-type tools
      const zoneTools: ToolMode[] = ["zone", "delivery_zone", "target_zone", "compact_block", "grid"];

      // Single-point marker-type tools
      const markerTools: ToolMode[] = ["marker", "cone", "decoy"];

      // Area/shield-type tools
      const shieldTools: ToolMode[] = ["shield", "press_trap", "cover_shadow", "screen", "wall", "ladder"];

      // Multi-point path tools
      const pathTools: ToolMode[] = ["freehand", "curve", "marking", "future_trail"];

      if (toolMode === "player") {
        const label = playerCounter.toString();
        addAnnotation("player", position, {
          label,
          timestampStart: videoState.currentTime,
        });
        setPlayerCounter((prev) => prev + 1);
      } else if (twoPointTools.includes(toolMode)) {
        if (!arrowStartPosition) {
          setArrowStartPosition(position);
          toast.info("Click to set end point", { duration: 2000 });
        } else {
          const annotation = addAnnotation(toolMode as any, arrowStartPosition, {
            endPosition: position,
            timestampStart: videoState.currentTime,
          });
          if (annotation && isDashed) {
            updateAnnotation(annotation.id, { metadata: { dashed: true } });
          }
          setArrowStartPosition(null);
        }
      } else if (pathTools.includes(toolMode)) {
        if (!isDrawingFreehand) {
          setIsDrawingFreehand(true);
          setFreehandPoints([position]);
          toast.info("Click to add points. Press Escape to finish.", { duration: 3000 });
        } else {
          setFreehandPoints((prev) => [...prev, position]);
        }
      } else if (zoneTools.includes(toolMode)) {
        const newAnnotation = addAnnotation(toolMode as any, position, {
          radius: 8,
          timestampStart: videoState.currentTime,
        });
        if (newAnnotation) {
          updateAnnotation(newAnnotation.id, { zoneShape });
        }
      } else if (markerTools.includes(toolMode)) {
        addAnnotation(toolMode as any, position, {
          timestampStart: videoState.currentTime,
        });
      } else if (shieldTools.includes(toolMode)) {
        addAnnotation(toolMode as any, position, {
          timestampStart: videoState.currentTime,
          radius: toolMode === "wall" ? 10 : toolMode === "ladder" ? 6 : 4,
        });
      } else if (toolMode === "spotlight") {
        const spotlightNumber = annotations.filter((a) => a.type === "spotlight").length + 1;
        addAnnotation("spotlight", position, {
          label: `Spotlight ${spotlightNumber}`,
          timestampStart: videoState.currentTime,
        });
      } else if (toolMode === "pressing") {
        addAnnotation("pressing", position, {
          timestampStart: videoState.currentTime,
          radius: 5,
        });
      } else if (toolMode === "select") {
        // Multi-select players
        const playerAnnotations = annotations.filter((a) => a.type === "player");
        let clickedPlayer = null;

        for (const player of playerAnnotations) {
          const dist = Math.sqrt(
            Math.pow(player.position.x - position.x, 2) + Math.pow(player.position.z - position.z, 2),
          );
          if (dist < 3) {
            clickedPlayer = player;
            break;
          }
        }

        if (clickedPlayer) {
          setSelectedPlayerIds((prev) => {
            if (prev.includes(clickedPlayer!.id)) {
              return prev.filter((id) => id !== clickedPlayer!.id);
            }
            return [...prev, clickedPlayer!.id];
          });
        } else {
          setSelectedPlayerIds([]);
        }
      }
    },
    [
      toolMode,
      arrowStartPosition,
      addAnnotation,
      videoState.currentTime,
      isDrawingFreehand,
      isDashed,
      updateAnnotation,
      playerCounter,
      annotations,
      zoneShape,
      isDirectManipulating,
      activeControlPointId,
      handleUpdateControlPoint,
    ],
  );

  // Finalize freehand/curve when tool changes
  useEffect(() => {
    if (toolMode !== "freehand" && toolMode !== "curve") {
      finalizeFreehand();
    }
  }, [toolMode, finalizeFreehand]);

  const handleExport = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1920;
    canvas.height = video.videoHeight || 1080;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const threeCanvas = document.querySelector(".three-layer canvas") as HTMLCanvasElement;
    if (threeCanvas) {
      ctx.drawImage(threeCanvas, 0, 0, canvas.width, canvas.height);
    }

    const link = document.createElement("a");
    link.download = `${projectName}-${formatTimecode(videoState.currentTime).replace(/:/g, "-")}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();

    toast.success("Exported snapshot");
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

  const handleSelectProject = useCallback(
    async (project: typeof currentProject) => {
      if (!project) return;
      setCurrentProject(project);
      setProjectName(project.name);

      const loadedAnnotations = await loadAnnotations(project.id);
      setAnnotations(loadedAnnotations);
      setPlayerCounter(loadedAnnotations.filter((a) => a.type === "player").length + 1);

      toast.success(`Loaded: ${project.name}`);
    },
    [setCurrentProject, loadAnnotations, setAnnotations],
  );

  const handleSignOut = useCallback(async () => {
    await signOut();
    navigate("/auth");
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
    // Direct manipulation mode label - NEW
    if (isDirectManipulating) {
      if (activeControlPointId) {
        const point = pitchControlPoints.find((p) => p.id === activeControlPointId);
        return `Click pitch to move: ${point?.label || "control point"}`;
      }
      return "Select a control point, then click pitch to move it";
    }

    switch (toolMode) {
      case "player":
        return "Click to place player marker";
      case "arrow":
        return arrowStartPosition ? "Click end point" : "Click start point";
      case "freehand":
        return isDrawingFreehand ? `${freehandPoints.length} points (Esc to finish)` : "Click to start path";
      case "zone":
        return `Click to place ${zoneShape} zone`;
      case "spotlight":
        return "Click to place spotlight";
      case "offside":
        return arrowStartPosition ? "Click end point" : "Click start point";
      case "pressing":
        return "Click to add press indicator";
      case "line":
        return arrowStartPosition ? "Click end point" : "Click start point";
      case "marker":
        return "Click to place marker";
      case "curve":
        return isDrawingFreehand ? `${freehandPoints.length} points (Esc to finish)` : "Click to start curve";
      case "shield":
        return "Click to place defensive block";
      case "distance":
        return arrowStartPosition ? "Click end point" : "Click start point for measurement";
      case "select":
        return selectedPlayerIds.length > 0 ? `${selectedPlayerIds.length} selected` : "Click players to select";
      default:
        return "";
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
          <CalibrationPanel
            calibration={calibration}
            isCalibrating={isCalibrating}
            onUpdate={updateCalibration}
            onReset={resetCalibration}
            onToggleCalibrating={toggleCalibrating}
            onApplyPreset={applyPreset}
            pitchScale={pitchScale}
            onPitchScaleChange={setPitchScale}
            isCornerCalibrating={isCornerCalibrating}
            onToggleCornerCalibrating={() => setIsCornerCalibrating(!isCornerCalibrating)}
            cornerPoints={cornerPoints}
            activeCorner={activeCorner}
            onSetActiveCorner={setActiveCorner}
            onAutoCalibrate={handleAutoCalibrate}
            gridOverlay={gridOverlay}
            onGridOverlayChange={setGridOverlay}
            customPresets={customPresets}
            onSavePreset={(name) => addPreset(name, calibration, pitchScale)}
            onDeletePreset={deleteCustomPreset}
            heatmapType={heatmapType}
            onHeatmapChange={setHeatmapType}
            isPitchManipulating={isPitchManipulating}
            onTogglePitchManipulating={() => setIsPitchManipulating(!isPitchManipulating)}
            pitchCorners={pitchCorners}
            onPitchCornersChange={setPitchCorners}
            onPitchCornersReset={handlePitchCornersReset}
            lockedHandles={lockedHandles}
            onLockedHandlesChange={setLockedHandles}
            selectedPitchSection={selectedPitchSection}
            selectedZoomLevel={selectedZoomLevel}
            onPitchSectionChange={setSelectedPitchSection}
            onZoomLevelChange={setSelectedZoomLevel}
            pitchSectionConfirmed={pitchSectionConfirmed}
            onPitchSectionConfirm={() => setPitchSectionConfirmed(true)}
            showGridHandles={showGridHandles}
            onShowGridHandlesChange={setShowGridHandles}
            extendedHandles={extendedHandles}
            onExtendedHandlesChange={setExtendedHandles}
            enableSnapping={enableSnapping}
            onEnableSnappingChange={setEnableSnapping}
            lensDistortion={lensDistortion}
            onLensDistortionChange={setLensDistortion}
          />
          <AnnotationsList
            annotations={annotations}
            selectedId={selectedAnnotationId}
            onSelect={selectAnnotation}
            onToggleVisibility={toggleAnnotationVisibility}
            onDelete={deleteAnnotation}
            onUpdate={updateAnnotation}
          />
        </aside>

        {/* Video Canvas */}
        <main className="flex-1 flex flex-col min-w-0">
          <div
            className="flex-1 canvas-container relative"
            onClick={(e) => {
              // Handle corner calibration clicks
              if (isCornerCalibrating && activeCorner) {
                const rect = e.currentTarget.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;

                setCornerPoints((prev) =>
                  prev.map((p) => (p.id === activeCorner ? { ...p, screenX: x, screenY: y } : p)),
                );

                // Move to next corner
                const corners = ["topLeft", "topRight", "bottomRight", "bottomLeft"];
                const currentIdx = corners.indexOf(activeCorner);
                const nextCorner = corners[(currentIdx + 1) % 4];
                const nextPoint = cornerPoints.find((p) => p.id === nextCorner);
                if (nextPoint && nextPoint.screenX === undefined) {
                  setActiveCorner(nextCorner);
                } else {
                  setActiveCorner(null);
                }
              }
            }}
          >
            <VideoCanvas ref={videoRef} src={videoSrc} />
            <ThreeCanvas
              calibration={calibration}
              annotations={annotations}
              toolMode={toolMode}
              isInteractive={
                !isCornerCalibrating &&
                !isPitchManipulating &&
                toolMode !== "select" &&
                toolMode !== "pan" &&
                !!videoSrc
              }
              onPitchClick={handlePitchClick}
              pitchScale={pitchScale}
              gridOverlay={gridOverlay}
              heatmapType={heatmapType}
              pitchTransform={pitchTransform}
              pitchCorners={pitchCorners}
              onPitchCornersChange={setPitchCorners}
              isPitchManipulating={isPitchManipulating}
              lockedHandles={lockedHandles}
              isDirectManipulating={isDirectManipulating}
              pitchControlPoints={pitchControlPoints}
              activeControlPointId={activeControlPointId}
              showGridHandles={showGridHandles}
              enableSnapping={enableSnapping}
              lensDistortion={lensDistortion}
              extendedHandles={extendedHandles}
              onExtendedHandlesChange={setExtendedHandles}
            />

            {/* Corner calibration markers - draggable */}
            {isCornerCalibrating &&
              cornerPoints.map(
                (point) =>
                  point.screenX !== undefined &&
                  point.screenY !== undefined && (
                    <div
                      key={point.id}
                      className={`absolute w-5 h-5 -ml-2.5 -mt-2.5 border-2 rounded-full z-20 cursor-grab active:cursor-grabbing transition-all ${
                        draggingCorner === point.id
                          ? "border-accent bg-accent/50 scale-125"
                          : activeCorner === point.id
                            ? "border-primary bg-primary/50 scale-110"
                            : "border-primary bg-primary/30 hover:scale-110"
                      }`}
                      style={{ left: point.screenX, top: point.screenY }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveCorner(point.id);
                      }}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        setDraggingCorner(point.id);

                        const handleMouseMove = (moveEvent: MouseEvent) => {
                          const container = document.querySelector(".canvas-container");
                          if (!container) return;
                          const rect = container.getBoundingClientRect();
                          const x = moveEvent.clientX - rect.left;
                          const y = moveEvent.clientY - rect.top;

                          setCornerPoints((prev) =>
                            prev.map((p) => (p.id === point.id ? { ...p, screenX: x, screenY: y } : p)),
                          );
                        };

                        const handleMouseUp = () => {
                          setDraggingCorner(null);
                          window.removeEventListener("mousemove", handleMouseMove);
                          window.removeEventListener("mouseup", handleMouseUp);
                        };

                        window.addEventListener("mousemove", handleMouseMove);
                        window.addEventListener("mouseup", handleMouseUp);
                      }}
                    >
                      <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[8px] text-primary font-bold whitespace-nowrap bg-background/80 px-1 rounded pointer-events-none">
                        {point.label}
                      </span>
                    </div>
                  ),
              )}

            {/* Corner calibration mode indicator */}
            {isCornerCalibrating && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 glass-panel px-4 py-2 rounded-full flex items-center gap-3 fade-in z-30">
                <div className="w-3 h-3 rounded-full bg-primary animate-pulse" />
                <span className="text-sm font-medium">Corner Calibration</span>
                <span className="text-xs text-muted-foreground">
                  {activeCorner ? `Click to place ${activeCorner}` : "Select a corner"}
                </span>
              </div>
            )}

            {/* Direct Pitch Manipulation mode indicator - NEW */}
            {isDirectManipulating && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 glass-panel px-4 py-2 rounded-full flex items-center gap-3 fade-in z-30">
                <div className="w-3 h-3 rounded-full bg-accent animate-pulse" />
                <span className="text-sm font-medium">Direct Pitch Manipulation</span>
                <span className="text-xs text-muted-foreground">{getToolModeLabel()}</span>
              </div>
            )}

            {/* Blender-style Pitch Shape mode indicator */}
            {isPitchManipulating && !isDirectManipulating && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 glass-panel px-4 py-2 rounded-full flex items-center gap-3 fade-in z-30">
                <div className="w-3 h-3 rounded-full bg-primary animate-pulse" />
                <span className="text-sm font-medium">Pitch Shape Control</span>
                <span className="text-xs text-muted-foreground">Drag handles or use sliders to match video</span>
              </div>
            )}

            {/* Tool mode indicator */}
            {!isCornerCalibrating &&
              !isDirectManipulating &&
              !isPitchManipulating &&
              toolMode !== "select" &&
              toolMode !== "pan" &&
              videoSrc && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 glass-panel px-4 py-2 rounded-full flex items-center gap-3 fade-in">
                  <div className="w-3 h-3 rounded-full animate-pulse" style={{ backgroundColor: currentColor }} />
                  <span className="text-sm font-medium capitalize">{toolMode}</span>
                  <span className="text-xs text-muted-foreground">| {getToolModeLabel()}</span>
                  {isDashed && <span className="text-xs text-accent">Dashed</span>}
                </div>
              )}

            {/* Player counter */}
            {!isCornerCalibrating && !isDirectManipulating && toolMode === "player" && videoSrc && (
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
                <div className="text-xs text-muted-foreground">({selectedPlayerIds.length} players)</div>
                <div
                  className="w-2 h-2 rounded-full"
                  style={{
                    backgroundColor: detectedFormation.confidence > 0.7 ? "#00ff88" : "#ffaa00",
                  }}
                  title={`${Math.round(detectedFormation.confidence * 100)}% confidence`}
                />
              </div>
            )}
          </div>
        </main>

        {/* Right Sidebar - Calibration */}
        <aside className="w-56 xl:w-64 p-3 overflow-y-auto border-l border-border/50 space-y-3">
          <CalibrationPanel
            calibration={calibration}
            isCalibrating={isCalibrating}
            onUpdate={updateCalibration}
            onReset={resetCalibration}
            onToggleCalibrating={toggleCalibrating}
            onApplyPreset={applyPreset}
            pitchScale={pitchScale}
            onPitchScaleChange={setPitchScale}
            isCornerCalibrating={isCornerCalibrating}
            onToggleCornerCalibrating={() => setIsCornerCalibrating(!isCornerCalibrating)}
            cornerPoints={cornerPoints}
            activeCorner={activeCorner}
            onSetActiveCorner={setActiveCorner}
            onAutoCalibrate={handleAutoCalibrate}
            gridOverlay={gridOverlay}
            onGridOverlayChange={setGridOverlay}
            customPresets={customPresets}
            onSavePreset={(name) => {
              addPreset(name, calibration, pitchScale);
              toast.success(`Saved preset: ${name}`);
            }}
            onLoadPreset={(preset) => {
              updateCalibration(preset.calibration);
              setPitchScale(preset.pitchScale);
              toast.success(`Loaded preset: ${preset.name}`);
            }}
            onDeletePreset={(id) => {
              deleteCustomPreset(id);
              toast.success("Preset deleted");
            }}
            heatmapType={heatmapType}
            onHeatmapChange={setHeatmapType}
            isDirectManipulating={isDirectManipulating}
            onToggleDirectManipulating={() => setIsDirectManipulating(!isDirectManipulating)}
            pitchControlPoints={pitchControlPoints}
            activeControlPointId={activeControlPointId}
            onSetActiveControlPoint={setActiveControlPointId}
            onUpdateControlPoint={handleUpdateControlPoint}
            onResetControlPoint={handleResetControlPoint}
            onResetAllControlPoints={handleResetAllControlPoints}
            onAddGridPoints={handleAddGridPoints}
            isPitchManipulating={isPitchManipulating}
            onTogglePitchManipulating={() => {
              if (!isPitchManipulating) {
                setPitchSectionConfirmed(false); // Reset to show section selector
              }
              setIsPitchManipulating(!isPitchManipulating);
            }}
            pitchCorners={pitchCorners}
            onPitchCornersChange={setPitchCorners}
            onPitchCornersReset={handlePitchCornersReset}
            lockedHandles={lockedHandles}
            onLockedHandlesChange={setLockedHandles}
            selectedPitchSection={selectedPitchSection}
            selectedZoomLevel={selectedZoomLevel}
            onPitchSectionChange={setSelectedPitchSection}
            onZoomLevelChange={setSelectedZoomLevel}
            pitchSectionConfirmed={pitchSectionConfirmed}
            onPitchSectionConfirm={() => setPitchSectionConfirmed(true)}
          />
        </aside>
      </div>

      {/* Bottom Bar - Timeline */}
      <BottomBar
        videoState={videoState}
        onTogglePlay={togglePlay}
        onSeek={seek}
        onStepFrame={stepFrame}
        onSkip={skip}
        onSetPlaybackRate={setPlaybackRate}
        onSetVolume={setVolume}
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
          const project = await createProject("New Analysis");
          if (project) {
            setProjectsDialogOpen(false);
          }
        }}
      />
    </div>
  );
}
