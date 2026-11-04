# Hear 公开桌面 CI 操作

此工作流在公开 `lwtlab/hear` 运行，按固定 SHA 读取私有 Hear2 和 lwt-core。官网继续使用原有 Pages 流程；桌面候选仅存为 Actions artifacts，不修改正式 Release 和更新 feed。

## 模式与权限

| 模式 | 执行内容 | 不包含 |
| --- | --- | --- |
| checks | 依赖契约、类型、确定性单测、原生 core 构建、开发构建脚本化 Electron E2E | 安装包、真实采音与模型验收 |
| candidate | checks 加原生输入源码构建和 macOS arm64 未签名 DMG/ZIP | 签名、公证、发布、原包完整 UI 和真实音频验收 |

在公开仓库配置以下 Secrets。SSH deploy keys 分别只读授权到对应私有仓库，不授予写权限；不要复用官网构建凭据。

- `HEAR_APP_SOURCE_SSH_KEY`：读取 XUJiahua/lwt-app-hear2。
- `HEAR_CORE_SOURCE_SSH_KEY`：读取 lwtlab/lwt-core。
- `HEAR_LOG_PUBLIC_KEY`：RSA 日志加密公钥。私钥仅保留主控受限目录，不上传 GitHub。

父仓库的 hear-integration 还需要 `HEAR_APP_SOURCE_SSH_KEY`，仅为拉取其固定的私有 submodule。公开 PR 基础设施测试不使用任何私有凭据，也不运行 PR 中的私有构建。仅维护者手动调度私有源码构建；审阅工作流和私有源码后再选择 ref。

## 固定版本调度

下面占位值必须替换为已推送的完整 40 位小写 SHA。工作流 ref 使用已审阅的分支或标签，下载后核对实际 workflow SHA。

```sh
gh workflow run desktop-candidates.yml --repo lwtlab/hear --ref <workflow-ref> \
  -f app_ref=<app-sha> -f core_ref=<core-sha> -f mode=checks
gh run list --repo lwtlab/hear --workflow desktop-candidates.yml --limit 5
gh run view <run-id> --repo lwtlab/hear
gh run watch <run-id> --repo lwtlab/hear --exit-status
```

先跑 checks，再选择同一对 SHA、`mode=candidate`。原生构建需要 macOS arm64 runner、完整 Xcode/Metal 工具链，构建期间下载锁定依赖，超时失败也必须保留失败记录。checks 从锁定源码构建原生 core（批量导出仍依赖它），candidate 继续构建其余 daemon。candidate 不复用本机未记录的原生产物。此正式候选工作流不提供 Windows/Linux/Intel 目标；三端诊断运行时使用下节独立工作流。

## 三端诊断与真实文件转录

`cross-platform-probe.yml` 支持 `all`、`win32-x64`、`linux-x64`、`darwin-arm64`。它生成独立 AIHearProbe 资料目录的诊断运行目录，Linux 功能模式另产出独立诊断 deb，正式安装器与签名仍不包含在内。

```sh
gh workflow run cross-platform-probe.yml --repo lwtlab/hear --ref <workflow-ref> \
  -f app_ref=<app-sha> -f core_ref=<core-sha> -f target=all \
  -F native_check=true -F functional_runtime=true -F reuse_native=false \
  -f file_models=whisper-and-sensevoice
```

`functional_runtime=true` 实际构建并加载 `.node`、从锁定源码编译 CPU ASR 和 LGPL FFmpeg，随后验证批准样本的真实文件识别、保存重开和 TXT/SRT/VTT 导出。`functional_runtime=false` 仅用于前端/打包可行性检查，不能作为识别成功证据。默认仍会检查 `cargo check`，其失败通过 continue-on-error 保留；类型和文件功能结果必须分别核对。真实功能阶段失败会令 job 失败。`file_models=whisper-and-sensevoice` 同时验证中文 SenseVoice/VAD；独立结果门禁拒绝仅用英文成功代替中文覆盖。Windows 诊断进程 PATH 只保留系统目录，避免构建机已安装的 DLL 掩盖漏打包；真正的干净系统检查仍是独立门禁。

Linux 功能模式使用 Ubuntu 24.04，标准 deb 安装到 `/opt/AIHearProbe`，由 electron-builder 的安装/卸载脚本维护仅匹配自身路径的 AppArmor profile。CI 显式保持 `kernel.apparmor_restrict_unprivileged_userns=1`，先以普通用户无参数启动，检查原生可见窗口、应用 profile、renderer 的 Seccomp=2 / NoNewPrivs=1，再以 `chromiumSandbox:true` 运行文件转录。缺少 AppArmor、错误 profile、禁用沙箱或没有普通启动证据都必须失败；安装与识别成功分别记录。该安装器需要管理员安装权限，不代表 AppImage 可免安装启动，也不代表 Ubuntu 22.04/其他发行版已验收。deb 的摘要和字节数在 `probe.json.installers` 中，普通启动在 `file-functional/linux-installed/ordinary-launch.json`。

