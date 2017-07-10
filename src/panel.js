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
const Main = imports.ui.main;
const GLib = imports.gi.GLib;
const Signals = imports.signals;

const Me = imports.misc.extensionUtils.getCurrentExtension();
const Settings = Me.imports.settings;
const Util = Me.imports.util;

const PanelState = new Lang.Class({
  Name: 'PanelState',

  _init: function() {
    this.values = {
      playerName: null,
      status: null,
      trackTitle: null,
      trackAlbum: null,
      trackArtist: null,
      trackCoverUrl: null,
      desktopEntry: null
    }
  },

  update: function(state) {
    let changed = false;
    for (let key in state) {
      if (state[key] !== null
          && state[key].constructor === String
          && this.values[key] !== undefined
          && this.values[key] !== state[key]) {
        this.values[key] = state[key];
        changed = true;
      }
    }
    if (changed) {
      this.emit('changed');
    }
  }
});
Signals.addSignalMethods(PanelState.prototype);

const IndicatorMixin = {

  set manager(manager) {
    this._manager = manager;
    this.manager.connect('player-active-update', Lang.bind(this, this._commonOnActivePlayerUpdate));
    this.manager.connect('player-active-remove', Lang.bind(this, this._commonOnActivePlayerRemove));
    this.manager.connect('connect-signals', Lang.bind(this, this._connectSignals));
    this.manager.connect('disconnect-signals', Lang.bind(this, this._disconnectSignals));
  },

  get manager() {
    return this._manager;
  },

  _onScrollEvent: function(actor, event) {
    if (Settings.gsettings.get_boolean(Settings.MEDIAPLAYER_ENABLE_SCROLL_EVENTS_KEY)) {
      switch (event.get_scroll_direction()) {
        case Clutter.ScrollDirection.UP:
          this.manager.activePlayer.previous();
        break;
        case Clutter.ScrollDirection.DOWN:
          this.manager.activePlayer.next();
        break;
      }
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

  _connectSignals: function() {
    this.panelChangeId = this.panelState.connect('changed', Lang.bind(this, this._updatePanel));
    this._signalsId.push(this._settings.connect("changed::" + Settings.MEDIAPLAYER_COVER_STATUS_KEY,
      Lang.bind(this, function(settings, key) {
        this._useCoverInPanel = settings.get_boolean(key);
        this._updatePanel();
    })));
    this._signalsId.push(this._settings.connect("changed::" + Settings.MEDIAPLAYER_STATUS_TEXT_KEY,
      Lang.bind(this, function(settings, key) {
        this._stateTemplate = settings.get_string(key);
        this._updatePanel();
    })));
    this._signalsId.push(this._settings.connect("changed::" + Settings.MEDIAPLAYER_STATUS_SIZE_KEY,
      Lang.bind(this, function(settings, key) {
          this._prefWidth = settings.get_int(key);
          this._updatePanel();
    })));
  },

  _disconnectSignals: function() {
    if (this.panelChangeId != 0) {
      this.panelState.disconnect(this.panelChangeId);
      this.panelChangeId = 0;
    }
    for (let id in this._signalsId) {
      this._settings.disconnect(this._signalsId[id]);
    }
    this._signalsId = [];
  },

  // method binded to classes below
  _commonOnActivePlayerUpdate: function(manager, state) {
    this.panelState.update(state);
    this._onActivePlayerUpdate(state);
  },

  _updatePanel: function() {
    let state = this.panelState.values;
    if (state.status) {
      if (state.status == Settings.Status.PLAY) {
        this._secondaryIndicator.icon_name = "media-playback-start-symbolic";
      }
      else if (state.status == Settings.Status.PAUSE) {
        this._secondaryIndicator.icon_name = "media-playback-pause-symbolic";
      }
      else if (state.status == Settings.Status.STOP) {
        this._secondaryIndicator.icon_name = "media-playback-stop-symbolic";
      }
      this._secondaryIndicator.show();
      this._secondaryIndicator.set_width(-1);
      this.indicators.show();
    }

    if(this._stateTemplate.length === 0 || state.status == Settings.Status.STOP) {
      this._thirdIndicator.clutter_text.set_markup('');
      this._statusTextWidth = 0;
      this._stateText = '';
      this._thirdIndicator.hide();      
    }
    else if (state.playerName || state.trackTitle || state.trackArtist || state.trackAlbum) {
      let stateText = this.compileTemplate(this._stateTemplate, state);
      if (this._stateText != stateText) {
        this._thirdIndicator.clutter_text.set_markup(stateText);
        this._thirdIndicator.set_width(-1);
        this._statusTextWidth = this._thirdIndicator.get_width();
      }
      let desiredwidth = Math.min(this._prefWidth, this._statusTextWidth);
      let currentWidth = this._thirdIndicator.get_width();
      if (currentWidth != desiredwidth) {
        this._thirdIndicator.set_width(desiredwidth);
      }
      this._thirdIndicator.show();
    }

    if (state.trackCoverUrl || state.desktopEntry) {
      let fallbackIcon = this.getPlayerSymbolicIcon(state.desktopEntry);
      if (this._useCoverInPanel) {
          this.setCoverIconAsync(this._primaryIndicator, state.trackCoverUrl, fallbackIcon, true);
      }
      else if (this._primaryIndicator.icon_name != fallbackIcon) {
        this._primaryIndicator.icon_name = fallbackIcon;
      }
    }
  },

  _commonOnActivePlayerRemove: function(manager) {
    this._primaryIndicator.icon_name = 'audio-x-generic-symbolic';    
    this._thirdIndicator.clutter_text.set_markup('');
    this._thirdIndicator.set_width(0);
    this._secondaryIndicator.set_width(0);
    this._thirdIndicator.hide();
    this._secondaryIndicator.hide();
    this._onActivePlayerRemove();
  }
};

const PanelIndicator = new Lang.Class({
  Name: 'PanelIndicator',
  Extends: PanelMenu.Button,

  _init: function() {
    this.parent(0.0, "mediaplayer");

    this._manager = null;
    this.panelChangeId = 0;
    this.themeContext = St.ThemeContext.get_for_stage(global.stage);
    this.actor.add_style_class_name('panel-status-button');
    this.menu.actor.add_style_class_name('aggregate-menu dummy-style-class');
    this.compileTemplate = Util.compileTemplate;
    this.setCoverIconAsync = Util.setCoverIconAsync;
    this.getPlayerSymbolicIcon = Util.getPlayerSymbolicIcon;
    this.panelState = new PanelState();

    this._settings = Settings.gsettings;
    this._useCoverInPanel = this._settings.get_boolean(Settings.MEDIAPLAYER_COVER_STATUS_KEY);
    this._stateTemplate = this._settings.get_string(Settings.MEDIAPLAYER_STATUS_TEXT_KEY);
    this._prefWidth = this._settings.get_int(Settings.MEDIAPLAYER_STATUS_SIZE_KEY);
    this._statusTextWidth = 0;
    this._stateText = '';
    this._signalsId = [];

    this.indicators = new St.BoxLayout({vertical: false, style_class: 'system-status-icon'});

    this._primaryIndicator = new St.Icon({icon_name: 'audio-x-generic-symbolic',
                                          style_class: 'system-status-icon no-padding'});
    this._secondaryIndicator = new St.Icon({icon_name: 'media-playback-stop-symbolic',
                                            style_class: 'system-status-icon no-padding'});
    this._secondaryIndicator.hide();
    this._thirdIndicator = new St.Label({style_class: 'system-status-icon no-padding'});
    this._thirdIndicator.clutter_text.ellipsize = Pango.EllipsizeMode.END;
    this._thirdIndicatorBin = new St.Bin({child: this._thirdIndicator});
    this._thirdIndicator.hide();

    this.indicators.add(this._primaryIndicator);
    this.indicators.add(this._secondaryIndicator);
    this.indicators.add(this._thirdIndicatorBin);

    this.actor.add_actor(this.indicators);
    this.actor.connect('scroll-event', Lang.bind(this, this._onScrollEvent));
    this.actor.hide();
  },

  // Override PanelMenu.Button._onEvent
  _onEvent: function(actor, event) {
    if (this._onButtonEvent(actor, event) == Clutter.EVENT_PROPAGATE)
      this.parent(actor, event);
  },

  _onActivePlayerUpdate: function(state) {
    if (this.manager.activePlayer) {
      this.actor.show();
    }
  },

  _onActivePlayerRemove: function() {
    this.actor.hide();
  }
});
Util._extends(PanelIndicator, IndicatorMixin);

const AggregateMenuIndicator = new Lang.Class({
  Name: 'AggregateMenuIndicator',
  Extends: PanelMenu.SystemIndicator,

  _init: function() {
    this.parent();

    this._manager = null;
    this.panelChangeId = 0;
    this.themeContext = St.ThemeContext.get_for_stage(global.stage);
    this.compileTemplate = Util.compileTemplate;
    this.setCoverIconAsync = Util.setCoverIconAsync;
    this.getPlayerSymbolicIcon = Util.getPlayerSymbolicIcon;
    this._settings = Settings.gsettings;
    this.panelState = new PanelState();
    this._useCoverInPanel = this._settings.get_boolean(Settings.MEDIAPLAYER_COVER_STATUS_KEY);
    this._stateTemplate = this._settings.get_string(Settings.MEDIAPLAYER_STATUS_TEXT_KEY);
    this._prefWidth = this._settings.get_int(Settings.MEDIAPLAYER_STATUS_SIZE_KEY);
    this._statusTextWidth = 0;
    this._stateText = '';
    this._signalsId = [];
    this._primaryIndicator = this._addIndicator();
    this._primaryIndicator.icon_name = 'audio-x-generic-symbolic';
    this._primaryIndicator.style_class = 'system-status-icon no-padding'
    this._secondaryIndicator = this._addIndicator();
    this._secondaryIndicator.icon_name = 'media-playback-stop-symbolic';
    this._secondaryIndicator.style_class = 'system-status-icon no-padding';
    this._secondaryIndicator.hide();
    this._thirdIndicator = new St.Label({style_class: 'system-status-icon no-padding'});
    this._thirdIndicator.clutter_text.ellipsize = Pango.EllipsizeMode.END;
    this._thirdIndicator.hide();
    this._thirdIndicatorBin = new St.Bin({child: this._thirdIndicator});
    this.indicators.add_actor(this._thirdIndicatorBin);
    this.indicators.connect('scroll-event', Lang.bind(this, this._onScrollEvent));
    this.indicators.connect('button-press-event', Lang.bind(this, this._onButtonEvent));

    this.indicators.hide();
    this._settings.connect("changed::" + Settings.MEDIAPLAYER_HIDE_AGGINDICATOR_KEY, Lang.bind(this, function() {
      let alwaysHide = this._settings.get_boolean(Settings.MEDIAPLAYER_HIDE_AGGINDICATOR_KEY);
      if (alwaysHide) {
        this.indicators.hide();
      }
      else if (this.manager.activePlayer && this.manager.activePlayer.state.status != Settings.Status.STOP) {
        this.indicators.show();
      }
    }));
  },

  _onActivePlayerUpdate: function(state) {
    let alwaysHide = this._settings.get_boolean(Settings.MEDIAPLAYER_HIDE_AGGINDICATOR_KEY);
    if (state.status && state.status === Settings.Status.STOP || alwaysHide) {
      this.indicators.hide();
    }
    else if (state.status && !alwaysHide) {
      this.indicators.show();
    }
  },

  _onActivePlayerRemove: function() {
    this.indicators.hide();
    Main.panel.statusArea.aggregateMenu.menu.actor.set_width(-1);
  }
});
Util._extends(AggregateMenuIndicator, IndicatorMixin);
