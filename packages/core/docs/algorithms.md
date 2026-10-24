# 翻译算法实现说明

> **monorepo 路径说明：** 原 `src/`、`workplace/` 已移动到 `packages/legacy/`；本文历史段落中的 `workplace/...` 均指 `packages/legacy/workplace/...`。


本文说明仓库中已实现并基准测试过的六种算法：

1. `forward`：现有 C++ 算法的忠实复刻——先物化全部组合，再逐 key 查表。
2. `stream`：正向枚举 + 立即过滤（**速度回退引擎**）。
3. `token`：字符级模板匹配器（极端组合爆炸时的备选）。
4. `grammar`：严格分词 + token 级上下文无关语法 + 记忆化解析（研究原型）。
5. `flat-token`：严格分词 + 扁平 token 匹配（严格分词方向的早期变体）。
6. `pattern`：把中间模板全部展开并编译成 `LIT`/`LEX`/`REDUCE` 操作序列的扁平自动机（**新的默认引擎**）。

所有实现共用同一份配置模型、语言文件解析和输出语义；在真实、4× addon、400 万对爆炸三个场景下，六者的输出均与 golden 逐条一致（`mismatch = 0`、`unknownMismatch = 0`）。

---

## 0. 共同数据模型与语义

### 0.1 生成器

一个 `generator` 是 config 中的一个块：

```yaml
- group: crate16
  namespace: S:oredict.crateGtDust
  completed: true
  dict: ...        # 或 rules
```

内部模型：

```js
{
  id, group, namespace, completed,
  kind: 'dict' | 'rule',
  payload: pairs[] | rules[]
}
```

- `group`：组名，多个 generator 可以共享同一个组，结果取并集。
- `namespace`：该 generator 产出的条目适用的 key 前缀。`combineNs` 的规则：一方是另一方前缀时取较长者，否则组合无效。
- `completed: false`：只作为子组引用，不直接进入最终输出。
- 嵌套 dict：

  ```yaml
  Carminite:
    "S:": 砷铅铁
    S:oredict.gem: 砷铅铁矿石
  ```

  会展开成两个 dict generator，分别使用内部 namespace；同一个英文词在不同 namespace 下译文不同。

### 0.2 条目与顺序

每个生成结果表示为：

```js
{ s, t, ns, gen, ri, combo, idx }
```

- `s` / `t`：原文 / 译文。
- `ns`：合并后的 namespace。
- `gen` / `ri`：生成器和规则在配置中的顺序。
- `combo`：该规则内笛卡尔积的序号。
- `idx`：在所属 group 结果数组中的位置（供父规则计算 combo）。

最终优先级复刻 C++：

```
generator 顺序 > rule 顺序 > combo 顺序
```

同一原文有多个候选时，**最后命中者获胜**。比较必须用三元组，不能编码成单个 float：

```js
function betterOrder(a, b) {
  if (a.gen !== b.gen) return a.gen > b.gen;
  if (a.ri !== b.ri) return a.ri > b.ri;
  return a.combo > b.combo;
}
```

原因：4× addon 配置下 generator 数量达到数千，`gen * 1e12` 会超过 `Number.MAX_SAFE_INTEGER`。

### 0.3 最终应用

对每个输入 key：

1. 用 key 的英文值查候选条目。
2. 只保留 `key.startsWith(entry.ns)` 的候选。
3. 按 `(gen, ri, combo)` 取最大者。
4. 没有候选时用 fallback（按 key 精确匹配）；再没有则保留英文并写入 unknown。

**fallback 的重复 key 必须首次获胜**（对齐 C++ 的 `std::map::insert`），不能用 `Map.set` 的后写覆盖。

---

## 1. forward：全量物化

### 1.1 实现

1. 递归求值所有 completed generator 的 group，展开规则的所有笛卡尔积。
2. 建立 `Map<原文, 条目[]>`：

```js
const dict = new Map();
for (const gen of completedGenerators) {
  for (const entry of gen.results()) {
    let arr = dict.get(entry.s) || [];
    arr.push(entry);
    dict.set(entry.s, arr);
  }
}
```

3. 对每个输入 key 查 `dict.get(value)`，按 namespace 过滤，取 `(gen, ri, combo)` 最大者。

### 1.2 复杂度

- 时间：O(P + K)，P 为生成 pair 总数，K 为输入 key 数。
- 内存：O(P + U)，U 为不同原文数。
- 生成阶段不关心输入，因此大量组合从未被使用。

### 1.3 实测

