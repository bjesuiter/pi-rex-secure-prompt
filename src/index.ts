import { execFile } from "node:child_process";
import { isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

const run = promisify(execFile);
const approvalScript = fileURLToPath(new URL("./approve.lua", import.meta.url));
const askpass = fileURLToPath(
  new URL(process.platform === "darwin" ? "./askpass-macos" : "./askpass-linux", import.meta.url),
);

export default function (pi: ExtensionAPI) {
  let pending = false;

  pi.registerTool({
    name: "rex_sudo",
    label: "Rex sudo",
    description: "Run one command as root with user approval in Rex and local sudo authentication.",
    promptSnippet: "Run an approved sudo command through Rex.",
    promptGuidelines: [
      "Use rex_sudo for sudo commands in Rex. Never ask the user to share a password in chat or tool input.",
    ],
    parameters: Type.Object({
      executable: Type.String({ description: "Absolute path to the executable." }),
      args: Type.Array(Type.String(), { description: "Arguments passed directly to the executable." }),
    }),
    async execute(_id, { executable, args }, signal, _onUpdate, ctx) {
      const block = process.env.REX_BLOCK;
      if (!["darwin", "linux"].includes(process.platform) || !block) {
        return result("rex_sudo requires Pi to be running in a Rex terminal on macOS or Linux.");
      }
      const argv = [executable, ...args];
      if (!isAbsolute(executable) || argv.some((arg) => arg.includes("\0"))) {
        return result("Provide an absolute executable path and arguments without NUL characters.");
      }
      if (pending) return result("A sudo request is already in progress.");

      const request = JSON.stringify({ cwd: ctx.cwd, argv });
      if (request.length > 2048) return result("The command is too long for the Rex approval prompt.");

      pending = true;
      try {
        let approved: boolean;
        try {
          const { stdout } = await run("rex", [
            "--autostart=false", "--timeout", "100s", "do",
            "--block", block,
            "--action", "pi_sudo_approval", approvalScript,
            "--args", JSON.stringify({ request }),
          ], { signal, timeout: 105_000, maxBuffer: 16_384 });
          approved = JSON.parse(stdout)?.approved === true;
        } catch {
          return result("Rex approval could not be completed.");
        }

        if (!approved || signal?.aborted) {
          return result("Sudo request cancelled or declined.");
        }

        try {
          const command = run("/usr/bin/sudo", ["-k", "-A", "--", ...argv], {
            cwd: ctx.cwd,
            env: { ...process.env, SUDO_ASKPASS: askpass },
            signal,
            maxBuffer: 1_048_576,
          });
          command.child.stdin?.end();
          const { stdout, stderr } = await command;
          return result([stdout.trimEnd(), stderr.trimEnd()].filter(Boolean).join("\n") || "Command succeeded.");
        } catch (error) {
          if (signal?.aborted) return result("Sudo command cancelled.");
          if (error && typeof error === "object" && "code" in error && typeof error.code === "number") {
            return result(`Sudo exited with status ${error.code}. Authentication, sudo policy, or the command may have failed.`);
          }
          return result("Sudo could not complete the command or its output exceeded 1 MiB per stream.");
        }
      } finally {
        pending = false;
      }
    },
  });
}

function result(text: string) {
  return { content: [{ type: "text" as const, text }], details: {} };
}
