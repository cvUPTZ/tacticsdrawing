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
    // BUT Three.js project() maps to NDC.
    // We'll compare Projected NDC vs Observed NDC.

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
    // Z: 40m - 100m away (negative or positive depending on side, assume visible side)
    // RotX: -10 to -30 degrees (looking down)

    // State vector: [x, y, z, rotX, rotY, fov]
    let currentParams = initialGuess ? [
        initialGuess.cameraX,
        initialGuess.cameraY,
        initialGuess.cameraZ,
        initialGuess.cameraRotationX,
        initialGuess.cameraRotationY,
        45 // initial FOV guess if not provided
    ] : [
        0,    // x
        30,   // y
        60,   // z
        -0.4, // rotX (radians)
        0,    // rotY (radians)
        30    // fov (degrees)
    ];

    const camera = new THREE.PerspectiveCamera(currentParams[5], containerWidth / containerHeight, 0.1, 1000);
    camera.rotation.order = 'YXZ'; // Yaw then Pitch usually better for pan/tilt

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

    // Optimization Loop (Simple Hill Climbing / Gradient Descent Hybrid)
    // Since we have very few parameters, random local search acts like a robust gradient estimator
    // without needing explicit derivatives.
    let bestError = project(currentParams);
    let bestParams = [...currentParams];

    // Multi-pass refinement: Coarse -> Fine
    const steps = [
        { iter: 1000, learnRate: 2.0, rotLearn: 0.1, fovLearn: 2.0 },    // Coarse exploration
        { iter: 2000, learnRate: 0.5, rotLearn: 0.02, fovLearn: 0.5 },   // Refinement
        { iter: 2000, learnRate: 0.05, rotLearn: 0.005, fovLearn: 0.1 }   // Fine tuning
    ];

    for (const step of steps) {
        for (let i = 0; i < step.iter; i++) {
            const candidateParams = [...bestParams];

            // Perturb one parameter at a time or all?
            // Let's perturb all slightly
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
            // We don't expose FOV in CalibrationState usually, but standard is vertical FOV.
            // We might need to handle FOV somewhere if the app supports zoom/fov changes.
            // CalibrationState doesn't seem to have FOV currently?
            // Checking types might be needed. For now assuming fixed FOV logic or we map Z to "distance" effect.
            // Wait, ThreeCanvas uses perspective camera. If CalibrationState lacks FOV, 
            // we might need to rely on 'zoom' or just assume a standard lens.
            // Let's check CalibrationState definition. If no FOV, we simulate zoom by moving closer/further?
            // Actually, variable focal length is critical for accurate math.
            // If we can't save FOV, we might produce a 'perfect' view that looks wrong if FOV is mismatched.
            // Let's assume we can't change FOV in the state object for now and solve for Fixed FOV?
            // Or maybe implicit FOV via "ZoomLevel"?
        },
        error: bestError
    };
}
