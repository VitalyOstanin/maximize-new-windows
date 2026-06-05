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

  // Stop tracking an actor entry and disconnect both of its signals. Safe to
  // call more than once: the Set.delete() guard makes repeat calls no-ops.
  _cleanupEntry(entry) {
    if (!this._actorSignals.delete(entry)) return;
    if (entry.firstFrameId) entry.actor.disconnect(entry.firstFrameId);
    if (entry.destroyId) entry.actor.disconnect(entry.destroyId);
  }

  _onWindowCreated(win) {
    const actor = win.get_compositor_private();
    if (!actor) return;

    // At window-created the MetaWindowActor already exists, but the window has
    // not been drawn yet and the application has not negotiated its geometry.
    // Maximizing at this point is frequently dropped (a window-init race in
    // mutter), which is the intermittent miss. Wait for the first frame, then
    // defer the maximize to an idle callback once the size is settled.
    const entry = { actor, firstFrameId: 0, destroyId: 0 };

    entry.firstFrameId = actor.connect("first-frame", () => {
      this._cleanupEntry(entry);
      this._maximizeLater(win);
    });

    // The window can be destroyed before its first frame is drawn (a quickly
    // closed or crashed application): first-frame would never fire and the
    // entry would leak in _actorSignals, holding a reference to a destroyed
    // actor until disable(). Drop it on the actor's destroy as well.
    entry.destroyId = actor.connect("destroy", () => {
      this._cleanupEntry(entry);
    });

    this._actorSignals.add(entry);
  }

  enable() {
    this._actorSignals = new Set();
    this._sources = new Set();

    this._windowCreatedId = global.display.connect(
      "window-created",
      (_display, win) => this._onWindowCreated(win),
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
    if (this._windowCreatedId) {
      global.display.disconnect(this._windowCreatedId);
      this._windowCreatedId = null;
    }

    // Do not use _cleanupEntry here: it mutates the Set, which is unsafe while
    // iterating. Disconnect directly, then clear the whole set at once.
    for (const entry of this._actorSignals) {
      if (entry.firstFrameId) entry.actor.disconnect(entry.firstFrameId);
      if (entry.destroyId) entry.actor.disconnect(entry.destroyId);
    }
    this._actorSignals.clear();
    this._actorSignals = null;

    for (const id of this._sources) {
      GLib.Source.remove(id);
    }
    this._sources.clear();
    this._sources = null;
  }
}
