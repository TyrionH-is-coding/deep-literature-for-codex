// Preserve the original packager, adding the task-required Python interpreter flags.
import childProcess from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import path from 'node:path';
const original = childProcess.spawnSync;
childProcess.spawnSync = function (executable, args, options) {
  if (process.env.SCIENTIFIC_READING_PYTHON && path.resolve(executable) === path.resolve(process.env.SCIENTIFIC_READING_PYTHON)) {
    args = ['-I', '-X', 'utf8', ...args];
  }
  return original(executable, args, options);
};
syncBuiltinESMExports();
