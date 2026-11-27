import http.server
import importlib.util
import io
import json
import os
from pathlib import Path
import plistlib
import subprocess
import sys
import tempfile
import threading
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]


def load_module(name, rel_path):
    spec = importlib.util.spec_from_file_location(name, ROOT / rel_path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


cdp = load_module('cdp_bootstrap', 'compat/cdp_bootstrap.py')
manager = load_module('pulse_manager', 'manage.py')


class CdpBootstrapTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.home = Path(self.temp.name)
        self.plugins_dir = self.home / '.gemini' / 'config' / 'plugins'
        self.plugins_dir.mkdir(parents=True, exist_ok=True)

    def _touch_plugin(self, plugin_id):
        plugin_dir = self.plugins_dir / plugin_id
        plugin_dir.mkdir(parents=True, exist_ok=True)
        (plugin_dir / 'plugin.json').write_text(json.dumps({'name': plugin_id}), encoding='utf-8')
        return plugin_dir

    def test_sandbox_never_reports_live_system(self):
        self.assertFalse(cdp._is_live_system(self.home, sys.platform))

    def test_multi_plugin_refcounting_and_stale_consumer_pruning(self):
        self._touch_plugin('antigravity-pulse')
        self._touch_plugin('antigravity-font-settings')
        self._touch_plugin('antigravity-timeline')

        res1 = cdp.ensure_cdp_bootstrap('antigravity-pulse', home=self.home, platform='darwin', quiet=True)
        res2 = cdp.ensure_cdp_bootstrap('antigravity-font-settings', home=self.home, platform='darwin', quiet=True)
        res3 = cdp.ensure_cdp_bootstrap('antigravity-timeline', home=self.home, platform='darwin', quiet=True)

        self.assertEqual(res1['action'], 'configured')
        self.assertEqual(res3['consumers'], [
            'antigravity-font-settings',
            'antigravity-pulse',
            'antigravity-timeline',
        ])
        plist_path = self.home / 'Library' / 'LaunchAgents' / f'{cdp.MACOS_AGENT_LABEL}.plist'
        self.assertTrue(plist_path.is_file())
        with plist_path.open('rb') as f:
            plist_data = plistlib.load(f)
        self.assertEqual(plist_data['Label'], cdp.MACOS_AGENT_LABEL)
        self.assertTrue(plist_data['RunAtLoad'])
        self.assertIn('.skip-restart-once', (cdp.shared_paths(self.home)['macos_script']).read_text(encoding='utf-8'))

        # Uninstalling one consumer preserves shared bootstrap for the others.
        rem1 = cdp.remove_cdp_bootstrap('antigravity-font-settings', home=self.home, platform='darwin', quiet=True)
        self.assertFalse(rem1['removed'])
        self.assertEqual(rem1['remaining'], ['antigravity-pulse', 'antigravity-timeline'])
        self.assertTrue(plist_path.is_file())

        # Simulate manual deletion of antigravity-timeline, then uninstall pulse.
        (self.plugins_dir / 'antigravity-timeline' / 'plugin.json').unlink()
        (self.plugins_dir / 'antigravity-timeline').rmdir()
        rem2 = cdp.remove_cdp_bootstrap('antigravity-pulse', home=self.home, platform='darwin', quiet=True)
        self.assertTrue(rem2['removed'])
        self.assertEqual(rem2['remaining'], [])
        self.assertFalse(plist_path.exists())
        self.assertFalse(cdp.shared_paths(self.home)['root'].exists())

    def test_schema_downgrade_is_blocked(self):
        self._touch_plugin('antigravity-pulse')
        paths = cdp.shared_paths(self.home)
        cdp._write_json(paths['version'], {'schemaVersion': 999, 'updatedBy': 'newer-plugin'})
        paths['macos_script'].write_text('custom-newer-script', encoding='utf-8')

        res = cdp.ensure_cdp_bootstrap('antigravity-pulse', home=self.home, platform='darwin', quiet=True)
        self.assertEqual(res['action'], 'reused_newer')
        self.assertEqual(paths['macos_script'].read_text(encoding='utf-8'), 'custom-newer-script')
        self.assertEqual(res['consumers'], ['antigravity-pulse'])

    def test_active_port_discovery_and_live_http_probe(self):
        class Handler(http.server.BaseHTTPRequestHandler):
            def do_GET(self):
                if self.path == '/json/version':
                    self.send_response(200)
                    self.end_headers()
                    self.wfile.write(b'{"Browser":"Electron"}')
                else:
                    self.send_response(404)
                    self.end_headers()

            def log_message(self, *args):
                pass

        server = http.server.HTTPServer(('127.0.0.1', 0), Handler)
        self.addCleanup(server.server_close)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        self.addCleanup(server.shutdown)

        roaming = self.home / 'custom-roaming'
        local = self.home / 'custom-local'
        port_file = roaming / 'Antigravity' / 'DevToolsActivePort'
        port_file.parent.mkdir(parents=True, exist_ok=True)
        port_file.write_text(f'{server.server_port}\n/devtools/browser/test\n', encoding='utf-8')

        status = cdp.inspect_cdp_status(
            home=self.home,
            platform='win32',
            env={'APPDATA': str(roaming), 'LOCALAPPDATA': str(local)},
        )
        self.assertTrue(status['cdpReady'])
        self.assertEqual(status['port'], server.server_port)
        self.assertEqual(status['portFile'], str(port_file))

    def test_manage_py_lifecycle_hooks_cdp_bootstrap(self):
        local = self.home / 'AppData' / 'Local'
        plugin = self.home / '.gemini' / 'config' / 'plugins' / 'antigravity-pulse'
        config = self.home / '.gemini' / 'config' / 'config.json'
        settings = local / 'AntigravityPulse' / 'settings.json'
        app = local / 'Programs' / 'antigravity' / 'resources' / 'app.asar'
        backups = local / 'AntigravityPulseBackups'
        app.parent.mkdir(parents=True, exist_ok=True)
        app.write_bytes(b'clean-app-asar')

        with patch.multiple(manager, HOME=self.home, LOCAL=local, PLUGIN=plugin,
                            CONFIG=config, SETTINGS=settings, APP=app, BACKUPS=backups):
            # Keep an unrelated consumer registered to verify uninstall keeps shared bootstrap.
            self._touch_plugin('antigravity-timeline')
            cdp.ensure_cdp_bootstrap('antigravity-timeline', home=self.home, quiet=True)

            manager.install(panel_only=False)
            paths = cdp.shared_paths(self.home)
            self.assertIn('antigravity-pulse', cdp._read_json(paths['consumers'], {})['plugins'])

            buf = io.StringIO()
            with patch('sys.stdout', buf):
                manager.status()
            payload = json.loads(buf.getvalue())
            self.assertTrue(payload['cdpBootstrap']['bootstrapInstalled'])
            self.assertIn('antigravity-pulse', payload['cdpBootstrap']['consumers'])

            manager.uninstall()
            remaining = cdp._read_json(paths['consumers'], {})['plugins']
            self.assertEqual(remaining, ['antigravity-timeline'])
            self.assertTrue(paths['root'].exists())

    @unittest.skipUnless(sys.platform == 'darwin' and Path('/usr/bin/osacompile').is_file(),
                         'macOS osacompile compilation test')
    def test_macos_osacompile_in_isolated_applications_dir(self):
        fake_apps = self.home / 'Applications'
        launcher = Path(cdp._install_macos_launcher(self.home, live=False, applications_dir=fake_apps))
        self.assertTrue(launcher.is_dir())
        with (launcher / 'Contents' / 'Info.plist').open('rb') as f:
            info = plistlib.load(f)
        self.assertEqual(info['CFBundleIdentifier'], cdp.MACOS_LAUNCHER_BUNDLE_ID)
        self.assertTrue((launcher / 'Contents' / 'Resources' / 'Scripts' / 'main.scpt').is_file())

    @unittest.skipUnless(sys.platform == 'win32', 'Windows shortcut and registry integration test')
    def test_windows_shortcut_patching_idempotency_and_restoration(self):
        desktop = self.home / 'Desktop'
        programs = self.home / 'Programs'
        exe_dir = self.home / 'LocalApp'
        for d in (desktop, programs, exe_dir):
            d.mkdir(parents=True, exist_ok=True)
        fake_exe = exe_dir / 'Antigravity.exe'
        fake_exe.write_bytes(b'MZ')

        lnk_desktop = desktop / 'Antigravity.lnk'
        lnk_programs = programs / 'Antigravity.lnk'
        reg_key = f'HKCU:\\Software\\AntigravityCdpTest_{os.getpid()}'

        def cleanup_reg():
            subprocess.run(
                ['powershell', '-NoProfile', '-Command', f"Remove-Item -Path '{reg_key}' -Recurse -Force -ErrorAction SilentlyContinue"],
                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
            )

        self.addCleanup(cleanup_reg)

        create_ps = f"""
$s = New-Object -ComObject WScript.Shell
$a = $s.CreateShortcut('{lnk_desktop}'); $a.TargetPath = '{fake_exe}'; $a.Arguments = ''; $a.Save()
$b = $s.CreateShortcut('{lnk_programs}'); $b.TargetPath = '{fake_exe}'; $b.Arguments = '--lang=zh-CN'; $b.Save()
"""
        subprocess.run(['powershell', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', create_ps], check=True)

        paths = cdp.shared_paths(self.home)
        paths['root'].mkdir(parents=True, exist_ok=True)

        res1 = cdp._setup_windows(paths, live=True, search_roots=[desktop, programs], run_reg_path=reg_key)
        self.assertEqual(res1['shortcutsUpdated'], 2)

        # Idempotent second run must not duplicate CDP args.
        res2 = cdp._setup_windows(paths, live=True, search_roots=[desktop, programs], run_reg_path=reg_key)
        self.assertEqual(res2['shortcutsUpdated'], 2)

        read_ps = f"""
$s = New-Object -ComObject WScript.Shell
@{{
  desktop = $s.CreateShortcut('{lnk_desktop}').Arguments
  programs = $s.CreateShortcut('{lnk_programs}').Arguments
  reg = (Get-ItemProperty -Path '{reg_key}' -Name '{cdp.WINDOWS_RUN_VALUE}').'{cdp.WINDOWS_RUN_VALUE}'
}} | ConvertTo-Json
"""
        out = subprocess.check_output(['powershell', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', read_ps], text=True)
        data = json.loads(out)
        self.assertEqual(data['desktop'], cdp.CDP_ARGS)
        self.assertEqual(data['programs'], f'--lang=zh-CN {cdp.CDP_ARGS}')
        self.assertEqual(data['desktop'].count('--remote-debugging-port='), 1)
        self.assertIn('antigravity-cdp.ps1', data['reg'])

        cdp._restore_windows(paths, live=True, run_reg_path=reg_key)
        verify_restore_ps = f"""
$s = New-Object -ComObject WScript.Shell
@{{
  desktop = $s.CreateShortcut('{lnk_desktop}').Arguments
  programs = $s.CreateShortcut('{lnk_programs}').Arguments
  regExists = [bool](Get-ItemProperty -Path '{reg_key}' -Name '{cdp.WINDOWS_RUN_VALUE}' -ErrorAction SilentlyContinue)
}} | ConvertTo-Json
"""
        restored = json.loads(subprocess.check_output(
            ['powershell', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', verify_restore_ps], text=True
        ))
        self.assertEqual(restored['desktop'], '')
        self.assertEqual(restored['programs'], '--lang=zh-CN')
        self.assertFalse(restored['regExists'])

        # Fallback shortcut creation & cleanup when no existing shortcut matches.
        empty_root = self.home / 'EmptyShortcuts'
        fallback_desktop = self.home / 'FallbackDesktop'
        empty_root.mkdir(parents=True, exist_ok=True)
        fallback_desktop.mkdir(parents=True, exist_ok=True)
        res_fb = cdp._setup_windows(
            paths,
            live=True,
            search_roots=[empty_root],
            exe_candidates=[fake_exe],
            fallback_desktop=fallback_desktop,
            run_reg_path=reg_key,
        )
        self.assertEqual(res_fb['shortcutsUpdated'], 1)
        created_lnk = fallback_desktop / 'Antigravity Launcher.lnk'
        self.assertTrue(created_lnk.is_file())
        cdp._restore_windows(paths, live=True, run_reg_path=reg_key)
        self.assertFalse(created_lnk.exists())


if __name__ == '__main__':
    unittest.main()
