import fs from 'node:fs/promises';
import net from 'node:net';

// Called only for paths inside our private per-user socket directory.
// Never remove a live socket or a regular file when recovering after a crash.
export async function prepareLocalSocket(name) {
  if (process.platform === 'win32') return;
  let before;
  try { before = await fs.lstat(name); } catch (error) { if (error.code === 'ENOENT') return; throw error; }
  if (!before.isSocket() || before.uid !== process.getuid()) throw new Error('invalid_control_socket');
  const live = await new Promise((resolve, reject) => {
    const socket = net.createConnection(name);
    socket.setTimeout(1000, () => socket.destroy(new Error('socket_probe_timeout')));
    socket.once('connect', () => { socket.destroy(); resolve(true); });
    socket.once('error', error => ['ECONNREFUSED', 'ENOENT'].includes(error.code) ? resolve(false) : reject(error));
  });
  if (live) return;
  try {
    const now = await fs.lstat(name);
    if (now.isSocket() && now.ino === before.ino && now.dev === before.dev) await fs.unlink(name);
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
}
