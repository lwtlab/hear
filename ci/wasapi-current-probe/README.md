# Current WASAPI comparison

Same scoped signal probe as [the legacy-version probe](../wasapi-probe/README.md), using pinned wasapi 0.26.0 and the equivalent shared event-driven mode. It isolates the library version without changing the application dependency. This does not establish a production migration or compatibility decision. Use only a verified dedicated sample-player PID; never capture another application or the default output.

API references: [AudioClient](https://docs.rs/wasapi/0.26.0/wasapi/struct.AudioClient.html), [StreamMode](https://docs.rs/wasapi/0.26.0/wasapi/enum.StreamMode.html).


The additional `hear-wasapi-format-probe` takes a verified QA player PID, rate (44100/48000), type (f32/i16), structure (ex/ext) and resampling quality (high/default). It reads six seconds of only that process tree, handling SILENT flags without dereferencing an absent buffer. This compares Win32 buffer/format negotiation with the wrapper, including [Microsoft's PCM16 WAVEFORMATEX example](https://github.com/microsoft/Windows-classic-samples/blob/main/Samples/ApplicationLoopback/cpp/LoopbackCapture.cpp). It writes numeric signal metrics, not captured audio. Use only a verified dedicated player PID; no default endpoint or exclude-tree capture.
