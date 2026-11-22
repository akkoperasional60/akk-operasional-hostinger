import * as THREE from 'three';
import { Fleet, FleetStatus } from '../types';

export interface TruckHotspotAnchor {
  id: 'cab' | 'cargo' | 'chassis';
  label: string;
  localPosition: THREE.Vector3;
  cameraOffset: THREE.Vector3;
  targetOffset: THREE.Vector3;
}

export interface BuiltTruckRig {
  root: THREE.Group;
  wheelGroups: THREE.Group[];
  leftDoorPivot: THREE.Group;
  rightDoorPivot: THREE.Group;
  boxShellMeshes: THREE.Mesh[];
  cargoInnerGroup: THREE.Group;
  hotspotAnchors: TruckHotspotAnchor[];
  sizeMetrics: {
    totalLength: number;
    totalWidth: number;
    totalHeight: number;
    centerY: number;
  };
  disposables: {
    geometries: THREE.BufferGeometry[];
    materials: THREE.Material[];
    textures: THREE.Texture[];
  };
}

interface TruckSpecProfile {
  category: 'pickup' | 'engkel_std' | 'engkel_long' | 'double_std';
  cabLength: number;
  cabHeight: number;
  cabWidth: number;
  cabNoseSlope: number;
  boxLength: number;
  boxWidth: number;
  boxHeight: number;
  chassisHeight: number;
  wheelRadius: number;
  wheelWidth: number;
  frontAxleZ: number;
  rearAxleZ: number;
  dualRearWheels: boolean;
  hasRoofFairing: boolean;
  hasSideSkirt: boolean;
  accentColor: string;
  cabColorHex: number;
  boxColorHex: number;
}

function getTruckSpecProfile(fleet: Fleet): TruckSpecProfile {
  const vType = (fleet.vehicleType || '').toLowerCase();
  const brand = (fleet.brand || '').toLowerCase();

  if (vType.includes('pick up') || vType.includes('pickup')) {
    const isTraga = brand.includes('traga');
    return {
      category: 'pickup',
      cabLength: 1.55,
      cabHeight: 1.52,
      cabWidth: 1.72,
      cabNoseSlope: 0.24,
      boxLength: isTraga ? 2.85 : 2.55,
      boxWidth: 1.74,
      boxHeight: 1.55,
      chassisHeight: 0.56,
      wheelRadius: 0.34,
      wheelWidth: 0.21,
      frontAxleZ: 1.48,
      rearAxleZ: -1.18,
      dualRearWheels: false,
      hasRoofFairing: false,
      hasSideSkirt: false,
      accentColor: '#0284c7',
      cabColorHex: 0xf7f7f3,
      boxColorHex: 0xf4f5f7,
    };
  }

  if (vType.includes('engkel long') || vType.includes('long')) {
    return {
      category: 'engkel_long',
      cabLength: 1.75,
      cabHeight: 1.88,
      cabWidth: 1.94,
      cabNoseSlope: 0.28,
      boxLength: 4.25,
      boxWidth: 1.98,
      boxHeight: 1.98,
      chassisHeight: 0.72,
      wheelRadius: 0.41,
      wheelWidth: 0.24,
      frontAxleZ: 2.38,
      rearAxleZ: -1.55,
      dualRearWheels: false,
      hasRoofFairing: true,
      hasSideSkirt: true,
      accentColor: '#2563eb',
      cabColorHex: 0xf6f4ee,
      boxColorHex: 0xf1f3f6,
    };
  }

  if (vType.includes('double') || vType.includes('cdd')) {
    return {
      category: 'double_std',
      cabLength: 1.92,
      cabHeight: 2.05,
      cabWidth: 2.12,
      cabNoseSlope: 0.30,
      boxLength: 4.55,
      boxWidth: 2.16,
      boxHeight: 2.15,
      chassisHeight: 0.78,
      wheelRadius: 0.44,
      wheelWidth: 0.25,
      frontAxleZ: 2.58,
      rearAxleZ: -1.65,
      dualRearWheels: true,
      hasRoofFairing: true,
      hasSideSkirt: true,
      accentColor: '#4f46e5',
      cabColorHex: 0xf5f2eb,
      boxColorHex: 0xf0f2f5,
    };
  }

  // Default: Engkel STD
  return {
    category: 'engkel_std',
    cabLength: 1.72,
    cabHeight: 1.82,
    cabWidth: 1.90,
    cabNoseSlope: 0.26,
    boxLength: 3.25,
    boxWidth: 1.94,
    boxHeight: 1.86,
    chassisHeight: 0.70,
    wheelRadius: 0.39,
    wheelWidth: 0.23,
    frontAxleZ: 1.88,
    rearAxleZ: -1.25,
    dualRearWheels: false,
    hasRoofFairing: true,
    hasSideSkirt: false,
    accentColor: '#0ea5e9',
    cabColorHex: 0xf6f5f0,
    boxColorHex: 0xf3f4f6,
  };
}

function createLicensePlateTexture(
  plateText: string,
  maxAnisotropy: number,
  disposables: BuiltTruckRig['disposables']
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 160;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    // Indonesian modern white-background commercial / private plate with crisp black frame
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 10;
    ctx.strokeRect(8, 8, canvas.width - 16, canvas.height - 16);

    ctx.fillStyle = '#0f172a';
    ctx.font = '900 72px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText((plateText || 'P 0000 XX').toUpperCase(), canvas.width / 2, canvas.height / 2 - 8);

    ctx.fillStyle = '#475569';
    ctx.font = '700 22px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText('AKK • LOGISTIK', canvas.width / 2, canvas.height - 28);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(8, maxAnisotropy);
  tex.needsUpdate = true;
  disposables.textures.push(tex);
  return tex;
}

