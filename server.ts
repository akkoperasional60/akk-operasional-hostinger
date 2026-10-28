import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import * as XLSX from "xlsx";
import { query as mysqlQuery, testConnection as testMysqlConnection, isDatabaseConfigured } from "./server/db";

dotenv.config();

// Initialize Gemini Client if API key is present and not set to 'disabled'
const rawGeminiKey = String(process.env.GEMINI_API_KEY || '').trim();
const apiKey = rawGeminiKey && rawGeminiKey.toLowerCase() !== 'disabled' ? rawGeminiKey : '';
const genAI = apiKey ? new GoogleGenAI({ apiKey }) : null;

const BASE_SYSTEM_INSTRUCTION = `
Anda adalah "Operasional AI Assistant" untuk PT Anugrah Kemasan Kreatif (PT AKK Logistics Banyuwangi DC).
Anda bertugas menjawab pertanyaan seputar operasional logistik, armada truk, jadwal pengiriman, sopir/helper, BBM, tiket kapal penyeberangan, sparepart, dan SOP perusahaan secara profesional, cepat, ramah, dan akurat dalam bahasa Indonesia.

Informasi Utama PT AKK Logistics:
- Gudang Pusat (DC): Jl. Argopuro No.60, Lingkungan Sukowidi, Klatak, Kec. Kalipuro, Kab. Banyuwangi, Jawa Timur 68421.
- SOP & Aturan Utama:
  1. Rotasi Jeda Istirahat 24 Jam: Pengemudi yang telah menyelesaikan perjalanan luar kota jarak jauh (>300 km) atau rute penyeberangan antar-pulau wajib menjalani jeda istirahat 24 jam sebelum diperbolehkan bertugas kembali.
  2. Batas Maksimal 3x Area Berturut-turut: Driver yang ditugaskan di rute luar pulau (misal Lampung/Bali) selama 3 kali berturut-turut wajib mendapatkan persetujuan (approval) khusus dari Manager Logistik sebelum penugasan ke-4 demi mencegah kelelahan (fatigue audit).
  3. Verifikasi Tiket Penyeberangan: Pengiriman rute Bali/Luar Pulau wajib melampirkan kode booking tiket kapal ASDP Ferizy Pelabuhan Ketapang - Gilimanuk.
  4. Pengisian Uang Jalan & BBM: Alokasi BBM dihitung berdasarkan standar rasio km/liter per jenis truk (Pick Up 1:10, Engkel 1:7, Double 1:5). Wajib melampirkan foto nota BBM resmi dan odometer terkini.
  5. Perbaikan & Sparepart: Komponen kritis (kampas rem, oli, ban) diajukan melalui SPK Bengkel ke bagian Manajemen Sparepart.
  6. Pelacakan & Evaluasi Rute: Evaluasi jalur pengiriman armada terintegrasi melalui unggahan data rute GPS Excel dan pemetaan Jaringan Toko & Mitra.

Jawablah pertanyaan pengguna secara langsung, spesifik, padat, dan solutif berdasarkan konteks database MySQL aktif. Jangan mengarang plat nomor atau nama personel yang tidak ada di konteks database.
`;

async function buildLiveOperationalContext(): Promise<{ fleetContext: string; crewContext: string }> {
  if (!isDatabaseConfigured()) {
    return {
      fleetContext: 'Belum ada data armada dari Hostinger MySQL.',
      crewContext: 'Belum ada data kru dari Hostinger MySQL.'
    };
  }
  try {
    const [fleetRows, crewRows] = await Promise.all([
      mysqlQuery<any[]>("SELECT plate_number, vehicle_type, status FROM fleets ORDER BY plate_number ASC LIMIT 50"),
      mysqlQuery<any[]>("SELECT name, role, license_type, status FROM crews ORDER BY name ASC LIMIT 100")
    ]);
    const fleetContext = Array.isArray(fleetRows) && fleetRows.length > 0
      ? fleetRows.map(f => `- ${f.plate_number} (${f.vehicle_type || 'Armada'} • Status: ${f.status || 'available'})`).join('\n')
      : 'Belum ada armada terdaftar di database.';
    const crewContext = Array.isArray(crewRows) && crewRows.length > 0
      ? crewRows.map(c => `- ${c.name} (${c.role || 'Kru'} • ${c.license_type || '-'} • Status: ${c.status || 'available'})`).join('\n')
      : 'Belum ada personel kru terdaftar di database.';
    return { fleetContext, crewContext };
  } catch {
    return {
      fleetContext: 'Konteks armada MySQL sedang tidak dapat dibaca.',
      crewContext: 'Konteks kru MySQL sedang tidak dapat dibaca.'
    };
  }
}

const MODELS_TO_TRY = ['gemini-3.8-flash', 'gemini-flash-latest'];

async function generateChatReply(message: string, contextTab?: string, history?: any[]): Promise<string> {
  // Try calling Gemini API if SDK is available
  if (genAI) {
    const liveCtx = await buildLiveOperationalContext();
    const dynamicSystemInstruction = `${BASE_SYSTEM_INSTRUCTION}\n\nData Armada Aktif (Hostinger MySQL):\n${liveCtx.fleetContext}\n\nData Kru Terdaftar (Hostinger MySQL):\n${liveCtx.crewContext}`;

    const formattedHistory = Array.isArray(history) 
      ? history.map(h => ({
          role: h.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: h.content }]
        }))
      : [];

    const contents = [
      ...formattedHistory,
      { role: 'user', parts: [{ text: `[Konteks Modul Aktif: ${contextTab || 'Umum'}]\n${message}` }] }
    ];

    for (const modelName of MODELS_TO_TRY) {
      try {
        const response = await genAI.models.generateContent({
          model: modelName,
          contents,
          config: {
            systemInstruction: dynamicSystemInstruction,
            temperature: 0.7,
          }
        });

        if (response.text && response.text.trim().length > 0) {
          return response.text.trim();
        }
      } catch (err) {
        console.warn(`Gemini model ${modelName} call failed, trying next fallback:`, err);
      }
    }
  }

  // Fallback aman: jangan mengarang status operasional ketika Gemini tidak tersedia.
  return `AI Assistant sedang tidak terhubung ke Gemini. Saya tidak akan mengarang status armada, kru, jadwal, BBM, atau data operasional sebagai data realtime.

Silakan gunakan data pada Dashboard/Jadwal/Armada yang berasal dari Hostinger MySQL, atau konfigurasikan GEMINI_API_KEY untuk mengaktifkan jawaban AI.`;
}

