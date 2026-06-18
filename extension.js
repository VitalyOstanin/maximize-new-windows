// SPDX-License-Identifier: GPL-2.0-or-later

import GLib from "gi://GLib";
import Meta from "gi://Meta";
import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";

export default class MaximizeNewWindows extends Extension {
  // GNOME 49+: get_maximized() became get_maximize_flags() and maximize() now
  // defaults to BOTH. Detect by get_maximize_flags() to support GNOME 45-50.
  _hasNewMaximizeApi(win) {
    return typeof win.get_maximize_flags === "function";
  }

  _isFullyMaximized(win) {
    const flags = this._hasNewMaximizeApi(win)
      ? win.get_maximize_flags() // GNOME 49+
      : win.get_maximized(); // GNOME 45-48

    return flags === Meta.MaximizeFlags.BOTH;
  }

  _doMaximize(win) {
    if (this._hasNewMaximizeApi(win)) {
      win.maximize(); // GNOME 49+: defaults to BOTH
    } else {
      win.maximize(Meta.MaximizeFlags.BOTH); // GNOME 45-48
    }
  }

  _maximize(win) {
    if (!win) return;

    // Only maximize normal windows; leave dialogs, popups and other
    // non-normal windows untouched.
    if (win.get_window_type() !== Meta.WindowType.NORMAL) return;

    if (!win.can_maximize()) return;

    if (this._isFullyMaximized(win)) return;

    // Zero size means geometry not settled yet; skip.
    const rect = win.get_frame_rect();
    if (rect.width === 0 || rect.height === 0) return;

    this._doMaximize(win);
  }

  _maximizeLater(win) {
    let sourceId = 0;
    sourceId = GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
      this._sources.delete(sourceId);
      this._maximize(win);
      return GLib.SOURCE_REMOVE;
    });
    this._sources.add(sourceId);
  }

  _onWindowCreated(win) {
    const actor = win.get_compositor_private();
    if (!actor) return;

    // Maximizing at window-created is frequently dropped (window-init race in
    // mutter); wait for first-frame, then defer to idle once geometry settled.
    // first-frame is one-shot: disconnect once it has fired.
    actor.connectObject(
      "first-frame",
      () => {
        actor.disconnectObject(this);
        this._maximizeLater(win);
      },
      this,
    );
  }

  enable() {
    this._sources = new Set();

    global.display.connectObject(
      "window-created",
      (_display, win) => this._onWindowCreated(win),
      this,
    );

    // Pre-existing windows (shell restart, or enabled with windows already open)
    // do not emit window-created; maximize them separately.
    for (const actor of global.get_window_actors()) {
      const win = actor.meta_window;
      if (win) this._maximizeLater(win);
    }
  }

  disable() {
    global.display.disconnectObject(this);

    // Disconnect first-frame handlers still pending; already-fired or destroyed
    // actors are a no-op.
    for (const actor of global.get_window_actors()) {
      actor.disconnectObject(this);
    }

    for (const id of this._sources) {
      GLib.Source.remove(id);
    }
    this._sources.clear();
    this._sources = null;
  }
}
