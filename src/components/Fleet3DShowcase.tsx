import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import {
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Box as BoxIcon,
  Eye,
  DoorOpen,
  Play,
  Pause,
  Edit3,
  ShieldCheck,
  AlertTriangle,
  Clock,
  Fuel,
  Gauge,
  Wrench,
  FileText,
  X,
  Truck,
  Camera,
  Upload,
  Trash2,
  Maximize2,
  Search,
  Image as ImageIcon,
  Layers,
} from 'lucide-react';
import { Crew, Fleet, FleetAngleKey, FleetAnglePhotos } from '../types';
import { logisticsStore } from '../services/store';
import { branchStore } from '../services/branchStore';
import { buildProceduralTruck, disposeBuiltTruck, BuiltTruckRig } from '../utils/truck3dBuilder';

type CameraPresetId = 'hero' | FleetAngleKey;
type HotspotId = 'cab' | 'cargo' | 'chassis';

const ANGLE_CONFIG: Array<{
  key: FleetAngleKey;
  label: string;
  shortLabel: string;
  hint: string;
}> = [
  { key: 'front', label: 'Tampak Depan', shortLabel: 'Depan', hint: 'Grille, lampu, kaca depan & plat nomor' },
  { key: 'rear', label: 'Tampak Belakang', shortLabel: 'Belakang', hint: 'Pintu box belakang, pengunci & lampu rem' },
  { key: 'right', label: 'Samping Kanan', shortLabel: 'Kanan', hint: 'Sisi kanan kabin, tangki & dinding box' },
  { key: 'left', label: 'Samping Kiri', shortLabel: 'Kiri', hint: 'Sisi kiri kabin, aki & dinding box' },
  { key: 'top', label: 'Tampak Atas', shortLabel: 'Atas', hint: 'Atap box, deflektor angin & seal atas' },
  { key: 'cab', label: 'Interior Kabin', shortLabel: 'Kabin', hint: 'Dashboard, setir, kursi & kondisi kabin' },
];

interface Fleet3DShowcaseProps {
  fleets: Fleet[];
  crews: Crew[];
  selectedFleetId?: string | null;
  onSelectFleetId?: (fleetId: string) => void;
  onToggleFleetStatus: (fleet: Fleet) => void;
  onEditFleet: (fleet: Fleet) => void;
  onUpdateFleetPhotos: (fleetId: string, photos3d: FleetAnglePhotos) => void;
  onViewKirDoc?: (fleet: Fleet) => void;
  getBoxCapacityM3: (fleet: Fleet) => number;
  getBoxDimensions: (fleet: Fleet) => string;
  formatIndoDate: (dateStr?: string) => string;
  getExpiryStatus: (dateStr?: string, defaultDaysWarn?: number) => {
    label: string;
    color: string;
    isExpired: boolean;
    isNear: boolean;
    diffDays: number;
  };
}

function createStudioBackdropTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, '#eef3f9');
    grad.addColorStop(0.58, '#f7f9fc');
    grad.addColorStop(1, '#e5ecf4');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(128, 128, 18, 128, 128, 126);
    grad.addColorStop(0, 'rgba(15, 23, 42, 0.32)');
    grad.addColorStop(0.45, 'rgba(15, 23, 42, 0.14)');
    grad.addColorStop(0.8, 'rgba(15, 23, 42, 0.04)');
    grad.addColorStop(1, 'rgba(15, 23, 42, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

async function compressFleetPhotoFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Gagal membaca file gambar.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Format gambar tidak valid.'));
      img.onload = () => {
        const maxDim = 1024;
        let w = img.width;
        let h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w >= h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(String(reader.result || ''));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        const compressed = canvas.toDataURL('image/jpeg', 0.8);
        resolve(compressed);
      };
      img.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
  });
}

