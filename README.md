# dsh-gemini-subscription

在 DeepSeek Harness 使用 Google AI 订阅的模型：
DSH 原生 LLM 插件 → 本机 Meridian 桥接 → 已登录的官方 Antigravity CLI。

[公开仓库](https://github.com/advance-lion/dsh-gemini-subscription) ·
[下载插件包](https://github.com/advance-lion/dsh-gemini-subscription/releases/latest) ·
[问题反馈](https://github.com/advance-lion/dsh-gemini-subscription/issues)

当前公开版本 **0.1.1**，已验证的平台为 **Windows x64 + DSH Desktop**。

旧 Gemini CLI 的个人免费、Pro、Ultra 服务已于 2026-06-18 停止。
旧版 Gemini CLI OAuth 反代无法用于当前个人订阅；不要把 API Key 计费当作订阅额度。
官方迁移说明：https://developers.googleblog.com/an-important-update-transitioning-gemini-cli-to-antigravity-cli/

## 当前环境

- DSH Desktop 0.2.2-rc.3、Node.js 24.22.1、Windows x64。
- 官方 Antigravity CLI 1.5.10，官方清单 SHA-512 验证。
- Meridian 1.93.0；原版仅固定验证 agy 1.2.7，本项目附带显式版本兼容补丁。
- 模型从账号实际返回的列表读取，不预置或承诺 Gemini 网页端的模型。
- 登录和刷新交给官方 CLI；插件不复制官方登录令牌。
- 桥接仅监听 127.0.0.1 的随机端口，每次启动使用随机 API 密钥。
- 插件自动启动桥接，卸载插件时停止桥接。Windows 系统代理自动继承，也可设置 `DSH_GEMINI_PROXY`。

2026-11-17 验收：5 项独立协议测试和 2 项 DSH runtime 集成测试通过；真实 Gemini 3.8 Flash 文本请求成功；
真实模型工具调用经 DSH LLM runtime 接收、回传随机测试结果后，模型成功引用该结果。
官方 `/usage` 查询成功，额外付费额度关闭。只有 Gemini 3.8 Flash 做了真实生成验证；
其他模型是否出现取决于各自账号的官方权限，不承诺跨账号一致。

## 安装与登录

1. 先运行一次 DSH Desktop，再完全退出。
2. 从 [Releases](https://github.com/advance-lion/dsh-gemini-subscription/releases/latest)
   下载 `dsh-gemini-subscription-0.1.1-windows-x64.zip`，解压到任意目录。
3. 在解压目录打开 PowerShell，运行下面的安装命令。

安装脚本复用 DSH 自带 Node.js 和 pnpm；没有官方 Antigravity CLI 时，
从 Google 官方分发下载 **1.5.10** 并校验 SHA-512。
如果官方已经升级到其他版本，安装会停止并提示更新插件，避免静默使用未经验证的协议。

在本目录 PowerShell 运行：

```powershell
.\install.ps1
.\gemini.ps1 login
.\gemini.ps1 doctor
```

登录时选择 Google OAuth，使用有 Google AI Pro 的账号。若 Google 要求验证账号，
必须先完成网页验证；OAuth 成功不代表已获得模型调用权限。
在官方 CLI 配置中保持 `useG1Credits: false`，只使用订阅配额。
桥接会检查此设置，拒绝启用额外付费额度的配置。

重启 DSH，在模型选择器选择 **Gemini · Google AI 订阅** 下的模型。
本机安装脚本会备份 Desktop profile 清单、锁文件和覆盖配置，保留其他插件，
使用本地 file 依赖安装，并在 bundle 列表加入此插件。
桥接依赖保存在 `$DSH_HOME/gemini-subscription/bridge`，安装包保存在
`$DSH_HOME/gemini-subscription/packages`。插件不依赖解压目录，安装后可删除该目录。
需要登录或查额度时，也可以用 DSH 自带 Node.js 执行已安装包的 `src/cli.js`。

喜欢用 Git 的用户可直接克隆后安装：

```powershell
git clone https://github.com/advance-lion/dsh-gemini-subscription.git
cd dsh-gemini-subscription
.\install.ps1
```

Release 同时提供标准 `.tgz` 插件包；用于其他 DSH profile 的包管理安装，
桥接仍需单独配置。本版本的一键安装脚本针对 Desktop profile。

```powershell
.\gemini.ps1 smoke gemini-3.8-flash-low
.\gemini.ps1 quota
```

## 功能与限制

支持流式文本、并行工具调用、工具结果回传、取消和实际模型发现。
工具由 DSH 执行和审批；桥接通过本机 MCP 转交工具结果。
Meridian 的工具桥接使用其自动批准与拒绝钩子机制，原生浏览器和原生子代理关闭。
官方 CLI 的系统指令仍生效；精确输出 token 上限、temperature、原生思考签名和图片
尚未在本插件开放。上下文、额度、模型可用性由 Google 决定。

额度可通过 `gemini.ps1 quota` 或官方 CLI 的 `/usage` 查看，直接显示官方数据。
`doctor` 会启动临时桥接并列出实际可用模型。

## 开发验证

```powershell
node --test test/bridge.test.js test/openai.test.js
# 在具有 DSH runtime 依赖的开发环境中：
node --test test/dsh.test.js
```

测试需要可解析的 `@deepseek-ai/dsh-llm` 和 `@deepseek-ai/cordis`，
本工作区使用本机 DSH 同版本 runtime 做集成测试。
真实账号请求验证必须单独完成，fixture 测试不代表 Google 端已接受请求。

## 卸载

退出 DSH，从 Desktop profile 的 `dsh.profile.bundles` 移除
`dsh-gemini-subscription`，从 `cordis.patch.yml` 移除带有
`dsh-gemini-subscription managed bridge location` 标记的配置，
再用该 profile 的 pnpm 移除同名包。官方 CLI 登录保持独立。

## 发布与授权

插件源码采用 MIT 协议。发布包包含源码和安装脚本，不包含官方 CLI 可执行文件、
用户凭据、会话或本机配置。Meridian 和官方 CLI 的授权信息见
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

这是社区插件，与 Google、DeepSeek 无隶属关系。桥接固定使用 Meridian 1.93.0
及 agy 1.5.10；升级任一组件后需要重新做真实账号和工具调用验收。
