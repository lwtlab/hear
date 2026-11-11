# Optional Unix source-catalog qualification

`cross-platform-probe.yml` accepts `target=source-unix` as an additional, explicitly source-only scope.
The original `probe` job and its default target/options are unchanged. Reader's complete 33-task
receipt, managed push gates and required-check policy are unchanged. Product change selection is
still shadow-only.

Dispatch with a clean, pushed, reviewed full monorepo source SHA and an independently reviewed
public workflow ref:

```sh
gh workflow run cross-platform-probe.yml --repo lwtlab/hear --ref <reviewed-workflow-ref> \
  -f source_ref=<full-private-SHA> -f target=source-unix \
  -f native_check=false -f functional_runtime=false -f reuse_native=false \
  -f reuse_linux_runtime=false -f windows_owned_signal=false
```

This requires a source with `scripts/verify-hear.mjs`. Historical app/core pairs and default source
fallbacks are not accepted. The two hosted jobs run Linux x64 and macOS arm64, frozen dependency
installation and the actual shared `hear-tools → hear-types → hear-unit` scope. Each job has its
own checkout, data, process ownership and source-run lock. Source-configured test overrides follow
the private executor's explicit default-source policy; this workflow does not run model/audio opt-ins.

The public collector independently pins the reviewed source policy, task graph and contract hashes.
It checks source/run/workflow/attempt/platform identity, stable clean inputs, the complete task set,
dependency/exit/timing outcomes and the actual source-step conclusion. Private task-definition changes
require separate public review before updating these pins. Failed or incomplete reports cannot pass.

`hear-source-receipt-<platform>-<run>-<attempt>` contains only bounded metadata and task ID/status/
durations. `hear-source-encrypted-...` retains authenticated encrypted logs and the exact private
summary bytes for seven days. No private command output, paths, source bytes, models, UI screenshots
or user evidence are public. Independently validate artifact ZIP digests, authenticated decryption,
the summary digest and recomputed result before qualifying a run.

Preparation timing starts after public checkout/Node setup, at explicit scope validation, and ends
at the private source driver's start. It includes private checkout and source dependency preparation,
not runner allocation or the earlier public setup. Source timing is the driver's complete measured
duration, including its source checks and cleanup. These figures do not establish a speedup.

Native compilation, scripted GUI, genuine model inference, signed installation/upgrade/uninstall and
physical/system audio remain `NOT_RUN` in this source-only receipt. Use their separately qualified
workflows and candidates; a source-only success never substitutes for them. No Release, website
deployment or selected-product required check is enabled by this optional target.
