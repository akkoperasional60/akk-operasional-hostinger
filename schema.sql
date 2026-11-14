-- ====================================================================
-- HOSTINGER MYSQL ENTERPRISE LOGISTICS & OPERATIONAL DATABASE SCHEMA
-- For PT Anugrah Kemasan Kreatif (PT AKK Logistics Banyuwangi DC)
-- Engine: MySQL / MariaDB (Importable via Hostinger phpMyAdmin)
-- ====================================================================

-- NON-DESTRUCTIVE: this file never DROPs or TRUNCATEs application tables.
SET FOREIGN_KEY_CHECKS = 0;

-- 1. USERS & PROFILES (Authentication & Role Based Access Control)
CREATE TABLE IF NOT EXISTS `users` (
  `id` VARCHAR(64) NOT NULL PRIMARY KEY,
  `email` VARCHAR(191) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `full_name` VARCHAR(255) NOT NULL,
  `role` VARCHAR(50) NOT NULL DEFAULT 'unassigned',
  `department` VARCHAR(100) DEFAULT 'Logistics Operations',
  `phone` VARCHAR(50) NULL,
  `status` VARCHAR(20) DEFAULT 'pending',
  `approved_at` DATETIME NULL,
  `approved_by` VARCHAR(191) NULL,
  `notes` TEXT NULL,
  `permissions_json` JSON NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. FLEETS (Armada Kendaraan Operasional)
CREATE TABLE IF NOT EXISTS `fleets` (
  `id` VARCHAR(64) NOT NULL PRIMARY KEY,
  `plate_number` VARCHAR(30) NOT NULL UNIQUE,
  `vehicle_type` VARCHAR(100) NOT NULL, -- 'Pick Up Box', 'Engkel STD', 'Engkel Long', 'Double STD'
  `tonnage_capacity` DECIMAL(5,2) NOT NULL DEFAULT 0.00, -- metric tons
  `current_tonnage` DECIMAL(5,2) DEFAULT 0.00,
  `status` ENUM('available', 'on-duty', 'maintenance') DEFAULT 'available',
  `gps_imei` VARCHAR(100) NULL,
  `fuel_level_percent` INT DEFAULT 100,
  `odometer_km` INT DEFAULT 0,
  `year` INT DEFAULT 2024,
  `last_maintenance` DATE NULL,
  `payload_json` JSON NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. CREWS (Supir dan Helper / Kernet)
CREATE TABLE IF NOT EXISTS `crews` (
  `id` VARCHAR(64) NOT NULL PRIMARY KEY,
  `name` VARCHAR(191) NOT NULL,
  `phone` VARCHAR(50) NOT NULL,
  `role` VARCHAR(50) NOT NULL, -- 'Driver Utama', 'Driver Cadangan', 'Kernet / Helper'
  `license_number` VARCHAR(100) NOT NULL,
  `license_type` VARCHAR(50) NOT NULL, -- 'SIM B2 Umum', 'SIM B1 Umum', 'SIM A'
  `status` ENUM('available', 'on-duty', 'off') DEFAULT 'available',
  `trips_completed` INT DEFAULT 0,
  `rating` DECIMAL(3,2) DEFAULT 5.00,
  `payload_json` JSON NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. STORES (Toko Retail & Outlet Pelanggan)
CREATE TABLE IF NOT EXISTS `stores` (
  `id` VARCHAR(64) NOT NULL PRIMARY KEY,
  `store_code` VARCHAR(50) NOT NULL UNIQUE,
  `store_name` VARCHAR(191) NOT NULL,
  `island` VARCHAR(100) NOT NULL, -- 'Jawa', 'Bali & Nusa Tenggara', 'Sumatera', etc.
  `province` VARCHAR(100) NOT NULL,
  `city` VARCHAR(100) NOT NULL,
  `address` TEXT NOT NULL,
  `latitude` DECIMAL(10, 8) NOT NULL,
  `longitude` DECIMAL(11, 8) NOT NULL,
  `contact_person` VARCHAR(100) NOT NULL,
  `phone` VARCHAR(50) NOT NULL,
  `delivery_window` VARCHAR(50) DEFAULT '08:00 - 17:00',
  `store_category` VARCHAR(50) DEFAULT 'Supermarket',
  `payload_json` JSON NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. SCHEDULES (Jadwal Pengiriman & Penugasan Logistik)
CREATE TABLE IF NOT EXISTS `schedules` (
  `id` VARCHAR(64) NOT NULL PRIMARY KEY,
  `tracking_number` VARCHAR(100) NOT NULL UNIQUE,
  `origin_name` VARCHAR(191) DEFAULT 'Gudang Pusat Banyuwangi DC',
  `origin_latitude` DECIMAL(10, 8) DEFAULT -8.19060000,
  `origin_longitude` DECIMAL(11, 8) DEFAULT 114.37080000,
  `store_id` VARCHAR(64) NULL,
  `fleet_id` VARCHAR(64) NULL,
  `crew_id` VARCHAR(64) NULL,
  `crew_helper_id` VARCHAR(64) NULL,
  `crew_helper2_id` VARCHAR(64) NULL,
  `status` VARCHAR(30) DEFAULT 'scheduled',
  `departure_date` DATETIME NOT NULL,
  `estimated_arrival` DATETIME NOT NULL,
  `actual_arrival` DATETIME NULL,
  `cargo_description` TEXT NOT NULL,
  `cargo_weight_ton` DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  `is_inter_island` TINYINT(1) DEFAULT 0,
  `ferry_booking_code` VARCHAR(100) NULL,
  `transit_port` VARCHAR(100) NULL,
  `notes` TEXT NULL,
  `payload_json` JSON NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`fleet_id`) REFERENCES `fleets`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`crew_id`) REFERENCES `crews`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. TRACKING_LOGS (Historis GPS & Tracking Operations)
CREATE TABLE IF NOT EXISTS `tracking_logs` (
  `id` VARCHAR(64) NOT NULL PRIMARY KEY,
  `schedule_id` VARCHAR(64) NOT NULL,
  `timestamp` DATETIME NOT NULL,
  `latitude` DECIMAL(10, 8) NOT NULL,
  `longitude` DECIMAL(11, 8) NOT NULL,
  `speed` DECIMAL(5, 2) DEFAULT 0.00,
  `engine_status` ENUM('RUNNING', 'STOP', 'IDLE') DEFAULT 'IDLE',
  `location_name` VARCHAR(255) NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`schedule_id`) REFERENCES `schedules`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. DATABRIDGE_SYNC_LOGS (Google Sheets & External API Sync Audit)
CREATE TABLE IF NOT EXISTS `databridge_sync_logs` (
  `id` VARCHAR(64) NOT NULL PRIMARY KEY,
  `timestamp` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `status` ENUM('success', 'warning', 'error', 'in_progress') DEFAULT 'success',
  `source_type` VARCHAR(100) DEFAULT 'google_sheets_api',
  `sheet_name` VARCHAR(100) NULL,
  `stores_count` INT DEFAULT 0,
  `schedules_count` INT DEFAULT 0,
  `fleets_count` INT DEFAULT 0,
  `crews_count` INT DEFAULT 0,
  `details` JSON NULL,
  `message` TEXT NULL,
  `duration_ms` INT DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. SPARE_PARTS (Inventaris & Stok Bengkel)
CREATE TABLE IF NOT EXISTS `spare_parts` (
  `id` VARCHAR(64) NOT NULL PRIMARY KEY,
  `code` VARCHAR(50) NOT NULL UNIQUE,
  `name` VARCHAR(191) NOT NULL,
  `category` VARCHAR(100) NOT NULL,
  `stock` INT DEFAULT 0,
  `min_stock` INT DEFAULT 5,
  `unit_price` DECIMAL(12,2) DEFAULT 0.00,
  `supplier` VARCHAR(191) NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. FUEL_LOGS (Pencatatan Klaim BBM & Efisiensi)
CREATE TABLE IF NOT EXISTS `fuel_logs` (
  `id` VARCHAR(64) NOT NULL PRIMARY KEY,
  `fleet_id` VARCHAR(64) NOT NULL,
  `driver_name` VARCHAR(191) NOT NULL,
  `fuel_liters` DECIMAL(8,2) NOT NULL,
  `cost_rupiah` DECIMAL(12,2) NOT NULL,
  `odometer_km` INT NOT NULL,
  `spbu_location` VARCHAR(191) NOT NULL,
  `logged_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`fleet_id`) REFERENCES `fleets`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- 10. APP_STATE (Snapshot JSON persisten untuk data kompleks UI seperti jadwal mingguan)
CREATE TABLE IF NOT EXISTS `app_state` (
  `state_key` VARCHAR(100) NOT NULL PRIMARY KEY,
  `state_json` JSON NOT NULL,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 11. ATTENDANCE (Presensi driver/helper)
CREATE TABLE IF NOT EXISTS `attendance` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `crew_id` VARCHAR(64) NOT NULL,
  `date` DATE NOT NULL,
  `status` VARCHAR(30) NOT NULL DEFAULT 'present',
  `reason` TEXT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_attendance_crew_date` (`crew_id`, `date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 12. WMS_SURAT_JALAN (Header Surat Jalan / Faktur DO untuk Verifikasi Muat Visual YOLO)
CREATE TABLE IF NOT EXISTS `wms_surat_jalan` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `no_do` VARCHAR(100) NOT NULL UNIQUE,
  `tanggal` DATE NOT NULL,
  `customer` VARCHAR(191) NOT NULL,
  `status` ENUM('OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'OPEN',
  `total_qty` INT NOT NULL DEFAULT 0,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_wms_sj_no_do` (`no_do`),
  INDEX `idx_wms_sj_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 13. WMS_ITEM_MUAT (Detail Item Kemasan per Surat Jalan pada WMS Visual Scanner)
CREATE TABLE IF NOT EXISTS `wms_item_muat` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `surat_jalan_id` BIGINT UNSIGNED NOT NULL,
  `kode_unik_kemasan` VARCHAR(120) NOT NULL,
  `nama_barang` VARCHAR(255) NOT NULL,
  `status_muat` ENUM('PENDING', 'LOADED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_wms_item_lookup` (`kode_unik_kemasan`, `surat_jalan_id`, `status_muat`),
  CONSTRAINT `fk_wms_item_sj` FOREIGN KEY (`surat_jalan_id`) REFERENCES `wms_surat_jalan`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 14. WMS_SCAN_LOGS (Riwayat Audit Log Pemindaian Visual & Bukti Foto Muat)
CREATE TABLE IF NOT EXISTS `wms_scan_logs` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `item_id` BIGINT UNSIGNED NULL,
  `no_do` VARCHAR(100) NOT NULL,
  `gate_id` VARCHAR(50) NOT NULL,
  `scan_method` ENUM('visual_yolo_ocr', 'rfid_manual') NOT NULL DEFAULT 'visual_yolo_ocr',
  `confidence_score` DECIMAL(5,4) NOT NULL DEFAULT 0.9500,
  `foto_path` VARCHAR(255) NULL,
  `scanned_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_wms_logs_no_do` (`no_do`, `scanned_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 15. WMS_DATABASE_BARANG (Master Database Barang Gudang WMS Terpusat untuk Sinkronisasi PC & HP)
CREATE TABLE IF NOT EXISTS `wms_database_barang` (
  `id` VARCHAR(96) NOT NULL PRIMARY KEY,
  `order_index` INT NOT NULL DEFAULT 0,
  `no_barang` VARCHAR(100) NOT NULL,
  `deskripsi_barang` VARCHAR(500) NOT NULL,
  `unit1` VARCHAR(50) DEFAULT 'Pcs',
  `unit2` VARCHAR(50) DEFAULT '',
  `unit3` VARCHAR(50) DEFAULT '',
  `rasio2` VARCHAR(50) DEFAULT '0',
  `rasio3` VARCHAR(50) DEFAULT '0',
  `panjang_cm` DECIMAL(10,2) DEFAULT 0.00,
  `lebar_cm` DECIMAL(10,2) DEFAULT 0.00,
  `tinggi_cm` DECIMAL(10,2) DEFAULT 0.00,
  `vol_m3` DECIMAL(12,4) DEFAULT 0.0000,
  `berat_kg` DECIMAL(10,2) DEFAULT 0.00,
  `dokumentasi_url` MEDIUMTEXT NULL,
  `dokumentasi_urls_json` LONGTEXT NULL,
  `payload_json` LONGTEXT NULL,
  `updated_at` VARCHAR(32) NULL,
  INDEX `idx_wms_db_barang_order` (`order_index`),
  INDEX `idx_wms_db_barang_code` (`no_barang`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ====================================================================
-- SAFE UPGRADE FOR AN EARLIER HOSTINGER SCHEMA (NO DROP / NO TRUNCATE)
-- ====================================================================
-- Hostinger Web/Cloud uses MariaDB, which supports ADD COLUMN IF NOT EXISTS.
ALTER TABLE `users` MODIFY COLUMN `role` VARCHAR(50) NOT NULL DEFAULT 'unassigned';
ALTER TABLE `users` MODIFY COLUMN `status` VARCHAR(20) NOT NULL DEFAULT 'pending';
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `approved_at` DATETIME NULL AFTER `status`;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `approved_by` VARCHAR(191) NULL AFTER `approved_at`;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `notes` TEXT NULL AFTER `approved_by`;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `permissions_json` JSON NULL AFTER `notes`;

ALTER TABLE `fleets` ADD COLUMN IF NOT EXISTS `payload_json` JSON NULL AFTER `last_maintenance`;
ALTER TABLE `crews` ADD COLUMN IF NOT EXISTS `payload_json` JSON NULL AFTER `rating`;
ALTER TABLE `stores` ADD COLUMN IF NOT EXISTS `payload_json` JSON NULL AFTER `store_category`;
ALTER TABLE `schedules` MODIFY COLUMN `status` VARCHAR(30) NOT NULL DEFAULT 'scheduled';
ALTER TABLE `schedules` ADD COLUMN IF NOT EXISTS `crew_helper_id` VARCHAR(64) NULL AFTER `crew_id`;
ALTER TABLE `schedules` ADD COLUMN IF NOT EXISTS `crew_helper2_id` VARCHAR(64) NULL AFTER `crew_helper_id`;
ALTER TABLE `schedules` ADD COLUMN IF NOT EXISTS `payload_json` JSON NULL AFTER `notes`;

-- ====================================================================
-- BOOTSTRAP USER POLICY (TANPA SEED DATA OPERASIONAL)
-- ====================================================================

-- USERS TIDAK DI-SEED DENGAN PASSWORD DEFAULT.
-- Database existing tetap dipertahankan. Untuk database baru, aplikasi membuat Super Admin awal
-- hanya jika BOOTSTRAP_ADMIN_EMAIL + BOOTSTRAP_ADMIN_PASSWORD diisi pada Environment Variables Hostinger.
-- Setelah login pertama berhasil, hapus BOOTSTRAP_ADMIN_PASSWORD dari Environment Variables.

-- ====================================================================
-- PRODUCTION DATA POLICY
-- ====================================================================
-- Tidak ada seed Armada, Crew, Toko, atau Jadwal pada schema produksi.
-- Data operasional harus berasal dari input/import yang benar di aplikasi.
-- Ini mencegah data contoh/demo tampil seolah-olah data nyata setelah deploy.
-- Super Admin pertama tetap dibuat oleh server melalui BOOTSTRAP_ADMIN_* ENV.

SET FOREIGN_KEY_CHECKS = 1;
