# Original Linux installed replay

`target=linux-x64, mode=installed` consumes the single reviewed source build pinned in
`approvedCandidate`, never the diagnostic deb or a newly compiled replacement. The
private `source_ref` must match that build. A non-successful, expired, wrong-attempt,
wrong-workflow or mismatched artifact cannot reach root installation.

Both receipt and package ZIPs are checked against GitHub's authenticated artifact
digests. The two receipt files must match byte-for-byte; the deb's own digest and
complete required payload are independently checked again without extraction.
Only this job's pristine package/path can be installed. Root package installation
uses the standard deb hooks; no global sandbox setting is relaxed.

The ordinary launch uses a fresh task-owned user-data directory with both audio inputs
disabled, a separate Xvfb server, no debugger, no sandbox flags and native Ctrl+Q. The
private source's Linux observer and flag parser are pinned by exact hash. A narrow,
checked adaptation replaces only the diagnostic package/path identity and adds owned
profile arguments and environment isolation. It does not alter the product bundle.
Original/derived observer and runtime bytes are bound in the receipt. The common
owned-process runtime handles timeout, interruption, inherited pipes and cleanup.

Installed files must match the original deb payload, including Linux native hooks.
Success requires root-owned installation, scoped AppArmor entry, current strict
user-namespace setting, an owned visible window, sandboxed renderer flags, successful
native Quit, dead owned PIDs and unchanged payload/tools. Raw observations and logs
stay private/encrypted; only bounded identity/status/timing and hashes are published.

The job removes only its own newly installed package on completion or failure.
That cleanup is not uninstall/data-retention acceptance. The result is GitHub VM
ordinary-window/sandbox/native-Quit coverage, not physical hardware, model inference,
save dialogs, upgrade, model recovery, signed repository or system-audio acceptance.
The source build receipt's NOT_RUN fields are not rewritten; the replay has its own
public workflow/run/attempt and nests the original build identity.
