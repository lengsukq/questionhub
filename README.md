# 题集 QuestionHub

移动端优先的本地刷题应用。所有数据保存在当前设备浏览器（IndexedDB）中，无需账号与服务器，内置默认题库并支持导入 JSON 题库，PWA 可安装、可离线使用。

## 功能特性

- 六种题型支持：单选、多选、判断自动判题；简答、综合、计算分析为参考答案 + 自评模式
- 章节练习 / 模拟套卷 / 主观题专项三种练习单元
- 顺序 / 随机出题，可自由筛选科目、章节、题型与题数
- 错题本、收藏、题目笔记、间隔到期复习（答错 1 天、首次答对 7 天、连续两次 14 天、三次以上 30 天）
- 首页概览：继续练习、今日做题、待复习、近 7 天趋势
- 学习数据页：总体进度、题型掌握情况、章节正确率
- 题库管理：内置默认题库，支持导入符合 QuestionBank Schema 的 JSON 文件，多题库切换
- 深色 / 浅色 / 跟随系统外观，iOS 风格毛玻璃与安全区适配
- PWA：可添加到主屏幕，离线可继续已下载内容

## 技术栈

| 层 | 选型 |
|---|---|
| 框架 | Next.js 16 (App Router) + TypeScript |
| 样式 | Tailwind CSS v4（iOS 设计语言） |
| 本地存储 | Dexie.js（IndexedDB） |
| 状态管理 | Zustand |
| 校验 | Zod |
| 图标 | lucide-react |
| 测试 | Vitest |
| PWA | 手写 manifest + Service Worker |

## 快速开始

```bash
npm install

# 准备默认题库（从 data/ 校验并复制到 public/data/）
npm run question-bank:prepare

# 开发
npm run dev

# 测试与检查
npm test
npm run lint
npx tsc --noEmit

# 生产构建
npm run build
npm start
```

首次打开应用时会自动把内置默认题库导入 IndexedDB（约 4MB）。之后可在「题库」页导入其他 JSON 题库文件。

## 项目结构

```text
data/question-bank.json        # 默认题库源文件
public/data/question-bank.json # 构建产物（运行时加载）
public/manifest.webmanifest    # PWA 清单
public/sw.js                   # Service Worker
scripts/                       # 题库准备/校验/图标生成脚本
src/app/                       # 页面路由（App Router）
src/components/                # UI 组件（ui/ layout/）
src/lib/                       # 判题、数据库、导入、复习逻辑
src/stores/                    # Zustand 状态
src/types/                     # 题库类型定义
tests/unit/                    # 单元测试
```

## 数据说明

- 学习数据完全保存在当前设备的 IndexedDB 中，可通过「我的」页导出备份。
- 导入题库需符合 QuestionBank Schema（顶层含 `schemaVersion`、`subjects`、`questions`）。
- 题库内容质量标记（`needsReview`）仅作展示，不影响本地练习。

## 部署

项目已连接 GitHub 仓库与 Vercel 自动部署。推送 `main` 分支即会自动触发线上部署。

```bash
git push origin main
```

线上地址：<https://questionhub-two.vercel.app>
