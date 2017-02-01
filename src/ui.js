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
    if (force !== true) {
      return;
    }
    this.menu._close(BoxPointer.PopupAnimation.FULL);
    this.emit('player-menu-closed');
  },

  open: function(animate) {
    if (!animate) {
      animate = BoxPointer.PopupAnimation.FULL;
    }
    this.menu._open(animate);
    this.emit('player-menu-opened');
  },

  setSubmenuShown: function(open) {
    if (open) {
      this.menu.open(BoxPointer.PopupAnimation.FULL);
    }
    else {
      this.menu.close(BoxPointer.PopupAnimation.FULL, true);
    }
  }

});


const DefaultPlayerUI = new Lang.Class({
    Name: 'DefaultPlayerUI',
    Extends: PopupMenu.PopupBaseMenuItem,

    _init: function() {
      this.parent();

      let appInfo = Gio.app_info_get_default_for_type("audio/x-vorbis+ogg", false)
      // In case there is no default audio app, don't crash, just don't have anything in the menu to launch.
      if (!appInfo) {
        return;
      }
      let appName = appInfo.get_name();
      let appId = Gio.DesktopAppInfo.search(appName)[0][0];

      this.app = Shell.AppSystem.get_default().lookup_app(appId);

      this.label = new St.Label({text: appName});
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

    this.oldShouldShow = null;

    this.largeCoverSize = Settings.gsettings.get_int(Settings.MEDIAPLAYER_LARGE_COVER_SIZE_KEY);
    this.smallCoverSize = Settings.gsettings.get_int(Settings.MEDIAPLAYER_SMALL_COVER_SIZE_KEY);

    this.trackCover = new St.Button({child: new St.Icon({icon_name: "media-optical-cd-audio",
                                                         icon_size: this.smallCoverSize})});
    this.trackCover.connect('clicked', Lang.bind(this, this._toggleCover));

    this.trackBox = new Widget.TrackBox(this.trackCover);
    this.trackBox.connect('activate', Lang.bind(this.player, this.player.raise));
    this.addMenuItem(this.trackBox);

    this.trackRatings = new Widget.TrackRating(this.player, 0);
    this.trackRatings.connect('activate', Lang.bind(this.player, this.player.raise));
    this.addMenuItem(this.trackRatings);

    this.secondaryInfo = new Widget.SecondaryInfo();
    this.secondaryInfo.connect('activate', Lang.bind(this.player, this.player.raise));
    this.secondaryInfo.hide();
    this.addMenuItem(this.secondaryInfo);        

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
    this.trackControls.connect('activate', Lang.bind(this.player, this.player.raise));
    this.trackControls.addButton(this.prevButton);
    this.trackControls.addButton(this.playButton);
    this.trackControls.addButton(this.stopButton);
    this.trackControls.addButton(this.nextButton);

    this.addMenuItem(this.trackControls);

    this.position = new Widget.SliderItem("document-open-recent-symbolic", 0);
    this.position.connect('value-changed', Lang.bind(this, function(item) {
      this.player.seek(item._value);
    }));
    this.addMenuItem(this.position);

    this.volume = new Widget.SliderItem("audio-volume-high-symbolic", 0);
    this.volume.connect('value-changed', Lang.bind(this, function(item) {
      this.player.setVolume(item._value);
    }));
    this.addMenuItem(this.volume);

    this.playlists = this._createPlaylistWidget();;
    this.addMenuItem(this.playlists);

    if (Settings.MINOR_VERSION > 19) {
      this.stockMpris = Main.panel.statusArea.dateMenu._messageList._mediaSection;
    }
  },

  shouldShowOverride: function(player, newState) {
    return false;
  },

  update: function(player, newState) {

    if (newState.hideStockMpris !== null) {
      if (this.stockMpris) {
        if (newState.hideStockMpris) {
          this.stockMpris.actor.hide();
        }
        else if (this.stockMpris._shouldShow()) {
          this.stockMpris.actor.show();
        }
      }
    }

    if (newState.largeCoverSize !== null) {
      this.largeCoverSize = newState.largeCoverSize;
      if (this.trackCover.child.icon_size !== this.smallCoverSize) {
        this.trackCover.child.icon_size = this.largeCoverSize;
      }              
    }

    if (newState.smallCoverSize !== null) {
      this.smallCoverSize = newState.smallCoverSize;
      if (this.trackCover.child.icon_size !== this.largeCoverSize) {
        this.trackCover.child.icon_size = this.smallCoverSize;
      }              
    }

    if (newState.showRating !== null) {
      this.showRating = newState.showRating;
      if (this.showRating) {
        this.trackRatings.actor.show();
      }
      else {
        this.trackRatings.actor.hide();
      }              
    }

    if (newState.showVolume !== null) {
      this.showVolume = newState.showVolume;
      if (this.showVolume) {
        this.volume.actor.show();
      }
      else {
        this.volume.actor.hide();
      }
    }

    if (newState.showPosition !== null) {
      this.showPosition = newState.showPosition;
      if (this.showPosition) {
        this.position.actor.show();
      }
      else {
        this.position.actor.hide();
      }
    }

    if (newState.showPlaylist !== null) {
      this.showPlaylist = newState.showPlaylist;
      if (this.showPlaylist) {
        this.playlists.actor.show();
      }
      else {
        this.playlists.actor.hide();
      }
    }

    if (newState.trackRating !== null) {
      this.trackRatings.rate(newState.trackRating);
    }

    if (newState.trackTitle !== null || newState.trackArtist !== null || newState.trackAlbum !== null) {
      this.trackBox.empty();
      this.secondaryInfo.empty();
      JSON.parse(Settings.gsettings.get_string(Settings.MEDIAPLAYER_TRACKBOX_TEMPLATE))
      .forEach(Lang.bind(this, function(trackInfo) {
        let text = Lib.compileTemplate(trackInfo.template, newState);
        this.trackBox.addInfo(new Widget.TrackInfo(text, trackInfo.style_class));
        this.secondaryInfo.addInfo(new Widget.TrackInfo(text, trackInfo.style_class));
      }));
    }

    if (newState.volume !== null) {
      // Adapted from https://github.com/GNOME/gnome-shell/blob/master/js/ui/status/volume.js
      // So that our icon changes match the system volume icon changes.
      let value = newState.volume, volumeIcon;
      if (value === 0) {
        volumeIcon = "audio-volume-muted-symbolic";
      }
      else {
        let n = Math.floor(3 * value) + 1;
        if (n < 2) {
          volumeIcon = "audio-volume-low-symbolic";
        }
        else if (n >= 3) {
          volumeIcon = "audio-volume-high-symbolic";          
        }
        else {
          volumeIcon = "audio-volume-medium-symbolic";
        }
      }
      this.volume.setIcon(volumeIcon);
      this.volume.setValue(value);
    }

    if (newState.canPause !== null) {
      if (newState.canPause) {
        this.playButton.setCallback(Lang.bind(this.player, this.player.playPause));
      }
      else {
        this.playButton.setCallback(Lang.bind(this.player, this.player.play));
      }
    }

    if (newState.canGoNext !== null) {
      if (newState.canGoNext) {
        this.nextButton.enable();
      }
      else {
        this.nextButton.disable();
      }
    }

    if (newState.canGoPrevious !== null) {
      if (newState.canGoPrevious) {
        this.prevButton.enable();
      }
      else {
        this.prevButton.disable();
      }
    }

    if (newState.canSeek !== null) {
      if (newState.canSeek && this.showPosition &&
          this.player.state.status != Settings.Status.STOP) {
        this.position.actor.show();
      }
      else {
        this.position.actor.hide();
      }
    }

    if (newState.trackTime && newState.trackLength) {
      this.position.setValue(newState.trackTime / newState.trackLength);
    }

    if (newState.status) {
      let status = newState.status;
      // g-s 3.16
      if (this.status) {
        this.status.text = _(status);
      }

      if (status == Settings.Status.STOP) {
        this.trackRatings.actor.hide();
        this.trackBox.hideAnimate();
        this.secondaryInfo.hideAnimate();
        this.volume.actor.hide();
        this.position.actor.hide();
      }
      else {
        this.trackBox.showAnimate();
        if (this.trackCover.child.icon_size == this.largeCoverSize) {
          this.secondaryInfo.showAnimate();
        }
        if (this.showRating) {
          this.trackRatings.actor.show();
        }
        if (this.showVolume) {
          this.volume.actor.show();
        }
        if (this.showPosition && this.player.state.canSeek) {
          this.position.actor.show();
        }
      }

      if (status === Settings.Status.PLAY) {
        if (Settings.PLAYERS_THAT_CANT_STOP.indexOf(this.player.info.identity) == -1) {
          this.stopButton.show();
        }
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
        if (obj.toString().search('Video') > 0) {
              return;
        }
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

    if (newState.trackCoverUrl !== null || newState.isRadio !== null) {
      this.changeCover(newState);
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

  changeCover: function(state) {
    let coverIcon = null
    if (state.isRadio) {
      coverIcon = new St.Icon({icon_name: "radio",
                              icon_size: this.trackCover.child.icon_size});
    }
    else if (state.trackCoverUrl) {
      let file = Gio.File.new_for_uri(state.trackCoverUrl);
      if (file.query_exists(null)) {
        let gicon = new Gio.FileIcon({file: file});
        coverIcon = new St.Icon({gicon: gicon, style_class: "track-cover",
                                     icon_size: this.trackCover.child.icon_size});
      }
    }
    if (!coverIcon) {
      coverIcon = new St.Icon({icon_name: "media-optical-cd-audio",
                              icon_size: this.trackCover.child.icon_size});
    }
    this.trackCover.child = coverIcon;
  },

  _toggleCover: function() {
    let targetSize, transition;
    if (this.trackCover.child.icon_size == this.smallCoverSize) {
      targetSize = this.largeCoverSize;
      transition = 'easeOutQuad';
      this.trackBox.infos.hide();
      this.secondaryInfo.showAnimate();
    }
    else {
      targetSize = this.smallCoverSize;
      transition = 'easeInQuad';
      this.secondaryInfo.hideAnimate();
    }

    Tweener.addTween(this.trackCover.child, {icon_size: targetSize,
                                             time: 0.3,
                                             transition: transition,
                                             onComplete: Lang.bind(this, function() {
                                               if (targetSize == this.smallCoverSize) { 
                                                 this.trackBox.infos.show();
                                               }
                                             }
                                           )}
    );
  },

  _createPlaylistWidget: function() {
    let playlistTitle = _("Playlists");
    let altPlaylistTitles = Settings.ALTERNATIVE_PLAYLIST_TITLES;
    for (let i = 0; i < altPlaylistTitles.length; i++){
      let obj = altPlaylistTitles[i];
      for (let key in obj){
        if (key == this.player.info.identity) {
          playlistTitle = obj[key];
          break;
        }
      }
    }
    return new PopupMenu.PopupSubMenuMenuItem(playlistTitle);
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
