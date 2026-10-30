/**
 * dsh-auto-open-files —— 浏览器半。
 *
 * 目的：新建会话时不再需要手点右栏「文件」页签。
 *
 * 做法：DSH 原生右栏（客户端服务 `ctx.sidebarRight`）的新会话初始状态是「收起、
 * 一个分栏、没有页签」。这里订阅 `mounted`（当前上屏的会话席位），一旦某个会话的
 * 席位出现、且它的右栏一个页签都没有，就调一次 `openTab('files')`——原生 openTab
 * 会在同一步把右栏展开，所以不需要再调 toggleExpanded。
 *
 * 口径（避免和用户打架）：
 *  - 每个会话只自动打开一次；用户手动关光页签后再切回来，不再重新打开；
 *  - 只有「一个页签都没有」才动手，已经有 guide/其它页签的会话不动；
 *  - 席位尚未挂载完时 openTab 会抛错（no session surface is mounted），用 setTimeout
 *    补试到预算用完为止，失败只留日志，不影响页面。
 *
 * 稳定性约定：`apply` 里任何一步都不允许把异常抛出去——客户端加载器一旦看到插件
 * 抛错，会把该插件标成 failed 并弹「发现导致启动失败的插件」。所以这里全程
 * try/catch + 可选链，出错只打 `[dsh-auto-open-files]` 前缀的警告。
 */

window.__ModuleLoader__.load({
	id: 'dsh-auto-open-files',
	factory: () => {
		const module = { exports: {} };
		const exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });

		/** 日志前缀，浏览器控制台按它过滤。 */
		const LOG = '[dsh-auto-open-files]';
		/** 要打开的页签类型：内置文件树。 */
		const KIND = 'files';
		/** 每次补试的间隔（毫秒）。 */
		const RETRY_MS = 125;
		/** openTab 补试次数上限（约 3 秒）。 */
		const MAX_TRIES = 24;

		/**
		 * 插件主体。
		 * @param ctx - 客户端上下文（cordis 注入）。
		 */
		function apply(ctx) {
			console.info(LOG, '已激活');
			try {
				ctx.inject(['sidebarRight'], (scope) => {
					scope.effect(() => {
						/** 已处理过的会话 id：一个会话只自动打开一次。 */
						const handled = new Set();
						/** 补试定时器。 */
						let timer;
						/** 当前待打开的会话 id。 */
						let target;

						/**
						 * 读当前上屏会话 id，读不到就当没有。
						 * @param right - 右栏服务。
						 * @returns 会话 id 或 undefined。
						 */
						const readMounted = (right) => {
							try {
								return right?.mounted?.getSnapshot?.();
							} catch (error) {
								console.warn(LOG, '读取 mounted 失败：', error);
								return undefined;
							}
						};

						/**
						 * 就地把目标会话的页签打开。
						 * @param right - 右栏服务。
						 * @returns 本轮是否已经收工（true 时不再补试）。
						 */
						const attempt = (right) => {
							if (target === undefined) return false;
							// 目标会话还没上屏：等它挂载时的下一次 mounted 变化。
							if (readMounted(right) !== target) return false;
							try {
								const active = typeof right.active === 'function' ? right.active() : undefined;
								handled.add(target);
								// 已经有页签（含首次展开种子化的 guide）：不抢。
								if (active !== undefined) return true;
								right.openTab(KIND);
								console.info(LOG, '已自动打开右栏页签', KIND, '会话', target);
								return true;
							} catch (error) {
								handled.delete(target);
								console.warn(LOG, '打开右栏页签失败，稍后重试：', error);
								return false;
							}
						};

						/**
						 * 排一次补试（首次放进宏任务，避开渲染/提交周期）。
						 * @param right - 右栏服务。
						 * @param tries - 已经尝试过的次数。
						 */
						const schedule = (right, tries) => {
							if (timer !== undefined) return;
							timer = setTimeout(
								() => {
									timer = undefined;
									if (attempt(right)) {
										target = undefined;
										return;
									}
									if (tries >= MAX_TRIES) {
										console.warn(LOG, '放弃自动打开右栏页签：', target);
										target = undefined;
										return;
									}
									schedule(right, tries + 1);
								},
								tries === 0 ? 0 : RETRY_MS,
							);
						};

						/**
						 * 收到一个候选会话：没处理过就排队补试。
						 * @param right - 右栏服务。
						 * @param sessionId - 会话 id。
						 */
						const consider = (right, sessionId) => {
							if (typeof sessionId !== 'string' || sessionId === '') return;
							if (handled.has(sessionId)) return;
							target = sessionId;
							schedule(right, 0);
						};

						const right = scope.get('sidebarRight');
						if (right === undefined) {
							console.warn(LOG, 'sidebarRight 服务不可用，自动打开功能暂停');
							return () => {};
						}

						// 插件加载时可能已经有会话在屏上，先补一次。
						consider(right, readMounted(right));

						let stop;
						try {
							stop = right.mounted?.subscribe?.(() => consider(right, readMounted(right)));
						} catch (error) {
							console.warn(LOG, '订阅 mounted 失败：', error);
						}

						return () => {
							try {
								if (typeof stop === 'function') stop();
							} catch {
								/* 退订失败无所谓，页面马上要销毁 */
							}
							if (timer !== undefined) {
								clearTimeout(timer);
								timer = undefined;
							}
						};
					}, 'dsh-auto-open-files: 默认打开文件页签');
				});
			} catch (error) {
				console.warn(LOG, '激活失败：', error);
			}
		}

		exports.apply = apply;
		return module.exports;
	},
});
