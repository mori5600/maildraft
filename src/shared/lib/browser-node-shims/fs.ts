function notAvailable(methodName: string): never {
  throw new Error(`${methodName} is not available in the browser worker.`);
}

export function existsSync(): boolean {
  return false;
}

export function readFileSync(): never {
  return notAvailable("readFileSync");
}

const shim = {
  existsSync,
  readFileSync,
};

export default shim;
