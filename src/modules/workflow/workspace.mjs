import fs from 'node:fs/promises';
import path from 'node:path';

export async function ensureInstanceWorkspace(rpc, root) {
  const workspacePath = await fs.realpath(path.join(root, 'workspace'));
  const result = await rpc('workspace.create', { path: workspacePath });
  const workspaceId = result?.workspace?.workspaceId;
  if (typeof workspaceId !== 'string' || !workspaceId.trim()) throw new Error('workspace_unavailable');
  return { workspaceId, path: result.workspace.path ?? workspacePath, created: result.created === true };
}

export async function ensureLiteratureDefault(rpc) {
  const described = await rpc('settings.describe', {});
  const ns = described?.namespaces?.find(item => item.ns === 'agent-presets');
  if (!ns) return { status: 'unavailable' };
  if (ns.user && Object.prototype.hasOwnProperty.call(ns.user, 'default')) {
    return { status: 'retained', default: ns.user.default };
  }
  await rpc('settings.update', {
    ns: 'agent-presets',
    patch: { default: 'scientific-reading' },
    expectedRevision: ns.revision,
  });
  return { status: 'set', default: 'scientific-reading' };
}
