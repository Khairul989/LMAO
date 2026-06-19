import * as THREE from "three";

// Procedural materials: MeshStandardMaterial (so the flashlight reveals them)
// with value-noise injected via onBeforeCompile. No external textures.

const NOISE_GLSL = /* glsl */ `
  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453123); }
  float vnoise(vec2 p){
    vec2 i = floor(p); vec2 f = fract(p);
    float a = hash(i);
    float b = hash(i + vec2(1.0,0.0));
    float c = hash(i + vec2(0.0,1.0));
    float d = hash(i + vec2(1.0,1.0));
    vec2 u = f*f*(3.0-2.0*f);
    return mix(a,b,u.x) + (c-a)*u.y*(1.0-u.x) + (d-b)*u.x*u.y;
  }
  float fbm(vec2 p){
    float v = 0.0; float amp = 0.5;
    for(int i=0;i<5;i++){ v += amp*vnoise(p); p*=2.03; amp*=0.5; }
    return v;
  }
`;

function injectNoise(
  mat: THREE.MeshStandardMaterial,
  scale: number,
  strength: number,
  tint: THREE.Color,
  variant: number,
) {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uScale = { value: scale };
    shader.uniforms.uStrength = { value: strength };
    shader.uniforms.uTint = { value: tint };
    shader.uniforms.uVariant = { value: variant };
    shader.vertexShader = shader.vertexShader.replace(
      "#include <common>",
      `#include <common>\n varying vec3 vWorldPos;`,
    );
    shader.vertexShader = shader.vertexShader.replace(
      "#include <worldpos_vertex>",
      `#include <worldpos_vertex>\n vWorldPos = (modelMatrix * vec4(transformed,1.0)).xyz;`,
    );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>\n uniform float uScale; uniform float uStrength; uniform vec3 uTint; uniform float uVariant; varying vec3 vWorldPos;\n ${NOISE_GLSL}`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
         vec2 np = (uVariant < 0.5 ? vWorldPos.xz : (uVariant < 1.5 ? vWorldPos.xy : vWorldPos.zy)) * uScale;
         float n = fbm(np);
         float grime = fbm(np*0.35 + 7.0);
         vec3 grimy = mix(diffuseColor.rgb, uTint, grime*0.6);
         diffuseColor.rgb = grimy * (1.0 - uStrength + uStrength*n);
        `,
      );
  };
  mat.needsUpdate = true;
}

export function wallMaterial(): THREE.Material {
  const mat = new THREE.MeshStandardMaterial({
    color: 0x6a6258,
    roughness: 0.95,
    metalness: 0.02,
  });
  injectNoise(mat, 1.4, 0.55, new THREE.Color(0x2a2620), 1);
  return mat;
}

export function floorMaterial(): THREE.Material {
  const mat = new THREE.MeshStandardMaterial({
    color: 0x3a2e24,
    roughness: 0.85,
    metalness: 0.05,
  });
  injectNoise(mat, 2.2, 0.5, new THREE.Color(0x140f0a), 0);
  return mat;
}

export function ceilingMaterial(): THREE.Material {
  const mat = new THREE.MeshStandardMaterial({
    color: 0x4a4640,
    roughness: 1.0,
    metalness: 0.0,
  });
  injectNoise(mat, 1.1, 0.6, new THREE.Color(0x161311), 2);
  return mat;
}

// Distinct accent material for the front door.
export function doorMaterial(): THREE.Material {
  return new THREE.MeshStandardMaterial({
    color: 0x5a3b1a,
    roughness: 0.7,
    metalness: 0.1,
    emissive: 0x140a02,
  });
}
