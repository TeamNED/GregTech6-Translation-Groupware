import type { ServerMethodName, ServerParams, ServerResult } from '@gt6tg/core';
import { checkIo, generate, runEntryTest } from './io';
import { ProjectStore } from './projectStore';

export type ServerHandlers = {
  [Method in ServerMethodName]: (...params: ServerParams<Method>) => Promise<ServerResult<Method>>;
};

/** 把 ProjectStore 和文件 IO 包装成 RPC 方法表。 */
export function createHandlers(store: ProjectStore): ServerHandlers {
  return {
    getProject: async () => store.current(),
    validateProject: async (raw) => store.validate(raw),
    saveProject: async (raw) => store.save(raw),
    updateTarget: async (raw, targetId, patch) => store.updateTarget(raw, targetId, patch),
    checkIo: async (targetId) => checkIo(store, targetId),
    generate: async (targetId, write, includeOutput) => generate(store, targetId, write, includeOutput),
    testEntry: async (targetId, key, value) => runEntryTest(store, targetId, key, value),
    importLegacyConfig: async () => store.importLegacyConfig(),
  };
}
