function splitSegments(value: string): string[] {
  return value.split(/[\\/]+/).filter((segment) => segment.length > 0 && segment !== ".");
}

function normalizeSegments(segments: string[]): string[] {
  const normalized: string[] = [];

  for (const segment of segments) {
    if (segment === "..") {
      normalized.pop();
      continue;
    }

    normalized.push(segment);
  }

  return normalized;
}

export function normalize(value: string): string {
  if (!value) {
    return ".";
  }

  const isAbsolute = value.startsWith("/") || value.startsWith("\\");
  const normalizedSegments = normalizeSegments(splitSegments(value));
  const normalizedValue = normalizedSegments.join("/");

  if (isAbsolute) {
    return `/${normalizedValue}`.replace(/\/+$/, "") || "/";
  }

  return normalizedValue || ".";
}

export function join(...parts: string[]): string {
  return normalize(parts.filter((part) => part.length > 0).join("/"));
}

export function dirname(value: string): string {
  const normalized = normalize(value);

  if (normalized === "." || normalized === "/") {
    return normalized;
  }

  const segments = splitSegments(normalized);
  segments.pop();

  if (normalized.startsWith("/")) {
    return segments.length === 0 ? "/" : `/${segments.join("/")}`;
  }

  return segments.join("/") || ".";
}

export function resolve(...parts: string[]): string {
  const joined = parts.filter((part) => part.length > 0).join("/");

  if (!joined) {
    return "/";
  }

  return normalize(joined.startsWith("/") ? joined : `/${joined}`);
}

const shim = {
  dirname,
  join,
  normalize,
  resolve,
};

export default shim;
