import * as THREE from 'three';
import { CalibrationState } from '@/types/analysis';

export interface CalibrationPoint3D {
    world: { x: number; y: number; z: number };
    screen: { x: number; y: number }; // x,y in pixels
}

interface SolverResult {
    calibration: CalibrationState;
    error: number;
}

/**
 * Solves for camera extrinsic parameters using a set of 2D-3D point correspondences.
 * Uses a numerical optimization (Gradient Descent / Local Search) approach since
 * we don't have a direct PnP solver available in the environment.
 */
export function solveCameraPose(
    points: CalibrationPoint3D[],
    containerWidth: number,
    containerHeight: number,
    initialGuess?: CalibrationState
): SolverResult {
    // Normalize screen coordinates to Normalized Device Coordinates (NDC) [-1, 1]

    const observations = points.map(p => ({
        world: new THREE.Vector3(p.world.x, p.world.y, p.world.z),
        ndc: new THREE.Vector2(
            (p.screen.x / containerWidth) * 2 - 1,
            -(p.screen.y / containerHeight) * 2 + 1 // Flip Y for NDC
        )
    }));

    // Initial Parameters
    // Broadcast cameras are usually:
    // X: near 0 (center line)
    // Y: 15m - 40m high
    // Z: 40m - 100m away (negative or positive depending on side, usually positive Z is towards camera)
    // RotX: -10 to -30 degrees (looking down)

    // State vector: [x, y, z, rotX, rotY, fov]
    let currentParams = initialGuess ? [
        initialGuess.cameraX,
        initialGuess.cameraY,
        initialGuess.cameraZ,
        initialGuess.cameraRotationX,
        initialGuess.cameraRotationY,
        initialGuess.cameraFov || 45
    ] : [
        0,    // x
        30,   // y
        60,   // z
        -0.4, // rotX (radians)
        0,    // rotY (radians)
        30    // fov (degrees)
    ];

    const camera = new THREE.PerspectiveCamera(currentParams[5], containerWidth / containerHeight, 0.1, 1000);
    camera.rotation.order = 'YXZ';

    const project = (params: number[]) => {
        camera.position.set(params[0], params[1], params[2]);
        camera.rotation.x = params[3];
        camera.rotation.y = params[4];
        camera.rotation.z = 0; // Assume roll is 0
        camera.fov = params[5];
        camera.updateProjectionMatrix();
        camera.updateMatrixWorld();

        let totalError = 0;
        for (const obs of observations) {
            const p = obs.world.clone();
            p.project(camera); // p is now in NDC
            const dx = p.x - obs.ndc.x;
            const dy = p.y - obs.ndc.y;
            totalError += (dx * dx + dy * dy);
        }
        return totalError / observations.length; // Mean Squared Error
    };

    // Optimization Loop (Simple local search)
    let bestError = project(currentParams);
    let bestParams = [...currentParams];

    const steps = [
        { iter: 1000, learnRate: 2.0, rotLearn: 0.1, fovLearn: 2.0 },    // Coarse
        { iter: 2000, learnRate: 0.5, rotLearn: 0.02, fovLearn: 0.5 },   // Refine
        { iter: 2000, learnRate: 0.05, rotLearn: 0.005, fovLearn: 0.1 }  // Fine
    ];

    for (const step of steps) {
        for (let i = 0; i < step.iter; i++) {
            const candidateParams = [...bestParams];

            const idx = Math.floor(Math.random() * 6);

            let delta = 0;
            if (idx < 3) delta = (Math.random() - 0.5) * step.learnRate; // Position
            else if (idx < 5) delta = (Math.random() - 0.5) * step.rotLearn; // Rotation
            else delta = (Math.random() - 0.5) * step.fovLearn; // FOV

            candidateParams[idx] += delta;

            // Constraints
            if (candidateParams[1] < 5) candidateParams[1] = 5; // Height min
            if (candidateParams[5] < 10) candidateParams[5] = 10; // FOV min
            if (candidateParams[5] > 120) candidateParams[5] = 120; // FOV max

            const err = project(candidateParams);
            if (err < bestError) {
                bestError = err;
                bestParams = candidateParams;
            }
        }
    }

    return {
        calibration: {
            cameraX: bestParams[0],
            cameraY: bestParams[1],
            cameraZ: bestParams[2],
            cameraRotationX: bestParams[3],
            cameraRotationY: bestParams[4],
            cameraRotationZ: 0,
            cameraFov: bestParams[5]
        },
        error: bestError
    };
}
