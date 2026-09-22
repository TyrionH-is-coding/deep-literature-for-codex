import fs from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import path from 'node:path';

export const recoveryFile = root => path.join(root, 'state', 'instance-recovery.json');
function checked(root, value, instance) {
  if (value?.contract !== 'deep-literature-instance-recovery-v1'
      || value.root !== instance.root || path.resolve(root) !== instance.root
      || value.instanceId !== instance.instanceId || !/^[a-f0-9-]{36}$/.test(value.transactionId ?? '')
      || !['backup', 'preparing', 'validating', 'ready', 'failed'].includes(value.phase)) {
    throw new Error('instance_recovery_state_invalid');
  }
  return value;
}
export function readRecoverySync(root) {
  let value;
  try { value = JSON.parse(readFileSync(recoveryFile(root), 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
  return checked(root, value, JSON.parse(readFileSync(path.join(root, '.workbench.json'), 'utf8')));
}
export async function readRecovery(root) {
  let value;
  try { value = JSON.parse(await fs.readFile(recoveryFile(root), 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
  return checked(root, value, JSON.parse(await fs.readFile(path.join(root, '.workbench.json'), 'utf8')));
}
export async function assertRecoveryStart(root, transactionId) {
  const state = await readRecovery(root);
  if (!state && transactionId) throw new Error('instance_recovery_transaction_mismatch');
  if (state && (state.transactionId !== transactionId || !['validating', 'ready'].includes(state.phase))) {
    throw new Error('instance_recovery_start_blocked');
  }
  return state;
}
export function assertRecoveryWrite(root, permit) {
  const state = readRecoverySync(root);
  if (state && !(permit && state.phase === 'ready' && state.transactionId === permit.transactionId
      && state.allowedParents?.[permit.parentJobId]?.requestId === permit.requestId)) throw new Error('instance_recovery_write_blocked');
}
