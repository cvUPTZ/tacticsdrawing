import { forwardRef } from 'react';

interface VideoCanvasProps {
  src: string | null;
  onLoadedMetadata?: () => void;
}

export const VideoCanvas = forwardRef<HTMLVideoElement, VideoCanvasProps>(
  ({ src, onLoadedMetadata }, ref) => {
    if (!src) {
      return (
        <div className="video-layer flex items-center justify-center bg-background/50">
          <div className="text-center text-muted-foreground">
            <div className="mb-4 text-6xl opacity-30">⬆️</div>
            <p className="text-lg font-medium">Drop a video file here</p>
            <p className="text-sm">or use the upload button</p>
          </div>
        </div>
      );
    }

    return (
      <video
        ref={ref}
        className="video-layer"
        src={src}
        muted
        playsInline
        onLoadedMetadata={onLoadedMetadata}
      />
    );
  }
);

VideoCanvas.displayName = 'VideoCanvas';
