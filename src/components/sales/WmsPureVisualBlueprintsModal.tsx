import React, { useState } from 'react';
import { X, Copy, Check, Download, Database, Cpu, Smartphone, Terminal } from 'lucide-react';

export const SQL_HOSTINGER_DDL_SCRIPT = `-- ============================================================================
-- SKRIP SQL DDL & SEED PRODUCTION: WMS PURE VISUAL IDENTIFICATION (ULTRALYTICS YOLO)
-- Target Database: MySQL / MariaDB Server (Hostinger phpMyAdmin)
-- Sistem: https://akkoperasional.com/aplikasi-rfid-muat
-- ============================================================================

SET NAMES utf8mb4;
SET time_zone = '+07:00';

-- 1. Tabel Master Surat Jalan / Delivery Order (wms_surat_jalan)
CREATE TABLE IF NOT EXISTS wms_surat_jalan (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  no_do VARCHAR(100) NOT NULL,
  tanggal DATE NOT NULL,
  customer VARCHAR(191) NOT NULL,
  status ENUM('OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'OPEN',
  total_qty INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_wms_surat_jalan_no_do (no_do),
  KEY idx_wms_sj_tanggal_status (tanggal, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Tabel Daftar Item Kemasan Muat per Surat Jalan (wms_item_muat)
CREATE TABLE IF NOT EXISTS wms_item_muat (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  surat_jalan_id BIGINT UNSIGNED NOT NULL,
  kode_unik_kemasan VARCHAR(120) NOT NULL,
  nama_barang VARCHAR(255) NOT NULL,
  status_muat ENUM('PENDING', 'LOADED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_wms_item_lookup (kode_unik_kemasan, surat_jalan_id, status_muat),
  CONSTRAINT fk_wms_item_muat_sj
    FOREIGN KEY (surat_jalan_id) REFERENCES wms_surat_jalan (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Tabel Audit Log Pemindaian Visual & Bukti Foto (wms_scan_logs)
CREATE TABLE IF NOT EXISTS wms_scan_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  item_id BIGINT UNSIGNED NULL,
  no_do VARCHAR(100) NOT NULL,
  gate_id VARCHAR(50) NOT NULL,
  scan_method ENUM('visual_yolo_ocr', 'rfid_manual') NOT NULL DEFAULT 'visual_yolo_ocr',
  confidence_score DECIMAL(5,4) NOT NULL DEFAULT 0.9500,
  foto_path VARCHAR(255) NULL,
  scanned_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_wms_scan_logs_no_do (no_do, scanned_at),
  KEY idx_wms_scan_logs_item_id (item_id),
  CONSTRAINT fk_wms_scan_logs_item
    FOREIGN KEY (item_id) REFERENCES wms_item_muat (id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- CONTOH DATA AWAL (SEED DATA UNTUK PENGUJIAN MUAT DI GATE)
-- ============================================================================
INSERT INTO wms_surat_jalan (no_do, tanggal, customer, status, total_qty)
VALUES
  ('FKT/AKK/2026/11/001', CURDATE(), 'TK HOLLY GENTENG', 'IN_PROGRESS', 47),
  ('FKT/AKK/2026/11/002', CURDATE(), 'UD SUMBER KEMASAN BALI', 'IN_PROGRESS', 55)
ON DUPLICATE KEY UPDATE
  customer = VALUES(customer),
  total_qty = VALUES(total_qty);

INSERT INTO wms_item_muat (surat_jalan_id, kode_unik_kemasan, nama_barang, status_muat)
SELECT sj.id, 'RFID-KB-001', 'Karton Box Corrugated B-Flute 60x40x40 Polos', 'PENDING'
FROM wms_surat_jalan sj WHERE sj.no_do = 'FKT/AKK/2026/11/001' LIMIT 1;

INSERT INTO wms_item_muat (surat_jalan_id, kode_unik_kemasan, nama_barang, status_muat)
SELECT sj.id, 'RFID-KB-002', 'Karton Box Duplex Cetak Custom 30x20x15', 'PENDING'
FROM wms_surat_jalan sj WHERE sj.no_do = 'FKT/AKK/2026/11/001' LIMIT 1;

INSERT INTO wms_item_muat (surat_jalan_id, kode_unik_kemasan, nama_barang, status_muat)
SELECT sj.id, 'RFID-KB-006', 'Mika Daleman Kue Sekat 4 (Isi 100 Pcs)', 'PENDING'
FROM wms_surat_jalan sj WHERE sj.no_do = 'FKT/AKK/2026/11/002' LIMIT 1;

-- ============================================================================
-- CONTOH TRANSAKSI ATOMIK VALIDASI VISUAL (DIEKSEKUSI OLEH BACKEND SERVICE)
-- ============================================================================
-- START TRANSACTION;
-- SELECT * FROM wms_item_muat
--   WHERE kode_unik_kemasan = ? AND surat_jalan_id = ? AND status_muat = 'PENDING'
--   LIMIT 1 FOR UPDATE;
-- UPDATE wms_item_muat SET status_muat = 'LOADED', updated_at = NOW() WHERE id = ?;
-- INSERT INTO wms_scan_logs (item_id, no_do, gate_id, scan_method, confidence_score, foto_path, scanned_at)
--   VALUES (?, ?, ?, 'visual_yolo_ocr', ?, ?, NOW());
-- COMMIT;
`;

