import { rename, rm } from "node:fs/promises";
import { spawn } from "node:child_process";

const apiPath = "src/app/api";
const parkedApiPath = ".pages-api-disabled";

async function run(command, args) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", shell: true });
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`${command} exited with ${code}`)),
    );
  });
}

await rm(parkedApiPath, { recursive: true, force: true });
await rename(apiPath, parkedApiPath);
try {
  await run("pnpm", ["exec", "next", "build"]);
} finally {
  await rename(parkedApiPath, apiPath);
}
