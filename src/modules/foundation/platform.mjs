import path from 'node:path';
import os from 'node:os';

export const SUPPORTED_PLATFORMS = ['win32-x64', 'darwin-arm64', 'darwin-x64', 'linux-x64', 'linux-arm64'];

export function selectPlatformPins(pins, platform = process.platform, arch = process.arch) {
  const key = `${platform}-${arch}`;
  if (!SUPPORTED_PLATFORMS.includes(key)) throw new Error(`unsupported_platform: ${key}`);
  const selected = pins.platforms?.[key];
  if (!selected && key !== pins.platform) throw new Error(`runtime_pins_missing: ${key}`);
  return { ...pins, platform: key, node: { ...pins.node, ...selected?.node },
    python: { ...pins.python, ...selected?.python } };
}

export function runtimePaths(root, pins) {
  const windows = pins.platform === 'win32-x64';
  const suffix = windows ? '' : `-${pins.platform}`;
  const nodeRoot = path.join(root, 'runtime', 'node', pins.node.version + suffix);
  const pythonRoot = path.join(root, 'runtime', 'python', `${pins.python.version}-${pins.python.build}${suffix}`);
  return { nodeRoot, pythonRoot,
    node: path.join(nodeRoot, ...(windows ? ['node.exe'] : ['bin', 'node'])),
    pythonBase: path.join(pythonRoot, 'python', ...(windows ? ['python.exe'] : ['bin', 'python3'])) };
}

export const venvPython = (root, platform = process.platform) => path.join(root,
  ...(platform === 'win32' ? ['Scripts', 'python.exe'] : ['bin', 'python3']));
export const directoryLinkType = () => process.platform === 'win32' ? 'junction' : 'dir';
export const defaultRoot = () => path.join(os.homedir(), 'CodexScientificReading');

export function npmCli(node, platform = process.platform) {
  return platform === 'win32'
    ? path.join(path.dirname(node), 'node_modules', 'npm', 'bin', 'npm-cli.js')
    : path.join(path.dirname(node), '..', 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js');
}
