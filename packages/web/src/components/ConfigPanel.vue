<script setup lang="ts">
  import type { ConfigIssue } from '@gt6tg/core';
  import { NAlert, NButton, NDataTable, NInput, NStatistic, NTag, type DataTableColumns } from 'naive-ui';
  import { useDialog, useMessage } from 'naive-ui';
  import { computed, h, ref, watch } from 'vue';
  import { useConsole } from '../composables/useConsole';

  const { state, call } = useConsole();
  const message = useMessage();
  const dialog = useDialog();

  const raw = ref(state.project?.raw ?? '');
  watch(
    () => state.project?.raw,
    (next) => {
      if (next !== undefined) raw.value = next;
    },
    { immediate: true },
  );

  const dirty = computed(() => raw.value !== (state.project?.raw ?? ''));
  const issues = computed<ConfigIssue[]>(() => state.project?.issues ?? []);
  const stats = computed(() => state.project?.stats);
  const errorCount = computed(() => issues.value.filter((issue) => issue.severity === 'error').length);
  const warningCount = computed(() => issues.value.filter((issue) => issue.severity === 'warning').length);

  const issueColumns: DataTableColumns<ConfigIssue> = [
    {
      title: '级别',
      key: 'severity',
      width: 90,
      render: (row) =>
        h(
          NTag,
          {
            size: 'small',
            type: row.severity === 'error' ? 'error' : row.severity === 'warning' ? 'warning' : 'info',
          },
          { default: () => row.severity },
        ),
    },
    { title: '代码', key: 'code', width: 190 },
    { title: '消息', key: 'message' },
    {
      title: '位置',
      key: 'path',
      width: 260,
      render: (row) => row.path ?? (row.line ? `${row.line}:${row.column ?? 0}` : ''),
    },
  ];

  const canUse = computed(() => state.status === 'open');

  async function validate(): Promise<void> {
    try {
      const snapshot = await call('validateProject', raw.value);
      state.project = snapshot;
      const errors = snapshot.issues.filter((issue) => issue.severity === 'error').length;
      if (errors > 0) message.error(`校验完成：${errors} 个 error`);
      else message.success('校验通过（warning/info 见下方列表）');
    } catch (error) {
      message.error(error instanceof Error ? error.message : String(error));
    }
  }

  async function save(): Promise<void> {
    try {
      const result = await call('saveProject', raw.value);
      state.project = result;
      const errors = result.issues.filter((issue) => issue.severity === 'error').length;
      if (errors > 0) {
        message.error(`未保存：仍有 ${errors} 个 error`);
        return;
      }
      message.success(result.backupPath ? `已保存，备份：${result.backupPath}` : '已保存');
    } catch (error) {
      message.error(error instanceof Error ? error.message : String(error));
    }
  }

  function importLegacy(): void {
    dialog.warning({
      title: '从 config.yml 重新导入',
      content: '会用 packages/legacy/workplace/config.yml 覆盖当前 project.jsonc（保存前会备份）。确定继续？',
      positiveText: '导入',
      negativeText: '取消',
      onPositiveClick: async () => {
        try {
          const snapshot = await call('importLegacyConfig');
          state.project = snapshot;
          raw.value = snapshot.raw;
          message.success('已从 legacy YAML 导入');
        } catch (error) {
          message.error(error instanceof Error ? error.message : String(error));
        }
      },
    });
  }
</script>

<template>
  <div class="page">
    <div class="toolbar">
      <n-button type="primary" :disabled="!canUse" @click="validate">校验</n-button>
      <n-button type="primary" :disabled="!canUse || !dirty" @click="save">保存</n-button>
      <n-button :disabled="!canUse" @click="raw = state.project?.raw ?? ''">放弃修改</n-button>
      <n-button :disabled="!canUse" @click="importLegacy">从 config.yml 导入</n-button>
      <n-tag v-if="dirty" type="warning" size="small">未保存</n-tag>
      <n-tag v-if="errorCount" type="error" size="small">{{ errorCount }} error</n-tag>
      <n-tag v-if="warningCount" type="warning" size="small">{{ warningCount }} warning</n-tag>
      <span class="muted">{{ raw.length }} 字符 / {{ raw.split('\n').length }} 行</span>
    </div>

    <n-alert v-if="!state.project" type="warning" class="section">
      尚未加载配置。请确认 RPC 服务已启动，并等待左侧状态变为“已连接”。
    </n-alert>

    <div v-if="stats" class="stat-grid section">
      <n-statistic label="generator 块" :value="stats.generatorBlocks" />
      <n-statistic label="组" :value="stats.groups" />
      <n-statistic label="规则模板" :value="stats.ruleTemplates" />
      <n-statistic label="槽位出现" :value="stats.slotOccurrences" />
      <n-statistic label="dict 词条" :value="stats.dictEntries" />
      <n-statistic label="completed" :value="stats.completedGenerators" />
      <n-statistic label="mixed 组" :value="stats.mixedGroups" />
      <n-statistic label="缺失组" :value="stats.missingGroups.length" />
    </div>

    <n-alert v-if="stats?.missingGroups.length" type="error" class="section">
      缺失组：{{ stats.missingGroups.join(', ') }}
    </n-alert>
    <n-alert v-if="stats?.cycles.length" type="warning" class="section">
      组引用环：{{ stats.cycles.map((cycle) => cycle.join(' -> ')).join('；') }}
    </n-alert>

    <n-input
      v-model:value="raw"
      type="textarea"
      class="code-input"
      :autosize="{ minRows: 22, maxRows: 34 }"
      spellcheck="false"
    />

    <div class="section-title">检查结果（{{ issues.length }}）</div>
    <n-data-table
      :columns="issueColumns"
      :data="issues"
      :pagination="false"
      size="small"
      :max-height="320"
      virtual-scroll
    />
  </div>
</template>
