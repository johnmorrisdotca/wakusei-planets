// A long local browser check holds the Mac awake, and lets go when that check exits.
// caffeinate -i is an idle-sleep assertion for this process only. It changes no power setting.
// Anywhere that is not a Mac, the command runs as given, so CI and other systems are unchanged.
import { spawn } from "node:child_process";
import { realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";

/**
 * The command that runs `args`, held awake on a Mac.
 * @param {string} platform `process.platform`
 * @param {readonly string[]} args the command and its arguments
 * @returns {{ command: string, args: string[] }}
 */
export function awakeCommand(platform, args) {
  if (args.length === 0) throw new Error("awake: name the command to run");
  if (platform === "darwin") return { command: "caffeinate", args: ["-i", ...args] };
  return { command: args[0], args: args.slice(1) };
}

function run() {
  const { command, args } = awakeCommand(process.platform, process.argv.slice(2));
  const child = spawn(command, args, { stdio: "inherit" });
  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, () => child.kill(signal));
  }
  child.on("exit", (code, signal) => {
    process.exit(code ?? (signal ? 1 : 1));
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) run();