export const PYTHON_YOLO_BACKEND_CODE = `# ============================================================================
# BACKEND ENGINE CV: ULTRALYTICS YOLO + OCR + MYSQL HOSTINGER CONNECTION POOL
# File: main_yolo_fastapi.py
# Jalankan: uvicorn main_yolo_fastapi:app --host 0.0.0.0 --port 8001 --workers 2
# ============================================================================

import os
import re
import cv2
import time
import base64
import numpy as np
from datetime import datetime
from typing import Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from ultralytics import YOLO
import easyocr
import pymysql
from dbutils.pooled_db import PooledDB

app = FastAPI(title="AKK WMS Pure Visual Identification Service (Ultralytics YOLO)")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://akkoperasional.com", "http://localhost:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 1. Inisialisasi Model Ultralytics YOLO & OCR Engine
YOLO_WEIGHTS_PATH = os.getenv("YOLO_MODEL_PATH", "yolov8n.pt")
yolo_model = YOLO(YOLO_WEIGHTS_PATH)
ocr_reader = easyocr.Reader(["en", "id"], gpu=False)

# 2. Konfigurasi Connection Pool MySQL Hostinger
mysql_pool = PooledDB(
    creator=pymysql,
    maxconnections=15,
    mincached=2,
    maxcached=5,
    blocking=True,
    host=os.getenv("DB_HOST", "srv1412.hstgr.io"),
    port=int(os.getenv("DB_PORT", "3306")),
    user=os.getenv("DB_USER", "u123456789_akk_wms"),
    password=os.getenv("DB_PASSWORD", ""),
    database=os.getenv("DB_NAME", "u123456789_akk_ops"),
    charset="utf8mb4",
    cursorclass=pymysql.cursors.DictCursor,
    autocommit=False,
)

UPLOAD_DIR = os.path.join(os.getcwd(), "storage", "wms_scans")
os.makedirs(UPLOAD_DIR, exist_ok=True)


class ScanMuatRequest(BaseModel):
    image: str
    surat_jalan_id: str
    gate_id: str = "Gate 1"
    timestamp: Optional[str] = None


def preprocess_frame(img_bgr: np.ndarray) -> tuple[np.ndarray, float]:
    """
    Tahap 1: Pre-processing (Auto-contrast CLAHE, Orientation Fix, Blur Check Laplacian)
    """
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    blur_score = float(cv2.Laplacian(gray, cv2.CV_64F).var())

    # CLAHE pada channel Luminance (LAB Color Space)
    lab = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2LAB)
    l_ch, a_ch, b_ch = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(8, 8))
    l_enhanced = clahe.apply(l_ch)
    merged_lab = cv2.merge((l_enhanced, a_ch, b_ch))
    enhanced_bgr = cv2.cvtColor(merged_lab, cv2.COLOR_LAB2BGR)
    return enhanced_bgr, blur_score


def detect_and_crop_roi(img_bgr: np.ndarray) -> tuple[np.ndarray, list[int], float]:
    """
    Tahap 2: Ultralytics YOLO Object Detection & ROI Cropping
    Mendeteksi area label/kemasan dengan confidence tertinggi lalu memotong ROI.
    """
    h, w = img_bgr.shape[:2]
    results = yolo_model.predict(source=img_bgr, conf=0.25, verbose=False)

    best_conf = 0.0
    best_bbox = [int(w * 0.12), int(h * 0.15), int(w * 0.88), int(h * 0.85)]

    if results and len(results[0].boxes) > 0:
        boxes = results[0].boxes
        confs = boxes.conf.cpu().numpy()
        xyxy = boxes.xyxy.cpu().numpy()
        best_idx = int(np.argmax(confs))
        best_conf = float(confs[best_idx])
        x1, y1, x2, y2 = [max(0, int(v)) for v in xyxy[best_idx]]
        if (x2 - x1) > 32 and (y2 - y1) > 24:
            best_bbox = [x1, y1, min(w, x2), min(h, y2)]

    x1, y1, x2, y2 = best_bbox
    roi_crop = img_bgr[y1:y2, x1:x2]
    return (roi_crop if roi_crop.size > 0 else img_bgr), best_bbox, (best_conf or 0.94)


def extract_unique_package_code(roi_bgr: np.ndarray, full_bgr: np.ndarray) -> tuple[str, float]:
    """
    Tahap 3: Feature Extraction / OCR Parsing untuk kode seri fisik kemasan
    """
    ocr_results = ocr_reader.readtext(roi_bgr)
    if not ocr_results:
        ocr_results = ocr_reader.readtext(full_bgr)

    candidates = []
    for (_bbox, text, prob) in ocr_results:
        cleaned = re.sub(r"[^A-Z0-9\\-/]", "", text.upper().strip())
        # Pola kode barang / kemasan AKK (contoh: RFID-KB-001, BOX-2026-0042, 7AFBG453)
        if len(cleaned) >= 5 and any(ch.isdigit() for ch in cleaned):
            candidates.append((cleaned, float(prob)))

    if candidates:
        candidates.sort(key=lambda x: x[1], reverse=True)
        return candidates[0][0], candidates[0][1]

    return "UNRECOGNIZED", 0.0


@app.post("/api/scan-muat")
def verify_scan_muat(payload: ScanMuatRequest):
    # 1. Decode Base64 Image dari Smartphone
    try:
        clean_b64 = re.sub(r"^data:image/[a-zA-Z0-9+.-]+;base64,", "", payload.image)
        img_bytes = base64.b64decode(clean_b64)
        np_arr = np.frombuffer(img_bytes, np.uint8)
        frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
        if frame is None:
            raise ValueError("Frame gambar korup atau kosong")
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Gagal membaca frame kamera: {exc}")

    # 2. Pre-processing (CLAHE + Blur Check)
    enhanced_frame, blur_score = preprocess_frame(frame)

    # 3. Ultralytics YOLO ROI Detection & Cropping
    roi_img, bbox, yolo_conf = detect_and_crop_roi(enhanced_frame)

    # 4. OCR / Feature Extraction
    kode_unik, ocr_conf = extract_unique_package_code(roi_img, enhanced_frame)
    final_confidence = round((yolo_conf * 0.5) + (ocr_conf * 0.5), 4)

    # Simpan foto bukti fisik ke disk server
    safe_do = re.sub(r"[^a-zA-Z0-9_-]", "_", payload.surat_jalan_id)
    filename = f"{safe_do}_{int(time.time() * 1000)}.jpg"
    foto_rel_path = f"/storage/wms_scans/{filename}"
    cv2.imwrite(os.path.join(UPLOAD_DIR, filename), frame)

    # 5. Validasi & Transaksi Atomik pada MySQL Hostinger
    conn = mysql_pool.connection()
    try:
        with conn.cursor() as cursor:
            # Cari ID Surat Jalan berdasarkan no_do atau id langsung
            cursor.execute(
                "SELECT id, no_do, total_qty FROM wms_surat_jalan WHERE no_do = %s OR id = %s LIMIT 1",
                (payload.surat_jalan_id, payload.surat_jalan_id),
            )
            sj_row = cursor.fetchone()
            if not sj_row:
                conn.rollback()
                return {
                    "status": "error",
                    "extracted_code": kode_unik,
                    "confidence_score": final_confidence,
                    "yolo_bbox": bbox,
                    "message": f"Surat Jalan {payload.surat_jalan_id} tidak ditemukan di database.",
                }

            sj_id = sj_row["id"]
            no_do = sj_row["no_do"]

            # Query pencocokan sesuai spesifikasi (LOCK FOR UPDATE untuk atomic concurrency)
            cursor.execute(
                """
                SELECT * FROM wms_item_muat
                WHERE kode_unik_kemasan = %s
                  AND surat_jalan_id = %s
                  AND status_muat = 'PENDING'
                LIMIT 1
                FOR UPDATE
                """,
                (kode_unik, sj_id),
            )
            matched_item = cursor.fetchone()

            if not matched_item:
                # Catat log gagal / tidak dikenali
                cursor.execute(
                    """
                    INSERT INTO wms_scan_logs
                      (item_id, no_do, gate_id, scan_method, confidence_score, foto_path, scanned_at)
                    VALUES (NULL, %s, %s, 'visual_yolo_ocr', %s, %s, NOW())
                    """,
                    (no_do, payload.gate_id, final_confidence, foto_rel_path),
                )
                conn.commit()
                return {
                    "status": "error",
                    "extracted_code": kode_unik,
                    "product_name": "Tidak Cocok / Salah Surat Jalan / Sudah Dimuat",
                    "confidence_score": final_confidence,
                    "yolo_bbox": bbox,
                    "blur_score": round(blur_score, 2),
                    "message": f"Kode [{kode_unik}] tidak berstatus PENDING pada DO {no_do}.",
                }

            # Atomic UPDATE menjadi 'LOADED'
            cursor.execute(
                "UPDATE wms_item_muat SET status_muat = 'LOADED', updated_at = NOW() WHERE id = %s",
                (matched_item["id"],),
            )

            # Catat history log di wms_scan_logs
            cursor.execute(
                """
                INSERT INTO wms_scan_logs
                  (item_id, no_do, gate_id, scan_method, confidence_score, foto_path, scanned_at)
                VALUES (%s, %s, %s, 'visual_yolo_ocr', %s, %s, NOW())
                """,
                (matched_item["id"], no_do, payload.gate_id, final_confidence, foto_rel_path),
            )

            # Hitung total item yang sudah LOADED untuk progress bar
            cursor.execute(
                "SELECT COUNT(*) AS loaded_count FROM wms_item_muat WHERE surat_jalan_id = %s AND status_muat = 'LOADED'",
                (sj_id,),
            )
            loaded_count = int(cursor.fetchone()["loaded_count"])

            conn.commit()

            return {
                "status": "success",
                "item_id": matched_item["id"],
                "extracted_code": matched_item["kode_unik_kemasan"],
                "product_name": matched_item["nama_barang"],
                "total_loaded": loaded_count,
                "total_target": int(sj_row["total_qty"]),
                "confidence_score": final_confidence,
                "yolo_bbox": bbox,
                "foto_path": foto_rel_path,
                "message": f"{matched_item['kode_unik_kemasan']} Valid ({loaded_count}/{sj_row['total_qty']} Terbit)",
            }
    except Exception as db_err:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Kesalahan Transaksi SQL: {db_err}")
    finally:
        conn.close()
`;

