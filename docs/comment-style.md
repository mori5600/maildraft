# Comment Style

Comments in MailDraft exist to capture contracts that the code alone does not make obvious. Code should remain readable without comments.

## Principles

- Prefer naming, types, and function boundaries first. Comments are the last resort.
- Do not explain `HOW`. Write `WHAT` and, when needed, `WHY`.
- Do not restate the signature, narrate the code line by line, or explain what the reader can already see.
- Keep comments short, specific, and testable.
- Avoid vague language. Prioritize preconditions, failure modes, side effects, and invariants.

## Where To Document

- Use TSDoc on exported types, functions, and hooks that define contracts across module boundaries.
- Use rustdoc on `pub` types and functions that expose failure modes, side effects, ownership rules, persistence behavior, or recovery behavior.
- Use regular comments only for non-public code that still carries important design constraints or invariants.
- Do not add comments to thin adapters, appearance-driven components, or obvious model definitions.

## What To Cover

- Design intent
- Invariants
- Preconditions
- Failure modes
- Side effects
- Contracts related to persistence, recovery, and privacy

## TSDoc

- Start with one line that states the responsibility.
- Use `@remarks` only when design constraints or state semantics are not clear from the name.
- Use `@param` and `@returns` only when the contract is not already clear from names and types.
- Use `@example` only when the calling pattern is easy to misuse.

## Rustdoc

- Start with one line that states the responsibility.
- Use `# Errors` when failure cases are part of the API contract.
- Use `# Panics` only when panic is an intentional part of the design.
- Use `# Safety` only for APIs that involve `unsafe`.

## Review Checklist

- Remove the comment if naming or extraction can make the code clear enough.
- Remove the comment if it drifts into implementation narration.
- Prefer tests or types when they can express the same rule.
- Do not add a comment that the team is unlikely to keep accurate.
