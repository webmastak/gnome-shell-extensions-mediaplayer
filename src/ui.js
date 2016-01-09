/* -*- mode: js2; js2-basic-offset: 4; indent-tabs-mode: nil -*- */
/* jshint esnext: true */
/* jshint -W097 */
/* global imports: false */
/* global global: false */
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

const Mainloop = imports.mainloop;
const Gio = imports.gi.Gio;
const Lang = imports.lang;
const Clutter = imports.gi.Clutter;
const Shell = imports.gi.Shell;
const St = imports.gi.St;
const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;
const GLib = imports.gi.GLib;
const Tweener = imports.ui.tweener;
const BoxPointer = imports.ui.boxpointer;

const Gettext = imports.gettext.domain('gnome-shell-extensions-mediaplayer');
const _ = Gettext.gettext;

const Me = imports.misc.extensionUtils.getCurrentExtension();
const Widget = Me.imports.widget;
const Settings = Me.imports.settings;
const Player = Me.imports.player;
const Lib = Me.imports.lib;


const PlayerMenu = new Lang.Class({
  Name: 'PlayerMenu',
  Extends: PopupMenu.PopupSubMenuMenuItem,

  _init: function(label, wantIcon) {
    this.parent(label, wantIcon);
    this.menu._close = this.menu.close;
    this.menu._open = this.menu.open;
    this.menu.close = Lang.bind(this, this.close);
    this.menu.open = Lang.bind(this, this.open);
  },

  addMenuItem: function(item) {
    this.menu.addMenuItem(item);
  },

  /* Submenu can be closed only manually by
   * setSubmenuShown (clicking on the player name
   *  or by the manager when another player menu
   * is opened */
  close: function(animate, force) {
    if (force !== true)
      return;
    this.menu._close(BoxPointer.PopupAnimation.FULL);
    this.emit('player-menu-closed');
  },

  open: function(animate) {
    if (!animate)
      animate = BoxPointer.PopupAnimation.FULL;
    this.menu._open(animate);
    this.emit('player-menu-opened');
  },

  setSubmenuShown: function(open) {
    if (open)
      this.menu.open(BoxPointer.PopupAnimation.FULL);
    else
      this.menu.close(BoxPointer.PopupAnimation.FULL, true);
  }

});


const DefaultPlayerUI = new Lang.Class({
    Name: 'DefaultPlayerUI',
    Extends: PopupMenu.PopupBaseMenuItem,

    _init: function() {
      this.parent();

      this.app = Shell.AppSystem.get_default().lookup_app(
        Gio.app_info_get_default_for_type('audio/x-vorbis+ogg', false).get_id()
      );
      let appInfo = Gio.DesktopAppInfo.new(this.app.get_id());

      this.label = new St.Label({text: this.app.get_name()});
      this.icon = new St.Icon({icon_name: 'audio-x-generic-symbolic', style_class: 'popup-menu-icon'});

      this.actor.add_child(this.icon);
      this.actor.add_child(this.label);

      this.connect('activate', Lang.bind(this, this.run));
    },

    run: function() {
      this.app.activate_full(-1, 0);
    }
});


