# Research: 服务端源码改为 TypeScript

## 1. 开发与生产怎么跑 TypeScript

**Decision**: 源码改为 TypeScript。开发用 `tsx` 直接跑 `bin/www.ts`。生产先用 `tsc` 编译到 `server/dist/`，再用 Node 运行 `dist/server.js`。PM2 进程名仍是 `bill-manage`，端口仍是 `3000`。`pm2.conf.json` 去掉不存在的 `babel-node` 解释器，改为 Node 执行编译结果。

**Rationale**:

- 部署约定是 Node 18 及以上。Node 18 不能直接运行 TypeScript，生产若依赖 `tsx`，服务器进程就要带一套转译器。编译后再用 Node 启动，和现在的「Node 提供 API」一致。
- 仓库根目录的 `.gitignore` 已忽略 `dist/`。发布流程仍是把 `server/` 源码拷到服务器再 `pnpm install`。安装后增加 `pnpm run build`，再 `pnpm run prd`。不把编译结果提交进 Git。
- `package.json` 的 `dev` 今天是 `nodemon bin/www`。开发改为 `tsx watch`，保存源码即可重启，不必先编译。`tsx` 的监听不代替类型检查；能发布的前提是 `tsc` 通过。
- `pm2.conf.json` 的 `interpreter` 指向 `node_modules/babel-cli/bin/babel-node.js`，但 `server/package.json` 没有 `babel-cli`。继续留着它，TypeScript 源码也无法被正确启动。

**Alternatives considered**:

- 开发和生产都用 `tsx`：服务器少一步编译，但生产进程依赖转译器，和现有 Node 启动方式分叉。
- 只做 `tsc --noEmit`，运行时仍维持手写 JavaScript：规格要求业务源码本身改为 TypeScript，不能两套并存。
- 把 `dist/` 提交进仓库：服务器可以少装编译器，但编译结果会和源码重复，也违反现有忽略规则。

## 2. 类型检查有多严

**Decision**: `strict: true`，与电脑网页、小程序一致。`skipLibCheck: true`。不开启 `noUnusedLocals` / `noUnusedParameters`。目标为 `ES2020`，模块产出为 CommonJS，`esModuleInterop: true`。

**Rationale**:

- 规格要求明确的类型错误在发布前失败。`strict` 覆盖隐式 `any` 和空值，能拦住写错字段、写错参数。`tsc` 失败时 `build` 失败，不能进入 PM2 使用的 `dist/`。
- 未使用的变量不是这次要修的行为问题。打开对应开关会逼出一串与记账无关的清理。
- `skipLibCheck` 只跳过依赖包里的类型错误，不跳过本仓库源码。否则第三方声明文件的历史问题会挡住发布。

**Alternatives considered**:

- 关闭 `strict`，只开 `noImplicitAny`：空值错误仍要等到运行才出现，检查弱于两端已有的 TypeScript。
- 顺手清理全部未使用变量：超出「不改行为」的范围。

## 3. 源码模块怎么写

**Decision**: 业务和启动源码使用 `import` / `export`。`tsc` 把它们编译成 CommonJS，供 Node 18 的 `require` 加载。不引入 Sequelize 装饰器模型，不调整目录分层。`require` 全部改为静态导入；今天没有按条件动态加载业务模块。

**Rationale**: 现有文件都是 CommonJS。若改成原生 ESM，`package.json` 要改 `type`，PM2、`db:init` 和路径解析会一起变。编译成 CommonJS 后，运行时仍是 Node 能直接加载的 JavaScript。Sequelize 继续用 `sequelize.define`，避免为了类型去重写模型和表结构。

**Alternatives considered**:

- 源码继续写 `require`，只把文件后缀改成 `.ts`：能通过编译，但和电脑网页、小程序的写法不一致，后续也不利于静态检查。
- 改成原生 ESM：启动链路和现有脚本都要重写，没有用户可见收益。
- 换 `sequelize-typescript`：属于模型层重写，有改到同步和字段行为的风险。

## 4. 没有类型声明的依赖

**Decision**: 有公开类型的依赖安装对应的 `@types` 或使用其自带类型。没有类型的依赖集中放在 `server/types/` 的模块声明里，只描述本仓库实际调用的函数形状。业务文件不使用 `any` 来跳过整段规则，也不使用整文件关闭检查。

**Rationale**: 规格允许在依赖边界做最小标注。Koa、Sequelize、`mysql2`、`jsonwebtoken`、`dotenv`、`uuid`、`dayjs` 都有可用类型。`koa-onerror`、`koa-morgan`、`koa-generic-session`、`koa2-cors`、`koa-redis`、`xss`、`node-xlsx`、`jsrsasign` 这类包需要在实现时核对；缺类型的才写入 `server/types/`。声明放在一处，避免每个路由各自造一份。

**Alternatives considered**:

- 业务代码里到处写 `as any`：检查会在内部失效，不满足「业务规则仍接受检查」。
- 为了补类型替换这些依赖：会改变运行时行为。

## 5. `.env` 和日志仍在 `server/` 根目录

**Decision**: 编译后入口在 `dist/`。读取 `.env` 和写入 `logs/access.log` 时，目录取 `server/` 根目录，不取 `dist/`。开发用 `tsx` 直接跑源码时，这两个路径仍是 `server/.env` 和 `server/logs/`。缺少密钥或数据库口令时仍打印错误并退出，不改为带空密钥启动。

**Rationale**: 今天只有 `app.js` 用 `__dirname` 拼 `.env` 和访问日志。若编译后仍用 `dist/` 作为 `__dirname`，进程会去找 `dist/.env` 和 `dist/logs/`，密钥位置和部署文档都会错。这是换目录布局必须保持的运行位置，不改变密钥内容、加密方式和日志含义。

**Alternatives considered**:

- 把 `.env` 复制进 `dist/`：密钥会多一份落点，和「只放 `server/.env`」冲突。
- 为了不动这两行路径而放弃 `dist/`、生产改用 `tsx`：已在第 1 节放弃。

## 6. 宪章怎么补

**Decision**: 实现时把宪章原则 II 的后端描述改为「TypeScript 源码，运行时 Node.js + Koa 2 + MySQL + Redis」。版本由 `2.0.0` 升到 `2.1.0`。不改三端分工，不改其他原则。

**Rationale**: 原则 II 的表格是技术栈的现行约束。只改源码、不改宪章，后面的规格仍可能按「服务端是 JavaScript」来写。这次增加的是源码语言约束，没有删除客户端或公开路径，按 MINOR 而不是 MAJOR。

**Alternatives considered**:

- 不改宪章：源码语言和宪章描述会持续不一致。
- 升 MAJOR：没有删除或重定义已有客户端、公开路径或记账不变量。

## 7. 明确不动的部分

**Decision**: 不改 `/api/v1` 的路径、字段和失败原因，不改表结构，不改 `frontend/` 与 `miniapp/`，不恢复手机网页。不新增自动化测试框架。`prettier.config.js`、进程清单、环境文件、SQL 和依赖锁文件不改写成 TypeScript。根目录 `script/dev.js` 仍调用 `server` 的 `dev` 脚本，不改这段调用。

**Rationale**: 规格把这次限定为源码语言和发布前检查。仓库今天没有服务端测试套件，宪章禁止为了填模板去编造覆盖率要求。
