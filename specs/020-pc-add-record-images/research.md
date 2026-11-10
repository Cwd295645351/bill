# Research: PC 端新增记账支持附图

**Branch**: `020-pc-add-record-images` | **Date**: 2026-11-10

## 1. 后端是否需要改动

**Decision**: 默认零后端改动；复用 `002` 已落地的上传与新增/编辑挂接。

**Rationale**: `POST /api/v1/transaction/image` 已返回未挂接照片 id；`POST`/`PUT /api/v1/transaction` 在请求体显式携带 `imageIds` 时会在同一事务挂接，失败则不落账（或编辑失败）。本切片前端改为保存时再调上传，仍走同一契约。

**Alternatives considered**:

- 新增专用「新增并附图」接口 → 拒绝：重复契约，违反向后兼容与存量优先。
- 改批量新增支持 `imageIds` → 拒绝：规格明确 AI 批量解析本次不附图。

## 2. 新增表单照片状态如何存放

**Decision**: 在 `use-add-edit.ts` 用统一类型 `PhotoDraft`：新增侧 `addImages: PhotoDraft[]`，编辑侧 `editImages: PhotoDraft[]`；草稿以本地 `File` + 预览 URL 为主（尚无服务端 id）；打开/取消新增时重置并 revoke 预览 URL；支出/收入切换不重置。

**Rationale**: 编辑弹窗与新增面板可交替使用；共用同一数组易串状态。规格要求切换收支保留照片，照片状态须与归属人 `watchType` 解耦。保存时再上传后才有 id。命名与 data-model / tasks 对齐为 `PhotoDraft`。

**Alternatives considered**:

- 直接复用 `editImages` → 拒绝：编辑关闭/打开会覆盖新增已选图。
- 选图即上传拿 id 再存草稿 → 已否决（见 §3）。
- 分称 `AddImageDraft` / `EditImageDraft` → 拒绝：增加术语漂移，无行为差异。

## 3. 上传时机：选图即传 vs 点保存再传

**Decision**: PC 新增与编辑一律 **保存时再传**（对齐小程序/H5）：选图只做本地校验与预览；点保存时按序 `uploadTransactionImage`，成功后再带 `imageIds` 调用新增/编辑；任一张上传失败则中止，不提交记账（或编辑失败），本地已选图与已填字段保留。已挂接的原图在编辑时保留其 id，仅对新选本地文件上传。

**Rationale**: 产品要求避免取消后产生未挂接 OSS/库表脏数据。当前 PC 编辑「选图即传」在取消时会留下未挂接行；改为保存时上传可从源头消除。小程序/H5 已是此模式，跨端策略一致。

**Alternatives considered**:

- 保持选图即传（原 plan）→ 拒绝：取消必产生脏数据。
- 选图即传 + 取消时调删除接口清 OSS → 拒绝：需额外清理契约与失败补偿，本切片不值得。

## 4. 界面与手册文案

**Decision**: 删除或改写所有「新记一笔不能附照片」类提示；新增区 tip 改为限度说明；手册 6.5 补充可附图，6.6 删除旧限制。

**Rationale**: 澄清结论要求手册与界面同步；编辑区 tip 当前仍写旧限制，留着会直接违反 SC-006。

**Alternatives considered**:

- 只改手册 → 已在 clarify 中否决。

## 5. 与批量解析的边界

**Decision**: `batchAdd` / 批量解析结果表不增加照片列；请求体不传 `imageIds`。

**Rationale**: FR-014 / SC-007；后端批量路径本就不处理照片。需要附图走单条新增或事后编辑。

## 6. 跨端一致性

**Decision**: 本切片不改小程序与 H5 代码；PC 上传时机改为与它们一致。保存成功后依赖既有列表 `images` 字段做他端只读回归。

**Rationale**: 宪章 II 与 FR-016；挂接后数据模型与查看契约已在 `002` 统一。