Linux 安装器排障可显式选择 `target=linux-x64`、`functional_runtime=true`、`native_check=false`、`reuse_linux_runtime=true`。该模式从 `manifests/linux-runtime-probes.json` 恢复已审阅且 core 完全一致的旧运行目录，逐项校验 artifact ZIP、原 app/core/workflow/run、tar 摘要与字节数；过期或不符直接失败。`app_ref` 在此模式指新安装/QA 脚本源码，不能当作新二进制来源。产物的 `appRef` 保留原应用来源，`qaAppRef`、`workflowRef` 和 `runtimeOrigin` 分开记录本轮脚本、封装工作流和旧运行来源，原生编译标为 skipped。它只加快安装与沙箱复验，不替代正式源码构建。即使普通启动失败，也归档已生成的运行包、安装包和受控 QA JSON，便于定位；私有启动 stderr 仍只进加密日志。

Windows 引擎重试可显式选择 `target=win32-x64`、`native_check=false`、`functional_runtime=true`、`reuse_native=true`。它只复用 `manifests/native-probes.json` 中维护者已审核的精确 core/platform 对应物，校验原 artifact ZIP SHA-256 后重新加载导出。不同 core、架构或过期产物会失败；需要重新构建或审核新绑定。`probe.json` 分开记录原 native run、工作流、摘要、当前跳过的检查和实际复用结果，不能写成当前 run 重新编译成功。

```sh
gh run download <run-id> --repo lwtlab/hear \
  --name hear-probe-<platform>-<run-id> --dir <new-probe-dir>
gh run download <run-id> --repo lwtlab/hear \
  --name hear-probe-encrypted-<platform>-<run-id> --dir <new-log-dir>
node ci/decrypt-log.mjs <new-log-dir>/build-log.enc.json <private-key.pem> <new-output.log>
```

诊断档案、独立原生模块和加密日志均保留 7 天。核对 artifact ID/digest，再核对 `probe.json` 的 app/core/workflow SHA、平台、tar SHA-256 和字节数；有 `file-functional/` 时一并核对结果和截图。解压要拒绝越界路径。不要只凭打包 job 的最终颜色判断全部能力。所有私有步骤仍使用加密日志。

将核验过的目录传到实机后，从私有应用仓使用 `scripts/platform-functional-smoke.mjs` 复用同一文件流程。模型权重先核对目录固定的摘要；可用获准的内置英文或中文样本，不采集用户会议。该脚本重定向原生保存框，使用产品 IPC 和真实原生推理，不能算人工操作文件选择框。

Windows SSH 服务会话不是桌面，需以已登录用户 Interactive/Limited 任务启动。任务主体从 `WindowsIdentity.GetCurrent().User.Value` 获取 SID；不要依赖 SSH 环境里的 USERDOMAIN/USERNAME 拼接，否则可能无法映射账户。Linux 需定位实际 Wayland/X11 会话；Playwright Electron 可能自动加 `--no-sandbox`。保存有效参数，另跑无调试参数的普通启动；沙箱失败保持失败，不修改主机安全策略或以调试模式替代交付验收。详情见私有应用仓的 `docs/CROSS-PLATFORM-TRANSCRIPTION.md` 与父仓库 QA 记录。

## 候选下载与验收

```sh
gh run download <run-id> --repo lwtlab/hear \
  --name hear-darwin-arm64-<run-id>-<attempt> --dir <new-candidate-dir>
```

核对运行仓库、成功结论、workflow SHA、run attempt、artifact ID/digest，再核对 `candidate.json` 的 app/core SHA、版本、架构和每个附件的 SHA-256/字节数。产物保留 14 天；加密日志保留 7 天。`candidate.json` 明确标注未签名，以及尚未运行的原包 UI、真实音频和其他平台检查。

只上传顶层 AIHear DMG/ZIP 和来源清单，不上传工作目录、源码、E2E 截图或明文日志。不把构建成功写成安装包完整验收通过；下载到主控后，使用隔离资料和普通启动入口验证原包，再检查原生控件、模型、真实文件推理、采音、退出清理、升级与资料保留。签名/公证与 App Store 仍遵守应用仓原有发布流程。

## 失败日志

私有步骤的 stdout/stderr 仅写 runner 临时文件，不回显到公开控制台。构建前先验证加密公钥；结束时使用 RSA-OAEP-SHA256 与 AES-256-GCM 密封并删除明文。

```sh
gh run download <run-id> --repo lwtlab/hear \
  --name hear-encrypted-log-<run-id>-<attempt> --dir <new-log-dir>
node ci/decrypt-log.mjs <new-log-dir>/build-log.enc.json <private-key.pem> <new-output.log>
```

在公开仓库 checkout 中执行解密；输出文件必须不存在，权限为 0600。不要把明文提交到公开仓库或公开 issue。解密失败要核对私钥与运行使用的公钥是否配对。

重跑整个 run 会沿用原输入；修改 app/core 需要新调度并记录新 run。平台尚未实现时记录 NOT RUN/BLOCKED，不用 demo 或禁用沙箱的开发启动替代产品验证。

## 新工作流合并前验证

工作流尚未进入默认分支时，GitHub 可能拒绝按文件名手动调度。维护者可先设置 `HEAR_VERIFY_APP_SHA`、`HEAR_VERIFY_CORE_SHA` 两个仓库变量（均为已审阅的完整 SHA），再将已审阅的工作流提交推送到公开仓库的 `ci/verify-macos` 分支。该分支的 push 仅执行 checks，不能产生候选或发布；普通分支和外部 PR 不执行私有构建。记录此次运行的实际源码与工作流 SHA。它用于验证新工作流，无需提前合并或修改官网 main。
