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
const Clutter = imports.gi.Clutter;
const Pango = imports.gi.Pango;
const St = imports.gi.St;
const PanelMenu = imports.ui.panelMenu;
const GLib = imports.gi.GLib;

const Me = imports.misc.extensionUtils.getCurrentExtension();
const Settings = Me.imports.settings;


// method binded to classes below
let _onScrollEvent = function(actor, event) {
  switch (event.get_scroll_direction()) {
    case Clutter.ScrollDirection.UP:
      this.manager.activePlayer.previous();
      break;
    case Clutter.ScrollDirection.DOWN:
      this.manager.activePlayer.next();
      break;
  }
};

// method binded to classes below
let _onButtonEvent = function(actor, event) {
  if (event.type() == Clutter.EventType.BUTTON_PRESS) {
    let button = event.get_button();
    if (button == 2 && this.manager.activePlayer) {
      this.manager.activePlayer.playPause();
      return Clutter.EVENT_STOP;
    }
  }
  return Clutter.EVENT_PROPAGATE;
};

let _commonOnActivePlayerUpdate = function(manager, state) {
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
  }
};


const MediaplayerStatusButton = new Lang.Class({
    Name: 'MediaplayerStatusButton',
    Extends: PanelMenu.Button,

    _init: function() {
        this.parent(0.0, "mediaplayer");

        this._manager = null;

        this._coverPath = "";
        this._coverSize = 22;
        this._state = "";

        this.indicators = new St.BoxLayout({vertical: false, style_class: 'indicators'});

        this._primaryIndicator = new St.Icon({icon_name: 'audio-x-generic-symbolic',
                                              style_class: 'system-status-icon indicator'});
        this._secondaryIndicator = new St.Icon({icon_name: 'system-run-symbolic',
                                                style_class: 'secondary-indicator'});

        this._thirdIndicator = new St.Label({style_class: 'third-indicator'});
        this._thirdIndicator.clutter_text.ellipsize = Pango.EllipsizeMode.END;
        this._thirdIndicatorBin = new St.Bin({child: this._thirdIndicator,
                                         y_align: St.Align.MIDDLE});

        this.indicators.add(this._primaryIndicator);
        this.indicators.add(this._secondaryIndicator);
        this.indicators.add(this._thirdIndicatorBin);

        this.actor.add_actor(this.indicators);
        this.actor.add_style_class_name('panel-status-button');
        this.actor.connect('scroll-event', Lang.bind(this, _onScrollEvent));
    },

    set manager(manager) {
      this._manager = manager;
      this.manager.connect('player-active-update', Lang.bind(this, this._onActivePlayerUpdate));
      this.manager.connect('player-active-remove', Lang.bind(this, this._onActivePlayerRemove));
    },

    get manager() {
      return this._manager;
    },

    _formatStateText: function(stateText, playerState) {
      return stateText.replace(/{(\w+)\|?([^}]*)}/g, function(match, fieldName, appendText) {
        return playerState[fieldName]  + appendText || "";
      })
      .replace(/&/, "&amp;")
      .replace(/</, "&lt;")
      .replace(/>/, "&gt;");
    },

    _onActivePlayerUpdate: function(manager, state) {
      Lang.bind(this, _commonOnActivePlayerUpdate)(manager, state);

      if (state.trackTitle || state.trackArtist || state.trackAlbum || state.trackNumber) {
        let stateText = this._formatStateText(
          Settings.gsettings.get_string(Settings.MEDIAPLAYER_STATUS_TEXT_KEY),
          state
        );
        if (stateText) {
          this._thirdIndicator.clutter_text.set_markup(stateText);
          this._thirdIndicator.show();
        }
        else {
          this._thirdIndicator.hide();
        }
        // If You just set width it will add blank space. This makes sure the
        // panel uses the minimum amount of space.
        let prefWidth = Settings.gsettings.get_int(Settings.MEDIAPLAYER_STATUS_SIZE_KEY);
        this._thirdIndicator.clutter_text.set_width(-1);
        let statusTextWidth = this._thirdIndicator.clutter_text.get_width();
        if (statusTextWidth > prefWidth) {
          this._thirdIndicator.clutter_text.set_width(prefWidth);
        }
        else {
          this._thirdIndicator.clutter_text.set_width(-1);
        }

      }
    },

    _onActivePlayerRemove: function(manager) {
      this._clearStateText();
      this._secondaryIndicator.icon_name = "system-run-symbolic";
    },

    _clearStateText: function() {
        this._thirdIndicator.text = "";
        this._thirdIndicator.clutter_text.set_width(-1);
    },

    _showCover: function(player) {
        if (Settings.gsettings.get_enum(Settings.MEDIAPLAYER_STATUS_TYPE_KEY) == Settings.IndicatorStatusType.COVER &&
                this._coverPath != player.trackCoverPath) {
            this._coverPath = player.trackCoverPath;
            // Change cover
            if (this._coverPath && GLib.file_test(this._coverPath, GLib.FileTest.EXISTS)) {
                let cover = new St.Bin();
                let coverTexture = new Clutter.Texture({filter_quality: 2, filename: this._coverPath});
                let [coverWidth, coverHeight] = coverTexture.get_base_size();
                cover.height = this._coverSize;
                cover.width = this._coverSize;
                cover.set_child(coverTexture);
                this._bin.set_child(cover);
            }
            else
                this._bin.set_child(this._icon);
        }
    },

    // Override PanelMenu.Button._onEvent
    _onEvent: function(actor, event) {
      if (Lang.bind(this, _onButtonEvent)(actor, event) == Clutter.EVENT_PROPAGATE)
        this.parent(actor, event);
    }
});

const Indicator = new Lang.Class({
  Name: 'MediaplayerIndicator',
  Extends: PanelMenu.SystemIndicator,

  _init: function() {
    this.parent();

    this._manager = null;

    this._primaryIndicator = this._addIndicator();
    this._primaryIndicator.icon_name = 'audio-x-generic-symbolic';
    this._primaryIndicator.add_style_class_name('indicator');
    this._secondaryIndicator = this._addIndicator();
    this._secondaryIndicator.icon_name = 'media-playback-stop-symbolic';
    this._secondaryIndicator.style_class = 'secondary-indicator';
    this.indicators.connect('scroll-event', Lang.bind(this, _onScrollEvent));
    this.indicators.connect('button-press-event', Lang.bind(this, _onButtonEvent));
    this.indicators.style_class = 'indicators';
    this.indicators.hide();
  },

  set manager(manager) {
    this._manager = manager;
    this.manager.connect('player-active-update', Lang.bind(this, this._onActivePlayerUpdate));
    this.manager.connect('player-active-remove', Lang.bind(this, this._onActivePlayerRemove));
  },

  get manager() {
    return this._manager;
  },

  _onActivePlayerUpdate: function(manager, state) {
    Lang.bind(this, _commonOnActivePlayerUpdate)(manager, state);
    //if (player.info.appInfo)
      //this._primaryIndicator.gicon = player.info.appInfo.get_icon();
    this.indicators.show();
  },

  _onActivePlayerRemove: function(manager) {
    this.indicators.hide();
  }

});


