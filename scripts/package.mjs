import { cp, mkdir, readFile, rm } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { execFileSync } from "node:child_process";

const root = resolve(import.meta.dirname, "..");
const dist = resolve(root, "dist");
const release = resolve(root, "release");
const manifest = JSON.parse(await readFile(resolve(root, "manifest.json"), "utf8"));
const archive = resolve(release, `free-games-tracker-${manifest.version}.zip`);
const runtimePaths = ["manifest.json", "popup.html", "src", "styles", "icons"];

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await mkdir(release, { recursive: true });

for (const relativePath of runtimePaths) {
  const source = resolve(root, relativePath);
  const destination = resolve(dist, relativePath);
  await mkdir(dirname(destination), { recursive: true });
  await cp(source, destination, { recursive: true });
}

await rm(archive, { force: true });
execFileSync("zip", ["-qr", archive, "."], { cwd: dist });
console.log(`Created ${basename(archive)}`);
