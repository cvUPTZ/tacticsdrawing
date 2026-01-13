import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Focus, ZoomIn, ZoomOut, Maximize, Eye, Check } from "lucide-react";
import { PitchCorners, DEFAULT_CORNERS } from "./PitchManipulator";

export type PitchSection = 
  | "full"           // Full pitch view
  | "left_half"      // Left half only
  | "right_half"     // Right half only
  | "left_third"     // Left third (defensive)
  | "center_third"   // Center third (midfield)
  | "right_third"    // Right third (attacking)
  | "left_penalty"   // Left penalty box area
  | "right_penalty"  // Right penalty box area
  | "left_corner_tl" // Top-left corner
  | "left_corner_bl" // Bottom-left corner
  | "right_corner_tr"// Top-right corner
  | "right_corner_br"// Bottom-right corner
  | "center_circle"  // Center circle area
  | "custom";        // Custom selection

export type ZoomLevel = "wide" | "medium" | "close" | "ultra_close";

interface PitchSectionConfig {
  section: PitchSection;
  zoomLevel: ZoomLevel;
  // Normalized coordinates (0-1) for visible area
  visibleArea: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  };
}

// Pitch dimensions: 105m x 68m
const PITCH_SECTIONS: Record<PitchSection, { label: string; icon: string; description: string }> = {
  full: { label: "Full Pitch", icon: "⬜", description: "Complete pitch visible" },
  left_half: { label: "Left Half", icon: "◧", description: "Defensive half" },
  right_half: { label: "Right Half", icon: "◨", description: "Attacking half" },
  left_third: { label: "Left Third", icon: "▌", description: "Defensive third" },
  center_third: { label: "Center Third", icon: "▐", description: "Midfield area" },
  right_third: { label: "Right Third", icon: "▐", description: "Attacking third" },
  left_penalty: { label: "Left Box", icon: "◰", description: "Defensive penalty area" },
  right_penalty: { label: "Right Box", icon: "◳", description: "Attacking penalty area" },
  left_corner_tl: { label: "Top-Left Corner", icon: "◜", description: "Corner + flag area" },
  left_corner_bl: { label: "Bottom-Left Corner", icon: "◟", description: "Corner + flag area" },
  right_corner_tr: { label: "Top-Right Corner", icon: "◝", description: "Corner + flag area" },
  right_corner_br: { label: "Bottom-Right Corner", icon: "◞", description: "Corner + flag area" },
  center_circle: { label: "Center Circle", icon: "◯", description: "Kickoff area" },
  custom: { label: "Custom", icon: "✏", description: "Define manually" },
};

const ZOOM_LEVELS: Record<ZoomLevel, { label: string; fovRange: string; typical: string }> = {
  wide: { label: "Wide", fovRange: "60-90°", typical: "Full pitch broadcast" },
  medium: { label: "Medium", fovRange: "40-60°", typical: "Half pitch view" },
  close: { label: "Close", fovRange: "25-40°", typical: "Penalty area focus" },
  ultra_close: { label: "Ultra Close", fovRange: "15-25°", typical: "Goal mouth / corner" },
};

// Default visible areas for each section (normalized 0-1)
// These define which part of the pitch is VISIBLE in the video
const SECTION_VISIBLE_AREAS: Record<PitchSection, { x1: number; y1: number; x2: number; y2: number }> = {
  full: { x1: 0, y1: 0, x2: 1, y2: 1 },
  left_half: { x1: 0, y1: 0, x2: 0.5, y2: 1 },
  right_half: { x1: 0.5, y1: 0, x2: 1, y2: 1 },
  left_third: { x1: 0, y1: 0, x2: 0.33, y2: 1 },
  center_third: { x1: 0.33, y1: 0, x2: 0.67, y2: 1 },
  right_third: { x1: 0.67, y1: 0, x2: 1, y2: 1 },
  left_penalty: { x1: 0, y1: 0.15, x2: 0.16, y2: 0.85 },
  right_penalty: { x1: 0.84, y1: 0.15, x2: 1, y2: 0.85 },
  left_corner_tl: { x1: 0, y1: 0, x2: 0.2, y2: 0.35 },
  left_corner_bl: { x1: 0, y1: 0.65, x2: 0.2, y2: 1 },
  right_corner_tr: { x1: 0.8, y1: 0, x2: 1, y2: 0.35 },
  right_corner_br: { x1: 0.8, y1: 0.65, x2: 1, y2: 1 },
  center_circle: { x1: 0.4, y1: 0.3, x2: 0.6, y2: 0.7 },
  custom: { x1: 0, y1: 0, x2: 1, y2: 1 },
};

