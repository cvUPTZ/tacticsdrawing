import * as THREE from 'three';

export const ProjectiveTextureShader = {
    uniforms: {
        tVideo: { value: null },
        projectionMatrix4: { value: new THREE.Matrix4() },
        opacity: { value: 1.0 },
        useTexture: { value: 0.0 }
    },
    vertexShader: `
    varying vec4 vProjectionCoords;
    varying vec2 vUv;
    uniform mat4 projectionMatrix4;
    
    void main() {
      vUv = uv;
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      vProjectionCoords = projectionMatrix4 * worldPosition;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
    fragmentShader: `
    uniform sampler2D tVideo;
    uniform float opacity;
    uniform float useTexture;
    varying vec4 vProjectionCoords;
    varying vec2 vUv;

    void main() {
      vec4 texColor = vec4(0.176, 0.541, 0.243, 0.0); // Default green
      
      if (useTexture > 0.5) {
        // Projective mapping
        vec3 proj = vProjectionCoords.xyz / vProjectionCoords.w;
        vec2 projUv = proj.xy * 0.5 + 0.5;
        
        // Check if projected UV is within [0, 1]
        if (projUv.x >= 0.0 && projUv.x <= 1.0 && projUv.y >= 0.0 && projUv.y <= 1.0 && vProjectionCoords.w > 0.0) {
          texColor = texture2D(tVideo, projUv);
          texColor.a = opacity;
        }
      }
      
      gl_FragColor = texColor;
    }
  `
};
