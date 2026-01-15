import type { Config } from "@react-router/dev/config";

export default {
  // SPA 模式
  ssr: false,
  // 开发环境不需要 basename，生产环境通过 Vite base 处理
  basename: process.env.NODE_ENV === 'production' ? '/static' : '/',
} satisfies Config;