interface PitchSectionSelectorProps {
  selectedSection: PitchSection;
  selectedZoom: ZoomLevel;
  onSectionChange: (section: PitchSection) => void;
  onZoomChange: (zoom: ZoomLevel) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export function PitchSectionSelector({
  selectedSection,
  selectedZoom,
  onSectionChange,
  onZoomChange,
  onConfirm,
  onCancel,
}: PitchSectionSelectorProps) {
  const [hoveredSection, setHoveredSection] = useState<PitchSection | null>(null);

  const getSectionStyle = (section: PitchSection) => {
    const area = SECTION_VISIBLE_AREAS[section];
    return {
      left: `${area.x1 * 100}%`,
      top: `${area.y1 * 100}%`,
      width: `${(area.x2 - area.x1) * 100}%`,
      height: `${(area.y2 - area.y1) * 100}%`,
    };
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold flex items-center gap-1.5">
          <Focus className="h-3.5 w-3.5" />
          Select Visible Pitch Section
        </h4>
      </div>

      <p className="text-[10px] text-muted-foreground leading-tight">
        Choose which part of the pitch is visible in your video. The 3D pitch will show ONLY this section for easier alignment.
      </p>

      {/* Zoom Level Selection */}
      <div className="space-y-1.5">
        <Label className="text-[10px] text-muted-foreground">Camera Zoom Level</Label>
        <div className="grid grid-cols-4 gap-1">
          {(Object.entries(ZOOM_LEVELS) as [ZoomLevel, typeof ZOOM_LEVELS[ZoomLevel]][]).map(([zoom, info]) => (
            <Button
              key={zoom}
              variant={selectedZoom === zoom ? "default" : "outline"}
              size="sm"
              className="h-7 text-[9px] px-1 flex-col py-1"
              onClick={() => onZoomChange(zoom)}
            >
              {zoom === "wide" && <ZoomOut className="h-3 w-3" />}
              {zoom === "medium" && <Eye className="h-3 w-3" />}
              {zoom === "close" && <ZoomIn className="h-3 w-3" />}
              {zoom === "ultra_close" && <Maximize className="h-3 w-3" />}
              <span>{info.label}</span>
            </Button>
          ))}
        </div>
        <p className="text-[9px] text-muted-foreground">
          {ZOOM_LEVELS[selectedZoom].typical}
        </p>
      </div>

      {/* Visual Pitch Map */}
      <div className="space-y-1.5">
        <Label className="text-[10px] text-muted-foreground">Click to select visible area</Label>
        <div className="relative w-full aspect-[105/68] bg-emerald-900/30 rounded border border-border overflow-hidden">
          {/* Pitch markings */}
          <svg viewBox="0 0 105 68" className="absolute inset-0 w-full h-full">
            {/* Pitch outline */}
            <rect x="0.5" y="0.5" width="104" height="67" fill="none" stroke="white" strokeWidth="0.3" opacity="0.3" />
            {/* Center line */}
            <line x1="52.5" y1="0" x2="52.5" y2="68" stroke="white" strokeWidth="0.3" opacity="0.3" />
            {/* Center circle */}
            <circle cx="52.5" cy="34" r="9.15" fill="none" stroke="white" strokeWidth="0.3" opacity="0.3" />
            {/* Left penalty area */}
            <rect x="0" y="13.84" width="16.5" height="40.32" fill="none" stroke="white" strokeWidth="0.3" opacity="0.3" />
            {/* Right penalty area */}
            <rect x="88.5" y="13.84" width="16.5" height="40.32" fill="none" stroke="white" strokeWidth="0.3" opacity="0.3" />
            {/* Left goal area */}
            <rect x="0" y="24.84" width="5.5" height="18.32" fill="none" stroke="white" strokeWidth="0.3" opacity="0.3" />
            {/* Right goal area */}
            <rect x="99.5" y="24.84" width="5.5" height="18.32" fill="none" stroke="white" strokeWidth="0.3" opacity="0.3" />
          </svg>

          {/* Clickable sections overlay */}
          {selectedZoom === "wide" && (
            <>
              {/* Full pitch */}
              <button
                className={`absolute inset-0 transition-colors ${
                  selectedSection === "full" ? "bg-primary/30 ring-2 ring-primary" : "hover:bg-primary/10"
                }`}
                onClick={() => onSectionChange("full")}
                onMouseEnter={() => setHoveredSection("full")}
                onMouseLeave={() => setHoveredSection(null)}
              />
              {/* Halves */}
              <button
                className={`absolute top-0 left-0 w-1/2 h-full transition-colors border-r border-dashed border-white/20 ${
                  selectedSection === "left_half" ? "bg-primary/30 ring-2 ring-primary" : "hover:bg-primary/10"
                }`}
                onClick={() => onSectionChange("left_half")}
                onMouseEnter={() => setHoveredSection("left_half")}
                onMouseLeave={() => setHoveredSection(null)}
              />
              <button
                className={`absolute top-0 right-0 w-1/2 h-full transition-colors ${
                  selectedSection === "right_half" ? "bg-primary/30 ring-2 ring-primary" : "hover:bg-primary/10"
                }`}
                onClick={() => onSectionChange("right_half")}
                onMouseEnter={() => setHoveredSection("right_half")}
                onMouseLeave={() => setHoveredSection(null)}
              />
            </>
          )}

          {selectedZoom === "medium" && (
            <>
              {/* Thirds */}
              <button
                style={getSectionStyle("left_third")}
                className={`absolute transition-colors border-r border-dashed border-white/20 ${
                  selectedSection === "left_third" ? "bg-primary/30 ring-2 ring-primary" : "hover:bg-primary/10"
                }`}
                onClick={() => onSectionChange("left_third")}
                onMouseEnter={() => setHoveredSection("left_third")}
                onMouseLeave={() => setHoveredSection(null)}
              />
              <button
                style={getSectionStyle("center_third")}
                className={`absolute transition-colors border-r border-dashed border-white/20 ${
                  selectedSection === "center_third" ? "bg-primary/30 ring-2 ring-primary" : "hover:bg-primary/10"
                }`}
                onClick={() => onSectionChange("center_third")}
                onMouseEnter={() => setHoveredSection("center_third")}
                onMouseLeave={() => setHoveredSection(null)}
              />
              <button
                style={getSectionStyle("right_third")}
                className={`absolute transition-colors ${
                  selectedSection === "right_third" ? "bg-primary/30 ring-2 ring-primary" : "hover:bg-primary/10"
                }`}
                onClick={() => onSectionChange("right_third")}
                onMouseEnter={() => setHoveredSection("right_third")}
                onMouseLeave={() => setHoveredSection(null)}
              />
              {/* Center circle */}
              <button
                style={getSectionStyle("center_circle")}
                className={`absolute transition-colors rounded-full ${
                  selectedSection === "center_circle" ? "bg-primary/30 ring-2 ring-primary" : "hover:bg-primary/10"
                }`}
                onClick={() => onSectionChange("center_circle")}
                onMouseEnter={() => setHoveredSection("center_circle")}
                onMouseLeave={() => setHoveredSection(null)}
              />
            </>
          )}

          {selectedZoom === "close" && (
            <>
              {/* Penalty boxes */}
              <button
                style={getSectionStyle("left_penalty")}
                className={`absolute transition-colors ${
                  selectedSection === "left_penalty" ? "bg-primary/30 ring-2 ring-primary" : "hover:bg-primary/10"
                }`}
                onClick={() => onSectionChange("left_penalty")}
                onMouseEnter={() => setHoveredSection("left_penalty")}
                onMouseLeave={() => setHoveredSection(null)}
              />
              <button
                style={getSectionStyle("right_penalty")}
                className={`absolute transition-colors ${
                  selectedSection === "right_penalty" ? "bg-primary/30 ring-2 ring-primary" : "hover:bg-primary/10"
                }`}
                onClick={() => onSectionChange("right_penalty")}
                onMouseEnter={() => setHoveredSection("right_penalty")}
                onMouseLeave={() => setHoveredSection(null)}
              />
              {/* Thirds for close zoom */}
              <button
                style={{ ...getSectionStyle("left_third"), opacity: 0.5 }}
                className={`absolute transition-colors ${
                  selectedSection === "left_third" ? "bg-primary/30 ring-2 ring-primary" : "hover:bg-primary/10"
                }`}
                onClick={() => onSectionChange("left_third")}
              />
              <button
                style={{ ...getSectionStyle("right_third"), opacity: 0.5 }}
                className={`absolute transition-colors ${
                  selectedSection === "right_third" ? "bg-primary/30 ring-2 ring-primary" : "hover:bg-primary/10"
                }`}
                onClick={() => onSectionChange("right_third")}
              />
            </>
          )}

          {selectedZoom === "ultra_close" && (
            <>
              {/* Corners */}
              <button
                style={getSectionStyle("left_corner_tl")}
                className={`absolute transition-colors ${
                  selectedSection === "left_corner_tl" ? "bg-primary/30 ring-2 ring-primary" : "hover:bg-primary/10"
                }`}
                onClick={() => onSectionChange("left_corner_tl")}
                onMouseEnter={() => setHoveredSection("left_corner_tl")}
                onMouseLeave={() => setHoveredSection(null)}
              />
              <button
                style={getSectionStyle("left_corner_bl")}
                className={`absolute transition-colors ${
                  selectedSection === "left_corner_bl" ? "bg-primary/30 ring-2 ring-primary" : "hover:bg-primary/10"
                }`}
                onClick={() => onSectionChange("left_corner_bl")}
                onMouseEnter={() => setHoveredSection("left_corner_bl")}
                onMouseLeave={() => setHoveredSection(null)}
              />
              <button
                style={getSectionStyle("right_corner_tr")}
                className={`absolute transition-colors ${
                  selectedSection === "right_corner_tr" ? "bg-primary/30 ring-2 ring-primary" : "hover:bg-primary/10"
                }`}
                onClick={() => onSectionChange("right_corner_tr")}
                onMouseEnter={() => setHoveredSection("right_corner_tr")}
                onMouseLeave={() => setHoveredSection(null)}
              />
              <button
                style={getSectionStyle("right_corner_br")}
                className={`absolute transition-colors ${
                  selectedSection === "right_corner_br" ? "bg-primary/30 ring-2 ring-primary" : "hover:bg-primary/10"
                }`}
                onClick={() => onSectionChange("right_corner_br")}
                onMouseEnter={() => setHoveredSection("right_corner_br")}
                onMouseLeave={() => setHoveredSection(null)}
              />
              {/* Penalty boxes for ultra close */}
              <button
                style={{ ...getSectionStyle("left_penalty"), opacity: 0.5 }}
                className={`absolute transition-colors ${
                  selectedSection === "left_penalty" ? "bg-primary/30 ring-2 ring-primary" : "hover:bg-primary/10"
                }`}
                onClick={() => onSectionChange("left_penalty")}
              />
              <button
                style={{ ...getSectionStyle("right_penalty"), opacity: 0.5 }}
                className={`absolute transition-colors ${
                  selectedSection === "right_penalty" ? "bg-primary/30 ring-2 ring-primary" : "hover:bg-primary/10"
                }`}
                onClick={() => onSectionChange("right_penalty")}
              />
            </>
          )}

          {/* Selected area highlight */}
          {selectedSection !== "full" && (
            <div
              style={getSectionStyle(selectedSection)}
              className="absolute border-2 border-primary pointer-events-none animate-pulse"
            />
          )}
        </div>
      </div>

      {/* Selected Section Info */}
      <div className="p-2 bg-muted/30 rounded-md">
        <div className="flex items-center gap-2">
          <span className="text-lg">{PITCH_SECTIONS[selectedSection].icon}</span>
          <div>
            <p className="text-xs font-medium">{PITCH_SECTIONS[selectedSection].label}</p>
            <p className="text-[9px] text-muted-foreground">{PITCH_SECTIONS[selectedSection].description}</p>
          </div>
        </div>
      </div>

      {/* Quick Section Buttons */}
      <div className="space-y-1.5">
        <Label className="text-[10px] text-muted-foreground">Quick Select</Label>
        <div className="grid grid-cols-3 gap-1">
          <Button
            variant={selectedSection === "full" ? "default" : "outline"}
            size="sm"
            className="h-6 text-[9px]"
            onClick={() => onSectionChange("full")}
          >
            Full
          </Button>
          <Button
            variant={selectedSection === "left_half" ? "default" : "outline"}
            size="sm"
            className="h-6 text-[9px]"
            onClick={() => onSectionChange("left_half")}
          >
            Left Half
          </Button>
          <Button
            variant={selectedSection === "right_half" ? "default" : "outline"}
            size="sm"
            className="h-6 text-[9px]"
            onClick={() => onSectionChange("right_half")}
          >
            Right Half
          </Button>
          <Button
            variant={selectedSection === "left_penalty" ? "default" : "outline"}
            size="sm"
            className="h-6 text-[9px]"
            onClick={() => onSectionChange("left_penalty")}
          >
            Left Box
          </Button>
          <Button
            variant={selectedSection === "center_circle" ? "default" : "outline"}
            size="sm"
            className="h-6 text-[9px]"
            onClick={() => onSectionChange("center_circle")}
          >
            Center
          </Button>
          <Button
            variant={selectedSection === "right_penalty" ? "default" : "outline"}
            size="sm"
            className="h-6 text-[9px]"
            onClick={() => onSectionChange("right_penalty")}
          >
            Right Box
          </Button>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 pt-2">
        <Button variant="outline" size="sm" className="flex-1 h-7 text-[10px]" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" className="flex-1 h-7 text-[10px]" onClick={onConfirm}>
          <Check className="h-3 w-3 mr-1" />
          Confirm & Adjust
        </Button>
      </div>
    </div>
  );
}

// Helper to get pitch corners for alignment
// IMPORTANT: We always return FULL PITCH corners because section selection 
// only affects which LINES are drawn, not the corner positions.
// Users still need to align the full pitch corners to video, then
// the section filtering will show only the relevant pitch lines.
export function getInitialCornersForSection(section: PitchSection): PitchCorners {
  // Always return full pitch corners - section only filters visible lines
  return { ...DEFAULT_CORNERS };
}

// Get the visible area definition for filtering pitch elements
export function getVisibleAreaForSection(section: PitchSection): { x1: number; y1: number; x2: number; y2: number } {
  return SECTION_VISIBLE_AREAS[section];
}

export { SECTION_VISIBLE_AREAS, PITCH_SECTIONS, ZOOM_LEVELS };
