# 0004 - Use `@VitalyOstanin` as the uuid namespace

Status: Accepted

## Context

The extension uuid was originally `maximize-new-windows@vitalyostanin.github.com`.
A uuid has the form `name@namespace`, where the namespace is conventionally a
domain the author controls or the author's username. `vitalyostanin.github.com`
is misleading: it is not a real personal domain. GitHub Pages personal sites use
`.github.io` (so it would be `vitalyostanin.github.io`), and `github.com` is the
site itself, not a personal subdomain.

The author's other extension uses `@VitalyOstanin` (the GitHub username), which
is accurate and consistent.

## Decision

Rename the uuid to `maximize-new-windows@VitalyOstanin`.

Because the uuid is the extension identifier, the rename requires:

1. Updating `uuid` in `metadata.json`.
2. Renaming the installation directory to match the uuid.
3. Replacing the old uuid in the `org.gnome.shell enabled-extensions` GSettings
   key.
4. Restarting GNOME Shell.

## Consequences

- The namespace is honest (a username the author owns) and consistent with the
  author's other extension.
- Any external reference to the old uuid (scripts, notes) must be updated.
- For publication on extensions.gnome.org, the uuid is fixed from the first
  submission, so settling it before publishing avoids a later migration.
