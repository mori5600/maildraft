function invariant(value, message) {
  if (!value) {
    throw new Error(message || "Assertion failed.");
  }
}

function assert(value, message) {
  invariant(value, message);
}

assert.doesNotThrow = function doesNotThrow(callback, message) {
  try {
    callback();
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(message || error.message);
    }

    throw new Error(message || "Assertion failed.");
  }
};

assert.ok = function ok(value, message) {
  invariant(value, message);
};

assert.strictEqual = function strictEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(message || `Expected ${String(expected)}, received ${String(actual)}.`);
  }
};

assert.strict = assert;
assert.default = assert;

module.exports = assert;
