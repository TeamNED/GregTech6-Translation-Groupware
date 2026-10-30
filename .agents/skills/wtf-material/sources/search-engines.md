# 搜索引擎与检索工具

## 信源信息

- 通用搜索引擎：Google、Bing、DuckDuckGo、百度。
- DeepSeek 搜索工具：会话内的 `mcp__deepseek-tools__deepseek_search`，返回标题、URL、摘要、日期和权威度评分；`mcp__deepseek-tools__deepseek_fetch` 可抓取正文。
- browser use：`browser-use:control-browser` 技能，用真实浏览器打开页面、执行搜索并读取渲染后的内容。

## 涵盖内容

- 找材料的现实出处：元素、矿物、合金、宝石、化学品的科普页和论文。
- 找虚构出处：`"<英文名>" minecraft`、`"<英文名>" wiki`、`"<英文名>" <作品名>`。
- 找中文社区用法：`"<中文名>" 格雷`、`"<英文名>" MC百科`、`"<英文名>" 翻译`。
- 找原始页面：百科站内搜索不好用时，用 `site:` 限定域名。

## 注意事项

- 摘要不是证据。必须打开原页确认，引用原页 URL。
- 先用英文名确定“这是什么东西”，再用中文名确认“中文社区怎么叫”。
- 同一个英文名可能对应多个作品（如 Tritanium 同时出现在 Star Trek 和 GregTech），要结合 mod 版本和配方判断。
- 搜索 `"<名字>" etymology` 或 `"<名字>" origin` 有助于判断词源和命名梗；但词源站只能证明单词来源，不能证明 mod 作者确实用了这个梗。
- 中文搜索结果常被攻略、视频、搬运站污染；优先看 MC百科、Wiki、GitHub。
- 页面返回 403、验证码或内容由 JS 渲染时，改用 browser use。
- DeepSeek 结果的 `authority` 分数只是排序参考，不代表事实正确。
