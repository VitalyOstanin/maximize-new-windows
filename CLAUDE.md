# CLAUDE.md

Guidance for AI agents and contributors working on this extension.

## Table of Contents

- [Project overview](#project-overview)
- [Hard constraint: GNOME 45-50](#hard-constraint-gnome-45-50)
- [API surface used](#api-surface-used)
- [Known API differences across versions](#known-api-differences-across-versions)
- [Procedure: verify against a GNOME version](#procedure-verify-against-a-gnome-version)
- [Procedure: add support for a new GNOME version](#procedure-add-support-for-a-new-gnome-version)
- [Syntax check](#syntax-check)
- [Manual testing](#manual-testing)
- [Files](#files)

## Project overview

`maximize-new-windows` is a GNOME Shell extension that maximizes newly created
normal windows. The implementation rationale (why `first-frame` + `idle_add`
instead of maximizing in `window-created`) is recorded in
[docs/ADR](docs/ADR). Read the ADRs before changing the maximize timing.

## Hard constraint: GNOME 45-50

`metadata.json` declares `shell-version` 45 through 50. Every change MUST keep
the extension working across all of them. GNOME's API is not stable across
major versions, so any use of a Meta/Shell/GLib symbol must be verified against
each declared version (see the procedure below). Do not assume a method exists
just because it works on the locally installed version.

## API surface used

The extension depends on the following symbols. When changing the code, keep
this list in sync and re-verify each entry against every declared version.

| Symbol                                | Source        | Notes                                  |
| ------------------------------------- | ------------- | -------------------------------------- |
| `Extension` (ESM base class)          | gnome-shell   | `js/extensions/extension.js`, since 45 |
| `global.display` `window-created`     | gnome-shell   | signal                                 |
| `global.get_window_actors()`          | gnome-shell   | `src/shell-global.c`                   |
| `actor.meta_window`                   | mutter        | `meta-window` property of the actor    |
| `MetaWindowActor` `first-frame`       | mutter        | signal                                 |
| `win.get_compositor_private()`        | mutter        |                                        |
| `win.get_window_type()` / `WindowType.NORMAL` | mutter |                                        |
| `win.can_maximize()`                  | mutter        |                                        |
| `win.get_frame_rect()`                | mutter        | `.width` / `.height`                   |
| maximize state check                  | mutter        | version-dependent, see below           |
| maximize action                       | mutter        | version-dependent, see below           |
| `GLib.idle_add` / `PRIORITY_DEFAULT_IDLE` / `SOURCE_REMOVE` / `Source.remove` | GLib | stable |

## Known API differences across versions

The maximize API changed between GNOME 48 and 49 (verified against
`src/meta/window.h` on each branch):

| Aspect          | GNOME 45-48                          | GNOME 49-50                              |
| --------------- | ------------------------------------ | ---------------------------------------- |
| state query     | `get_maximized()` -> MaximizeFlags   | `is_maximized()` / `get_maximize_flags()`|
| maximize call   | `maximize(MaximizeFlags.BOTH)`       | `maximize()` (defaults to BOTH)          |

The code handles this with runtime feature detection: the presence of
`win.get_maximize_flags` indicates the GNOME 49+ API. See
[docs/ADR/0002-gnome-49-maximize-api-change.md](docs/ADR/0002-gnome-49-maximize-api-change.md).

## Procedure: verify against a GNOME version

Do not rely on training knowledge for whether a symbol exists; check the actual
source of the target branch. Use treeless clones of the upstream repositories so
the check is cheap.

```sh
cd /tmp
git clone --filter=blob:none https://github.com/GNOME/mutter.git
git clone --filter=blob:none https://github.com/GNOME/gnome-shell.git
```

List which `gnome-XX` branches exist (so you know the valid range):

```sh
gh api repos/GNOME/mutter/branches --paginate -q '.[].name' | grep -E '^gnome-[0-9]+$'
```

Check a Meta (mutter) symbol on a branch, e.g. the maximize API on gnome-49:

```sh
cd /tmp/mutter
git grep -nE 'meta_window_(maximize|get_maximized|is_maximized|get_maximize_flags)' \
  origin/gnome-49 -- src/meta/window.h
```

Check a Shell (gnome-shell) symbol, e.g. the ESM Extension class:

```sh
cd /tmp/gnome-shell
git grep -n 'class Extension' origin/gnome-50 -- js/extensions/extension.js
```

`git grep <ref>` against a treeless clone fetches only the blobs it needs, so
checking every branch in a loop is fast:

```sh
for v in 45 46 47 48 49 50; do
  echo "=== gnome-$v ==="
  git grep -nE 'meta_window_maximize ' origin/gnome-$v -- src/meta/window.h
done
```

When a signature differs across versions, read the C implementation to confirm
the default behaviour (for example, on gnome-50 `meta_window_maximize(window)`
calls `meta_window_set_maximize_flags(window, META_MAXIMIZE_BOTH)`).

## Procedure: add support for a new GNOME version

1. Confirm the `gnome-XX` branch exists in both `mutter` and `gnome-shell`.
2. Run the verification procedure above for every symbol in
   [API surface used](#api-surface-used).
3. For any symbol that changed, add runtime feature detection (do not branch on
   the shell version number) and record the change in a new ADR.
4. Add the version to `shell-version` in `metadata.json`.
5. Update the [Known API differences](#known-api-differences-across-versions)
   table and the README compatibility section.
6. Run the syntax check and a manual test.

## Syntax check

```sh
node --check extension.js
```

This validates ESM syntax without resolving `gi://` imports (Node cannot load
them, but `--check` does not execute the module).

## Manual testing

1. Symlink the repo into `~/.local/share/gnome-shell/extensions/`.
2. Restart GNOME Shell (X11: `Alt+F2`, `r`, Enter; Wayland: re-login).
3. `gnome-extensions enable maximize-new-windows@VitalyOstanin`.
4. Open several applications; confirm normal windows open maximized and dialogs
   do not get forced to maximize.
5. Check `journalctl -b /usr/bin/gnome-shell -p warning` for errors from the
   extension.

## Files

- `extension.js` — the whole implementation.
- `metadata.json` — uuid, name, description, `shell-version`, `version-name`.
- `stylesheet.css` — unused placeholder.
- `docs/ADR/` — architecture decision records.