function createSideLiveryTexture(
  fleet: Fleet,
  boxM3: number,
  accentHex: string,
  effectiveStatus: FleetStatus,
  maxAnisotropy: number,
  disposables: BuiltTruckRig['disposables']
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    // Subtle satin aluminum / insulated panel base
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, '#f8fafc');
    grad.addColorStop(0.55, '#f1f5f9');
    grad.addColorStop(1, '#e2e8f0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Subtle vertical panel seam lines
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
    ctx.lineWidth = 3;
    for (let x = 64; x < canvas.width; x += 128) {
      ctx.beginPath();
      ctx.moveTo(x, 24);
      ctx.lineTo(x, canvas.height - 24);
      ctx.stroke();
    }

    // Top corporate stripe
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, canvas.width, 34);

    // Dynamic accent diagonal ribbon
    ctx.fillStyle = accentHex;
    ctx.beginPath();
    ctx.moveTo(0, 390);
    ctx.lineTo(canvas.width, 355);
    ctx.lineTo(canvas.width, 415);
    ctx.lineTo(0, 445);
    ctx.closePath();
    ctx.fill();

    // Dark lower trim strip
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 452, canvas.width, 60);

    // Brand label
    ctx.fillStyle = '#0f172a';
    ctx.font = '900 44px ui-sans-serif, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('ANUGRAH KEMASAN KREATIF', 62, 136);

    ctx.fillStyle = accentHex;
    ctx.font = '800 26px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText('FLEET LOGISTICS & SUPPLY CHAIN', 62, 180);

    // Initial code badge pill
    const initCode = (fleet.initialCode || fleet.plateNumber).toUpperCase();
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.roundRect(62, 224, 330, 96, 16);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 48px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillText(initCode, 90, 288);

    // Volume badge on right
    ctx.fillStyle = 'rgba(15, 23, 42, 0.06)';
    ctx.beginPath();
    ctx.roundRect(710, 224, 250, 96, 16);
    ctx.fill();

    ctx.strokeStyle = 'rgba(15, 23, 42, 0.14)';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = '#0f172a';
    ctx.font = '900 46px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${boxM3} m³`, 835, 274);

    ctx.fillStyle = '#475569';
    ctx.font = '700 20px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText((fleet.vehicleType || 'BOX TRUCK').toUpperCase(), 835, 306);

    // Footer status stamp on lower dark band
    const statusText =
      effectiveStatus === 'on-duty'
        ? 'ON-DUTY DELIVERY'
        : effectiveStatus === 'maintenance'
        ? 'MAINTENANCE CHECK'
        : 'READY FOR DISPATCH';
    ctx.fillStyle = '#f8fafc';
    ctx.font = '700 22px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`${fleet.plateNumber}   •   ${statusText}`, 62, 490);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(8, maxAnisotropy);
  tex.needsUpdate = true;
  disposables.textures.push(tex);
  return tex;
}

function createRearReflectiveTexture(
  maxAnisotropy: number,
  disposables: BuiltTruckRig['disposables']
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const segW = 64;
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#dc2626' : '#f8fafc';
      ctx.fillRect(i * segW, 0, segW, 64);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(4, maxAnisotropy);
  tex.needsUpdate = true;
  disposables.textures.push(tex);
  return tex;
}

function createWheelAssembly(
  radius: number,
  width: number,
  dual: boolean,
  isRightSide: boolean,
  tireMat: THREE.Material,
  rimMat: THREE.Material,
  hubCapMat: THREE.Material,
  disposables: BuiltTruckRig['disposables']
): THREE.Group {
  const wheelGroup = new THREE.Group();

  const buildSingleTire = (xOffset: number) => {
    const unit = new THREE.Group();
    unit.position.x = xOffset;

    const tireGeo = new THREE.CylinderGeometry(radius, radius, width, 28);
    tireGeo.rotateZ(Math.PI / 2);
    disposables.geometries.push(tireGeo);
    const tireMesh = new THREE.Mesh(tireGeo, tireMat);
    tireMesh.castShadow = true;
    tireMesh.receiveShadow = true;
    unit.add(tireMesh);

    // Sidewall bulge ring
    const rimRadius = radius * 0.56;
    const rimGeo = new THREE.CylinderGeometry(rimRadius, rimRadius, width + 0.015, 22);
    rimGeo.rotateZ(Math.PI / 2);
    disposables.geometries.push(rimGeo);
    const rimMesh = new THREE.Mesh(rimGeo, rimMat);
    unit.add(rimMesh);

    // Outer hub cap
    const capGeo = new THREE.CylinderGeometry(rimRadius * 0.44, rimRadius * 0.48, width + 0.04, 16);
    capGeo.rotateZ(Math.PI / 2);
    disposables.geometries.push(capGeo);
    const capMesh = new THREE.Mesh(capGeo, hubCapMat);
    unit.add(capMesh);

    // 6 Lug bolts radially on outer face
    const boltGeo = new THREE.CylinderGeometry(0.016, 0.016, 0.03, 8);
    boltGeo.rotateZ(Math.PI / 2);
    disposables.geometries.push(boltGeo);
    const faceSign = isRightSide ? 1 : -1;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const bolt = new THREE.Mesh(boltGeo, rimMat);
      bolt.position.set(
        faceSign * (width * 0.5 + 0.01),
        Math.cos(a) * rimRadius * 0.72,
        Math.sin(a) * rimRadius * 0.72
      );
      unit.add(bolt);
    }

    return unit;
  };

  if (dual) {
    const innerShift = isRightSide ? -width * 0.58 : width * 0.58;
    const outerShift = isRightSide ? width * 0.58 : -width * 0.58;
    wheelGroup.add(buildSingleTire(innerShift));
    wheelGroup.add(buildSingleTire(outerShift));
  } else {
    wheelGroup.add(buildSingleTire(0));
  }

  return wheelGroup;
}

