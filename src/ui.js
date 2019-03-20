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


var PlayerUI = class PlayerUI extends Widget.PlayerMenu {

  constructor(player) {
    super('', true);
    this.hidePlayStatusIcon();
    this.player = player;
    this.setCoverIconAsync = Util.setCoverIconAsync;
    this._updateId = player.connect('player-update', Lang.bind(this, this.update));

    this.oldShouldShow = null;

    this.playlistTitle = new Widget.PlaylistTitle();
    this.playlistTitle.connect('activate', Lang.bind(this.player, this.player.raise));
    this.addMenuItem(this.playlistTitle);
    this.playlistTitle.hide();

    this.trackCover = new Widget.TrackCover(new St.Icon({icon_name: 'audio-x-generic-symbolic', style_class: 'large-cover-icon'}));
    this.trackCover.connect('activate', Lang.bind(this.player, this.player.raise));
    this.addMenuItem(this.trackCover);
    this.trackCover.hide();

    this.trackRatings = new Widget.TrackRating(this.player);
    this.trackRatings.connect('activate', Lang.bind(this.player, this.player.raise));
    this.addMenuItem(this.trackRatings);
    this.trackRatings.hide();

    this.info = new Widget.Info();
    this.info.connect('activate', Lang.bind(this.player, this.player.raise));
    this.addMenuItem(this.info);

    this.trackControls = new Widget.PlayerButtons();
    this.trackControls.connect('activate', Lang.bind(this.player, this.player.raise));

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

    this.shuffleLoopStatus = new Widget.ShuffleLoopStatus(this.player);
    this.shuffleLoopStatus.connect('activate', Lang.bind(this.player, this.player.raise));
    this.addMenuItem(this.shuffleLoopStatus);
    this.shuffleLoopStatus.hide();

    this.position = new Widget.SliderItem('document-open-recent-symbolic');
    this.position.connect('activate', Lang.bind(this.player, this.player.raise));
    this.position.sliderConnect('value-changed', Lang.bind(this, function(item) {
      this.player.seek(item._value);
    }));
    this.addMenuItem(this.position);
    this.position.hide();

    this.volume = new Widget.SliderItem('audio-volume-high-symbolic');
    this.volume.connect('activate', Lang.bind(this.player, this.player.raise));
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

    if (Settings.MINOR_VERSION > 19) {
      this.stockMpris = Main.panel.statusArea.dateMenu._messageList._mediaSection;
      //Monkey patch
      this.stockMprisOldShouldShow = this.stockMpris._shouldShow;

    }
  }

  get state() {
    return this.player.state;
  }

  update(player, newState) {
    if (newState.desktopEntry !== null) {
      this.icon.icon_name = Util.getPlayerSymbolicIcon(this.state.desktopEntry);
    }

    if (newState.playerName !== null) {
      this.label.text = this.state.playerName;
    }

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

    if (newState.isRhythmboxStream !== null) {
      if (this.state.isRhythmboxStream) {
        this.trackCover.hideAnimate();
        this.trackRatings.hideAnimate();
        this.position.hideAnimate();
        this.shuffleLoopStatus.hideAnimate();
      }
      if (this.state.showLoopStatus
          && !this.state.isRhythmboxStream
          && this.state.status !== Settings.Status.STOP) {
        this.shuffleLoopStatus.showAnimate();
      }
    }

    if (newState.showPlayStatusIcon !== null) {
      if (this.state.showPlayStatusIcon) {
        this.showPlayStatusIcon();
      }
      else {
        this.hidePlayStatusIcon();
      }
    }

    if (newState.showRating !== null) {
      if (this.player.showRating
          && this.state.showRating !== 'no rating'
          && !this.state.isRhythmboxStream
          && this.state.status !== Settings.Status.STOP) {
        this.trackRatings.showAnimate();
      }
      else {
        this.trackRatings.hideAnimate();
      }
    }

    if (newState.showVolume !== null) {
      if (this.state.showVolume) {
        this.volume.showAnimate();
      }
      else {
        this.volume.hideAnimate();
      }
    }

    if (newState.buttonIconStyle !== null) {
      this.prevButton.setIconSize(this.state.buttonIconStyle);
      this.playButton.setIconSize(this.state.buttonIconStyle);
      this.stopButton.setIconSize(this.state.buttonIconStyle);
      this.nextButton.setIconSize(this.state.buttonIconStyle);
    }

    if (newState.shuffle !== null) {
      this.shuffleLoopStatus.setShuffle(this.state.shuffle);
    }

    if (newState.loopStatus !== null) {
      this.shuffleLoopStatus.setLoopStaus(this.state.loopStatus);
    }

    if (newState.showLoopStatus !== null) {
      if (!this.state.showLoopStatus) {
        this.shuffleLoopStatus.hideAnimate();
      }
      if (this.state.showLoopStatus
          && !this.state.isRhythmboxStream
          && this.state.status !== Settings.Status.STOP) {
        this.shuffleLoopStatus.showAnimate();
      }
    }

    if (newState.showPlaylistTitle !== null) {
      if (this.state.showPlaylistTitle && this.state.playlistTitle) {
        this.playlistTitle.showAnimate();
      }
      else {
        this.playlistTitle.hideAnimate();
      }
    }

    if (newState.playlistTitle !== null) {
      if (this.state.showPlaylistTitle && this.state.playlistTitle) {
        this.playlistTitle.update(this.state.playlistTitle);
        this.playlistTitle.showAnimate();
      }
      else {
        this.playlistTitle.hideAnimate();
      }
    }

    if (newState.showPosition !== null) {
      if (this.state.showPosition
          && this.state.trackLength !== 0
          && this.state.status !== Settings.Status.STOP
          && !this.state.isRhythmboxStream) {
        this.position.showAnimate();
      }
      else {
        this.position.hideAnimate();
      }
    }

    if (newState.playlistCount !== null) {
      if (this.state.showPlaylist && this.state.playlistCount > 0) {
        this.playlists.showAnimate();
      }
      else {
        this.playlists.hideAnimate();
      }
    }

    if (newState.showPlaylist !== null) {
      if (this.state.showPlaylist && this.state.playlistCount > 0) {
        this.playlists.showAnimate();
      }
      else {
        this.playlists.hideAnimate();
      }
    }

    if (newState.showTracklist !== null) {
      if (this.state.hasTrackList && this.state.showTracklist) {
        this.tracklist.showAnimate();
      }
      else {
        this.tracklist.hideAnimate();
      }
    }

    if (newState.hasTrackList !== null) {
      if (this.state.hasTrackList && this.state.showTracklist) {
        this.tracklist.showAnimate();
      }
      else {
        this.tracklist.hideAnimate();
      }
    }

    if (newState.trackRating !== null) {
      if (this.state.trackRating !== 'no rating') {
        this.trackRatings.rate(this.state.trackRating);
        if (this.state.showRating
            && !this.state.isRhythmboxStream
            && this.state.status !== Settings.Status.STOP) {
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
      this.info.update(this.state);
    }

    if (newState.volume !== null) {
      // Adapted from https://github.com/GNOME/gnome-shell/blob/master/js/ui/status/volume.js
      // So that our icon changes match the system volume icon changes.
      let value = this.state.volume, volumeIcon;
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
      if (this.state.canGoNext) {
        this.nextButton.enable();
      }
      else {
        this.nextButton.disable();
      }
      if (!this.state.canGoNext
          && !this.state.canGoPrevious
          && !this.state.canPlay
          && !this.state.canPause) {
        this.stopButton.disable();
      }
      else {
        this.stopButton.enable();
      }
    }

    if (newState.canGoPrevious !== null) {
      if (this.state.canGoPrevious) {
        this.prevButton.enable();
      }
      else {
        this.prevButton.disable();
      }
      if (!this.state.canGoNext
          && !this.state.canGoPrevious
          && !this.state.canPlay
          && !this.state.canPause) {
        this.stopButton.disable();
      }
      else {
        this.stopButton.enable();
      }
    }

    if (newState.canSeek !== null) {
      this.position.setReactive(this.state.canSeek);
    }

    if (newState.canPlay !== null) {
      if (this.state.status !== Settings.Status.PLAY) {
        if (this.state.canPlay) {
           this.playButton.enable();
        }
        else {
           this.playButton.disable();
        }
      }
      if (!this.state.canGoNext
          && !this.state.canGoPrevious
          && !this.state.canPlay
          && !this.state.canPause) {
        this.stopButton.disable();
      }
      else {
        this.stopButton.enable();
      }
    }

    if (newState.canPause !== null) {
      if (this.state.status === Settings.Status.PLAY) {
        if (this.state.canPause) {
          this.playButton.enable();
          if (!this.state.showStopButton) {
            this.stopButton.hide();
          }
        }
        else if (!this.player.playerIsBroken) {
           // If we're playing, we can't pause, and the player isn't broken
           // we should show the stop button no matter what.
           this.stopButton.show();
           this.playButton.disable();
        }
      }
      if (!this.state.canGoNext
          && !this.state.canGoPrevious
          && !this.state.canPlay
          && !this.state.canPause) {
        this.stopButton.disable();
      }
      else {
        this.stopButton.enable();
      }
    }

    if (newState.trackTime !== null) {
      if (this.state.trackLength === 0) {
        this.position.hideAnimate();
      }
      else if (this.state.status !== Settings.Status.STOP
               && this.state.showPosition
               && !this.state.isRhythmboxStream) {
        this.position.setValue(this.state.trackTime / this.state.trackLength);
        this.position.showAnimate();
      }
    }

    if (newState.status !== null) {
      if (this.state.status === Settings.Status.PLAY) {
        this.setPlayStatusIcon('media-playback-start-symbolic');
        this.playButton.setIcon('media-playback-pause-symbolic');
        if (this.state.canPause) {
          this.playButton.enable();
          if (!this.showStopButton) {
            this.stopButton.hide();
          }
        }
        else if (!this.player.playerIsBroken) {
           // If we're playing, we can't pause, and the player isn't broken
           // we should show the stop button no matter what.
           this.stopButton.show();
           this.playButton.disable();
        }
      }
      else {
        this.playButton.setIcon('media-playback-start-symbolic');
        if (this.state.canPlay) {
           this.playButton.enable();
        }
        else {
           this.playButton.disable();
        }
      }
      if (this.state.status === Settings.Status.STOP) {
        this.setPlayStatusIcon('media-playback-stop-symbolic');
        this.stopButton.hide();
        this.position.hideAnimate();
        this.shuffleLoopStatus.hideAnimate();
        this.trackRatings.hideAnimate();
        this.info.hideAnimate();
        this.trackCover.hideAnimate();
      }
      else {
        if (this.state.showStopButton) {
          this.stopButton.show();
        }
        if (!this.state.isRhythmboxStream) {
          this.trackCover.showAnimate();
        }
        if (this.state.showRating
            && !this.state.isRhythmboxStream
            && this.state.trackRating !== 'no rating') {
          this.trackRatings.showAnimate();
        }
        this.info.showAnimate();
        if (this.state.showPosition
            && this.state.trackLength !== 0
            && !this.state.isRhythmboxStream) {
          this.position.showAnimate();
        }
      }

      if (this.state.status === Settings.Status.PAUSE) {
        this.setPlayStatusIcon('media-playback-pause-symbolic');
      }

      if (this.state.showLoopStatus
          && !this.state.isRhythmboxStream
          && this.state.status !== Settings.Status.STOP) {
        this.shuffleLoopStatus.showAnimate();
      }
    }

    if (newState.showStopButton !== null) {
      if (this.state.showStopButton && this.state.status !== Settings.Status.STOP) {
        this.stopButton.show();
      }
      else if (this.state.status === Settings.Status.PLAY && this.state.canPause) {
        this.stopButton.hide();
      }
    }

    if (newState.trackCoverUrl !== null) {
      if (!this.state.isRhythmboxStream
          && this.state.status !== Settings.Status.STOP) {
        this.trackCover.showAnimate();
      }
      this.setCoverIconAsync(this.trackCover.icon,
                             this.state.trackCoverUrl,
                             '', this.player.isClementine,
                             this.trackCover.animating);
    }

    if (newState.playlists !== null) {
      this.playlists.loadPlaylists(this.state.playlists);
    }

    if (newState.trackListMetaData !== null) {
      this.tracklist.loadTracklist(this.state.trackListMetaData, this.state.showTracklistRating);
    }

    if (newState.showTracklistRating !== null) {
      this.tracklist.showRatings(this.state.showTracklistRating);
    }

    if (newState.playlistObj !== null) {
      this.playlists.setObjectActive(this.state.playlistObj);
    }

    if (newState.updatedPlaylist !== null) {
      let [playlistObj, playlistTitle] = this.state.updatedPlaylist;
      if (playlistObj == this.playlists.activeObject) {
        this.playlistTitle.update(playlistTitle);
      }
      this.playlists.updatePlaylist(this.state.updatedPlaylist);
    }

    if (newState.trackObj !== null) {
      this.tracklist.setObjectActive(this.state.trackObj);
    }

    if (newState.updatedMetadata !== null) {
      this.tracklist.updateMetadata(this.state.updatedMetadata);
    }
  }

  _createPlaylistWidget() {
    let playlistTitle = _("Playlists");
    let altPlaylistTitles = Settings.ALTERNATIVE_PLAYLIST_TITLES;
    for (let i = 0; i < altPlaylistTitles.length; i++) {
      let obj = altPlaylistTitles[i];
      for (let key in obj){
        if (key == this.player.busName) {
          playlistTitle = obj[key];
          break;
        }
      }
    }
    return new Widget.Playlists(playlistTitle, this.player);
  }

  _createTracklistWidget() {
    let tracklistTitle = _("Tracks");
    let altTracklistTitles = Settings.ALTERNATIVE_TRACKLIST_TITLES;
    for (let i = 0; i < altTracklistTitles.length; i++) {
      let obj = altTracklistTitles[i];
      for (let key in obj){
        if (key == this.player.busName) {
          tracklistTitle = obj[key];
          break;
        }
      }
    }
    return new Widget.TrackList(tracklistTitle, this.player);
  }

  toString() {
      return '[object PlayerUI(%s)]'.format(this.player.busName);
  }

  destroy() {
    if (this._updateId) {
      this.player.disconnect(this._updateId);
    }
    super.destroy();
  }
};
