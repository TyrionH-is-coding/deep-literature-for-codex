import path from 'node:path';

// Only operating-system and explicit network settings cross into this host.
export function isolatedEnvironment(root, parent = process.env, installation = {}, platform = process.platform) {
  const env = {};
  const keep = new Set(['SYSTEMROOT', 'WINDIR', 'COMSPEC', 'PATHEXT', 'TEMP', 'TMP',
    'USERPROFILE', 'LOCALAPPDATA', 'APPDATA', 'PROGRAMDATA', 'PROGRAMFILES',
    'PROGRAMFILES(X86)', 'COMMONPROGRAMFILES', 'PROCESSOR_ARCHITECTURE', 'NUMBER_OF_PROCESSORS',
    'USERNAME', 'USERDOMAIN', 'OS', 'HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'NO_PROXY',
    'SSL_CERT_FILE', 'SSL_CERT_DIR', 'NODE_EXTRA_CA_CERTS',
    'HOME', 'USER', 'LOGNAME', 'LANG', 'LC_ALL', 'LC_CTYPE', 'TMPDIR',
    'XDG_RUNTIME_DIR', 'DBUS_SESSION_BUS_ADDRESS', 'DISPLAY', 'WAYLAND_DISPLAY', 'XAUTHORITY']);
  for (const [key, value] of Object.entries(parent)) {
    if (keep.has(key.toUpperCase()) && value !== undefined) env[key.toUpperCase()] = value;
  }
  const windows = env.SYSTEMROOT || 'C:\\Windows';
  const systemPaths = platform === 'win32'
    ? [path.join(windows, 'System32'), windows, path.join(windows, 'System32', 'WindowsPowerShell', 'v1.0')]
    : ['/usr/local/bin', '/usr/bin', '/bin', '/usr/sbin', '/sbin'];
  env.PATH = [installation.node ? path.dirname(installation.node) : path.join(root, 'runtime', 'node'),
    installation.python ? path.dirname(installation.python) : path.join(root, 'runtime', 'venv', platform === 'win32' ? 'Scripts' : 'bin'),
    ...systemPaths].join(path.delimiter);
  env.DSH_HOME = path.join(root, 'state', 'dsh-home');
  env.DSH_TELEMETRY_DISABLED = '1';
  env.PYTHONUTF8 = '1';
  env.PYTHONIOENCODING = 'utf-8';
  env.PYTHONNOUSERSITE = '1';
  env.VIRTUAL_ENV = installation.python ? path.dirname(path.dirname(installation.python)) : path.join(root, 'runtime', 'venv');
  env.CODEX_HOME = path.join(root, 'state', 'codex-home');
  env.NO_COLOR = '1';
  return env;
}
