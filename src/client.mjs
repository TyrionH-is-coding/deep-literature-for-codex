import { status } from './control.mjs';

export async function call(root, request) {
  const state = await status(root);
  if (state.status !== 'running' || !state.url) throw new Error('workbench_not_running');
  const response = await fetch(state.url + '/__workbench/api', { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(90000),
    body: JSON.stringify({ ...request, instanceId: state.instanceId }) });
  const reply = await response.json();
  if (!response.ok || reply.ok !== true) throw new Error(reply.error ?? 'workbench_request_failed');
  return { value: reply.value };
}
