<script setup lang="ts">
  import {
    NAlert,
    NButton,
    NConfigProvider,
    NDialogProvider,
    NGlobalStyle,
    NLayout,
    NLayoutContent,
    NLayoutHeader,
    NMessageProvider,
    NTabPane,
    NTabs,
    NTag,
    dateZhCN,
    zhCN,
  } from 'naive-ui';
  import { computed, ref } from 'vue';
  import ConfigPanel from './components/ConfigPanel.vue';
  import EntryPanel from './components/EntryPanel.vue';
  import IoPanel from './components/IoPanel.vue';
  import TargetPanel from './components/TargetPanel.vue';
  import WorkspacePanel from './components/WorkspacePanel.vue';
  import { useConsole } from './composables/useConsole';

  const { state, refresh, cancel, rpcUrl } = useConsole();
  const activeTab = ref('config');

  const statusLabel = computed(() => {
    if (state.status === 'open') return '已连接';
    if (state.status === 'connecting') return '连接中';
    return '未连接';
  });

  const statusType = computed(() => {
    if (state.status === 'open') return 'success';
    if (state.status === 'connecting') return 'warning';
    return 'error';
  });
</script>

<template>
  <n-config-provider :locale="zhCN" :date-locale="dateZhCN">
    <n-global-style />
    <n-message-provider>
      <n-dialog-provider>
        <n-layout class="app-shell">
          <n-layout-header bordered class="app-header">
            <div>
              <div class="app-title">GT6 翻译控制台</div>
              <div class="app-subtitle">{{ rpcUrl }}</div>
            </div>
            <div class="header-actions">
              <n-tag :type="statusType" size="small">{{ statusLabel }}</n-tag>
              <n-tag size="small" :type="state.mode === 'repl' ? 'info' : 'default'">
                {{ state.mode === 'repl' ? 'REPL' : 'DEV' }}
              </n-tag>
              <n-tag
                v-if="state.progress"
                size="small"
                type="warning"
                style="min-width: 150px; justify-content: center"
              >
                {{ state.progress }}
              </n-tag>
              <n-tag v-if="state.busy > 0 && !state.progress" size="small" type="warning">处理中…</n-tag>
              <n-button size="small" :disabled="state.status !== 'open'" @click="refresh">刷新</n-button>
              <n-button v-if="state.busy > 0 && state.mode === 'repl'" size="small" type="error" @click="cancel">
                停止
              </n-button>
            </div>
          </n-layout-header>

          <n-layout-content class="app-content">
            <n-alert v-if="state.error" type="error" closable class="global-error">
              {{ state.error }}
            </n-alert>

            <n-tabs v-model:value="activeTab" type="line" animated>
              <n-tab-pane name="config" tab="配置">
                <ConfigPanel />
              </n-tab-pane>
              <n-tab-pane name="target" tab="目标配置">
                <TargetPanel />
              </n-tab-pane>
              <n-tab-pane name="io" tab="输入 / 输出检查">
                <IoPanel />
              </n-tab-pane>
              <n-tab-pane name="entry" tab="单条目测试">
                <EntryPanel />
              </n-tab-pane>
              <n-tab-pane name="workspace" tab="文件 / 历史">
                <WorkspacePanel />
              </n-tab-pane>
            </n-tabs>
          </n-layout-content>
        </n-layout>
      </n-dialog-provider>
    </n-message-provider>
  </n-config-provider>
</template>
