import { rename, access, constants, rm, readdir, readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { resolve } from "node:path";

const apiPath = "src/app/api";
const parkedApiPath = ".pages-api-disabled";

async function run(command, args) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`${command} exited with ${code}`)),
    );
  });
}

async function exists(path) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return false;
  }
}

async function sameFiles(left, right) {
  const a = (await readdir(left, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name));
  const b = (await readdir(right, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name));
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].name !== b[i].name) return false;
    const l = resolve(left, a[i].name), r = resolve(right, b[i].name);
    if (a[i].isDirectory() && b[i].isDirectory()) {
      if (!(await sameFiles(l, r))) return false;
    } else if (a[i].isFile() && b[i].isFile()) {
      if (!(await readFile(l)).equals(await readFile(r))) return false;
    } else return false;
  }
  return true;
}

// Preserve interrupted builds unless a complete, identical API copy is restored.
if (await exists(parkedApiPath)) {
  if (!(await exists(apiPath)) || !(await sameFiles(parkedApiPath, apiPath))) {
    throw new Error(`${parkedApiPath} contains an unrestored or different API. Restore it before rebuilding; nothing was deleted.`);
  }
  await rm(parkedApiPath, { recursive: true });
}
await rename(apiPath, parkedApiPath);
try {
  await run(process.execPath, [resolve("node_modules/next/dist/bin/next"), "build"]);
} finally {
  if (await exists(apiPath)) {
    if (!(await sameFiles(parkedApiPath, apiPath))) {
      throw new Error(`API changed during the build. Both copies were preserved in ${apiPath} and ${parkedApiPath}.`);
    }
  } else await rename(parkedApiPath, apiPath);
  await rm(parkedApiPath, { recursive: true, force: true });
}
