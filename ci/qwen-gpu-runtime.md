# Reusable Qwen GPU runtime

`qwen-gpu-runtime.yml` compiles only the shared ASR runtime in public CI. Windows/Linux machines perform native GPU, application and audio validation; they do not rebuild the runtime. CI receipts mark GPU execution **NOT_RUN**.

Targets initially match the available validation hardware: Windows x64 CUDA SM89 (RTX4060), Linux x64 CUDA SM61 (GTX1080Ti), and macOS arm64 Metal. These profiles are not a universal GPU compatibility claim. Dispatch with a reviewed full `source_ref` and target; the dedicated `QWEN_NATIVE_SOURCE_SHA` variable supplies the push/default source.

The recipe key binds the actual upstream gitlink (which must equal the model lock), the complete tracked native adapter tree, build/bundle scripts, GPU backend/architecture, locked public SDK/tool archives and the complete public execution policy. Unknown native inputs fail closed. UI-only source changes retain the recipe; native or policy changes invalidate it.

The separate build key retains the original compiler identity and runner image. Reuse never relabels a native binary with a new source SHA: producer source/workflow/run/attempt remain intact, alongside the consumer source and exact native-input compatibility proof. It does not transfer signed-package, model-quality or live-audio acceptance.

Native payloads are immutable Actions artifacts with 90-day retention. A consumer verifies the GitHub ZIP digest, same-repository successful producer attempt, complete producer policy Git blobs, source recipe and every payload byte/license. Expiry triggers a new build with its own identity. Invalid provenance is an error, not permission to fall back to CPU/local compilation. `force_build` deliberately makes a new, separately recorded artifact.

Only checksummed public vendor archives enter Actions cache. Private source, object files, compiler logs, user data and model weights are excluded. Native payloads contain explicit executable/library inventory, licenses and sanitized receipts; raw build configuration and private output remain in short-lived encrypted diagnostics.

SDK extraction allows at most 2 GiB per member and 4 GiB per archive after the locked SHA/size checks: CUDA 12.8.1's Linux SDK includes a 1,089,740,204-byte static cuBLAS library. Static SDK archives are not shipped. Runtime transport retains the 1 GiB member limit and payload validation retains its 2 GiB total limit.

An application candidate may use `QWEN_NATIVE_TARGET=<profile> node ci/native-private-step.mjs consume node "$PWD/ci/qwen-gpu-runtime.mjs" consume` after exact private checkout. This restores a verified portable runtime to `.llama-build/upstream-<backend>`; if no valid artifact exists, run the native producer first. Application source gates, NAPI source identity, signing and local GPU acceptance remain independent. The existing desktop candidate callers are updated only after the first native producer has qualified.