| 场景 | 时间 | 堆 | 候选条目 |
| --- | ---: | ---: | ---: |
| 真实 125,676 keys | 0.40 s | 296 MB | 436,070 |
| 4× addon 502,704 keys | 1.70 s | 565 MB | 1,744,280 |
| 400 万 pairs / 100 命中 | 3.42 s | 1,931 MB | 4,436,070 |

400 万对场景的 1.9 GB 堆就是用户观察到的 ~2 GB 的来源。

---

## 2. stream：正向枚举 + 立即过滤（速度回退引擎）

### 2.1 核心思想

仍然正向展开规则，但**每生成一个 pair 就立刻用输入值集合过滤**，不命中的 pair 不进入索引。这样内存只与命中量相关，不随生成量增长。

### 2.2 三个阶段

**阶段 A：构建被引用的组（`referenced`）**

`referenced` 是所有出现在规则 `subs` 里的组名。这些组需要完整的 `Map<原文, 条目[]>`，因为规则捕获值时要查它们。当前配置是 81 个组、102,183 条。

```js
for (const name of referenced) {
  const list = resolveGroup(name);  // 正向求值，缓存
  for (const e of list) {
    if (gens[e.gen].completed) addCandidate(e.s, e);
  }
}
```

**阶段 B：处理 completed-only 规则**

这些组不被任何规则引用，只用于最终输出。直接枚举它们的组合，但先算原文，命中后再算 namespace 和译文：

```js
for (const gen of completedOnlyGenerators) {
  for (const rule of gen.rules) {
    const arrays = rule.subs.map(resolveGroup);
    if (arrays.some(a => a.length === 0)) continue;

    // 显式下标循环，避免迭代器/数组分配
    const pos = new Array(arrays.length).fill(0);
    let combo = 0;
    while (true) {
      // 1. 只算原文
      let src = '';
      for (const q of rule.srcParts) {
        src += typeof q === 'number' ? arrays[q][pos[q]].s : q;
      }

      // 2. 命中输入才继续
      if (inputValues.has(src)) {
        // 3. 合并 namespace
        let ns = gen.ns;
        for (let i = 0; i < arrays.length; i++) {
          ns = combineNs(ns, arrays[i][pos[i]].ns);
          if (ns === null) break;
        }
        if (ns !== null) {
          // 4. 构建译文
          let tgt = '';
          for (const q of rule.tgtParts) {
            tgt += typeof q === 'number' ? arrays[q][pos[q]].t : q;
          }
          addCandidate(src, { t: tgt, ns, gen: gen.id, ri, combo });
        }
      }

      combo++;
      // 手动进位（最后一个 sub 变化最快）
      let i = arrays.length - 1;
      while (i >= 0) {
        if (++pos[i] < arrays[i].length) break;
        pos[i] = 0;
        i--;
      }
      if (i < 0) break;
    }
  }
}
```

关键优化：**译文和 namespace 只在原文命中后计算**。真实配置中 72.9% 的 pair 不会命中，因此这部分工作被直接省掉。

**阶段 C：应用**

```js
for (const [key, value] of en.entries) {
  const arr = candidates.get(value);
  let best = null;

  if (arr) {
    if (arr.length === 1) {
      const e = arr[0];
      if (!e.ns || key.startsWith(e.ns)) best = e;
    } else {
      for (const e of arr) {
        if (e.ns && !key.startsWith(e.ns)) continue;
        if (!best || betterOrder(e, best)) best = e;
      }
    }
  }

  if (best) result.set(key, best.t);
  else if (fallback.has(key)) result.set(key, fallback.get(key));
  else { result.set(key, value); unknown.add(key); }
}
```

单候选快路径避免了最常见的 `betterOrder` 调用；这是 apply 阶段从 0.19 s 降到 0.07 s 的主要原因。

### 2.3 尝试过但没有收益的优化

- **首词前缀剪枝**：为每个输入值建立首词集合，对规则第一个 sub 的每个条目检查首词是否存在。实测 completed-only 从 0.214 s 降到 0.199 s，但构建 `Uint8Array` 和检查的开销让总时间略增，因此默认关闭。
- **候选去重**：stream 的候选条目已经是「原文命中」后的结果，重复率低；去重收益小于成本。

### 2.4 复杂度

- 时间：O(P + K + M)，P 是 completed-only 组合数，M 是命中数。
- 内存：O(R + M)，R 是被引用组条目数（当前 102k），M 是命中条目数（当前 123k）。
- 不随完整笛卡尔积增长。

### 2.5 实测（优化后，build+apply，不含进程启动）

| 场景 | 时间 | 堆 | 峰值 RSS | 候选条目 |
| --- | ---: | ---: | ---: | ---: |
| 真实 | **0.354 s** | 190 MB | 340 MB | 123,280 |
| 4× addon | **1.144 s** | 551 MB | 739 MB | 493,120 |
| 400 万 pairs | **0.965 s** | 168 MB | 343 MB | 123,380 |

