# Maximize New Windows

A minimal GNOME Shell extension that automatically maximizes newly created
normal windows, so applications open maximized by default.

## Table of Contents

- [What it does](#what-it-does)
- [Why first-frame instead of window-created](#why-first-frame-instead-of-window-created)
- [Compatibility](#compatibility)
- [Installation](#installation)
- [Development](#development)
- [How it works](#how-it-works)
- [Limitations](#limitations)
- [License](#license)

## What it does

When a new window of type `NORMAL` appears, the extension maximizes it in both
directions. Dialogs, popups and other non-normal windows are left untouched.
Already open windows are also maximized when the extension is enabled or after
GNOME Shell is restarted.

## Why first-frame instead of window-created

Maximizing a window directly in the `window-created` signal handler is
unreliable: at that point the `MetaWindowActor` exists but the window has not
been drawn yet, and the application has not negotiated its geometry. The
maximize request is frequently dropped, which shows up as an intermittent
failure ("sometimes the window is not maximized").

Instead, the extension waits for the actor's `first-frame` signal and then
defers the maximize call to a `GLib.idle_add` callback, by which point the
window geometry is settled. This pattern works reliably on both X11 and
Wayland.

## Compatibility

GNOME Shell 45-50.

The maximize API changed in GNOME 49 (see
[docs/ADR/0002-gnome-49-maximize-api-change.md](docs/ADR/0002-gnome-49-maximize-api-change.md)).
The extension detects the available API at runtime, so a single code base
covers all supported versions.

## Installation

### From source

```sh
git clone https://github.com/VitalyOstanin/maximize-new-windows.git
ln -s "$(pwd)/maximize-new-windows" \
  ~/.local/share/gnome-shell/extensions/maximize-new-windows@VitalyOstanin
```

Restart GNOME Shell:

- X11: press `Alt+F2`, type `r`, press Enter.
- Wayland: log out and log back in.

Enable it:

```sh
gnome-extensions enable maximize-new-windows@VitalyOstanin
```

## Development

The repository itself can live anywhere (for example `~/devel/maximize-new-windows`);
a symlink under `~/.local/share/gnome-shell/extensions/` makes GNOME Shell pick
it up.

Check the syntax without loading the extension:

```sh
node --check extension.js
```

See [CLAUDE.md](CLAUDE.md) for the procedure to verify and update the extension
against new GNOME Shell versions.

## How it works

- `enable()` connects to `global.display`'s `window-created` signal and
  maximizes all currently existing windows (`global.get_window_actors()`).
- For each new window, it connects to the actor's `first-frame` signal and then
  maximizes the window from a `GLib.idle_add` callback.
- Before maximizing, it checks the window type (`NORMAL`), `can_maximize()`, the
  current maximize state, and that the frame rectangle has a non-zero size.
- `disable()` disconnects every signal handler and removes every pending idle
  source.

## Limitations

- The extension only calls `maximize()`; it never unmaximizes a window.
- If an application restores its own saved geometry after `first-frame`, it may
  override the maximize. A follow-up `size-changed` reaction could be added if
  this occurs in practice.

## License

[GPL-2.0-or-later](LICENSE). GNOME Shell is GPL-2.0-or-later, and extensions are
derived works that must use compatible terms.
