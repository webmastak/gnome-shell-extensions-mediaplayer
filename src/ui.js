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
const Gtk = imports.gi.Gtk;
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
    //We never want to reserve space for a scrollbar in the players.
    this.menu.actor.vscrollbar_policy = Gtk.PolicyType.NEVER;
    this.menu._needsScrollbar = Lang.bind(this, function() {return false;});
    this.menu._close = this.menu.close;
    this.menu._open = this.menu.open;
    this.menu.close = Lang.bind(this, this.close);
    this.menu.open = Lang.bind(this, this.open);
  },

  addMenuItem: function(item) {
    this.menu.addMenuItem(item);
  },

  close: function(animate) {
    if (!this.menu.isOpen) {
      return;
    }
    //If we animate the close GNOME Shell gets confused
    //sometimes and adds space for a scrollbar in other menus in
    //the system menu on close.
    this.menu._close(BoxPointer.PopupAnimation.NONE);
  },

  open: function(animate) {
    if (this.menu.isOpen) {
      return;
    }
    //If we animate the open GNOME Shell gets confused
    //and our menus can overflow off screen.
    this.menu._open(BoxPointer.PopupAnimation.NONE);
    this.emit('player-menu-opened');
  }

});

const PlayerUI = new Lang.Class({
  Name: 'PlayerUI',
  Extends: PlayerMenu,

  _init: function(player) {
    this.parent(player.info.identity, true);
    this.icon.icon_name = 'audio-x-generic-symbolic';
    this.player = player;
    this.setCoverIconAsync = Lib.setCoverIconAsync;
    this._updateId = player.connect("player-update", Lang.bind(this, this.update));
    this._updateInfoId = player.connect("player-update-info", Lang.bind(this, this.updateInfo));

    this.showRating = false;
    this.showVolume = false;
    this.showPosition = false;
    this.showPlaylist = false;
    this.showTracklist = false;
    this.showTracklistRating = false;
    this.hasTrackList = false;
    this.trackLength = 0;

    this.oldShouldShow = null;
    //Broken Players never get anything beyond the most basic functionality
    //because they don't know how to behave properly.
    this.playerIsBroken = Settings.BROKEN_PLAYERS.indexOf(this.player.info.identity) != -1;
    this.largeCoverSize = Settings.gsettings.get_int(Settings.MEDIAPLAYER_LARGE_COVER_SIZE_KEY);
    this.smallCoverSize = Settings.gsettings.get_int(Settings.MEDIAPLAYER_SMALL_COVER_SIZE_KEY);

    this.trackCover = new St.Button({child: new St.Icon({icon_name: "media-optical-cd-audio-symbolic"})});
    if (Settings.MINOR_VERSION > 19) {
      this.trackCover.child.add_style_class_name('media-message-cover-icon fallback no-padding');
    }

    this.trackCover.connect('clicked', Lang.bind(this, function(actor, button) {
      if (Settings.gsettings.get_boolean(Settings.MEDIAPLAYER_RAISE_ON_CLICK_KEY)) {
        this.player.raise();
        this.menu._getTopMenu().close();
      }
      else {
        this._toggleCover();
      }
    }));

    this.trackBox = new Widget.TrackBox(this.trackCover);
    this.trackBox.connect('activate', Lang.bind(this.player, this.player.raise));
    this.addMenuItem(this.trackBox);
    this.trackRatings = null;
    if (!this.playerIsBroken) {
      this.trackRatings = new Widget.TrackRating(this.player, 0);
      this.trackRatings.connect('activate', Lang.bind(this.player, this.player.raise));
      this.addMenuItem(this.trackRatings);
    }

    this.secondaryInfo = new Widget.SecondaryInfo();
    this.secondaryInfo.connect('activate', Lang.bind(this.player, this.player.raise));
    this.addMenuItem(this.secondaryInfo);
        
    this.trackControls = new Widget.PlayerButtons();
    this.trackControls.connect('activate', Lang.bind(this.player, this.player.raise))

    this.prevButton = new Widget.PlayerButton('media-skip-backward-symbolic',
                                              Lang.bind(this.player, this.player.previous));
    this.trackControls.addButton(this.prevButton);

    this.playButton = new Widget.PlayerButton('media-playback-start-symbolic',
                                              Lang.bind(this.player, this.player.playPause));
    this.trackControls.addButton(this.playButton);

    this.stopButton = null;

    if (Settings.PLAYERS_THAT_CANT_STOP.indexOf(this.player.info.identity) == -1) {
      this.stopButton = new Widget.PlayerButton('media-playback-stop-symbolic',
                                                Lang.bind(this.player, this.player.stop));
      this.stopButton.hide();
      this.trackControls.addButton(this.stopButton)
    }
    
    this.nextButton = new Widget.PlayerButton('media-skip-forward-symbolic',
                                              Lang.bind(this.player, this.player.next));
    this.trackControls.addButton(this.nextButton);

    this.addMenuItem(this.trackControls);


    this.position = null;
    this.volume = null;
    this.tracklist = null;
    this.playlists = null;
    if (!this.playerIsBroken) {
      this.position = new Widget.SliderItem("document-open-recent-symbolic", 0);
      this.position.connect('activate', Lang.bind(this.player, this.player.raise))
      this.position.sliderConnect('value-changed', Lang.bind(this, function(item) {
        this.player.seek(item._value);
      }));
      this.addMenuItem(this.position);

      this.volume = new Widget.SliderItem("audio-volume-high-symbolic", 0);
      this.volume.connect('activate', Lang.bind(this.player, this.player.raise))
      this.volume.sliderConnect('value-changed', Lang.bind(this, function(item) {
        this.player.setVolume(item._value);
      }));
      this.addMenuItem(this.volume);

      this.tracklist = this._createTracklistWidget();
      this.addMenuItem(this.tracklist);
 
      this.playlists = this._createPlaylistWidget();
      this.addMenuItem(this.playlists);

      this.connect('player-menu-opened', Lang.bind(this, function() {
        this.tracklist.updateScrollbarPolicy();
        this.playlists.updateScrollbarPolicy();
      }));

      this.tracklist.connect('ListSubMenu-opened', Lang.bind(this, function() {
        this.playlists.close();
      }));
      this.playlists.connect('ListSubMenu-opened', Lang.bind(this, function() {
        this.tracklist.close();
      }));
    }

    if (Settings.MINOR_VERSION > 19) {
      this.stockMpris = Main.panel.statusArea.dateMenu._messageList._mediaSection;
      //Monkey patch
      this.stockMprisOldShouldShow = this.stockMpris._shouldShow;
      
    }

    if (Settings.gsettings.get_boolean(Settings.MEDIAPLAYER_START_ZOOMED_KEY)) {
      this.trackCover.child.icon_size = this.largeCoverSize;
      this.trackBox.infos.hide();      
    }
    else {
      this.trackCover.child.icon_size = this.smallCoverSize;
      this.secondaryInfo.hide();
    } 
  },

  update: function(player, newState) {
    if (newState.hideStockMpris !== null) {
      if (this.stockMpris) {
        if (newState.hideStockMpris) {
          this.stockMpris._shouldShow = function() {return false;};
          this.stockMpris.actor.hide();
        }
        else {
          this.stockMpris._shouldShow = this.stockMprisOldShouldShow;
          if (this.stockMpris._shouldShow()) {
            this.stockMpris.actor.show();
          }
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

    if (newState.showRating !== null && this.trackRatings !== null) {
      this.showRating = newState.showRating;
      if (this.showRating) {
        this.trackRatings.actor.show();
      }
      else {
        this.trackRatings.actor.hide();
      }              
    }

    if (newState.showVolume !== null && this.volume !== null) {
      this.showVolume = newState.showVolume;
      if (this.showVolume) {
        this.volume.actor.show();
      }
      else {
        this.volume.actor.hide();
      }
    }

    if (newState.trackLength !== null) {
      this.trackLength = newState.trackLength;
    }

    if (newState.showPosition !== null && this.position !== null) {
      this.showPosition = newState.showPosition;
      if (this.showPosition && this.trackLength !== 0) {
        this.position.actor.show();
      }
      else {
        this.position.actor.hide();
      }
    }

    if (newState.showPlaylist !== null && this.playlists !== null) {
      this.showPlaylist = newState.showPlaylist;
      if (this.showPlaylist) {
        this.playlists.show();
      }
      else {
        this.playlists.hide();
      }
    }

    if (newState.showTracklist !== null && this.tracklist !== null) {
      this.showTracklist = newState.showTracklist;
      if (this.hasTrackList && this.showTracklist) {
        this.tracklist.show();
      }
      else {
        this.tracklist.hide();
      }
    }

    if (newState.hasTrackList !== null && this.tracklist !== null) {
      this.hasTrackList = newState.hasTrackList;
      if (this.hasTrackList && this.showTracklist) {
        this.tracklist.show();
      }
      else {
        this.tracklist.hide();
      }
    }

    if (newState.trackRating !== null && this.trackRatings !== null && !this.player._pithosRatings) {
      this.trackRatings.rate(newState.trackRating);
    }

    if (newState.pithosRating !== null && this.player._pithosRatings) {
      this.trackRatings.rate(newState.pithosRating);
    }

    if (newState.trackArtist !== null) {
      this.trackBox.updateInfo(newState);
      this.secondaryInfo.updateInfo(newState);
    }

    if (newState.volume !== null && this.volume !== null) {
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

    if (newState.canSeek !== null && this.position !== null) {
      this.position.setReactive(newState.canSeek)
    }

    if (newState.trackTime !== null && this.position !== null) {
      if (this.trackLength === 0) {
        this.position.actor.hide();
      }
      else {
        this.position.setValue(newState.trackTime / this.trackLength);
      }
    }

    if (newState.status !== null) {

      if (newState.status === Settings.Status.STOP) {
        if (this.stopButton) {
          this.stopButton.hide();
        }
        this.playButton.show();
        this.playButton.setIcon('media-playback-start-symbolic');
        this.trackBox.hideAnimate();
        this.secondaryInfo.hideAnimate();
        if (!this.playerIsBroken) {
          this.trackRatings.actor.hide();
          this.volume.actor.hide();
          this.position.actor.hide();
        }
      }
      else {
        this.trackBox.showAnimate();
        if (this.trackCover.child.icon_size == this.largeCoverSize) {
          this.secondaryInfo.showAnimate();
        }
        if (!this.playerIsBroken) {
          if (this.showRating) {
            this.trackRatings.actor.show();
          }
          if (this.showVolume) {
            this.volume.actor.show();
          }
          if (this.showPosition) {
            this.position.actor.show();
          }
        }
      }

      if (newState.status === Settings.Status.PLAY) {
        if (this.stopButton) {
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
      if (newState.status === Settings.Status.PAUSE) {
        this.playButton.setIcon('media-playback-start-symbolic');
      }
    }

    if (newState.playlists !== null) {
      this.playlists.loadPlaylists(newState.playlists);
    }

    if (newState.trackListMetaData !== null && this.tracklist !== null) {
      this.tracklist.loadTracklist(newState.trackListMetaData, this.showTracklistRating);
    }

    if (newState.showTracklistRating !== null && this.tracklist !== null) {
      this.showTracklistRating = newState.showTracklistRating;
      this.tracklist.showRatings(newState.showTracklistRating);
    }

    if (newState.playlist !== null && this.playlists !== null) {
      this.playlists.setObjectActive(newState.playlist);
    }

    if (newState.updatedPlaylist !== null && this.playlists !== null) {
      this.playlists.updatePlaylist(newState.updatedPlaylist);
    }

    if (newState.trackCoverUrl !== null) {
      this.changeCover(newState);
    }

    if (newState.trackObj !== null && this.tracklist !== null) {
      this.tracklist.setObjectActive(newState.trackObj);
    }

    if (newState.updatedMetadata !== null && this.tracklist !== null) {
      this.tracklist.updateMetadata(newState.updatedMetadata);
    }
  },

  changeCover: function(state) {
    if (state.trackCoverUrl) {
      this.setCoverIconAsync(this.trackCover.child, state.trackCoverUrl, state.fallbackIcon);
    }
    else {
      this.trackCover.child.icon_name = state.fallbackIcon;
    }
  },

  _toggleCover: function() {
    let targetSize, transition;
    if (this.trackCover.child.icon_size == this.smallCoverSize) {
      let adjustment = this.largeCoverSize - this.smallCoverSize;
      targetSize = this.largeCoverSize;
      transition = 'easeOutQuad';
      this.trackBox.infos.hide();
      this.secondaryInfo.showAnimate();
      if (!this.playerIsBroken) { 
        this.tracklist.updateScrollbarPolicy(adjustment);
        this.playlists.updateScrollbarPolicy(adjustment);
      }     
    }
    else {
      targetSize = this.smallCoverSize;
      transition = 'easeInQuad';
      this.secondaryInfo.hideAnimate();
    }

    Tweener.addTween(this.trackCover.child, {icon_size: targetSize,
                                             time: Settings.FADE_ANIMATION_TIME,
                                             transition: transition,
                                             onComplete: Lang.bind(this, function() {
                                               if (targetSize == this.smallCoverSize) { 
                                                 this.trackBox.infos.show();
                                                 if (!this.playerIsBroken) {
                                                   this.tracklist.updateScrollbarPolicy();
                                                   this.playlists.updateScrollbarPolicy();
                                                 }
                                               }
                                             }
                                           )}
    );
  },

  _createPlaylistWidget: function() {
    let playlistTitle = _("Playlists");
    let altPlaylistTitles = Settings.ALTERNATIVE_PLAYLIST_TITLES;
    for (let i = 0; i < altPlaylistTitles.length; i++) {
      let obj = altPlaylistTitles[i];
      for (let key in obj){
        if (key == this.player.info.identity) {
          playlistTitle = obj[key];
          break;
        }
      }
    }
    return new Widget.Playlists(playlistTitle, this.player);
  },

  _createTracklistWidget: function() {
    let tracklistTitle = _("Tracks");
    let altTracklistTitles = Settings.ALTERNATIVE_TRACKLIST_TITLES;
    for (let i = 0; i < altTracklistTitles.length; i++) {
      let obj = altTracklistTitles[i];
      for (let key in obj){
        if (key == this.player.info.identity) {
          tracklistTitle = obj[key];
          break;
        }
      }
    }
    return new Widget.TrackList(tracklistTitle, this.player);
  },


  updateInfo: function(player, playerInfo) {
    this.label.text = playerInfo.identity;
    this.icon.icon_name = Lib.getPlayerSymbolicIcon(playerInfo.desktopEntry);
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