### 2.6 它仍然有价值的原因

- `stream` 的实现最简单，语义最容易对齐，适合作为 `pattern` 的 parity 回退。
- 在 4× addon 这类输入 key 很大、规则图也大的场景，`stream` 仍比 `pattern` 快约 9%（2.243 s vs 2.445 s）。
- 内存不随 P 增长；400 万对场景下活堆 168–193 MB。
- 如果 `pattern` 编译出的模式数异常膨胀，`stream` 是最稳妥的降级路径。

---

## 3. token：字符级模板匹配器（极端 P/K 备选）

### 3.1 适用范围

只处理 completed-only 规则；被引用的组仍然用 stream 的方式正向建表。当「生成量 / 命中量」很高时，它比 stream 快，因为它**不枚举笛卡尔积**。

### 3.2 实现步骤

1. **编译模板**：`"{0} {1}"` → `[0, " ", 1]`；`"Crate of {0}"` → `["Crate of ", 0]`。
2. **模板去重**：相同结构共享一个 template 对象，按「字面量 + 槽号」生成 key。
3. **命名空间桶 + 前缀 trie**：每个 key 走一遍字符，收集适用的 namespace 桶。
4. **模板解析**：`parseTemplate` 按字面量切分输入，返回**所有**捕获组合：

```js
// parts = [0, " ", 1]
function dfs(pi, pos) {
  if (pi === parts.length) { if (pos === value.length) emit(cur); return; }
  const p = parts[pi];
  if (typeof p === 'string') {
    if (value.startsWith(p, pos)) dfs(pi + 1, pos + p.length);
    return;
  }
  const next = parts[pi + 1];
  if (next === undefined) {
    cur[p] = value.slice(pos);
    dfs(pi + 1, value.length);
  } else {
    let idx = value.indexOf(next, pos);
    while (idx !== -1) {
      cur[p] = value.slice(pos, idx);
      dfs(pi + 1, idx);
      idx = value.indexOf(next, idx + 1);
    }
  }
}
```

5. **规则求值**：捕获值到子组 `Map` 查译文；同一捕获可能有多个 namespace 条目，全部尝试；合并 namespace；按 `(gen, ri, combo)` 生成候选。
6. **去重**：按 `(namespace, target)` 保留 order 最大的条目。

### 3.3 复杂度

- 时间：O(V × T_live × S + M)，V 为不同输入值数，T_live 为每 key 适用模板数，S 为切分点数。
- 内存：O(R + M)。
- 不需要 P。

### 3.4 实测（build+apply，不含进程启动）

| 场景 | 时间 | 堆 | 峰值 RSS |
| --- | ---: | ---: | ---: |
| 真实 | 0.402 s | 304 MB | 463 MB |
| 4× addon | 1.425 s | 749 MB | 905 MB |
| 400 万 pairs | **0.399 s** | 305 MB | 462 MB |

### 3.5 何时使用

`pattern` 在 400 万对场景已经只需 0.595 s，因此 `token` 不再是爆炸场景的首选。保留它作为以下情况的备选：

- 规则图很小、但 completed-only 组合数 `P` 极大，且 `pattern` 的候选模式数因规则图异常膨胀；
- 需要与 `stream`/`pattern` 做第三方 parity 对照。

真实配置 `P/K ≈ 3.6`，`pattern`/`stream` 都更快；400 万对场景 `P/K ≈ 32`，`pattern` 0.595 s、`token` 0.623 s，二者接近。

---

## 4. grammar：严格分词 + token 级 CFG

### 4.1 核心思想

把 config 编译成 token 级上下文无关语法，输入先严格分词，再用记忆化自顶向下解析器解析整个 token 序列。它不使用字符级 `indexOf`，也不展开笛卡尔积。

### 4.2 严格分词

```js
// 单词（允许内部撇号）、空白、单字符标点
const TOKEN_RE = /[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*|\s+|[^\s\p{L}\p{N}]/gu;
```

- `"Light Carminite Arrow"` → `[Light, ' ', Carminite, ' ', Arrow]`
- `"Cd-In-Ag-Alloy"` → `[Cd, -, In, -, Ag, -, Alloy]`
- `"C-Foam"` → `[C, -, Foam]`
- `"Don't"` → `[Don't]`
- 空白 run 归一化为单个 `' '` token。
- 输入值、字典 key、模板字面量使用同一套分词规则。

### 4.3 语法构造