async function startServer() {
  const app = express();

  app.use(express.json({ limit: '35mb' }));
  app.use(express.urlencoded({ limit: '35mb', extended: true }));

  // Enterprise Security Headers Middleware
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  // Hostinger MySQL Connection & Health Check API
  app.get("/api/db-status", async (_req, res) => {
    const configured = isDatabaseConfigured();
    const testResult = configured ? await testMysqlConnection() : { success: false, configured: false, message: 'Hostinger MySQL belum dikonfigurasi: DB_NAME, DB_USER, DB_PASSWORD belum diisi di environment variables.' };
    res.status(200).json({
      dbEngine: "Hostinger MySQL/MariaDB (mysql2)",
      configured,
      hasPasswordConfigured: Boolean(process.env.DB_PASSWORD),
      success: testResult.success,
      message: testResult.success ? 'Database Hostinger terhubung' : (testResult.message || 'Database Hostinger belum dapat diakses')
    });
  });

  const parseJsonColumn = (raw: any): any => {
    if (raw == null) return null;
    if (typeof raw === 'object') return raw;
    try { return JSON.parse(String(raw)); } catch { return null; }
  };

  const mergePayload = (raw: any, normalized: Record<string, any>) => ({
    ...(parseJsonColumn(raw) || {}),
    ...normalized
  });

  const normalizeIdentity = (value: any): string => String(value || '').trim().toLowerCase();

  const isScheduleAssignedToAuthUser = (schedule: any, user: any): boolean => {
    if (!schedule || !user) return false;
    const userId = normalizeIdentity(user.id);
    const userName = normalizeIdentity(user.full_name);
    const strippedUserId = userId.replace(/^(usr-|crw-)/, '');

    const candidateIds = [
      schedule.crewId, schedule.crew_id, schedule.crew?.id,
      schedule.crewHelperId, schedule.crew_helper_id, schedule.crewHelper?.id,
      schedule.crewHelper2Id, schedule.crew_helper2_id, schedule.crewHelper2?.id
    ].map(normalizeIdentity).filter(Boolean);

    const candidateNames = [
      schedule.crew?.name, schedule.crewName, schedule.crew_name,
      schedule.crewHelper?.name, schedule.crewHelperName, schedule.crew_helper_name,
      schedule.crewHelper2?.name, schedule.crewHelper2Name, schedule.crew_helper2_name
    ].map(normalizeIdentity).filter(Boolean);

    if (userId && candidateIds.some((id: string) => {
      const stripped = id.replace(/^(usr-|crw-)/, '');
      return id === userId || (strippedUserId.length >= 3 && stripped === strippedUserId);
    })) return true;

    return Boolean(userName && candidateNames.includes(userName));
  };

  const toMysqlDateTime = (value: any, fallback?: Date): string => {
    const d = value ? new Date(value) : (fallback || new Date());
    const safe = Number.isNaN(d.getTime()) ? (fallback || new Date()) : d;
    return safe.toISOString().slice(0, 19).replace('T', ' ');
  };

  const upsertScheduleRow = async (sch: any) => {
    if (!sch?.id) return;
    const tracking = String(sch.trackingNumber || sch.tracking_number || sch.id);
    const originCoords = Array.isArray(sch.originCoords) ? sch.originCoords : [-8.1906, 114.3708];
    await mysqlQuery(
      `INSERT INTO schedules (
         id, tracking_number, origin_name, origin_latitude, origin_longitude, store_id, fleet_id, crew_id,
         crew_helper_id, crew_helper2_id, status, departure_date, estimated_arrival, actual_arrival,
         cargo_description, cargo_weight_ton, is_inter_island, ferry_booking_code, transit_port, notes, payload_json
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         tracking_number=VALUES(tracking_number), origin_name=VALUES(origin_name), origin_latitude=VALUES(origin_latitude),
         origin_longitude=VALUES(origin_longitude), store_id=VALUES(store_id), fleet_id=VALUES(fleet_id), crew_id=VALUES(crew_id),
         crew_helper_id=VALUES(crew_helper_id), crew_helper2_id=VALUES(crew_helper2_id), status=VALUES(status),
         departure_date=VALUES(departure_date), estimated_arrival=VALUES(estimated_arrival), actual_arrival=VALUES(actual_arrival),
         cargo_description=VALUES(cargo_description), cargo_weight_ton=VALUES(cargo_weight_ton), is_inter_island=VALUES(is_inter_island),
         ferry_booking_code=VALUES(ferry_booking_code), transit_port=VALUES(transit_port), notes=VALUES(notes), payload_json=VALUES(payload_json)`,
      [
        String(sch.id), tracking, sch.originName || 'Gudang Pusat Banyuwangi DC', Number(originCoords[0] ?? -8.1906), Number(originCoords[1] ?? 114.3708),
        sch.storeId || null, sch.fleetId || null, sch.crewId || null, sch.crewHelperId || null, sch.crewHelper2Id || null,
        sch.status || 'scheduled', toMysqlDateTime(sch.departureDate), toMysqlDateTime(sch.estimatedArrival, new Date(Date.now() + 8 * 60 * 60 * 1000)),
        sch.actualArrival ? toMysqlDateTime(sch.actualArrival) : null, sch.cargoDescription || '-', Number(sch.cargoWeightTon || 0), sch.isInterIsland ? 1 : 0,
        sch.ferryBookingCode || null, sch.transitPort || null, sch.notes || null, JSON.stringify(sch)
      ]
    );
  };

  // Hostinger MySQL Authentication API
  const hashPassword = (password: string): string => {
    const salt = crypto.randomBytes(16).toString('hex');
    const digest = crypto.scryptSync(password, salt, 64).toString('hex');
    return `scrypt$${salt}$${digest}`;
  };

  const verifyPassword = (password: string, stored: string): boolean => {
    if (!stored) return false;
    if (!stored.startsWith('scrypt$')) {
      // One-time migration path only: a legacy plaintext DB value is upgraded after login.
      const storedBuf = Buffer.from(stored);
      const passwordBuf = Buffer.from(password);
      return storedBuf.length === passwordBuf.length && crypto.timingSafeEqual(storedBuf, passwordBuf);
    }
    const [, salt, expectedHex] = stored.split('$');
    if (!salt || !expectedHex) return false;
    const actual = crypto.scryptSync(password, salt, 64);
    const expected = Buffer.from(expectedHex, 'hex');
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
  };

  const SESSION_COOKIE = 'akk_session';
  const SESSION_TTL_SECONDS = 12 * 60 * 60;
  const getSessionSecret = (): string => {
    const explicit = String(process.env.SESSION_SECRET || '').trim();
    if (explicit.length >= 32) return explicit;
    if (explicit.length > 0) {
      return crypto.createHash('sha256').update(`akk-session:${explicit}`).digest('hex');
    }
    const dbSeed = `${process.env.DB_NAME || ''}:${process.env.DB_USER || ''}:${process.env.DB_PASSWORD || ''}`;
    if (process.env.DB_PASSWORD) {
      return crypto.createHash('sha256').update(`akk-db-fallback:${dbSeed}`).digest('hex');
    }
    if (process.env.NODE_ENV === 'production' && !process.env.K_SERVICE) return '';
    return 'akk-dev-session-secret-change-me-32chars';
  };
  const base64url = (value: string) => Buffer.from(value, 'utf8').toString('base64url');
  const signSession = (payload: string, secret: string) => crypto.createHmac('sha256', secret).update(payload).digest('base64url');

  const createSessionToken = (userId: string): string => {
    const secret = getSessionSecret();
    if (!secret) throw new Error('SESSION_SECRET belum dikonfigurasi');
    const payload = base64url(JSON.stringify({ uid: userId, exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS }));
    return `${payload}.${signSession(payload, secret)}`;
  };

  const readCookie = (req: any, name: string): string => {
    const raw = String(req.headers?.cookie || '');
    for (const chunk of raw.split(';')) {
      const idx = chunk.indexOf('=');
      if (idx < 0) continue;
      const key = chunk.slice(0, idx).trim();
      if (key === name) return decodeURIComponent(chunk.slice(idx + 1).trim());
    }
    return '';
  };

  const verifySessionToken = (token: string): { uid: string } | null => {
    const secret = getSessionSecret();
    if (!secret || !token || !token.includes('.')) return null;
    const [payload, signature] = token.split('.', 2);
    const expected = signSession(payload, secret);
    const a = Buffer.from(signature || '');
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    try {
      const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
      if (!decoded?.uid || Number(decoded.exp || 0) <= Math.floor(Date.now() / 1000)) return null;
      return { uid: String(decoded.uid) };
    } catch {
      return null;
    }
  };

  const setSessionCookie = (res: any, token: string) => {
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
    res.setHeader('Set-Cookie', `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}${secure}`);
  };

  const clearSessionCookie = (res: any) => {
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
    res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${secure}`);
  };

  // In-memory preview session store (HANYA untuk preview lokal/AI Studio).
  // Tidak ada credential default/hardcoded. Preview admin hanya aktif bila PREVIEW_ADMIN_*
  // (atau BOOTSTRAP_ADMIN_* pada database baru) sengaja diisi di environment preview.
  // Di production Hostinger, autentikasi selalu melalui MySQL.
  const previewAdminEmail = String(process.env.PREVIEW_ADMIN_EMAIL || process.env.BOOTSTRAP_ADMIN_EMAIL || '').trim().toLowerCase();
  const previewAdminPass = String(process.env.PREVIEW_ADMIN_PASSWORD || process.env.BOOTSTRAP_ADMIN_PASSWORD || '').trim();
  const previewAdminName = String(process.env.PREVIEW_ADMIN_NAME || process.env.BOOTSTRAP_ADMIN_NAME || 'Super Admin').trim() || 'Super Admin';
  const previewSessionUsers = new Map<string, any>();
  if (previewAdminEmail && previewAdminPass.length >= 8) {
    previewSessionUsers.set('usr-preview-admin', {
      id: 'usr-preview-admin',
      email: previewAdminEmail,
      password_hash: hashPassword(previewAdminPass),
      full_name: previewAdminName,
      role: 'super_admin',
      department: 'Manajemen & Direksi',
      phone: '',
      status: 'approved',
      created_at: new Date().toISOString(),
      approved_at: new Date().toISOString(),
      notes: 'Preview admin (environment only)'
    });
  }

  const getSessionUser = async (req: any): Promise<any | null> => {
    const parsed = verifySessionToken(readCookie(req, SESSION_COOKIE));
    if (!parsed) return null;
    if (previewSessionUsers.has(parsed.uid)) {
      return previewSessionUsers.get(parsed.uid) || null;
    }
    if (!isDatabaseConfigured()) {
      return null;
    }
    try {
      const rows = await mysqlQuery<any[]>(
        `SELECT id, email, full_name, role, department, phone, status, permissions_json, created_at, approved_at, approved_by, notes
         FROM users WHERE id = ? LIMIT 1`,
        [parsed.uid]
      );
      if (!Array.isArray(rows) || rows.length === 0) return null;
      const u = rows[0];
      if (String(u.status || '') !== 'approved') return null;
      return u;
    } catch (err: any) {
      if (process.env.K_SERVICE || process.env.NODE_ENV !== 'production') {
        return previewSessionUsers.get(parsed.uid) || null;
      }
      throw err;
    }
  };

  const requireAuth = async (req: any, res: any, next: any) => {
    try {
      const user = await getSessionUser(req);
      if (!user) return res.status(401).json({ success: false, error: 'Sesi login tidak valid atau telah berakhir' });
      req.authUser = user;
      next();
    } catch (err: any) {
      return res.status(503).json({ success: false, error: err?.message || 'Gagal memverifikasi sesi' });
    }
  };

  const requireSuperAdmin = async (req: any, res: any, next: any) => {
    await requireAuth(req, res, () => {
      if (req.authUser?.role !== 'super_admin') return res.status(403).json({ success: false, error: 'Akses khusus Super Admin' });
      next();
    });
  };

  const requireAnyRole = (...allowedRoles: string[]) => async (req: any, res: any, next: any) => {
    await requireAuth(req, res, () => {
      const role = String(req.authUser?.role || '');
      if (!allowedRoles.includes(role)) {
        return res.status(403).json({ success: false, error: 'Role akun tidak memiliki izin untuk melakukan perubahan ini' });
      }
      next();
    });
  };

  // Server-side RBAC: UI permissions alone are not a security boundary.
  const requireLogisticsWrite = requireAnyRole('super_admin', 'dispatcher', 'spv_logistik', 'operasional', 'pengiriman');
  const requireScheduleWrite = requireAnyRole('super_admin', 'dispatcher', 'spv_logistik', 'operasional', 'pengiriman', 'sales_admin');
  const requireScheduleStatusWrite = requireAnyRole('super_admin', 'dispatcher', 'spv_logistik', 'operasional', 'pengiriman', 'driver', 'crew_helper');
  const requireStoreWrite = requireAnyRole('super_admin', 'dispatcher', 'spv_logistik', 'operasional', 'pengiriman', 'sales_admin', 'marketing_offline');
  const requireWarehouseAccess = requireAnyRole('super_admin', 'dispatcher', 'spv_logistik', 'operasional', 'pengiriman', 'warehouse_admin');
  const requireAttendanceWrite = requireAnyRole('super_admin', 'dispatcher', 'spv_logistik', 'operasional', 'pengiriman', 'hr_admin', 'driver', 'crew_helper');

  const isValidCoordinatePair = (rawLat: any, rawLng: any): { valid: boolean; lat: number; lng: number } => {
    const lat = typeof rawLat === 'string' ? Number(rawLat.replace(',', '.').trim()) : Number(rawLat);
    const lng = typeof rawLng === 'string' ? Number(rawLng.replace(',', '.').trim()) : Number(rawLng);
    const valid =
      rawLat !== null &&
      rawLat !== undefined &&
      rawLat !== '' &&
      rawLng !== null &&
      rawLng !== undefined &&
      rawLng !== '' &&
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      lat >= -90 &&
      lat <= 90 &&
      lng >= -180 &&
      lng <= 180 &&
      !(lat === 0 && lng === 0);
    return { valid, lat, lng };
  };

  const ensureDatabaseSchema = async (): Promise<void> => {
    if (!isDatabaseConfigured()) return;
    const statements = [
      `CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(64) NOT NULL PRIMARY KEY,
        email VARCHAR(191) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        full_name VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'unassigned',
        department VARCHAR(100) DEFAULT 'Logistics Operations',
        phone VARCHAR(50) NULL,
        status VARCHAR(20) DEFAULT 'pending',
        approved_at DATETIME NULL,
        approved_by VARCHAR(191) NULL,
        notes TEXT NULL,
        permissions_json JSON NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      `CREATE TABLE IF NOT EXISTS fleets (
        id VARCHAR(64) NOT NULL PRIMARY KEY,
        plate_number VARCHAR(30) NOT NULL UNIQUE,
        vehicle_type VARCHAR(100) NOT NULL,
        tonnage_capacity DECIMAL(5,2) NOT NULL DEFAULT 0.00,
        current_tonnage DECIMAL(5,2) DEFAULT 0.00,
        status ENUM('available', 'on-duty', 'maintenance') DEFAULT 'available',
        gps_imei VARCHAR(100) NULL,
        fuel_level_percent INT DEFAULT 100,
        odometer_km INT DEFAULT 0,
        year INT DEFAULT 2024,
        last_maintenance DATE NULL,
        payload_json JSON NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      `CREATE TABLE IF NOT EXISTS crews (
        id VARCHAR(64) NOT NULL PRIMARY KEY,
        name VARCHAR(191) NOT NULL,
        phone VARCHAR(50) NOT NULL,
        role VARCHAR(50) NOT NULL,
        license_number VARCHAR(100) NOT NULL,
        license_type VARCHAR(50) NOT NULL,
        status ENUM('available', 'on-duty', 'off') DEFAULT 'available',
        trips_completed INT DEFAULT 0,
        rating DECIMAL(3,2) DEFAULT 5.00,
        payload_json JSON NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      `CREATE TABLE IF NOT EXISTS stores (
        id VARCHAR(64) NOT NULL PRIMARY KEY,
        store_code VARCHAR(50) NOT NULL UNIQUE,
        store_name VARCHAR(191) NOT NULL,
        island VARCHAR(100) NOT NULL,
        province VARCHAR(100) NOT NULL,
        city VARCHAR(100) NOT NULL,
        address TEXT NOT NULL,
        latitude DECIMAL(10, 8) NOT NULL,
        longitude DECIMAL(11, 8) NOT NULL,
        contact_person VARCHAR(100) NOT NULL,
        phone VARCHAR(50) NOT NULL,
        delivery_window VARCHAR(50) DEFAULT '08:00 - 17:00',
        store_category VARCHAR(50) DEFAULT 'Supermarket',
        payload_json JSON NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      `CREATE TABLE IF NOT EXISTS schedules (
        id VARCHAR(64) NOT NULL PRIMARY KEY,
        tracking_number VARCHAR(100) NOT NULL UNIQUE,
        origin_name VARCHAR(191) DEFAULT 'Gudang Pusat Banyuwangi DC',
        origin_latitude DECIMAL(10, 8) DEFAULT -8.19060000,
        origin_longitude DECIMAL(11, 8) DEFAULT 114.37080000,
        store_id VARCHAR(64) NULL,
        fleet_id VARCHAR(64) NULL,
        crew_id VARCHAR(64) NULL,
        crew_helper_id VARCHAR(64) NULL,
        crew_helper2_id VARCHAR(64) NULL,
        status VARCHAR(30) DEFAULT 'scheduled',
        departure_date DATETIME NOT NULL,
        estimated_arrival DATETIME NOT NULL,
        actual_arrival DATETIME NULL,
        cargo_description TEXT NOT NULL,
        cargo_weight_ton DECIMAL(5,2) NOT NULL DEFAULT 0.00,
        is_inter_island TINYINT(1) DEFAULT 0,
        ferry_booking_code VARCHAR(100) NULL,
        transit_port VARCHAR(100) NULL,
        notes TEXT NULL,
        payload_json JSON NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      `CREATE TABLE IF NOT EXISTS tracking_logs (
        id VARCHAR(64) NOT NULL PRIMARY KEY,
        schedule_id VARCHAR(64) NOT NULL,
        timestamp DATETIME NOT NULL,
        latitude DECIMAL(10, 8) NOT NULL,
        longitude DECIMAL(11, 8) NOT NULL,
        speed DECIMAL(5, 2) DEFAULT 0.00,
        engine_status ENUM('RUNNING', 'STOP', 'IDLE') DEFAULT 'IDLE',
        location_name VARCHAR(255) NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      `CREATE TABLE IF NOT EXISTS databridge_sync_logs (
        id VARCHAR(64) NOT NULL PRIMARY KEY,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        status ENUM('success', 'warning', 'error', 'in_progress') DEFAULT 'success',
        source_type VARCHAR(100) DEFAULT 'google_sheets_api',
        sheet_name VARCHAR(100) NULL,
        stores_count INT DEFAULT 0,
        schedules_count INT DEFAULT 0,
        fleets_count INT DEFAULT 0,
        crews_count INT DEFAULT 0,
        details JSON NULL,
        message TEXT NULL,
        duration_ms INT DEFAULT 0
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      `CREATE TABLE IF NOT EXISTS spare_parts (
        id VARCHAR(64) NOT NULL PRIMARY KEY,
        code VARCHAR(50) NOT NULL UNIQUE,
        name VARCHAR(191) NOT NULL,
        category VARCHAR(100) NOT NULL,
        stock INT DEFAULT 0,
        min_stock INT DEFAULT 5,
        unit_price DECIMAL(12,2) DEFAULT 0.00,
        supplier VARCHAR(191) NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      `CREATE TABLE IF NOT EXISTS fuel_logs (
        id VARCHAR(64) NOT NULL PRIMARY KEY,
        fleet_id VARCHAR(64) NOT NULL,
        driver_name VARCHAR(191) NOT NULL,
        fuel_liters DECIMAL(8,2) NOT NULL,
        cost_rupiah DECIMAL(12,2) NOT NULL,
        odometer_km INT NOT NULL,
        spbu_location VARCHAR(191) NOT NULL,
        logged_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      `CREATE TABLE IF NOT EXISTS app_state (
        state_key VARCHAR(100) NOT NULL PRIMARY KEY,
        state_json JSON NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      `CREATE TABLE IF NOT EXISTS attendance (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        crew_id VARCHAR(64) NOT NULL,
        date DATE NOT NULL,
        status VARCHAR(30) NOT NULL DEFAULT 'present',
        reason TEXT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_attendance_crew_date (crew_id, date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    ];
    for (const sql of statements) {
      try {
        await mysqlQuery(sql);
      } catch (err: any) {
        console.warn('[Database Schema] Gagal memastikan tabel:', err?.message || err);
      }
    }
  };

  const ensureBootstrapAdmin = async (): Promise<void> => {
    if (!isDatabaseConfigured()) return;
    try {
      // Bootstrap hanya boleh membuat Super Admin PERTAMA. Begitu sudah ada Super Admin
      // approved di MySQL, ENV bootstrap tidak boleh mengubah password/email atau membuat duplikat.
      const existingAdmins = await mysqlQuery<any[]>(
        `SELECT id, email FROM users WHERE role = 'super_admin' AND status = 'approved' ORDER BY created_at ASC LIMIT 1`
      );
      if (Array.isArray(existingAdmins) && existingAdmins.length > 0) {
        console.log('[Bootstrap Admin] Super Admin sudah aktif di database. Demi keamanan, BOOTSTRAP_ADMIN_* diabaikan dan sebaiknya dihapus dari Hostinger ENV.');
        return;
      }

      const email = String(process.env.BOOTSTRAP_ADMIN_EMAIL || '').trim().toLowerCase();
      const password = String(process.env.BOOTSTRAP_ADMIN_PASSWORD || '').trim();
      const fullName = String(process.env.BOOTSTRAP_ADMIN_NAME || 'Super Admin').trim() || 'Super Admin';

      // Bootstrap TIDAK BOLEH membuat akun dengan credential default/hardcoded.
      if (!email || password.length < 12) {
        console.warn('[Bootstrap Admin] Belum ada Super Admin approved. Untuk database BARU, isi BOOTSTRAP_ADMIN_EMAIL dan BOOTSTRAP_ADMIN_PASSWORD (minimal 12 karakter), lalu hapus ENV bootstrap setelah login pertama berhasil.');
        return;
      }

      const id = `usr-bootstrap-${crypto.createHash('sha256').update(email).digest('hex').slice(0, 16)}`;
      await mysqlQuery(
        `INSERT INTO users (id, email, password_hash, full_name, role, department, status, approved_at, notes)
         VALUES (?, ?, ?, ?, 'super_admin', 'Manajemen & Direksi', 'approved', NOW(), 'Bootstrap Hostinger')
         ON DUPLICATE KEY UPDATE
           password_hash = VALUES(password_hash),
           full_name = VALUES(full_name),
           role = 'super_admin',
           status = 'approved',
           approved_at = COALESCE(approved_at, NOW()),
           updated_at = NOW()`,
        [id, email, hashPassword(password), fullName]
      );
      console.log(`[Bootstrap Admin] Super Admin pertama (${email}) berhasil dibuat. Setelah login berhasil, HAPUS seluruh BOOTSTRAP_ADMIN_* dari Hostinger ENV.`);
    } catch (err: any) {
      console.warn('[Bootstrap Admin] Gagal memastikan Super Admin:', err?.message || err);
    }
  };

  const parsePermissionsJson = (raw: any) => {
    if (!raw) return undefined;
    if (typeof raw === 'object') return raw;
    try {
      return JSON.parse(String(raw));
    } catch {
      return undefined;
    }
  };

  const publicUser = (u: any) => ({
    id: u.id,
    email: u.email,
    name: u.role === 'super_admin' ? 'Super Admin' : u.full_name,
    fullName: u.role === 'super_admin' ? 'Super Admin' : u.full_name,
    role: u.role,
    department: u.department || 'Logistics Operations',
    phone: u.phone || '',
    status: u.status || 'pending',
    createdAt: u.created_at || undefined,
    approvedAt: u.approved_at || undefined,
    approvedBy: u.approved_by || undefined,
    notes: u.notes || undefined,
    permissions: parsePermissionsJson(u.permissions_json ?? u.permissions)
  });

  const handlePreviewLogin = (loginIdentifier: string, cleanPass: string, res: any) => {
    const cleanId = loginIdentifier.trim().toLowerCase();
    if (!cleanId || cleanPass.length < 6) {
      return res.status(401).json({ success: false, error: 'Email/username atau password salah' });
    }

    let matchedUser: any = null;
    for (const u of previewSessionUsers.values()) {
      const uEmail = String(u.email || '').trim().toLowerCase();
      const uPrefix = uEmail.split('@')[0];
      const uName = String(u.full_name || '').trim().toLowerCase();
      if (
        cleanId === uEmail ||
        cleanId === String(u.id || '').toLowerCase() ||
        cleanId === uPrefix ||
        cleanId === uName ||
        (u.role === 'super_admin' && ['admin', 'superadmin', 'super admin'].includes(cleanId))
      ) {
        matchedUser = u;
        break;
      }
    }

    if (!matchedUser) {
      return res.status(401).json({ success: false, error: 'Email/username atau password salah' });
    }
    if (String(matchedUser.status || 'approved') !== 'approved') {
      return res.status(403).json({ success: false, error: `Akun berstatus ${matchedUser.status || 'pending'} dan belum dapat login` });
    }
    if (!verifyPassword(cleanPass, String(matchedUser.password_hash || ''))) {
      return res.status(401).json({ success: false, error: 'Email/username atau password salah' });
    }

    const token = createSessionToken(String(matchedUser.id));
    setSessionCookie(res, token);
    return res.json({ success: true, source: 'preview_session', user: publicUser(matchedUser) });
  };

  app.post('/api/auth/login', async (req, res) => {
    const { email, identifier, password } = req.body || {};
    const loginIdentifier = String(identifier || email || '').trim().toLowerCase();
    if (!loginIdentifier || !password) {
      return res.status(400).json({ success: false, error: 'Email/username dan password wajib diisi' });
    }
    const cleanPass = String(password);

    if (!isDatabaseConfigured()) {
      return handlePreviewLogin(loginIdentifier, cleanPass, res);
    }

    try {
      await ensureDatabaseSchema();
      const queryUserSql = `SELECT id, email, password_hash, full_name, role, department, phone, status, permissions_json, created_at, approved_at, approved_by, notes
         FROM users
         WHERE LOWER(email) = ? OR LOWER(id) = ? OR LOWER(SUBSTRING_INDEX(email, '@', 1)) = ?
            OR LOWER(full_name) = ? OR LOWER(SUBSTRING_INDEX(full_name, ' ', 1)) = ?
         LIMIT 1`;
      const queryParams = [loginIdentifier, loginIdentifier, loginIdentifier, loginIdentifier, loginIdentifier];

      let mysqlUsers = await mysqlQuery<any[]>(queryUserSql, queryParams);
      if (!Array.isArray(mysqlUsers) || mysqlUsers.length === 0) {
        await ensureBootstrapAdmin();
        mysqlUsers = await mysqlQuery<any[]>(queryUserSql, queryParams);
      }

      if (!Array.isArray(mysqlUsers) || mysqlUsers.length === 0) {
        const countRows = await mysqlQuery<any[]>(`SELECT COUNT(*) AS total FROM users`);
        const totalUsers = Number(countRows?.[0]?.total || 0);
        if (totalUsers === 0) {
          return res.status(503).json({
            success: false,
            error: 'Database belum memiliki akun. Aktifkan BOOTSTRAP_ADMIN_* sementara di Hostinger untuk membuat Super Admin pertama.'
          });
        }
        return res.status(401).json({ success: false, error: 'Email/username atau password salah' });
      }
      const u = mysqlUsers[0];
      if (String(u.status || '') !== 'approved') {
        return res.status(403).json({ success: false, error: `Akun berstatus ${u.status || 'pending'} dan belum dapat login` });
      }
      if (!verifyPassword(cleanPass, String(u.password_hash || ''))) {
        return res.status(401).json({ success: false, error: 'Email/username atau password salah' });
      }
      if (!String(u.password_hash || '').startsWith('scrypt$')) {
        await mysqlQuery('UPDATE users SET password_hash = ? WHERE id = ?', [hashPassword(cleanPass), u.id]);
      }
      const token = createSessionToken(String(u.id));
      setSessionCookie(res, token);
      return res.json({ success: true, source: 'hostinger_mysql', user: publicUser(u) });
    } catch (err: any) {
      const errMsg = String(err?.message || err || '');
      const isPreviewEnv = Boolean(process.env.K_SERVICE) || process.env.NODE_ENV !== 'production';
      if (isPreviewEnv && (errMsg.includes('ECONNREFUSED') || errMsg.includes('ENOTFOUND') || errMsg.includes('ETIMEDOUT'))) {
        return handlePreviewLogin(loginIdentifier, cleanPass, res);
      }
      console.warn('[Auth MySQL Warning]', errMsg);
      return res.status(503).json({
        success: false,
        error: `Database Hostinger belum dapat diakses (${errMsg || 'Koneksi MySQL gagal'}). Periksa DB_NAME, DB_USER, dan DB_PASSWORD di Hostinger.`
      });
    }
  });

  app.post('/api/auth/register', async (req, res) => {
    const { fullName, email, phone, department, password } = req.body || {};
    const cleanName = String(fullName || '').trim();
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanPassword = String(password || '');
    if (!cleanName || !cleanEmail || !cleanEmail.includes('@') || cleanPassword.length < 8) {
      return res.status(400).json({ success: false, error: 'Nama, email valid, dan password minimal 8 karakter wajib diisi' });
    }
    try {
      await ensureDatabaseSchema();
      const countRows = await mysqlQuery<any[]>(`SELECT COUNT(*) AS total FROM users`);
      const isFirstUser = Number(countRows?.[0]?.total || 0) === 0;
      const assignedRole = isFirstUser ? 'super_admin' : 'unassigned';
      const assignedStatus = isFirstUser ? 'approved' : 'pending';
      const id = `usr-${crypto.randomBytes(6).toString('hex')}`;
      await mysqlQuery(
        `INSERT INTO users (id, email, password_hash, full_name, role, department, phone, status, created_at, approved_at, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), ${isFirstUser ? 'NOW()' : 'NULL'}, ?)`,
        [
          id,
          cleanEmail,
          hashPassword(cleanPassword),
          cleanName,
          assignedRole,
          String(department || (isFirstUser ? 'Manajemen & Direksi' : 'Logistik')),
          String(phone || ''),
          assignedStatus,
          isFirstUser ? 'Inisialisasi Super Admin Pertama' : 'Pendaftaran mandiri - menunggu persetujuan Super Admin'
        ]
      );
      const rows = await mysqlQuery<any[]>('SELECT id, email, full_name, role, department, phone, status, permissions_json, created_at, approved_at, notes FROM users WHERE id = ? LIMIT 1', [id]);
      return res.status(201).json({ success: true, source: 'hostinger_mysql', user: publicUser(rows[0]) });
    } catch (err: any) {
      const errMsg = String(err?.message || '');
      const isPreviewEnv = Boolean(process.env.K_SERVICE) || process.env.NODE_ENV !== 'production';
      if (isPreviewEnv && (errMsg.includes('ECONNREFUSED') || errMsg.includes('ENOTFOUND') || errMsg.includes('ETIMEDOUT'))) {
        const id = `usr-${crypto.randomBytes(6).toString('hex')}`;
        const previewUser = {
          id,
          email: cleanEmail,
          password_hash: hashPassword(cleanPassword),
          full_name: cleanName,
          role: 'unassigned',
          department: String(department || 'Logistik'),
          phone: String(phone || ''),
          status: 'pending',
          created_at: new Date().toISOString(),
          notes: 'Pendaftaran mandiri - menunggu persetujuan Super Admin'
        };
        previewSessionUsers.set(id, previewUser);
        return res.status(201).json({ success: true, source: 'preview_session', user: publicUser(previewUser) });
      }
      const duplicate = String(err?.code || '').includes('DUP_ENTRY') || errMsg.toLowerCase().includes('duplicate');
      return res.status(duplicate ? 409 : 503).json({ success: false, error: duplicate ? 'Email sudah terdaftar' : (err?.message || 'Gagal mendaftarkan akun') });
    }
  });

  app.get('/api/auth/me', async (req, res) => {
    try {
      const user = await getSessionUser(req);
      if (!user) return res.status(401).json({ success: false, error: 'Sesi tidak aktif' });
      return res.json({ success: true, backend: 'hostinger_mysql', user: publicUser(user) });
    } catch (err: any) {
      return res.status(503).json({ success: false, error: err?.message || 'Gagal membaca sesi' });
    }
  });

  app.post('/api/auth/logout', (_req, res) => {
    clearSessionCookie(res);
    res.json({ success: true, message: 'Logged out successfully' });
  });

  // User Management is persisted in Hostinger MySQL and restricted to Super Admin.
  app.get('/api/users', requireSuperAdmin, async (_req, res) => {
    try {
      await ensureBootstrapAdmin();
      const rows = await mysqlQuery<any[]>(`SELECT id, email, full_name, role, department, phone, status, permissions_json, created_at, approved_at, approved_by, notes FROM users ORDER BY created_at DESC, full_name ASC`);
      return res.json({ success: true, source: 'hostinger_mysql', data: rows.map(publicUser) });
    } catch (err: any) {
      return res.status(503).json({ success: false, error: err?.message || 'Gagal membaca pengguna' });
    }
  });

  app.post('/api/users', requireSuperAdmin, async (req: any, res) => {
    const data = req.body || {};
    const cleanName = String(data.fullName || data.name || '').trim();
    const cleanEmail = String(data.email || '').trim().toLowerCase();
    const cleanPassword = String(data.password || '');
    const allowedRoles = new Set(['super_admin','dispatcher','spv_logistik','operasional','pengiriman','security','driver','crew_helper','sales_admin','purchasing_admin','hr_admin','finance_tax_admin','warehouse_admin','marketing_online','marketing_offline','unassigned']);
    const allowedStatuses = new Set(['pending','approved','rejected','inactive']);
    const role = allowedRoles.has(String(data.role)) ? String(data.role) : 'unassigned';
    const status = allowedStatuses.has(String(data.status)) ? String(data.status) : 'pending';
    if (!cleanName || !cleanEmail || !cleanEmail.includes('@') || cleanPassword.length < 8) {
      return res.status(400).json({ success: false, error: 'Nama, email valid, dan password minimal 8 karakter wajib diisi' });
    }
    const id = String(data.id || `usr-${crypto.randomBytes(6).toString('hex')}`);
    const permissionsJson = data.permissions ? JSON.stringify(data.permissions) : null;
    try {
      await mysqlQuery(
        `INSERT INTO users (id, email, password_hash, full_name, role, department, phone, status, permissions_json, approved_at, approved_by, notes, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [id, cleanEmail, hashPassword(cleanPassword), cleanName, role, String(data.department || 'Logistik'), String(data.phone || ''), status,
         permissionsJson, status === 'approved' ? new Date() : null, status === 'approved' ? (req.authUser?.full_name || 'Super Admin') : null, data.notes || null]
      );
      const rows = await mysqlQuery<any[]>('SELECT id, email, full_name, role, department, phone, status, permissions_json, created_at, approved_at, approved_by, notes FROM users WHERE id = ? LIMIT 1', [id]);
      return res.status(201).json({ success: true, source: 'hostinger_mysql', user: publicUser(rows[0]) });
    } catch (err: any) {
      const errMsg = String(err?.message || '');
      const isPreviewEnv = Boolean(process.env.K_SERVICE) || process.env.NODE_ENV !== 'production';
      if (isPreviewEnv && (errMsg.includes('ECONNREFUSED') || errMsg.includes('ENOTFOUND') || errMsg.includes('ETIMEDOUT'))) {
        const previewUser = {
          id,
          email: cleanEmail,
          password_hash: hashPassword(cleanPassword),
          full_name: cleanName,
          role,
          department: String(data.department || 'Logistik'),
          phone: String(data.phone || ''),
          status,
          permissions_json: permissionsJson,
          created_at: new Date().toISOString(),
          approved_at: status === 'approved' ? new Date().toISOString() : null,
          approved_by: status === 'approved' ? 'Super Admin' : null,
          notes: data.notes || null
        };
        previewSessionUsers.set(id, previewUser);
        return res.status(201).json({ success: true, source: 'preview_session', user: publicUser(previewUser) });
      }
      const duplicate = String(err?.code || '').includes('DUP_ENTRY') || errMsg.toLowerCase().includes('duplicate');
      return res.status(duplicate ? 409 : 503).json({ success: false, error: duplicate ? 'Email sudah terdaftar' : (err?.message || 'Gagal membuat pengguna') });
    }
  });

  app.put('/api/users/:id', requireSuperAdmin, async (req: any, res) => {
    const id = req.params.id;
    const data = req.body || {};
    const allowedRoles = new Set(['super_admin','dispatcher','spv_logistik','operasional','pengiriman','security','driver','crew_helper','sales_admin','purchasing_admin','hr_admin','finance_tax_admin','warehouse_admin','marketing_online','marketing_offline','unassigned']);
    const allowedStatuses = new Set(['pending','approved','rejected','inactive']);
    if (data.role !== undefined && !allowedRoles.has(String(data.role))) return res.status(400).json({ success: false, error: 'Role tidak valid' });
    if (data.status !== undefined && !allowedStatuses.has(String(data.status))) return res.status(400).json({ success: false, error: 'Status tidak valid' });
    try {
      const existing = await mysqlQuery<any[]>('SELECT * FROM users WHERE id = ? LIMIT 1', [id]);
      if (!Array.isArray(existing) || existing.length === 0) return res.status(404).json({ success: false, error: 'User tidak ditemukan' });
      const u = existing[0];
      const nextStatus = data.status ?? u.status;
      const approvedAt = nextStatus === 'approved' ? (u.approved_at || new Date()) : u.approved_at;
      const approvedBy = nextStatus === 'approved' ? (data.approvedBy || req.authUser?.full_name || u.approved_by) : u.approved_by;
      const permissionsJson = data.permissions !== undefined ? JSON.stringify(data.permissions) : u.permissions_json;
      await mysqlQuery(
        `UPDATE users SET email=?, full_name=?, role=?, department=?, phone=?, status=?, permissions_json=?, notes=?, approved_at=?, approved_by=?, updated_at=NOW() WHERE id=?`,
        [
          String(data.email ?? u.email).trim().toLowerCase(), String(data.fullName ?? data.name ?? u.full_name).trim(), data.role ?? u.role,
          data.department ?? u.department, data.phone ?? u.phone, nextStatus, permissionsJson, data.notes ?? u.notes, approvedAt, approvedBy, id
        ]
      );
      const rows = await mysqlQuery<any[]>('SELECT id, email, full_name, role, department, phone, status, permissions_json, created_at, approved_at, approved_by, notes FROM users WHERE id = ? LIMIT 1', [id]);
      return res.json({ success: true, source: 'hostinger_mysql', user: publicUser(rows[0]) });
    } catch (err: any) {
      const errMsg = String(err?.message || '');
      const isPreviewEnv = Boolean(process.env.K_SERVICE) || process.env.NODE_ENV !== 'production';
      if (isPreviewEnv && (errMsg.includes('ECONNREFUSED') || errMsg.includes('ENOTFOUND') || errMsg.includes('ETIMEDOUT'))) {
        const existingPreview = previewSessionUsers.get(id);
        if (existingPreview) {
          const updatedPreview = {
            ...existingPreview,
            email: String(data.email ?? existingPreview.email).trim().toLowerCase(),
            full_name: String(data.fullName ?? data.name ?? existingPreview.full_name).trim(),
            role: data.role ?? existingPreview.role,
            department: data.department ?? existingPreview.department,
            phone: data.phone ?? existingPreview.phone,
            status: data.status ?? existingPreview.status,
            permissions_json: data.permissions !== undefined ? JSON.stringify(data.permissions) : existingPreview.permissions_json,
            notes: data.notes ?? existingPreview.notes
          };
          previewSessionUsers.set(id, updatedPreview);
          return res.json({ success: true, source: 'preview_session', user: publicUser(updatedPreview) });
        }
      }
      return res.status(503).json({ success: false, error: err?.message || 'Gagal memperbarui pengguna' });
    }
  });

  app.post('/api/users/:id/password', requireSuperAdmin, async (req, res) => {
    const password = String(req.body?.password || '');
    if (password.length < 8) return res.status(400).json({ success: false, error: 'Password minimal 8 karakter' });
    try {
      const result: any = await mysqlQuery('UPDATE users SET password_hash=?, updated_at=NOW() WHERE id=?', [hashPassword(password), req.params.id]);
      if (!Number(result?.affectedRows || 0)) return res.status(404).json({ success: false, error: 'User tidak ditemukan' });
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(503).json({ success: false, error: err?.message || 'Gagal reset password' });
    }
  });

  app.delete('/api/users/:id', requireSuperAdmin, async (req: any, res) => {
    if (String(req.authUser?.id) === String(req.params.id)) return res.status(400).json({ success: false, error: 'Super Admin tidak dapat menghapus akun yang sedang digunakan' });
    try {
      const result: any = await mysqlQuery('DELETE FROM users WHERE id = ?', [req.params.id]);
      return res.json({ success: true, removed: Number(result?.affectedRows || 0) });
    } catch (err: any) {
      return res.status(503).json({ success: false, error: err?.message || 'Gagal menghapus pengguna' });
    }
  });

  // API route for Chat
  app.post("/api/chat", requireAuth, async (req, res) => {
    const { message, history, contextTab } = req.body;
    try {
      const reply = await generateChatReply(message || '', contextTab, history);
      res.json({ reply });
    } catch (error) {
      console.error("Chat API error:", error);
      res.status(500).json({ error: "Failed to get response" });
    }
  });

  // API route for Warehouse Gemini AI Vision Scan
  app.post("/api/warehouse/ai-vision-scan", requireWarehouseAccess, async (req, res) => {
    const { photoDataUrl, mode } = req.body || {};
    try {
      if (!genAI) {
        return res.status(503).json({
          success: false,
          error: 'GEMINI_API_KEY belum dikonfigurasi. Scan AI tidak dijalankan agar sistem tidak mengarang hasil QC/slotting.'
        });
      }

      let mimeType = 'image/jpeg';
      let base64Data = '';
      if (typeof photoDataUrl === 'string' && photoDataUrl.includes('base64,')) {
        const parts = photoDataUrl.split('base64,');
        const mimeMatch = parts[0].match(/:(.*?);/);
        if (mimeMatch) mimeType = mimeMatch[1];
        base64Data = parts[1];
      }

      const prompt = `
Anda adalah AI Vision Quality Control & Slotting Inspector untuk pergudangan PT Anugrah Kemasan Kreatif (AKK).
Gudang AKK memiliki 2 Lantai:
- Lantai 1 (Ground Floor): Khusus Karton Box Corrugated besar, berat, fast-moving, palet utuh (Bin A-01 s/d A-04, B-01 s/d B-04, C-01 s/d C-04). Rak memiliki 4 level: Level 1 (Ground Pallet), Level 2 (Middle Picking), Level 3 (Buffer), Level 4 (Top Overstock).
- Lantai 2 (Mezzanine): Khusus Kemasan Food Grade (Ivory/Kraft), Paper Cup & Lid, Lakban, Strapping Band, Aksesoris kemasan ringan (Bin E-01 s/d E-04, F-01 s/d F-04, G-01 s/d G-04). Rak memiliki 3 level: Level 1 (Hand Pick Lower), Level 2 (Hand Pick Upper), Level 3 (Top Shelf).

Analisis foto kemasan barang/karton berikut untuk proses ${mode || 'INBOUND'}:
Kembalikan respon DALAM FORMAT JSON MURNI TANPA MARKDOWN BACKTICKS:
{
  "skuCode": "string (contoh: AKK-KBX-001, AKK-KBX-003, AKK-PLS-014, atau kode barcode terlihat)",
  "skuName": "string nama spesifikasi barang kemasan",
  "category": "Karton Box" | "Food Grade" | "Plastik & Wrap" | "Cup & Lid" | "Lakban & Aksesoris",
  "detectedQty": 100,
  "unit": "Pcs" | "Roll" | "Ball" | "Karton",
  "qcStatus": "QC Lolos (100%)",
  "suggestedFloor": 1,
  "suggestedBin": "string (misal A-01-L1 untuk lantai 1, atau E-02-L2 untuk lantai 2)",
  "suggestedLevel": "string level rak",
  "reasoning": "string alasan penempatan lantai dan rak"
}
`;

      const contents: any[] = [
        {
          role: 'user',
          parts: [
            ...(base64Data ? [{ inlineData: { mimeType, data: base64Data } }] : []),
            { text: prompt }
          ]
        }
      ];

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Gemini API call timed out")), 4500)
      );

      const result = await Promise.race([
        genAI.models.generateContent({
          model: 'gemini-3.8-flash',
          contents,
          config: {
            temperature: 0.2,
            responseMimeType: 'application/json'
          }
        }),
        timeoutPromise
      ]);

      const text = result.text ? result.text.trim() : '{}';
      const parsed = JSON.parse(text);
      return res.json({ success: true, analysis: parsed });
    } catch (err: any) {
      console.warn("AI Vision scan error:", err?.message || err);
      return res.status(502).json({
        success: false,
        error: 'Analisis AI Vision gagal. Tidak ada data contoh yang dipakai sebagai hasil scan nyata.'
      });
    }
  });

  // API route for Warehouse Gemini AI Slotting Advisor
  app.post("/api/warehouse/ai-slotting-advisor", requireWarehouseAccess, async (req, res) => {
    const { currentFloor } = req.body || {};
    try {
      if (!genAI) {
        return res.status(503).json({
          success: false,
          error: 'GEMINI_API_KEY belum dikonfigurasi. Rekomendasi slotting AI tidak dibuat dari data contoh.'
        });
      }

      const prompt = `
Sebagai Senior Warehouse Layout & Slotting Engineer untuk PT Anugrah Kemasan Kreatif DC Banyuwangi (2 Lantai: Lantai 1 Ground Floor untuk Karton Box berat & Fast Moving dengan rak 4 tingkat, Lantai 2 Mezzanine untuk Food Grade & Aksesoris Ringan dengan rak 3 tingkat):
Berikan 3 rekomendasi optimasi tata letak dan pengelompokan kategori barang saat ini pada Lantai ${currentFloor || 1} dalam format JSON murni:
{
  "recommendations": [
    {
      "title": "string judul optimasi",
      "category": "string nama kategori",
      "action": "string langkah aksi",
      "impact": "string dampak efisiensi (misal waktu muat atau beban tonase)"
    }
  ]
}
`;
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Gemini API call timed out")), 4500)
      );

      const result = await Promise.race([
        genAI.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          config: {
            temperature: 0.3,
            responseMimeType: 'application/json'
          }
        }),
        timeoutPromise
      ]);
      const parsed = JSON.parse(result.text || '{}');
      return res.json({ success: true, data: parsed });
    } catch (err: any) {
      console.warn("AI Slotting Advisor error:", err?.message || err);
      return res.status(502).json({
        success: false,
        error: 'Rekomendasi AI Slotting gagal. Sistem tidak mengembalikan rekomendasi contoh sebagai hasil nyata.'
      });
    }
  });

  // API route for WhatsApp notification.
  // Jangan mengembalikan sukses palsu: bridge/provider harus benar-benar dikonfigurasi dan dihubungkan.
  app.post("/api/notify-whatsapp", requireAuth, async (_req, res) => {
    const waKey = String(process.env.WHATSAPP_API_KEY || '').trim();
    if (!waKey || waKey.toLowerCase() === 'disabled') {
      return res.status(503).json({ success: false, error: "WHATSAPP_API_KEY belum dikonfigurasi" });
    }
    return res.status(501).json({
      success: false,
      error: "Adapter WhatsApp provider belum dikonfigurasi pada hosting. Endpoint tidak mengklaim pesan terkirim sebelum provider/bridge benar-benar terhubung."
    });
  });

  // In-memory cache for Google Sheets CSV responses to prevent redundant slow requests & timeouts
  const sheetCache = new Map<string, { data: string; timestamp: number }>();
  const SHEET_CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes

  // API route to proxy public Google Sheets CSV export (bypasses browser CORS & network drops)
  app.get("/api/proxy-sheet", requireAuth, async (req, res) => {
    const rawUrl = req.query.url as string;
    if (!rawUrl || !rawUrl.startsWith("https://docs.google.com/spreadsheets/")) {
      return res.status(400).json({ error: "Invalid Google Sheets URL" });
    }

    let csvUrl = rawUrl;
    if (!rawUrl.includes("/export?format=csv") && !rawUrl.includes("/gviz/tq")) {
      const idMatch = rawUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
      const gidMatch = rawUrl.match(/[?&#]gid=([0-9]+)/);
      if (idMatch && idMatch[1]) {
        csvUrl = `https://docs.google.com/spreadsheets/d/${idMatch[1]}/export?format=csv${gidMatch ? `&gid=${gidMatch[1]}` : ''}`;
      } else {
        csvUrl = rawUrl.replace(/\/edit.*$/, "/export?format=csv");
      }
    }

    // Check in-memory cache first
    const cached = sheetCache.get(csvUrl) || sheetCache.get(rawUrl);
    if (cached && Date.now() - cached.timestamp < SHEET_CACHE_TTL_MS) {
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("X-Cache", "HIT");
      return res.send(cached.data);
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout

      // If client disconnects, abort cleanly
      req.on('close', () => {
        controller.abort();
      });

      const headers: Record<string, string> = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)",
        "Accept": "text/csv,text/plain,*/*"
      };
      if (req.headers.authorization) {
        headers["Authorization"] = req.headers.authorization;
      }

      let sheetRes: Response | null = null;
      try {
        sheetRes = await fetch(csvUrl, {
          headers,
          signal: controller.signal,
        });
      } catch (fetchErr: any) {
        // If export format failed or timed out, try alternative gviz endpoint if applicable
        if (!csvUrl.includes("/gviz/tq") && !controller.signal.aborted) {
          const idMatch = rawUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
          const gidMatch = rawUrl.match(/[?&#]gid=([0-9]+)/);
          if (idMatch && idMatch[1]) {
            const gvizUrl = `https://docs.google.com/spreadsheets/d/${idMatch[1]}/gviz/tq?tqx=out:csv${gidMatch ? `&gid=${gidMatch[1]}` : ''}`;
            try {
              sheetRes = await fetch(gvizUrl, { headers, signal: controller.signal });
            } catch {
              // gviz also failed
            }
          }
        }
      } finally {
        clearTimeout(timeoutId);
      }

      if (res.writableEnded || res.headersSent) return;

      if (sheetRes && sheetRes.ok) {
        const csvData = await sheetRes.text();
        if (csvData && csvData.trim().length > 0) {
          sheetCache.set(csvUrl, { data: csvData, timestamp: Date.now() });
          sheetCache.set(rawUrl, { data: csvData, timestamp: Date.now() });
          res.setHeader("Content-Type", "text/csv; charset=utf-8");
          res.setHeader("X-Cache", "MISS");
          return res.send(csvData);
        }
      }

      // If remote returned an error but we have stale cached data, serve stale cache
      if (cached) {
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("X-Cache", "STALE");
        return res.send(cached.data);
      }

      if (sheetRes && !sheetRes.ok) {
        return res.status(sheetRes.status).json({ error: `Remote sheet returned status ${sheetRes.status}` });
      }

      return res.status(502).json({ error: "Failed to fetch remote spreadsheet" });
    } catch (err: any) {
      if (res.writableEnded || res.headersSent) return;

      // Stale cache fallback if fetch threw
      if (cached) {
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("X-Cache", "STALE");
        return res.send(cached.data);
      }

      const isAbort = err?.name === 'AbortError' || err?.message?.includes('aborted');
      if (isAbort) {
        return res.status(200).send("");
      }

      res.status(200).send("");
    }
  });

  // API route for automated backend entity sync & audit logging
  app.post("/api/sync-entity", requireScheduleWrite, async (req, res) => {
    try {
      const payload = req.body;
      const entityType = payload?.entityType || payload?.type || 'unknown';
      const action = payload?.action || 'update';
      const entityId = payload?.id || payload?.scheduleId || payload?.fleetId || 'unknown';

      console.info(`[Store Middleware Auto-Writer] Entity Sync [${entityType}:${action}]: ID ${entityId}`, {
        timestamp: new Date().toISOString(),
        hasImage: Boolean(payload?.data?.url || payload?.data?.imageUrl || payload?.imageUrl),
        status: payload?.data?.status || payload?.status
      });

      // Hanya entitas yang benar-benar memiliki adapter persistence boleh mengembalikan sukses.
      // Endpoint lama sebelumnya mengklaim semua tipe berhasil walau tidak menulis apa pun.
      if (entityType !== 'schedule') {
        return res.status(501).json({
          success: false,
          source: 'hostinger_mysql',
          error: `Adapter persistence untuk entitas ${entityType} belum diimplementasikan; perubahan tidak diklaim tersimpan.`
        });
      }

      // Persist single schedule mutations into the Hostinger MySQL snapshot.
      // This keeps normal create/edit/delete actions durable without relying on local JSON files.
      if (entityType === 'schedule') {
        const rows = await mysqlQuery<any[]>("SELECT state_json FROM app_state WHERE state_key = ? LIMIT 1", ['schedules_payload']);
        const existingPayload = Array.isArray(rows) && rows.length > 0
          ? (typeof rows[0].state_json === 'string' ? JSON.parse(rows[0].state_json) : rows[0].state_json)
          : { schedules: [], weeks: [], month: 'Januari', year: new Date().getFullYear(), count: 0 };
        const schedules = Array.isArray(existingPayload?.schedules) ? [...existingPayload.schedules] : [];
        const scheduleData = payload?.data || {};
        const targetId = String(entityId || scheduleData?.id || '');
        const index = schedules.findIndex((sch: any) => String(sch?.id || '') === targetId);

        if (action === 'delete') {
          existingPayload.schedules = schedules.filter((sch: any) => String(sch?.id || '') !== targetId);
        } else if (index >= 0) {
          schedules[index] = { ...schedules[index], ...scheduleData, id: scheduleData?.id || targetId };
          existingPayload.schedules = schedules;
        } else if (targetId && scheduleData && Object.keys(scheduleData).length > 0) {
          existingPayload.schedules = [{ ...scheduleData, id: scheduleData?.id || targetId }, ...schedules];
        }

        existingPayload.updatedAt = new Date().toISOString();
        existingPayload.source = 'store_middleware';
        existingPayload.count = Array.isArray(existingPayload.schedules) ? existingPayload.schedules.length : 0;
        await mysqlQuery(
          `INSERT INTO app_state (state_key, state_json, updated_at) VALUES (?, ?, NOW())
           ON DUPLICATE KEY UPDATE state_json = VALUES(state_json), updated_at = NOW()`,
          ['schedules_payload', JSON.stringify(existingPayload)]
        );

        if (action === 'delete') {
          await mysqlQuery('DELETE FROM schedules WHERE id = ?', [targetId]);
        } else if (scheduleData?.id || targetId) {
          await upsertScheduleRow({ ...scheduleData, id: scheduleData?.id || targetId });
        }
      }

      res.json({
        success: true,
        source: 'hostinger_mysql',
        message: `Entitas ${entityType} (${action}) berhasil disinkronkan ke Hostinger MySQL`,
        timestamp: new Date().toISOString(),
        entityType,
        action,
        entityId
      });
    } catch (err: any) {
      console.warn("[Store Middleware Warning]", err?.message || err);
      res.status(500).json({ success: false, error: err?.message || "Sync failed" });
    }
  });

  // API route for batch entity synchronization.
  // Belum ada adapter generic yang aman; jangan klaim batch berhasil tanpa write DB nyata.
  app.post("/api/sync-batch", requireAuth, async (req, res) => {
    const items = Array.isArray(req.body?.events) ? req.body.events : [];
    return res.status(501).json({
      success: false,
      source: 'hostinger_mysql',
      processedCount: 0,
      unsupportedCount: items.length,
      error: 'Generic batch persistence belum diimplementasikan. Gunakan endpoint CRUD khusus per entitas agar write database dapat diverifikasi.'
    });
  });

  // Persistent schedules snapshot in Hostinger MySQL (no local JSON files)
  app.post("/api/schedules/persist", requireScheduleWrite, express.json({ limit: '50mb' }), async (req, res) => {
    try {
      const { schedules, weeks, month, year, source } = req.body || {};
      const count = Array.isArray(schedules) ? schedules.length : 0;
      const weeksCount = Array.isArray(weeks) ? weeks.length : 0;
      const payload = {
        updatedAt: new Date().toISOString(),
        source: source || 'upload',
        month: month || 'Januari',
        year: year || 2026,
        count,
        schedules: Array.isArray(schedules) ? schedules : [],
        weeks: Array.isArray(weeks) ? weeks : []
      };

      await mysqlQuery(
        `INSERT INTO app_state (state_key, state_json, updated_at) VALUES (?, ?, NOW())
         ON DUPLICATE KEY UPDATE state_json = VALUES(state_json), updated_at = NOW()`,
        ['schedules_payload', JSON.stringify(payload)]
      );

      // Keep a normalized schedule table in sync for reporting/search while preserving the complete object in payload_json/app_state.
      if (Array.isArray(schedules)) {
        for (const schedule of schedules) {
          await upsertScheduleRow(schedule);
        }
      }

      return res.json({
        success: true,
        source: 'hostinger_mysql',
        message: `${count} jadwal pengiriman berhasil disimpan permanen di Hostinger MySQL`,
        count,
        weeksCount,
        timestamp: payload.updatedAt
      });
    } catch (err: any) {
      console.warn("[Schedule MySQL Persistence Warning]", err?.message || err);
      return res.status(503).json({ success: false, error: err?.message || "Gagal menyimpan jadwal ke Hostinger MySQL" });
    }
  });

  app.get("/api/schedules/persisted", requireAuth, async (req: any, res) => {
    try {
      const rows = await mysqlQuery<any[]>("SELECT state_json, updated_at FROM app_state WHERE state_key = ? LIMIT 1", ['schedules_payload']);
      if (!Array.isArray(rows) || rows.length === 0) {
        return res.json({ success: true, exists: false, source: 'hostinger_mysql', schedules: [], weeks: [], count: 0 });
      }
      const raw = rows[0].state_json;
      const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
      const role = String(req.authUser?.role || '');
      let schedules = Array.isArray(data?.schedules) ? data.schedules : [];

      // Driver/helper hanya menerima jadwal yang memang ditugaskan kepadanya.
      // Filtering dilakukan di server, bukan hanya di UI/browser.
      if (role === 'driver' || role === 'crew_helper') {
        schedules = schedules.filter((sch: any) => isScheduleAssignedToAuthUser(sch, req.authUser));
      }

      return res.json({
        success: true,
        exists: true,
        source: 'hostinger_mysql',
        ...data,
        schedules,
        count: schedules.length
      });
    } catch (err: any) {
      console.warn("[Schedule MySQL Fetch Warning]", err?.message || err);
      return res.status(503).json({ success: false, error: err?.message || "Gagal membaca jadwal dari Hostinger MySQL" });
    }
  });

  app.patch("/api/schedules/:id/status", requireScheduleStatusWrite, express.json(), async (req, res) => {
    try {
      const scheduleId = req.params.id;
      const { status, notes, trackingNumber, actualArrival } = req.body || {};
      const allowedStatuses = new Set(['scheduled', 'picked_up', 'in_transit', 'delivered', 'delayed']);
      if (status && !allowedStatuses.has(String(status))) {
        return res.status(400).json({ success: false, error: 'Status jadwal tidak valid' });
      }

      const rows = await mysqlQuery<any[]>("SELECT state_json FROM app_state WHERE state_key = ? LIMIT 1", ['schedules_payload']);
      if (!Array.isArray(rows) || rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Snapshot jadwal belum tersedia' });
      }
      const raw = rows[0].state_json;
      const payload = typeof raw === 'string' ? JSON.parse(raw) : raw;
      const schedules = Array.isArray(payload?.schedules) ? payload.schedules : [];

      const role = String((req as any).authUser?.role || '');
      if (role === 'driver' || role === 'crew_helper') {
        const target = schedules.find((sch: any) =>
          sch?.id === scheduleId || (trackingNumber && sch?.trackingNumber === trackingNumber)
        );
        if (!target || !isScheduleAssignedToAuthUser(target, (req as any).authUser)) {
          return res.status(403).json({ success: false, error: 'Jadwal ini bukan penugasan akun driver/helper yang sedang login' });
        }
      }

      let changed = false;
      payload.schedules = schedules.map((sch: any) => {
        if (sch?.id === scheduleId || (trackingNumber && sch?.trackingNumber === trackingNumber)) {
          changed = true;
          return {
            ...sch,
            status: status || sch.status,
            notes: notes !== undefined ? notes : sch.notes,
            actualArrival: actualArrival || (status === 'delivered' ? new Date().toISOString() : sch.actualArrival)
          };
        }
        return sch;
      });
      if (!changed) return res.status(404).json({ success: false, error: 'Jadwal tidak ditemukan' });
      payload.updatedAt = new Date().toISOString();
      payload.count = payload.schedules.length;
      await mysqlQuery("UPDATE app_state SET state_json = ?, updated_at = NOW() WHERE state_key = ?", [JSON.stringify(payload), 'schedules_payload']);
      await mysqlQuery(
        `UPDATE schedules SET status=COALESCE(?, status), notes=COALESCE(?, notes), actual_arrival=COALESCE(?, actual_arrival), updated_at=NOW()
         WHERE id=? OR tracking_number=?`,
        [status || null, notes !== undefined ? notes : null, actualArrival ? toMysqlDateTime(actualArrival) : (status === 'delivered' ? toMysqlDateTime(new Date()) : null), scheduleId, trackingNumber || '']
      );
      return res.json({ success: true, source: 'hostinger_mysql', timestamp: payload.updatedAt });
    } catch (err: any) {
      return res.status(503).json({ success: false, error: err?.message || 'Gagal memperbarui status jadwal' });
    }
  });

  // REST API for Fleets - Hostinger MySQL is the single source of truth
  app.get("/api/fleets", requireAuth, async (_req, res) => {
    try {
      const mysqlFleets = await mysqlQuery<any[]>("SELECT * FROM fleets ORDER BY plate_number ASC");
      const mapped = mysqlFleets.map(f => mergePayload(f.payload_json, {
        id: f.id, plateNumber: f.plate_number, vehicleType: f.vehicle_type,
        tonnageCapacity: Number(f.tonnage_capacity || 0), currentTonnage: Number(f.current_tonnage || 0),
        status: f.status, gpsImei: f.gps_imei || '', fuelLevelPercent: Number(f.fuel_level_percent || 0),
        odometerKm: Number(f.odometer_km || 0), year: Number(f.year || 0), lastMaintenance: f.last_maintenance || undefined
      }));
      return res.json({ success: true, source: "hostinger_mysql", count: mapped.length, data: mapped });
    } catch (err: any) {
      return res.status(503).json({ success: false, error: err?.message || 'Gagal membaca armada dari Hostinger MySQL' });
    }
  });

  app.post("/api/fleets", requireLogisticsWrite, express.json(), async (req, res) => {
    const f = req.body || {};
    if (!f.plateNumber) return res.status(400).json({ success: false, error: "Nomor plat armada wajib diisi" });
    const id = f.id || `flt-${Date.now()}`;
    try {
      await mysqlQuery(
        `INSERT INTO fleets (id, plate_number, vehicle_type, tonnage_capacity, current_tonnage, status, gps_imei, fuel_level_percent, odometer_km, year, last_maintenance, payload_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE vehicle_type=VALUES(vehicle_type), tonnage_capacity=VALUES(tonnage_capacity), current_tonnage=VALUES(current_tonnage), status=VALUES(status), gps_imei=VALUES(gps_imei), fuel_level_percent=VALUES(fuel_level_percent), odometer_km=VALUES(odometer_km), year=VALUES(year), last_maintenance=VALUES(last_maintenance), payload_json=VALUES(payload_json)`,
        [id, String(f.plateNumber).trim().toUpperCase(), f.vehicleType || 'Engkel STD', f.tonnageCapacity ?? 0, f.currentTonnage ?? 0, f.status || 'available', f.gpsImei || null, f.fuelLevelPercent ?? 100, f.odometerKm ?? 0, f.year ?? new Date().getFullYear(), f.lastMaintenance || null, JSON.stringify({ ...f, id })]
      );
      return res.json({ success: true, source: 'hostinger_mysql', data: { ...f, id } });
    } catch (err: any) {
      return res.status(503).json({ success: false, error: err?.message || 'Gagal menyimpan armada' });
    }
  });

  app.put("/api/fleets/:id", requireLogisticsWrite, express.json(), async (req, res) => {
    const id = req.params.id;
    const f = req.body || {};
    try {
      await mysqlQuery(
        `UPDATE fleets SET plate_number=COALESCE(?, plate_number), vehicle_type=COALESCE(?, vehicle_type), tonnage_capacity=COALESCE(?, tonnage_capacity), current_tonnage=COALESCE(?, current_tonnage), status=COALESCE(?, status), gps_imei=COALESCE(?, gps_imei), fuel_level_percent=COALESCE(?, fuel_level_percent), odometer_km=COALESCE(?, odometer_km), year=COALESCE(?, year), last_maintenance=COALESCE(?, last_maintenance), payload_json=? WHERE id=?`,
        [f.plateNumber ? String(f.plateNumber).trim().toUpperCase() : null, f.vehicleType ?? null, f.tonnageCapacity ?? null, f.currentTonnage ?? null, f.status ?? null, f.gpsImei ?? null, f.fuelLevelPercent ?? null, f.odometerKm ?? null, f.year ?? null, f.lastMaintenance ?? null, JSON.stringify({ ...f, id }), id]
      );
      return res.json({ success: true, source: 'hostinger_mysql', data: { ...f, id } });
    } catch (err: any) {
      return res.status(503).json({ success: false, error: err?.message || 'Gagal memperbarui armada' });
    }
  });

  app.delete("/api/fleets/:id", requireLogisticsWrite, async (req, res) => {
    try {
      const result: any = await mysqlQuery("DELETE FROM fleets WHERE id = ?", [req.params.id]);
      return res.json({ success: true, source: 'hostinger_mysql', removed: Number(result?.affectedRows || 0) });
    } catch (err: any) {
      return res.status(503).json({ success: false, error: err?.message || 'Gagal menghapus armada' });
    }
  });

  // REST API for Crews - Hostinger MySQL is the single source of truth
  app.get("/api/crews", requireAuth, async (_req, res) => {
    try {
      const mysqlCrews = await mysqlQuery<any[]>("SELECT * FROM crews ORDER BY name ASC");
      const mapped = mysqlCrews.map(c => mergePayload(c.payload_json, {
        id: c.id, name: c.name, phone: c.phone, role: c.role, licenseNumber: c.license_number,
        licenseType: c.license_type, status: c.status, tripsCompleted: Number(c.trips_completed || 0), rating: Number(c.rating || 5)
      }));
      return res.json({ success: true, source: "hostinger_mysql", count: mapped.length, data: mapped });
    } catch (err: any) {
      return res.status(503).json({ success: false, error: err?.message || 'Gagal membaca kru dari Hostinger MySQL' });
    }
  });

  app.post("/api/crews", requireLogisticsWrite, express.json(), async (req, res) => {
    const c = req.body || {};
    if (!c.name) return res.status(400).json({ success: false, error: "Nama kru wajib diisi" });
    const id = c.id || `crw-${Date.now()}`;
    try {
      await mysqlQuery(
        `INSERT INTO crews (id, name, phone, role, license_number, license_type, status, trips_completed, rating, payload_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE name=VALUES(name), phone=VALUES(phone), role=VALUES(role), license_number=VALUES(license_number), license_type=VALUES(license_type), status=VALUES(status), trips_completed=VALUES(trips_completed), rating=VALUES(rating), payload_json=VALUES(payload_json)`,
        [id, String(c.name).trim(), c.phone || '-', c.role || 'Driver Utama', c.licenseNumber || '-', c.licenseType || 'SIM B2 Umum', c.status || 'available', c.tripsCompleted ?? 0, c.rating ?? 5, JSON.stringify({ ...c, id })]
      );
      return res.json({ success: true, source: 'hostinger_mysql', data: { ...c, id } });
    } catch (err: any) {
      return res.status(503).json({ success: false, error: err?.message || 'Gagal menyimpan kru' });
    }
  });

  app.put("/api/crews/:id", requireLogisticsWrite, express.json(), async (req, res) => {
    const id = req.params.id;
    const c = req.body || {};
    try {
      await mysqlQuery(
        `UPDATE crews SET name=COALESCE(?, name), phone=COALESCE(?, phone), role=COALESCE(?, role), license_number=COALESCE(?, license_number), license_type=COALESCE(?, license_type), status=COALESCE(?, status), trips_completed=COALESCE(?, trips_completed), rating=COALESCE(?, rating), payload_json=? WHERE id=?`,
        [c.name ?? null, c.phone ?? null, c.role ?? null, c.licenseNumber ?? null, c.licenseType ?? null, c.status ?? null, c.tripsCompleted ?? null, c.rating ?? null, JSON.stringify({ ...c, id }), id]
      );
      return res.json({ success: true, source: 'hostinger_mysql', data: { ...c, id } });
    } catch (err: any) {
      return res.status(503).json({ success: false, error: err?.message || 'Gagal memperbarui kru' });
    }
  });

  app.delete("/api/crews/:id", requireLogisticsWrite, async (req, res) => {
    try {
      const result: any = await mysqlQuery("DELETE FROM crews WHERE id = ?", [req.params.id]);
      return res.json({ success: true, source: 'hostinger_mysql', removed: Number(result?.affectedRows || 0) });
    } catch (err: any) {
      return res.status(503).json({ success: false, error: err?.message || 'Gagal menghapus kru' });
    }
  });

  app.get("/api/attendance", requireAuth, async (_req, res) => {
    try {
      const rows = await mysqlQuery<any[]>("SELECT id, crew_id AS crewId, date, status, reason, created_at AS createdAt FROM attendance ORDER BY date DESC, id DESC LIMIT 1000");
      return res.json({ success: true, source: 'hostinger_mysql', count: rows.length, data: rows });
    } catch (err: any) {
      return res.status(503).json({ success: false, error: err?.message || 'Gagal membaca presensi' });
    }
  });

  app.post("/api/attendance", requireAttendanceWrite, express.json(), async (req, res) => {
    try {
      const { crewId, date, status, reason } = req.body || {};
      if (!crewId || !date) return res.status(400).json({ success: false, error: 'crewId dan date wajib diisi' });
      const result: any = await mysqlQuery(
        "INSERT INTO attendance (crew_id, date, status, reason) VALUES (?, ?, ?, ?)",
        [crewId, date, status || 'present', reason || null]
      );
      return res.json({ success: true, source: 'hostinger_mysql', id: result?.insertId });
    } catch (err: any) {
      return res.status(503).json({ success: false, error: err?.message || 'Gagal menyimpan presensi' });
    }
  });

  // Stores REST API for DataBridge -> Hostinger MySQL
  app.get("/api/stores", requireAuth, async (_req, res) => {
    try {
      const rows = await mysqlQuery<any[]>("SELECT * FROM stores ORDER BY store_name ASC");
      const data = rows.map(s => mergePayload(s.payload_json, {
        id: s.id,
        storeCode: s.store_code,
        storeName: s.store_name,
        island: s.island,
        province: s.province,
        city: s.city,
        address: s.address,
        latitude: Number(s.latitude),
        longitude: Number(s.longitude),
        contactPerson: s.contact_person,
        phone: s.phone,
        deliveryWindow: s.delivery_window,
        storeCategory: s.store_category
      }));
      return res.json({ success: true, source: 'hostinger_mysql', count: data.length, data });
    } catch (err: any) {
      return res.status(503).json({ success: false, error: err?.message || 'Gagal membaca toko' });
    }
  });

  app.post("/api/stores", requireStoreWrite, express.json(), async (req, res) => {
    const store = req.body || {};
    if (!store.storeName) return res.status(400).json({ success: false, error: 'Nama toko wajib diisi' });
    const coordCheck = isValidCoordinatePair(store.latitude, store.longitude);
    if (!coordCheck.valid) {
      return res.status(400).json({
        success: false,
        error: 'Koordinat toko (latitude/longitude) tidak valid. Sistem tidak mengganti dengan koordinat palsu.'
      });
    }
    const id = store.id || `str-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const storeCode = String(store.storeCode || `STR-${id.slice(-6)}`).trim().toUpperCase();
    try {
      await mysqlQuery(
        `INSERT INTO stores (id, store_code, store_name, island, province, city, address, latitude, longitude, contact_person, phone, delivery_window, store_category, payload_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE store_name=VALUES(store_name), island=VALUES(island), province=VALUES(province), city=VALUES(city), address=VALUES(address), latitude=VALUES(latitude), longitude=VALUES(longitude), contact_person=VALUES(contact_person), phone=VALUES(phone), delivery_window=VALUES(delivery_window), store_category=VALUES(store_category), payload_json=VALUES(payload_json)`,
        [
          id, storeCode, String(store.storeName).trim(), store.island || 'Jawa', store.province || 'Jawa Timur', store.city || 'Banyuwangi',
          store.address || '-', coordCheck.lat, coordCheck.lng, store.contactPerson || '-',
          store.phone || '-', store.deliveryWindow || '08:00 - 17:00', store.storeCategory || 'Supermarket', JSON.stringify({ ...store, id, storeCode, latitude: coordCheck.lat, longitude: coordCheck.lng })
        ]
      );
      return res.json({ success: true, source: 'hostinger_mysql', data: { ...store, id, storeCode, latitude: coordCheck.lat, longitude: coordCheck.lng } });
    } catch (err: any) {
      return res.status(503).json({ success: false, error: err?.message || 'Gagal menyimpan toko' });
    }
  });

  app.put("/api/stores/:id", requireStoreWrite, express.json(), async (req, res) => {
    const store = req.body || {};
    const id = req.params.id;
    try {
      const rows = await mysqlQuery<any[]>("SELECT * FROM stores WHERE id = ? LIMIT 1", [id]);
      if (!Array.isArray(rows) || rows.length === 0) return res.status(404).json({ success: false, error: 'Toko tidak ditemukan' });
      const current = rows[0];
      const nextLatRaw = store.latitude ?? current.latitude;
      const nextLngRaw = store.longitude ?? current.longitude;
      const coordCheck = isValidCoordinatePair(nextLatRaw, nextLngRaw);
      if (!coordCheck.valid) {
        return res.status(400).json({
          success: false,
          error: 'Koordinat toko (latitude/longitude) tidak valid. Perubahan ditolak.'
        });
      }
      const mergedPayload = { ...(parseJsonColumn(current.payload_json) || {}), ...store, id, latitude: coordCheck.lat, longitude: coordCheck.lng };
      await mysqlQuery(
        `UPDATE stores SET store_code=?, store_name=?, island=?, province=?, city=?, address=?, latitude=?, longitude=?, contact_person=?, phone=?, delivery_window=?, store_category=?, payload_json=? WHERE id=?`,
        [
          String(store.storeCode || current.store_code).trim().toUpperCase(), store.storeName || current.store_name, store.island || current.island,
          store.province || current.province, store.city || current.city, store.address || current.address,
          coordCheck.lat, coordCheck.lng, store.contactPerson || current.contact_person,
          store.phone || current.phone, store.deliveryWindow || current.delivery_window, store.storeCategory || current.store_category,
          JSON.stringify(mergedPayload), id
        ]
      );
      return res.json({ success: true, source: 'hostinger_mysql', data: mergedPayload });
    } catch (err: any) {
      return res.status(503).json({ success: false, error: err?.message || 'Gagal memperbarui toko' });
    }
  });

  app.delete("/api/stores/:id", requireStoreWrite, async (req, res) => {
    try {
      const result: any = await mysqlQuery("DELETE FROM stores WHERE id = ?", [req.params.id]);
      return res.json({ success: true, source: 'hostinger_mysql', removed: Number(result?.affectedRows || 0) });
    } catch (err: any) {
      return res.status(503).json({ success: false, error: err?.message || 'Gagal menghapus toko' });
    }
  });

  app.post("/api/stores/batch", requireStoreWrite, express.json({ limit: '20mb' }), async (req, res) => {
    const stores = Array.isArray(req.body?.stores) ? req.body.stores : [];
    if (stores.length > 5000) return res.status(413).json({ success: false, error: 'Maksimal 5000 toko per batch' });
    let saved = 0;
    let skippedInvalidCoords = 0;
    try {
      for (const store of stores) {
        if (!store?.storeName) continue;
        const coordCheck = isValidCoordinatePair(store.latitude, store.longitude);
        if (!coordCheck.valid) {
          skippedInvalidCoords++;
          continue;
        }
        const id = store.id || `str-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const storeCode = String(store.storeCode || `STR-${id.slice(-6)}`).trim().toUpperCase();
        await mysqlQuery(
          `INSERT INTO stores (id, store_code, store_name, island, province, city, address, latitude, longitude, contact_person, phone, delivery_window, store_category, payload_json)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE store_name=VALUES(store_name), island=VALUES(island), province=VALUES(province), city=VALUES(city), address=VALUES(address), latitude=VALUES(latitude), longitude=VALUES(longitude), contact_person=VALUES(contact_person), phone=VALUES(phone), delivery_window=VALUES(delivery_window), store_category=VALUES(store_category), payload_json=VALUES(payload_json)`,
          [
            id, storeCode, String(store.storeName).trim(), store.island || 'Jawa', store.province || 'Jawa Timur', store.city || 'Banyuwangi',
            store.address || '-', coordCheck.lat, coordCheck.lng, store.contactPerson || '-',
            store.phone || '-', store.deliveryWindow || '08:00 - 17:00', store.storeCategory || 'Supermarket', JSON.stringify({ ...store, id, storeCode, latitude: coordCheck.lat, longitude: coordCheck.lng })
          ]
        );
        saved++;
      }
      return res.json({ success: true, source: 'hostinger_mysql', saved, skippedInvalidCoords });
    } catch (err: any) {
      return res.status(503).json({ success: false, error: err?.message || 'Gagal menyimpan batch toko', saved, skippedInvalidCoords });
    }
  });

  app.post("/api/databridge/log", requireScheduleWrite, express.json(), async (req, res) => {
    const log = req.body || {};
    const id = log.id || `db-log-${Date.now()}`;
    try {
      await mysqlQuery(
        `INSERT INTO databridge_sync_logs (id, timestamp, status, source_type, sheet_name, stores_count, schedules_count, fleets_count, crews_count, message, duration_ms)
         VALUES (?, NOW(), ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, log.status || 'success', 'google_sheets_api', log.sheetName || 'ALL', Number(log.storesCount || 0), Number(log.schedulesCount || 0), Number(log.fleetsCount || 0), Number(log.crewsCount || 0), log.message || '', Number(log.durationMs || 0)]
      );
      return res.json({ success: true, source: 'hostinger_mysql', id });
    } catch (err: any) {
      return res.status(503).json({ success: false, error: err?.message || 'Gagal menyimpan log DataBridge' });
    }
  });

  // API route for document scanning via Gemini 3.8 Flash OCR
  app.post("/api/scan-document", requireAuth, async (req, res) => {
    try {
      const { imageBase64, mimeType = 'image/jpeg', documentHint } = req.body || {};
      
      if (!imageBase64) {
        return res.status(400).json({ success: false, error: "Data gambar dokumen (Base64) diperlukan." });
      }

      const cleanBase64 = String(imageBase64).replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');

      if (!genAI) {
        return res.status(503).json({
          success: false,
          error: 'GEMINI_API_KEY belum dikonfigurasi. OCR tidak dijalankan dan sistem tidak membuat data dokumen contoh.'
        });
      }

      const liveCtx = await buildLiveOperationalContext();
      const promptText = `Anda adalah asisten AI OCR pengenal dokumen logistik resmi PT Anugrah Kemasan Kreatif (PT AKK Banyuwangi DC).
Analisis foto dokumen yang dilampirkan ini (biasanya berupa Surat Jalan / Bukti Pengiriman / DO / Delivery Slip atau Formulir Inspeksi Harian / Checklist Pra-Jalan Armada Truk / SPK Service Bengkel / Nota BBM).
${documentHint ? `Petunjuk jenis dokumen yang dipilih pengguna: ${documentHint}` : ''}

Daftar Armada Aktif dari Database MySQL:
${liveCtx.fleetContext}

Daftar Kru dari Database MySQL:
${liveCtx.crewContext}

Tugas Anda:
1. Kenali apakah ini "delivery_slip" (Surat Jalan), "inspection_form" (Formulir Inspeksi Checklist), "service_order" (Formulir Service/SPK), atau "fuel_receipt" (Nota BBM).
2. Ekstrak teks penting sesuai yang tertulis di dokumen asli (jangan mengarang plat nomor atau nama supir jika tidak tertulis): Nomor Dokumen, Tanggal, Plat Nomor Truk, Nama Supir/Pemeriksa, Tujuan/Toko/Outlet, Rincian Muatan (Karton Box) atau Poin Pemeriksaan Kendaraan, Total Koli/Tonase/Hasil Inspeksi, Catatan atau Kondisi, dan apakah tanda tangan/stempel terdeteksi.
3. Kembalikan HANYA format JSON valid tanpa format markdown:
{
  "documentType": "delivery_slip" | "inspection_form" | "service_order" | "fuel_receipt" | "other",
  "documentTypeLabel": string,
  "documentNumber": string,
  "date": string,
  "vehiclePlate": string,
  "driverName": string,
  "destinationOrStore": string,
  "cargoOrItemsSummary": string,
  "quantityOrWeight": string,
  "inspectionScore": string,
  "notes": string,
  "signaturesDetected": boolean,
  "rawExtractedText": string,
  "confidenceScore": number
}`;

      const imagePart = {
        inlineData: {
          mimeType: mimeType || 'image/jpeg',
          data: cleanBase64
        }
      };

      const textPart = {
        text: promptText
      };

      try {
        const response = await genAI.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: { parts: [imagePart, textPart] },
          config: {
            responseMimeType: 'application/json',
            temperature: 0.1
          }
        });

        const rawText = response.text || '';
        let parsedResult: any = null;
        try {
          const sanitized = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
          parsedResult = JSON.parse(sanitized);
        } catch (jsonErr) {
          console.warn('[DocScan] Failed to parse JSON from Gemini:', rawText);
        }

        if (parsedResult && parsedResult.documentNumber) {
          return res.json({
            success: true,
            fallback: false,
            data: parsedResult
          });
        }
      } catch (geminiErr: any) {
        console.warn('[DocScan] Gemini API call failed:', geminiErr?.message || geminiErr);
        return res.status(502).json({
          success: false,
          error: 'OCR AI gagal. Sistem tidak mengganti hasil dengan dokumen contoh atau data acak.'
        });
      }

      return res.status(422).json({
        success: false,
        error: 'OCR AI tidak mengembalikan struktur dokumen yang valid. Tidak ada fallback data contoh.'
      });
    } catch (err: any) {
      console.error("[DocScan Error]", err);
      res.status(500).json({ success: false, error: err?.message || "Gagal memproses dokumen" });
    }
  });

  // 📥 Server-side Spreadsheet Template Download Endpoint
  app.get('/api/download-schedule-template', (req, res) => {
    try {
      const wb = XLSX.utils.book_new();
      const wsData = [
        ['PT ANUGRAH KEMASAN KREATIF - TEMPLATE JADWAL OPERASIONAL LOGISTIK'],
        ['Tanggal', 'No', 'Driver', 'Helper', '', 'Area Kirim', 'Armada'],
        ['', '', '', '1', '2', '', ''],
        // Day 1: 05/01/2026
        ['05/01/2026', 1, 'Supri', 'Rifal', 'Aldi', 'DENPASAR 1', 'DS3'],
        ['', 2, 'Wahyu', 'Yusuf', '', 'DENPASAR 2', 'DS1'],
        ['', 3, 'Tiar', 'Faris', '', 'BONDOWOSO', 'NS3'],
        ['', 4, 'Aris', 'Rohman', '', 'SITUBONDO', 'DS2'],
        ['', 5, 'Andre', 'Aan', '', 'SUSULAN GENTENG - ROGOJAMPI', 'DS4'],
        ['', 6, 'Wibi', 'Teguh', '', 'PURWO DAMBUNTUNG', 'NS2'],
        ['', 7, 'Budi', 'Rizal', '', 'PURWO PASAR', 'NS1'],
        ['', 8, 'Hadi', 'Yudi', '', 'JAJAG RETAIL', 'N20'],
        ['------------------------------------------------------------', '----------------', '----------------', '----------------', '----------------', '----------------', '----------------'],
        // Day 2: 06/01/2026
        ['06/01/2026', 1, 'Andre', 'Aan', 'Hardi', 'SINGARAJA', 'DS5'],
        ['', 2, 'Hadi', 'Yusuf', '', 'SUMBERAYU RETAIL', 'NL2'],
        ['', 3, 'Aris', 'Rifal', '', 'GALEKAN', 'NL1'],
        ['', 4, 'Tiar', 'Faris', '', 'GROSIR BWI - ROGOJAMPI', 'DS4'],
        ['', 5, 'Budi', 'Rohman', '', 'SUSULAN SANGGAR JAJAG', 'NS1'],
        ['------------------------------------------------------------', '----------------', '----------------', '----------------', '----------------', '----------------', '----------------'],
        // Day 3: 07/01/2026
        ['07/01/2026', 1, 'Supri', 'Rifal', '', 'DENPASAR 1', 'DS5'],
        ['', 2, 'Hadi', 'Faris', '', 'DENPASAR 2', 'DS3'],
        ['', 3, 'Aris', 'Rohman', '', 'GENTENG RETAIL', 'NL2'],
        ['', 4, 'Tiar', 'Yusuf', '', 'ROGOJAMPI RETAIL', 'DS4'],
        ['', 5, 'Budi', 'Aan', '', 'MUNCAR RETAIL', 'NS2'],
        ['', 6, 'Aldi', 'Wahyu', '', 'KETAPANG WONGSOREJO', 'NS3']
      ];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      XLSX.utils.book_append_sheet(wb, ws, 'ALL');
      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="Template_Jadwal_Operasional_AKK.xlsx"');
      res.send(buf);
    } catch (err: any) {
      console.error('[Download Template Error]', err);
      res.status(500).send('Gagal mengunduh template spreadsheet.');
    }
  });

  // 🔍 Server-side Spreadsheet Schema Validation Endpoint
  app.post('/api/validate-schedule-spreadsheet', requireScheduleWrite, express.json({ limit: '50mb' }), (req, res) => {
    try {
      const { fileBase64 } = req.body;
      if (!fileBase64) {
        return res.status(400).json({ valid: false, error: 'File data kosong atau tidak valid.' });
      }

      const cleanBase64 = fileBase64.includes('base64,') ? fileBase64.split('base64,')[1] : fileBase64;
      const buffer = Buffer.from(cleanBase64, 'base64');
      const workbook = XLSX.read(buffer, { type: 'buffer' });

      const sheetName = workbook.SheetNames.find(n => n.toUpperCase() === 'ALL') || workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

      if (!rows || rows.length === 0) {
        return res.json({
          valid: false,
          error: 'Spreadsheet Kosong',
          message: 'File Excel tidak memiliki baris data atau lembar kerja kosong.',
          correctFormat: 'NO | TANGGAL | DRIVER | HELPER | AREA | ARMADA',
          templateDownloadUrl: '/api/download-schedule-template'
        });
      }

      let hasDriver = false;
      let hasArea = false;
      let hasArmada = false;
      const detectedHeaders: string[] = [];

      for (let r = 0; r < Math.min(rows.length, 10); r++) {
        const row = rows[r];
        if (!row) continue;
        for (let c = 0; c < row.length; c++) {
          const val = String(row[c] || '').toUpperCase().trim();
          if (val) detectedHeaders.push(val);
          if (val === 'DRIVER' || val === 'SUPIR') hasDriver = true;
          if (val.includes('AREA') || val.includes('TUJUAN') || val.includes('RUTE')) hasArea = true;
          if (val === 'ARMADA' || val === 'MOBIL' || val === 'PLAT') hasArmada = true;
        }
      }

      const missingColumns: string[] = [];
      if (!hasDriver) missingColumns.push('DRIVER (atau SUPIR)');
      if (!hasArea) missingColumns.push('AREA / TUJUAN');
      if (!hasArmada) missingColumns.push('ARMADA');

      if (missingColumns.length > 0) {
        return res.json({
          valid: false,
          error: 'Format Kolom Spreadsheet Tidak Sesuai Schema',
          message: `Header kolom wajib PT AKK Logistics tidak lengkap. Kolom yang tidak ditemukan: ${missingColumns.join(', ')}.`,
          missingColumns,
          detectedHeaders: Array.from(new Set(detectedHeaders)).slice(0, 15),
          correctFormat: 'Format Standar: NO | TANGGAL | DRIVER | HELPER | AREA / TUJUAN | ARMADA | NO PO / KETERANGAN',
          templateDownloadUrl: '/api/download-schedule-template'
        });
      }

      return res.json({
        valid: true,
        message: 'Validasi server-side sukses: Struktur kolom spreadsheet sesuai dengan schema scheduling PT AKK.'
      });
    } catch (err: any) {
      console.error('[Validate Spreadsheet Error]', err);
      res.status(500).json({
        valid: false,
        error: 'Kesalahan Server',
      });
    }
  });

  // Direct APK / file downloads route (serves directly from root path /akk-mobile-v1.apk, /downloads/:filename, /api/download-apk, etc.)
  const serveApkFile = (filename: string, res: express.Response) => {
    const safeFilename = filename.endsWith('.apk') ? filename : `${filename}.apk`;
    const candidates = [
      path.join(process.cwd(), 'public', safeFilename),
      path.join(process.cwd(), 'public', 'downloads', safeFilename),
      path.join(process.cwd(), 'downloads', safeFilename),
      path.join(process.cwd(), 'dist', safeFilename),
      path.join(process.cwd(), 'dist', 'downloads', safeFilename),
      // Fallback candidate
      path.join(process.cwd(), 'public', 'akk-mobile-v1.apk'),
      path.join(process.cwd(), 'downloads', 'akk-mobile-v1.apk'),
      path.join(process.cwd(), 'dist', 'akk-mobile-v1.apk')
    ];
    for (const filePath of candidates) {
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const stat = fs.statSync(filePath);
        res.setHeader('Content-Type', 'application/vnd.android.package-archive');
        res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
        res.setHeader('Content-Length', stat.size.toString());
        res.setHeader('Content-Transfer-Encoding', 'binary');
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Cache-Control', 'public, max-age=3600');
        
        const fileStream = fs.createReadStream(filePath);
        return fileStream.pipe(res);
      }
    }
    return res.status(404).send('File APK tidak ditemukan.');
  };

  app.get(['/api/download-apk', '/api/apk'], (req, res) => {
    serveApkFile('akk-mobile-v1.apk', res);
  });

  app.get('/downloads/:filename', (req, res) => {
    serveApkFile(req.params.filename, res);
  });

  app.get(['/akk-mobile-v1.apk', '/AKK_Driver_Mobile_v1.0.4.apk', '/:filename.apk'], (req, res) => {
    const filename = req.params.filename ? `${req.params.filename}.apk` : path.basename(req.path);
    serveApkFile(filename, res);
  });

  app.use('/downloads', express.static(path.join(process.cwd(), 'public', 'downloads')));
  app.use('/downloads', express.static(path.join(process.cwd(), 'downloads')));

  // In development, always use Vite middleware; in production, serve built dist/ if available
  const isProduction = process.env.NODE_ENV === "production";
  const distPath = path.join(process.cwd(), 'dist');
  const indexHtmlPath = path.join(distPath, 'index.html');
  const hasDist = fs.existsSync(indexHtmlPath);

  if (isProduction) {
    if (!hasDist) {
      console.error('[Startup Production] Build frontend (dist/index.html) tidak ditemukan. Jalankan "npm run build" sebelum memulai server production.');
      process.exit(1);
    }
    app.use(express.static(distPath));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/') || req.path.startsWith('/downloads/')) return next();
      res.sendFile(indexHtmlPath, (err) => {
        if (err && !res.headersSent) {
          console.error("Error sending index.html:", err);
          res.status(500).send("Error loading application");
        }
      });
    });
  } else {
    // Initialize Vite asynchronously while allowing Express to bind port 3000 immediately for pre-warming checks
    const viteReadyPromise = (async () => {
      const { createServer: createViteServer } = await import("vite");
      const disableHmr = process.env.DISABLE_HMR === 'true' || Boolean(process.env.K_SERVICE);
      const vite = await createViteServer({
        server: {
          middlewareMode: true,
          hmr: disableHmr ? false : undefined,
          watch: disableHmr ? null : {},
        },
        appType: "spa",
      });
      return vite.middlewares;
    })();

    app.use(async (req, res, next) => {
      try {
        const middlewares = await viteReadyPromise;
        return middlewares(req, res, next);
      } catch (err) {
        return next(err);
      }
    });
  }

  // Production Hostinger: pastikan database/schema siap SEBELUM menerima trafik.
  // Preview/development boleh start cepat; pengecekan DB dilakukan non-blocking setelah port bind.
  if (isProduction && !process.env.K_SERVICE) {
    try {
      if (!String(process.env.SESSION_SECRET || '').trim() || String(process.env.SESSION_SECRET || '').trim().length < 32) {
        console.warn('[Startup Production] SESSION_SECRET belum diisi atau kurang dari 32 karakter; menggunakan derived SHA-256 session key.');
      }
      if (!isDatabaseConfigured()) {
        console.error('[Startup Production] Konfigurasi database Hostinger MySQL (DB_NAME, DB_USER, DB_PASSWORD) belum lengkap di Environment Variables.');
      } else {
        const conn = await testMysqlConnection();
        if (!conn.success) {
          console.error('[Startup Production] Gagal terhubung ke Hostinger MySQL:', conn.message);
        } else {
          await ensureDatabaseSchema();
          await ensureBootstrapAdmin();
        }
      }
    } catch (err: any) {
      console.warn('[Startup Production] Peringatan inisialisasi database:', err?.message || err);
    }
  }

  const preferredPort = Number(process.env.PORT) || 3000;

  function listenOnPort(port: number) {
    const server = app.listen(port, "0.0.0.0", () => {
      console.log(`Server running in ${isProduction && hasDist ? 'production (static dist)' : 'development (vite middleware)'} mode on http://0.0.0.0:${port}`);
    });

    server.on('error', (err: any) => {
      if (err.code === 'EADDRINUSE' && !isProduction) {
        console.warn(`Port ${port} is already in use, trying port ${port + 1}...`);
        listenOnPort(port + 1);
        return;
      }
      console.error('Server error:', err);
      if (isProduction) process.exit(1);
    });

    // Graceful shutdown for Hostinger Node.js lifecycle
    process.on('SIGTERM', () => {
      console.log('SIGTERM received, closing HTTP server gracefully...');
      server.close(() => {
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      server.close(() => {
        process.exit(0);
      });
    });
  }

  listenOnPort(preferredPort);

  if (!isProduction || process.env.K_SERVICE) {
    void (async () => {
      try {
        if (isDatabaseConfigured()) {
          const conn = await testMysqlConnection();
          if (conn.success) {
            await ensureDatabaseSchema();
            await ensureBootstrapAdmin();
          } else {
            console.log('ℹ️ [Startup Database] Hostinger MySQL belum aktif di environment lokal/preview.');
          }
        } else {
          console.log('ℹ️ [Startup Database] Mode development/preview berjalan (konfigurasi DB diisi di Hostinger ENV saat production).');
        }
      } catch (err: any) {
        console.warn('[Startup Database] Peringatan inisialisasi database preview:', err?.message || err);
      }
    })();
  }
}

startServer();

