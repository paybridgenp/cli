import { spawn } from "child_process";

export interface Tunnel {
  url: string;
  close(): void;
}

export async function openTunnel(port: number): Promise<Tunnel> {
  return new Promise((resolve, reject) => {
    const proc = spawn("ngrok", ["http", port.toString(), "--log=stdout", "--log-format=json"], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        proc.kill();
        reject(new Error("ngrok did not produce a tunnel URL within 10s. Is ngrok installed and authenticated?"));
      }
    }, 10_000);

    const onData = (chunk: Buffer) => {
      for (const line of chunk.toString().split("\n")) {
        if (!line.trim()) continue;
        try {
          const entry = JSON.parse(line);
          // ngrok v3 log entry when tunnel is up
          if (entry.url && typeof entry.url === "string" && entry.url.startsWith("https://")) {
            if (!settled) {
              settled = true;
              clearTimeout(timer);
              resolve({
                url: entry.url,
                close: () => proc.kill(),
              });
            }
          }
        } catch {
          // not JSON — ignore
        }
      }
    };

    proc.stdout.on("data", onData);
    proc.stderr.on("data", onData);

    proc.on("error", (err) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        reject(new Error(`Failed to start ngrok: ${err.message}. Is ngrok installed? (brew install ngrok)`));
      }
    });

    proc.on("exit", (code) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        reject(new Error(`ngrok exited with code ${code}. Run 'ngrok http ${port}' manually to diagnose.`));
      }
    });
  });
}
