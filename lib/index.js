/**
 * dsh-auto-open-files —— host 半（空壳）。
 *
 * 本插件只做浏览器端的事：把右栏「文件」页签在新会话里自动打开。host 侧不注册
 * 路由、服务、定时任务或工具，因此 apply 留空——保留它只是为了满足 bundle 条目
 * 对「模块导出一个 apply」的契约（cordis 插件入口形状）。
 *
 * 真正的逻辑在浏览器半 lib/client.js（package.json 的 exports "./client" +
 * dsh.client.platform = "web"）。
 *
 * @module dsh-auto-open-files
 */

/** 空实现：本插件在 host 侧无副作用。 */
export function apply() {}
