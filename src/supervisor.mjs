import net from 'node:net';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { initializeRoot, isolatedEnvironment, readJson, writeJson } from './core.mjs';
import { pipeName, assertStartAllowed } from './control.mjs';
import { prepareLocalSocket } from './local-socket.mjs';

const instance = await initializeRoot(process.argv[2]);
const root = instance.root;
const installed = await readJson(path.join(root, 'installation.json'));
if (process.env.CSR_MAINTENANCE !== '1') await assertStartAllowed(root);
let state = { ...instance, version: installed.version, candidate: installed.candidate,
  status: 'starting', launchId: randomUUID(), supervisorPid: process.pid, startedAt: Date.now() };
let host;
let stopping;
let hostClosed;
const stateFile = path.join(root, 'state', 'last-run.json');

async function shutdown() {
  if (stopping) return stopping;
  stopping = (async () => {
    state = { ...state, status: 'stopping' };
    if (host && host.exitCode === null) {
      if (host.connected) host.send({ type: 'workbench-stop', launchId: state.launchId });
      // The timeout refers to our live ChildProcess handle, never a PID from disk.
      const timer = setTimeout(() => host.kill(), 10000);
      timer.unref();
      await hostClosed;
      clearTimeout(timer);
    }
    state = { ...state, status: 'stopped' };
    delete state.url;
    delete state.pid;
    await writeJson(stateFile, state);
    return state;
  })();
  return stopping;
}

const control = net.createServer(socket => {
  let input = '';
  socket.setTimeout(2500, () => socket.destroy());
  socket.on('error', () => {});
  socket.on('data', async chunk => {
    input += chunk.toString('utf8');
    if (input.length > 1024) return socket.destroy();
    if (!input.includes('\n')) return;
    socket.removeAllListeners('data');
    socket.setTimeout(0);
    try {
      const message = JSON.parse(input);
      if (message.command === 'stop') {
        const result = await shutdown();
        socket.end(JSON.stringify(result));
        control.close();
      } else if (message.command === 'status') socket.end(JSON.stringify(state));
      else socket.end(JSON.stringify({ error: 'unknown_command' }));
    } catch { socket.end(JSON.stringify({ error: 'control_failed' })); }
  });
});

await prepareLocalSocket(pipeName(root));
control.on('error', error => {
  // A concurrent start already acquired this instance's pipe.
  if (error.code === 'EADDRINUSE') process.exit(0);
  console.error(error.code ?? error.message);
  process.exit(1);
});
control.listen(pipeName(root), async () => {
  try {
    await writeJson(stateFile, state);
    const patch = path.join(root, 'state', 'launch.patch.json');
    const app = installed.app ?? path.join(root, 'app');
    const engineConfig = { dataRoot: path.join(root, 'library'), python: installed.python,
      enginePython: installed.python, scansciPython: installed.python,
      scansciExe: path.join(path.dirname(installed.python), process.platform === 'win32' ? 'scansci-pdf.exe' : 'scansci-pdf'), school: '', legalOnly: true,
      outputDir: path.join(root, 'library', 'downloads'), loginType: 'carsi', presetId: 'scientific-reading', installPreset: true };
    await writeJson(patch, [
      { id: 'scientific-reading', config: engineConfig },
      { id: 'scientific-reading-codex', config: { stateRoot: path.join(root, 'state') } },
      { insert: [
        { id: 'workbench-bridge', name: pathToFileURL(path.join(app, 'src', 'bridge.mjs')).href, config: { root, engineConfig } },
        { id: 'workbench-identity', name: pathToFileURL(path.join(app, 'src', 'identity.mjs')).href },
      ] },
    ]);
    const env = isolatedEnvironment(root, process.env, installed);
    env.CSR_IDENTITY = JSON.stringify({ product: state.product, instanceId: state.instanceId,
      launchId: state.launchId, version: state.version, candidate: state.candidate });
    if (stopping) return;
    const log = await fs.open(path.join(root, 'state', 'logs', 'dsh.log'), 'a');
    if (stopping) { await log.close(); return; }
    host = spawn(installed.node, [installed.dsh, '--profile', 'workbench', '--patch', patch,
      '--host', '127.0.0.1', '--port', '0'], {
      cwd: path.join(root, 'workspace'), env, windowsHide: true, shell: false,
      stdio: ['ignore', log.fd, log.fd, 'ipc'],
    });
    hostClosed = new Promise(resolve => host.once('close', resolve));
    host.on('message', async message => {
      if (message?.type !== 'workbench-ready' || message.launchId !== state.launchId ||
          message.instanceId !== state.instanceId || message.pid !== host.pid || stopping) return;
      state = { ...state, status: 'running', pid: host.pid, url: message.url };
      await writeJson(stateFile, state);
    });
    host.on('error', error => { state = { ...state, status: 'failed', error: `host_spawn: ${error.code}` }; });
    host.on('close', async code => {
      await log.close();
      if (stopping) return;
      state = { ...state, status: 'failed', error: state.error ?? `host_exited: ${code}` };
      delete state.url;
      await writeJson(stateFile, state);
      control.close();
    });
  } catch (error) {
    state = { ...state, status: 'failed', error: error.code ?? error.message };
    await writeJson(stateFile, state);
    control.close();
  }
});
