import { useState, useCallback, useRef, useEffect } from 'react';
import { isOpenCVReady } from '@/utils/homography';

interface Point {
    x: number;
    y: number;
}

interface ZoomStatus {
    scale: number;
    status: 'stable' | 'zoom-detected' | 'error';
    currentDistance: number;
    initialDistance: number;
}

interface UseZoomDiagnosisReturn {
    isMonitoring: boolean;
    isSettingReference: boolean;
    referencePoints: Point[];
    zoomStatus: ZoomStatus | null;
    error: string | null;

    startSettingReference: () => void;
    cancelSettingReference: () => void;
    addReferencePoint: (x: number, y: number) => void;
    startMonitoring: () => void;
    stopMonitoring: () => void;
    processFrame: (videoElement: HTMLVideoElement) => void;
}

export function useZoomDiagnosis(): UseZoomDiagnosisReturn {
    const [isMonitoring, setIsMonitoring] = useState(false);
    const [isSettingReference, setIsSettingReference] = useState(false);
    const [referencePoints, setReferencePoints] = useState<Point[]>([]);
    const [zoomStatus, setZoomStatus] = useState<ZoomStatus | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Refs for processing loop
    const prevGray = useRef<any>(null); // cv.Mat
    const prevPoints = useRef<any>(null); // cv.Mat
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const processingRef = useRef(false);

    // Initialize canvas for processing
    useEffect(() => {
        canvasRef.current = document.createElement('canvas');
        // We process at a lower resolution for performance
        canvasRef.current.width = 640;
        canvasRef.current.height = 360;
    }, []);

    // Cleanup OpenCV mats on unmount or stop
    const cleanup = useCallback(() => {
        if (prevGray.current) {
            prevGray.current.delete();
            prevGray.current = null;
        }
        if (prevPoints.current) {
            prevPoints.current.delete();
            prevPoints.current = null;
        }
        processingRef.current = false;
    }, []);

    useEffect(() => {
        return () => cleanup();
    }, [cleanup]);

    const startSettingReference = useCallback(() => {
        setIsSettingReference(true);
        setReferencePoints([]);
        setZoomStatus(null);
        setError(null);
        cleanup();
    }, [cleanup]);

    const cancelSettingReference = useCallback(() => {
        setIsSettingReference(false);
        setReferencePoints([]);
    }, []);

    const addReferencePoint = useCallback((x: number, y: number) => {
        if (!isSettingReference) return;

        setReferencePoints(prev => {
            const newPoints = [...prev, { x, y }];
            if (newPoints.length === 2) {
                setIsSettingReference(false);
            }
            return newPoints;
        });
    }, [isSettingReference]);

    const startMonitoring = useCallback(() => {
        if (referencePoints.length !== 2) {
            setError("Need exactly 2 reference points");
            return;
        }
        if (!isOpenCVReady()) {
            setError("OpenCV is not ready");
            return;
        }

        const dist = Math.sqrt(
            Math.pow(referencePoints[1].x - referencePoints[0].x, 2) +
            Math.pow(referencePoints[1].y - referencePoints[0].y, 2)
        );

        setZoomStatus({
            scale: 1.0,
            status: 'stable',
            currentDistance: dist,
            initialDistance: dist,
        });

        setIsMonitoring(true);
        setError(null);
    }, [referencePoints]);

    const stopMonitoring = useCallback(() => {
        setIsMonitoring(false);
        cleanup();
    }, [cleanup]);

    const processFrame = useCallback((videoElement: HTMLVideoElement) => {
        if (!isMonitoring || !isOpenCVReady() || !zoomStatus || processingRef.current) return;

        const cv = window.cv;
        const canvas = canvasRef.current;
        if (!canvas) return;

        processingRef.current = true;

        try {
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error("No canvas context");

            // Draw video frame to canvas (resized)
            ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

            // Conversion ratio (video pixels -> processing canvas pixels)
            const scaleX = canvas.width / videoElement.videoWidth;
            const scaleY = canvas.height / videoElement.videoHeight;

            // 1. Prepare current frame gray scale
            const src = cv.imread(canvas);
            const gray = new cv.Mat();
            cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

            // 2. If first frame, initialize points
            if (!prevGray.current || !prevPoints.current) {
                prevGray.current = gray.clone();

                // Convert reference points to processing coordinates
                const p1 = referencePoints[0];
                const p2 = referencePoints[1];

                const initialPointsArray = [
                    p1.x * scaleX, p1.y * scaleY,
                    p2.x * scaleX, p2.y * scaleY
                ];

                prevPoints.current = cv.matFromArray(2, 1, cv.CV_32FC2, initialPointsArray);

                // Cleanup src
                src.delete(); // Don't delete gray yet, it becomes prevGray
                return; // Wait for next frame to filter
            }

            // 3. Calculate Optical Flow
            const nextPoints = new cv.Mat();
            const status = new cv.Mat();
            const err = new cv.Mat();
            const winSize = new cv.Size(21, 21);
            const maxLevel = 2;
            const criteria = new cv.TermCriteria(cv.TermCriteria_EPS | cv.TermCriteria_COUNT, 10, 0.03);

            cv.calcOpticalFlowPyrLK(
                prevGray.current,
                gray,
                prevPoints.current,
                nextPoints,
                status,
                err,
                winSize,
                maxLevel,
                criteria
            );

            // 4. Update points if tracked
            let p1_new = null;
            let p2_new = null;

            // Check if both points are found (status == 1)
            if (status.data[0] === 1 && status.data[1] === 1) {
                // Get new coordinates
                const p1_x = nextPoints.data32F[0];
                const p1_y = nextPoints.data32F[1];
                const p2_x = nextPoints.data32F[2];
                const p2_y = nextPoints.data32F[3];

                p1_new = { x: p1_x / scaleX, y: p1_y / scaleY };
                p2_new = { x: p2_x / scaleX, y: p2_y / scaleY };

                // Calculate new distance
                const newDist = Math.sqrt(
                    Math.pow(p1_new.x - p2_new.x, 2) +
                    Math.pow(p1_new.y - p2_new.y, 2)
                );

                // Update zoom status
                const newScale = newDist / zoomStatus.initialDistance;
                const isZoomed = Math.abs(newScale - 1.0) > 0.05; // 5% threshold

                setZoomStatus(prev => prev ? ({
                    ...prev,
                    scale: newScale,
                    currentDistance: newDist,
                    status: isZoomed ? 'zoom-detected' : 'stable'
                }) : null);

                // Update reference points for UI visualization
                setReferencePoints([p1_new, p2_new]);

                // Update prevPoints for next iteration
                // We copy nextPoints to prevPoints
                nextPoints.copyTo(prevPoints.current);
            } else {
                // Lost tracking
                setError("Lost tracking of reference points");
                stopMonitoring();

                // Clean up local matrices before returning
                src.delete();
                gray.delete();
                nextPoints.delete();
                status.delete();
                err.delete();
                return;
            }

            // 5. Cleanup
            if (prevGray.current) {
                prevGray.current.delete();
            }
            prevGray.current = gray.clone(); // Keep current gray as prev for next

            src.delete();
            gray.delete();
            nextPoints.delete();
            status.delete();
            err.delete();

        } catch (e: any) {
            console.error("Tracking error:", e);
            setError("Tracking failed: " + e.message);
            stopMonitoring();
        } finally {
            processingRef.current = false;
        }
    }, [isMonitoring, referencePoints, zoomStatus, stopMonitoring]);

    return {
        isMonitoring,
        isSettingReference,
        referencePoints,
        zoomStatus,
        error,
        startSettingReference,
        cancelSettingReference,
        addReferencePoint,
        startMonitoring,
        stopMonitoring,
        processFrame,
    };
}
