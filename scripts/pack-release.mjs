import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const buildDir = path.join(root, "build");
const outDir = path.join(root, "dist-release");

const manifestPath = path.join(root, "src", "manifest.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const version = String(manifest.version || "").trim();

if (!/^\d+\.\d+\.\d+$/.test(version)) {
  console.error(`Invalid manifest version: "${version}" (expected x.y.z)`);
  process.exit(1);
}

if (!fs.existsSync(path.join(buildDir, "manifest.json"))) {
  console.error("Missing build/manifest.json. Run `pnpm build` first.");
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });

const zipName = `amz-tracking-collector-${version}.zip`;
const zipPath = path.join(outDir, zipName);
const latestPath = path.join(outDir, "latest.json");

if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);

function zipBuild() {
  if (process.platform === "win32") {
    const ps = `
      $ErrorActionPreference = 'Stop'
      Compress-Archive -Path '${buildDir.replace(/'/g, "''")}\\*' -DestinationPath '${zipPath.replace(/'/g, "''")}' -Force
    `;
    const result = spawnSync(
      "powershell",
      ["-NoProfile", "-Command", ps],
      { stdio: "inherit" },
    );
    if (result.status !== 0) process.exit(result.status ?? 1);
    return;
  }

  const result = spawnSync("zip", ["-r", zipPath, "."], {
    cwd: buildDir,
    stdio: "inherit",
  });
  if (result.status !== 0) {
    console.error("zip failed. Install `zip` or run on Windows.");
    process.exit(result.status ?? 1);
  }
}

zipBuild();

const latest = {
  version,
  zip_name: zipName,
  released_at: new Date().toISOString(),
  notes: "",
};

fs.writeFileSync(latestPath, `${JSON.stringify(latest, null, 2)}\n`);

const tag = `v${version}`;
console.log(`\nPacked ${zipName}`);
console.log(`Also wrote ${path.relative(root, latestPath)}`);
console.log(`\nPublish with:`);
console.log(
  `  gh release create ${tag} "${path.relative(root, zipPath)}" "${path.relative(root, latestPath)}" --title "${tag}" --generate-notes`,
);
console.log(`\nOr push a tag to trigger CI:`);
console.log(`  git tag ${tag} && git push origin ${tag}`);