- 字典条目 → 终结符产生式：`G -> token token ...`。
- 规则模板 → 产生式：`G -> 终结符 / 非终结符 ...`。
  - 非终结符对应 `subs` 中的组。
  - 译文模板保留为 `{n}` 占位符结构。
- 每个组计算：
  - `groupSize`：结果条目数（用于 combo 排序）。
  - `minLen` / `maxLen`：token 长度范围。
  - `firstSet`：可作为首个 token 的集合。
  - `required`：产生式中必须出现的字面量 token（廉价预筛）。
- 产生式按 `firstSet` 建索引；组按 namespace 建前缀 trie。

### 4.4 词内拼接特化

严格分词无法切分 `{0}Crush Hammer Head` 和 `{0}s`。编译器检测「占位符与字面量之间没有空格/标点」的规则，把子组的每个条目展开成具体 token 序列产生式：

```
Abyssalnite + "Crush Hammer Head" -> "AbyssalniteCrush Hammer Head"
Plate + "s"                      -> "Plates"
```

运行时仍然只做 token 匹配。不特化时 622 条译文对不上；特化后完全一致。

### 4.5 解析器

```js
function parseGroup(gid, i, j) {
  const key = gid * 65536 + i * 256 + j;
  if (memo.has(key)) return memo.get(key);
  memo.set(key, EMPTY);

  const out = [];
  for (const prod of prodsByFirst[gid][tokens[i]]) {
    if (j - i < prod.minLen || j - i > prod.maxLen) continue;
    if (!requiredPresent(prod, i, j)) continue;
    if (prod.kind === 'dict') {
      if (tokensMatch(prod.terms, i, j)) out.push(prod.result);
    } else {
      matchRule(prod, i, j, out);
    }
  }
  const capped = dedupeResults(out);
  memo.set(key, capped);
  return capped;
}
```

`matchRule` 按产生式的 parts 递归切分：

- 终结符：比较下一个 token。
- 非终结符：枚举结束位置 `k`，递归 `parseGroup(sub, pos, k)`。
- 用 `remMin`/`remMax` 限制 `k` 的范围，避免无意义的切分。
- 合并 namespace，按 `(gen, ri, combo)` 生成结果。

### 4.6 实测与结论

| 场景 | 时间 | GC 后堆 | 峰值 RSS |
| --- | ---: | ---: | ---: |
| 真实 | 1.565 s | 28 MB | 541 MB |
| 4× addon | 6.040 s | 99 MB | 636 MB |
| 400 万 pairs | 1.565 s | 30 MB | 549 MB |

- 活堆极低，但递归 + memo + 结果数组分配导致时间和峰值分配偏高。
- 真实配置约 1.12 s，是 `pattern`/`stream` 的 1.8–1.9×，不适合作为默认执行引擎。
- 它的价值是**表示能力**和**研究基线**；`pattern` 已经吸收了它「严格分词 + 中间模板」的核心思想，但把运行时递归解析改成了编译期展开。

---

## 5. flat-token：严格分词 + 扁平匹配

### 5.1 核心思想

保留严格分词，但去掉 CFG 递归：

- 被引用的组：正向建表，但表键是 **token 序列**。
- completed-only 规则：直接按 token 边界切分，捕获值到 token 表查译文。
- completed-only 字典/词内拼接：展开成 `tokenKey -> 条目` 的扁平表。

### 5.2 实现

1. 为每个引用组建立 `Map<tokenKey, entries[]>`：

```js
const key = tokenIds.join(',');
map.get(key) // O(1)
```

2. 对每个输入值预计算 `spanKeys[i][j]`：`tokens[i..j)` 的 token key。
3. completed-only 规则匹配：

```js
function rec(pi, pos) {
  if (pi === parts.length) {
    if (pos !== n) return;
    emit(combine(targets), combineNamespaces(), combo);
    return;
  }
  const part = parts[pi];
  if (part.t !== undefined) {
    if (tokens[pos] === part.t) rec(pi + 1, pos + 1);
    return;
  }
  const map = groupTokenMap.get(part.sub);
  for (let k = pos + 1; k <= n; k++) {
    const entries = map.get(spanKeys[pos][k]);
    for (const e of entries) {
      cur[part.sub] = e;
      rec(pi + 1, k);
    }
  }
}
```

4. 整值命中：`referencedCandidates.get(wholeKey)` 和 `flatDict.get(wholeKey)` 直接给出候选。

### 5.3 实测与结论

| 场景 | 时间 | GC 后堆 | 峰值 RSS |
| --- | ---: | ---: | ---: |
| 真实 | 0.843 s | 69 MB | 540 MB |
| 4× addon | 3.811 s | 263 MB | 938 MB |
| 400 万 pairs | 0.954 s | 72 MB | 558 MB |

