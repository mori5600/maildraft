export function ensureDetailedProofreadingRuntime() {
  const currentProcess = Reflect.get(globalThis, "process") as
    | {
        argv?: string[];
        cwd?: () => string;
        env?: Record<string, string | undefined>;
        hrtime?: ((time?: [number, number]) => [number, number]) & {
          bigint?: () => bigint;
        };
        on?: (eventName: string, listener: (...args: unknown[]) => void) => unknown;
      }
    | undefined;

  if (!currentProcess) {
    Reflect.set(globalThis, "process", createProcessShim());
    return;
  }

  if (typeof currentProcess.cwd !== "function") {
    currentProcess.cwd = () => "/";
  }

  if (!Array.isArray(currentProcess.argv)) {
    currentProcess.argv = [];
  }

  if (!currentProcess.env) {
    currentProcess.env = {};
  }

  if (typeof currentProcess.hrtime !== "function") {
    currentProcess.hrtime = createHrtimeShim();
  }

  if (typeof currentProcess.on !== "function") {
    currentProcess.on = () => undefined;
  }
}

export function unwrapModuleDefault<T>(value: T): T extends { default: infer U } ? U : T {
  return ((value as { default?: unknown }).default ?? value) as T extends { default: infer U }
    ? U
    : T;
}

function createProcessShim() {
  return {
    argv: [],
    cwd: () => "/",
    env: {},
    hrtime: createHrtimeShim(),
    on: () => undefined,
  };
}

function createHrtimeShim(): ((time?: [number, number]) => [number, number]) & {
  bigint?: () => bigint;
} {
  const hrtime = ((time?: [number, number]) => {
    const now = performance.now();
    const seconds = Math.floor(now / 1000);
    const nanoseconds = Math.floor((now - seconds * 1000) * 1_000_000);

    if (!time) {
      return [seconds, nanoseconds] as [number, number];
    }

    let deltaSeconds = seconds - time[0];
    let deltaNanoseconds = nanoseconds - time[1];

    if (deltaNanoseconds < 0) {
      deltaSeconds -= 1;
      deltaNanoseconds += 1_000_000_000;
    }

    return [deltaSeconds, deltaNanoseconds] as [number, number];
  }) as ((time?: [number, number]) => [number, number]) & {
    bigint?: () => bigint;
  };

  hrtime.bigint = () => BigInt(Math.floor(performance.now() * 1_000_000));

  return hrtime;
}
