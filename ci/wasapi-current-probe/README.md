# Current WASAPI comparison

Same scoped signal probe as [the legacy-version probe](../wasapi-probe/README.md), using pinned wasapi 0.26.0 and the equivalent shared event-driven mode. It isolates the library version without changing the application dependency. This does not establish a production migration or compatibility decision. Use only a verified dedicated sample-player PID; never capture another application or the default output.

API references: [AudioClient](https://docs.rs/wasapi/0.26.0/wasapi/struct.AudioClient.html), [StreamMode](https://docs.rs/wasapi/0.26.0/wasapi/enum.StreamMode.html).
