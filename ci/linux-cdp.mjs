// Renderer CDP only. No Electron main-process inspector, injected preload or sandbox override.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createServer } from "node:net";
import { readFileSync, realpathSync } from "node:fs";
export const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
export async function until(fn, timeout = 30000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const value = await fn();
    if (value) return value;
    await pause(20);
  }
  throw Error("Bounded functional observation timed out");
}
export async function freePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}
export function processIdentity(pid) {
  const text = readFileSync(`/proc/${pid}/stat`, "utf8"),
    tail = text.slice(text.lastIndexOf(")") + 2).split(" ");
  return {
    pid,
    birth: tail[19],
    state: tail[0],
    exe: realpathSync(`/proc/${pid}/exe`),
    uid: Number(
      readFileSync(`/proc/${pid}/status`, "utf8").match(/^Uid:\s+(\d+)/m)?.[1],
    ),
  };
}
export function requireOwner(identity, executable, profile) {
  const current = processIdentity(identity.pid);
  assert.equal(current.birth, identity.birth);
  assert.equal(current.exe, executable);
  assert.equal(current.uid, process.getuid());
  const args = readFileSync(`/proc/${identity.pid}/cmdline`, "utf8").split(
    "\0",
  );
  assert(args.includes("--user-data-dir=" + profile));
  assert(
    !args.some((a) => a === "--no-sandbox" || a === "--disable-setuid-sandbox"),
  );
  return current;
}
export function listenerOwner(port, pid) {
  let text;
  try {
    text = execFileSync(
      "/usr/bin/lsof",
      ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-Fpn"],
      { encoding: "utf8", timeout: 3000, stdio: ["ignore", "pipe", "pipe"] },
    );
  } catch (e) {
    if (e.status === 1 && !String(e.stdout ?? "").trim()) return false;
    throw e;
  }
  return validateListener(text, port, pid);
}
export function validateListener(text, port, pid) {
  const lines = text.trim().split("\n");
  assert.deepEqual(
    [
      ...new Set(
        lines.filter((l) => l.startsWith("p")).map((l) => Number(l.slice(1))),
      ),
    ],
    [pid],
  );
  assert(
    lines
      .filter((l) => l.startsWith("n"))
      .every((l) => l === `n127.0.0.1:${port}`),
    "Only an owned loopback CDP listener is permitted",
  );
  return true;
}
export async function cdp(url) {
  const u = new URL(url);
  assert.equal(u.protocol, "ws:");
  assert.equal(u.hostname, "127.0.0.1");
  const ws = new WebSocket(url),
    pending = new Map();
  let next = 0;
  const rejectAll = () => {
    for (const { reject, timer } of pending.values()) {
      clearTimeout(timer);
      reject(Error("Owned CDP transport closed"));
    }
    pending.clear();
  };
  ws.addEventListener("close", rejectAll);
  ws.addEventListener("error", rejectAll);
  ws.addEventListener("message", (event) => {
    try {
      assert(
        typeof event.data === "string" && event.data.length < 2 * 1024 * 1024,
      );
      const message = JSON.parse(event.data);
      const request = pending.get(message.id);
      if (!request) return;
      pending.delete(message.id);
      clearTimeout(request.timer);
      if (message.error)
        request.reject(
          Error("Owned CDP request failed: " + message.error.message),
        );
      else request.resolve(message.result);
    } catch {
      rejectAll();
      ws.close();
    }
  });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.close();
      reject(Error("Owned CDP connection timed out"));
    }, 10000);
    ws.addEventListener(
      "open",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
    ws.addEventListener(
      "error",
      () => {
        clearTimeout(timer);
        reject(Error("Owned CDP connection failed"));
      },
      { once: true },
    );
  });
  return {
    call(method, params = {}, timeout = 30000) {
      assert.equal(ws.readyState, 1);
      return new Promise((resolve, reject) => {
        const id = ++next,
          timer = setTimeout(() => {
            pending.delete(id);
            reject(Error("Owned CDP request timed out"));
          }, timeout);
        pending.set(id, { resolve, reject, timer });
        ws.send(JSON.stringify({ id, method, params }));
      });
    },
    close() {
      rejectAll();
      ws.close();
    },
  };
}
export async function renderer(client, fn, arg, timeout = 30000) {
  const result = await client.call(
    "Runtime.evaluate",
    {
      expression: `(${fn.toString()})(${JSON.stringify(arg) ?? "undefined"})`,
      awaitPromise: true,
      returnByValue: true,
    },
    timeout,
  );
  assert(
    !result.exceptionDetails,
    "Product renderer call failed: " + JSON.stringify(result.exceptionDetails),
  );
  return result.result.value;
}
export function sandbox(processes) {
  const renderers = processes.filter((p) => p.type === "renderer");
  assert(renderers.length > 0);
  return renderers.map((p) => {
    const text = readFileSync(`/proc/${Number(p.id)}/status`, "utf8");
    const Seccomp = text.match(/^Seccomp:\s+(\d+)/m)?.[1],
      NoNewPrivs = text.match(/^NoNewPrivs:\s+(\d+)/m)?.[1];
    assert.equal(Seccomp, "2");
    assert.equal(NoNewPrivs, "1");
    return { pid: Number(p.id), Seccomp, NoNewPrivs };
  });
}
// A process may exit between the CDP list and /proc reads. Never accept a partial snapshot.
export async function stableProcessSnapshot(
  assertOwner,
  readSnapshot,
  timeout = 10000,
) {
  return until(async () => {
    assertOwner();
    try {
      return await readSnapshot();
    } catch (error) {
      if (error.code === "ENOENT" || error.code === "ESRCH") return false;
      throw error;
    }
  }, timeout);
}
