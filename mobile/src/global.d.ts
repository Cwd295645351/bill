import type { Config } from "@/types/config"

declare global {
	interface Window {
		/** 应用配置 */
		config: Config
	}
}