// Compatibility facade for existing consumers. New code imports module entrypoints.
export { PRODUCT, DISPLAY_NAME, SKILL_NAME, VERSION, readJson, writeJson,
  initializeRoot, isolatedEnvironment, verifyFile, runtimePaths as prerequisitePaths }
  from './modules/foundation/index.mjs';
export { installSkill, removeManagedSkill } from './modules/skill/index.mjs';
