import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

type Bump = "patch" | "minor" | "major";

const PKG_PATH = resolve(process.cwd(), "package.json");

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

function resolveNextVersion(current: string, arg: string): string {
  if (arg === "patch" || arg === "minor" || arg === "major") {
    return bumpVersion(current, arg);
  }
  if (/^\d+\.\d+\.\d+$/.test(arg)) return arg;
  throw new Error(`expected patch|minor|major or X.Y.Z, got: ${arg}`);
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
    // skip our own release-bump commits
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
    throw new Error(
      `working tree not clean — commit or stash first:\n${status}`,
    );
  }
}

function ensureOnMain() {
  const branch = sh("git rev-parse --abbrev-ref HEAD");
  if (branch !== "main") {
    throw new Error(`expected to be on main, currently on: ${branch}`);
  }
}

async function main() {
  const arg = process.argv[2];
  const shouldPush = process.argv.includes("--push");
  if (!arg) {
    console.error("usage: yarn release <patch|minor|major|X.Y.Z> [--push]");
    process.exit(1);
  }

  ensureOnMain();
  ensureCleanTree();

  const pkg = JSON.parse(readFileSync(PKG_PATH, "utf8")) as { version: string };
  const next = resolveNextVersion(pkg.version, arg);
  const tag = `v${next}`;

  const prev = lastTag();
  const changelog = commitsSince(prev);
  if (!changelog) {
    throw new Error(`no commits since ${prev ?? "repo start"} — nothing to release`);
  }

  const tagMessage = [
    `Release ${tag}`,
    "",
    prev ? `Changes since ${prev}:` : "Initial release:",
    "",
    changelog,
  ].join("\n");

  console.log(`bumping ${pkg.version} -> ${next}`);
  console.log(`\n--- tag annotation ---\n${tagMessage}\n----------------------\n`);

  pkg.version = next;
  writeFileSync(PKG_PATH, `${JSON.stringify(pkg, null, 2)}\n`);

  sh("git add package.json");
  sh(`git commit -m "chore(release): ${tag}"`);
  execSync(`git tag -a ${tag} -F -`, { input: tagMessage });

  console.log(`created commit + tag ${tag}`);

  if (shouldPush) {
    sh("git push --follow-tags");
    console.log(`pushed main + ${tag}`);
  } else {
    console.log(`\nnext: git push --follow-tags`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
