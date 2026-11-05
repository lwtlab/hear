# Scoped WASAPI signal diagnostic

Build on Windows with `cargo build --release --locked`. This is a diagnostic tool, not an application binary or a release asset.

Pass the **verified PID of your own dedicated sample player**, channel count (`1` or `2`) and event lifetime (`keep` or `drop`). It measures eight seconds of application-loopback PCM and prints only sample count, peak and RMS. It writes no audio and never selects the default endpoint or discovers applications. Never target another application's PID. Use only approved audio in the dedicated player.

`drop` reproduces the legacy capture helper's event-handle lifetime; `keep` holds the event through stream stop. Channel count and lifetime should be varied separately. A successful process exit with zero peak is a failed signal test.
