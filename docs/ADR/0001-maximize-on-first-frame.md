# 0001 - Maximize on first-frame, deferred via idle

Status: Accepted

## Context

The first implementation maximized a window from the `window-created` signal
handler and additionally from the window's `shown` signal. This produced an
intermittent failure: windows sometimes opened un-maximized, with no obvious
pattern.

The cause is a timing/race condition. According to the upstream documentation
of `Meta.Display::window-created`, when that signal fires the `MetaWindowActor`
already exists but the window has not been drawn yet, and the application has
not negotiated its geometry. A `maximize()` call at that moment is frequently
dropped. The `shown` signal fires earlier than the application restoring its own
geometry for many apps, so it is also unreliable. With no retry, if both moments
missed, the window stayed un-maximized.

The GNOME Discourse thread on reliably resizing a window right after creation
recommends waiting for the actor's `first-frame` signal and then deferring the
operation to a `GLib.idle_add` callback, after which the geometry is settled.

## Decision

Maximize a new window by:

1. Connecting to the `first-frame` signal of the window's `MetaWindowActor`
   (obtained via `win.get_compositor_private()`).
2. From that handler, scheduling the maximize through
   `GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, ...)`.
3. Guarding the maximize with checks: window type `NORMAL`, `can_maximize()`,
   not already fully maximized, and a non-zero `get_frame_rect()`.

Do not maximize directly in `window-created` or `shown`.

## Consequences

- The intermittent miss is eliminated; the approach works on X11 and Wayland.
- Slightly more bookkeeping: the `first-frame` handler and the idle source must
  be tracked and released (see ADR 0005).
- A residual edge case remains: an application that restores its own geometry
  after `first-frame` can override the maximize. If observed in practice, react
  to `size-changed` as a follow-up.
