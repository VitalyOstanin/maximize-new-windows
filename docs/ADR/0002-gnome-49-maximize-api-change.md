# 0002 - Handle the GNOME 49 maximize API change

Status: Accepted

## Context

The maximize API in Mutter changed between GNOME 48 and 49. Verified against
`src/meta/window.h` on the upstream branches:

| Aspect        | GNOME 45-48                        | GNOME 49-50                               |
| ------------- | ---------------------------------- | ----------------------------------------- |
| state query   | `meta_window_get_maximized()`      | `meta_window_is_maximized()` / `meta_window_get_maximize_flags()` |
| maximize call | `meta_window_maximize(win, flags)` | `meta_window_maximize(win)` (no argument) |

On gnome-50, `meta_window_maximize(window)` is implemented as
`meta_window_set_maximize_flags(window, META_MAXIMIZE_BOTH)`, so the no-argument
form maximizes in both directions by default.

The original code called `win.get_maximized()` and
`win.maximize(Meta.MaximizeFlags.BOTH)`. That works on 45-48 but breaks on
49-50: `get_maximized` no longer exists, and GJS rejects the extra argument to
the now zero-argument `maximize()`.

## Decision

Detect the API at runtime rather than branching on the shell version number.
The presence of `win.get_maximize_flags` (a function) marks the GNOME 49+ API.

- State check: use `get_maximize_flags()` when available, otherwise
  `get_maximized()`; compare to `Meta.MaximizeFlags.BOTH`.
- Maximize: call `win.maximize()` with no argument when the new API is present,
  otherwise `win.maximize(Meta.MaximizeFlags.BOTH)`.

`Meta.MaximizeFlags.BOTH` and the enum exist on all of 45-50, so it is safe to
reference.

## Consequences

- A single code base covers GNOME 45-50 with no per-version files.
- Feature detection (not version numbers) keeps the code robust if a
  distribution backports or diverges from a clean version mapping.
- Any future maximize-API change requires re-checking this detection (see
  CLAUDE.md verification procedure).