export const Fleet3DShowcase: React.FC<Fleet3DShowcaseProps> = ({
  fleets,
  crews,
  selectedFleetId,
  onSelectFleetId,
  onToggleFleetStatus,
  onEditFleet,
  onUpdateFleetPhotos,
  onViewKirDoc,
  getBoxCapacityM3,
  getBoxDimensions,
  formatIndoDate,
  getExpiryStatus,
}) => {
  const stageContainerRef = useRef<HTMLDivElement | null>(null);
  const canvasMountRef = useRef<HTMLDivElement | null>(null);

  const hotspotElRefs = useRef<Record<HotspotId, HTMLButtonElement | null>>({
    cab: null,
    cargo: null,
    chassis: null,
  });

  const [internalFleetId, setInternalFleetId] = useState<string>(() => {
    if (selectedFleetId && fleets.some((f) => f.id === selectedFleetId)) return selectedFleetId;
    return fleets[0]?.id || '';
  });

  useEffect(() => {
    if (selectedFleetId && fleets.some((f) => f.id === selectedFleetId)) {
      setInternalFleetId(selectedFleetId);
    } else if (!fleets.some((f) => f.id === internalFleetId) && fleets[0]) {
      setInternalFleetId(fleets[0].id);
    }
  }, [selectedFleetId, fleets, internalFleetId]);

  const currentIndex = useMemo(() => {
    const idx = fleets.findIndex((f) => f.id === internalFleetId);
    return idx >= 0 ? idx : 0;
  }, [fleets, internalFleetId]);

  const activeFleet = fleets[currentIndex] || null;

  const selectFleetByIndex = useCallback(
    (nextIndex: number) => {
      if (fleets.length === 0) return;
      const wrapped = ((nextIndex % fleets.length) + fleets.length) % fleets.length;
      const target = fleets[wrapped];
      if (target) {
        setInternalFleetId(target.id);
        onSelectFleetId?.(target.id);
        setActiveHotspot(null);
      }
    },
    [fleets, onSelectFleetId]
  );

  const [sidebarQuery, setSidebarQuery] = useState<string>('');
  const sidebarFleets = useMemo(() => {
    const q = sidebarQuery.trim().toLowerCase();
    if (!q) return fleets;
    return fleets.filter(
      (f) =>
        (f.plateNumber || '').toLowerCase().includes(q) ||
        (f.initialCode || '').toLowerCase().includes(q) ||
        (f.vehicleType || '').toLowerCase().includes(q) ||
        (f.brand || '').toLowerCase().includes(q)
    );
  }, [fleets, sidebarQuery]);

  // Interactive viewer & upload states
  const [cameraPreset, setCameraPreset] = useState<CameraPresetId>('hero');
  const [doorsOpen, setDoorsOpen] = useState<boolean>(false);
  const [xrayBox, setXrayBox] = useState<boolean>(false);
  const [autoRotate, setAutoRotate] = useState<boolean>(false);
  const [usePhotoTextures, setUsePhotoTextures] = useState<boolean>(true);
  const [activeHotspot, setActiveHotspot] = useState<HotspotId | null>(null);
  const [webglError, setWebglError] = useState<string | null>(null);
  const [uploadingAngle, setUploadingAngle] = useState<FleetAngleKey | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [lightboxAngle, setLightboxAngle] = useState<FleetAngleKey | null>(null);

  const fileInputRefs = useRef<Record<FleetAngleKey, HTMLInputElement | null>>({
    front: null,
    rear: null,
    right: null,
    left: null,
    top: null,
    cab: null,
  });

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && target.closest('input, select, textarea')) return;
      if (e.key === 'Escape' && lightboxAngle) {
        setLightboxAngle(null);
        return;
      }
      if (e.key === 'ArrowLeft') {
        selectFleetByIndex(currentIndex - 1);
      } else if (e.key === 'ArrowRight') {
        selectFleetByIndex(currentIndex + 1);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [currentIndex, selectFleetByIndex, lightboxAngle]);

  const handlePhotoFileChange = async (angle: FleetAngleKey, fileList: FileList | null) => {
    const file = fileList?.[0];
    if (!file || !activeFleet) return;
    setPhotoError(null);
    setUploadingAngle(angle);
    try {
      const compressedUrl = await compressFleetPhotoFile(file);
      const nextPhotos: FleetAnglePhotos = {
        ...(activeFleet.photos3d || {}),
        [angle]: compressedUrl,
      };
      onUpdateFleetPhotos(activeFleet.id, nextPhotos);
      // Automatically rotate 3D preview to uploaded angle so operator can inspect immediately
      setActiveHotspot(null);
      setCameraPreset(angle);
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : 'Gagal memproses foto armada.');
    } finally {
      setUploadingAngle(null);
      const inputEl = fileInputRefs.current[angle];
      if (inputEl) inputEl.value = '';
    }
  };

  const handleDeleteAnglePhoto = (angle: FleetAngleKey) => {
    if (!activeFleet) return;
    const nextPhotos: FleetAnglePhotos = { ...(activeFleet.photos3d || {}) };
    delete nextPhotos[angle];
    onUpdateFleetPhotos(activeFleet.id, nextPhotos);
    if (lightboxAngle === angle) setLightboxAngle(null);
  };

  const telemetry = useMemo(() => {
    if (!activeFleet) return null;

    const liveInfo = logisticsStore.getFleetLiveOperationalInfo(activeFleet);
    const assignedCrew = crews.find(
      (c) => c.currentFleetId === activeFleet.id || (activeFleet.driverId && c.id === activeFleet.driverId)
    );
    const driverName = assignedCrew?.name || liveInfo.driverName || 'Belum Dipasangkan';
    const boxM3 = getBoxCapacityM3(activeFleet);
    const boxDim = activeFleet.boxDimensions || getBoxDimensions(activeFleet);
    const boxMult = activeFleet.boxInnerMultiplierPercent ?? 90;
    const innerM3 = activeFleet.boxInnerCapacityM3 ?? Number((boxM3 * (boxMult / 100)).toFixed(2));

    const branch = branchStore.getFleetBranch(activeFleet.id);
    const originName = branch?.name ? `Cabang ${branch.name}` : 'Gudang Pusat AKK';
    const destinationArea =
      liveInfo.areaName ||
      liveInfo.todayScheduledArea ||
      liveInfo.tomorrowScheduledArea ||
      'Standby Pool Gudang';

    const devices = logisticsStore.getDevices();
    const cleanPlate = (activeFleet.plateNumber || '').replace(/\s+/g, '').toUpperCase();
    const matchedDevice = devices.find((d) => {
      const dPlate = (d.vehiclePlate || '').replace(/\s+/g, '').toUpperCase();
      return (
        (activeFleet.gpsImei && d.imei === activeFleet.gpsImei) ||
        (cleanPlate && dPlate === cleanPlate)
      );
    });

    const fuelSummaries = logisticsStore.getFleetFuelSummary();
    const matchedFuel = fuelSummaries.find(
      (fs) =>
        fs.fleetId === activeFleet.id ||
        (fs.plateNumber || '').replace(/\s+/g, '').toUpperCase() === cleanPlate
    );

    const vTypeLower = (activeFleet.vehicleType || '').toLowerCase();
    const fallbackKmL = vTypeLower.includes('pick up')
      ? 9.4
      : vTypeLower.includes('engkel')
      ? 7.8
      : vTypeLower.includes('double')
      ? 6.4
      : 5.5;
    const avgKmL =
      matchedFuel && matchedFuel.avgKmPerLiter > 0
        ? Number(matchedFuel.avgKmPerLiter.toFixed(1))
        : fallbackKmL;
    const tankLiters = vTypeLower.includes('pick up') ? 45 : vTypeLower.includes('engkel') ? 75 : 100;
    const fuelPct =
      activeFleet.fuelLevelPercent !== undefined
        ? activeFleet.fuelLevelPercent
        : liveInfo.effectiveStatus === 'on-duty'
        ? 68
        : 84;
    const estRangeKm = Math.round(((tankLiters * fuelPct) / 100) * avgKmL);

    const routine = logisticsStore.getFleetRoutineComponentsStatus(activeFleet.id);
    const kirDate = activeFleet.lastMaintenance || activeFleet.kirExpiryDate;
    const taxStatus = getExpiryStatus(activeFleet.taxDueDate);
    const stnkStatus = getExpiryStatus(activeFleet.stnkExpiryDate);
    const kirStatus = getExpiryStatus(kirDate);

    return {
      liveInfo,
      assignedCrew,
      driverName,
      boxM3,
      innerM3,
      boxMult,
      boxDim,
      originName,
      destinationArea,
      matchedDevice,
      avgKmL,
      fuelPct,
      estRangeKm,
      routine,
      kirDate,
      taxStatus,
      stnkStatus,
      kirStatus,
    };
  }, [activeFleet, crews, getBoxCapacityM3, getBoxDimensions, getExpiryStatus]);

  const stateRef = useRef({
    doorsOpen: false,
    xrayBox: false,
    autoRotate: false,
    isRolling: false,
    cameraPreset: 'hero' as CameraPresetId,
    activeHotspot: null as HotspotId | null,
  });

  const engineRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    controls: OrbitControls;
    truckRig: BuiltTruckRig | null;
    targetCamPos: THREE.Vector3 | null;
    targetLookAt: THREE.Vector3 | null;
    doorAngle: number;
    xrayAlpha: number;
    isSoftwareGl: boolean;
    maxAnisotropy: number;
    requestRender: () => void;
    applyCameraGoal: (preset: CameraPresetId, hotspot: HotspotId | null) => void;
  } | null>(null);

  useEffect(() => {
    stateRef.current.doorsOpen = doorsOpen;
    stateRef.current.xrayBox = xrayBox;
    stateRef.current.autoRotate = autoRotate;
    stateRef.current.isRolling = telemetry?.liveInfo.effectiveStatus === 'on-duty';
    if (engineRef.current) {
      engineRef.current.controls.autoRotate = autoRotate;
      engineRef.current.requestRender();
    }
  }, [doorsOpen, xrayBox, autoRotate, telemetry?.liveInfo.effectiveStatus]);

  useEffect(() => {
    stateRef.current.cameraPreset = cameraPreset;
    stateRef.current.activeHotspot = activeHotspot;
    engineRef.current?.applyCameraGoal(cameraPreset, activeHotspot);
  }, [cameraPreset, activeHotspot]);

  // Mount Three.js Studio Scene ONCE
  useEffect(() => {
    const mount = canvasMountRef.current;
    if (!mount) return;

    let renderer: THREE.WebGLRenderer | null = null;
    let controls: OrbitControls | null = null;
    let pmremGenerator: THREE.PMREMGenerator | null = null;
    let envRenderTarget: THREE.WebGLRenderTarget | null = null;
    let roomEnvironment: RoomEnvironment | null = null;
    let rafId = 0;
    let resizeObserver: ResizeObserver | null = null;
    let disposed = false;

    const sceneDisposables: {
      geometries: THREE.BufferGeometry[];
      materials: THREE.Material[];
      textures: THREE.Texture[];
    } = { geometries: [], materials: [], textures: [] };

    try {
      const width = Math.max(320, mount.clientWidth || 840);
      const height = Math.max(360, mount.clientHeight || 520);

      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance',
      });

      const gl = renderer.getContext();
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      const glRendererName = debugInfo
        ? String(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || '')
        : '';
      const isSoftwareGl = /swiftshader|llvmpipe|software|mesa offscreen/i.test(glRendererName);

      renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(width, height);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.08;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = isSoftwareGl ? THREE.BasicShadowMap : THREE.PCFSoftShadowMap;

      renderer.domElement.style.display = 'block';
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
      mount.appendChild(renderer.domElement);

      const handleContextLost = (e: Event) => {
        e.preventDefault();
        setWebglError('Konteks WebGL terhenti sementara. Muat ulang tampilan 3D untuk memulihkan.');
      };
      renderer.domElement.addEventListener('webglcontextlost', handleContextLost, false);

      const scene = new THREE.Scene();
      const bgTex = createStudioBackdropTexture();
      sceneDisposables.textures.push(bgTex);
      scene.background = bgTex;
      scene.fog = new THREE.Fog(0xedf2f8, 18, 42);

      pmremGenerator = new THREE.PMREMGenerator(renderer);
      pmremGenerator.compileEquirectangularShader();
      roomEnvironment = new RoomEnvironment();
      envRenderTarget = pmremGenerator.fromScene(roomEnvironment, 0.04);
      scene.environment = envRenderTarget.texture;

      const camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 100);
      camera.position.set(6.4, 2.55, 6.2);

      controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.07;
      controls.enablePan = true;
      controls.minDistance = 3.0;
      controls.maxDistance = 16.0;
      controls.minPolarAngle = 0.14;
      controls.maxPolarAngle = Math.PI / 2 - 0.04;
      controls.target.set(-0.45, 1.05, 0);
      controls.autoRotateSpeed = 1.35;

      // Lighting
      const hemiLight = new THREE.HemisphereLight(0xf8fafc, 0xcbd5e1, 0.92);
      hemiLight.position.set(0, 14, 0);
      scene.add(hemiLight);

      const keyLight = new THREE.DirectionalLight(0xfffaf0, 2.0);
      keyLight.position.set(6.5, 9.5, 6.2);
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.set(isSoftwareGl ? 512 : 1024, isSoftwareGl ? 512 : 1024);
      keyLight.shadow.camera.near = 1;
      keyLight.shadow.camera.far = 26;
      keyLight.shadow.camera.left = -5.8;
      keyLight.shadow.camera.right = 5.8;
      keyLight.shadow.camera.top = 5.8;
      keyLight.shadow.camera.bottom = -5.8;
      keyLight.shadow.bias = -0.0004;
      keyLight.shadow.normalBias = 0.02;
      scene.add(keyLight);

      const rimLight = new THREE.DirectionalLight(0xdbeafe, 0.95);
      rimLight.position.set(-7.0, 4.5, -5.5);
      scene.add(rimLight);

      if (!isSoftwareGl) {
        RectAreaLightUniformsLib.init();
        const topSoftbox = new THREE.RectAreaLight(0xffffff, 2.2, 8, 4);
        topSoftbox.position.set(0, 6.5, 1.0);
        topSoftbox.lookAt(0, 1.0, 0);
        scene.add(topSoftbox);
      }

      // Studio Floor & Contact Shadow
      const floorGeo = new THREE.CircleGeometry(20, 64);
      floorGeo.rotateX(-Math.PI / 2);
      sceneDisposables.geometries.push(floorGeo);
      const floorMat = new THREE.MeshStandardMaterial({
        color: 0xeaf0f6,
        roughness: 0.92,
        metalness: 0.02,
      });
      sceneDisposables.materials.push(floorMat);
      const floorMesh = new THREE.Mesh(floorGeo, floorMat);
      floorMesh.position.y = -0.004;
      floorMesh.receiveShadow = true;
      scene.add(floorMesh);

      const ringGeo = new THREE.RingGeometry(3.65, 3.69, 72);
      ringGeo.rotateX(-Math.PI / 2);
      sceneDisposables.geometries.push(ringGeo);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xcbd5e1,
        transparent: true,
        opacity: 0.65,
      });
      sceneDisposables.materials.push(ringMat);
      const studioRing = new THREE.Mesh(ringGeo, ringMat);
      studioRing.position.y = 0.001;
      scene.add(studioRing);

      const shadowTex = createContactShadowTexture();
      sceneDisposables.textures.push(shadowTex);
      const contactGeo = new THREE.PlaneGeometry(4.6, 7.6);
      contactGeo.rotateX(-Math.PI / 2);
      sceneDisposables.geometries.push(contactGeo);
      const contactMat = new THREE.MeshBasicMaterial({
        map: shadowTex,
        transparent: true,
        depthWrite: false,
        opacity: 0.9,
      });
      sceneDisposables.materials.push(contactMat);
      const contactShadow = new THREE.Mesh(contactGeo, contactMat);
      contactShadow.position.y = 0.002;
      scene.add(contactShadow);

      // Raycasting on click
      const raycaster = new THREE.Raycaster();
      const pointerDownPos = new THREE.Vector2();
      const onPointerDown = (ev: PointerEvent) => {
        pointerDownPos.set(ev.clientX, ev.clientY);
      };
      const onPointerUp = (ev: PointerEvent) => {
        const moveDist = Math.hypot(ev.clientX - pointerDownPos.x, ev.clientY - pointerDownPos.y);
        if (moveDist > 6 || !engineRef.current?.truckRig || !renderer) return;
        const rect = renderer.domElement.getBoundingClientRect();
        const ndc = new THREE.Vector2(
          ((ev.clientX - rect.left) / rect.width) * 2 - 1,
          -((ev.clientY - rect.top) / rect.height) * 2 + 1
        );
        raycaster.setFromCamera(ndc, camera);
        const hits = raycaster.intersectObject(engineRef.current.truckRig.root, true);
        if (hits.length > 0) {
          const hitPt = hits[0].point;
          let closestId: HotspotId = 'cargo';
          let bestDist = Infinity;
          engineRef.current.truckRig.hotspotAnchors.forEach((anc) => {
            const d = anc.localPosition.distanceTo(hitPt);
            if (d < bestDist) {
              bestDist = d;
              closestId = anc.id;
            }
          });
          setActiveHotspot((prev) => (prev === closestId ? null : closestId));
        }
      };
      renderer.domElement.addEventListener('pointerdown', onPointerDown);
      renderer.domElement.addEventListener('pointerup', onPointerUp);

      const onControlStart = () => {
        if (engineRef.current) {
          engineRef.current.targetCamPos = null;
          engineRef.current.targetLookAt = null;
        }
      };
      controls.addEventListener('start', onControlStart);

      const clock = new THREE.Clock();
      let renderRequested = false;

      const updateProjectedHotspots = () => {
        const eng = engineRef.current;
        if (!eng?.truckRig || !renderer) return;
        const w = renderer.domElement.clientWidth;
        const h = renderer.domElement.clientHeight;
        const worldPos = new THREE.Vector3();

        eng.truckRig.hotspotAnchors.forEach((anc) => {
          const btn = hotspotElRefs.current[anc.id];
          if (!btn) return;
          worldPos.copy(anc.localPosition);
          eng.truckRig!.root.localToWorld(worldPos);
          worldPos.project(camera);

          if (worldPos.z > 1 || worldPos.z < -1) {
            btn.style.opacity = '0';
            btn.style.pointerEvents = 'none';
            return;
          }
          const px = (worldPos.x * 0.5 + 0.5) * w;
          const py = (-worldPos.y * 0.5 + 0.5) * h;
          btn.style.opacity = '1';
          btn.style.pointerEvents = 'auto';
          btn.style.transform = `translate3d(${px}px, ${py}px, 0) translate(-50%, -50%)`;
        });
      };

      const stepAndRender = () => {
        renderRequested = false;
        if (disposed || !renderer || !controls) return;
        const dt = Math.min(clock.getDelta(), 0.05);
        const eng = engineRef.current;
        let needsAnotherFrame = false;

        if (eng) {
          if (eng.targetCamPos && eng.targetLookAt) {
            const lambda = 7;
            camera.position.x = THREE.MathUtils.damp(camera.position.x, eng.targetCamPos.x, lambda, dt);
            camera.position.y = THREE.MathUtils.damp(camera.position.y, eng.targetCamPos.y, lambda, dt);
            camera.position.z = THREE.MathUtils.damp(camera.position.z, eng.targetCamPos.z, lambda, dt);

            controls.target.x = THREE.MathUtils.damp(controls.target.x, eng.targetLookAt.x, lambda, dt);
            controls.target.y = THREE.MathUtils.damp(controls.target.y, eng.targetLookAt.y, lambda, dt);
            controls.target.z = THREE.MathUtils.damp(controls.target.z, eng.targetLookAt.z, lambda, dt);

            if (
              camera.position.distanceTo(eng.targetCamPos) < 0.02 &&
              controls.target.distanceTo(eng.targetLookAt) < 0.02
            ) {
              camera.position.copy(eng.targetCamPos);
              controls.target.copy(eng.targetLookAt);
              eng.targetCamPos = null;
              eng.targetLookAt = null;
            } else {
              needsAnotherFrame = true;
            }
          }

          if (eng.truckRig) {
            const targetDoor = stateRef.current.doorsOpen ? 2.05 : 0;
            if (Math.abs(eng.doorAngle - targetDoor) > 0.005) {
              eng.doorAngle = THREE.MathUtils.damp(eng.doorAngle, targetDoor, 8, dt);
              eng.truckRig.leftDoorPivot.rotation.y = -eng.doorAngle;
              eng.truckRig.rightDoorPivot.rotation.y = eng.doorAngle;
              needsAnotherFrame = true;
            }

            const targetXray = stateRef.current.xrayBox ? 0.22 : 1.0;
            if (Math.abs(eng.xrayAlpha - targetXray) > 0.005) {
              eng.xrayAlpha = THREE.MathUtils.damp(eng.xrayAlpha, targetXray, 8, dt);
              eng.truckRig.boxShellMeshes.forEach((m) => {
                const mat = m.material as THREE.MeshStandardMaterial;
                mat.transparent = eng.xrayAlpha < 0.99;
                mat.opacity = eng.xrayAlpha;
                mat.depthWrite = eng.xrayAlpha > 0.95;
                mat.needsUpdate = true;
              });
              needsAnotherFrame = true;
            }

            if (stateRef.current.isRolling) {
              eng.truckRig.wheelGroups.forEach((wg) => {
                wg.rotation.x += dt * 3.8;
              });
              needsAnotherFrame = true;
            }
          }
        }

        const controlsChanged = controls.update();
        if (controlsChanged || stateRef.current.autoRotate) {
          needsAnotherFrame = true;
        }

        renderer.render(scene, camera);

        if (
          isSoftwareGl &&
          typeof WebGL2RenderingContext !== 'undefined' &&
          gl instanceof WebGL2RenderingContext
        ) {
          const fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
          if (fence) {
            gl.flush();
            gl.deleteSync(fence);
          }
        }

        updateProjectedHotspots();

        if (needsAnotherFrame && !renderRequested) {
          renderRequested = true;
          rafId = requestAnimationFrame(stepAndRender);
        }
      };

      const requestRender = () => {
        if (disposed || renderRequested) return;
        renderRequested = true;
        rafId = requestAnimationFrame(stepAndRender);
      };

      controls.addEventListener('change', requestRender);

      const applyCameraGoal = (preset: CameraPresetId, hotspot: HotspotId | null) => {
        const eng = engineRef.current;
        if (!eng) return;
        const rig = eng.truckRig;
        const len = rig?.sizeMetrics.totalLength ?? 5.5;
        const hCenter = rig?.sizeMetrics.centerY ?? 1.15;

        if (hotspot && rig) {
          const anc = rig.hotspotAnchors.find((a) => a.id === hotspot);
          if (anc) {
            eng.targetCamPos = anc.cameraOffset.clone();
            eng.targetLookAt = anc.targetOffset.clone();
            requestRender();
            return;
          }
        }

        switch (preset) {
          case 'front':
            eng.targetCamPos = new THREE.Vector3(0.45, hCenter + 0.35, len * 1.15 + 1.0);
            eng.targetLookAt = new THREE.Vector3(0, hCenter, len * 0.15);
            break;
          case 'rear':
            eng.targetCamPos = new THREE.Vector3(0.75, hCenter + 0.55, -(len * 1.15 + 1.0));
            eng.targetLookAt = new THREE.Vector3(0, hCenter, -len * 0.15);
            break;
          case 'right':
            // Truck front is +Z, so truck's right-hand passenger/driver side is -X or +X? Wait: looking from +Z toward -Z, left hand of truck is +X and right hand of truck is -X; when viewed from side, standard right-profile faces +X
            eng.targetCamPos = new THREE.Vector3(len * 1.28 + 0.8, hCenter + 0.35, 0.1);
            eng.targetLookAt = new THREE.Vector3(0, hCenter, 0);
            break;
          case 'left':
            eng.targetCamPos = new THREE.Vector3(-(len * 1.28 + 0.8), hCenter + 0.35, 0.1);
            eng.targetLookAt = new THREE.Vector3(0, hCenter, 0);
            break;
          case 'cab':
            eng.targetCamPos = new THREE.Vector3(3.1, hCenter + 0.65, len * 0.95 + 0.4);
            eng.targetLookAt = new THREE.Vector3(0, hCenter + 0.1, len * 0.32);
            break;
          case 'top':
            eng.targetCamPos = new THREE.Vector3(0.15, len * 1.38 + 1.2, 0.35);
            eng.targetLookAt = new THREE.Vector3(0, hCenter * 0.5, 0);
            break;
          case 'hero':
          default:
            // Generous 3/4 framing so full truck fits comfortably with clear margin from left telemetry
            eng.targetCamPos = new THREE.Vector3(len * 1.18 + 0.85, hCenter + 1.25, len * 1.08 + 0.75);
            eng.targetLookAt = new THREE.Vector3(-0.55, hCenter * 0.92, -0.05);
            break;
        }
        requestRender();
      };

      engineRef.current = {
        scene,
        camera,
        renderer,
        controls,
        truckRig: null,
        targetCamPos: null,
        targetLookAt: null,
        doorAngle: 0,
        xrayAlpha: 1,
        isSoftwareGl,
        maxAnisotropy: renderer.capabilities.getMaxAnisotropy(),
        requestRender,
        applyCameraGoal,
      };

      resizeObserver = new ResizeObserver((entries) => {
        if (disposed || !renderer) return;
        const entry = entries[0];
        if (!entry) return;
        const w = Math.max(320, Math.floor(entry.contentRect.width));
        const h = Math.max(360, Math.floor(entry.contentRect.height));
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
        requestRender();
      });
      resizeObserver.observe(mount);

      if (!isSoftwareGl) {
        renderer.compile(scene, camera);
      }
      requestRender();

      return () => {
        disposed = true;
        cancelAnimationFrame(rafId);
        resizeObserver?.disconnect();
        controls?.removeEventListener('change', requestRender);
        controls?.removeEventListener('start', onControlStart);
        controls?.dispose();
        renderer?.domElement.removeEventListener('pointerdown', onPointerDown);
        renderer?.domElement.removeEventListener('pointerup', onPointerUp);
        renderer?.domElement.removeEventListener('webglcontextlost', handleContextLost);

        if (engineRef.current?.truckRig) {
          scene.remove(engineRef.current.truckRig.root);
          disposeBuiltTruck(engineRef.current.truckRig);
          engineRef.current.truckRig = null;
        }

        sceneDisposables.geometries.forEach((g) => g.dispose());
        sceneDisposables.materials.forEach((m) => m.dispose());
        sceneDisposables.textures.forEach((t) => t.dispose());

        envRenderTarget?.dispose();
        roomEnvironment?.dispose();
        pmremGenerator?.dispose();

        if (renderer) {
          renderer.dispose();
          if (renderer.domElement.parentNode === mount) {
            mount.removeChild(renderer.domElement);
          }
        }
        engineRef.current = null;
      };
    } catch (err) {
      setWebglError(
        err instanceof Error ? err.message : 'Browser tidak mendukung pratinjau 3D WebGL.'
      );
      return undefined;
    }
  }, []);

  // Rebuild truck mesh when fleet, status, or photos3d change
  const photosSignature = useMemo(() => {
    if (!activeFleet?.photos3d) return '';
    return JSON.stringify(activeFleet.photos3d);
  }, [activeFleet?.photos3d]);

  useEffect(() => {
    const eng = engineRef.current;
    if (!eng || !activeFleet) return;

    if (eng.truckRig) {
      eng.scene.remove(eng.truckRig.root);
      disposeBuiltTruck(eng.truckRig);
      eng.truckRig = null;
    }

    const boxM3 = getBoxCapacityM3(activeFleet);
    const effectiveStatus = telemetry?.liveInfo.effectiveStatus || activeFleet.status;
    const newRig = buildProceduralTruck(
      activeFleet,
      boxM3,
      effectiveStatus,
      eng.maxAnisotropy,
      usePhotoTextures,
      () => eng.requestRender()
    );
    eng.scene.add(newRig.root);
    eng.truckRig = newRig;
    eng.doorAngle = stateRef.current.doorsOpen ? 2.05 : 0;
    eng.xrayAlpha = stateRef.current.xrayBox ? 0.22 : 1.0;

    newRig.leftDoorPivot.rotation.y = -eng.doorAngle;
    newRig.rightDoorPivot.rotation.y = eng.doorAngle;
    newRig.boxShellMeshes.forEach((m) => {
      const mat = m.material as THREE.MeshStandardMaterial;
      mat.transparent = eng.xrayAlpha < 0.99;
      mat.opacity = eng.xrayAlpha;
      mat.depthWrite = eng.xrayAlpha > 0.95;
    });

    eng.applyCameraGoal(stateRef.current.cameraPreset, stateRef.current.activeHotspot);
    eng.requestRender();
  }, [
    activeFleet?.id,
    activeFleet?.vehicleType,
    activeFleet?.brand,
    activeFleet?.plateNumber,
    activeFleet?.initialCode,
    photosSignature,
    usePhotoTextures,
    telemetry?.liveInfo.effectiveStatus,
    getBoxCapacityM3,
  ]);

  if (!activeFleet || !telemetry) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center text-slate-400">
        <Truck className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-60" />
        <p className="font-semibold text-slate-300">Tidak ada armada untuk ditampilkan dalam 3D</p>
        <p className="text-[11px] text-slate-500 mt-1">Ubah filter armada untuk melihat pratinjau 3D studio.</p>
      </div>
    );
  }

  const {
    liveInfo,
    assignedCrew,
    driverName,
    boxM3,
    innerM3,
    boxMult,
    boxDim,
    originName,
    destinationArea,
    matchedDevice,
    avgKmL,
    fuelPct,
    estRangeKm,
    routine,
    kirDate,
    taxStatus,
    stnkStatus,
    kirStatus,
  } = telemetry;

  const hasExpiredDoc = taxStatus.isExpired || stnkStatus.isExpired || kirStatus.isExpired;
  const hasNearDoc = taxStatus.isNear || stnkStatus.isNear || kirStatus.isNear;
  const driverInitials =
    driverName !== 'Belum Dipasangkan'
      ? driverName
          .split(' ')
          .filter(Boolean)
          .slice(0, 2)
          .map((w) => w[0]?.toUpperCase() || '')
          .join('')
      : '—';

  const statusTone =
    liveInfo.effectiveStatus === 'on-duty'
      ? 'bg-blue-50 text-blue-700 border-blue-200'
      : liveInfo.effectiveStatus === 'maintenance'
      ? 'bg-rose-50 text-rose-700 border-rose-200'
      : 'bg-emerald-50 text-emerald-700 border-emerald-200';

  const activePhotos = activeFleet.photos3d || {};
  const uploadedPhotoCount = ANGLE_CONFIG.filter((a) => Boolean(activePhotos[a.key])).length;
  const currentAnglePhoto =
    cameraPreset !== 'hero' ? activePhotos[cameraPreset as FleetAngleKey] : undefined;
  const currentAngleMeta =
    cameraPreset !== 'hero' ? ANGLE_CONFIG.find((a) => a.key === cameraPreset) : undefined;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[275px_minmax(0,1fr)] gap-4 items-start">
      {/* SEPARATE LEFT PANEL: DAFTAR ARMADA (Completely separate outside the 3D canvas) */}
      <aside className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm flex flex-col lg:max-h-[780px]">
        <div className="p-3.5 border-b border-slate-800 bg-slate-950/70 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Truck className="w-4 h-4 text-blue-400" />
              <span className="text-xs font-black uppercase tracking-wider text-white">
                Daftar Armada
              </span>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-blue-500/15 text-blue-300 border border-blue-500/30">
              {fleets.length} Unit
            </span>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={sidebarQuery}
              onChange={(e) => setSidebarQuery(e.target.value)}
              placeholder="Cari plat / inisial..."
              className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-hidden focus:border-blue-500"
            />
          </div>
        </div>

        <div className="p-2 space-y-1.5 overflow-y-auto max-h-[300px] lg:max-h-[680px]">
          {sidebarFleets.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500">
              Armada tidak ditemukan.
            </div>
          ) : (
            sidebarFleets.map((fl) => {
              const isSelected = fl.id === activeFleet.id;
              const flInfo = logisticsStore.getFleetLiveOperationalInfo(fl);
              const flPhotoCount = ANGLE_CONFIG.filter((a) => Boolean(fl.photos3d?.[a.key])).length;
              const flIdx = fleets.findIndex((item) => item.id === fl.id);
              const flM3 = getBoxCapacityM3(fl);
              const dotCls =
                flInfo.effectiveStatus === 'on-duty'
                  ? 'bg-blue-500'
                  : flInfo.effectiveStatus === 'maintenance'
                  ? 'bg-rose-500'
                  : 'bg-emerald-500';

              return (
                <button
                  key={fl.id}
                  type="button"
                  onClick={() => selectFleetByIndex(flIdx >= 0 ? flIdx : 0)}
                  className={`w-full text-left p-2.5 rounded-xl border transition cursor-pointer flex items-start justify-between gap-2 ${
                    isSelected
                      ? 'bg-blue-600/20 border-blue-500 shadow-xs'
                      : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700 hover:bg-slate-800/40'
                  }`}
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${dotCls}`} />
                      {fl.initialCode && (
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                          {fl.initialCode}
                        </span>
                      )}
                      <span className="text-xs font-black font-mono text-white truncate">
                        {fl.plateNumber}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 truncate">
                      {fl.vehicleType} · {flM3} m³
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${
                        flInfo.effectiveStatus === 'on-duty'
                          ? 'bg-blue-500/15 text-blue-300 border-blue-500/30'
                          : flInfo.effectiveStatus === 'maintenance'
                          ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                          : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                      }`}
                    >
                      {flInfo.statusLabel}
                    </span>
                    <span
                      className={`text-[9px] font-mono font-bold flex items-center gap-0.5 ${
                        flPhotoCount > 0 ? 'text-cyan-300' : 'text-slate-500'
                      }`}
                    >
                      <Camera className="w-2.5 h-2.5" />
                      {flPhotoCount}/6
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* RIGHT COLUMN: 3D STUDIO STAGE + DEDICATED 6-ANGLE PHOTO UPLOAD GALLERY */}
      <div className="space-y-4 min-w-0">
        {/* 3D STUDIO STAGE */}
        <div
          ref={stageContainerRef}
          className="relative w-full h-[500px] sm:h-[540px] rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-lg bg-[#eff4fa] select-none"
        >
          {/* Isolated WebGL Canvas Mount */}
          <div
            ref={canvasMountRef}
            className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing"
          />

          {webglError && (
            <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-slate-100 text-slate-700 p-6 text-center">
              <AlertTriangle className="w-8 h-8 text-amber-500 mb-2" />
              <p className="font-bold text-sm">{webglError}</p>
            </div>
          )}

          {/* Projected 3D Truck Hotspots (Crisp dark contrast pins) */}
          {(
            [
              { id: 'cab', title: 'Kabin & Legalitas' },
              { id: 'cargo', title: 'Box Muatan & m³' },
              { id: 'chassis', title: 'Roda, BBM & Servis' },
            ] as const
          ).map((pin) => {
            const isActive = activeHotspot === pin.id;
            return (
              <button
                key={pin.id}
                ref={(el) => {
                  hotspotElRefs.current[pin.id] = el;
                }}
                type="button"
                onClick={() => setActiveHotspot(isActive ? null : pin.id)}
                title={pin.title}
                style={{
                  opacity: 0,
                  left: 0,
                  top: 0,
                  backgroundColor: isActive ? '#2563eb' : '#0f172a',
                  borderColor: '#ffffff',
                }}
                className="absolute z-10 w-6 h-6 rounded-full border-2 shadow-md flex items-center justify-center cursor-pointer transition-transform hover:scale-110"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-white" />
              </button>
            );
          })}

          {/* TOP-LEFT TELEMETRY STACK */}
          <div className="absolute top-4 left-4 sm:top-5 sm:left-6 z-20 max-w-[310px] pointer-events-none space-y-2.5">
            <div className="pointer-events-auto">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm sm:text-lg font-black text-slate-900 tracking-tight leading-tight">
                  {originName} <span className="text-slate-400 font-semibold">&rarr;</span>{' '}
                  {destinationArea}
                </h3>
                <button
                  type="button"
                  onClick={() => onToggleFleetStatus(activeFleet)}
                  title="Klik untuk ubah status kondisi armada"
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border shadow-xs cursor-pointer transition hover:opacity-90 ${statusTone}`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      liveInfo.effectiveStatus === 'on-duty'
                        ? 'bg-blue-600'
                        : liveInfo.effectiveStatus === 'maintenance'
                        ? 'bg-rose-600'
                        : 'bg-emerald-600'
                    }`}
                  />
                  <span>{liveInfo.statusLabel}</span>
                </button>
              </div>
              <p className="text-[11px] font-medium text-slate-600 mt-0.5 font-mono">
                {activeFleet.initialCode ? `${activeFleet.initialCode} · ` : ''}
                {activeFleet.plateNumber} · {activeFleet.vehicleType} · {boxM3} m³
              </p>
            </div>

            <div className="flex items-center gap-2.5 pointer-events-auto">
              <div className="w-7 h-7 rounded-full bg-slate-900 text-white text-[10px] font-black flex items-center justify-center shrink-0 shadow-xs">
                {driverInitials}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-slate-900 truncate">{driverName}</div>
                <div className="text-[10px] text-slate-500 truncate">
                  {assignedCrew
                    ? `${assignedCrew.role} · ${assignedCrew.licenseType || 'SIM Aktif'}`
                    : `${activeFleet.brand || 'Armada Box'} (${activeFleet.year || '2023'})`}
                </div>
              </div>
            </div>

            <div className="bg-white/95 border border-slate-200/90 rounded-xl px-3 py-2 shadow-sm pointer-events-auto w-fit min-w-[205px]">
              <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Gauge className="w-3 h-3 text-indigo-500" />
                <span>TELEMETRI &amp; GPS</span>
              </div>
              <div className="text-xs font-black text-indigo-700 mt-0.5 tabular-nums">
                {matchedDevice
                  ? `${matchedDevice.currentSpeedKmh} km/jam · ${matchedDevice.status}`
                  : liveInfo.effectiveStatus === 'on-duty'
                  ? `Aktif Kirim · ${destinationArea}`
                  : `0 km/jam · Standby Gudang`}
              </div>
            </div>

            <div className="bg-white/95 border border-slate-200/90 rounded-xl px-3 py-2 shadow-sm pointer-events-auto w-fit min-w-[205px]">
              <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Fuel className="w-3 h-3 text-emerald-600" />
                <span>BBM &amp; JARAK TEMPUH</span>
              </div>
              <div className="text-xs font-black text-slate-900 mt-0.5 tabular-nums">
                {fuelPct}% · {estRangeKm} km{' '}
                <span className="text-emerald-700 font-bold text-[10px]">({avgKmL} km/L)</span>
              </div>
            </div>
          </div>

          {/* TOP-RIGHT DOCUMENT & EDIT ACTIONS */}
          <div className="absolute top-4 right-4 sm:top-5 sm:right-6 z-20 flex flex-col items-end gap-2">
            <div className="text-right">
              <div className="text-sm sm:text-base font-black text-slate-900 font-mono tracking-tight">
                {activeFleet.plateNumber}
              </div>
              <div className="flex items-center justify-end gap-1.5 mt-0.5">
                {hasExpiredDoc ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                    <AlertTriangle className="w-3 h-3" /> Dokumen Jatuh Tempo
                  </span>
                ) : hasNearDoc ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                    <Clock className="w-3 h-3" /> Mendekati Tempo
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <ShieldCheck className="w-3 h-3" /> KIR &amp; Pajak Valid
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {activeFleet.kirDocUrl && onViewKirDoc && (
                <button
                  type="button"
                  onClick={() => onViewKirDoc(activeFleet)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-[11px] font-bold shadow-xs cursor-pointer transition"
                >
                  <FileText className="w-3.5 h-3.5 text-teal-600" />
                  <span>File KIR</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => onEditFleet(activeFleet)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold shadow-xs cursor-pointer transition"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit Armada</span>
              </button>
            </div>
          </div>

          {/* ACTIVE ANGLE REAL PHOTO PREVIEW OVERLAY (Shown when viewing a specific uploaded angle) */}
          {currentAnglePhoto && currentAngleMeta && !activeHotspot && (
            <div className="absolute right-4 sm:right-6 bottom-16 z-20 w-[180px] bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
              <div className="px-2.5 py-1.5 bg-slate-900 text-white flex items-center justify-between text-[10px] font-bold">
                <span className="truncate">{currentAngleMeta.label}</span>
                <button
                  type="button"
                  onClick={() => setLightboxAngle(currentAngleMeta.key)}
                  className="text-slate-300 hover:text-white cursor-pointer"
                  title="Perbesar Foto"
                >
                  <Maximize2 className="w-3 h-3" />
                </button>
              </div>
              <button
                type="button"
                onClick={() => setLightboxAngle(currentAngleMeta.key)}
                className="block w-full h-24 overflow-hidden cursor-pointer bg-slate-100"
              >
                <img
                  src={currentAnglePhoto}
                  alt={currentAngleMeta.label}
                  className="w-full h-full object-cover"
                />
              </button>
            </div>
          )}

          {/* HOTSPOT INSPECTOR POPOVER */}
          {activeHotspot && (
            <div className="absolute right-4 sm:right-6 top-28 z-20 w-[260px] bg-white border border-slate-200 rounded-xl shadow-xl p-3.5 text-slate-800">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-2.5">
                <div className="flex items-center gap-1.5 text-xs font-black text-slate-900">
                  {activeHotspot === 'cab' && <ShieldCheck className="w-4 h-4 text-blue-600" />}
                  {activeHotspot === 'cargo' && <BoxIcon className="w-4 h-4 text-cyan-600" />}
                  {activeHotspot === 'chassis' && <Wrench className="w-4 h-4 text-amber-600" />}
                  <span>
                    {activeHotspot === 'cab'
                      ? 'Inspeksi Kabin & Dokumen'
                      : activeHotspot === 'cargo'
                      ? 'Dimensi & Kubikasi Box'
                      : 'Servis, Ban, Oli & BBM'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveHotspot(null)}
                  className="text-slate-400 hover:text-slate-700 p-0.5 rounded cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {activeHotspot === 'cab' && (
                <div className="space-y-1.5 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Unit &amp; Tahun</span>
                    <span className="font-bold text-slate-900">
                      {activeFleet.brand || '-'} ({activeFleet.year || '-'})
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Kapasitas Mesin</span>
                    <span className="font-bold text-slate-900">{activeFleet.engineCc || '2500 CC'}</span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-slate-100">
                    <span className="text-slate-500">Pajak PKB</span>
                    <span className="font-mono font-bold text-slate-900">
                      {formatIndoDate(activeFleet.taxDueDate)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">STNK 5-Thn</span>
                    <span className="font-mono font-bold text-slate-900">
                      {formatIndoDate(activeFleet.stnkExpiryDate)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Uji KIR</span>
                    <span className="font-mono font-bold text-slate-900">{formatIndoDate(kirDate)}</span>
                  </div>
                </div>
              )}

              {activeHotspot === 'cargo' && (
                <div className="space-y-2 text-[11px]">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-2">
                      <div className="text-[10px] text-slate-500">Box Luar</div>
                      <div className="font-mono font-black text-slate-900 text-xs">{boxM3} m³</div>
                    </div>
                    <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-2">
                      <div className="text-[10px] text-cyan-700">Netto ({boxMult}%)</div>
                      <div className="font-mono font-black text-cyan-800 text-xs">{innerM3} m³</div>
                    </div>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Dimensi Luar</span>
                    <span className="font-mono font-bold text-slate-900">{boxDim}</span>
                  </div>
                  <div className="flex gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => setDoorsOpen((p) => !p)}
                      className="flex-1 py-1.5 px-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-[10px] cursor-pointer"
                    >
                      {doorsOpen ? 'Tutup Pintu' : 'Buka Pintu'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setXrayBox((p) => !p)}
                      className="flex-1 py-1.5 px-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-[10px] cursor-pointer"
                    >
                      {xrayBox ? 'Box Solid' : 'X-Ray Muatan'}
                    </button>
                  </div>
                </div>
              )}

              {activeHotspot === 'chassis' && (
                <div className="space-y-1.5 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Rasio Efisiensi BBM</span>
                    <span className="font-bold text-emerald-700">{avgKmL} km / Liter</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Kondisi Oli</span>
                    <span className="font-bold text-slate-900">{routine.oil.label}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Kondisi Ban</span>
                    <span className="font-bold text-slate-900">{routine.tire.label}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Kondisi Aki</span>
                    <span className="font-bold text-slate-900">{routine.battery.label}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* LEFT & RIGHT CAROUSEL ARROWS */}
          {fleets.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => selectFleetByIndex(currentIndex - 1)}
                title="Armada Sebelumnya (Panah Kiri)"
                className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-slate-800/80 hover:bg-slate-900 text-white shadow-lg flex items-center justify-center transition cursor-pointer"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={() => selectFleetByIndex(currentIndex + 1)}
                title="Armada Berikutnya (Panah Kanan)"
                className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-slate-800/80 hover:bg-slate-900 text-white shadow-lg flex items-center justify-center transition cursor-pointer"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </>
          )}

          {/* COMPACT CAMERA PRESET & ACTION BAR (NO Fleet List at the bottom of 3D!) */}
          <div className="absolute bottom-3 left-3 right-3 z-20 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
            <div className="pointer-events-auto flex flex-wrap items-center gap-1 bg-white/95 border border-slate-200 rounded-xl p-1 shadow-md">
              <button
                type="button"
                onClick={() => {
                  setActiveHotspot(null);
                  setCameraPreset('hero');
                }}
                className={`px-2 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                  cameraPreset === 'hero' && !activeHotspot
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                3/4 Studio
              </button>
              {ANGLE_CONFIG.map((ang) => (
                <button
                  key={ang.key}
                  type="button"
                  onClick={() => {
                    setActiveHotspot(null);
                    setCameraPreset(ang.key);
                  }}
                  className={`px-2 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer flex items-center gap-1 ${
                    cameraPreset === ang.key && !activeHotspot
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <span>{ang.shortLabel}</span>
                  {activePhotos[ang.key] && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                  )}
                </button>
              ))}
            </div>

            <div className="pointer-events-auto flex flex-wrap items-center gap-1 bg-white/95 border border-slate-200 rounded-xl p-1 shadow-md">
              <button
                type="button"
                onClick={() => setDoorsOpen((prev) => !prev)}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                  doorsOpen ? 'bg-blue-600 text-white' : 'text-slate-700 hover:bg-slate-100'
                }`}
                title="Buka atau tutup pintu belakang box truk"
              >
                <DoorOpen className="w-3.5 h-3.5" />
                <span>{doorsOpen ? 'Tutup Box' : 'Buka Box'}</span>
              </button>

              <button
                type="button"
                onClick={() => setXrayBox((prev) => !prev)}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                  xrayBox ? 'bg-cyan-600 text-white' : 'text-slate-700 hover:bg-slate-100'
                }`}
                title="Mode tembus pandang dinding box untuk melihat palet muatan"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>X-Ray</span>
              </button>

              <button
                type="button"
                onClick={() => setAutoRotate((prev) => !prev)}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                  autoRotate ? 'bg-indigo-600 text-white' : 'text-slate-700 hover:bg-slate-100'
                }`}
                title="Putar truk secara otomatis"
              >
                {autoRotate ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">Putar</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveHotspot(null);
                  setCameraPreset('hero');
                  engineRef.current?.applyCameraGoal('hero', null);
                }}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition cursor-pointer"
                title="Reset sudut pandang kamera"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* DEDICATED 6-ANGLE PHOTO UPLOAD GALLERY (Depan, Belakang, Kanan, Kiri, Atas, Kabin) */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
                <Camera className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-black text-white flex items-center gap-2">
                  <span>Foto Kondisi Armada 6 Sudut — {activeFleet.plateNumber}</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                    {uploadedPhotoCount}/6 Terunggah
                  </span>
                </h4>
                <p className="text-[11px] text-slate-400">
                  Unggah foto Depan, Belakang, Samping Kanan, Samping Kiri, Atas, &amp; Kabin. Foto sisi box dapat ditampilkan langsung ke model 3D.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setUsePhotoTextures((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer ${
                usePhotoTextures
                  ? 'bg-cyan-600/20 text-cyan-300 border-cyan-500/40'
                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>{usePhotoTextures ? 'Tekstur Foto di 3D: Aktif' : 'Tekstur Foto di 3D: Nonaktif'}</span>
            </button>
          </div>

          {photoError && (
            <div className="p-2.5 rounded-lg bg-rose-500/15 border border-rose-500/30 text-xs text-rose-300 flex items-center justify-between">
              <span>{photoError}</span>
              <button
                type="button"
                onClick={() => setPhotoError(null)}
                className="text-rose-200 hover:text-white cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2.5">
            {ANGLE_CONFIG.map((ang) => {
              const photoUrl = activePhotos[ang.key];
              const isUploading = uploadingAngle === ang.key;
              const isAngleActive = cameraPreset === ang.key && !activeHotspot;

              return (
                <div
                  key={ang.key}
                  className={`rounded-xl border overflow-hidden flex flex-col transition ${
                    isAngleActive
                      ? 'bg-slate-950 border-blue-500 shadow-sm'
                      : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {/* Angle Header (Click to focus 3D camera on this side) */}
                  <button
                    type="button"
                    onClick={() => {
                      setActiveHotspot(null);
                      setCameraPreset(ang.key);
                    }}
                    className="px-2.5 py-2 flex items-center justify-between gap-1 text-left border-b border-slate-800/80 hover:bg-slate-900 cursor-pointer"
                    title={`Arahkan kamera 3D ke ${ang.label}`}
                  >
                    <span className="text-[11px] font-bold text-slate-100 truncate">
                      {ang.label}
                    </span>
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        photoUrl ? 'bg-emerald-400' : 'bg-slate-600'
                      }`}
                    />
                  </button>

                  {/* Photo Thumbnail / Empty Upload Slot */}
                  <div className="relative h-28 bg-slate-900 flex items-center justify-center overflow-hidden group">
                    {photoUrl ? (
                      <>
                        <img
                          src={photoUrl}
                          alt={`${activeFleet.plateNumber} - ${ang.label}`}
                          onClick={() => setLightboxAngle(ang.key)}
                          className="w-full h-full object-cover cursor-pointer transition-transform group-hover:scale-105"
                        />
                        <div className="absolute top-1.5 right-1.5 flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setLightboxAngle(ang.key)}
                            title="Perbesar Foto"
                            className="p-1 rounded-md bg-slate-900/85 hover:bg-slate-900 text-white border border-slate-700 cursor-pointer"
                          >
                            <Maximize2 className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteAnglePhoto(ang.key)}
                            title="Hapus Foto"
                            className="p-1 rounded-md bg-rose-600/90 hover:bg-rose-600 text-white cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => fileInputRefs.current[ang.key]?.click()}
                        className="w-full h-full flex flex-col items-center justify-center gap-1.5 p-2 text-center hover:bg-slate-800/60 transition cursor-pointer"
                      >
                        <ImageIcon className="w-5 h-5 text-slate-500" />
                        <span className="text-[10px] text-slate-400 leading-tight">{ang.hint}</span>
                      </button>
                    )}
                  </div>

                  {/* Upload / Ganti Button */}
                  <div className="p-2 border-t border-slate-800/80 bg-slate-950">
                    <input
                      ref={(el) => {
                        fileInputRefs.current[ang.key] = el;
                      }}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handlePhotoFileChange(ang.key, e.target.files)}
                    />
                    <button
                      type="button"
                      disabled={isUploading}
                      onClick={() => fileInputRefs.current[ang.key]?.click()}
                      className="w-full py-1.5 px-2 rounded-lg bg-slate-800 hover:bg-blue-600 text-slate-200 hover:text-white text-[11px] font-bold flex items-center justify-center gap-1 transition cursor-pointer disabled:opacity-50"
                    >
                      <Upload className="w-3 h-3" />
                      <span>
                        {isUploading ? 'Menyimpan...' : photoUrl ? 'Ganti Foto' : 'Upload Foto'}
                      </span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* LIGHTBOX PREVIEW MODAL */}
      {lightboxAngle && activePhotos[lightboxAngle] && (
        <div
          className="fixed inset-0 z-[1400] bg-slate-950/85 flex items-center justify-center p-4"
          onClick={() => setLightboxAngle(null)}
        >
          <div
            className="bg-slate-900 border border-slate-700 rounded-2xl max-w-3xl w-full overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
              <div className="text-sm font-black text-white flex items-center gap-2">
                <Camera className="w-4 h-4 text-cyan-400" />
                <span>
                  {activeFleet.plateNumber} —{' '}
                  {ANGLE_CONFIG.find((a) => a.key === lightboxAngle)?.label}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setLightboxAngle(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="bg-slate-950 p-3 flex items-center justify-center max-h-[75vh]">
              <img
                src={activePhotos[lightboxAngle]}
                alt={ANGLE_CONFIG.find((a) => a.key === lightboxAngle)?.label || 'Foto Armada'}
                className="max-h-[70vh] w-auto rounded-lg object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
