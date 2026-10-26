<script setup lang="ts">
  import type { CompareResult } from '@gt6tg/runtime';
  import {
    NAlert,
    NButton,
    NCard,
    NDataTable,
    NEmpty,
    NSelect,
    NStatistic,
    NTag,
    type DataTableColumns,
  } from 'naive-ui';
  import { useMessage } from 'naive-ui';
  import { computed, ref } from 'vue';
  import type { FileRole, HistoryEntry } from '../backend/types';
  import { useConsole } from '../composables/useConsole';

  const {
    state,
    call,
    setText,
    clearFile,
    files,
    download,
    exportConfig,
    resetConfig,
    refresh,
    history,
    setHistoryLimit,
    compareCurrent,
  } = useConsole();
  const message = useMessage();

  const version = ref(0);
  const compare = ref<CompareResult | null>(null);
  const comparing = ref(false);
  const historyLimit = ref(3);
  const limitOptions = [1, 3, 5, 10].map((value) => ({ label: `${value} 次`, value }));

  const slots = computed(() => {
    const snapshot = { version: version.value, slots: files() };
    return snapshot.slots;
  });
  const runs = computed(() => {
    const snapshot = {
      dataVersion: state.dataVersion,
      version: version.value,
      limit: historyLimit.value,
      runs: history(),
    };
    return snapshot.runs;
  });

  const roles: Array<{ role: FileRole; label: string }> = [
    { role: 'source', label: '源语言文件（必需）' },
    { role: 'fallback', label: 'fallback' },
    { role: 'golden', label: 'legacy golden' },
    { role: 'goldenUnknown', label: 'legacy unknown' },
  ];

  const historyColumns: DataTableColumns<HistoryEntry> = [
    { title: '时间', key: 'createdAt', width: 190 },
    { title: 'hash', key: 'hash', render: (row) => row.summary.hash, width: 170 },
    { title: '输出 key', key: 'outputKeys', render: (row) => row.summary.stats.outputKeys, width: 110 },
    { title: 'unknown', key: 'unknownKeys', render: (row) => row.summary.stats.unknownKeys, width: 100 },
    {
      title: '耗时',
      key: 'duration',
      render: (row) => `${Math.round(row.summary.timings.totalMs)} ms`,
      width: 110,
    },
  ];

  const compareColumns: DataTableColumns<CompareResult['samples'][number]> = [
    { title: 'key', key: 'key', width: 380 },
    { title: 'left', key: 'left' },
    { title: 'right', key: 'right' },
  ];

  function formatBytes(size: number): string {
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / 1024 / 1024).toFixed(2)} MB`;
  }

  async function upload(role: FileRole, event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    setText(role, await file.text(), file.name);
    version.value++;
    message.success(`已加载 ${file.name}`);
  }

  async function uploadConfig(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const text = await file.text();
    const snapshot = await call('saveProject', text);
    state.project = snapshot;
    version.value++;
    const errors = snapshot.issues.filter((issue) => issue.severity === 'error').length;
    if (errors) message.error(`配置已读取，但仍有 ${errors} 个 error`);
    else message.success(`已加载配置 ${file.name}`);
  }

  function clear(role: FileRole): void {
    clearFile(role);
    version.value++;
  }

  async function reloadConfig(): Promise<void> {
    try {
      await resetConfig();
      await refresh();
      version.value++;
      message.success('已重新加载配置');
    } catch (error) {
      message.error(error instanceof Error ? error.message : String(error));
    }
  }

  function downloadKind(kind: 'output' | 'unknown'): void {
    try {
      download(kind);
      message.success('已开始下载');
    } catch (error) {
      message.error(error instanceof Error ? error.message : String(error));
    }
  }

  async function exportCfg(): Promise<void> {
    try {
      await exportConfig();
      message.success('已导出配置');
    } catch (error) {
      message.error(error instanceof Error ? error.message : String(error));
    }
  }

  async function runCompare(mode: 'golden' | 'run'): Promise<void> {
    comparing.value = true;
    try {
      compare.value = await compareCurrent(mode);
      message.success('对比完成');
    } catch (error) {
      message.error(error instanceof Error ? error.message : String(error));
    } finally {
      comparing.value = false;
    }
  }
</script>

<template>
  <div class="page">
    <div class="toolbar">
      <n-button size="small" :disabled="state.status !== 'open'" @click="exportCfg">导出配置</n-button>
      <n-button size="small" :disabled="state.status !== 'open'" @click="reloadConfig">重新加载配置</n-button>
      <n-button size="small" :disabled="!state.capabilities.download" @click="downloadKind('output')">
        下载目标文件
      </n-button>
      <n-button size="small" :disabled="!state.capabilities.download" @click="downloadKind('unknown')">
        下载 unknown
      </n-button>
      <n-tag size="small" :type="state.mode === 'repl' ? 'info' : 'default'">
        {{ state.mode === 'repl' ? '浏览器 REPL' : 'Node DEV' }}
      </n-tag>
    </div>

    <n-alert v-if="!state.capabilities.upload" type="info" class="section">
      当前是 Node DEV 模式，直接读取仓库文件；文件上传、运行历史与对比在浏览器 REPL 模式可用。
    </n-alert>

    <template v-else>
      <div class="section-title">配置</div>
      <n-card size="small" class="section">
        <div class="file-row">
          <span>导入 JSONC 配置</span>
          <input type="file" accept=".jsonc,.json,.txt" data-role="config" @change="uploadConfig" />
        </div>
      </n-card>

      <div class="section-title">输入文件</div>
      <div class="file-grid section">
        <n-card v-for="item in roles" :key="item.role" size="small">
          <template #header>{{ item.label }}</template>
          <template #header-extra>
            <n-tag v-if="slots[item.role]" size="small" type="success">已加载</n-tag>
            <n-tag v-else size="small" type="error">缺失</n-tag>
          </template>
          <div class="file-row">
            <span>{{ slots[item.role]?.name ?? '未选择文件' }}</span>
            <span class="muted">{{ slots[item.role] ? formatBytes(slots[item.role]!.size) : '' }}</span>
          </div>
          <div class="file-row">
            <input type="file" accept=".lang,.txt" :data-role="item.role" @change="upload(item.role, $event)" />
            <n-button v-if="slots[item.role]" size="tiny" @click="clear(item.role)">清除</n-button>
          </div>
        </n-card>
      </div>

      <div class="section-title">运行历史</div>
      <n-card size="small" class="section">
        <div class="toolbar">
          <n-button size="small" :disabled="!runs.length || comparing" @click="runCompare('golden')">
            当前 vs golden
          </n-button>
          <n-button size="small" :disabled="runs.length < 2 || comparing" @click="runCompare('run')">
            最近两次运行
          </n-button>
          <n-select
            v-model:value="historyLimit"
            :options="limitOptions"
            size="small"
            style="width: 96px"
            @update:value="setHistoryLimit"
          />
          <span class="muted">默认 3、上限 10；当前保留 {{ historyLimit }} 次</span>
        </div>
        <n-data-table v-if="runs.length" :columns="historyColumns" :data="runs" :pagination="false" size="small" />
        <n-empty v-else description="还没有运行历史" />
      </n-card>

      <template v-if="compare">
        <div class="section-title">对比结果</div>
        <div class="stat-grid section">
          <n-statistic label="对比 key" :value="compare.compared" />
          <n-statistic label="相同" :value="compare.same" />
          <n-statistic label="变化" :value="compare.changed" />
          <n-statistic label="新增" :value="compare.added" />
          <n-statistic label="缺失" :value="compare.removed" />
        </div>
        <n-data-table
          v-if="compare.samples.length"
          :columns="compareColumns"
          :data="compare.samples"
          :pagination="false"
          size="small"
          :max-height="320"
        />
      </template>
    </template>
  </div>
</template>
