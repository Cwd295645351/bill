import { defineConfig } from "vite"
import vue from "@vitejs/plugin-vue"
import path from "path"
import Components from "unplugin-vue-components/vite"
import { VantResolver } from "@vant/auto-import-resolver"

const pathResolve = (dir: string) => path.resolve(__dirname, dir)

// https://vitejs.dev/config/
export default defineConfig({
	plugins: [
		vue(),
		Components({
			resolvers: [VantResolver()]
		})
	],
	css: {
		postcss: pathResolve("./postcss.config.js")
	},
	resolve: {
		alias: {
			"@": pathResolve("./src")
		}
	},
	base: "./", // 设置公共基础路径
	server: {
		host: "0.0.0.0",
		port: 4000, // 设置服务启动端口号
		open: true, // 设置服务启动时是否自动打开浏览器
		cors: true, // 允许跨域
		hmr: true,

		// 设置代理，根据我们项目实际情况配置
		proxy: {
			"/api": {
				target: "http://127.0.0.1:8000",
				changeOrigin: true,
				secure: false,
				rewrite: path => path.replace(/^\/api/, "")
			}
		}
	}
})
