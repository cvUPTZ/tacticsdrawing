import { useState, useRef, useCallback, useEffect } from 'react';
import { VideoState } from '@/types/analysis';

export function useVideoPlayer() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoState, setVideoState] = useState<VideoState>({
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    playbackRate: 1,
    volume: 1,
    isMuted: true,
  });
  const [videoSrc, setVideoSrc] = useState<string | null>(null);

  const updateVideoState = useCallback((updates: Partial<VideoState>) => {
    setVideoState(prev => ({ ...prev, ...updates }));
  }, []);

  // Sync video element events with state
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      updateVideoState({ currentTime: video.currentTime });
    };

    const handleLoadedMetadata = () => {
      updateVideoState({ duration: video.duration });
    };

    const handlePlay = () => {
      updateVideoState({ isPlaying: true });
    };

    const handlePause = () => {
      updateVideoState({ isPlaying: false });
    };

    const handleEnded = () => {
      updateVideoState({ isPlaying: false });
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('ended', handleEnded);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('ended', handleEnded);
    };
  }, [updateVideoState]);

  const play = useCallback(() => {
    videoRef.current?.play();
  }, []);

  const pause = useCallback(() => {
    videoRef.current?.pause();
  }, []);

  const togglePlay = useCallback(() => {
    if (videoRef.current?.paused) {
      play();
    } else {
      pause();
    }
  }, [play, pause]);

  const seek = useCallback((time: number) => {
    if (videoRef.current) {
      const clampedTime = Math.max(0, Math.min(time, videoRef.current.duration || videoState.duration));
      videoRef.current.currentTime = clampedTime;
      updateVideoState({ currentTime: clampedTime });
    }
  }, [videoState.duration, updateVideoState]);

  const skip = useCallback((seconds: number) => {
    if (videoRef.current) {
      const newTime = videoRef.current.currentTime + seconds;
      seek(newTime);
    }
  }, [seek]);

  const stepFrame = useCallback((direction: 'forward' | 'backward') => {
    if (videoRef.current) {
      videoRef.current.pause();
      const frameTime = 1 / 30; // Assume 30fps
      const newTime = direction === 'forward' 
        ? videoRef.current.currentTime + frameTime 
        : videoRef.current.currentTime - frameTime;
      seek(newTime);
    }
  }, [seek]);

  const setPlaybackRate = useCallback((rate: number) => {
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
      updateVideoState({ playbackRate: rate });
    }
  }, [updateVideoState]);

  const setVolume = useCallback((volume: number) => {
    if (videoRef.current) {
      videoRef.current.volume = volume;
      updateVideoState({ volume, isMuted: volume === 0 });
    }
  }, [updateVideoState]);

  const toggleMute = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      updateVideoState({ isMuted: videoRef.current.muted });
    }
  }, [updateVideoState]);

  const loadVideo = useCallback((file: File) => {
    const url = URL.createObjectURL(file);
    setVideoSrc(url);
    return url;
  }, []);

  const clearVideo = useCallback(() => {
    if (videoSrc) {
      URL.revokeObjectURL(videoSrc);
    }
    setVideoSrc(null);
    setVideoState({
      isPlaying: false,
      currentTime: 0,
      duration: 0,
      playbackRate: 1,
      volume: 1,
      isMuted: true,
    });
  }, [videoSrc]);

  // Format time as HH:MM:SS:FF
  const formatTimecode = useCallback((seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const frames = Math.floor((seconds % 1) * 30); // 30fps
    
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}:${frames.toString().padStart(2, '0')}`;
  }, []);

  return {
    videoRef,
    videoState,
    videoSrc,
    play,
    pause,
    togglePlay,
    seek,
    skip,
    stepFrame,
    setPlaybackRate,
    setVolume,
    toggleMute,
    loadVideo,
    clearVideo,
    formatTimecode,
  };
}
