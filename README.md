# NPM 包版本下载量统计

一个用于查询和分析 NPM 包各版本下载统计数据的工具，帮助了解不同版本的受欢迎程度。

**中文** | [English](./README.en.md)

## 功能特点

- 🔍 搜索任意 NPM 包
- 📊 显示各版本的下载量统计
- 📈 按下载量排序显示版本信息
- 🏷️ 支持按标签筛选版本
- 🌍 支持中英文界面
- 📱 响应式设计，支持移动端

## 技术栈

- [Nuxt 4](https://nuxt.com/) - 全栈 Vue 框架
- [Vue 3](https://vuejs.org/) - 渐进式 JavaScript 框架
- [Nuxt UI](https://ui.nuxt.com/) - UI 组件库
- [Nuxt i18n](https://i18n.nuxtjs.org/) - 国际化支持
- TypeScript - 类型安全

## Setup

Make sure to install dependencies:

```bash
# npm
npm install

# pnpm
pnpm install

# yarn
yarn install

# bun
bun install
```

## Development Server

Start the development server on `http://localhost:3000`:

```bash
# npm
npm run dev

# pnpm
pnpm dev

# yarn
yarn dev

# bun
bun run dev
```

## Production

Build the application for production:

```bash
# npm
npm run build

# pnpm
pnpm build

# yarn
yarn build

# bun
bun run build
```

Locally preview production build:

```bash
# npm
npm run preview

# pnpm
pnpm preview

# yarn
yarn preview

# bun
bun run preview
```

Check out the [deployment documentation](https://nuxt.com/docs/getting-started/deployment) for more information.

## 数据来源

- NPM Registry API 获取包信息
- NPM Downloads API 获取下载统计
- 实时数据，按下载量排序显示前50个版本

## 许可证

MIT License