export function buildProceduralTruck(
  fleet: Fleet,
  boxM3: number,
  effectiveStatus: FleetStatus,
  maxAnisotropy = 4,
  usePhotoTextures = true,
  onTextureLoaded?: () => void
): BuiltTruckRig {
  const disposables: BuiltTruckRig['disposables'] = {
    geometries: [],
    materials: [],
    textures: [],
  };

  const loader = new THREE.TextureLoader();
  const loadPhotoMaterial = (dataUrl?: string): THREE.MeshStandardMaterial | null => {
    if (!usePhotoTextures || !dataUrl) return null;
    const mat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.34,
        metalness: 0.08,
      })
    );
    loader.load(
      dataUrl,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = Math.min(8, maxAnisotropy);
        tex.needsUpdate = true;
        disposables.textures.push(tex);
        mat.map = tex;
        mat.needsUpdate = true;
        onTextureLoaded?.();
      },
      undefined,
      () => {
        // Fallback silently if malformed image URL
      }
    );
    return mat;
  };

  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    disposables.geometries.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    disposables.materials.push(m);
    return m;
  };

  const spec = getTruckSpecProfile(fleet);
  const root = new THREE.Group();
  root.name = `truck-${fleet.id}`;

  // Materials — clean automotive showroom PBR palette
  const cabPaintMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: spec.cabColorHex,
      roughness: 0.24,
      metalness: 0.08,
      clearcoat: 0.85,
      clearcoatRoughness: 0.14,
    })
  );

  const boxPaintMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: spec.boxColorHex,
      roughness: 0.36,
      metalness: 0.18,
    })
  );

  const aluminumTrimMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xd8dee9,
      roughness: 0.3,
      metalness: 0.72,
    })
  );

  const darkTrimMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.62,
      metalness: 0.28,
    })
  );

  const chassisSteelMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.55,
      metalness: 0.6,
    })
  );

  const glassMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x102133,
      roughness: 0.08,
      metalness: 0.1,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
      reflectivity: 0.95,
    })
  );

  const tireMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x181a1f,
      roughness: 0.88,
      metalness: 0.05,
    })
  );

  const rimMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xcbd5e1,
      roughness: 0.28,
      metalness: 0.85,
    })
  );

  const hubCapMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.35,
      metalness: 0.78,
    })
  );

  const chromeMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 0.14,
      metalness: 0.95,
    })
  );

  const headlightMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xfef3c7,
      emissiveIntensity: 0.9,
      roughness: 0.12,
      metalness: 0.1,
    })
  );

  const tailLightMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0xdc2626,
      emissiveIntensity: 0.65,
      roughness: 0.2,
    })
  );

  const amberMarkerMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xd97706,
      emissiveIntensity: 0.7,
      roughness: 0.22,
    })
  );

  // Textures
  const plateTex = createLicensePlateTexture(fleet.plateNumber, maxAnisotropy, disposables);
  const plateMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: plateTex,
      roughness: 0.35,
      metalness: 0.1,
    })
  );

  const liveryTex = createSideLiveryTexture(
    fleet,
    boxM3,
    spec.accentColor,
    effectiveStatus,
    maxAnisotropy,
    disposables
  );
  const liveryMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: liveryTex,
      roughness: 0.34,
      metalness: 0.14,
    })
  );

  const reflectiveTex = createRearReflectiveTexture(maxAnisotropy, disposables);
  const reflectiveMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: reflectiveTex,
      roughness: 0.25,
      metalness: 0.2,
    })
  );

  // Longitudinal layout: center around Z=0 so truck stays centered on studio turntable
  // Truck front points toward +Z
  const gapBetweenCabAndBox = 0.14;
  const totalTruckLen = spec.cabLength + gapBetweenCabAndBox + spec.boxLength;
  const frontZ = totalTruckLen / 2;
  const cabRearZ = frontZ - spec.cabLength;
  const boxFrontZ = cabRearZ - gapBetweenCabAndBox;
  const boxRearZ = boxFrontZ - spec.boxLength;
  const boxCenterZ = (boxFrontZ + boxRearZ) / 2;

  // 1. CHASSIS FRAME & UNDERCARRIAGE
  const chassisGroup = new THREE.Group();
  const railLength = totalTruckLen - 0.35;
  const railSpanX = spec.cabWidth * 0.44;
  const railGeo = trackGeo(new THREE.BoxGeometry(0.11, 0.15, railLength));
  [-railSpanX / 2, railSpanX / 2].forEach((xPos) => {
    const rail = new THREE.Mesh(railGeo, chassisSteelMat);
    rail.position.set(xPos, spec.chassisHeight - 0.08, -0.05);
    rail.castShadow = true;
    rail.receiveShadow = true;
    chassisGroup.add(rail);
  });

  // Crossmembers
  const crossGeo = trackGeo(new THREE.BoxGeometry(railSpanX + 0.08, 0.1, 0.1));
  for (let i = 0; i < 4; i++) {
    const cz = boxRearZ + 0.4 + i * ((railLength - 0.8) / 3);
    const cross = new THREE.Mesh(crossGeo, chassisSteelMat);
    cross.position.set(0, spec.chassisHeight - 0.08, cz);
    chassisGroup.add(cross);
  }

  // Cylindrical Fuel Tank (right side) & Tool/Battery Box (left side)
  const tankGeo = trackGeo(new THREE.CylinderGeometry(0.17, 0.17, 0.72, 16));
  tankGeo.rotateX(Math.PI / 2);
  const fuelTank = new THREE.Mesh(tankGeo, darkTrimMat);
  fuelTank.position.set(spec.boxWidth * 0.36, spec.chassisHeight - 0.12, boxCenterZ + 0.35);
  fuelTank.castShadow = true;
  chassisGroup.add(fuelTank);

  const batteryBoxGeo = trackGeo(new THREE.BoxGeometry(0.28, 0.24, 0.48));
  const batteryBox = new THREE.Mesh(batteryBoxGeo, darkTrimMat);
  batteryBox.position.set(-spec.boxWidth * 0.36, spec.chassisHeight - 0.12, boxCenterZ + 0.35);
  batteryBox.castShadow = true;
  chassisGroup.add(batteryBox);

  // Rear Underride Bumper + Safety Stripes + Tail lights
  const rearBumperGeo = trackGeo(new THREE.BoxGeometry(spec.boxWidth * 0.92, 0.13, 0.12));
  const rearBumper = new THREE.Mesh(rearBumperGeo, chassisSteelMat);
  rearBumper.position.set(0, spec.chassisHeight - 0.2, boxRearZ - 0.03);
  rearBumper.castShadow = true;
  chassisGroup.add(rearBumper);

  const reflectGeo = trackGeo(new THREE.BoxGeometry(spec.boxWidth * 0.86, 0.075, 0.02));
  const rearReflector = new THREE.Mesh(reflectGeo, reflectiveMat);
  rearReflector.position.set(0, spec.chassisHeight - 0.2, boxRearZ - 0.095);
  chassisGroup.add(rearReflector);

  // Rear Taillight housings
  const tailHousingGeo = trackGeo(new THREE.BoxGeometry(0.32, 0.11, 0.06));
  [-spec.boxWidth * 0.37, spec.boxWidth * 0.37].forEach((tx) => {
    const housing = new THREE.Mesh(tailHousingGeo, tailLightMat);
    housing.position.set(tx, spec.chassisHeight - 0.06, boxRearZ - 0.04);
    chassisGroup.add(housing);
  });

  // Optional side protective skirt rails for Engkel Long & Double STD
  if (spec.hasSideSkirt) {
    const guardLen = Math.max(1.1, spec.boxLength * 0.42);
    const guardGeo = trackGeo(new THREE.BoxGeometry(0.05, 0.07, guardLen));
    [-spec.boxWidth * 0.47, spec.boxWidth * 0.47].forEach((gx) => {
      const barTop = new THREE.Mesh(guardGeo, aluminumTrimMat);
      barTop.position.set(gx, spec.chassisHeight - 0.08, boxCenterZ + 0.15);
      barTop.castShadow = true;
      chassisGroup.add(barTop);

      const barBot = new THREE.Mesh(guardGeo, aluminumTrimMat);
      barBot.position.set(gx, spec.chassisHeight - 0.22, boxCenterZ + 0.15);
      barBot.castShadow = true;
      chassisGroup.add(barBot);
    });
  }

  root.add(chassisGroup);

  // 2. WHEELS & AXLES
  const wheelGroups: THREE.Group[] = [];
  const frontAxleOffset = frontZ - spec.cabLength * 0.56;
  const rearAxleOffset = boxRearZ + Math.min(1.15, spec.boxLength * 0.30);

  const axlePositions: Array<{ z: number; dual: boolean }> = [
    { z: frontAxleOffset, dual: false },
    { z: rearAxleOffset, dual: spec.dualRearWheels },
  ];

  const halfTrackX = spec.cabWidth * 0.47;
  axlePositions.forEach(({ z, dual }) => {
    // Axle beam
    const beamGeo = trackGeo(new THREE.CylinderGeometry(0.055, 0.055, halfTrackX * 2, 10));
    beamGeo.rotateZ(Math.PI / 2);
    const beam = new THREE.Mesh(beamGeo, chassisSteelMat);
    beam.position.set(0, spec.wheelRadius, z);
    root.add(beam);

    // Left & right wheel hubs
    [-1, 1].forEach((sideSign) => {
      const wheel = createWheelAssembly(
        spec.wheelRadius,
        spec.wheelWidth,
        dual,
        sideSign > 0,
        tireMat,
        rimMat,
        hubCapMat,
        disposables
      );
      const xShift = dual ? sideSign * (halfTrackX - spec.wheelWidth * 0.38) : sideSign * halfTrackX;
      wheel.position.set(xShift, spec.wheelRadius, z);
      wheelGroups.push(wheel);
      root.add(wheel);
    });
  });

  // 3. SCULPTED FRONT CAB (Profile extruded cleanly along X, beveled for smooth studio reflections)
  const cabGroup = new THREE.Group();
  const cabShape = new THREE.Shape();
  const cLen = spec.cabLength;
  const cH = spec.cabHeight;
  const noseCut = spec.cabNoseSlope;

  // Profile in (Z, Y) then extruded along X
  cabShape.moveTo(0, 0);
  cabShape.lineTo(cLen, 0);
  cabShape.lineTo(cLen, cH * 0.42);
  cabShape.lineTo(cLen - noseCut * 0.35, cH * 0.54);
  cabShape.lineTo(cLen - noseCut, cH * 0.94);
  cabShape.quadraticCurveTo(cLen - noseCut - 0.1, cH, cLen - noseCut - 0.25, cH);
  cabShape.lineTo(0.06, cH);
  cabShape.quadraticCurveTo(0, cH, 0, cH - 0.06);
  cabShape.lineTo(0, 0);

  const bevel = 0.04;
  const cabGeo = trackGeo(
    new THREE.ExtrudeGeometry(cabShape, {
      depth: spec.cabWidth - bevel * 2,
      bevelEnabled: true,
      bevelThickness: bevel,
      bevelSize: bevel,
      bevelSegments: 3,
      curveSegments: 8,
    })
  );
  // Rotate so X->depth becomes left-right X, Y stays up, shape's X runs cabRearZ -> frontZ
  cabGeo.rotateY(-Math.PI / 2);
  cabGeo.translate(spec.cabWidth / 2 - bevel, spec.chassisHeight - 0.06, cabRearZ);
  // Extrude went along +X after rotateY(-PI/2): verify & center X cleanly
  const cabBox = new THREE.Box3().setFromBufferAttribute(
    cabGeo.attributes.position as THREE.BufferAttribute
  );
  const cabCenterX = (cabBox.min.x + cabBox.max.x) / 2;
  cabGeo.translate(-cabCenterX, 0, 0);
  const cabMesh = new THREE.Mesh(cabGeo, cabPaintMat);
  cabMesh.castShadow = true;
  cabMesh.receiveShadow = true;
  cabGroup.add(cabMesh);

  // Align front coordinates precisely to cabMesh bounding box
  cabMesh.geometry.computeBoundingBox();
  const cabBounds = cabMesh.geometry.boundingBox!;
  const cabMaxZ = cabBounds.max.z;
  const cabMinY = cabBounds.min.y;
  const cabMaxY = cabBounds.max.y;

  // Windshield (slanted glass sitting cleanly on nose plane)
  const windshieldW = spec.cabWidth * 0.84;
  const windshieldH = cH * 0.38;
  const windshieldGeo = trackGeo(new THREE.BoxGeometry(windshieldW, windshieldH, 0.04));
  const windshield = new THREE.Mesh(windshieldGeo, glassMat);
  windshield.position.set(0, cabMinY + cH * 0.72, cabMaxZ - noseCut * 0.56);
  windshield.rotation.x = -Math.atan2(noseCut * 0.75, cH * 0.44);
  cabGroup.add(windshield);

  // Side cab windows (Left & Right)
  const sideWinGeo = trackGeo(new THREE.BoxGeometry(spec.cabWidth + 0.015, cH * 0.33, cLen * 0.44));
  const sideWindows = new THREE.Mesh(sideWinGeo, glassMat);
  sideWindows.position.set(0, cabMinY + cH * 0.71, cabRearZ + cLen * 0.37);
  cabGroup.add(sideWindows);

  // Side cab trim & door handles
  const handleGeo = trackGeo(new THREE.BoxGeometry(spec.cabWidth + 0.03, 0.035, 0.13));
  const handles = new THREE.Mesh(handleGeo, darkTrimMat);
  handles.position.set(0, cabMinY + cH * 0.44, cabRearZ + cLen * 0.33);
  cabGroup.add(handles);

  // Black front grille bezel + chrome horizontal slats + brand badge
  const grilleBezelGeo = trackGeo(new THREE.BoxGeometry(spec.cabWidth * 0.82, cH * 0.24, 0.05));
  const grilleBezel = new THREE.Mesh(grilleBezelGeo, darkTrimMat);
  grilleBezel.position.set(0, cabMinY + cH * 0.30, cabMaxZ - 0.01);
  cabGroup.add(grilleBezel);

  const slatGeo = trackGeo(new THREE.BoxGeometry(spec.cabWidth * 0.76, 0.025, 0.065));
  for (let s = -1; s <= 1; s++) {
    const slat = new THREE.Mesh(slatGeo, chromeMat);
    slat.position.set(0, cabMinY + cH * 0.30 + s * 0.09, cabMaxZ - 0.004);
    cabGroup.add(slat);
  }

  // Front Bumper + Headlights + Front License Plate
  const frontBumperGeo = trackGeo(new THREE.BoxGeometry(spec.cabWidth * 1.01, 0.20, 0.14));
  const frontBumper = new THREE.Mesh(frontBumperGeo, darkTrimMat);
  frontBumper.position.set(0, cabMinY + 0.08, cabMaxZ + 0.01);
  frontBumper.castShadow = true;
  cabGroup.add(frontBumper);

  const headGeo = trackGeo(new THREE.BoxGeometry(0.24, 0.11, 0.06));
  [-spec.cabWidth * 0.34, spec.cabWidth * 0.34].forEach((hx) => {
    const hl = new THREE.Mesh(headGeo, headlightMat);
    hl.position.set(hx, cabMinY + 0.16, cabMaxZ + 0.045);
    cabGroup.add(hl);
  });

  const frontPlateGeo = trackGeo(new THREE.BoxGeometry(0.42, 0.13, 0.02));
  const frontPlate = new THREE.Mesh(frontPlateGeo, plateMat);
  frontPlate.position.set(0, cabMinY + 0.08, cabMaxZ + 0.085);
  cabGroup.add(frontPlate);

  // Side Mirrors on stalks
  const mirrorHousingGeo = trackGeo(new THREE.BoxGeometry(0.06, 0.24, 0.11));
  const mirrorArmGeo = trackGeo(new THREE.BoxGeometry(0.16, 0.025, 0.025));
  [-1, 1].forEach((sideSign) => {
    const mirror = new THREE.Mesh(mirrorHousingGeo, darkTrimMat);
    mirror.position.set(
      sideSign * (spec.cabWidth * 0.5 + 0.13),
      cabMinY + cH * 0.66,
      cabMaxZ - noseCut * 0.55
    );
    cabGroup.add(mirror);

    const arm = new THREE.Mesh(mirrorArmGeo, darkTrimMat);
    arm.position.set(
      sideSign * (spec.cabWidth * 0.5 + 0.06),
      cabMinY + cH * 0.72,
      cabMaxZ - noseCut * 0.62
    );
    cabGroup.add(arm);
  });

  // Wheel Mudguard Arches under cab
  const fenderGeo = trackGeo(new THREE.BoxGeometry(0.16, 0.12, spec.wheelRadius * 2.2));
  [-1, 1].forEach((sideSign) => {
    const fender = new THREE.Mesh(fenderGeo, darkTrimMat);
    fender.position.set(
      sideSign * (spec.cabWidth * 0.49),
      spec.wheelRadius * 1.45,
      frontAxleOffset
    );
    cabGroup.add(fender);
  });

  // Optional Roof Aero Deflector (for Engkel & Double box trucks)
  if (spec.hasRoofFairing) {
    const fairingH = Math.max(0.22, cabMaxY < spec.chassisHeight + spec.boxHeight ? spec.chassisHeight + spec.boxHeight - cabMaxY : 0.28);
    const fShape = new THREE.Shape();
    fShape.moveTo(0, 0);
    fShape.lineTo(cLen * 0.72, 0);
    fShape.quadraticCurveTo(cLen * 0.35, fairingH * 0.65, 0, fairingH);
    fShape.lineTo(0, 0);

    const fGeo = trackGeo(
      new THREE.ExtrudeGeometry(fShape, {
        depth: spec.cabWidth * 0.86,
        bevelEnabled: true,
        bevelThickness: 0.03,
        bevelSize: 0.03,
        bevelSegments: 2,
      })
    );
    fGeo.rotateY(-Math.PI / 2);
    fGeo.computeBoundingBox();
    const fCenterX = (fGeo.boundingBox!.min.x + fGeo.boundingBox!.max.x) / 2;
    fGeo.translate(-fCenterX, cabMaxY - 0.03, cabRearZ + 0.05);
    const fairingMesh = new THREE.Mesh(fGeo, cabPaintMat);
    fairingMesh.castShadow = true;
    cabGroup.add(fairingMesh);
  }

  root.add(cabGroup);

  // 4. INSULATED CARGO BOX (Multi-Panel Shell + Livery + Hinged Rear Doors + Cutaway Support)
  const boxGroup = new THREE.Group();
  const boxShellMeshes: THREE.Mesh[] = [];
  const wallT = 0.055;
  const boxFloorY = spec.chassisHeight;
  const boxTopY = boxFloorY + spec.boxHeight;
  const boxMidY = boxFloorY + spec.boxHeight / 2;

  // Box floor deck (stays solid even when outer walls go X-Ray)
  const boxFloorGeo = trackGeo(new THREE.BoxGeometry(spec.boxWidth, wallT, spec.boxLength));
  const boxFloor = new THREE.Mesh(boxFloorGeo, chassisSteelMat);
  boxFloor.position.set(0, boxFloorY + wallT / 2, boxCenterZ);
  boxFloor.castShadow = true;
  boxFloor.receiveShadow = true;
  boxGroup.add(boxFloor);

  // Front bulkhead of cargo box
  const boxFrontGeo = trackGeo(new THREE.BoxGeometry(spec.boxWidth, spec.boxHeight, wallT));
  const boxFront = new THREE.Mesh(boxFrontGeo, boxPaintMat);
  boxFront.position.set(0, boxMidY, boxFrontZ - wallT / 2);
  boxFront.castShadow = true;
  boxFront.receiveShadow = true;
  boxGroup.add(boxFront);
  boxShellMeshes.push(boxFront);

  // Roof of cargo box
  const boxRoofGeo = trackGeo(new THREE.BoxGeometry(spec.boxWidth, wallT, spec.boxLength));
  const boxRoof = new THREE.Mesh(boxRoofGeo, boxPaintMat);
  boxRoof.position.set(0, boxTopY - wallT / 2, boxCenterZ);
  boxRoof.castShadow = true;
  boxRoof.receiveShadow = true;
  boxGroup.add(boxRoof);
  boxShellMeshes.push(boxRoof);

  // Optional Uploaded Top Photo Panel on Box Roof
  const topPhotoMat = loadPhotoMaterial(fleet.photos3d?.top);
  if (topPhotoMat) {
    const topDecalGeo = trackGeo(
      new THREE.PlaneGeometry(spec.boxWidth - 0.14, spec.boxLength - 0.14)
    );
    topDecalGeo.rotateX(-Math.PI / 2);
    const topDecal = new THREE.Mesh(topDecalGeo, topPhotoMat);
    topDecal.position.set(0, boxTopY + 0.004, boxCenterZ);
    boxGroup.add(topDecal);
    boxShellMeshes.push(topDecal);
  }

  // Left & Right side walls with custom corporate livery texture
  const sideWallGeo = trackGeo(new THREE.BoxGeometry(wallT, spec.boxHeight - wallT * 1.5, spec.boxLength - wallT));
  const leftWall = new THREE.Mesh(sideWallGeo, liveryMat);
  leftWall.position.set(-spec.boxWidth / 2 + wallT / 2, boxMidY, boxCenterZ + wallT * 0.25);
  leftWall.castShadow = true;
  leftWall.receiveShadow = true;
  boxGroup.add(leftWall);
  boxShellMeshes.push(leftWall);

  const rightWall = new THREE.Mesh(sideWallGeo, liveryMat);
  rightWall.position.set(spec.boxWidth / 2 - wallT / 2, boxMidY, boxCenterZ + wallT * 0.25);
  rightWall.castShadow = true;
  rightWall.receiveShadow = true;
  boxGroup.add(rightWall);
  boxShellMeshes.push(rightWall);

  // Optional Uploaded Left & Right Box Photo Panels (upright PlaneGeometry oriented strictly outward)
  const sideDecalW = spec.boxLength - 0.16;
  const sideDecalH = spec.boxHeight - wallT * 2.1;
  const leftPhotoMat = loadPhotoMaterial(fleet.photos3d?.left);
  if (leftPhotoMat) {
    const leftDecalGeo = trackGeo(new THREE.PlaneGeometry(sideDecalW, sideDecalH));
    leftDecalGeo.rotateY(-Math.PI / 2);
    const leftDecal = new THREE.Mesh(leftDecalGeo, leftPhotoMat);
    leftDecal.position.set(-spec.boxWidth / 2 - 0.004, boxMidY, boxCenterZ + wallT * 0.25);
    boxGroup.add(leftDecal);
    boxShellMeshes.push(leftDecal);
  }

  const rightPhotoMat = loadPhotoMaterial(fleet.photos3d?.right);
  if (rightPhotoMat) {
    const rightDecalGeo = trackGeo(new THREE.PlaneGeometry(sideDecalW, sideDecalH));
    rightDecalGeo.rotateY(Math.PI / 2);
    const rightDecal = new THREE.Mesh(rightDecalGeo, rightPhotoMat);
    rightDecal.position.set(spec.boxWidth / 2 + 0.004, boxMidY, boxCenterZ + wallT * 0.25);
    boxGroup.add(rightDecal);
    boxShellMeshes.push(rightDecal);
  }

  // Corner extruded aluminum rail frame (always solid structural frame)
  const vRailGeo = trackGeo(new THREE.BoxGeometry(0.075, spec.boxHeight + 0.02, 0.075));
  const hSideRailGeo = trackGeo(new THREE.BoxGeometry(0.07, 0.07, spec.boxLength + 0.02));
  const hEndRailGeo = trackGeo(new THREE.BoxGeometry(spec.boxWidth + 0.02, 0.07, 0.07));

  [-spec.boxWidth / 2, spec.boxWidth / 2].forEach((rx) => {
    [boxFrontZ, boxRearZ].forEach((rz) => {
      const vr = new THREE.Mesh(vRailGeo, aluminumTrimMat);
      vr.position.set(rx, boxMidY, rz);
      vr.castShadow = true;
      boxGroup.add(vr);
    });
    [boxFloorY, boxTopY].forEach((ry) => {
      const hr = new THREE.Mesh(hSideRailGeo, aluminumTrimMat);
      hr.position.set(rx, ry, boxCenterZ);
      boxGroup.add(hr);
    });
  });

  [boxFrontZ, boxRearZ].forEach((rz) => {
    [boxFloorY, boxTopY].forEach((ry) => {
      const er = new THREE.Mesh(hEndRailGeo, aluminumTrimMat);
      er.position.set(0, ry, rz);
      boxGroup.add(er);
    });
  });

  // Top amber corner marker lamps on box
  const markerGeo = trackGeo(new THREE.BoxGeometry(0.08, 0.05, 0.06));
  [-spec.boxWidth * 0.44, spec.boxWidth * 0.44].forEach((mx) => {
    const frontMk = new THREE.Mesh(markerGeo, amberMarkerMat);
    frontMk.position.set(mx, boxTopY - 0.05, boxFrontZ + 0.01);
    boxGroup.add(frontMk);

    const rearMk = new THREE.Mesh(markerGeo, tailLightMat);
    rearMk.position.set(mx, boxTopY - 0.05, boxRearZ - 0.01);
    boxGroup.add(rearMk);
  });

  // Hinged Rear Cargo Doors (Left & Right Pivots)
  const doorW = spec.boxWidth / 2 - 0.04;
  const doorH = spec.boxHeight - 0.1;
  const doorGeo = trackGeo(new THREE.BoxGeometry(doorW, doorH, 0.05));
  const latchBarGeo = trackGeo(new THREE.CylinderGeometry(0.016, 0.016, doorH * 0.86, 8));

  const leftDoorPivot = new THREE.Group();
  leftDoorPivot.position.set(-spec.boxWidth / 2 + 0.02, boxMidY, boxRearZ);
  const leftDoor = new THREE.Mesh(doorGeo, boxPaintMat);
  leftDoor.position.set(doorW / 2, 0, 0);
  leftDoor.castShadow = true;
  leftDoorPivot.add(leftDoor);
  const leftLatch = new THREE.Mesh(latchBarGeo, aluminumTrimMat);
  leftLatch.position.set(doorW * 0.82, 0, -0.035);
  leftDoorPivot.add(leftLatch);
  boxGroup.add(leftDoorPivot);

  const rightDoorPivot = new THREE.Group();
  rightDoorPivot.position.set(spec.boxWidth / 2 - 0.02, boxMidY, boxRearZ);
  const rightDoor = new THREE.Mesh(doorGeo, boxPaintMat);
  rightDoor.position.set(-doorW / 2, 0, 0);
  rightDoor.castShadow = true;
  rightDoorPivot.add(rightDoor);
  const rightLatch = new THREE.Mesh(latchBarGeo, aluminumTrimMat);
  rightLatch.position.set(-doorW * 0.82, 0, -0.035);
  rightDoorPivot.add(rightLatch);

  // Rear license plate mounted on right door
  const rearPlateGeo = trackGeo(new THREE.BoxGeometry(0.42, 0.13, 0.02));
  const rearPlate = new THREE.Mesh(rearPlateGeo, plateMat);
  rearPlate.position.set(-doorW * 0.5, -doorH * 0.3, -0.035);
  rearPlate.rotation.y = Math.PI;
  rightDoorPivot.add(rearPlate);

  // Optional Uploaded Rear Photo Split across Left & Right Cargo Doors
  const rearPhotoMat = loadPhotoMaterial(fleet.photos3d?.rear);
  if (rearPhotoMat) {
    const rearDecalH = doorH - 0.12;
    const rearLeftGeo = trackGeo(new THREE.PlaneGeometry(doorW - 0.08, rearDecalH));
    // Left half UVs (u: 0.5..1 when facing rear? Rear is looking towards +Z from -Z: left side of image is on right side in world X=-door, wait: camera looks from -Z toward +Z, so screen-left is +X (rightDoorPivot) and screen-right is -X (leftDoorPivot)!)
    const uvR = rearLeftGeo.attributes.uv;
    uvR.setXY(0, 0.5, 1);
    uvR.setXY(1, 1.0, 1);
    uvR.setXY(2, 0.5, 0);
    uvR.setXY(3, 1.0, 0);
    rearLeftGeo.rotateY(Math.PI);
    const rearLeftDecal = new THREE.Mesh(rearLeftGeo, rearPhotoMat);
    rearLeftDecal.position.set(doorW / 2, 0, -0.031);
    leftDoorPivot.add(rearLeftDecal);

    const rearRightGeo = trackGeo(new THREE.PlaneGeometry(doorW - 0.08, rearDecalH));
    const uvL = rearRightGeo.attributes.uv;
    uvL.setXY(0, 0.0, 1);
    uvL.setXY(1, 0.5, 1);
    uvL.setXY(2, 0.0, 0);
    uvL.setXY(3, 0.5, 0);
    rearRightGeo.rotateY(Math.PI);
    const rearRightDecal = new THREE.Mesh(rearRightGeo, rearPhotoMat);
    rearRightDecal.position.set(-doorW / 2, 0, -0.031);
    rightDoorPivot.add(rearRightDecal);
  }

  boxGroup.add(rightDoorPivot);

  // 5. INNER PALLETIZED CARGO STACK (visible when doors open or X-Ray cutaway enabled)
  const cargoInnerGroup = new THREE.Group();
  const palletMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xc2956b, roughness: 0.85, metalness: 0.05 })
  );
  const cartonMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xd9a066, roughness: 0.72, metalness: 0.06 })
  );
  const wrapMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.35, metalness: 0.1 })
  );

  const cols = spec.category === 'pickup' ? 2 : spec.category === 'engkel_std' ? 3 : 4;
  const rows = spec.category === 'pickup' ? 1 : 2;
  const cellW = (spec.boxWidth - 0.32) / rows;
  const cellL = (spec.boxLength - 0.45) / cols;
  const pH = 0.10;
  const bH = Math.min(0.85, (spec.boxHeight - 0.32) * 0.72);

  const palletGeo = trackGeo(new THREE.BoxGeometry(cellW * 0.86, pH, cellL * 0.84));
  const cartonGeo = trackGeo(new THREE.BoxGeometry(cellW * 0.82, bH, cellL * 0.80));
  const strapGeo = trackGeo(new THREE.BoxGeometry(cellW * 0.84, 0.05, cellL * 0.82));

  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      const px = rows === 1 ? 0 : (r === 0 ? -cellW * 0.54 : cellW * 0.54);
      const pz = boxFrontZ - 0.35 - c * cellL - cellL * 0.42;

      const pal = new THREE.Mesh(palletGeo, palletMat);
      pal.position.set(px, boxFloorY + wallT + pH / 2, pz);
      cargoInnerGroup.add(pal);

      const boxCargo = new THREE.Mesh(cartonGeo, cartonMat);
      boxCargo.position.set(px, boxFloorY + wallT + pH + bH / 2, pz);
      cargoInnerGroup.add(boxCargo);

      const strap = new THREE.Mesh(strapGeo, wrapMat);
      strap.position.set(px, boxFloorY + wallT + pH + bH * 0.75, pz);
      cargoInnerGroup.add(strap);
    }
  }
  boxGroup.add(cargoInnerGroup);
  root.add(boxGroup);

  // Hotspot anchors matching Image 1's 3 inspection points (Cab, Box Cargo, Chassis/Wheels)
  const hotspotAnchors: TruckHotspotAnchor[] = [
    {
      id: 'cab',
      label: 'Kabin & Dokumen',
      localPosition: new THREE.Vector3(spec.cabWidth * 0.48, cabMinY + cH * 0.65, cabRearZ + cLen * 0.45),
      cameraOffset: new THREE.Vector3(3.3, 2.1, cabMaxZ + 2.6),
      targetOffset: new THREE.Vector3(0, cabMinY + cH * 0.5, cabRearZ + cLen * 0.5),
    },
    {
      id: 'cargo',
      label: 'Box Muatan & Kubikasi',
      localPosition: new THREE.Vector3(spec.boxWidth * 0.51, boxTopY - 0.32, boxCenterZ + spec.boxLength * 0.12),
      cameraOffset: new THREE.Vector3(4.2, 2.6, boxCenterZ - 1.2),
      targetOffset: new THREE.Vector3(0, boxMidY, boxCenterZ),
    },
    {
      id: 'chassis',
      label: 'Roda, BBM & Servis',
      localPosition: new THREE.Vector3(spec.boxWidth * 0.48, spec.wheelRadius + 0.18, rearAxleOffset + 0.45),
      cameraOffset: new THREE.Vector3(3.6, 1.3, rearAxleOffset + 1.8),
      targetOffset: new THREE.Vector3(0, spec.wheelRadius + 0.25, rearAxleOffset + 0.2),
    },
  ];

  // Ground truck flush on y = 0 (already grounded by wheel radius centers at y = spec.wheelRadius)
  root.updateMatrixWorld(true);
  const fullBox = new THREE.Box3().setFromObject(root);
  const yShift = -fullBox.min.y;
  if (Math.abs(yShift) > 0.0001) {
    root.position.y += yShift;
  }

  return {
    root,
    wheelGroups,
    leftDoorPivot,
    rightDoorPivot,
    boxShellMeshes,
    cargoInnerGroup,
    hotspotAnchors,
    sizeMetrics: {
      totalLength: totalTruckLen,
      totalWidth: spec.boxWidth,
      totalHeight: fullBox.max.y - fullBox.min.y,
      centerY: (fullBox.max.y - fullBox.min.y) * 0.45,
    },
    disposables,
  };
}

export function disposeBuiltTruck(rig: BuiltTruckRig | null) {
  if (!rig) return;
  rig.disposables.geometries.forEach((g) => g.dispose());
  rig.disposables.materials.forEach((m) => m.dispose());
  rig.disposables.textures.forEach((t) => t.dispose());
}
