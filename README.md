# dsh-auto-open-files

让 DSH Web GUI 的右栏「文件」页签在打开会话时自动出现，不用每次手点。

## 做什么

- 新会话一上屏，如果它的右栏一个页签都没有，就自动打开「文件」页签（原生 `openTab` 会同时展开右栏）。
- 每个会话只自动打开一次：手动关光页签后再切回来，不会被重新打开。
- 已经有页签（比如首次展开时种子化的 guide 页）的会话不动。

## 目录结构

| 文件 | 作用 |
| --- | --- |
| `package.json` | 插件清单：`main`、`exports "./client"`、`dsh.bundle.patch`、`dsh.client.platform` |
| `cordis.patch.yml` | bundle 补丁：往 profile 里插入一条挂载行 |
| `lib/index.js` | host 半（空壳，无路由无服务） |
| `lib/client.js` | 浏览器半：订阅 `ctx.sidebarRight.mounted`，空栏时 `openTab('files')` |

浏览器半是手写的 `window.__ModuleLoader__.load({ id, factory })` 形式，不需要 tsc/tsdown 构建。

## 安装

profile 目录 `%USERPROFILE%\.dsh\profiles\web` 里手工接线三处。**禁止在有会话时跑 `dsh plugin add`**：它会重排整棵依赖树，swap 阶段会删掉正在使用的 `node_modules/@dsh-ops/bash-win32-x64`（文件被占用，报 `拒绝访问 (os error 5)`），宿主 shell 工具直接失效。

1. 建目录联接（junction）指向源码（`<插件源码目录>` 换成本仓库克隆下来的绝对路径）：

   ```powershell
   New-Item -ItemType Junction -Path "%USERPROFILE%\.dsh\profiles\web\node_modules\dsh-auto-open-files" -Target "<插件源码目录>"
   ```

2. `package.json` 的 `dependencies` 加
   `"dsh-auto-open-files": "link:<插件源码目录，正斜杠>"`
3. 同文件 `dsh.profile.bundles` 加 `"dsh-auto-open-files"`

接线后宿主会热应用 profile 的 `cordis.patch.yml`：浏览器 Ctrl+Shift+R 硬刷即生效，不用重启 DSH（首页的 `__DSH_BOOT__` 插件清单每次请求现算）。

bash 载荷被误删后的恢复（只补 bash，不动依赖树）：

```powershell
node "%USERPROFILE%\.dsh\profiles\web\node_modules\dsh-ops\bin\dsh-ops.mjs" provision-shells --bash
```


## 开关

浏览器半不读 `ctx.config`（客户端上下文里没有这个属性，读了会让插件加载失败），
所以没有配置项，行为固定为「新会话自动打开 `files` 页签」。

关掉的办法是**不加载它**，二选一，改完刷新页面即生效：

- 从 `%USERPROFILE%\.dsh\profiles\web\package.json` 的 `dsh.profile.bundles`
  里删掉 `dsh-auto-open-files`；
- 或删掉 profile `cordis.patch.yml` 里 `- id: auto-open-files` 那一行。

## 排错

浏览器控制台（F12 → Console）看 `[dsh-auto-open-files]` 前缀：

- `已激活`：插件挂载成功，后面应当紧跟着打开日志；
- `打开右栏页签失败，稍后重试`：右栏席位（session surface）还没挂载完，正常会自己补试成功；
- `放弃自动打开右栏页签`：补试用完（约 3 秒）仍未成功，通常是页签类型 `files` 没注册；
- `sidebarRight 服务不可用`：右栏被别的插件替换/禁用了。

最后修改：2026-10-30
