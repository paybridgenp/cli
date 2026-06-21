import { describe, it, expect, mock, afterEach, spyOn } from "bun:test";
import * as childProcess from "child_process";
import { EventEmitter } from "events";

function makeFakeProc() {
  const stdout = new EventEmitter() as any;
  const stderr = new EventEmitter() as any;
  const proc = new EventEmitter() as any;
  proc.stdout = stdout;
  proc.stderr = stderr;
  proc.kill = mock(() => {});
  return proc;
}

// Spy on spawn so it returns `proc` and fires `emit(proc)` on the NEXT macrotask
// — i.e. AFTER openTunnel has synchronously attached its stdout/exit/error
// listeners. The earlier version emitted on a fixed 10ms timer started at
// construction time, which raced the (cold, CI-slow) `await import(...)` +
// listener attach: if import took >10ms the event fired into the void and the
// promise hung to the 5s test timeout (flaky in CI, passed locally). Emitting
// causally after the spawn call removes the race entirely.
function spawnReturning(proc: any, emit: (p: any) => void) {
  spyOn(childProcess, "spawn").mockImplementation(() => {
    setTimeout(() => emit(proc), 0);
    return proc as any;
  });
}

describe("openTunnel", () => {
  afterEach(() => {
    mock.restore();
  });

  it("resolves with url and close when ngrok emits a tunnel URL", async () => {
    const proc = makeFakeProc();
    spawnReturning(proc, (p) =>
      p.stdout.emit(
        "data",
        Buffer.from(JSON.stringify({ msg: "started tunnel", url: "https://abc123.ngrok-free.app" }) + "\n"),
      ),
    );

    const { openTunnel } = await import("../lib/tunnel.js");
    const tunnel = await openTunnel(4242);

    expect(tunnel.url).toBe("https://abc123.ngrok-free.app");
    tunnel.close();
    expect(proc.kill).toHaveBeenCalledTimes(1);
  });

  it("rejects when ngrok exits before emitting a URL", async () => {
    const proc = makeFakeProc();
    spawnReturning(proc, (p) => p.emit("exit", 1));

    const { openTunnel } = await import("../lib/tunnel.js");
    await expect(openTunnel(4242)).rejects.toThrow("ngrok exited with code 1");
  });

  it("rejects when ngrok process fails to start", async () => {
    const proc = makeFakeProc();
    spawnReturning(proc, (p) => p.emit("error", new Error("ENOENT")));

    const { openTunnel } = await import("../lib/tunnel.js");
    await expect(openTunnel(4242)).rejects.toThrow("Failed to start ngrok");
  });
});
