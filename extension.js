// SPDX-License-Identifier: GPL-2.0-or-later

import GLib from "gi://GLib";
import Meta from "gi://Meta";
import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";

export default class MaximizeNewWindows extends Extension {
  // GNOME 49 changed the maximize API: get_maximized() was replaced by
  // is_maximized()/get_maximize_flags(), and maximize() lost its directions
  // argument (it now maximizes BOTH by default). Detect the new API by the
  // presence of get_maximize_flags() so the same code works on GNOME 45-50.
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

    // By now the geometry should be settled; a zero size means the window is
    // not ready yet, so skip it.
    const rect = win.get_frame_rect();
    if (rect.width === 0 || rect.height === 0) return;

    this._doMaximize(win);
  }

  // One-shot deferred call in an idle callback, tracked in this._sources so
  // the timer can be removed in disable().
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

    // At window-created the MetaWindowActor already exists, but the window has
    // not been drawn yet and the application has not negotiated its geometry.
    // Maximizing at this point is frequently dropped (a window-init race in
    // mutter), which is the intermittent miss. Wait for the first frame, then
    // defer the maximize to an idle callback once the size is settled.
    //
    // connectObject ties the handler to `this` as its owner. The signal tracker
    // also disconnects it automatically when the actor is destroyed, so a window
    // closed before its first frame (a quickly closed or crashed application)
    // cannot leak a handler on a dead actor. first-frame is one-shot: disconnect
    // it once it has fired.
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

    // Already existing windows do not emit window-created (for example after a
    // gnome-shell restart via Alt+F2 r on X11, or when the extension is enabled
    // while windows are already open). Maximize them separately; they have
    // already been drawn, so deferring to an idle callback is enough.
    for (const actor of global.get_window_actors()) {
      const win = actor.meta_window;
      if (win) this._maximizeLater(win);
    }
  }

  disable() {
    global.display.disconnectObject(this);

    // Disconnect first-frame handlers still pending on windows that have not
    // drawn their first frame yet. Actors that already fired (and disconnected
    // themselves) or were destroyed (auto-disconnected by the signal tracker)
    // are a no-op here. This replaces the manual signal-id bookkeeping.
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
