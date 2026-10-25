<script setup lang="ts">
  import type { TargetConfig } from '@gt6tg/core';
  import { NAlert, NButton, NDescriptions, NDescriptionsItem, NForm, NFormItem, NInput, NSelect, NTag } from 'naive-ui';
  import { useMessage } from 'naive-ui';
  import { computed, reactive, watch } from 'vue';
  import { useConsole } from '../composables/useConsole';

  const { state, call } = useConsole();
  const message = useMessage();

  const target = computed<TargetConfig | undefined>(() => state.project?.targets[0]);

  const form = reactive({
    label: '',
    workplace: '',
    source: '',
    fallback: '',
    output: '',
    unknown: '',
    lineEnding: 'crlf' as 'crlf' | 'lf',
    notes: '',
  });

  watch(
    target,
    (next) => {
      if (!next) return;
      form.label = next.label;
      form.workplace = next.workplace;
      form.source = next.source;
      form.fallback = next.fallback;
      form.output = next.output;
      form.unknown = next.unknown;
      form.lineEnding = next.lineEnding;
      form.notes = next.notes ?? '';
    },
    { immediate: true },
  );

  const lineEndingOptions = [
    { label: 'CRLF（Windows / 旧 .lang）', value: 'crlf' },
    { label: 'LF', value: 'lf' },
  ];

  async function save(): Promise<void> {
    if (!state.project || !target.value) return;
    try {
      const snapshot = await call('updateTarget', state.project.raw, target.value.id, {
        label: form.label,
        workplace: form.workplace,
        source: form.source,
        fallback: form.fallback,
        output: form.output,
        unknown: form.unknown,
        lineEnding: form.lineEnding,
        notes: form.notes,
      });
      state.project = snapshot;
      const errors = snapshot.issues.filter((issue) => issue.severity === 'error').length;
      if (errors > 0) message.error(`目标已更新但配置仍有 ${errors} 个 error，未写入`);
      else message.success('目标配置已保存');
    } catch (error) {
      message.error(error instanceof Error ? error.message : String(error));
    }
  }
</script>

<template>
  <div class="page">
    <n-alert v-if="!target" type="warning" class="section">
      当前配置没有可用的 target。请先在“配置”页修复 project.jsonc。
    </n-alert>

    <template v-else>
      <div class="toolbar">
        <n-tag type="info" size="small">{{ target.id }}</n-tag>
        <n-tag size="small">{{ target.format }}</n-tag>
        <n-button type="primary" :disabled="state.status !== 'open'" @click="save">保存目标配置</n-button>
      </div>

      <n-alert type="info" class="section">
        当前只支持单 GT6 原版目标。workplace/config.yml 与 output/unknown 都是 legacy golden，迁移期只读； core
        的生成物写入 packages/core/dist/&lt;targetId&gt;/。这里只修改 project.jsonc 里的 target 字段。
      </n-alert>

      <n-form label-placement="top" class="target-form">
        <n-form-item label="显示名称">
          <n-input v-model:value="form.label" />
        </n-form-item>
        <n-form-item label="workplace（相对仓库根目录）">
          <n-input v-model:value="form.workplace" />
        </n-form-item>
        <n-form-item label="源文件（相对 workplace）">
          <n-input v-model:value="form.source" />
        </n-form-item>
        <n-form-item label="fallback（相对 workplace）">
          <n-input v-model:value="form.fallback" />
        </n-form-item>
        <n-form-item label="主输出 / legacy golden（相对 workplace，只读）">
          <n-input v-model:value="form.output" />
        </n-form-item>
        <n-form-item label="unknown / legacy golden（相对 workplace，只读）">
          <n-input v-model:value="form.unknown" />
        </n-form-item>
        <n-form-item label="换行符">
          <n-select v-model:value="form.lineEnding" :options="lineEndingOptions" />
        </n-form-item>
        <n-form-item label="备注">
          <n-input v-model:value="form.notes" type="textarea" :autosize="{ minRows: 2, maxRows: 4 }" />
        </n-form-item>
      </n-form>

      <div class="section-title">解析后的路径</div>
      <n-descriptions bordered :column="2" size="small">
        <n-descriptions-item label="workplace">{{ form.workplace }}</n-descriptions-item>
        <n-descriptions-item label="源">{{ form.workplace }}/{{ form.source }}</n-descriptions-item>
        <n-descriptions-item label="fallback">{{ form.workplace }}/{{ form.fallback }}</n-descriptions-item>
        <n-descriptions-item label="legacy golden">{{ form.workplace }}/{{ form.output }}</n-descriptions-item>
        <n-descriptions-item label="legacy unknown">{{ form.workplace }}/{{ form.unknown }}</n-descriptions-item>
        <n-descriptions-item label="换行符">{{ form.lineEnding }}</n-descriptions-item>
      </n-descriptions>
    </template>
  </div>
</template>
