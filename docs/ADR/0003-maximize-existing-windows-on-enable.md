# 0003 - Maximize existing windows on enable

Status: Accepted

## Context

The extension reacts to the `window-created` signal, which fires only for new
windows. After restarting GNOME Shell (X11: `Alt+F2`, `r`) existing windows are
not recreated, so `window-created` does not fire for them. The same applies when
the extension is enabled while windows are already open. As a result, already
open windows were left un-maximized after a shell restart.

This is expected GNOME behaviour, not a bug in the extension: the extension only
ever calls `maximize()` and cannot un-maximize a window.

## Decision

In `enable()`, in addition to connecting the `window-created` handler, iterate
over `global.get_window_actors()` and schedule a maximize for each existing
window's `meta_window`. Existing windows have already drawn, so the deferred
`idle_add` path is sufficient and the same guards apply.

## Consequences

- Already open normal windows are maximized when the extension is enabled and
  after a shell restart.
- The idle sources created here are tracked alongside the others and released in
  `disable()` (see ADR 0005).
- Windows the user intentionally left un-maximized will be maximized on enable;
  this matches the extension's stated purpose (maximize all normal windows).
