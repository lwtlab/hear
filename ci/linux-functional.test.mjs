import assert from "node:assert/strict";
import { test } from "node:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  modelSpecs,
  readyAudioSource,
  pcmMetrics,
  summarize,
  validateRawBinding,
} from "./linux-model-audio.mjs";
import { approvedCandidate, replayInput } from "./linux-install.mjs";
import { cdp, validateListener, stableProcessSnapshot } from "./linux-cdp.mjs";
const hash = (value) => createHash("sha256").update(value).digest("hex"),
  binding = { workflow: "a".repeat(40), run: 12, attempt: 1 };
const envelope = (mode) => ({
  source: approvedCandidate.source,
  build: approvedCandidate,
  qa: binding,
  executionRunId: `linux-${mode}-12345678-1234-1234-1234-123456789abc`,
});
const tiny = {
  bytes: modelSpecs["tiny.en"].sizeBytes,
  ino: 21,
  sha256: modelSpecs["tiny.en"].sha256,
};
const validModels = () => ({
  kind: "original-linux-model-controls",
  status: "PASS",
  ...envelope("models"),
  models: modelSpecs,
  preservation: Array.from({ length: 6 }, () => ({
    tiny: { ...tiny },
    selection: { activeModelId: "tiny.en", activeFileModelId: "tiny.en" },
  })),
  selfTests: Array.from({ length: 5 }, () => ({
    ok: true,
    text: "thousands of miles",
    textSha256: hash("thousands of miles"),
  })),
  fileRecording: { segments: [{ text: "thousands of miles" }] },
  controls: [
    { id: "first-download", status: "PASS", seeded: false, model: { ...tiny } },
    {
      id: "cancel",
      status: "PASS",
      partialBytes: 9 * 1024 * 1024,
      cancelled: true,
      lateRecreations: 0,
    },
    {
      id: "interrupt",
      status: "PASS",
      signal: "SIGKILL",
      partialBytes: 9 * 1024 * 1024,
      partialInode: 42,
      prefixSha256: "b".repeat(64),
    },
    {
      id: "resume",
      status: "PASS",
      sameInodeAndPrefix: true,
      minObservedPartialBytes: 9 * 1024 * 1024,
      samples: 3,
      installed: {
        bytes: modelSpecs.base.sizeBytes,
        sha256: modelSpecs.base.sha256,
        ino: 42,
      },
      installedPrefixSha256: "b".repeat(64),
    },
    {
      id: "corrupt-repair",
      status: "PASS",
      rejectedCorrupt: true,
      repairedSha256: modelSpecs.base.sha256,
    },
    {
      id: "reopen",
      status: "PASS",
      fileSavedAndReopened: true,
      selfTests: true,
      segmentsSha256: hash(JSON.stringify([{ text: "thousands of miles" }])),
    },
  ],
  tinyPreserved: true,
  modelSelectionPreserved: true,
  cleanup: { noOwnedLiveProcesses: true },
});
const validAudio = () => ({
  kind: "original-linux-owned-audio-controls",
  status: "PASS",
  ...envelope("audio"),
  model: modelSpecs["tiny.en"],
  modelBefore: { ...tiny },
  modelAfter: { ...tiny },
  privateServerOnly: true,
  physicalAudio: false,
  sampleSha256:
    "1577c1b3a7b62d24513c94bacca2e431555b5a1e0f4d43af235bf3296db87c67",
  controls: [
    {
      id: "signal-save-reopen",
      status: "PASS",
      segments: 2,
      saved: { bytes: 1234, sha256: "a".repeat(64) },
      pcm: { frames: 32000, peak: 0.2, rms: 0.01, sha256: "b".repeat(64) },
      reopened: true,
    },
    {
      id: "selected-output-disappearance",
      status: "PASS",
      error: "system-audio-unavailable",
      remainingCaptureStreams: 0,
      defaultUnchanged: true,
      selectionRetained: true,
      postRemovalWaitMs: 500,
    },
  ],
  cleanup: { noOwnedLiveProcesses: true, privateServerStopped: true },
});
test("complete exact-source model controls qualify; missing coverage, drift and borrowed raw identities fail", () => {
  assert.equal(summarize(validModels(), binding).status, "PASS");
  for (const change of [
    (r) => r.controls.pop(),
    (r) => (r.controls[0].seeded = true),
    (r) => (r.controls[1].lateRecreations = 1),
    (r) => (r.controls[3].installed.ino = 24),
    (r) => (r.controls[3].installedPrefixSha256 = "c".repeat(64)),
    (r) => (r.controls[4].rejectedCorrupt = false),
    (r) => (r.preservation[1].tiny.ino = 22),
    (r) => (r.preservation[2].selection.activeFileModelId = "base"),
    (r) => (r.selfTests[1].text = "silence"),
    (r) => (r.fileRecording.segments = [{ text: "silence" }]),
    (r) => (r.cleanup.noOwnedLiveProcesses = false),
    (r) => (r.qa = { ...binding, run: 11 }),
    (r) => (r.executionRunId = r.executionRunId.replace("models", "audio")),
  ]) {
    const raw = structuredClone(validModels());
    change(raw);
    assert.throws(() => summarize(raw, binding));
  }
});
test("owned output requires saved signal, stable model, reopening, source-loss refusal and complete cleanup", () => {
  assert.equal(summarize(validAudio(), binding).status, "PASS");
  for (const change of [
    (r) => (r.controls[0].pcm.rms = 0),
    (r) => (r.controls[0].saved.sha256 = "bad"),
    (r) => (r.controls[0].reopened = false),
    (r) => (r.modelAfter.ino = 22),
    (r) => (r.controls[1].remainingCaptureStreams = 1),
    (r) => (r.controls[1].selectionRetained = false),
    (r) => (r.controls[1].defaultUnchanged = false),
    (r) => (r.cleanup.privateServerStopped = false),
    (r) => (r.physicalAudio = true),
    (r) => (r.privateServerOnly = false),
    (r) => (r.source = "0".repeat(40)),
  ]) {
    const raw = structuredClone(validAudio());
    change(raw);
    assert.throws(() => summarize(raw, binding));
  }
});
test("actual PCM metrics reject silent, partial and non-finite saved samples", () => {
  const pcm = Buffer.alloc(32000 * 4);
  for (let i = 0; i < 32000; i++)
    pcm.writeFloatLE(Math.sin(i / 20) * 0.02, i * 4);
  const result = pcmMetrics(pcm);
  assert.equal(result.frames, 32000);
  assert(result.peak > 0.01 && result.rms > 0.001);
  assert.equal(pcmMetrics(Buffer.alloc(8)).peak, 0);
  for (const bad of [
    Buffer.alloc(0),
    Buffer.alloc(3),
    Buffer.from([0, 0, 192, 127]),
  ])
    assert.throws(() => pcmMetrics(bad));
});
test("CDP listener identity rejects foreign PIDs, shared owners and wildcard addresses", () => {
  assert(validateListener("p123\nn127.0.0.1:9876\n", 9876, 123));
  for (const text of [
    "p124\nn127.0.0.1:9876",
    "p123\nn*:9876",
    "p123\nn0.0.0.0:9876",
    "p123\nn127.0.0.1:9876\np124\nn127.0.0.1:9876",
  ])
    assert.throws(() => validateListener(text, 9876, 123));
});
test("CDP correlates interleaved replies and propagates protocol and closure failures", async (t) => {
  const original = globalThis.WebSocket;
  let socket;
  class FakeSocket extends EventTarget {
    constructor() {
      super();
      socket = this;
      this.readyState = 0;
      this.requests = [];
      queueMicrotask(() => {
        this.readyState = 1;
        this.dispatchEvent(new Event("open"));
      });
    }
    send(text) {
      this.requests.push(JSON.parse(text));
    }
    reply(message) {
      this.dispatchEvent(
        new MessageEvent("message", { data: JSON.stringify(message) }),
      );
    }
    close() {
      this.readyState = 3;
      this.dispatchEvent(new Event("close"));
    }
  }
  globalThis.WebSocket = FakeSocket;
  t.after(() => {
    globalThis.WebSocket = original;
  });
  const client = await cdp("ws://127.0.0.1:1234/devtools/test"),
    a = client.call("A"),
    b = client.call("B");
  socket.reply({ id: socket.requests[1].id, result: { value: 2 } });
  socket.reply({ id: socket.requests[0].id, result: { value: 1 } });
  assert.deepEqual(await Promise.all([a, b]), [{ value: 1 }, { value: 2 }]);
  const failed = client.call("Bad"),
    rejected = assert.rejects(failed, /request failed/);
  socket.reply({ id: socket.requests.at(-1).id, error: { message: "denied" } });
  await rejected;
  const pending = client.call("Pending"),
    closed = assert.rejects(pending, /transport closed/);
  client.close();
  await closed;
  await assert.rejects(cdp("ws://localhost:1234/devtools/test"));
});
test("functional workflow consumes the same candidate and seals failures before owned removal", () => {
  assert.equal(
    replayInput({
      BUILD_MODE: "functional",
      SOURCE_REF: approvedCandidate.source,
    }).sourceRef,
    approvedCandidate.source,
  );
  assert.throws(() =>
    replayInput({ BUILD_MODE: "functional", SOURCE_REF: "main" }),
  );
  const text = readFileSync(
      new URL("../.github/workflows/desktop-candidates.yml", import.meta.url),
      "utf8",
    ),
    job = text.split("\n  linux-installed:\n")[1];
  assert(job.includes("inputs.mode == 'functional'"));
  assert(job.includes("node ci/linux-model-audio.mjs seal"));
  assert(
    job.indexOf("Encrypt typed functional diagnostics") <
      job.indexOf("Remove only this job's owned installation"),
  );
  assert(job.includes("if: always() && inputs.mode"));
  assert(!job.includes("--no-sandbox"));
});