const PlayerUI = new Lang.Class({
  Name: 'PlayerUI',
  Extends: PlayerMenu,

  _init: function(player) {
    this.parent(player.info.identity, true);
    this.icon.icon_name = 'audio-x-generic-symbolic';
    this.player = player;
    this._updateId = player.connect("player-update", Lang.bind(this, this.update));
    this._updateInfoId = player.connect("player-update-info", Lang.bind(this, this.updateInfo));

    this.showRating = false;
    this.showVolume = false;
    this.showPosition = false;
    this.showPlaylist = false;

    this.activePlaylist = null;

    this.trackCoverUrl = false;
    this.trackCoverFileTmp = false;
    this.trackCover = new St.Button({style_class: 'track-cover-container',
                                     x_align: St.Align.START,
                                     y_align: St.Align.START,
                                     child: new St.Icon({icon_name: "media-optical-cd-audio",
                                                         icon_size: Settings.COVER_SIZE})});
    this.trackCover.connect('clicked', Lang.bind(this, this._toggleCover));

    this.trackBox = new Widget.TrackBox(this.trackCover);
    this.trackBox.connect('activate', Lang.bind(this.player, this.player.raise));
    this.addMenuItem(this.trackBox);

    this.prevButton = new Widget.PlayerButton('media-skip-backward-symbolic',
                                              Lang.bind(this.player, this.player.previous));
    this.playButton = new Widget.PlayerButton('media-playback-start-symbolic',
                                              Lang.bind(this.player, this.player.playPause));
    this.stopButton = new Widget.PlayerButton('media-playback-stop-symbolic',
                                              Lang.bind(this.player, this.player.stop));
    this.stopButton.hide();
    this.nextButton = new Widget.PlayerButton('media-skip-forward-symbolic',
                                              Lang.bind(this.player, this.player.next));

    this.trackControls = new Widget.PlayerButtons();
    this.trackControls.addButton(this.prevButton);
    this.trackControls.addButton(this.playButton);
    this.trackControls.addButton(this.stopButton);
    this.trackControls.addButton(this.nextButton);

    this.addMenuItem(this.trackControls);

    this.volume = new Widget.SliderItem(_("Volume"), "audio-volume-high-symbolic", 0);
    this.volume.connect('value-changed', Lang.bind(this, function(item) {
      this.player.setVolume(item._value);
    }));
    this.addMenuItem(this.volume);

    this.position = new Widget.SliderItem("0:00 / 0:00", "document-open-recent", 0);
    this.position.connect('value-changed', Lang.bind(this, function(item) {
      this.player.seek(item._value);
    }));
    this.addMenuItem(this.position);

    this.playlists = new PopupMenu.PopupSubMenuMenuItem(_("Playlists"));
    this.addMenuItem(this.playlists);
  },

  update: function(player, newState) {

    if (newState.showRating !== null) {
      this.showRating = newState.showRating;
    }

    if (newState.showVolume !== null) {
      this.showVolume = newState.showVolume;
      if (this.showVolume)
        this.volume.actor.show();
      else
        this.volume.actor.hide();
    }

    if (newState.showPosition !== null) {
      this.showPosition = newState.showPosition;
      if (this.showPosition)
        this.position.actor.show();
      else {
        this.position.actor.hide();
      }
    }

    if (newState.showPlaylist !== null) {
      this.showPlaylist = newState.showPlaylist;
      if (this.showPlaylist)
        this.playlists.actor.show();
      else {
        this.playlists.actor.hide();
      }
    }

    if (newState.trackTitle || newState.trackArtist || newState.trackAlbum) {
      this.trackBox.empty();
      JSON.parse(Settings.gsettings.get_string(Settings.MEDIAPLAYER_TRACKBOX_TEMPLATE))
      .forEach(Lang.bind(this, function(trackInfo) {
        let text = Lib.compileTemplate(trackInfo.template, newState);
        this.trackBox.addInfo(new Widget.TrackInfo(text, trackInfo.style_class));
      }));
      if (player.state.trackRating !== null && this.showRating)
        this.trackBox.addInfo(new Widget.TrackRating(null, player.state.trackRating, 'track-rating', this.player));
    }

    if (newState.volume !== null) {
      let value = newState.volume;
      if (value === 0)
          this.volume.setIcon("audio-volume-muted-symbolic");
      if (value > 0)
          this.volume.setIcon("audio-volume-low-symbolic");
      if (value > 0.30)
          this.volume.setIcon("audio-volume-medium-symbolic");
      if (value > 0.80)
          this.volume.setIcon("audio-volume-high-symbolic");
      this.volume.setValue(value);
    }

    if (newState.canPause !== null) {
      if (newState.canPause)
        this.playButton.setCallback(Lang.bind(this.player, this.player.playPause));
      else
        this.playButton.setCallback(Lang.bind(this.player, this.player.play));
    }

    if (newState.canGoNext !== null) {
      if (newState.canGoNext)
        this.nextButton.enable();
      else
        this.nextButton.disable();
    }

    if (newState.canGoPrevious !== null) {
      if (newState.canGoPrevious)
        this.prevButton.enable();
      else
        this.prevButton.disable();
    }

    if (newState.canSeek !== null) {
      if (newState.canSeek && this.showPosition &&
          this.player.state.status != Settings.Status.STOP)
        this.position.actor.show();
      else {
        this.position.actor.hide();
      }
    }

    if (newState.trackTime && newState.trackLength) {
      this.position.setLabel(
        this._formatTime(newState.trackTime) + " / " + this._formatTime(newState.trackLength)
      );
      this.position.setValue(newState.trackTime / newState.trackLength);
    }

    if (newState.status) {
      let status = newState.status;
      // g-s 3.16
      if (this.status) {
        this.status.text = _(status);
      }

      if (status == Settings.Status.STOP) {
        this.trackBox.hideAnimate();
        this.volume.actor.hide();
        this.position.actor.hide();
      }
      else {
        this.trackBox.showAnimate();
        if (this.showVolume)
          this.volume.actor.show();
        if (this.showPosition && this.player.state.canSeek)
          this.position.actor.show();
      }

      if (status === Settings.Status.PLAY) {
        this.stopButton.show();
        if (player.state.canPause) {
          this.playButton.setIcon('media-playback-pause-symbolic');
          this.playButton.show();
        }
        else {
          this.playButton.hide();
        }
      }
      else if (status === Settings.Status.PAUSE) {
        this.playButton.setIcon('media-playback-start-symbolic');
      }
      else if (status == Settings.Status.STOP) {
        this.stopButton.hide();
        this.playButton.show();
        this.playButton.setIcon('media-playback-start-symbolic');
      }
    }

    if (newState.playlists) {
      this.playlists.menu.removeAll();
      newState.playlists.forEach(Lang.bind(this, function(playlist) {
        let obj = playlist[0],
            name = playlist[1];
        // Don't add video playlists
        if (obj.toString().search('Video') > 0)
              return;
        let playlistUI = new Widget.PlaylistItem(name, obj);
        playlistUI.connect('activate', Lang.bind(this, function(playlistItem) {
          this.setActivePlaylist(playlistItem.obj);
          this.player.playPlaylist(playlistItem.obj);
        }));
        this.playlists.menu.addMenuItem(playlistUI);
      }));
      if (this.activePlaylist) {
        this.setActivePlaylist(this.activePlaylist);
      }
    }

    if (newState.playlist) {
      this.setActivePlaylist(newState.playlist);
    }

    if (newState.trackCoverPath || newState.isRadio) {
      this.hideCover();
      this.showCover(newState);
    }
  },

  setActivePlaylist: function(objPath) {
    this.activePlaylist = objPath;
    this.playlists.menu._getMenuItems().forEach(function(playlistItem) {
      if (playlistItem.obj == objPath) {
        playlistItem.setPlaylistActive(true);
      }
      else {
        playlistItem.setPlaylistActive(false);
      }
    });
  },

  hideCover: function() {
    Tweener.addTween(this.trackCover, {
      opacity: 0,
      time: 0.3,
      transition: 'easeOutCubic',
    });
  },

  showCover: function(state) {
    Tweener.addTween(this.trackCover, {
      opacity: 0,
      time: 0.3,
      transition: 'easeOutCubic',
      onComplete: Lang.bind(this, function() {
        // Change cover
        if (state.isRadio) {
          let coverIcon = new St.Icon({icon_name: "radio",
                                       icon_size: this.trackCover.child.icon_size});
          this.trackCover.child = coverIcon;
        }
        else if (! state.trackCoverPath || ! GLib.file_test(state.trackCoverPath, GLib.FileTest.EXISTS)) {
          let coverIcon = new St.Icon({icon_name: "media-optical-cd-audio",
                                       icon_size: this.trackCover.child.icon_size});
          this.trackCover.child = coverIcon;
        }
        else {
          let gicon = new Gio.FileIcon({file: Gio.File.new_for_path(state.trackCoverPath)});
          let coverIcon = new St.Icon({gicon: gicon, style_class: "track-cover",
                                       icon_size: this.trackCover.child.icon_size});
          this.trackCover.child = coverIcon;
        }
        // Show the new cover
        Tweener.addTween(this.trackCover, {
          opacity: 255,
          time: 0.3,
          transition: 'easeInCubic',
        });
      })
    });
  },

  _toggleCover: function() {
    if (this.trackCover.child.has_style_class_name('track-cover')) {
      let size = this.trackCover.child.icon_size,
          targetSize;
      if (size == Settings.COVER_SIZE)
        targetSize = size * 2;
      else
        targetSize = Settings.COVER_SIZE;
      Tweener.addTween(this.trackCover.child, {icon_size: targetSize,
                                               time: 0.3,
                                               transition: 'easeInCubic'});
    }
  },

  _formatTime: function(s) {
    let ms = s * 1000;
    let msSecs = (1000);
    let msMins = (msSecs * 60);
    let msHours = (msMins * 60);
    let numHours = Math.floor(ms/msHours);
    let numMins = Math.floor((ms - (numHours * msHours)) / msMins);
    let numSecs = Math.floor((ms - (numHours * msHours) - (numMins * msMins))/ msSecs);
    if (numSecs < 10)
      numSecs = "0" + numSecs.toString();
    if (numMins < 10 && numHours > 0)
      numMins = "0" + numMins.toString();
    if (numHours > 0)
      numHours = numHours.toString() + ":";
    else
      numHours = "";
    return numHours + numMins.toString() + ":" + numSecs.toString();
  },

  updateInfo: function(player, playerInfo) {
    this.label.text = playerInfo.identity;
  },

  toString: function() {
      return "[object PlayerUI(%s)]".format(this.player.info.identity);
  },


  destroy: function() {
    if (this._updateId) {
      this.player.disconnect(this._updateId);
      this.player.disconnect(this._updateInfoId);
    }
    this.parent();
  }

});