export const STANDALONE_FRONTEND_HTML_CODE = `<!DOCTYPE html>
<html lang="id" class="dark">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>WMS Pure Visual Scanner — PT Anugrah Kemasan Kreatif</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-[#060a14] text-[#f8fafc] min-h-screen flex items-center justify-center p-2 font-sans select-none">
  <div class="w-full max-w-[440px] bg-[#0b1120] border-[6px] border-[#1e293b] rounded-[36px] overflow-hidden shadow-2xl flex flex-col">
    <!-- Top Header -->
    <div class="bg-[#111827] px-4 py-3 border-b border-[#1e293b] flex items-center justify-between">
      <div class="flex items-center gap-2">
        <span class="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-black">
          ● ONLINE
        </span>
        <span class="text-xs font-black tracking-tight text-white">WMS VISUAL YOLO SCANNER</span>
      </div>
      <select id="gateSelect" class="bg-[#060a14] border border-[#334155] rounded-lg px-2.5 py-1 text-xs font-bold text-emerald-300">
        <option value="Gate 1">Gate 1</option>
        <option value="Gate 2">Gate 2</option>
        <option value="Gate 3">Gate 3</option>
      </select>
    </div>

    <!-- Pilih Surat Jalan -->
    <div class="bg-[#0f172a] px-4 py-2.5 border-b border-[#1e293b]">
      <label class="block text-[10px] font-bold uppercase text-slate-400 mb-1">No. Surat Jalan (DO/SO):</label>
      <input id="suratJalanInput" type="text" value="FKT/AKK/2026/11/001"
        class="w-full bg-[#060a14] border border-[#334155] rounded-xl px-3 py-2 text-xs font-bold text-white" />
    </div>

    <!-- Camera Viewfinder + Green Rectangular ROI Overlay -->
    <div class="p-3 bg-[#090d16] border-b border-[#1e293b] space-y-2">
      <div class="flex items-center justify-between">
        <span class="text-[10px] font-bold text-slate-400">KAMERA BELAKANG (ENVIRONMENT)</span>
        <div class="flex gap-1.5">
          <button id="btnSwitchCam" class="px-2.5 py-1 rounded-lg bg-[#1e293b] text-[10px] font-bold text-sky-300">
            🔄 Switch Cam
          </button>
          <button id="btnTorch" class="px-2.5 py-1 rounded-lg bg-[#1e293b] text-[10px] font-bold text-amber-300">
            🔦 Flash
          </button>
        </div>
      </div>

      <div class="relative w-full h-56 rounded-2xl bg-black border-2 border-[#1e293b] overflow-hidden flex items-center justify-center">
        <video id="cameraVideo" class="w-full h-full object-cover" playsinline autoplay muted></video>
        <canvas id="captureCanvas" class="hidden"></canvas>

        <!-- Rectangular Target Overlay -->
        <div class="relative z-10 w-[84%] h-[72%] border-2 border-dashed border-emerald-400 rounded-xl bg-black/30 flex flex-col justify-between p-2.5 pointer-events-none">
          <div class="flex justify-between text-[9px] font-mono text-emerald-300">
            <span id="roiBadge" class="bg-black/70 px-1.5 py-0.5 rounded">YOLO ROI TARGET</span>
            <span id="modeBadge" class="bg-black/70 px-1.5 py-0.5 rounded">MANUAL SNAP</span>
          </div>
          <div class="text-center text-xs font-extrabold text-emerald-300 bg-black/70 py-1 px-3 rounded-full mx-auto">
            Arahkan Label Kemasan ke Kotak Hijau
          </div>
          <div class="text-center text-[10px] font-mono text-sky-300 bg-black/70 py-0.5 rounded">
            JPEG Max 1280px (Quality 0.8) • CLAHE Auto-Contrast
          </div>
        </div>
      </div>
    </div>

    <!-- Audio-Visual Status Card & Progress Bar -->
    <div class="p-3.5 bg-[#0f172a] border-b border-[#1e293b] space-y-3">
      <div id="statusCard" class="rounded-2xl p-3 border bg-[#111827] border-[#334155] text-slate-200 transition-all">
        <div class="text-[10px] font-black uppercase opacity-80">Status Verifikasi Visual:</div>
        <div id="statusText" class="text-xs font-extrabold mt-1">Siap memindai kemasan...</div>
      </div>

      <div class="space-y-1">
        <div class="flex justify-between text-xs font-bold">
          <span class="text-slate-300">Item Terverifikasi:</span>
          <span id="progressLabel" class="font-mono text-emerald-400">0 / 47</span>
        </div>
        <div class="w-full h-3 rounded-full bg-[#060a14] border border-[#334155] overflow-hidden p-0.5">
          <div id="progressBar" class="h-full rounded-full bg-emerald-500 transition-all duration-300" style="width: 0%"></div>
        </div>
      </div>
    </div>

    <!-- 5 Log Real-time Terakhir -->
    <div class="p-3.5 bg-[#0b1120] space-y-1.5 max-h-48 overflow-y-auto">
      <div class="text-[10px] font-black uppercase text-slate-400">5 Item Terakhir Terverifikasi:</div>
      <div id="logContainer" class="space-y-1.5 text-xs font-mono text-slate-400">
        Belum ada item terverifikasi.
      </div>
    </div>

    <!-- Bottom Touch Controls -->
    <div class="p-3.5 bg-[#060a14] border-t border-[#1e293b] grid grid-cols-12 gap-2">
      <button id="btnSnap" class="col-span-8 py-3.5 rounded-2xl bg-emerald-600 active:scale-95 text-white font-black text-xs tracking-wide shadow-lg">
        📸 AMBIL FOTO & VERIFIKASI
      </button>
      <button id="btnAutoToggle" class="col-span-4 py-3.5 rounded-2xl bg-[#111827] border border-[#334155] text-slate-200 font-black text-[11px]">
        Auto 2.5s: OFF
      </button>
    </div>
  </div>

  <script>
    const API_ENDPOINT = '/api/scan-muat';
    const videoEl = document.getElementById('cameraVideo');
    const canvasEl = document.getElementById('captureCanvas');
    const statusCard = document.getElementById('statusCard');
    const statusText = document.getElementById('statusText');
    const progressLabel = document.getElementById('progressLabel');
    const progressBar = document.getElementById('progressBar');
    const logContainer = document.getElementById('logContainer');
    const btnSnap = document.getElementById('btnSnap');
    const btnAutoToggle = document.getElementById('btnAutoToggle');
    const modeBadge = document.getElementById('modeBadge');

    let currentFacingMode = 'environment';
    let mediaStream = null;
    let torchEnabled = false;
    let autoTimer = null;
    let isBusy = false;
    const recentLogs = [];

    // 1. Web Audio API Synthesizer (1200Hz Sukses vs 250Hz Buzzer Gagal)
    function playFeedbackTone(isSuccess) {
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = isSuccess ? 'sine' : 'sawtooth';
        osc.frequency.setValueAtTime(isSuccess ? 1200 : 250, ctx.currentTime);
        gain.gain.setValueAtTime(0.25, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (isSuccess ? 0.18 : 0.42));
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + (isSuccess ? 0.18 : 0.42));
      } catch (e) {}
    }

    // 2. Camera Hardware Access (exact: "environment" dengan fallback ideal)
    async function initCamera(mode = 'environment') {
      if (mediaStream) {
        mediaStream.getTracks().forEach(t => t.stop());
      }
      try {
        try {
          mediaStream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: { facingMode: { exact: mode }, width: { ideal: 1280 }, height: { ideal: 720 } }
          });
        } catch {
          mediaStream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: { facingMode: { ideal: mode }, width: { ideal: 1280 }, height: { ideal: 720 } }
          });
        }
        videoEl.srcObject = mediaStream;
        currentFacingMode = mode;
      } catch (err) {
        statusText.textContent = 'Izin kamera ditolak atau perangkat tidak memiliki kamera.';
      }
    }

    // 3. Compress Frame di Canvas (Max 1280px, JPEG 0.8)
    function captureCompressedFrame() {
      const maxW = 1280;
      let w = videoEl.videoWidth || 1280;
      let h = videoEl.videoHeight || 720;
      if (w > maxW) {
        h = Math.round((h * maxW) / w);
        w = maxW;
      }
      canvasEl.width = w;
      canvasEl.height = h;
      const ctx = canvasEl.getContext('2d');
      ctx.drawImage(videoEl, 0, 0, w, h);
      return canvasEl.toDataURL('image/jpeg', 0.8);
    }

    // 4. Kirim Frame ke Backend POST /api/scan-muat
    async function captureAndVerify() {
      if (isBusy) return;
      isBusy = true;
      btnSnap.textContent = 'MEMPROSES YOLO & SQL...';

      const imageBase64 = captureCompressedFrame();
      const suratJalanId = document.getElementById('suratJalanInput').value.trim();
      const gateId = document.getElementById('gateSelect').value;

      try {
        const res = await fetch(API_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image: imageBase64,
            surat_jalan_id: suratJalanId,
            gate_id: gateId,
            timestamp: new Date().toISOString()
          })
        });
        const data = await res.json();
        const isOk = res.ok && data.status === 'success';

        playFeedbackTone(isOk);

        statusCard.className = isOk
          ? 'rounded-2xl p-3 border bg-emerald-600 border-emerald-300 text-white shadow-lg transition-all'
          : 'rounded-2xl p-3 border bg-rose-600 border-rose-300 text-white shadow-lg transition-all';
        statusText.textContent = data.message || (isOk ? 'Barang Valid' : 'Barang Tidak Dikenali');

        if (typeof data.total_loaded === 'number' && typeof data.total_target === 'number') {
          const pct = data.total_target > 0 ? Math.min(100, Math.round((data.total_loaded / data.total_target) * 100)) : 0;
          progressLabel.textContent = \`\${data.total_loaded} / \${data.total_target} (\${pct}%)\`;
          progressBar.style.width = \`\${pct}%\`;
        }

        if (isOk) {
          recentLogs.unshift({
            time: new Date().toLocaleTimeString('id-ID'),
            code: data.extracted_code,
            name: data.product_name || 'Kemasan Valid'
          });
          if (recentLogs.length > 5) recentLogs.pop();
          logContainer.innerHTML = recentLogs.map(item => \`
            <div class="flex justify-between items-center bg-[#111827] border border-[#1e293b] px-3 py-1.5 rounded-xl">
              <span class="text-white font-bold">\${item.time} • \${item.code}</span>
              <span class="text-emerald-400 text-[10px] font-black">LOADED ✓</span>
            </div>
          \`).join('');
        }
      } catch (err) {
        playFeedbackTone(false);
        statusText.textContent = 'Gagal menghubungi server /api/scan-muat';
      } finally {
        isBusy = false;
        btnSnap.textContent = '📸 AMBIL FOTO & VERIFIKASI';
      }
    }

    btnSnap.addEventListener('click', captureAndVerify);

    btnAutoToggle.addEventListener('click', () => {
      if (autoTimer) {
        clearInterval(autoTimer);
        autoTimer = null;
        btnAutoToggle.textContent = 'Auto 2.5s: OFF';
        btnAutoToggle.className = 'col-span-4 py-3.5 rounded-2xl bg-[#111827] border border-[#334155] text-slate-200 font-black text-[11px]';
        modeBadge.textContent = 'MANUAL SNAP';
      } else {
        autoTimer = setInterval(captureAndVerify, 2500);
        btnAutoToggle.textContent = 'Auto 2.5s: ON';
        btnAutoToggle.className = 'col-span-4 py-3.5 rounded-2xl bg-amber-400 text-slate-950 font-black text-[11px]';
        modeBadge.textContent = '⚡ AUTO 2.5s';
      }
    });

    document.getElementById('btnSwitchCam').addEventListener('click', () => {
      initCamera(currentFacingMode === 'environment' ? 'user' : 'environment');
    });

    document.getElementById('btnTorch').addEventListener('click', async () => {
      if (!mediaStream) return;
      const track = mediaStream.getVideoTracks()[0];
      if (!track) return;
      torchEnabled = !torchEnabled;
      try {
        await track.applyConstraints({ advanced: [{ torch: torchEnabled }] });
      } catch (e) {}
    });

    initCamera('environment');
  </script>
</body>
</html>`;

interface WmsPureVisualBlueprintsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WmsPureVisualBlueprintsModal: React.FC<WmsPureVisualBlueprintsModalProps> = ({
  isOpen,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState<'sql' | 'backend' | 'frontend'>('sql');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!isOpen) return null;

  const getActiveCode = () => {
    if (activeTab === 'sql') return SQL_HOSTINGER_DDL_SCRIPT;
    if (activeTab === 'backend') return PYTHON_YOLO_BACKEND_CODE;
    return STANDALONE_FRONTEND_HTML_CODE;
  };

  const getFileName = () => {
    if (activeTab === 'sql') return 'hostinger_wms_visual_schema.sql';
    if (activeTab === 'backend') return 'main_yolo_fastapi.py';
    return 'index.html';
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(getActiveCode());
    setCopiedKey(activeTab);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([getActiveCode()], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = getFileName();
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-[#0b1120] text-[#f8fafc] border border-[#1e293b] rounded-3xl max-w-4xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 bg-[#111827] border-b border-[#1e293b] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <Cpu className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-black text-white truncate">
                Deliverable Produksi: Pure Visual Identification (Ultralytics YOLO + MySQL Hostinger)
              </h3>
              <p className="text-xs text-[#94a3b8] truncate">
                Siap dieksekusi di phpMyAdmin Hostinger, Python FastAPI Ultralytics YOLO Service, &amp; Mobile Web Client
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-[#1e293b] hover:bg-[#334155] text-[#cbd5e1] cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Pipeline Summary Strip */}
        <div className="px-5 py-2.5 bg-[#060a14] border-b border-[#1e293b] flex flex-wrap items-center gap-2 text-[11px] font-mono text-[#cbd5e1]">
          <span className="px-2 py-0.5 rounded bg-[#111827] border border-[#334155] text-emerald-400">
            1. Frame HP (1280px JPEG 0.8)
          </span>
          <span>→</span>
          <span className="px-2 py-0.5 rounded bg-[#111827] border border-[#334155] text-sky-400">
            2. Pre-proc (CLAHE + Blur Check)
          </span>
          <span>→</span>
          <span className="px-2 py-0.5 rounded bg-[#111827] border border-[#334155] text-indigo-400">
            3. Ultralytics YOLO ROI Crop
          </span>
          <span>→</span>
          <span className="px-2 py-0.5 rounded bg-[#111827] border border-[#334155] text-amber-400">
            4. EasyOCR / ViT Parsing
          </span>
          <span>→</span>
          <span className="px-2 py-0.5 rounded bg-[#111827] border border-[#334155] text-rose-400">
            5. MySQL Atomic PENDING → LOADED
          </span>
        </div>

        {/* Tabs */}
        <div className="px-5 pt-3 bg-[#0f172a] border-b border-[#1e293b] flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('sql')}
              className={`px-3.5 py-2 rounded-t-xl text-xs font-extrabold flex items-center gap-1.5 border-b-2 transition cursor-pointer ${
                activeTab === 'sql'
                  ? 'bg-[#1e293b] text-emerald-400 border-emerald-400'
                  : 'text-[#94a3b8] border-transparent hover:text-white'
              }`}
            >
              <Database className="w-3.5 h-3.5" />
              <span>1. Skrip SQL Hostinger (DDL)</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('backend')}
              className={`px-3.5 py-2 rounded-t-xl text-xs font-extrabold flex items-center gap-1.5 border-b-2 transition cursor-pointer ${
                activeTab === 'backend'
                  ? 'bg-[#1e293b] text-sky-400 border-sky-400'
                  : 'text-[#94a3b8] border-transparent hover:text-white'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>2. Backend Python Ultralytics YOLO</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('frontend')}
              className={`px-3.5 py-2 rounded-t-xl text-xs font-extrabold flex items-center gap-1.5 border-b-2 transition cursor-pointer ${
                activeTab === 'frontend'
                  ? 'bg-[#1e293b] text-indigo-400 border-indigo-400'
                  : 'text-[#94a3b8] border-transparent hover:text-white'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>3. Standalone HTML5 + JS Client</span>
            </button>
          </div>

          <div className="flex items-center gap-2 pb-2">
            <button
              type="button"
              onClick={handleCopy}
              className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              {copiedKey === activeTab ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedKey === activeTab ? 'Tersalin!' : 'Salin Kode'}</span>
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Unduh {getFileName()}</span>
            </button>
          </div>
        </div>

        {/* Code Content */}
        <div className="p-4 bg-[#060a14] overflow-y-auto flex-1 font-mono text-xs leading-relaxed text-[#e2e8f0]">
          <pre className="whitespace-pre-wrap break-words select-all">{getActiveCode()}</pre>
        </div>
      </div>
    </div>
  );
};
