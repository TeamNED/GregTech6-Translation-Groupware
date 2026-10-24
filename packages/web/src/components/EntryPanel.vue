<script setup lang="ts">
  import type { CandidateView, EntryTestResult, TraceStage } from '@gt6tg/core';
  import {
    NAlert,
    NButton,
    NCard,
    NCollapse,
    NCollapseItem,
    NDataTable,
    NDescriptions,
    NDescriptionsItem,
    NEmpty,
    NInput,
    NTag,
    type DataTableColumns,
  } from 'naive-ui';
  import { useMessage } from 'naive-ui';
  import { computed, ref } from 'vue';
  import { useConsole } from '../composables/useConsole';

  const { state, call } = useConsole();
  const message = useMessage();

  const key = ref('S:oredict.crateGt64DustRainforestJasper');
  const value = ref('Crate of Rainforest Jasper Dust');
  const result = ref<EntryTestResult | null>(null);
  const loading = ref(false);

  const targetId = computed(() => state.project?.activeTargetId ?? '');
  const canUse = computed(() => state.status === 'open' && targetId.value !== '');

  const candidateColumns: DataTableColumns<CandidateView> = [
    { title: '译文', key: 'target' },
    { title: 'namespace', key: 'namespace', width: 260 },
    { title: '组', key: 'generator', width: 160 },
    { title: 'rule', key: 'rule', width: 70 },
    { title: 'combo', key: 'combo', width: 90 },
  ];

  const presets = [
    {
      label: 'crate64 Rainforest Jasper',
      key: 'S:oredict.crateGt64DustRainforestJasper',
      value: 'Crate of Rainforest Jasper Dust',
    },
    { label: 'Mercury 歧义', key: 'S:oredict.bulletGtMediumMercuryRock', value: 'Medium Mercury Bullet' },
    { label: 'affix 词', key: 'S:gt.multiitem.technological.10001.tooltip', value: 'Extruder Shape for making Plates' },
  ];

  function stageType(stage: TraceStage): 'default' | 'success' | 'warning' | 'error' | 'info' {
    if (stage === 'reject') return 'error';
    if (stage === 'lex' || stage === 'reduce' || stage === 'emit') return 'success';
    if (stage === 'select' || stage === 'fallback') return 'warning';
    return 'info';
  }

  async function run(): Promise<void> {
    if (!targetId.value) return;
    loading.value = true;
    try {
      result.value = await call('testEntry', targetId.value, key.value, value.value.trim() || undefined);
      if (result.value.unknown) message.warning('未命中，且没有 fallback，将进入 unknown');
      else if (result.value.fallback && !result.value.selected) message.warning('使用 fallback 命中');
      else message.success('测试完成');
    } catch (error) {
      message.error(error instanceof Error ? error.message : String(error));
    } finally {
      loading.value = false;
    }
  }

  function usePreset(preset: (typeof presets)[number]): void {
    key.value = preset.key;
    value.value = preset.value;
  }
</script>

<template>
  <div class="page">
    <div class="toolbar">
      <n-tag v-for="preset in presets" :key="preset.label" size="small" class="preset" @click="usePreset(preset)">
        {{ preset.label }}
      </n-tag>
    </div>

    <div class="entry-form">
      <div class="entry-field">
        <div class="field-label">key</div>
        <n-input v-model:value="key" placeholder="S:oredict...." />
      </div>
      <div class="entry-field">
        <div class="field-label">英文值（留空则按 key 从源文件查）</div>
        <n-input v-model:value="value" placeholder="Crate of ..." />
      </div>
      <n-button type="primary" :disabled="!canUse || loading" @click="run">测试</n-button>
    </div>

    <n-alert v-if="!result" type="info" class="section">
      输入 key 和英文值，查看匹配到的候选、最终选择以及 LIT/LEX/REDUCE 执行步骤。
    </n-alert>

    <template v-if="result">
      <n-alert v-if="result.unknown" type="error" class="section">未命中且无 fallback，会进入 unknown。</n-alert>
      <n-alert v-else-if="result.fallback && !result.selected" type="warning" class="section">
        fallback 命中：{{ result.fallback }}
      </n-alert>

      <div class="section-title">分词</div>
      <div class="token-row">
        <n-tag v-for="(token, index) in result.tokens" :key="`${token}-${index}`" size="small">
          {{ token }}
        </n-tag>
      </div>

      <div class="section-title">最终选择</div>
      <n-card v-if="result.selected" size="small">
        <n-descriptions :column="3" size="small">
          <n-descriptions-item label="译文">{{ result.selected.target }}</n-descriptions-item>
          <n-descriptions-item label="namespace">{{ result.selected.namespace }}</n-descriptions-item>
          <n-descriptions-item label="组">{{ result.selected.generator }}</n-descriptions-item>
          <n-descriptions-item label="generator">{{ result.selected.generatorId }}</n-descriptions-item>
          <n-descriptions-item label="rule">{{ result.selected.rule }}</n-descriptions-item>
          <n-descriptions-item label="combo">{{ result.selected.combo }}</n-descriptions-item>
        </n-descriptions>
      </n-card>
      <n-empty v-else description="没有最终候选" class="section" />

      <div class="section-title">候选（{{ result.candidates.length }}）</div>
      <n-data-table
        :columns="candidateColumns"
        :data="result.candidates"
        :pagination="false"
        size="small"
        :max-height="240"
      />

      <div class="section-title">执行步骤（{{ result.steps.length }}）</div>
      <n-collapse :default-expanded-names="['steps']">
        <n-collapse-item title="LIT / LEX / REDUCE / EMIT" name="steps">
          <div class="trace-list">
            <div v-for="(step, index) in result.steps" :key="index" class="trace-step">
              <div class="trace-head">
                <n-tag size="small" :type="stageType(step.stage)">{{ step.stage }}</n-tag>
                <span class="trace-message">{{ step.message }}</span>
              </div>
              <pre v-if="step.data" class="trace-data">{{ JSON.stringify(step.data, null, 2) }}</pre>
            </div>
          </div>
        </n-collapse-item>
      </n-collapse>
    </template>
  </div>
</template>
