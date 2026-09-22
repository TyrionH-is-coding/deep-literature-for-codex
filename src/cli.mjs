import { installSkill } from './modules/skill/index.mjs';
import path from 'node:path';
import { start, status, stop } from './modules/lifecycle/index.mjs';
import { readJson, SKILL_NAME } from './modules/foundation/index.mjs';
import { rollbackRelease, recoverRelease, retireInstallation, backupInstance, restoreInstance, verifyInstancePackage, startRecovery, validateRecovery, continueRecovery, stopRecovery } from './modules/releases/index.mjs';
import { call } from './client.mjs';
import { defaultRoot } from './modules/foundation/index.mjs';
import { setupSteps } from './onboarding.mjs';

try {
  const [command = 'status', requested, skillsRoot] = process.argv.slice(2);
  const root = path.resolve(requested || defaultRoot());
  let result;
  if (command === 'instance-backup') result = await backupInstance(root, skillsRoot);
  else if (command === 'instance-verify') result = await verifyInstancePackage(root);
  else if (command === 'instance-restore') result = await restoreInstance(root, await readJson(skillsRoot));
  else if (command === 'instance-start-validation') result = await startRecovery(root, skillsRoot);
  else if (command === 'instance-validate') result = await validateRecovery(root, skillsRoot);
  else if (command === 'instance-continue') result = await continueRecovery(root, await readJson(skillsRoot));
  else if (command === 'instance-stop') result = await stopRecovery(root, await readJson(skillsRoot));
  else if (command === 'call') {
    if (!skillsRoot) throw new Error('request_file_required');
    result = await call(root, await readJson(path.resolve(skillsRoot)));
  } else if (command === 'install-skill') {
    if (!skillsRoot) throw new Error('skills_directory_required');
    await readJson(path.join(root, 'installation.json'));
    result = await installSkill(path.join(import.meta.dirname, '..', 'skills', SKILL_NAME), path.resolve(skillsRoot), root);
    if (result.status !== 'retained_custom_changes') {
      result.setupSteps = setupSteps;
      console.error('\n接下来完成首次配置：\n' + setupSteps.join('\n'));
    }
  } else {
    const action = { start, status, stop, rollback: rollbackRelease, recover: recoverRelease, retire: retireInstallation }[command];
    if (!action) throw new Error('unknown_command: start | status | stop | call | install-skill | rollback | recover | retire');
    result = await action(root);
  }
  console.log(JSON.stringify({ ok: true, ...result }, null, 2));
} catch (error) {
  console.log(JSON.stringify({ ok: false, error: error.code ?? error.message }));
  process.exitCode = 1;
}