- 比 grammar 快一倍，活堆低，但真实配置 0.843 s 仍慢于 `pattern` 0.611 s / `stream` 0.607 s。
- 主要成本：group token 表构建 + 每个值的 span key 分配。
- 它验证了「严格分词 + 扁平匹配」的方向；`pattern` 把这个方向推进为「编译期展开模板 + 运行时 `LIT`/`LEX`/`REDUCE`」，从而同时消除了 group token 表和递归解析。

---

## 6. pattern：编译型扁平模板自动机

### 6.1 核心思想

把「中间模板全部保留、最后编译成 Candidate」落实为一次性编译：

1. 对每个组展开其规则树。字典组保留为一个 **词法槽**（`LEX`），规则组继续展开；混合组同时保留词法槽和规则分支。
2. 每条展开路径编译成一段短操作序列：
   - `LIT token`：匹配非词法字面量；
   - `LEX group`：在词法表里匹配一个或多个 token 的词典词条；
   - `REDUCE rule`：把子槽结果合成为父规则的 `(target, namespace, combo)`。
3. 运行时不再递归解析组，只按输入 token 走这些编译好的模式；命中后直接得到 Candidate。

与 `grammar` 的区别：`grammar` 在运行时反复执行 `parseGroup(gid, i, j)`；`pattern` 把组展开和槽位绑定固定在编译期，运行时只做线性 token 匹配和少量回溯。

### 6.2 编译结果规模

真实配置（125,676 keys / 459,046 pairs）：

| 指标 | 数值 |
| --- | ---: |
| 规则模板 | 162 |
| 槽位 | 202 |
| 字面量 token（去重） | 116 |
| 展开后的结构模板（全部组） | 972 |
| completed 组的顶层模板 | 899（去重后 993 个 pattern 对象） |
| 词内拼接特化条目 | 1,632 |
| 编译出的 pattern 总数 | 2,035 |
| 编译时间 | 0.13–0.15 s |

这里的 **202 是 162 条规则模板中 `{n}` 占位符的出现次数**，不是 143 个唯一 group 的数量；每个槽位的目标由该规则的 `subs[n]` 指定，同一个 group 可以被多个槽位引用（例如 `material` 被 34 个槽位引用）。按槽位引用分类是 121 dict-only / 23 rule-only / 57 mixed / 1 missing；按唯一 group 分类则是 54 dict-only / 79 rule-only / 10 mixed。57 个 mixed 槽位只对应 10 个唯一 mixed group。

关键结论：**展开后的结构模板只有不到 1,000 条**，最大组 77 条，没有爆炸。这是「把所有中间模板编译成一个 Candidate」在规模上可行的直接证据。

993 个顶层 pattern 不是 993 条规则，而是 162 条规则按子组结构展开后的结构替代数。最大的组是 `crate16` / `crate64` / `crate16Partial` / `block` 各 77 个：它们都有 5 条 `Crate of {0}` / `Block of {0}` 规则，分别引用 dust（16 个 pattern）、ingot（12）、plate（24）、ore（14）、material（11），合计 77。其次是 `oreComplex` 29（2 条 `{0} {1}` × ore 的 14 个 + 1 个 dict）、`plateComplex` / `plate` 24、`toolHead` / `toolHeadRaw` 23。

运行期的 candidate entry 是另一层概念：真实配置共 114,270 条，最大的是 `oreComplex` 31,672、`materialProduct` 15,391、`toolHead` 11,236、`toolHeadRaw` 7,343、`plateComplex` 3,618、`crate16Partial` 3,447、`crate64` 3,374、`block` 3,365、`dustComplex` 3,337、`bullet` 2,616；前 10 个组约占 75%。这些不是编译期 pattern，而是一个输入值在多个 namespace/条目下产生的匹配结果。

### 6.3 编译步骤

1. **分词**：严格分词（单词、标点、撇号），但使用 ASCII 快路径；空白不作为 token。与 `grammar` 相同的词内拼接检测，只对 3 条 affix 规则做具体条目特化。
2. **词法表**：每个组的 dict 条目和 affix 特化条目按首 token 建 `Map<token, entries[]>`；条目带 `(terms, target, namespace, gen, ri, combo, idx)`。
3. **元数据**：每组计算 `minLen/maxLen/firstSet/lastSet`；每条规则计算 `slotOrder`、`subSizes`、`base`、`tgtParts`。
4. **模式编译**：规则按 source parts 展开，字面量 → `LIT`，槽位 → 子组模式，最后追加 `REDUCE`；相同操作序列去重。
5. **索引**：
   - 首 token 索引：每个 pattern 按首 token 注册；
   - namespace trie：pattern 按其可能 namespace 注册，key 走 trie 得到候选 pattern（与 `grammar` 相同的前缀继承）；
   - 末 token + 必需字面量剪枝：匹配前先过滤。
