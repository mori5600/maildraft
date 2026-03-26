import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const outputPath = path.join(rootDir, "THIRD-PARTY-NOTICES.txt");

const NOTICE_FILE_PATTERN = /^(LICENSE|LICENCE|COPYING|NOTICE)([.-].+)?$/i;
const SPECIAL_ATTRIBUTIONS = new Map([
  [
    "caniuse-lite",
    "Contains data from caniuse.com. Upstream declares this data is licensed under CC BY 4.0.",
  ],
]);

function normalizeText(text) {
  return text.replace(/\r\n/g, "\n").trim();
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function findNoticeFiles(packageDir) {
  if (!fs.existsSync(packageDir)) {
    return [];
  }

  return fs
    .readdirSync(packageDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && NOTICE_FILE_PATTERN.test(entry.name))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
}

function readNoticeEntries(packageDir) {
  return findNoticeFiles(packageDir)
    .map((fileName) => {
      const fullPath = path.join(packageDir, fileName);
      return {
        fileName,
        text: normalizeText(fs.readFileSync(fullPath, "utf8")),
      };
    })
    .filter((entry) => entry.text.length > 0);
}

function walkNodeModules() {
  const nodeModulesRoot = path.join(rootDir, "node_modules");
  const queue = [nodeModulesRoot];
  const packages = new Map();

  while (queue.length > 0) {
    const currentDir = queue.pop();
    if (!currentDir || !fs.existsSync(currentDir)) {
      continue;
    }

    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name.startsWith(".")) {
        continue;
      }

      const fullPath = path.join(currentDir, entry.name);
      if (entry.name.startsWith("@")) {
        queue.push(fullPath);
        continue;
      }

      const packageJsonPath = path.join(fullPath, "package.json");
      if (!fs.existsSync(packageJsonPath)) {
        continue;
      }

      const packageJson = readJson(packageJsonPath);
      const key = `${packageJson.name}@${packageJson.version}`;
      if (!packages.has(key)) {
        const license =
          packageJson.license ||
          (Array.isArray(packageJson.licenses)
            ? packageJson.licenses.map((item) => item.type || JSON.stringify(item)).join(" OR ")
            : "(missing)");

        packages.set(key, {
          ecosystem: "npm",
          name: packageJson.name,
          version: packageJson.version,
          license,
          notices: readNoticeEntries(fullPath),
        });
      }

      const nestedNodeModules = path.join(fullPath, "node_modules");
      if (fs.existsSync(nestedNodeModules)) {
        queue.push(nestedNodeModules);
      }
    }
  }

  return [...packages.values()].sort(comparePackages);
}

function readCargoMetadata() {
  const raw = execFileSync(
    "cargo",
    ["metadata", "--format-version", "1", "--locked", "--manifest-path", "src-tauri\\Cargo.toml"],
    {
      cwd: rootDir,
      encoding: "utf8",
      maxBuffer: 1024 * 1024 * 100,
    },
  );
  return JSON.parse(raw);
}

function walkCargoPackages() {
  const metadata = readCargoMetadata();

  return metadata.packages
    .filter((pkg) => pkg.name !== "maildraft")
    .map((pkg) => {
      const packageDir = path.dirname(pkg.manifest_path);
      return {
        ecosystem: "cargo",
        name: pkg.name,
        version: pkg.version,
        license: pkg.license || "(missing)",
        notices: readNoticeEntries(packageDir),
      };
    })
    .sort(comparePackages);
}

function comparePackages(left, right) {
  return (
    left.name.localeCompare(right.name) ||
    left.version.localeCompare(right.version) ||
    left.ecosystem.localeCompare(right.ecosystem)
  );
}

function renderInventory(title, packages) {
  const lines = [title, "-".repeat(title.length)];
  for (const pkg of packages) {
    lines.push(`- ${pkg.name}@${pkg.version} | ${pkg.license}`);
  }
  lines.push("");
  return lines;
}

function renderNoticeBlock(pkg) {
  const lines = [
    "=".repeat(80),
    `Package: ${pkg.name}@${pkg.version}`,
    `Ecosystem: ${pkg.ecosystem}`,
    `License: ${pkg.license}`,
  ];

  const attribution = SPECIAL_ATTRIBUTIONS.get(pkg.name);
  if (attribution) {
    lines.push(`Attribution: ${attribution}`);
  }

  if (pkg.notices.length === 0) {
    lines.push("Notice files: (none found in the installed package source)");
    lines.push("");
    return lines;
  }

  lines.push(`Notice files: ${pkg.notices.map((entry) => entry.fileName).join(", ")}`);
  lines.push("");

  for (const notice of pkg.notices) {
    lines.push(`[${notice.fileName}]`);
    lines.push(notice.text);
    lines.push("");
  }

  return lines;
}

function main() {
  const npmPackages = walkNodeModules();
  const cargoPackages = walkCargoPackages();
  const generatedOn = new Date().toISOString().slice(0, 10);

  const lines = [
    "MailDraft Third-Party Notices",
    "=============================",
    "",
    `Generated on: ${generatedOn}`,
    "App license: MIT",
    "",
    "This file lists third-party packages detected from the installed npm dependencies",
    "and Cargo metadata used to build MailDraft. Third-party components remain under",
    "their own licenses.",
    "",
    "Special attributions",
    "--------------------",
    "- caniuse-lite: Contains data from caniuse.com. Upstream declares this data is",
    "  licensed under CC BY 4.0.",
    "",
    ...renderInventory("npm packages", npmPackages),
    ...renderInventory("Rust crates", cargoPackages),
    "Detailed notices",
    "----------------",
    "",
  ];

  for (const pkg of [...npmPackages, ...cargoPackages]) {
    lines.push(...renderNoticeBlock(pkg));
  }

  fs.writeFileSync(outputPath, `${lines.join("\n")}\n`, "utf8");
}

main();
