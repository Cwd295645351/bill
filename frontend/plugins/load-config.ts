import { UserConfig, IndexHtmlTransformHook } from "vite"


const loadConfigPlugin = () => {
    let _mode: 'development' | 'production'
    return {
        name: "load-config",
        config(config: UserConfig, env: { mode: 'development' | 'production', }) {
            _mode = env.mode
        },
        transformIndexHtml(html: IndexHtmlTransformHook) {
            const configSrc = _mode === 'development' ? "./config.local.ts" : './config.ts'
            return {
                html,
                //注入标签
                tags: [
                    {
                        // 放到body末尾，可取值还有`head`|`head-prepend`|`body-prepend`，顾名思义
                        injectTo: "body",
                        //标签属性定义
                        attrs: { type: "module", src: configSrc },
                        //标签名
                        tag: "script"
                    }
                ]
            }
        }
    }
}

export { loadConfigPlugin }