6. **执行**：`LIT` 比较 token；`LEX` 枚举匹配的词典条目；`REDUCE` 从操作数栈弹出子结果，合并 namespace、计算 combo、构建译文，再压回父结果。

多词词条（例如 `materialPowder` 的 `Infused Earth Crystal`）在词法表里是一条 `terms = [Infused, Earth, Crystal]` 的条目；`LEX` 在一次操作中消费 3 个 token，**不是**把两个 token 合并，也不需要合并回退。栈只在 `REDUCE` 里合并槽位的语义结果（target/namespace/combo），不负责 token 切分。

### 6.4 回溯正确性

`REDUCE` 会覆盖操作数栈中第一个子槽的位置。如果该位置低于外层 `LEX` 循环的栈指针，下一个词条会读到被覆盖的父操作数。实现上用 `minSp` 标记外层循环的栈下界，在低位置 `REDUCE` 前保存并恢复父操作数。这是 `pattern` 与普通栈式虚拟机唯一的语义差异，也是原型从 42 条 `Mercury` 歧义错误回到 `mismatch = 0` 的关键修复。

### 6.5 复杂度

- 时间：O(C_pattern + K × C_candidate × L_pattern + LEX_hits + M)
  - `C_pattern` 是编译期模式数（与规则图有关，与 P 无关）；
  - `C_candidate` 是每个 key 经 namespace、首 token、末 token、必需字面量过滤后的候选模式数；
  - `L_pattern` 是模式长度（当前均值约 3.5 token）。
- 内存：O(C_pattern + R_lex + M)，不保存完整笛卡尔积。
- 与 P 解耦：explosion 场景 P 从 45.9 万涨到 400 万，`pattern` 时间基本不变（0.611 → 0.595 s）。

### 6.6 实测（3 轮中位数，端到端，`--expose-gc`）

| 场景 | 引擎 | 时间 | GC 后堆 | 峰值 RSS | 输出 |
| --- | --- | ---: | ---: | ---: | --- |
| 真实 | **pattern** | **0.611 s** | **62.6 MB** | 376 MB | ✅ |
| 真实 | stream | 0.607 s | 190.8 MB | 343 MB | ✅ |
| 真实 | token | 0.650 s | 300.1 MB | 464 MB | ✅ |
| 4× addon | pattern | 2.445 s | **153.5 MB** | 777 MB | ✅ |
| 4× addon | **stream** | **2.243 s** | 552 MB | 740 MB | ✅ |
| 4× addon | token | 2.398 s | 749.8 MB | 904 MB | ✅ |
| 400 万 pairs | **pattern** | **0.595 s** | **64.7 MB** | 376 MB | ✅ |
| 400 万 pairs | stream | 1.277 s | 193.3 MB | 343 MB | ✅ |
| 400 万 pairs | token | 0.623 s | 308 MB | 467 MB | ✅ |

所有输出 hash 与 golden 一致：`db41064a…`、`b6233d90…`、`4696c472…`；`mismatch = 0`、`unknownMismatch = 0`。

### 6.7 对「空格分词 + 双 Trie + 拆并重试」的评估

| 提议 | 实测结论 |
| --- | --- |
| 1. 只看空格分词 | **不建议作为唯一分词**。空格分词在真实语料上产生 16,042 条不一致：`-` 14,107、括号 2,100、`/` 124、`&` 80、`,` 75、`.` 10。对 16,042 个失败 key 做标点拆分重试需要约 0.13 s（tok 0.032 + gather 0.027 + parse 0.070），收益不足以抵消；直接用标点感知的 ASCII 快路径分词更简单且 0 差异。 |
| 2. 词汇词/非词汇词两棵 Trie | **部分可行**。202 个槽位中 121 个只引用 dict 组、23 个只引用 rule 组、57 个引用混合组；57/202 无法二分类。但混合组中 87% 的解析调用可以仅凭首 token 分到一侧（70,894 dict-only + 557,274 rule-only vs 90,384 both），所以「LEX 表 + 编译后的规则分支」可以在不牺牲正确性的前提下获得同样的分派效果。 |
| 3. 中间模板保留并编译成 Candidate | **完全可行，且是性能关键**。全配置展开只有 972 条结构模板；`pattern` 运行时不再递归解析组，真实/爆炸配置达到或超过 stream，内存只有 1/3–1/5。 |
| 4. 拆分/合并相邻 token 重试 | **拆分是空格分词的必需品，合并不是**。当前语料中 0 条需要合并；拆分需求全部来自标点边界和 3 条 affix 规则。affix 在编译期特化成 1,632 条具体词条后，运行时不需要任意位置拆分。建议保留为未来 addon 的安全网，而不是主路径。 |

