# 0006 - Declare and verify support for GNOME 45-50

Status: Accepted

## Context

The extension was originally written for GNOME 45 (ESM-based extensions) and its
`metadata.json` declared only `shell-version: ["45"]`. It happened to load on
GNOME 47 only because `org.gnome.shell disable-extension-version-validation` was
set to `true` locally. Relying on that switch is fragile and does not reflect
real compatibility.

GNOME's API changes across major versions (see ADR 0002 for the maximize API),
so declaring a version range is only meaningful if every used symbol is actually
verified against each version.

## Decision

Declare `shell-version: ["45", "46", "47", "48", "49", "50"]` and treat that
range as a hard constraint. Every API symbol the extension uses is verified
against each branch of upstream `mutter` and `gnome-shell` (via treeless clones
and `git grep`, see CLAUDE.md). API differences are handled with runtime feature
detection, not version-number branching.

All six branches were confirmed to exist in both repositories, and all used
symbols were verified present (with the maximize API handled per ADR 0002).

## Consequences

- The declared range reflects verified compatibility, not just an
  unvalidated optimistic list.
- Adding a future version (e.g. 51) requires running the verification procedure
  in CLAUDE.md, not just appending to the array.
- The ESM module format sets the lower bound at GNOME 45; supporting 44 or
  earlier would require a separate, non-ESM code base and is out of scope.
