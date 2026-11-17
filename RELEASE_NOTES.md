Use a Google AI subscription in DeepSeek Harness through the official signed-in Antigravity CLI.

### Windows quick start

1. Download `dsh-gemini-subscription-0.1.1-windows-x64.zip` below and extract it.
2. Fully quit DSH Desktop and run `install.ps1` in PowerShell.
3. Run `gemini.ps1 login` to sign in with your own Google account, then `gemini.ps1 doctor`.
4. Restart DSH and select a model under **Gemini · Google AI 订阅**.

Also included: the standard `.tgz` plugin package and `SHA256SUMS.txt`.

### Compatibility and validation

- Verified: Windows x64, DSH Desktop 0.2.2-rc.3, Node.js 24.22.1, official agy 1.5.10 and Meridian 1.93.0.
- Seven protocol/runtime tests passed; real Gemini streamed output and a full DSH client-tool round trip passed.
- Account models and usage are read from the official CLI. Model availability varies by account.
- The package does not contain Google tokens, conversation history, local configuration or the official CLI executable.
- Meridian's exact-version gate is locally patched for the verified agy version. Native browser and subagent execution remain disabled. See the README and third-party notices for limitations.

### 中文

下载 Windows ZIP 解压，完全退出 DSH，运行 `install.ps1`；随后运行 `gemini.ps1 login` 和 `gemini.ps1 doctor`，重启 DSH 即可选择订阅模型。安装后可删除解压目录。登录和账号验证需要用户自行完成；额外付费额度必须保持关闭。

源码采用 MIT 协议；本插件与 Google、DeepSeek 无隶属关系。
