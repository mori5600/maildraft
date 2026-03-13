import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const sourceRoot = path.resolve(scriptDir, "..", "src");
const supportedExtensions = new Set([".css", ".html", ".js", ".jsx", ".ts", ".tsx"]);
const colorVariablePattern = /([A-Za-z0-9_-]+)-\[var\((--[^)\]]+)\)\]/g;
const spacingUtilityPattern =
  /((?:min-|max-)?(?:w|h)|(?:p|px|py|pt|pr|pb|pl|m|mx|my|mt|mr|mb|ml|gap|gap-x|gap-y|inset|inset-x|inset-y|top|right|bottom|left))-\[(\d+)px\]/g;
const roundedPattern = /((?:rounded)(?:-[a-z]{1,2})?(?:-[a-z]{1,2})?)-\[(\d+)px\]/g;
const fontSizePattern = /text-\[(\d+)px\]/g;
const canonicalAliasMap = new Map([["break-words", "wrap-break-word"]]);

const roundedScaleMap = new Map([
  ["2", "xs"],
  ["6", "md"],
  ["8", "lg"],
  ["12", "xl"],
  ["16", "2xl"],
  ["24", "3xl"],
  ["32", "4xl"],
]);

const fontSizeScaleMap = new Map([
  ["12", "xs"],
  ["14", "sm"],
  ["16", "base"],
  ["18", "lg"],
  ["20", "xl"],
  ["24", "2xl"],
  ["30", "3xl"],
  ["36", "4xl"],
  ["48", "5xl"],
  ["60", "6xl"],
  ["72", "7xl"],
  ["96", "8xl"],
  ["128", "9xl"],
]);

async function collectFiles(rootDir) {
  const entries = await readdir(rootDir, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(rootDir, entry.name);

      if (entry.isDirectory()) {
        return collectFiles(entryPath);
      }

      if (supportedExtensions.has(path.extname(entry.name))) {
        return [entryPath];
      }

      return [];
    }),
  );

  return nested.flat();
}

function getLineAndColumn(sourceText, index) {
  const lines = sourceText.slice(0, index).split("\n");

  return {
    line: lines.length,
    column: lines.at(-1).length + 1,
  };
}

function formatSpacingScale(pixelValue) {
  const scaleValue = pixelValue / 4;

  return Number.isInteger(scaleValue)
    ? String(scaleValue)
    : String(scaleValue).replace(/\.0+$/, "");
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function collectMatches(sourceText, filePath) {
  const relativePath = path.relative(process.cwd(), filePath);
  const findings = [];

  for (const match of sourceText.matchAll(colorVariablePattern)) {
    const [foundClass, utilityName, variableName] = match;
    const { line, column } = getLineAndColumn(sourceText, match.index);

    findings.push({
      column,
      filePath: relativePath,
      foundClass,
      line,
      suggestedClass: `${utilityName}-(${variableName})`,
    });
  }

  for (const match of sourceText.matchAll(spacingUtilityPattern)) {
    const [foundClass, utilityName, rawPixelValue] = match;
    const pixelValue = Number(rawPixelValue);

    const { line, column } = getLineAndColumn(sourceText, match.index);

    findings.push({
      column,
      filePath: relativePath,
      foundClass,
      line,
      suggestedClass: `${utilityName}-${formatSpacingScale(pixelValue)}`,
    });
  }

  for (const match of sourceText.matchAll(roundedPattern)) {
    const [foundClass, utilityName, rawPixelValue] = match;
    const roundedScale = roundedScaleMap.get(rawPixelValue);

    if (!roundedScale) {
      continue;
    }

    const { line, column } = getLineAndColumn(sourceText, match.index);

    findings.push({
      column,
      filePath: relativePath,
      foundClass,
      line,
      suggestedClass: `${utilityName}-${roundedScale}`,
    });
  }

  for (const match of sourceText.matchAll(fontSizePattern)) {
    const [foundClass, rawPixelValue] = match;
    const fontSizeScale = fontSizeScaleMap.get(rawPixelValue);

    if (!fontSizeScale) {
      continue;
    }

    const { line, column } = getLineAndColumn(sourceText, match.index);

    findings.push({
      column,
      filePath: relativePath,
      foundClass,
      line,
      suggestedClass: `text-${fontSizeScale}`,
    });
  }

  for (const [legacyClassName, canonicalClassName] of canonicalAliasMap) {
    const aliasPattern = new RegExp(
      `(?<![A-Za-z0-9_-])${escapeRegExp(legacyClassName)}(?![A-Za-z0-9_-])`,
      "g",
    );

    for (const match of sourceText.matchAll(aliasPattern)) {
      const [foundClass] = match;
      const { line, column } = getLineAndColumn(sourceText, match.index);

      findings.push({
        column,
        filePath: relativePath,
        foundClass,
        line,
        suggestedClass: canonicalClassName,
      });
    }
  }

  return findings;
}

async function main() {
  const files = await collectFiles(sourceRoot);
  const findings = [];

  for (const filePath of files) {
    const sourceText = await readFile(filePath, "utf8");
    findings.push(...collectMatches(sourceText, filePath));
  }

  if (findings.length === 0) {
    console.log("Tailwind canonical class check passed.");
    return;
  }

  console.error("Tailwind canonical class check failed:");

  for (const finding of findings) {
    console.error(
      `${finding.filePath}:${finding.line}:${finding.column} ${finding.foundClass} -> ${finding.suggestedClass}`,
    );
  }

  process.exitCode = 1;
}

await main();
