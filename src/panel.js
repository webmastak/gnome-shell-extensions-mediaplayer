/* -*- mode: js2; js2-basic-offset: 4; indent-tabs-mode: nil -*- */
/* jshint esnext: true */
/* jshint -W097 */
/* global imports: false */
/**
    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 2 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.
**/

'use strict';

const Lang = imports.lang;
const Gio = imports.gi.Gio;
const Clutter = imports.gi.Clutter;
const Pango = imports.gi.Pango;
const St = imports.gi.St;
const PanelMenu = imports.ui.panelMenu;
const GLib = imports.gi.GLib;

const Me = imports.misc.extensionUtils.getCurrentExtension();
const Settings = Me.imports.settings;
const Lib = Me.imports.lib;
const Widget = Me.imports.widget;

const IndicatorMixin = {

  set manager(manager) {
    this._manager = manager;
    this.manager.connect('player-active-update', Lang.bind(this, this._commonOnActivePlayerUpdate));
    this.manager.connect('player-active-remove', Lang.bind(this, this._commonOnActivePlayerRemove));
  },

  get manager() {
    return this._manager;
  },

  _onScrollEvent: function(actor, event) {
    switch (event.get_scroll_direction()) {
      case Clutter.ScrollDirection.UP:
        this.manager.activePlayer.previous();
      break;
      case Clutter.ScrollDirection.DOWN:
        this.manager.activePlayer.next();
      break;
    }
  },

  _onButtonEvent: function(actor, event) {
    if (event.type() == Clutter.EventType.BUTTON_PRESS) {
      let button = event.get_button();
      if (button == 2 && this.manager.activePlayer) {
        this.manager.activePlayer.playPause();
        return Clutter.EVENT_STOP;
      }
    }
    return Clutter.EVENT_PROPAGATE;
  },

  // method binded to classes below
  _commonOnActivePlayerUpdate: function(manager, state) {
    this.playerStatusIndicator.updateState(state);
    this.playerStatusIndicator.show();

    try {
      this._onActivePlayerUpdate(manager, state);
    }
    catch (err) {}

  },

  _commonOnActivePlayerRemove: function(manager) {
    this.playerStatusIndicator.clearStateText();
    if (Settings.gsettings.get_boolean(Settings.MEDIAPLAYER_RUN_DEFAULT)) {
      this.playerStatusIndicator.setActivePlayerRemoved();
      this.playerStatusIndicator.show();
    }
    else {
      this.playerStatusIndicator.hide();
    }

    try {
      this._onActivePlayerRemove(manager);
    }
    catch (err) {}
  }
};

const PanelIndicator = new Lang.Class({
  Name: 'PanelIndicator',
  Extends: PanelMenu.Button,

  _init: function() {
    this.parent(0.0, "mediaplayer");

    this._manager = null;
    this.menu.actor.add_style_class_name('mediaplayer-menu');
    this.playerStatusIndicator = new Widget.PlayerStatusIndicator(true);

    this.actor.add_actor(this.playerStatusIndicator);
    this.actor.add_style_class_name('panel-status-button');
    this.actor.connect('scroll-event', Lang.bind(this, this._onScrollEvent));
  },

  // Override PanelMenu.Button._onEvent
  _onEvent: function(actor, event) {
    if (this._onButtonEvent(actor, event) == Clutter.EVENT_PROPAGATE)
      this.parent(actor, event);
  }
});
Lib._extends(PanelIndicator, IndicatorMixin);

const AggregateMenuIndicator = new Lang.Class({
  Name: 'AggregateMenuIndicator',
  Extends: PanelMenu.SystemIndicator,

  _init: function() {
    this.parent();

    this._manager = null;
    this.playerStatusIndicator = new Widget.PlayerStatusIndicator(true);

    this.indicators.add_actor(this.playerStatusIndicator);
    this.indicators.connect('scroll-event', Lang.bind(this, this._onScrollEvent));
    this.indicators.connect('button-press-event', Lang.bind(this, this._onButtonEvent));
    this.indicators.style_class = 'indicators';

    this.indicators.hide();
  },

  _onActivePlayerUpdate: function(manager, state) {
    if (state.status && state.status === Settings.Status.STOP) {
      this.indicators.hide();
    }
    else if (state.status) {
      this.indicators.show();
    }
  },

  _onActivePlayerRemove: function(manager, state) {
    this.indicators.hide();
  }
});
Lib._extends(AggregateMenuIndicator, IndicatorMixin);
