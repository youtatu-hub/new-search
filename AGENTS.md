# Repository Guidelines

## Project Structure & Module Organization
本仓库是一个前端 TypeScript 项目，用于更美观地展示每日链接列表，按上传日期分组，并为每条链接提供直接跳转按钮。源码位于 `src/`，当前入口文件为 `src/index.ts`。编译输出目录为 `dist/`，由 TypeScript 根据 `tsconfig.json` 生成。依赖与脚本定义在 `package.json`，锁文件使用 `package-lock.json`。IDE 配置位于 `.idea/`，不应作为功能代码修改目标。

## Build, Test, and Development Commands
- `npm install`：安装依赖；首次拉取仓库后执行。
- `npm run build`：运行 `tsc`，将 `src/` 编译到 `dist/`。
- `npx tsc --noEmit`：仅做类型检查，不生成产物，适合提交前快速校验。

当前仓库未配置 `dev`、`test` 或 lint 脚本；新增脚本时，请同步更新本文件和 `package.json`。

## Coding Style & Naming Conventions
使用 TypeScript 严格模式，保持代码能通过 `strict` 检查。缩进使用 2 个空格，字符串风格与现有文件保持一致。文件名建议使用小写或 `kebab-case`；导出的类型、类、接口使用 `PascalCase`，变量和函数使用 `camelCase`。涉及界面展示时，优先按“日期分组、链接卡片、跳转行为”拆分模块，避免把渲染、数据整理和事件处理混在 `src/index.ts` 中。

## Testing Guidelines
当前未接入测试框架，也没有覆盖率门槛。新增功能时，至少应执行 `npm run build` 和 `npx tsc --noEmit`。如果引入测试框架，建议将测试文件命名为 `*.test.ts`，并与源文件同目录放置，或统一放在 `tests/` 下；两种方式任选其一，但要在仓库内保持一致。

## Commit & Pull Request Guidelines
现有提交历史采用简短中文摘要，例如 `初始化`。后续提交建议继续使用简洁、动词开头的说明，例如 `新增搜索参数解析`、`修复编译输出路径`。Pull Request 应包含变更目的、主要修改点、验证方式；如果改动影响命令输出或目录结构，请附示例或截图。

## Configuration Tips
不要手动编辑 `dist/` 产物，应修改 `src/` 后重新构建。新增链接数据结构时，优先保证字段至少包含标题、URL、上传日期，便于前端按日期分组展示。提交前确认未误提交本地 IDE 文件、临时日志或其他非源码产物。
