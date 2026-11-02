import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

interface ThreeDLogoLoaderProps {
  statusText?: string;
  subText?: string;
}

/**
 * Creates a high-resolution canvas texture of the official PT Anugrah Kemasan Kreatif emblem.
 */
function createAkkEmblemCanvas(size = 512): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  // Clear
  ctx.clearRect(0, 0, size, size);

  // Background squircle rounded rect
  const r = size * 0.18;
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.lineTo(size - r, 0);
  ctx.quadraticCurveTo(size, 0, size, r);
  ctx.lineTo(size, size - r);
  ctx.quadraticCurveTo(size, size, size - r, size);
  ctx.lineTo(r, size);
  ctx.quadraticCurveTo(0, size, 0, size - r);
  ctx.lineTo(0, r);
  ctx.quadraticCurveTo(0, 0, r, 0);
  ctx.closePath();

  // Vibrant Blue Gradient
  const grad = ctx.createLinearGradient(0, 0, 0, size);
  grad.addColorStop(0, '#1E8AD5');
  grad.addColorStop(1, '#0B6BB6');
  ctx.fillStyle = grad;
  ctx.fill();

  // Subtle gloss highlight in upper half
  const glossGrad = ctx.createLinearGradient(0, 0, 0, size * 0.45);
  glossGrad.addColorStop(0, 'rgba(255, 255, 255, 0.25)');
  glossGrad.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
  ctx.fillStyle = glossGrad;
  ctx.fill();

  // Inner border stroke
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
  ctx.lineWidth = size * 0.02;
  ctx.stroke();

  // Clip to squircle for the artwork
  ctx.save();
  ctx.clip();

  // Scale factor from 100 viewBox to canvas size
  const s = size / 100;

  // 1. Upper triangular peak and solid right leg of letter 'A'
  ctx.beginPath();
  ctx.moveTo(50.5 * s, 15.5 * s);
  ctx.lineTo(94.5 * s, 94 * s);
  ctx.lineTo(81.5 * s, 94 * s);
  ctx.lineTo(68 * s, 73 * s);
  ctx.bezierCurveTo(55.5 * s, 67.5 * s, 41 * s, 61.5 * s, 30.5 * s, 51 * s);
  ctx.closePath();
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();

  // 2. Middle dynamic wave swoosh
  ctx.beginPath();
  ctx.moveTo(30.5 * s, 61 * s);
  ctx.bezierCurveTo(42 * s, 67 * s, 54 * s, 71.5 * s, 68 * s, 73.5 * s);
  ctx.lineTo(66 * s, 79 * s);
  ctx.bezierCurveTo(51 * s, 77 * s, 38 * s, 72 * s, 28 * s, 66 * s);
  ctx.closePath();
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();

  // 3. Lower white arch sweeping over rising sun
  ctx.beginPath();
  ctx.moveTo(6.5 * s, 94 * s);
  ctx.bezierCurveTo(12 * s, 77.5 * s, 26 * s, 64.5 * s, 46 * s, 64.5 * s);
  ctx.bezierCurveTo(60 * s, 64.5 * s, 72.5 * s, 72.5 * s, 79.5 * s, 94 * s);
  ctx.lineTo(69.5 * s, 94 * s);
  ctx.bezierCurveTo(64.5 * s, 79.5 * s, 56.5 * s, 74.5 * s, 46 * s, 74.5 * s);
  ctx.bezierCurveTo(34 * s, 74.5 * s, 23 * s, 82.5 * s, 17 * s, 94 * s);
  ctx.closePath();
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();

  // 4. Terracotta / Warm Coral Rising Sun Dome
  ctx.beginPath();
  ctx.moveTo(25 * s, 94 * s);
  ctx.bezierCurveTo(25 * s, 79 * s, 75 * s, 79 * s, 75 * s, 94 * s);
  ctx.closePath();
  ctx.fillStyle = '#CB4E2A';
  ctx.fill();

  ctx.restore();

  return canvas;
}

/**
 * Creates soft radial contact shadow texture.
 */
function createContactShadowCanvas(size = 256): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.65)');
  grad.addColorStop(0.35, 'rgba(2, 6, 23, 0.35)');
  grad.addColorStop(0.7, 'rgba(2, 6, 23, 0.1)');
  grad.addColorStop(1, 'rgba(2, 6, 23, 0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  return canvas;
}

/**
 * Creates subtle particle texture.
 */
function createSparkleTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.3, 'rgba(56, 189, 248, 0.8)');
    grad.addColorStop(0.7, 'rgba(30, 138, 213, 0.2)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export const ThreeDLogoLoader: React.FC<ThreeDLogoLoaderProps> = ({
  statusText = 'Memverifikasi sesi Hostinger...',
  subText = 'Autentikasi diperiksa langsung ke backend sebelum aplikasi dibuka.'
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hasWebGLSupport, setHasWebGLSupport] = useState<boolean>(true);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Detect WebGL capability safely
    let glProbe: WebGLRenderingContext | null = null;
    try {
      const probeCanvas = document.createElement('canvas');
      glProbe = probeCanvas.getContext('webgl2') || probeCanvas.getContext('webgl');
      if (!glProbe) {
        setHasWebGLSupport(false);
        return;
      }
    } catch {
      setHasWebGLSupport(false);
      return;
    }

    const isSoftwareGl = (() => {
      try {
        const gl = document.createElement('canvas').getContext('webgl2');
        if (!gl) return true;
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
        const gpu = String(gl.getParameter(param));
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return false;
      }
    })();

    // Scene setup
    const scene = new THREE.Scene();

    const width = container.clientWidth || 360;
    const height = container.clientHeight || 360;

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    camera.position.set(0, 0.4, 5.2);
    camera.lookAt(0, 0, 0);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        alpha: true,
        powerPreference: 'high-performance'
      });
    } catch {
      setHasWebGLSupport(false);
      return;
    }

    renderer.setSize(width, height);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.appendChild(renderer.domElement);

    // Group for the entire 3D subject
    const subjectGroup = new THREE.Group();
    scene.add(subjectGroup);

    // 1. Prepare Logo Textures
    const emblemCanvas = createAkkEmblemCanvas(512);
    const emblemTexture = new THREE.CanvasTexture(emblemCanvas);
    emblemTexture.colorSpace = THREE.SRGBColorSpace;
    emblemTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();

    // 2. Extruded 3D Rounded Squircle Shape for Badge
    const shape = new THREE.Shape();
    const w = 1.75;
    const h = 1.75;
    const r = 0.38;
    shape.moveTo(-w / 2 + r, -h / 2);
    shape.lineTo(w / 2 - r, -h / 2);
    shape.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
    shape.lineTo(w / 2, h / 2 - r);
    shape.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
    shape.lineTo(-w / 2 + r, h / 2);
    shape.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
    shape.lineTo(-w / 2, -h / 2 + r);
    shape.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);

    const extrudeSettings: THREE.ExtrudeGeometryOptions = {
      steps: 1,
      depth: 0.18,
      bevelEnabled: true,
      bevelThickness: 0.05,
      bevelSize: 0.05,
      bevelSegments: 4
    };

    const badgeGeo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    badgeGeo.center();

    // Materials:
    // Front face (Index 0 in ExtrudeGeometry) & Side bevels (Index 1)
    const rimMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x09528f,
      metalness: 0.85,
      roughness: 0.22,
      clearcoat: 0.9,
      clearcoatRoughness: 0.1
    });

    const sideMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xd97706, // Polished warm amber/gold edge accent
      metalness: 0.9,
      roughness: 0.25,
      clearcoat: 0.8
    });

    const badgeMesh = new THREE.Mesh(badgeGeo, [rimMaterial, sideMaterial]);
    subjectGroup.add(badgeMesh);

    // Front & Back emblem decal planes
    const facePlaneGeo = new THREE.PlaneGeometry(1.85, 1.85);
    const faceMaterial = new THREE.MeshBasicMaterial({
      map: emblemTexture,
      transparent: true,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1
    });

    const frontFaceMesh = new THREE.Mesh(facePlaneGeo, faceMaterial);
    frontFaceMesh.position.z = 0.145;
    subjectGroup.add(frontFaceMesh);

    const backFaceMesh = new THREE.Mesh(facePlaneGeo, faceMaterial);
    backFaceMesh.position.z = -0.145;
    backFaceMesh.rotation.y = Math.PI;
    subjectGroup.add(backFaceMesh);

    // Outer decorative orbital rings (Torus)
    const ringGeo1 = new THREE.TorusGeometry(1.65, 0.022, 16, 64);
    const ringMat1 = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      metalness: 0.8,
      roughness: 0.2,
      emissive: 0x0369a1,
      emissiveIntensity: 0.4
    });
    const ringMesh1 = new THREE.Mesh(ringGeo1, ringMat1);
    ringMesh1.rotation.x = Math.PI / 3;
    subjectGroup.add(ringMesh1);

    const ringGeo2 = new THREE.TorusGeometry(1.82, 0.015, 16, 64);
    const ringMat2 = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      metalness: 0.85,
      roughness: 0.2,
      emissive: 0xb45309,
      emissiveIntensity: 0.4
    });
    const ringMesh2 = new THREE.Mesh(ringGeo2, ringMat2);
    ringMesh2.rotation.y = Math.PI / 4;
    ringMesh2.rotation.x = -Math.PI / 4;
    subjectGroup.add(ringMesh2);

    // Sparkle particles orbiting
    const particleCount = 28;
    const particleGeo = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    const particleSpeeds = new Float32Array(particleCount);
    const particleRadii = new Float32Array(particleCount);
    const particleAngles = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
      const radius = 1.9 + Math.random() * 0.7;
      const angle = Math.random() * Math.PI * 2;
      particleRadii[i] = radius;
      particleAngles[i] = angle;
      particleSpeeds[i] = 0.4 + Math.random() * 0.6;

      particlePositions[i * 3] = Math.cos(angle) * radius;
      particlePositions[i * 3 + 1] = (Math.random() - 0.5) * 1.2;
      particlePositions[i * 3 + 2] = Math.sin(angle) * radius;
    }

    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    const sparkleTexture = createSparkleTexture();
    const particleMat = new THREE.PointsMaterial({
      size: 0.12,
      map: sparkleTexture,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const particleSystem = new THREE.Points(particleGeo, particleMat);
    scene.add(particleSystem);

    // Contact shadow plane beneath badge
    const shadowCanvas = createContactShadowCanvas(256);
    const shadowTexture = new THREE.CanvasTexture(shadowCanvas);
    const shadowGeo = new THREE.PlaneGeometry(3.6, 3.6);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: shadowTexture,
      transparent: true,
      opacity: 0.5,
      depthWrite: false
    });
    const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    shadowMesh.rotation.x = -Math.PI / 2;
    shadowMesh.position.y = -1.6;
    scene.add(shadowMesh);

    // Lighting Rig
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    scene.add(ambientLight);

    const dirLightKey = new THREE.DirectionalLight(0xfff5ea, 2.4);
    dirLightKey.position.set(3, 4, 4);
    scene.add(dirLightKey);

    const dirLightRim = new THREE.DirectionalLight(0x38bdf8, 2.0);
    dirLightRim.position.set(-3, -2, -3);
    scene.add(dirLightRim);

    const dirLightTop = new THREE.DirectionalLight(0x60a5fa, 1.4);
    dirLightTop.position.set(0, 5, 1);
    scene.add(dirLightTop);

    // Interactive pointer parallax
    let targetRotationX = 0;
    let targetRotationY = 0;
    const handlePointerMove = (e: MouseEvent | TouchEvent) => {
      let clientX = 0;
      let clientY = 0;
      if ('touches' in e && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else if ('clientX' in e) {
        clientX = e.clientX;
        clientY = e.clientY;
      }
      const rect = container.getBoundingClientRect();
      const x = ((clientX - rect.left) / rect.width) * 2 - 1;
      const y = -(((clientY - rect.top) / rect.height) * 2 - 1);
      targetRotationY = x * 0.35;
      targetRotationX = -y * 0.25;
    };

    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('touchmove', handlePointerMove, { passive: true });

    // Handle Window Resize
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || 360;
      const h = container.clientHeight || 360;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // Animation Loop
    let animationFrameId = 0;
    let clock = new THREE.Clock();

    const animate = () => {
      const delta = clock.getDelta();
      const elapsedTime = clock.getElapsedTime();

      // Continuous 3D spin and levitation
      subjectGroup.rotation.y += delta * 1.4;
      subjectGroup.position.y = Math.sin(elapsedTime * 2.2) * 0.12;

      // Subtle natural precessional tilt + pointer parallax damping
      const targetTiltZ = Math.cos(elapsedTime * 1.5) * 0.08;
      const targetTiltX = Math.sin(elapsedTime * 1.8) * 0.06 + targetRotationX;
      subjectGroup.rotation.z += (targetTiltZ - subjectGroup.rotation.z) * 0.08;
      subjectGroup.rotation.x += (targetTiltX - subjectGroup.rotation.x) * 0.08;

      // Counter-rotate orbital rings
      ringMesh1.rotation.z -= delta * 0.9;
      ringMesh2.rotation.x += delta * 0.8;

      // Orbit particles
      const posAttr = particleGeo.getAttribute('position') as THREE.BufferAttribute;
      const positions = posAttr.array as Float32Array;
      for (let i = 0; i < particleCount; i++) {
        particleAngles[i] += delta * particleSpeeds[i] * 0.8;
        const rad = particleRadii[i];
        positions[i * 3] = Math.cos(particleAngles[i]) * rad;
        positions[i * 3 + 2] = Math.sin(particleAngles[i]) * rad;
      }
      posAttr.needsUpdate = true;

      // Subtle shadow scale pulsation with float
      const shadowScale = 1 - subjectGroup.position.y * 0.4;
      shadowMesh.scale.set(shadowScale, shadowScale, shadowScale);

      renderer.render(scene, camera);
      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    // Cleanup on unmount
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('touchmove', handlePointerMove);
      window.removeEventListener('resize', handleResize);

      badgeGeo.dispose();
      facePlaneGeo.dispose();
      ringGeo1.dispose();
      ringGeo2.dispose();
      particleGeo.dispose();
      shadowGeo.dispose();

      rimMaterial.dispose();
      sideMaterial.dispose();
      faceMaterial.dispose();
      ringMat1.dispose();
      ringMat2.dispose();
      particleMat.dispose();
      shadowMat.dispose();

      emblemTexture.dispose();
      sparkleTexture.dispose();
      shadowTexture.dispose();

      renderer.dispose();
      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div className="flex flex-col items-center justify-center text-center select-none max-w-sm px-4">
      {/* 3D Scene Container */}
      <div className="relative w-64 h-64 sm:w-72 sm:h-72 flex items-center justify-center">
        {hasWebGLSupport ? (
          <div ref={containerRef} className="w-full h-full flex items-center justify-center" />
        ) : (
          /* Graceful CSS 3D Fallback if WebGL is unavailable */
          <div className="relative w-36 h-36 flex items-center justify-center perspective-1000">
            <div className="w-32 h-32 rounded-3xl bg-gradient-to-br from-[#1E8AD5] to-[#0B6BB6] p-4 shadow-2xl shadow-blue-500/30 animate-[spin_6s_linear_infinite] flex items-center justify-center border-2 border-amber-400/40">
              <svg viewBox="0 0 100 100" fill="none" className="w-full h-full drop-shadow">
                <path
                  d="M 50.5 15.5 L 94.5 94 L 81.5 94 L 68 73 C 55.5 67.5, 41 61.5, 30.5 51 Z"
                  fill="#FFFFFF"
                />
                <path
                  d="M 30.5 61 C 42 67, 54 71.5, 68 73.5 L 66 79 C 51 77, 38 72, 28 66 Z"
                  fill="#FFFFFF"
                />
                <path
                  d="M 6.5 94 C 12 77.5, 26 64.5, 46 64.5 C 60 64.5, 72.5 72.5, 79.5 94 L 69.5 94 C 64.5 79.5, 56.5 74.5, 46 74.5 C 34 74.5, 23 82.5, 17 94 Z"
                  fill="#FFFFFF"
                />
                <path d="M 25 94 C 25 79, 75 79, 75 94 Z" fill="#CB4E2A" />
              </svg>
            </div>
          </div>
        )}

        {/* Ambient Glow Aura */}
        <div className="absolute inset-0 -z-10 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />
      </div>

      {/* Brand & Loading Status Information */}
      <div className="mt-2 flex flex-col items-center gap-1.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold tracking-tight text-white uppercase">ANUGRAH</span>
          <span className="text-[11px] font-bold tracking-wider text-amber-400 uppercase">
            KEMASAN KREATIF
          </span>
        </div>

        <div className="text-sm font-semibold text-slate-200 mt-1">{statusText}</div>
        <div className="text-xs text-slate-400 max-w-xs leading-relaxed">{subText}</div>

        {/* Sleek Progress Indeterminate Bar */}
        <div className="w-48 h-1 bg-slate-800 rounded-full overflow-hidden mt-3 relative">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-500 to-amber-400 w-1/2 rounded-full animate-[shimmer_1.5s_infinite]" />
        </div>
      </div>
    </div>
  );
};
