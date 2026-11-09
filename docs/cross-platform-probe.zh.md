> 新开发源码位于私有 `lwtlab/lwt-core/apps/hear`。三端工作流可用 `source_ref=<父仓完整SHA>`
> 代替历史 `app_ref` / `core_ref`，两种输入不能混用。公开 Hear 仓库负责工作流和诊断产物；
> 应用和 core 使用同一次私有 checkout。旧来源复验继续使用下文的历史成对输入。

# Hear 三端可行性探测

`cross-platform-probe.yml` 分别在 Ubuntu 22.04 x64、Windows 2025 x64、macOS 26 arm64 检查固定 app/core 源码。它不发布版本：Rust 失败以 continue-on-error 保留，随后尝试构建隔离名称的诊断运行目录，报告每一层的实际结果。

```sh
gh workflow run cross-platform-probe.yml --repo lwtlab/hear --ref <reviewed-workflow-ref> \
  -f app_ref=<full-app-sha> -f core_ref=<full-core-sha> \
  -f target=all -f native_check=true
```

单端重跑可将 target 设为 win32-x64、linux-x64、darwin-arm64。只排查归档/打包时可用 native_check=false，清单会明确记录 skipped；不能将这种重跑当成新的原生编译成功。`ci/verify-platforms` 分支的 push 使用已审阅的 HEAR_VERIFY_APP_SHA/HEAR_VERIFY_CORE_SHA 变量并检查全部平台。

每个成功归档的产物是 `hear-probe-<platform>-<run-id>`，内含 AIHearProbe tar.gz 和 probe.json（app/core/workflow SHA、阶段结果、文件大小与 SHA-256）。加密日志为 `hear-probe-encrypted-<platform>-<run-id>`；仍使用 `ci/decrypt-log.mjs` 和主控私钥解密。两类产物保留 7 天。下载和传到目标机后分别核对摘要。

诊断包使用原有编译后的产品主进程/renderer 与独立产品名/资料目录，按目标平台保留 uiohook。macOS 使用无 hardened runtime 的 ad-hoc 诊断配置；它不证明正式 Developer ID、公证或分发安全提示。它也不运行正式原生 daemon staging，cargo check 不生成 N-API .node，因此诊断包可能缺少 core/引擎；这些缺件必须写进实机报告。

`platform-probe-smoke.mjs` 从应用仓提供，可连接目标机已有 Playwright 工具。它只检查隔离身份、首启向导、模型目录、core 导出和自有窗口截图，未录音、未启用假转录成功。必须在旁边保留一次无调试参数的普通启动记录：Playwright Electron 会加入调试参数，在 Linux 还会自动加入 --no-sandbox。脚本记录 effectiveArguments 与 sandboxDisabled，不能用其 GUI PASS 覆盖普通启动的 FAIL。

本轮原生 baseline：run 41839075231；补齐 Linux 构建头文件后的诊断打包：41839761505；修复 Windows tar 盘符归档后的单端复验：41840522181。三端类型/前端构建通过，Windows/macOS cargo check 通过，Linux 因 whisper_cli 平台条件编译失败。GUI 或归档成功不等于产品已经能转录，也不等于有正式安装包。
