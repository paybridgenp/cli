import { describe, it, expect, mock, afterEach, spyOn } from "bun:test";
import * as childProcess from "child_process";
import { EventEmitter } from "events";

function makeFakeProc(opts: {
  stdoutLines?: string[];
  exitCode?: number;
  errorEvent?: Error;
}) {
  const stdout = new EventEmitter() as any;
  const stderr = new EventEmitter() as any;
  const proc = new EventEmitter() as any;
  proc.stdout = stdout;
  proc.stderr = stderr;
  proc.kill = mock(() => {});

  // Emit stdout lines on next tick
  if (opts.stdoutLines) {
    setTimeout(() => {
      for (const line of opts.stdoutLines!) {
        stdout.emit("data", Buffer.from(line + "\n"));
      }
    }, 10);
  }

  if (opts.errorEvent) {
    setTimeout(() => proc.emit("error", opts.errorEvent!), 10);
  }

  if (opts.exitCode !== undefined) {
    setTimeout(() => proc.emit("exit", opts.exitCode), 50);
  }

  return proc;
}

describe("openTunnel", () => {
  afterEach(() => {
    mock.restore();
  });

  it("resolves with url and close when ngrok emits a tunnel URL", async () => {
    const fakeProc = makeFakeProc({
      stdoutLines: [
        JSON.stringify({ msg: "started tunnel", url: "https://abc123.ngrok-free.app" }),
      ],
    });

    spyOn(childProcess, "spawn").mockReturnValue(fakeProc as any);

    const { openTunnel } = await import("../lib/tunnel.js");
    const tunnel = await openTunnel(4242);

    expect(tunnel.url).toBe("https://abc123.ngrok-free.app");
    tunnel.close();
    expect(fakeProc.kill).toHaveBeenCalledTimes(1);
  });

  it("rejects when ngrok exits before emitting a URL", async () => {
    const fakeProc = makeFakeProc({ exitCode: 1 });
    spyOn(childProcess, "spawn").mockReturnValue(fakeProc as any);

    const { openTunnel } = await import("../lib/tunnel.js");
    await expect(openTunnel(4242)).rejects.toThrow("ngrok exited with code 1");
  });

  it("rejects when ngrok process fails to start", async () => {
    const fakeProc = makeFakeProc({ errorEvent: new Error("ENOENT") });
    spyOn(childProcess, "spawn").mockReturnValue(fakeProc as any);

    const { openTunnel } = await import("../lib/tunnel.js");
    await expect(openTunnel(4242)).rejects.toThrow("Failed to start ngrok");
  });
});