### 6.8 何时使用

- **默认：`pattern`。** 真实/爆炸配置最快或持平，内存最低。
- **需要绝对速度的多 addon（scale4）：`stream`。** 快 9%，但活堆是 `pattern` 的 3.6 倍；内存不敏感时可切。
- **极端 P/K 且规则图很小：`token`。** 仍可作为备选。
- **研究/表示能力：`grammar`。** 活堆极低，但执行慢，不作为默认。

### 6.9 风险与后续优化

- 峰值 RSS 仍约 376 MB（启动/编译垃圾）；活堆 63 MB。若峰值 RSS 是硬指标，需要调 GC 或流式编译。
- 3 条 affix 规则目前靠编译期特化；schema v2 应显式标记 `affix`/`suffix`，避免未来新增规则时漏检。
- 过滤器收益高度依赖 pattern 宽度：真实配置下全局 `max` 在宽度 0 的 pattern 上拒绝 78.5%，宽度 1–2 拒绝 18.5%，宽度 3–5 仅 1.5%，宽度 ≥6 低于 0.1%。宽 LEX 场景不要指望 `max`；全局 `min` 仍有约 12% 的硬下界收益。LEX 后缀约束中 `remMax` 有效（lexHits −5%），`remMin` 几乎无效；宽 LEX 的主要优化是词法 token trie（lexAttempts −30%）。
- 栈回溯的 `minSp` 保存/恢复是正确性关键；改成树式递归执行器可以去掉这部分开销（估计 0.05–0.15 s）。
- 书本/散文仍不覆盖；`pattern` 只解决模板词条，不解决长文本。

---

## 7. 六种算法的对比

### 7.1 核心复杂度

| 算法 | 时间 | 内存 | 是否展开笛卡尔积 |
| --- | --- | --- | --- |
| forward | O(P + K) | O(P) | 是 |
| stream | O(P + K + M) | O(R + M) | 是（立即过滤） |
| token | O(V × T × S + M) | O(R + M) | 否 |
| grammar | O(parse states) | O(解析状态) | 否 |
| flat-token | O(V × rules × spans + M) | O(R + M) | 否 |
| **pattern** | **O(C + K × Cand × L + M)** | **O(C + R_lex + M)** | **否** |

### 7.2 场景选择

| 场景 | 推荐 | 原因 |
| --- | --- | --- |
| 真实配置、日常批量生成 | **pattern** | 0.611 s / 63 MB；与 stream 持平，活堆 1/3 |
| 多 addon / 4× 配置 | **pattern**（内存优先）或 stream（绝对速度） | pattern 2.445 s / 154 MB，stream 2.243 s / 552 MB |
| 组合爆炸（P ≫ K） | **pattern** | 0.595 s / 65 MB，不随 P 增长；stream 1.277 s |
| 需要严格 token 表示、addon/版本覆盖 | **pattern** | 编译期展开 + namespace trie，天然支持多命名空间 |
| 规则图极大、pattern 编译/候选过多 | stream 或 token | pattern 时间随规则图增长；需要对超大规则图保留回退 |
| 研究/表示能力 | grammar | 活堆极低，但执行慢 |

### 7.3 一条重要的数据结论

**当前配置的瓶颈不是「匹配算法不够聪明」，而是「是否要生成 361k 个 completed-only pair」。**

- `forward` / `stream` 仍然在正向生成；`stream` 只是把不命中的 pair 立即丢弃，枚举次数没有减少。
- `pattern` 不再生成 pair：它在编译期把规则图展开成 972 条结构模板，运行时直接匹配输入。这是本次实测中唯一跨数量级的改进。
- 对 `stream` 回退路径，**增量缓存**和**并行枚举**仍然有价值；对 `pattern`，缓存收益主要来自编译结果和词法表，而不是 group 结果。

---

## 8. 更快的方法

### 8.1 已落地的 stream 优化

1. **原文优先**：先构建 `src`，命中 `inputValues` 后再合并 namespace、构建译文。省掉 72.9% 无用 pair 的译文和 namespace 工作。
2. **单候选快路径**：apply 阶段 `arr.length === 1` 时直接判断 namespace，不做 `betterOrder`。
3. **显式下标循环**：规则笛卡尔积用手动进位，避免迭代器和数组分配。

效果（build+apply，不含进程启动）：

