// The registry and the directories on disk must agree, in both directions.
//
// A template listed with no directory is a picker entry that 404s on click. A
// directory with no entry is work nobody can reach. Both are silent until a
// user hits them, so they are checked here instead.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const registry = JSON.parse(readFileSync(join(root, "templates.json"), "utf8"));
const problems = [];

if (registry.version !== 1) {
  problems.push(`templates.json version must be 1, found ${registry.version}`);
}

const listed = new Set();
for (const entry of registry.templates ?? []) {
  const where = `templates.json: ${entry.id ?? "(no id)"}`;

  // The id is a URL path segment and a directory name, so it is kept to the
  // characters that are safe in both.
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(entry.id ?? "")) {
    problems.push(`${where}: id must be lowercase words joined by hyphens`);
    continue;
  }
  if (listed.has(entry.id)) problems.push(`${where}: duplicate id`);
  listed.add(entry.id);

  for (const field of ["name", "description"]) {
    if (typeof entry[field] !== "string" || !entry[field].trim()) {
      problems.push(`${where}: ${field} is required`);
    }
  }
  if (!Array.isArray(entry.tags) || entry.tags.some((t) => typeof t !== "string")) {
    problems.push(`${where}: tags must be an array of strings`);
  }
  // Never use an em-dash in copy that reaches a user.
  if (`${entry.name}${entry.description}`.includes("—")) {
    problems.push(`${where}: no em-dashes in copy`);
  }

  const dir = join(root, "templates", entry.id);
  try {
    if (!statSync(dir).isDirectory()) throw new Error("not a directory");
  } catch {
    problems.push(`${where}: templates/${entry.id}/ does not exist`);
    continue;
  }

  // npm ci is what the builder runs, and it refuses to run without a lockfile.
  for (const required of ["package.json", "package-lock.json", ".env.example"]) {
    try {
      statSync(join(dir, required));
    } catch {
      problems.push(`templates/${entry.id}: ${required} is missing`);
    }
  }

  const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
  for (const script of ["dev", "build", "typecheck"]) {
    if (!pkg.scripts?.[script]) {
      problems.push(`templates/${entry.id}: package.json needs a ${script} script`);
    }
  }
  if (!pkg.dependencies?.["@resultdev/sdk"]) {
    problems.push(`templates/${entry.id}: must depend on @resultdev/sdk`);
  }
}

for (const dir of readdirSync(join(root, "templates"))) {
  if (!listed.has(dir)) {
    problems.push(`templates/${dir}/ exists but is not listed in templates.json`);
  }
}

if (problems.length) {
  console.error(problems.map((p) => `  ${p}`).join("\n"));
  process.exit(1);
}
console.log(`Registry OK: ${listed.size} template(s).`);
