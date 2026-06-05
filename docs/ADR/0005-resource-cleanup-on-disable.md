# 0005 - Track and release all resources on disable

Status: Accepted

## Context

An earlier version connected a per-window `shown` handler but only disconnected
the `window-created` handler in `disable()`. The `shown` handlers were leaked.
GNOME Shell extensions must fully undo their effects in `disable()`, because the
shell enables and disables extensions repeatedly (for example on lock/unlock),
and leaked handlers accumulate and can fire after the extension is gone.

The current design creates two kinds of disposable resources per window: a
`first-frame` signal handler on the actor, and a `GLib.idle_add` source.

## Decision

Track every disposable resource and release all of them in `disable()`:

- The `window-created` handler id on `global.display`.
- Every active `first-frame` handler, kept in a set of `{actor, id}` entries;
  each entry is also removed from the set when the handler fires.
- Every pending idle source id, kept in a set; each id is removed from the set
  when its callback runs, and any still-pending ids are removed via
  `GLib.Source.remove` in `disable()`.

## Consequences

- No signal handlers or timers survive `disable()`.
- The bookkeeping (two sets) is the cost of the deferred maximize approach from
  ADR 0001 and the existing-window pass from ADR 0003.
- New disposable resources added later must be tracked the same way.
