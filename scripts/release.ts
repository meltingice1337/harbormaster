import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { stdin, stdout } from "node:process";
import { createInterface, type Interface } from "node:readline/promises";

type Bump = "patch" | "minor" | "major";

const PKG_PATH = resolve(process.cwd(), "package.json");
const BAR = "─".repeat(60);

function sh(cmd: string): string {
  return execSync(cmd, { encoding: "utf8" }).trim();
}

function bumpVersion(current: string, kind: Bump): string {
  const [maj, min, pat] = current.split(".").map((n) => parseInt(n, 10));
  if ([maj, min, pat].some((n) => Number.isNaN(n))) {
    throw new Error(`unparseable version: ${current}`);
  }
  if (kind === "major") return `${maj + 1}.0.0`;
  if (kind === "minor") return `${maj}.${min + 1}.0`;
  return `${maj}.${min}.${pat + 1}`;
}

function lastTag(): string | null {
  try {
    return sh("git describe --tags --abbrev=0 --match 'v*'");
  } catch {
    return null;
  }
}

function commitsSince(tag: string | null): string {
  const range = tag ? `${tag}..HEAD` : "HEAD";
  const log = sh(`git log ${range} --no-merges --pretty=format:%h%x09%s`);
  if (!log) return "";
  const lines = log.split("\n").filter((l) => {
    const subject = l.split("\t")[1] ?? "";
    return !/^chore\(release\):/i.test(subject);
  });
  return lines
    .map((l) => {
      const [hash, ...rest] = l.split("\t");
      return `- ${rest.join("\t")} (${hash})`;
    })
    .join("\n");
}

function ensureCleanTree() {
  const status = sh("git status --porcelain");
  if (status) {
    throw new Error(`working tree not clean — commit or stash first:\n${status}`);
  }
}

function ensureOnMain() {
  const branch = sh("git rev-parse --abbrev-ref HEAD");
  if (branch !== "main") {
    throw new Error(`expected to be on main, currently on: ${branch}`);
  }
}

async function pickVersion(rl: Interface, current: string): Promise<string> {
  const patch = bumpVersion(current, "patch");
  const minor = bumpVersion(current, "minor");
  const major = bumpVersion(current, "major");

  console.log(`current version: ${current}\n`);
  console.log("  1) patch   →  " + patch + "    (bug fixes)");
  console.log("  2) minor   →  " + minor + "    (new features, backwards compatible)");
  console.log("  3) major   →  " + major + "    (breaking changes)");
  console.log("  4) custom  →  enter your own X.Y.Z\n");

  while (true) {
    const ans = (await rl.question("choose [1-4]: ")).trim();
    if (ans === "1" || ans.toLowerCase() === "patch") return patch;
    if (ans === "2" || ans.toLowerCase() === "minor") return minor;
    if (ans === "3" || ans.toLowerCase() === "major") return major;
    if (ans === "4" || ans.toLowerCase() === "custom") {
      const custom = (await rl.question("enter version (X.Y.Z): ")).trim();
      if (/^\d+\.\d+\.\d+$/.test(custom)) return custom;
      console.log(`  ✗ "${custom}" is not a valid X.Y.Z — try again`);
      continue;
    }
    console.log("  ✗ pick 1, 2, 3, or 4");
  }
}

async function confirm(rl: Interface, question: string, defaultYes = true): Promise<boolean> {
  const suffix = defaultYes ? "[Y/n]" : "[y/N]";
  const ans = (await rl.question(`${question} ${suffix} `)).trim().toLowerCase();
  if (!ans) return defaultYes;
  return ans === "y" || ans === "yes";
}

async function main() {
  ensureOnMain();
  ensureCleanTree();

  const pkg = JSON.parse(readFileSync(PKG_PATH, "utf8")) as { version: string };
  const prev = lastTag();
  const changelog = commitsSince(prev);
  if (!changelog) {
    throw new Error(`no commits since ${prev ?? "repo start"} — nothing to release`);
  }

  if (!stdin.isTTY) {
    throw new Error("release script requires an interactive terminal");
  }
  const rl = createInterface({ input: stdin, output: stdout });

  try {
    console.log(`\n${BAR}\n  Harbormaster release\n${BAR}`);

    const next = await pickVersion(rl, pkg.version);
    const tag = `v${next}`;

    const tagMessage = [
      `Release ${tag}`,
      "",
      prev ? `Changes since ${prev}:` : "Initial release:",
      "",
      changelog,
    ].join("\n");

    console.log(`\n${BAR}\n  Plan\n${BAR}`);
    console.log(`  package.json : ${pkg.version}  →  ${next}`);
    console.log(`  git tag      : ${tag}`);
    console.log(`  since        : ${prev ?? "(initial release)"}`);
    console.log(`  branch       : main`);
    console.log(BAR);
    console.log(tagMessage);
    console.log(`${BAR}\n`);

    if (!(await confirm(rl, "Update package.json + create commit + tag?"))) {
      console.log("aborted — no changes made");
      return;
    }

    pkg.version = next;
    writeFileSync(PKG_PATH, `${JSON.stringify(pkg, null, 2)}\n`);
    sh("git add package.json");
    sh(`git commit -m "chore(release): ${tag}"`);
    execSync(`git tag -a ${tag} -F -`, { input: tagMessage });
    console.log(`\n✓ updated package.json, created commit + tag ${tag}`);

    if (await confirm(rl, "Push to origin now?")) {
      sh("git push --follow-tags");
      console.log(`✓ pushed main + ${tag} — release workflow will build the image`);
    } else {
      console.log(`\nleft local. push when ready:  git push --follow-tags`);
    }
  } finally {
    rl.close();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