test("complete process snapshots retry vanished Chromium helpers, recheck owner and reject other failures", async () => {
  let reads = 0,
    owners = 0;
  const value = await stableProcessSnapshot(
    () => owners++,
    () => {
      if (reads++ === 0)
        throw Object.assign(new Error("Captured renderer /proc exit race"), {
          code: "ENOENT",
        });
      return { browser: 123, renderers: [124] };
    },
  );
  assert.deepEqual(value, { browser: 123, renderers: [124] });
  assert.equal(owners, 2);
  await assert.rejects(
    stableProcessSnapshot(
      () => {},
      () => {
        throw Object.assign(new Error("permission denied"), { code: "EACCES" });
      },
    ),
    /permission denied/,
  );
  await assert.rejects(
    stableProcessSnapshot(
      () => {
        throw new Error("owner changed");
      },
      () => ({}),
    ),
    /owner changed/,
  );
});

test("audio restart waits for verified model and rejects unsafe settings before capture", async () => {
  let release,
    checked = 0;
  const ready = new Promise((resolve) => {
    release = resolve;
  });
  const cfg = {
    mic: { enabled: false },
    system: {
      enabled: true,
      source: { kind: "output", outputId: "hear_qa_owned" },
    },
  };
  const pending = readyAudioSource(
    () => ready,
    async () => {
      checked++;
      return cfg;
    },
    "hear_qa_owned",
  );
  assert.equal(checked, 0);
  release();
  assert.deepEqual(await pending, cfg);
  assert.equal(checked, 1);
  for (const changed of [
    { ...cfg, mic: { enabled: true } },
    { ...cfg, system: { enabled: true, source: { kind: "system" } } },
    {
      ...cfg,
      system: {
        enabled: true,
        source: { kind: "output", outputId: "unowned" },
      },
    },
  ])
    await assert.rejects(
      readyAudioSource(
        async () => {},
        async () => changed,
        "hear_qa_owned",
      ),
    );
});
