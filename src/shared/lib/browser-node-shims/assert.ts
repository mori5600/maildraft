interface AssertFunction {
  (value: unknown, message?: string): asserts value;
  doesNotThrow: (callback: () => unknown, message?: string) => void;
  ok: (value: unknown, message?: string) => asserts value;
  strictEqual: (actual: unknown, expected: unknown, message?: string) => void;
}

function invariant(value: unknown, message?: string): asserts value {
  if (!value) {
    throw new Error(message ?? "Assertion failed.");
  }
}

const assert = ((value: unknown, message?: string) => {
  invariant(value, message);
}) as AssertFunction;

assert.doesNotThrow = (callback, message) => {
  try {
    callback();
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(message ?? error.message);
    }

    throw new Error(message ?? "Assertion failed.");
  }
};

assert.ok = (value, message) => {
  invariant(value, message);
};

assert.strictEqual = (actual, expected, message) => {
  if (actual !== expected) {
    throw new Error(message ?? `Expected ${String(expected)}, received ${String(actual)}.`);
  }
};

export const doesNotThrow = assert.doesNotThrow;
export const ok = assert.ok;
export const strictEqual = assert.strictEqual;
export default assert;
