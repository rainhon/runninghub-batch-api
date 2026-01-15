import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import fs from 'fs';
import path from 'path';

// 自定义插件：build 后清空 static 并复制文件
function cleanAndCopyPlugin() {
  return {
    name: 'clean-and-copy',
    closeBundle() {
      if (process.env.NODE_ENV === 'production') {
        const staticDir = path.resolve(__dirname, '../static');
        const buildDir = path.resolve(__dirname, 'build/client');

        console.log('\n🧹 清空 static 目录...');

        // 删除 static 目录下的所有文件和文件夹（保留目录本身）
        if (fs.existsSync(staticDir)) {
          const files = fs.readdirSync(staticDir);
          for (const file of files) {
            const filePath = path.join(staticDir, file);
            const stat = fs.statSync(filePath);
            if (stat.isDirectory()) {
              fs.rmSync(filePath, { recursive: true, force: true });
            } else {
              fs.unlinkSync(filePath);
            }
          }
        }

        console.log('📦 复制 build/client 到 static...');

        // 确保 static 目录存在
        if (!fs.existsSync(staticDir)) {
          fs.mkdirSync(staticDir, { recursive: true });
        }

        // 递归复制函数
        function copyRecursive(src: string, dest: string) {
          const stat = fs.statSync(src);
          if (stat.isDirectory()) {
            if (!fs.existsSync(dest)) {
              fs.mkdirSync(dest, { recursive: true });
            }
            const files = fs.readdirSync(src);
            for (const file of files) {
              copyRecursive(path.join(src, file), path.join(dest, file));
            }
          } else {
            fs.copyFileSync(src, dest);
          }
        }

        // 复制所有文件
        if (fs.existsSync(buildDir)) {
          copyRecursive(buildDir, staticDir);
          console.log('✅ 文件已复制到 static 目录\n');
        } else {
          console.log('⚠️  build/client 目录不存在，请先运行 npm run build\n');
        }
      }
    }
  };
}

export default defineConfig({
  plugins: [tailwindcss(), reactRouter(), tsconfigPaths(), cleanAndCopyPlugin()],
  // 开发环境使用 /，生产环境使用 /static/
  base: process.env.NODE_ENV === 'production' ? '/static/' : '/',
});
