// SPDX-License-Identifier: GPL-2.0-or-later

import GLib from "gi://GLib";
import Meta from "gi://Meta";
import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";

export default class MaximizeNewWindows extends Extension {
  // GNOME 49 changed the maximize API: get_maximized() was replaced by
  // is_maximized()/get_maximize_flags(), and maximize() lost its directions
  // argument (it now maximizes BOTH by default). Detect the new API by the
  // presence of get_maximize_flags() and branch accordingly, so the same
  // code works on GNOME 45-50.
  _isFullyMaximized(win) {
    const flags =
      typeof win.get_maximize_flags === "function"
        ? win.get_maximize_flags() // GNOME 49+
        : win.get_maximized(); // GNOME 45-48

    return flags === Meta.MaximizeFlags.BOTH;
  }

  _doMaximize(win) {
    if (typeof win.get_maximize_flags === "function") {
      win.maximize(); // GNOME 49+: defaults to BOTH
    } else {
      win.maximize(Meta.MaximizeFlags.BOTH); // GNOME 45-48
    }
  }

  _maximize(win) {
    if (!win) return;

    // Максимизируем только обычные окна; диалоги, всплывающие и
    // служебные окна не трогаем.
    if (win.get_window_type() !== Meta.WindowType.NORMAL) return;

    if (!win.can_maximize()) return;

    if (this._isFullyMaximized(win)) return;

    // К моменту вызова геометрия должна быть согласована; нулевой размер
    // означает, что окно ещё не готово — пропускаем.
    const rect = win.get_frame_rect();
    if (rect.width === 0 || rect.height === 0) return;

    this._doMaximize(win);
  }

  // Отложенный одноразовый вызов в idle с учётом в this._sources, чтобы
  // снять таймер в disable().
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

    // На сигнале window-created MetaWindowActor уже существует, но окно
    // ещё не отрисовано, а приложение не успело выставить геометрию.
    // Максимизация в этот момент часто отбрасывается (гонка инициализации
    // окна в mutter), отсюда плавающий промах. Ждём первый кадр, затем
    // откладываем максимизацию в idle, когда размеры уже согласованы.
    let firstFrameId = 0;
    firstFrameId = actor.connect("first-frame", () => {
      actor.disconnect(firstFrameId);
      this._actorSignals.delete(entry);
      this._maximizeLater(win);
    });

    const entry = { actor, id: firstFrameId };
    this._actorSignals.add(entry);
  }

  enable() {
    this._actorSignals = new Set();
    this._sources = new Set();

    this._windowCreatedId = global.display.connect(
      "window-created",
      (_display, win) => this._onWindowCreated(win),
    );

    // Уже существующие окна не порождают window-created (например, после
    // перезапуска gnome-shell через Alt+F2 r на X11, или при включении
    // расширения, когда окна уже открыты). Максимизируем их отдельно;
    // они уже отрисованы, поэтому достаточно отложить вызов в idle.
    for (const actor of global.get_window_actors()) {
      this._maximizeLater(actor.meta_window);
    }
  }

  disable() {
    if (this._windowCreatedId) {
      global.display.disconnect(this._windowCreatedId);
      this._windowCreatedId = null;
    }

    for (const { actor, id } of this._actorSignals) {
      actor.disconnect(id);
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
