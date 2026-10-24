<script setup lang="ts">
  import type { DiffSample, FileInfo, IoCheckReport } from '@gt6tg/core';
  import {
    NAlert,
    NButton,
    NCard,
    NDataTable,
    NDescriptions,
    NDescriptionsItem,
    NGrid,
    NGridItem,
    NStatistic,
    NTag,
    type DataTableColumns,
  } from 'naive-ui';
  import { useDialog, useMessage } from 'naive-ui';
  import { computed, ref } from 'vue';
  import { useConsole } from '../composables/useConsole';

  const { state, call } = useConsole();
  const message = useMessage();
  const dialog = useDialog();

  const report = ref<IoCheckReport | null>(null);
  const checking = ref(false);
  const writing = ref(false);

  const targetId = computed(() => state.project?.activeTargetId ?? '');
  const canUse = computed(() => state.status === 'open' && targetId.value !== '');

  const files = computed(() => {
    if (!report.value) return [];
    return [
      { title: '源文件', info: report.value.source },
      { title: 'fallback', info: report.value.fallback },
      { title: '当前输出', info: report.value.output },
      { title: 'unknown', info: report.value.unknown },
    ];
  });

  const sampleColumns: DataTableColumns<DiffSample> = [
    { title: 'key', key: 'key', width: 380 },
    { title: '当前输出', key: 'expected' },
    { title: '新生成', key: 'actual' },
  ];

  function formatBytes(size: number): string {
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / 1024 / 1024).toFixed(2)} MB`;
  }

  function lineEndingType(ending: FileInfo['lineEnding']): 'default' | 'warning' | 'error' {
    if (ending === 'mixed') return 'warning';
    if (ending === 'none') return 'error';
    return 'default';
  }

  async function check(): Promise<void> {
    if (!targetId.value) return;
    checking.value = true;
    try {
      report.value = await call('checkIo', targetId.value);
      message.success('检查完成');
    } catch (error) {
      message.error(error instanceof Error ? error.message : String(error));
    } finally {
      checking.value = false;
    }
  }

  function writeOutput(): void {
    if (!targetId.value) return;
    dialog.warning({
      title: '生成并写入输出',
      content: '会覆盖主输出和 unknown 文件（写入前自动备份）。确定继续？',
      positiveText: '生成并写入',
      negativeText: '取消',
      onPositiveClick: async () => {
        writing.value = true;
        try {
          const result = await call('generate', targetId.value, true);
          message.success(`已写入，hash=${result.hash}，耗时 ${result.durationMs} ms`);
          await check();
        } catch (error) {
          message.error(error instanceof Error ? error.message : String(error));
        } finally {
          writing.value = false;
        }
      },
    });
  }
</script>

<template>
  <div class="page">
    <div class="toolbar">
      <n-button type="primary" :disabled="!canUse || checking" @click="check">检查输入 / 输出</n-button>
      <n-button type="warning" :disabled="!canUse || writing" @click="writeOutput">生成并写入</n-button>
      <n-tag v-if="targetId" size="small">{{ targetId }}</n-tag>
      <span v-if="checking" class="muted">正在生成并比对…</span>
    </div>

    <n-alert v-if="!report" type="info" class="section">
      检查会读取源文件、fallback、当前输出和 unknown，并跑一次 dry-run 生成，与当前输出逐 key 对比。
    </n-alert>

    <template v-if="report">
      <n-alert v-for="note in report.notes" :key="note" type="warning" class="section">{{ note }}</n-alert>

      <n-grid :cols="2" :x-gap="12" :y-gap="12" class="section">
        <n-grid-item v-for="file in files" :key="file.title">
          <n-card :title="file.title" size="small">
            <template #header-extra>
              <n-tag size="small" :type="file.info.exists ? 'success' : 'error'">
                {{ file.info.exists ? '存在' : '缺失' }}
              </n-tag>
            </template>
            <n-descriptions :column="2" size="small">
              <n-descriptions-item label="路径">{{ file.info.path }}</n-descriptions-item>
              <n-descriptions-item label="大小">{{ formatBytes(file.info.size) }}</n-descriptions-item>
              <n-descriptions-item label="key">
                {{ file.info.keys }}（唯一 {{ file.info.uniqueKeys }}）
              </n-descriptions-item>
              <n-descriptions-item label="行数">{{ file.info.lines }}</n-descriptions-item>
              <n-descriptions-item label="空值">{{ file.info.emptyValues }}</n-descriptions-item>
              <n-descriptions-item label="重复 key">{{ file.info.duplicateKeys }}</n-descriptions-item>
              <n-descriptions-item label="含 ¶">{{ file.info.valuesWithParagraph }}</n-descriptions-item>
              <n-descriptions-item label="含 =">{{ file.info.valuesWithEquals }}</n-descriptions-item>
              <n-descriptions-item label="换行符">
                <n-tag size="small" :type="lineEndingType(file.info.lineEnding)">{{ file.info.lineEnding }}</n-tag>
              </n-descriptions-item>
            </n-descriptions>
          </n-card>
        </n-grid-item>
      </n-grid>

      <div class="section-title">生成摘要</div>
      <div class="stat-grid section">
        <n-statistic label="输出 key" :value="report.generated.keys" />
        <n-statistic label="unknown" :value="report.generated.unknownKeys" />
        <n-statistic label="与英文相同" :value="report.generated.sameAsEnglish" />
        <n-statistic label="候选冲突 key" :value="report.generated.conflictKeys" />
        <n-statistic label="耗时" :value="`${report.generated.durationMs} ms`" />
        <n-statistic label="hash" :value="report.generated.hash" />
      </div>

      <div class="section-title">与当前输出对比</div>
      <n-descriptions bordered :column="4" size="small" class="section">
        <n-descriptions-item label="对比 key">{{ report.diffVsCurrent.compared }}</n-descriptions-item>
        <n-descriptions-item label="相同">{{ report.diffVsCurrent.same }}</n-descriptions-item>
        <n-descriptions-item label="变化">{{ report.diffVsCurrent.changed }}</n-descriptions-item>
        <n-descriptions-item label="新增">{{ report.diffVsCurrent.added }}</n-descriptions-item>
        <n-descriptions-item label="缺失">{{ report.diffVsCurrent.removed }}</n-descriptions-item>
      </n-descriptions>

      <n-data-table
        v-if="report.diffVsCurrent.samples.length"
        :columns="sampleColumns"
        :data="report.diffVsCurrent.samples"
        :pagination="false"
        size="small"
        :max-height="280"
      />
    </template>
  </div>
</template>
