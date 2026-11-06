#!/usr/bin/env python3
"""Standalone Antigrative Dashboard installer and bootstrap helper.

Supports:
1. Local execution:
   python3 install.py [--panel-only] [--app-path <path>]
2. Direct remote / curl execution:
   curl -fsSL https://raw.githubusercontent.com/moumouye/antigrative-dashboard/main/install.py | python3
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import urllib.error
import urllib.request
import zipfile

REPO = 'moumouye/antigrative-dashboard'
DEFAULT_TARGET_DIR = Path.home() / '.gemini' / 'antigrative-dashboard'


def fetch_url(url, headers=None, timeout=60):
    request_headers = {
        'User-Agent': 'Antigrative-Dashboard-Installer',
        'Accept': 'application/vnd.github.v3+json, application/octet-stream, */*'
    }
    if headers:
        request_headers.update(headers)
    req = urllib.request.Request(url, headers=request_headers)
    with urllib.request.urlopen(req, timeout=timeout) as response:
        return response.read()


def get_release_asset_info(version=None):
    """Query GitHub API for release zip and sha256 assets."""
    api_url = (f'https://api.github.com/repos/{REPO}/releases/tags/v{version}'
               if version else f'https://api.github.com/repos/{REPO}/releases/latest')
    try:
        data = json.loads(fetch_url(api_url).decode('utf-8'))
        assets = data.get('assets', [])
        zip_asset = next((a for a in assets if a['name'].startswith('antigrative-dashboard-') and a['name'].endswith('.zip')), None)
        sha_asset = next((a for a in assets if a['name'].startswith('antigrative-dashboard-') and a['name'].endswith('.zip.sha256')), None)
        if zip_asset:
            return {
                'tag': data.get('tag_name', ''),
                'zip_url': zip_asset['browser_download_url'],
                'zip_name': zip_asset['name'],
                'sha_url': sha_asset['browser_download_url'] if sha_asset else None,
            }
    except (urllib.error.URLError, json.JSONDecodeError, KeyError):
        pass
    return None


def download_and_extract(target_dir, version=None):
    """Download package from GitHub Release (or fallback archive) and extract to target_dir."""
    target_dir.mkdir(parents=True, exist_ok=True)
    release_info = get_release_asset_info(version)

    with tempfile.TemporaryDirectory() as temp_dir:
        temp_path = Path(temp_dir)
        zip_path = temp_path / 'package.zip'

        if release_info and release_info.get('zip_url'):
            print(f"[*] Downloading Antigrative Dashboard {release_info.get('tag', '')} from GitHub Releases...")
            zip_bytes = fetch_url(release_info['zip_url'])
            zip_path.write_bytes(zip_bytes)

            if release_info.get('sha_url'):
                try:
                    sha_expected = fetch_url(release_info['sha_url']).decode('utf-8').split()[0].strip()
                    sha_actual = hashlib.sha256(zip_bytes).hexdigest()
                    if sha_expected and sha_actual != sha_expected:
                        raise RuntimeError(f"Checksum mismatch! Expected {sha_expected}, got {sha_actual}")
                    print("[✓] Checksum verified.")
                except Exception as e:
                    print(f"[!] Checksum verification warning: {e}")
        else:
            # Fallback to source archive if release is not yet published
            branch = f"v{version}" if version else "main"
            archive_url = f"https://github.com/{REPO}/archive/refs/heads/{branch}.zip"
            print(f"[*] Downloading source archive from {archive_url}...")
            try:
                zip_bytes = fetch_url(archive_url)
            except urllib.error.HTTPError:
                archive_url = f"https://github.com/{REPO}/archive/refs/heads/main.zip"
                print(f"[*] Retrying with main branch archive: {archive_url}...")
                zip_bytes = fetch_url(archive_url)
            zip_path.write_bytes(zip_bytes)

        print(f"[*] Extracting to {target_dir}...")
        with zipfile.ZipFile(zip_path, 'r') as archive:
            members = archive.namelist()
            file_parts = [m.split('/') for m in members if not m.endswith('/')]
            first_dirs = {p[0] for p in file_parts if len(p) > 1}
            root_prefix = first_dirs.pop() if len(first_dirs) == 1 and not any(len(p) == 1 for p in file_parts) else ''
            for member in members:
                rel_path = member
                if root_prefix and member.startswith(root_prefix + '/'):
                    rel_path = member[len(root_prefix) + 1:]
                if not rel_path or rel_path.endswith('/'):
                    continue
                dest = target_dir / rel_path
                dest.parent.mkdir(parents=True, exist_ok=True)
                with archive.open(member) as src, open(dest, 'wb') as dst:
                    shutil.copyfileobj(src, dst)

    return target_dir


def find_local_manage_py():
    """Check if manage.py is present next to the current script file."""
    try:
        script_dir = Path(__file__).resolve().parent
        candidate = script_dir / 'manage.py'
        if candidate.is_file():
            return candidate
    except (NameError, TypeError):
        pass
    return None


def run_manage_install(manage_py_path, args):
    """Execute manage.py install with forwarded arguments."""
    cmd = [sys.executable, str(manage_py_path), 'install']
    if args.panel_only:
        cmd.append('--panel-only')
    if args.legacy_loader:
        cmd.append('--legacy-loader')
    if args.app_path:
        cmd.extend(['--app-path', str(args.app_path)])

    print(f"[*] Running installation: {' '.join(cmd)}")
    result = subprocess.run(cmd)
    if result.returncode != 0:
        raise SystemExit(result.returncode)


def main():
    parser = argparse.ArgumentParser(description="Antigrative Dashboard installer")
    parser.add_argument('--panel-only', action='store_true', help="Install sidecar panel only without inline toolbar")
    parser.add_argument('--legacy-loader', action='store_true', help="Opt in to legacy app.asar loader (Windows only)")
    parser.add_argument('--app-path', type=Path, help="Custom path to Antigravity resources/app.asar")
    parser.add_argument('--target-dir', type=Path, default=DEFAULT_TARGET_DIR,
                        help=f"Directory to save dashboard source (default: {DEFAULT_TARGET_DIR})")
    parser.add_argument('--version', type=str, default=None, help="Specific version tag to install (e.g. 0.8.19)")
    args = parser.parse_args()

    local_manage = find_local_manage_py()
    if local_manage:
        # Running directly inside local repository or unpacked folder
        run_manage_install(local_manage, args)
    else:
        # Running via curl / standalone script
        print(f"=== Antigrative Dashboard Installer ({REPO}) ===")
        target_dir = download_and_extract(args.target_dir.resolve(), version=args.version)
        manage_py = target_dir / 'manage.py'
        if not manage_py.is_file():
            print(f"[!] Error: manage.py not found in {target_dir}", file=sys.stderr)
            raise SystemExit(1)
        run_manage_install(manage_py, args)
        print("\n=== Installation Complete ===")
        print(f"Source saved at: {target_dir}")
        print("Useful commands:")
        print(f"  {sys.executable} {manage_py} status      # Check installation status")
        print(f"  {sys.executable} {manage_py} enable      # Enable widget")
        print(f"  {sys.executable} {manage_py} disable     # Temporarily disable widget")
        print(f"  {sys.executable} {manage_py} uninstall   # Uninstall widget")


if __name__ == '__main__':
    main()
