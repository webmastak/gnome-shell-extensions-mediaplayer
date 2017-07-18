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

const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
const Lang = imports.lang;
const St = imports.gi.St;
const Main = imports.ui.main;

const Gettext = imports.gettext.domain('gnome-shell-extensions-mediaplayer');
const _ = Gettext.gettext;

const Me = imports.misc.extensionUtils.getCurrentExtension();
const Widget = Me.imports.widget;
const Settings = Me.imports.settings;
const Util = Me.imports.util;


const PlayerUI = new Lang.Class({
  Name: 'PlayerUI',
  Extends: Widget.PlayerMenu,

  _init: function(player) {
    this.parent(player.info.identity, true);
    this.hidePlayStatusIcon();
    this.icon.icon_name = 'audio-x-generic-symbolic';
    this.player = player;
    this.setCoverIconAsync = Util.setCoverIconAsync;
    this._updateId = player.connect('player-update', Lang.bind(this, this.update));
    this._updateInfoId = player.connect('player-update-info', Lang.bind(this, this.updateInfo));

    this.showRating = false;
    this.showVolume = false;
    this.showPosition = false;
    this.showPlaylist = false;
    this.showTracklist = false;
    this.showStopButton = false;
    this.showLoopStatus = false;
    this.showTracklistRating = false;
    this.hasTrackList = false;
    this.trackLength = 0;
    this.playlistCount = 0;
    this.showPlaylistTitle = false;
    this.isRhythmboxStream = false;
    this._playlistTitle = null;
    this.ratings = 'no rating';

    this.oldShouldShow = null;
    //Broken Players never get anything beyond the most basic functionality
    //because they don't know how to behave properly.
    this.playerIsBroken = Settings.BROKEN_PLAYERS.indexOf(this.player.info.identity) != -1;
    this.noLoopStatusSupport = Settings.NO_LOOP_STATUS_SUPPORT.indexOf(this.player.info.identity) != -1;
    if (!this.playerIsBroken) {
      this.playlistTitle = new Widget.PlaylistTitle();
      this.playlistTitle.connect('activate', Lang.bind(this.player, this.player.raise));
      this.addMenuItem(this.playlistTitle);
      this.playlistTitle.hide();
    }

    this.trackCover = new Widget.TrackCover(new St.Icon({icon_name: 'audio-x-generic-symbolic', style_class: 'large-cover-icon'}));
    this.trackCover.connect('activate', Lang.bind(this.player, this.player.raise));
    this.addMenuItem(this.trackCover);
    this.trackCover.hide();
    this.trackRatings = null;
    if (!this.playerIsBroken) {
      this.trackRatings = new Widget.TrackRating(this.player);
      this.trackRatings.connect('activate', Lang.bind(this.player, this.player.raise));
      this.addMenuItem(this.trackRatings);
      this.trackRatings.hide();
    }

    this.info = new Widget.Info();
    this.info.connect('activate', Lang.bind(this.player, this.player.raise));
    this.addMenuItem(this.info);
        
    this.trackControls = new Widget.PlayerButtons();
    this.trackControls.connect('activate', Lang.bind(this.player, this.player.raise))

    this.prevButton = new Widget.PlayerButton('media-skip-backward-symbolic',
                                              Lang.bind(this.player, this.player.previous));
    this.trackControls.addButton(this.prevButton);

    this.playButton = new Widget.PlayerButton('media-playback-start-symbolic',
                                              Lang.bind(this.player, this.player.playPause));
    this.trackControls.addButton(this.playButton);

    this.stopButton = new Widget.PlayerButton('media-playback-stop-symbolic',
                                              Lang.bind(this.player, this.player.stop));
    this.trackControls.addButton(this.stopButton);
    
    this.nextButton = new Widget.PlayerButton('media-skip-forward-symbolic',
                                              Lang.bind(this.player, this.player.next));
    this.trackControls.addButton(this.nextButton);

    this.addMenuItem(this.trackControls);

    if (!this.playerIsBroken) {
      if (!this.noLoopStatusSupport) {
        this.shuffleLoopStatus = new Widget.ShuffleLoopStatus(this.player);
        this.shuffleLoopStatus.connect('activate', Lang.bind(this.player, this.player.raise));
        this.addMenuItem(this.shuffleLoopStatus);
        this.shuffleLoopStatus.hide();
      }

      this.position = new Widget.SliderItem('document-open-recent-symbolic');
      this.position.connect('activate', Lang.bind(this.player, this.player.raise))
      this.position.sliderConnect('value-changed', Lang.bind(this, function(item) {
        this.player.seek(item._value);
      }));
      this.addMenuItem(this.position);
      this.position.hide();

      this.volume = new Widget.SliderItem('audio-volume-high-symbolic');
      this.volume.connect('activate', Lang.bind(this.player, this.player.raise))
      this.volume.sliderConnect('value-changed', Lang.bind(this, function(item) {
        if (this.player.volume != item._value) {
          this.player.volume = item._value;
        }
      }));
      this.addMenuItem(this.volume);
      this.volume.hide();

      this.tracklist = this._createTracklistWidget();
      this.addMenuItem(this.tracklist);
      this.tracklist.hide();
 
      this.playlists = this._createPlaylistWidget();
      this.addMenuItem(this.playlists);
      this.playlists.hide();

      this.tracklist.menu.connect('open-state-changed', Lang.bind(this, function(menu, open) {
        if (open) {
          this.playlists.menu.close();
        }
      }));
      this.playlists.menu.connect('open-state-changed', Lang.bind(this, function(menu, open) {
        if (open) {
          this.tracklist.menu.close();
        }
      }));

    }

    if (Settings.MINOR_VERSION > 19) {
      this.stockMpris = Main.panel.statusArea.dateMenu._messageList._mediaSection;
      //Monkey patch
      this.stockMprisOldShouldShow = this.stockMpris._shouldShow;
      
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

    if (newState.isRhythmboxStream !== null && !this.playerIsBroken) {
      this.isRhythmboxStream = newState.isRhythmboxStream;
      if (this.isRhythmboxStream) {
        this.trackRatings.hideAnimate();
        this.position.hideAnimate();
        if (!this.noLoopStatusSupport) {
          this.shuffleLoopStatus.hideAnimate();
        }
      }             
    }

    if (newState.showPlayStatusIcon !== null) {
      if (newState.showPlayStatusIcon) {
        this.showPlayStatusIcon();
      }
      else {
        this.hidePlayStatusIcon();
      }              
    }

    if (newState.showRating !== null && !this.playerIsBroken) {
      this.showRating = newState.showRating;
      if (this.showRating && this.ratings !== 'no rating' && !this.isRhythmboxStream) {
        this.trackRatings.showAnimate()
      }
      else {
        this.trackRatings.hideAnimate();
      }              
    }

    if (newState.showVolume !== null && !this.playerIsBroken) {
      this.showVolume = newState.showVolume;
      if (this.showVolume) {
        this.volume.showAnimate();
      }
      else {
        this.volume.hideAnimate();
      }
    }

    if (newState.showStopButton !== null) {
      this.showStopButton = newState.showStopButton;
      if (newState.showStopButton) {
        this.stopButton.show();
      }
      else {
        this.stopButton.hide();
      }
    }

    if (newState.shuffle !== null && !this.playerIsBroken && !this.noLoopStatusSupport) {
      this.shuffleLoopStatus.setShuffle(newState.shuffle);
    }

    if (newState.loopStatus !== null && !this.playerIsBroken && !this.noLoopStatusSupport) {
      this.shuffleLoopStatus.setLoopStaus(newState.loopStatus);
    }

    if (newState.showLoopStatus !== null && !this.playerIsBroken && !this.noLoopStatusSupport) {
      this.showLoopStatus = newState.showLoopStatus;
      if (this.showLoopStatus && !this.isRhythmboxStream) {
        this.shuffleLoopStatus.showAnimate();
      }
      else {
        this.shuffleLoopStatus.hideAnimate();
      }
    }

    if (newState.showPlaylistTitle !== null && !this.playerIsBroken) {
      this.showPlaylistTitle = newState.showPlaylistTitle;
      if (this.showPlaylistTitle && this._playlistTitle) {
        this.playlistTitle.showAnimate();
      }
      else {
        this.playlistTitle.hideAnimate();
      }
    }

    if (newState.playlistTitle !== null && !this.playerIsBroken) {
      this._playlistTitle = newState.playlistTitle;
      if (this.showPlaylistTitle && this._playlistTitle) {
        this.playlistTitle.update(newState.playlistTitle);
        this.playlistTitle.showAnimate();
      }
      else {
        this.playlistTitle.hideAnimate();
      }
    }

    if (newState.trackLength !== null) {
      this.trackLength = newState.trackLength;
    }

    if (newState.showPosition !== null && !this.playerIsBroken) {
      this.showPosition = newState.showPosition;
      if (this.showPosition && this.trackLength !== 0 && !this.isRhythmboxStream) {
        this.position.showAnimate();
      }
      else {
        this.position.hideAnimate();
      }
    }

    if (newState.playlistCount !== null && !this.playerIsBroken) {
      this.playlistCount = newState.playlistCount;
      if (this.showPlaylist && this.playlistCount > 0) {
        this.playlists.showAnimate();
      }
      else {
        this.playlists.hideAnimate();
      }
    }

    if (newState.showPlaylist !== null && !this.playerIsBroken) {
      this.showPlaylist = newState.showPlaylist;
      if (this.showPlaylist && this.playlistCount > 0) {
        this.playlists.showAnimate();
      }
      else {
        this.playlists.hideAnimate();
      }
    }

    if (newState.showTracklist !== null && !this.playerIsBroken) {
      this.showTracklist = newState.showTracklist;
      if (this.hasTrackList && this.showTracklist) {
        this.tracklist.showAnimate();
      }
      else {
        this.tracklist.hideAnimate();
      }
    }

    if (newState.hasTrackList !== null && !this.playerIsBroken) {
      this.hasTrackList = newState.hasTrackList;
      if (this.hasTrackList && this.showTracklist) {
        this.tracklist.showAnimate();
      }
      else {
        this.tracklist.hideAnimate();
      }
    }

    if (newState.trackRating !== null && !this.playerIsBroken) {
      this.ratings = newState.trackRating;
      if (this.ratings !== 'no rating') {
        this.trackRatings.rate(this.ratings);
        if (this.showRating && !this.isRhythmboxStream) {
          this.trackRatings.showAnimate();
        }
      }
      else {
        let dummyRating = this.player._pithosRatings ? '' : 0;
        this.trackRatings.rate(dummyRating);
        this.trackRatings.hideAnimate();
      }
    }

    if (newState.trackArtist !== null) {
      this.info.update(newState);
    }

    if (newState.volume !== null && !this.playerIsBroken) {
      // Adapted from https://github.com/GNOME/gnome-shell/blob/master/js/ui/status/volume.js
      // So that our icon changes match the system volume icon changes.
      let value = newState.volume, volumeIcon;
      if (value === 0) {
        volumeIcon = 'audio-volume-muted-symbolic';
      }
      else {
        let n = Math.floor(3 * value) + 1;
        if (n < 2) {
          volumeIcon = 'audio-volume-low-symbolic';
        }
        else if (n >= 3) {
          volumeIcon = 'audio-volume-high-symbolic';          
        }
        else {
          volumeIcon = 'audio-volume-medium-symbolic';
        }
      }
      this.volume.setIcon(volumeIcon);
      this.volume.setValue(value);
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

    if (newState.canSeek !== null && !this.playerIsBroken) {
      this.position.setReactive(newState.canSeek)
    }

    if (newState.trackTime !== null && !this.playerIsBroken) {
      if (this.trackLength === 0) {
        this.position.hideAnimate();
      }
      else {
        this.position.setValue(newState.trackTime / this.trackLength);
      }
    }

    if (newState.status !== null) {
      if (newState.status === Settings.Status.STOP) {
        this.setPlayStatusIcon('media-playback-stop-symbolic');
        this.playButton.setIcon('media-playback-start-symbolic');
        this.stopButton.hide();
        if (!this.playerIsBroken) {
          this.position.hideAnimate();
          if (!this.noLoopStatusSupport) {
            this.shuffleLoopStatus.hideAnimate();
          }
          this.trackRatings.hideAnimate();
        }
        this.info.hideAnimate();
        this.trackCover.hideAnimate();
      }
      else {
        if (this.showStopButton) {
          this.stopButton.show();
        }
        this.trackCover.showAnimate();
        if (!this.playerIsBroken && this.showRating && !this.isRhythmboxStream && this.ratings !== 'no rating') {
          this.trackRatings.showAnimate();
        }
        this.info.showAnimate();
        if (!this.playerIsBroken && this.showLoopStatus && !this.isRhythmboxStream && !this.noLoopStatusSupport) {
          this.shuffleLoopStatus.showAnimate();
        }
        if (!this.playerIsBroken && this.showPosition && this.trackLength !== 0 && !this.isRhythmboxStream) {
          this.position.showAnimate();
        }
      }

      if (newState.status === Settings.Status.PLAY) {
        this.setPlayStatusIcon('media-playback-start-symbolic');
        this.playButton.setIcon('media-playback-pause-symbolic');
      }
      if (newState.status === Settings.Status.PAUSE) {
        this.setPlayStatusIcon('media-playback-pause-symbolic');
        this.playButton.setIcon('media-playback-start-symbolic');
      }
    }

    if (newState.trackCoverUrl !== null) {
      this.setCoverIconAsync(this.trackCover.icon, newState.trackCoverUrl, '', false, this.trackCover.animating);
    }

    if (newState.playlists !== null && !this.playerIsBroken) {
      this.playlists.loadPlaylists(newState.playlists);
    }

    if (newState.trackListMetaData !== null && !this.playerIsBroken) {
      this.tracklist.loadTracklist(newState.trackListMetaData, this.showTracklistRating);
    }

    if (newState.showTracklistRating !== null && !this.playerIsBroken) {
      this.showTracklistRating = newState.showTracklistRating;
      this.tracklist.showRatings(newState.showTracklistRating);
    }

    if (newState.playlistObj !== null && !this.playerIsBroken) {
      this.playlists.setObjectActive(newState.playlistObj);
    }

    if (newState.updatedPlaylist !== null && !this.playerIsBroken) {
      let [playlistObj, playlistTitle] = newState.updatedPlaylist;
      if (playlistObj == this.playlists.activeObject) {
        this.playlistTitle.update(playlistTitle);
      }
      this.playlists.updatePlaylist(newState.updatedPlaylist);
    }

    if (newState.trackObj !== null && !this.playerIsBroken) {
      this.tracklist.setObjectActive(newState.trackObj);
    }

    if (newState.updatedMetadata !== null && !this.playerIsBroken) {
      this.tracklist.updateMetadata(newState.updatedMetadata);
    }
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
    this.icon.icon_name = Util.getPlayerSymbolicIcon(playerInfo.desktopEntry);
  },

  toString: function() {
      return '[object PlayerUI(%s)]'.format(this.player.info.identity);
  },


  destroy: function() {
    if (this._updateId) {
      this.player.disconnect(this._updateId);
      this.player.disconnect(this._updateInfoId);
    }
    this.parent();
  }

});
