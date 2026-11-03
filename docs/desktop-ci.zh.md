# Hear 公开桌面 CI 操作

此工作流在公开 `lwtlab/hear` 运行，按固定 SHA 读取私有 Hear2 和 lwt-core。官网继续使用原有 Pages 流程；桌面候选仅存为 Actions artifacts，不修改正式 Release 和更新 feed。

## 模式与权限

| 模式 | 执行内容 | 不包含 |
| --- | --- | --- |
| checks | 依赖契约、类型、单测、开发构建脚本化 Electron E2E | 安装包、真实采音与模型验收 |
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

先跑 checks，再选择同一对 SHA、`mode=candidate`。原生构建需要 macOS arm64 runner、完整 Xcode/Metal 工具链，构建期间下载锁定依赖，超时失败也必须保留失败记录。candidate 不缓存或复用本机未记录的原生产物。当前不提供 Windows/Linux/Intel 目标。

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