| 场景 | 优化前 | 优化后 | 提升 |
| --- | ---: | ---: | ---: |
| 真实 | 0.483 s | **0.354 s** | 27% |
| 4× addon | 2.389 s | **1.144 s** | 52% |
| 400 万 pairs | 1.523 s | **0.965 s** | 37% |

### 8.2 增量缓存（对 stream 回退路径仍有价值）

对 group 做**内容寻址缓存**：

```
hash(group) = hash(生成器定义 + 所有子组的 hash)
```

- 第一次运行：正常生成，把每个组的条目（或压缩后的二进制）写入 `.cache/groups/<hash>`。
- 后续运行：只有定义或子组 hash 变化的组需要重新生成；其余直接加载。
- 最终 apply 阶段始终执行（它只依赖输入 key 和候选表）。
- 翻译工作流中大多数修改只影响 fallback 或少量规则，命中率会很高。

按实测阶段拆分（真实配置）：

| 阶段 | 时间 |
| --- | ---: |
| 被引用组构建 | ~0.08 s |
| completed-only 枚举 | ~0.21 s |
| apply | ~0.07 s |
| apply（候选已在内存，热路径） | **~0.04 s** |

如果 generation 全部命中缓存：

- **长驻进程/Web 服务**（解析结果和候选表都在内存）：小改动后的重算约 **0.04–0.1 s**，因为只剩 apply。
- **冷启动 + 磁盘缓存**：仍需解析 125k 条语言文件和加载缓存，实测完整进程内耗时约 **0.25–0.3 s**；比冷启动全量生成（0.65 s 进程内）仍快一倍以上。

缓存按 group hash 存放并淘汰，可以避免现有实现「2 GB 内存缓存」的问题。

### 8.3 并行枚举

completed-only 的 301 个 generator 互不依赖（子组已解析），可以用 `worker_threads` 按 generator 分片：

- 4 核理论上可把 0.21 s 的枚举压到 ~0.06 s。
- 需要把候选表合并回主线程；合并成本约为 M 条目的序列化，按当前 123k 条目仍然可控。
- 适合 CI/批量构建，不适合需要确定性单线程输出的场景；实现复杂度高于增量缓存。

### 8.4 引擎选择：pattern 默认，stream/token 回退

- **默认 `pattern`**：真实 0.611 s / 63 MB，explosion 0.595 s / 65 MB；与 P 解耦。
- **`stream` 回退**：多 addon 且输入 key 很大（scale4 量级）时，stream 绝对时间快约 9%；若内存不敏感可切。
- **`token` 回退**：规则图很小但 `P/K` 极高，且 pattern 的候选模式数因规则图异常膨胀时。
- **`grammar`**：只保留为研究/表示能力原型，不作为执行引擎。
- 自动选择建议：先用 `pattern` 编译并估算 `C_pattern`、`K`、`P`；若 `C_pattern` 超过阈值（例如 5 万）或编译时间超过 2 s，回退 `stream`；否则默认 `pattern`。

### 8.5 不建议的路线

- **正则反向匹配**：历史方案，回溯成本不可控。
- **空格分词作为唯一分词**：真实语料 16,042 条不一致；标点感知分词更简单且无差异。
- **grammar 作为默认引擎**：真实配置 1.12–1.57 s，远慢于 pattern/stream。
- **无条件用字符级分词器**：P/K 低时每 key 的解析成本反超 pattern/stream。
- **用 float 编码顺序**：4× 配置会溢出，必须用三元组。

---

## 9. 复现与代码位置

所有原型位于 `C:\Users\Tanimodori\AppData\Local\Temp\gt6-bench\`：

| 文件 | 内容 |
| --- | --- |
| `bench.js` | `forward` / `stream` / `token` 三种引擎 |
| `grammar-bench.js` | 严格分词 + CFG 解析器 |
| `flat-bench.js` | 严格分词 + 扁平 token 匹配 |
| `pattern-bench.js` | 编译型扁平模板自动机（`LIT`/`LEX`/`REDUCE`） |
| `analyze_config.py` | 规则图与膨胀分析 |
| `analyze_ws.py` | 空格分词/双 Trie/拆并重试的数据评估 |
| `expand_templates.py` | 中间模板展开规模统计 |
| `match_patterns.py` | 展开后模板的匹配量估算 |
| `gen_scale.py` | 2×/4× addon 语料 |
| `gen_explode.py` | 400 万对爆炸语料 |
| `bench_matrix.py` / `matrix_all.py` | 多引擎矩阵基准 |

基准结果与结论见 [perf-evaluation.md](perf-evaluation.md)；迁移阶段见 [migration-plan.md](migration-plan.md)。
