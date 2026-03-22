# Implementation Guidelines

This document defines project-wide design rules for control flow and branching.

## Branching Rules

- Keep `if` branching as small as reasonably possible.
- Avoid long conditional chains in orchestration code, especially when behavior differs by type, rule, state, or field.
- When introducing processing branches, first evaluate whether the behavior should be modeled as a strategy.
- Prefer strategy maps, handler tables, and data-driven dispatch over repeated `if` or `switch` blocks when the branching axis is stable.
- Keep branch selection near the boundary and keep each branch implementation in a small pure function where possible.

## Strategy-First Heuristic

Use a strategy-oriented design first when one or more of the following is true:

- The same branching axis appears in multiple places.
- New cases are likely to be added over time.
- The branch body is non-trivial or has its own dependencies.
- The branch affects validation, transformation, rendering, or persistence behavior.
- The branch can be represented as data plus a handler.

## Functional Style Guidance

- Preserve functional composition where it already exists.
- Treat branch selection as data lookup when possible.
- Prefer pure transformation steps such as `input -> strategy -> result`.
- Isolate side effects at the boundary rather than inside each branch implementation.

## Review Checklist

- Can this conditional be replaced by a strategy map or handler table?
- Is the branching axis explicit in the data model?
- Can the branch body be extracted into a pure function?
- Are orchestration and per-case behavior separated?
- Will adding one new case require editing multiple conditionals? If yes, the design should be reconsidered.
