// Exact original installed AIHear; renderer instrumentation only, with task-owned data.
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import {
  appendFileSync,
  closeSync,
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readSync,
  realpathSync,
  statSync,
  writeFileSync,
  writeSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { approvedCandidate, verifyInstallInput } from "./linux-install.mjs";
import {
  cdp,
  freePort,
  listenerOwner,
  pause,
  processIdentity,
  renderer,
  requireOwner,
  sandbox,
  until,
} from "./linux-cdp.mjs";
import { encryptLog } from "./log-crypto.mjs";
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex"),
  sha = (file) => hash(readFileSync(file)),
  json = (file) => JSON.parse(readFileSync(file));
const receiptSha =
    "5bf016e8726ec4ad067cc1309a2c28b18329dc4dd7341358d667760eff75bfcf",
  sampleSha =
    "1577c1b3a7b62d24513c94bacca2e431555b5a1e0f4d43af235bf3296db87c67";
export const modelSpecs = Object.freeze({
  "tiny.en": {
    id: "tiny.en",
    repo: "ggerganov/whisper.cpp",
    revision: "5359861c739e955e79d9a303bcbc70fb988958b1",
    repoFile: "ggml-tiny.en.bin",
    sizeBytes: 77704715,
    sha256: "921e4cf8686fdd993dcd081a5da5b6c365bfde1162e72b08d75ac75289920b1f",
  },
  base: {
    id: "base",
    repo: "ggerganov/whisper.cpp",
    revision: "5359861c739e955e79d9a303bcbc70fb988958b1",
    repoFile: "ggml-base.bin",
    sizeBytes: 147951465,
    sha256: "60ed5bc3dd14eea856493d334349b405782ddcaf0028d4b5df4088345fba2efe",
  },
});
const executable = "/opt/AIHear/aihear",
  sample = "/opt/AIHear/resources/resources/samples/en.wav";
const tools = () =>
  Object.fromEntries(
    [
      "linux-model-audio.mjs",
      "linux-cdp.mjs",
      "linux-install.mjs",
      "linux-candidate-zip.py",
      "linux-deb-payload.py",
    ].map((name) => [name, sha(join(import.meta.dirname, name))]),
  );
const ownFile = (file) =>
  assert(
    lstatSync(file).isFile() &&
      !lstatSync(file).isSymbolicLink() &&
      realpathSync(file) === resolve(file),
    "Regular owned file required",
  );
const identity = (m) =>
  hash(
    JSON.stringify([
      { path: m.repoFile, sizeBytes: m.sizeBytes, sha256: m.sha256 },
    ]),
  );
function modelFile(profile, m) {
  return join(profile, "models/.versions", m.id, identity(m), m.repoFile);
}
export function pcmMetrics(bytes) {
  assert(bytes.length > 0 && bytes.length % 4 === 0);
  let peak = 0,
    sum = 0;
  for (let i = 0; i < bytes.length; i += 4) {
    const v = bytes.readFloatLE(i);
    assert(Number.isFinite(v));
    peak = Math.max(peak, Math.abs(v));
    sum += v * v;
  }
  return {
    frames: bytes.length / 4,
    sampleRate: 16000,
    peak,
    rms: Math.sqrt(sum / (bytes.length / 4)),
  };
}
export function validateModels(raw) {
  assert.equal(raw.kind, "original-linux-model-controls");
  assert.equal(raw.status, "PASS");
  assert.deepEqual(raw.models, modelSpecs);
  assert.deepEqual(raw.controls[0].model, {
    bytes: modelSpecs["tiny.en"].sizeBytes,
    ino: raw.controls[0].model.ino,
    sha256: modelSpecs["tiny.en"].sha256,
  });
  assert(
    Number.isSafeInteger(raw.controls[0].model.ino) &&
      raw.controls[0].model.ino > 0,
  );
  assert(raw.preservation.length >= 6);
  assert(raw.selfTests.length >= 5);
  for (const test of raw.selfTests) {
    assert.equal(test.ok, true);
    assert.match(test.text, /thousands of miles/i);
    assert.equal(hash(test.text), test.textSha256);
  }
  for (const point of raw.preservation) {
    assert.deepEqual(point.tiny, raw.controls[0].model);
    assert.deepEqual(point.selection, {
      activeModelId: "tiny.en",
      activeFileModelId: "tiny.en",
    });
  }
  assert.deepEqual(
    raw.controls.map((c) => c.id),
    [
      "first-download",
      "cancel",
      "interrupt",
      "resume",
      "corrupt-repair",
      "reopen",
    ],
  );
  assert(raw.controls.every((c) => c.status === "PASS"));
  assert.equal(raw.controls[0].seeded, false);
  assert(
    raw.controls[1].partialBytes >= 8 * 1024 * 1024 &&
      raw.controls[1].cancelled &&
      raw.controls[1].lateRecreations === 0,
  );
  assert.equal(raw.controls[2].signal, "SIGKILL");
  assert(
    raw.controls[2].partialBytes > 0 &&
      raw.controls[2].partialBytes < raw.models.base.sizeBytes,
  );
  assert.equal(raw.controls[3].sameInodeAndPrefix, true);
  assert.equal(raw.controls[3].installed.ino, raw.controls[2].partialInode);
  assert.equal(raw.controls[3].installed.bytes, modelSpecs.base.sizeBytes);
  assert.equal(raw.controls[3].installed.sha256, modelSpecs.base.sha256);
  assert.equal(
    raw.controls[3].installedPrefixSha256,
    raw.controls[2].prefixSha256,
  );
  assert(
    raw.controls[3].samples > 0 &&
      raw.controls[3].minObservedPartialBytes >= raw.controls[2].partialBytes,
  );
  assert.match(
    raw.fileRecording.segments.map((s) => s.text).join(" "),
    /thousands of miles/i,
  );
  assert.equal(
    hash(JSON.stringify(raw.fileRecording.segments)),
    raw.controls[5].segmentsSha256,
  );
  assert.equal(raw.controls[4].rejectedCorrupt, true);
  assert.equal(raw.controls[4].repairedSha256, raw.models.base.sha256);
  assert.equal(raw.controls[5].fileSavedAndReopened, true);
  assert.equal(raw.controls[5].selfTests, true);
  assert.equal(raw.tinyPreserved, true);
  assert.equal(raw.modelSelectionPreserved, true);
  assert.equal(raw.cleanup.noOwnedLiveProcesses, true);
}
export function validateAudio(raw) {
  assert.equal(raw.kind, "original-linux-owned-audio-controls");
  assert.deepEqual(raw.model, modelSpecs["tiny.en"]);
  assert.deepEqual(raw.modelBefore, raw.modelAfter);
  assert.equal(raw.modelBefore.sha256, modelSpecs["tiny.en"].sha256);
  assert.equal(raw.modelBefore.bytes, modelSpecs["tiny.en"].sizeBytes);
  assert.equal(raw.status, "PASS");
  assert.deepEqual(
    raw.controls.map((c) => c.id),
    ["signal-save-reopen", "selected-output-disappearance"],
  );
  assert(raw.controls.every((c) => c.status === "PASS"));
  assert.equal(raw.privateServerOnly, true);
  assert.equal(raw.physicalAudio, false);
  assert.equal(raw.sampleSha256, sampleSha);
  const first = raw.controls[0];
  for (const value of [first.saved.sha256, first.pcm.sha256])
    assert(/^[a-f0-9]{64}$/.test(value));
  assert(
    first.segments > 0 &&
      first.saved.bytes > 0 &&
      first.pcm.frames > 16000 &&
      first.pcm.peak > 0.001 &&
      first.pcm.rms > 0.00001,
  );
  assert.equal(first.reopened, true);
  assert.equal(raw.controls[1].error, "system-audio-unavailable");
  assert.equal(raw.controls[1].remainingCaptureStreams, 0);
  assert.equal(raw.controls[1].defaultUnchanged, true);
  assert.equal(raw.controls[1].selectionRetained, true);
  assert(raw.controls[1].postRemovalWaitMs >= 500);
  assert.equal(raw.cleanup.noOwnedLiveProcesses, true);
  assert.equal(raw.cleanup.privateServerStopped, true);
}
function cleanEnv(ambient) {
  const env = { ...ambient };
  for (const key of Object.keys(env))
    if (
      /^DYLD_|^LD_|^HEAR_|^READER_|TOKEN|SECRET|API_KEY|PASSWORD|CREDENTIAL|^AWS_|^S3_/.test(
        key,
      ) ||
      [
        "NODE_OPTIONS",
        "NODE_PATH",
        "ELECTRON_RUN_AS_NODE",
        "ELECTRON_DISABLE_SANDBOX",
        "ELECTRON_RENDERER_URL",
        "PULSE_SINK",
        "PULSE_SOURCE",
      ].includes(key)
    )
      delete env[key];
  return env;
}
function installed(candidate) {
  for (const [name, value] of Object.entries({
    ...candidate.payload.payload,
    ...candidate.payload.hotkeyPrebuilds,
  })) {
    const file = "/" + name;
    ownFile(file);
    assert.equal(statSync(file).uid, 0);
    assert.equal(sha(file), value.sha256);
  }
  assert.equal(sha(sample), sampleSha);
}
class CandidateSession {
  constructor(profile, directory, env) {
    this.profile = profile;
    this.directory = directory;
    this.env = env;
    this.connections = [];
    this.processes = [];
  }
  async start() {
    this.port = await freePort();
    this.child = spawn(
      executable,
      [
        `--user-data-dir=${this.profile}`,
        `--remote-debugging-port=${this.port}`,
        "--remote-debugging-address=127.0.0.1",
        "--lang=en-US",
      ],
      {
        cwd: this.directory,
        env: cleanEnv(this.env),
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    this.child.on("error", () => {});
    for (const stream of [this.child.stdout, this.child.stderr])
      stream.on("data", (bytes) => {
        const log = join(this.directory, "application.private.log");
        assert(
          (existsSync(log) ? statSync(log).size : 0) + bytes.length <
            16 * 1024 * 1024,
        );
        appendFileSync(log, bytes, { mode: 0o600 });
      });
    await new Promise((resolve, reject) => {
      this.child.once("spawn", resolve);
      this.child.once("error", reject);
    });
    this.owner = processIdentity(this.child.pid);
    requireOwner(this.owner, executable, this.profile);
    await until(() => {
      assert(
        this.child.exitCode === null && !this.child.signalCode,
        "Candidate exited before CDP",
      );
      requireOwner(this.owner, executable, this.profile);
      return listenerOwner(this.port, this.child.pid);
    });
    const endpoint = await (
      await fetch(`http://127.0.0.1:${this.port}/json/version`, {
        signal: AbortSignal.timeout(3000),
      })
    ).json();
    this.browser = await cdp(endpoint.webSocketDebuggerUrl);
    this.connections.push(this.browser);
    const info = (await this.browser.call("SystemInfo.getProcessInfo"))
      .processInfo;
    assert.equal(
      Number(info.find((p) => p.type === "browser").id),
      this.child.pid,
    );
    this.processes = info.map((p) => processIdentity(Number(p.id)));
    this.sandbox = sandbox(info);
    this.page = await this.target("manage");
    await until(() => this.eval(() => !!window.hearApi?.listModels));
    return this;
  }
  async target(kind) {
    const row = await until(async () => {
      const rows = await (
        await fetch(`http://127.0.0.1:${this.port}/json/list`, {
          signal: AbortSignal.timeout(3000),
        })
      ).json();
      return rows.find((row) => {
        try {
          const u = new URL(row.url);
          return (
            row.type === "page" &&
            ["file:", "app:"].includes(u.protocol) &&
            (u.searchParams.get("window") ?? "hud") === kind
          );
        } catch {
          return false;
        }
      });
    });
    requireOwner(this.owner, executable, this.profile);
    assert(listenerOwner(this.port, this.child.pid));
    const client = await cdp(row.webSocketDebuggerUrl);
    this.connections.push(client);
    return client;
  }
  eval(fn, arg, timeout) {
    requireOwner(this.owner, executable, this.profile);
    return renderer(this.page, fn, arg, timeout);
  }
  async entry(id) {
    return this.eval(
      async (id) =>
        (await window.hearApi.listModels()).find((m) => m.id === id),
      id,
    );
  }
  async ready(id, timeout = 240000) {
    return until(async () => {
      const m = await this.entry(id);
      return m?.downloaded && !m.verifying && !m.downloading ? m : null;
    }, timeout);
  }
  async stop(signal = "SIGTERM") {
    for (const connection of this.connections) connection.close();
    this.connections = [];
    if (this.child && this.child.exitCode === null && !this.child.signalCode) {
      requireOwner(this.owner, executable, this.profile);
      this.child.kill(signal);
      await until(
        () => this.child.exitCode !== null || this.child.signalCode,
        10000,
      );
    }
    await until(
      () =>
        this.processes.every((p) => {
          try {
            const now = processIdentity(p.pid);
            assert.equal(now.birth, p.birth);
            return now.state === "Z";
          } catch (e) {
            if (e.code === "ENOENT" || e.code === "ESRCH") return true;
            throw e;
          }
        }),
      10000,
    );
    return {
      signal: this.child?.signalCode ?? null,
      exitCode: this.child?.exitCode ?? null,
      noOwnedLiveProcesses: true,
    };
  }
}
function profileAt(root) {
  const profile = join(root, "profile");
  mkdirSync(profile, { mode: 0o700 });
  writeFileSync(
    join(profile, "audio.json"),
    JSON.stringify({
      mic: { enabled: false, gain: 0 },
      system: { enabled: false, gain: 0, source: { kind: "system" } },
    }),
    { flag: "wx", mode: 0o600 },
  );
  writeFileSync(
    join(profile, "ui.json"),
    JSON.stringify({ lang: "en", onboarding: { onboardedVersion: 1 } }),
    { flag: "wx", mode: 0o600 },
  );
  return profile;
}
function ledger(file, m) {
  ownFile(file);
  const s = statSync(file);
  assert.equal(s.size, m.sizeBytes);
  assert.equal(sha(file), m.sha256);
  return { bytes: s.size, ino: s.ino, sha256: m.sha256 };
}
function prefix(file) {
  const fd = openSync(file, "r");
  try {
    const bytes = Buffer.alloc(1024 * 1024);
    assert.equal(readSync(fd, bytes, 0, bytes.length, 0), bytes.length);
    return hash(bytes);
  } finally {
    closeSync(fd);
  }
}
async function modelsControl(root, models, env) {
  const raw = {
    kind: "original-linux-model-controls",
    status: "FAIL",
    controls: [],
    preservation: [],
    selfTests: [],
    models,
    ...rawBinding("models"),
    instrumentation:
      "owned renderer CDP and public product commands; genuine upstream downloads; no main injection",
    httpsRange: "NOT_OBSERVED",
  };
  const profile = profileAt(root),
    tiny = models["tiny.en"],
    base = models.base,
    tinyPath = modelFile(profile, tiny),
    basePath = modelFile(profile, base),
    part = basePath + ".part";
  let app;
  const launch = async () => {
    app = new CandidateSession(profile, root, env);
    await app.start();
    raw.rendererSandbox = app.sandbox;
  };
  const test = (id) =>
    app.eval(
      ({ id }) => window.hearApi.runModelSelfTest(id, "en"),
      { id },
      90000,
    );
  const assertTest = async (id) => {
    const value = await test(id);
    assert.equal(value.ok, true);
    assert.match(value.text, /thousands of miles/i);
    const result = { ok: true, text: value.text, textSha256: hash(value.text) };
    raw.selfTests.push({ modelId: id, ...result });
    return result;
  };
  const download = async (id) => {
    await app.eval((id) => window.hearApi.send({ t: "downloadModel", id }), id);
  };
  let tinyBefore;
  const preserved = async () => {
    await app.ready(tiny.id);
    assert.deepEqual(ledger(tinyPath, tiny), tinyBefore);
    const cfg = json(join(profile, "models.json"));
    assert.equal(cfg.activeModelId, tiny.id);
    assert.equal(cfg.activeFileModelId, tiny.id);
    raw.preservation.push({
      tiny: ledger(tinyPath, tiny),
      selection: {
        activeModelId: cfg.activeModelId,
        activeFileModelId: cfg.activeFileModelId,
      },
    });
  };
  try {
    await launch();
    assert(!(await app.entry(tiny.id)).downloaded);
    assert(!existsSync(tinyPath));
    await download(tiny.id);
    await app.ready(tiny.id);
    tinyBefore = ledger(tinyPath, tiny);
    await app.eval((id) => {
      for (const scope of ["realtime", "file"])
        window.hearApi.send({ t: "setActiveModel", id, scope });
    }, tiny.id);
    await until(async () => {
      const m = await app.entry(tiny.id);
      return m.active && m.activeFile;
    });
    await preserved();
    raw.controls.push({
      id: "first-download",
      status: "PASS",
      seeded: false,
      model: tinyBefore,
      selfTest: await assertTest(tiny.id),
    });
    await download(base.id);
    await until(
      () =>
        existsSync(part) &&
        statSync(part).size >= 8 * 1024 * 1024 &&
        statSync(part).size < base.sizeBytes,
      180000,
    );
    const cancelBytes = statSync(part).size;
    await app.eval(
      (id) => window.hearApi.send({ t: "cancelModelDownload", id }),
      base.id,
    );
    await until(async () => {
      const m = await app.entry(base.id);
      return (
        !m.downloading &&
        !m.cancelling &&
        !m.cancelFailed &&
        !m.downloaded &&
        !existsSync(part) &&
        !existsSync(basePath)
      );
    }, 15000);
    const end = Date.now() + 1500;
    let observations = 0;
    while (Date.now() < end) {
      assert(!existsSync(part) && !existsSync(basePath));
      observations++;
      await pause(20);
    }
    await preserved();
    raw.controls.push({
      id: "cancel",
      status: "PASS",
      partialBytes: cancelBytes,
      cancelled: true,
      observationMs: 1500,
      observations,
      lateRecreations: 0,
    });
    await download(base.id);
    await until(
      () =>
        existsSync(part) &&
        statSync(part).size >= 8 * 1024 * 1024 &&
        statSync(part).size < base.sizeBytes,
      180000,
    );
    const stopped = await app.stop("SIGKILL");
    assert.equal(stopped.signal, "SIGKILL");
    ownFile(part);
    const interrupted = {
      bytes: statSync(part).size,
      ino: statSync(part).ino,
      prefixSha256: prefix(part),
    };
    assert(interrupted.bytes > 0 && interrupted.bytes < base.sizeBytes);
    assert(!existsSync(basePath));
    raw.controls.push({
      id: "interrupt",
      status: "PASS",
      signal: stopped.signal,
      partialBytes: interrupted.bytes,
      partialInode: interrupted.ino,
      prefixSha256: interrupted.prefixSha256,
    });
    await launch();
    assert.equal(statSync(part).ino, interrupted.ino);
    assert.equal(prefix(part), interrupted.prefixSha256);
    let minBytes = interrupted.bytes,
      samples = 0,
      watchError;
    const timer = setInterval(() => {
      try {
        if (existsSync(part)) {
          ownFile(part);
          const s = statSync(part);
          assert.equal(s.ino, interrupted.ino);
          minBytes = Math.min(minBytes, s.size);
          samples++;
        }
      } catch (e) {
        watchError = e;
      }
    }, 10);
    try {
      await download(base.id);
      await app.ready(base.id);
    } finally {
      clearInterval(timer);
    }
    assert(!watchError);
    const resumed = ledger(basePath, base);
    assert.equal(resumed.ino, interrupted.ino);
    assert.equal(prefix(basePath), interrupted.prefixSha256);
    assert(minBytes >= interrupted.bytes && samples > 0);
    assert(!existsSync(part));
    await preserved();
    raw.controls.push({
      id: "resume",
      status: "PASS",
      sameInodeAndPrefix: true,
      minObservedPartialBytes: minBytes,
      samples,
      installed: resumed,
      installedPrefixSha256: prefix(basePath),
      selfTest: await assertTest(base.id),
    });
    const fd = openSync(basePath, "r+");
    try {
      const byte = Buffer.alloc(1);
      readSync(fd, byte, 0, 1, 4096);
      byte[0] ^= 255;
      writeSync(fd, byte, 0, 1, 4096);
    } finally {
      closeSync(fd);
    }
    const corruptSha = sha(basePath);
    assert.notEqual(corruptSha, base.sha256);
    await until(async () => {
      const m = await app.entry(base.id);
      return !m.downloaded && !m.verifying;
    });
    const denied = await test(base.id);
    assert.equal(denied.ok, false);
    await preserved();
    await download(base.id);
    await app.ready(base.id);
    ledger(basePath, base);
    assert(!existsSync(part));
    await assertTest(base.id);
    await preserved();
    raw.controls.push({
      id: "corrupt-repair",
      status: "PASS",
      rejectedCorrupt: true,
      corruptSha256: corruptSha,
      repairedSha256: sha(basePath),
    });
    await app.stop();
    await launch();
    await app.ready(base.id);
    await preserved();
    await assertTest(base.id);
    await assertTest(tiny.id);
    const ids = await app.eval(async () =>
      (await window.hearApi.listRecordings()).map((r) => r.id),
    );
    await app.eval(
      (path) => window.hearApi.send({ t: "transcribeFile", path }),
      sample,
    );
    const recording = await until(async () => {
      for (const row of await app.eval(() => window.hearApi.listRecordings()))
        if (!ids.includes(row.id)) {
          const detail = await app.eval(
            (id) => window.hearApi.getRecording(id),
            row.id,
          );
          if (
            detail?.segments?.length &&
            /thousands of miles/i.test(
              detail.segments.map((s) => s.text).join(" "),
            )
          )
            return detail;
        }
    }, 180000);
    assert.equal(recording.diag.engine.modelId, tiny.id);
    await app.stop();
    await launch();
    const reopened = await app.eval(
      (id) => window.hearApi.getRecording(id),
      recording.id,
    );
    assert.deepEqual(reopened.segments, recording.segments);
    raw.fileRecording = { id: recording.id, segments: recording.segments };
    await preserved();
    raw.controls.push({
      id: "reopen",
      status: "PASS",
      selfTests: true,
      fileSavedAndReopened: true,
      recordingId: recording.id,
      segments: recording.segments.length,
      segmentsSha256: hash(JSON.stringify(recording.segments)),
    });
    raw.tinyPreserved = true;
    raw.modelSelectionPreserved = true;
    raw.status = "PASS";
  } catch (e) {
    raw.error = String(e.stack ?? e);
  } finally {
    try {
      raw.cleanup = await app?.stop();
    } catch (e) {
      raw.status = "FAIL";
      raw.cleanupError = String(e.stack ?? e);
    }
    writeFileSync(join(root, "raw.json"), JSON.stringify(raw, null, 2) + "\n", {
      flag: "wx",
      mode: 0o600,
    });
  }
  return raw;
}
async function audioControl(root, models, seed, env) {
  const raw = {
    kind: "original-linux-owned-audio-controls",
    status: "FAIL",
    controls: [],
    privateServerOnly: true,
    physicalAudio: false,
    sampleSha256: sampleSha,
    model: models["tiny.en"],
    ...rawBinding("audio"),
    instrumentation:
      "owned renderer CDP; private PulseAudio virtual monitors; approved sample only",
  };
  const profile = profileAt(root),
    tiny = models["tiny.en"],
    tinyPath = modelFile(profile, tiny),
    state = join(root, "pulse"),
    address = "unix:" + join(state, "native.sock");
  mkdirSync(state, { mode: 0o700 });
  const pulseEnv = {
    ...env,
    PULSE_SERVER: address,
    PULSE_RUNTIME_PATH: state,
    PULSE_STATE_PATH: state,
  };
  const pactl = (...args) =>
    execFileSync("/usr/bin/pactl", ["--server=" + address, ...args], {
      env: pulseEnv,
      encoding: "utf8",
      timeout: 5000,
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  let app,
    server,
    player,
    playerIdentity,
    playing = false,
    playError,
    playLoop;
  const play = async (device) => {
    playing = true;
    playLoop = (async () => {
      while (playing) {
        player = spawn(
          "/usr/bin/paplay",
          ["--server=" + address, "--device=" + device, sample],
          { env: pulseEnv, stdio: "ignore" },
        );
        await new Promise((resolve, reject) => {
          player.once("spawn", resolve);
          player.once("error", reject);
        });
        playerIdentity = processIdentity(player.pid);
        const code = await new Promise((resolve) =>
          player.once("close", resolve),
        );
        if (playing) assert.equal(code, 0);
      }
    })().catch((e) => {
      playError = e;
      playing = false;
    });
  };
  const stopPlayer = async () => {
    playing = false;
    if (player && player.exitCode === null && !player.signalCode) {
      const now = processIdentity(player.pid);
      assert.equal(now.birth, playerIdentity.birth);
      assert.equal(now.uid, process.getuid());
      assert.equal(now.exe, realpathSync("/usr/bin/paplay"));
      player.kill("SIGTERM");
    }
    if (playLoop)
      await Promise.race([
        playLoop,
        pause(5000).then(() => {
          throw Error("Owned player did not close");
        }),
      ]);
    assert(!playError);
  };
  const control = "hear_qa_control_" + process.pid,
    selected = "hear_qa_selected_" + process.pid;
  try {
    server = spawn(
      "/usr/bin/dbus-run-session",
      [
        "--",
        "/usr/bin/pulseaudio",
        "-n",
        "--daemonize=no",
        "--exit-idle-time=-1",
        "--use-pid-file=no",
        "--log-level=error",
        "--load=module-native-protocol-unix socket=" +
          join(state, "native.sock") +
          " auth-anonymous=1",
      ],
      { env: pulseEnv, stdio: ["ignore", "pipe", "pipe"] },
    );
    server.on("error", () => {});
    for (const stream of [server.stdout, server.stderr])
      stream.on("data", (bytes) =>
        appendFileSync(join(root, "pulse.private.log"), bytes, { mode: 0o600 }),
      );
    await until(() => {
      assert(server.exitCode === null && !server.signalCode);
      return existsSync(join(state, "native.sock"));
    }, 10000);
    assert.deepEqual(JSON.parse(pactl("--format=json", "list", "sources")), []);
    pactl("load-module", "module-null-sink", "sink_name=" + control);
    const selectedModule = pactl(
      "load-module",
      "module-null-sink",
      "sink_name=" + selected,
    );
    pactl("set-default-sink", control);
    pactl("set-default-source", control + ".monitor");
    assert.deepEqual(
      JSON.parse(pactl("--format=json", "list", "sources"))
        .map((s) => s.name)
        .sort(),
      [control + ".monitor", selected + ".monitor"].sort(),
    );
    pactl("set-sink-volume", selected, "100%");
    pactl("set-source-volume", selected + ".monitor", "100%");
    if (existsSync(seed)) {
      ledger(seed, tiny);
      mkdirSync(join(tinyPath, ".."), { recursive: true });
      copyFileSync(seed, tinyPath);
      raw.modelSeed = "verified first-download output, separate copied bytes";
    }
    app = new CandidateSession(profile, root, pulseEnv);
    await app.start();
    raw.rendererSandbox = app.sandbox;
    if (!existsSync(tinyPath)) {
      await app.eval(
        (id) => window.hearApi.send({ t: "downloadModel", id }),
        tiny.id,
      );
      raw.modelSeed = "genuine product download in fresh audio profile";
    }
    await app.ready(tiny.id);
    raw.modelBefore = ledger(tinyPath, tiny);
    await app.eval(
      async ({ id, selected }) => {
        window.__ownedAudio = { statuses: [], errors: [], segments: {} };
        window.hearApi.onEvent((e) => {
          const r = window.__ownedAudio;
          if (e.t === "status") r.statuses.push(e.state);
          if (e.t === "error") r.errors.push(e);
          if (e.t === "segment") r.segments[e.id] = e;
        });
        for (const scope of ["realtime", "file"])
          window.hearApi.send({ t: "setActiveModel", id, scope });
        const translation = await window.hearApi.getTranslationConfig();
        window.hearApi.send({
          t: "setTranslationConfig",
          config: { ...translation, enabled: false },
        });
        const asr = await window.hearApi.getAsrConfig();
        window.hearApi.send({
          t: "setAsrConfig",
          config: { ...asr, realtime: { ...asr.realtime, lang: "en" } },
        });
        window.hearApi.send({ t: "setVadEnabled", enabled: false });
        for (const cmd of [
          { t: "setMicEnabled", enabled: false },
          {
            t: "setSystemSource",
            source: { kind: "output", outputId: selected },
          },
          { t: "setSystemGain", gain: 1 },
          { t: "setSystemEnabled", enabled: true },
        ])
          window.hearApi.send(cmd);
      },
      { id: tiny.id, selected },
    );
    await until(async () => {
      const cfg = await app.eval(() => window.hearApi.getAudioSettings());
      return (
        !cfg.mic.enabled &&
        cfg.system.enabled &&
        cfg.system.source.kind === "output" &&
        cfg.system.source.outputId === selected
      );
    });
    assert(
      (await app.eval(() => window.hearApi.listAudioSources())).some(
        (s) => s.outputId === selected,
      ),
    );
    const hud = await app.target("hud");
    await until(() =>
      renderer(
        hud,
        () => !!document.querySelector('[data-testid="hud-start"]'),
      ),
    );
    const before = await app.eval(async () =>
      (await window.hearApi.listRecordings()).map((r) => r.id),
    );
    await renderer(hud, () =>
      document.querySelector('[data-testid="hud-start"]').click(),
    );
    await until(
      () => app.eval(() => window.__ownedAudio.statuses.includes("running")),
      30000,
    );
    await play(selected);
    await until(async () => {
      assert(!playError);
      const data = await app.eval(() => window.__ownedAudio);
      assert.equal(data.errors.length, 0);
      return /thousands of miles/i.test(
        Object.values(data.segments)
          .map((s) => s.text)
          .join(" "),
      );
    }, 120000);
    const live = await app.eval(() => window.__ownedAudio);
    await stopPlayer();
    await renderer(hud, () =>
      document.querySelector('[data-testid="hud-start"]').click(),
    );
    const row = await until(
      async () =>
        (await app.eval(() => window.hearApi.listRecordings())).find(
          (r) => !before.includes(r.id),
        ),
      30000,
    );
    assert.equal(row.origin, "live");
    assert(/^[a-zA-Z0-9_-]+$/.test(row.id));
    const file = join(profile, "recordings", row.id, "audio.opus");
    await until(() => existsSync(file));
    ownFile(file);
    const opus = readFileSync(file),
      ffmpeg = "/opt/AIHear/resources/resources/bin/linux-x64/ffmpeg/ffmpeg";
    const pcm = execFileSync(
      ffmpeg,
      [
        "-v",
        "error",
        "-i",
        file,
        "-f",
        "f32le",
        "-ar",
        "16000",
        "-ac",
        "1",
        "pipe:1",
      ],
      { timeout: 30000, maxBuffer: 16 * 1024 * 1024 },
    );
    const metrics = pcmMetrics(pcm);
    assert(
      metrics.peak > 0.001 && metrics.rms > 0.00001 && metrics.frames > 16000,
    );
    writeFileSync(join(root, "saved.opus"), opus, { flag: "wx", mode: 0o600 });
    writeFileSync(join(root, "saved.f32le"), pcm, { flag: "wx", mode: 0o600 });
    const detail = await app.eval(
      (id) => window.hearApi.getRecording(id),
      row.id,
    );
    assert.match(
      detail.segments.map((s) => s.text).join(" "),
      /thousands of miles/i,
    );
    await app.stop();
    app = new CandidateSession(profile, root, pulseEnv);
    await app.start();
    const reopened = await app.eval(
      (id) => window.hearApi.getRecording(id),
      row.id,
    );
    assert.deepEqual(reopened.segments, detail.segments);
    assert.equal(sha(file), hash(opus));
    raw.controls.push({
      id: "signal-save-reopen",
      status: "PASS",
      segments: Object.keys(live.segments).length,
      recordingId: row.id,
      saved: { bytes: opus.length, sha256: hash(opus) },
      pcm: { ...metrics, sha256: hash(pcm) },
      reopened: true,
      segmentsSha256: hash(JSON.stringify(detail.segments)),
    });
    await app.eval(() => {
      window.__disappearance = [];
      window.hearApi.onEvent((e) => {
        if (e.t === "error") window.__disappearance.push(e);
      });
    });
    const hud2 = await app.target("hud");
    await until(() =>
      renderer(
        hud2,
        () => !!document.querySelector('[data-testid="hud-start"]'),
      ),
    );
    await renderer(hud2, () =>
      document.querySelector('[data-testid="hud-start"]').click(),
    );
    await until(
      () => pactl("list", "short", "source-outputs").trim() !== "",
      30000,
    );
    assert.equal(pactl("get-default-sink"), control);
    assert.equal(pactl("get-default-source"), control + ".monitor");
    pactl("unload-module", selectedModule);
    await until(
      async () =>
        (await app.eval(() => window.__disappearance)).some(
          (e) => e.message === "system-audio-unavailable",
        ),
      15000,
    );
    await until(() => pactl("list", "short", "source-outputs") === "");
    await pause(500);
    assert.equal(pactl("list", "short", "source-outputs"), "");
    assert.equal(pactl("get-default-sink"), control);
    assert.equal(pactl("get-default-source"), control + ".monitor");
    const cfg = await app.eval(() => window.hearApi.getAudioSettings());
    assert.equal(cfg.system.source.kind, "output");
    assert.equal(cfg.system.source.outputId, selected);
    assert(
      !(await app.eval(() => window.hearApi.listAudioSources())).some(
        (s) => s.outputId === selected,
      ),
    );
    raw.controls.push({
      id: "selected-output-disappearance",
      status: "PASS",
      error: "system-audio-unavailable",
      remainingCaptureStreams: 0,
      defaultUnchanged: true,
      selectionRetained: true,
      postRemovalWaitMs: 500,
    });
    await app.eval(() => window.hearApi.send({ t: "stop" }));
    raw.modelAfter = ledger(tinyPath, tiny);
    raw.status = "PASS";
  } catch (e) {
    raw.error = String(e.stack ?? e);
  } finally {
    try {
      await stopPlayer();
      const cleanup = await app?.stop();
      if (server && server.exitCode === null && !server.signalCode) {
        pactl("exit");
        await until(() => server.exitCode !== null || server.signalCode, 10000);
      }
      raw.cleanup = {
        ...cleanup,
        privateServerStopped:
          !server || server.exitCode !== null || !!server.signalCode,
      };
    } catch (e) {
      raw.status = "FAIL";
      raw.cleanupError = String(e.stack ?? e);
    }
    writeFileSync(join(root, "raw.json"), JSON.stringify(raw, null, 2) + "\n", {
      flag: "wx",
      mode: 0o600,
    });
  }
  return raw;
}
async function definitions(core) {
  const file = join(core, "apps/hear/packages/model-artifacts/models.mjs"),
    bytes = readFileSync(file);
  assert.equal(
    hash(
      execFileSync("git", [
        "-C",
        core,
        "show",
        approvedCandidate.source +
          ":apps/hear/packages/model-artifacts/models.mjs",
      ]),
    ),
    hash(bytes),
  );
  const { SINGLE_FILE_MODELS } = await import(
    "data:text/javascript;base64," + bytes.toString("base64")
  );
  const selected = {
    "tiny.en": SINGLE_FILE_MODELS["tiny.en"],
    base: SINGLE_FILE_MODELS.base,
  };
  assert.deepEqual(selected, modelSpecs);
  return selected;
}
const qaBinding = () => ({
  workflow: process.env.GITHUB_SHA,
  run: Number(process.env.GITHUB_RUN_ID),
  attempt: Number(process.env.GITHUB_RUN_ATTEMPT),
});
function rawBinding(mode) {
  return {
    source: approvedCandidate.source,
    build: approvedCandidate,
    qa: qaBinding(),
    executionRunId: `linux-${mode}-${randomUUID()}`,
  };
}
export function validateRawBinding(raw, binding) {
  assert(
    /^[a-f0-9]{40}$/.test(binding.workflow) &&
      Number.isSafeInteger(binding.run) &&
      binding.run > 0 &&
      Number.isSafeInteger(binding.attempt) &&
      binding.attempt > 0,
  );
  assert.equal(raw.source, approvedCandidate.source);
  assert.deepEqual(raw.build, approvedCandidate);
  assert.deepEqual(raw.qa, binding);
  const mode =
    raw.kind === "original-linux-model-controls"
      ? "models"
      : raw.kind === "original-linux-owned-audio-controls"
        ? "audio"
        : null;
  assert(mode);
  assert(
    new RegExp(
      "^linux-" +
        mode +
        "-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$",
    ).test(raw.executionRunId),
  );
}
export function summarize(raw, binding) {
  validateRawBinding(raw, binding);
  if (raw.kind === "original-linux-model-controls") {
    validateModels(raw);
    return {
      status: "PASS",
      controls: raw.controls.map((c) => ({ id: c.id, status: c.status })),
      tinyPreserved: true,
      modelSelectionPreserved: true,
      fileSavedAndReopened: true,
      models: raw.models,
      httpsRange: "NOT_OBSERVED",
    };
  }
  validateAudio(raw);
  return {
    status: "PASS",
    controls: raw.controls.map((c) => ({ id: c.id, status: c.status })),
    privateServerOnly: true,
    physicalAudio: false,
    sampleSha256: raw.sampleSha256,
    saved: raw.controls[0].saved,
    pcm: raw.controls[0].pcm,
    reopened: true,
    sourceRemovalNoMigration: true,
  };
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    assert.equal(process.platform, "linux");
    assert.equal(process.arch, "x64");
    assert.notEqual(process.getuid(), 0);
    const workspace = resolve(import.meta.dirname, ".."),
      core = join(workspace, "core"),
      root = join(
        realpathSync(process.env.RUNNER_TEMP),
        "hear-original-install",
      ),
      phase = process.argv[2],
      output = join(root, "functional");
    if (phase === "seal") {
      mkdirSync(join(workspace, "diagnostics"), { recursive: true });
      for (const [relative, suffix] of [
        ["models/raw.json", "models"],
        ["audio/raw.json", "audio"],
        ["audio/saved.opus", "opus"],
        ["audio/saved.f32le", "pcm"],
        ["runtime.json", "runtime"],
      ]) {
        const source = join(output, relative),
          file = join(
            workspace,
            "diagnostics",
            `functional-${suffix}.enc.json`,
          );
        if (existsSync(source)) {
          ownFile(source);
          assert(statSync(source).size < 32 * 1024 * 1024);
          if (!existsSync(file))
            writeFileSync(
              file,
              JSON.stringify(
                encryptLog(
                  readFileSync(source),
                  process.env.HEAR_LOG_PUBLIC_KEY,
                ),
              ),
              { flag: "wx", mode: 0o600 },
            );
        }
      }
      process.exit(0);
    }
    assert.equal(
      execFileSync("git", ["-C", workspace, "rev-parse", "HEAD"], {
        encoding: "utf8",
      }).trim(),
      process.env.GITHUB_SHA,
    );
    execFileSync(
      "git",
      [
        "-C",
        workspace,
        "diff",
        "--quiet",
        "HEAD",
        "--",
        "ci",
        ".github/workflows",
      ],
      { stdio: "pipe" },
    );
    assert.equal(
      execFileSync("git", ["-C", core, "rev-parse", "HEAD"], {
        encoding: "utf8",
      }).trim(),
      approvedCandidate.source,
    );
    verifyInstallInput(root, process.env.EXPECTED_FETCH_SHA);
    assert.equal(sha(join(root, "receipt/candidate.json")), receiptSha);
    const candidate = json(join(root, "receipt/candidate.json"));
    installed(candidate);
    const before = tools(),
      models = await definitions(core);
    if (phase === "run") {
      mkdirSync(output, { mode: 0o700 });
      const runtimeFile = join(core, "scripts/verify-runtime.mjs"),
        runtimeBytes = readFileSync(runtimeFile);
      assert.equal(
        hash(runtimeBytes),
        "d9bab01d1d42c6bef7e6305a7beb40c62cc4e011174eb3354204fe8dc9367417",
      );
      const { runCommand } = await import(
        "data:text/javascript;base64," + runtimeBytes.toString("base64")
      );
      let failed = false;
      const outcomes = {};
      for (const mode of ["models", "audio"]) {
        const directory = join(output, mode);
        mkdirSync(directory, { mode: 0o700 });
        const controller = new AbortController(),
          timer = setTimeout(
            () => controller.abort(),
            mode === "models" ? 900000 : 300000,
          );
        try {
          const outcome = await runCommand(
            [
              "xvfb-run",
              "--auto-servernum",
              process.execPath,
              import.meta.filename,
              mode,
            ],
            {
              cwd: workspace,
              env: process.env,
              signal: controller.signal,
              output: (bytes) => {
                const log = join(process.env.RUNNER_TEMP, "hear-private.log");
                assert(
                  (existsSync(log) ? statSync(log).size : 0) + bytes.length <
                    32 * 1024 * 1024,
                );
                appendFileSync(log, bytes, { mode: 0o600 });
              },
            },
          );
          outcomes[mode] = {
            code: outcome.code,
            signal: outcome.signal ?? null,
            reason: outcome.reason ?? null,
            aborted: controller.signal.aborted,
          };
          if (
            outcome.code !== 0 ||
            outcome.signal ||
            outcome.reason ||
            controller.signal.aborted
          )
            failed = true;
        } finally {
          clearTimeout(timer);
        }
      }
      assert.deepEqual(tools(), before);
      installed(candidate);
      writeFileSync(
        join(output, "runtime.json"),
        JSON.stringify(
          { tools: before, runtimeSha256: hash(runtimeBytes), outcomes },
          null,
          2,
        ) + "\n",
        { flag: "wx", mode: 0o600 },
      );
      assert(!failed, "At least one functional phase failed");
    } else if (phase === "models" || phase === "audio") {
      const directory = join(output, phase);
      assert.equal(realpathSync(directory), directory);
      const env = {
        ...process.env,
        PULSE_SERVER: "unix:" + join(directory, "disabled.sock"),
      };
      const raw =
        phase === "models"
          ? await modelsControl(directory, models, env)
          : await audioControl(
              directory,
              models,
              modelFile(join(output, "models/profile"), models["tiny.en"]),
              env,
            );
      assert.deepEqual(tools(), before);
      installed(candidate);
      summarize(raw, qaBinding());
    } else if (phase === "collect") {
      const runtime = json(join(output, "runtime.json"));
      assert.deepEqual(runtime.tools, before);
      assert.equal(
        runtime.runtimeSha256,
        sha(join(core, "scripts/verify-runtime.mjs")),
      );
      for (const mode of ["models", "audio"])
        assert.deepEqual(runtime.outcomes[mode], {
          code: 0,
          signal: null,
          reason: null,
          aborted: false,
        });
      const diagnostics = {},
        rawHashes = {},
        summaries = {};
      mkdirSync(join(workspace, "diagnostics"), { recursive: true });
      for (const mode of ["models", "audio"]) {
        const bytes = readFileSync(join(output, mode, "raw.json")),
          raw = JSON.parse(bytes);
        summaries[mode] = summarize(raw, qaBinding());
        rawHashes[mode] = {
          sha256: hash(bytes),
          executionRunId: raw.executionRunId,
        };
        const file = join(
          workspace,
          "diagnostics",
          `functional-${mode}.enc.json`,
        );
        writeFileSync(
          file,
          JSON.stringify(encryptLog(bytes, process.env.HEAR_LOG_PUBLIC_KEY)),
          { flag: "wx", mode: 0o600 },
        );
        diagnostics[`functional-${mode}.enc.json`] = sha(file);
      }
      for (const [name, suffix] of [
        ["saved.opus", "opus"],
        ["saved.f32le", "pcm"],
      ]) {
        const bytes = readFileSync(join(output, "audio", name)),
          file = join(
            workspace,
            "diagnostics",
            `functional-${suffix}.enc.json`,
          );
        assert.equal(
          hash(bytes),
          suffix === "opus"
            ? summaries.audio.saved.sha256
            : summaries.audio.pcm.sha256,
        );
        if (suffix === "opus")
          assert.equal(bytes.length, summaries.audio.saved.bytes);
        else
          assert.deepEqual(
            { ...pcmMetrics(bytes), sha256: hash(bytes) },
            summaries.audio.pcm,
          );
        writeFileSync(
          file,
          JSON.stringify(encryptLog(bytes, process.env.HEAR_LOG_PUBLIC_KEY)),
          { flag: "wx", mode: 0o600 },
        );
        diagnostics[`functional-${suffix}.enc.json`] = sha(file);
      }
      const runtimeEnvelope = join(
        workspace,
        "diagnostics/functional-runtime.enc.json",
      );
      writeFileSync(
        runtimeEnvelope,
        JSON.stringify(
          encryptLog(
            readFileSync(join(output, "runtime.json")),
            process.env.HEAR_LOG_PUBLIC_KEY,
          ),
        ),
        { flag: "wx", mode: 0o600 },
      );
      diagnostics["functional-runtime.enc.json"] = sha(runtimeEnvelope);
      const result = {
        schemaVersion: 1,
        kind: "original-linux-functional-observation",
        source: approvedCandidate.source,
        appPath: "apps/hear",
        build: approvedCandidate,
        qa: {
          workflow: process.env.GITHUB_SHA,
          run: Number(process.env.GITHUB_RUN_ID),
          attempt: Number(process.env.GITHUB_RUN_ATTEMPT),
        },
        candidateReceiptSha256: receiptSha,
        nativeSha256: candidate.inputs.native.sha256,
        tools: before,
        runtimeSha256: runtime.runtimeSha256,
        runtimeReceiptSha256: sha(join(output, "runtime.json")),
        rawHashes,
        diagnostics,
        ...summaries,
        status: "PASS",
        boundary:
          "GitHub Linux VM; renderer CDP/product IPC; private virtual OS audio only. Native dialogs, physical audio, upgrade, uninstall data retention and signed repository distribution NOT_RUN.",
      };
      writeFileSync(
        join(workspace, "functional-observation.json"),
        JSON.stringify(result, null, 2) + "\n",
        { flag: "wx", mode: 0o600 },
      );
    } else assert.fail("Unknown functional phase");
    assert.deepEqual(tools(), before);
  } catch (error) {
    appendFileSync(
      join(process.env.RUNNER_TEMP, "hear-private.log"),
      String(error.stack ?? error) + "\n",
      { mode: 0o600 },
    );
    console.error(
      "Original Linux functional control failed; inspect encrypted diagnostics.",
    );
    process.exitCode = 1;
  }
}
