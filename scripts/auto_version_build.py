#!/usr/bin/env python3
"""
Skrip Build Otomatis & Pembaruan Versi (Auto-Versioning Build Script)
Memperbarui versionCode dan versionName di build.gradle, AndroidManifest.xml (dalam build_apk.py),
dan public/version.json setiap kali ada commit atau perubahan signifikan pada DriverMobileView.
"""

import os
import re
import json
import hashlib
import subprocess
import datetime
import shutil

APP_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DRIVER_VIEW_PATH = os.path.join(APP_ROOT, "src/components/DriverMobileView.tsx")
BUILD_GRADLE_PATH = os.path.join(APP_ROOT, "android/app/build.gradle")
BUILD_APK_SCRIPT = os.path.join(APP_ROOT, "scripts/build_apk.py")
VERSION_STATE_PATH = os.path.join(APP_ROOT, ".version_state.json")
PUBLIC_VERSION_PATH = os.path.join(APP_ROOT, "public/version.json")
DOWNLOAD_APK_TARGETS = [
    os.path.join(APP_ROOT, "public/downloads/akk-mobile-v1.apk"),
]

def get_file_hash(filepath):
    if not os.path.exists(filepath):
        return ""
    hasher = hashlib.md5()
    with open(filepath, "rb") as f:
        buf = f.read()
        hasher.update(buf)
    return hasher.hexdigest()

def load_version_state():
    if os.path.exists(VERSION_STATE_PATH):
        with open(VERSION_STATE_PATH, "r") as f:
            return json.load(f)
    return {"versionCode": 10004, "versionName": "1.0.4", "driverViewHash": ""}

def save_version_state(state):
    with open(VERSION_STATE_PATH, "w") as f:
        json.dump(state, f, indent=2)

def main():
    print("[AUTO-BUILD] Memeriksa perubahan pada DriverMobileView & repositori...")
    
    current_hash = get_file_hash(DRIVER_VIEW_PATH)
    state = load_version_state()
    
    changed = current_hash != state.get("driverViewHash", "")
    if changed or not state.get("driverViewHash"):
        print("[AUTO-BUILD] Perubahan terdeteksi pada DriverMobileView.tsx! Meningkatkan versionCode & versionName...")
        old_code = state.get("versionCode", 10004)
        new_code = old_code + 1
        base_patch = new_code - 10000
        new_name = f"1.0.{base_patch}"
        
        state["versionCode"] = new_code
        state["versionName"] = new_name
        state["driverViewHash"] = current_hash
    else:
        print("[AUTO-BUILD] Tidak ada perubahan kode DriverMobileView, menggunakan versi terkini:", state.get("versionName"))
        new_code = state.get("versionCode", 10004)
        new_name = state.get("versionName", "1.0.4")

    save_version_state(state)

    # 1. Update android/app/build.gradle
    if os.path.exists(BUILD_GRADLE_PATH):
        with open(BUILD_GRADLE_PATH, "r") as f:
            gradle_content = f.read()
        gradle_content = re.sub(r'versionCode\s+\d+', f'versionCode {new_code}', gradle_content)
        gradle_content = re.sub(r'versionName\s+"[^"]+"', f'versionName "{new_name}"', gradle_content)
        with open(BUILD_GRADLE_PATH, "w") as f:
            f.write(gradle_content)
        print(f"-> Diperbarui: {BUILD_GRADLE_PATH} (Code: {new_code}, Name: {new_name})")

    # 2. Update scripts/build_apk.py manifest template
    if os.path.exists(BUILD_APK_SCRIPT):
        with open(BUILD_APK_SCRIPT, "r") as f:
            py_content = f.read()
        py_content = re.sub(r'android:versionCode="\d+"', f'android:versionCode="{new_code}"', py_content)
        py_content = re.sub(r'android:versionName="[^"]+"', f'android:versionName="{new_name}"', py_content)
        with open(BUILD_APK_SCRIPT, "w") as f:
            f.write(py_content)
        print(f"-> Diperbarui: {BUILD_APK_SCRIPT} (Code: {new_code}, Name: {new_name})")

    # 3. Update public/version.json for frontend notification
    version_info = {
        "versionCode": new_code,
        "versionName": new_name,
        "updatedAt": datetime.datetime.now().isoformat(),
        "changelog": f"Pembaruan otomatis Driver Mobile v{new_name} (Code: {new_code})."
    }
    os.makedirs(os.path.dirname(PUBLIC_VERSION_PATH), exist_ok=True)
    with open(PUBLIC_VERSION_PATH, "w") as f:
        json.dump(version_info, f, indent=2)
    print(f"-> Diperbarui: {PUBLIC_VERSION_PATH}")

    # 4. Attempt compiling APK via build_apk.py, fallback to existing valid signed APK if build fails
    apk_built = False
    if shutil.which("aapt") and shutil.which("javac"):
        try:
            print("[AUTO-BUILD] Menjalankan skrip build APK biner resmi...")
            subprocess.check_call(["python3", BUILD_APK_SCRIPT])
            apk_built = True
        except Exception as e:
            print(f"[AUTO-BUILD] Warning: build_apk.py gagal ({e})")
    
    if not apk_built:
        print(f"[AUTO-BUILD] Mempertahankan berkas APK resmi yang telah ter-zipalign dan ditandatangani.")

    print(f"[AUTO-BUILD] SUKSES: Skrip build otomatis memperbarui versionCode ({new_code}) & versionName ({new_name})!")

if __name__ == "__main__":
    main()
