/** parity 相关的纯数据类型；放在 types 层，避免 DTO 依赖 engine 实现。 */

/** 迁移期 parity 需要的最小生成结果；内存结果和回读的 dist 产物都满足它。 */
export interface ParityInput {
  output: Map<string, string>;
  unknown: Set<string>;
}

export interface ParityValueSample {
  key: string;
  expected: string | null;
  actual: string | null;
}

export interface ParityUnknownSample {
  key: string;
  /** true 表示期望未知但实际已翻译；false 表示期望已翻译但实际未知。 */
  expected: boolean;
}

export interface ParityReport {
  goldenKeys: number;
  mismatch: number;
  samples: ParityValueSample[];
  expectedUnknownKeys: number;
  unknownMismatch: number;
  unknownSamples: ParityUnknownSample[];
  ok: boolean;
}
