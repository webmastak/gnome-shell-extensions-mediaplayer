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
const Shell = imports.gi.Shell;
const Signals = imports.signals;

const Gettext = imports.gettext.domain('gnome-shell-extensions-mediaplayer');
const _ = Gettext.gettext;

const Me = imports.misc.extensionUtils.getCurrentExtension();
const DBusIface = Me.imports.dbus;
const Settings = Me.imports.settings;
const Util = Me.imports.util;


var PlayerState = class PlayerState {

  constructor(params) {

    this.playerName = null;
    this.desktopEntry = null;
    this.status = null;

    this.playlistObj = null;
    this.playlists = null;
    this.playlistCount = null;
    this.orderings = null;

    this.trackListMetaData = null;

    this.trackTime = null;
    this.trackDuration = null;
    this.trackPosition = null;
    this.trackTitle = null;
    this.trackAlbum = null;
    this.trackArtist = null;
    this.trackUrl = null;
    this.trackCoverUrl = null;
    this.trackLength = null;
    this.trackObj = null;
    this.trackRating = null;
    this.fallbackIcon = null;

    this.showPlaylist = null;
    this.showTracklist = null;
    this.showRating = null;
    this.showVolume = null;
    this.showPosition = null;
    this.hideStockMpris = null;
    this.buttonIconStyle = null;
    this.showStopButton = null;
    this.showLoopStatus = null;
    this.showPlayStatusIcon = null;

    this.showTracklistRating = null;
    this.updatedMetadata = null;
    this.updatedPlaylist = null;
    this.hasTrackList = null;
    this.canPlay = null;
    this.canPause = null;
    this.canSeek = null;
    this.canGoNext = null;
    this.canGoPrevious = null;

    this.volume = null;
    this.showPlaylistTitle = null;
    this.playlistTitle = null;

    this.getPlaylists = null;

    this.isRhythmboxStream = null;

    this.shuffle = null;
    this.loopStatus = null;

    this.timeFresh = null;

    this.emitSignal = null;

    this.update(params || {});
  }

  update(state) {
    for (let key in state) {
      if (state[key] !== null)
        this[key] = state[key];
    }
  }
};


var MPRISPlayer = class MPRISPlayer {

    constructor(busName, owner) {
        let baseName = busName.split('.')[3];

        this.state = new PlayerState();

        this.owner = owner;
        this.busName = busName;
        this.isClementine = this.busName == 'org.mpris.MediaPlayer2.clementine';
        this.playerIsBroken = Settings.BROKEN_PLAYERS.indexOf(this.busName) != -1;
        this.noLoopStatusSupport = Settings.NO_LOOP_STATUS_SUPPORT.indexOf(this.busName) != -1;
        this.hasWrongVolumeScaling = Settings.WRONG_VOLUME_SCALING.indexOf(this.busName) != -1;
        this.app = null;
        // Guess the name based on the dbus path
        // Should be overriden by the Identity property
        this._identity = baseName.charAt(0).toUpperCase() + baseName.slice(1);
        this._trackTime = 0;
        this._wantedSeekValue = 0;
        this._timerId = 0;
        this._playlistTimeOutId = 0;
        this._tracklistTimeOutId = 0;
        this._settings = Settings.gsettings;
        this.parseMetadata = Util.parseMetadata;
        this._signalsId = [];
        this._tracklistSignalsId = [];
        this._trackIds = [];
        this._mediaServer = null;
        this._mediaServerPlayer = null;
        this._mediaServerPlaylists = null;
        this._mediaServerTracklist = null;
        this._prop = null;
        this._pithosRatings = null;
        this._ratingsExtension = null;
        new DBusIface.MediaServer2(busName,
                                   Lang.bind(this, function(proxy) {
                                        this._mediaServer = proxy;
                                        this._init2();
                                   }));
        new DBusIface.MediaServer2Player(busName,
                                         Lang.bind(this, function(proxy) {
                                             this._mediaServerPlayer = proxy;
                                             this._init2();
                                         }));
        new DBusIface.MediaServer2Playlists(busName,
                                            Lang.bind(this, function(proxy) {
                                               this._mediaServerPlaylists = proxy;
                                               this._init2();
                                            }));
        new DBusIface.MediaServer2Tracklist(busName,
                                            Lang.bind(this, function(proxy) {
                                               this._mediaServerTracklist = proxy;
                                               this._init2();
                                            }));
        new DBusIface.PithosRatings(busName,
                                    Lang.bind(this, function(proxy) {
                                        this._pithosRatings = proxy;
                                        this._init2();
                                    }));
        new DBusIface.RatingsExtension(busName,
                                       Lang.bind(this, function(proxy) {
                                           this._ratingsExtension = proxy;
                                           this._init2();
                                       }));
        new DBusIface.Properties(busName,
                                 Lang.bind(this, function(proxy) {
                                    this._prop = proxy;
                                    this._init2();
                                 }));

        this.connect('update-player-state', Lang.bind(this, function(player, state) {
          //global.log(JSON.stringify(state));
          this.state.update(state);
          if (state.status)
            this._onStatusChange(state);
          this.emit('player-update', state);
        }));
    }

    _init2() {
        // Wait for all DBus callbacks to continue
        if (this._mediaServer !== null
            && this._mediaServerPlayer !== null
            && this._mediaServerPlaylists !== null
            && this._mediaServerTracklist !== null
            && this._pithosRatings !== null
            && this._ratingsExtension !== null
            && this._prop !== null) {
            this._init3();
        }
    }

    _init3() {
        if (Settings.MINOR_VERSION > 19) {
        // Versions before 3.20 don't have Mpris built-in.
        // hideStockMpris setting
          this._signalsId.push(
            this._settings.connect("changed::" + Settings.MEDIAPLAYER_HIDE_STOCK_MPRIS_KEY, Lang.bind(this, function(settings, key) {
              this.emit('update-player-state', new PlayerState({hideStockMpris: settings.get_boolean(key)}));
            }))
          );
        }
        // showVolume setting
        this._signalsId.push(
          this._settings.connect("changed::" + Settings.MEDIAPLAYER_VOLUME_KEY, Lang.bind(this, function(settings, key) {
            if (this.state.showVolume !== this.showVolume) {
              if (this.showVolume) {
                let newState = new PlayerState();
                this._refreshProperties(newState);
              }
              else {
                this.emit('update-player-state', new PlayerState({showVolume: false}));
              }
            }
          }))
        );
        // showPosition setting
        this._signalsId.push(
          this._settings.connect("changed::" + Settings.MEDIAPLAYER_POSITION_KEY, Lang.bind(this, function(settings, key) {
            if (this.state.showPosition !== this.showPosition) {
              if (this.showPosition) {
                let newState = new PlayerState();
                this.parseMetadata(this._mediaServerPlayer.Metadata, newState);
                newState.emitSignal = true;
                this._refreshProperties(newState);
              }
              else {
                this.emit('update-player-state', new PlayerState({showPosition: false}));
              }
            }
          }))
        );
        // showRating setting
        this._signalsId.push(
          this._settings.connect("changed::" + Settings.MEDIAPLAYER_RATING_KEY, Lang.bind(this, function(settings, key) {
            if (this.state.showRating !== this.showRating) {
              this.emit('update-player-state', new PlayerState({showRating: this.showRating}));
            }
          }))
        );
        // showPlayStatusIcon setting
        this._signalsId.push(
          this._settings.connect("changed::" + Settings.MEDIAPLAYER_PLAY_STATUS_ICON_KEY, Lang.bind(this, function(settings, key) {
            this.emit('update-player-state', new PlayerState({showPlayStatusIcon: settings.get_boolean(key)}));
          }))
        );
        // showTracklistRating setting
        this._signalsId.push(
          this._settings.connect("changed::" + Settings.MEDIAPLAYER_TRACKLIST_RATING_KEY, Lang.bind(this, function(settings, key) {
            if (this.state.showTracklistRating !== this.showTracklistRating) {
              this.emit('update-player-state', new PlayerState({showTracklistRating: this.showTracklistRating}));
            }
          }))
        );
        // showStopButton setting
        this._signalsId.push(
          this._settings.connect("changed::" + Settings.MEDIAPLAYER_STOP_BUTTON_KEY, Lang.bind(this, function(settings, key) {
            if (this.state.showStopButton !== this.showStopButton) {
              this.emit('update-player-state', new PlayerState({showStopButton: this.showStopButton}));
            }
          }))
        );
        // showLoopStatus setting
        this._signalsId.push(
          this._settings.connect("changed::" + Settings.MEDIAPLAYER_LOOP_STATUS_KEY, Lang.bind(this, function(settings, key) {
            if (this.state.showLoopStatus !== this.showLoopStatus) {
              this.emit('update-player-state', new PlayerState({showLoopStatus: this.showLoopStatus}));
            }
          }))
        );
        // player controls buttonIconStyle setting
        this._signalsId.push(
          this._settings.connect("changed::" + Settings.MEDIAPLAYER_BUTTON_ICON_STYLE_KEY, Lang.bind(this, function(settings, key) {
            this.emit('update-player-state', new PlayerState({buttonIconStyle: settings.get_enum(key)}));
          }))
        );
        // showPlaylists setting
        this._signalsId.push(
          this._settings.connect("changed::" + Settings.MEDIAPLAYER_PLAYLISTS_KEY, Lang.bind(this, function(settings, key) {
            if (this.state.showPlaylist !== this.showPlaylist) {
              if (this.showPlaylist) {
                if (this.state.playlistCount > 0) {
                  this._getPlaylists(this.state.orderings);
                }
              }
              else {
                this.emit('update-player-state', new PlayerState({showPlaylist: false}));
              }
            }
          }))
        );
        // showPlaylistTitle setting
        this._signalsId.push(
          this._settings.connect("changed::" + Settings.MEDIAPLAYER_PLAYLIST_TITLE_KEY, Lang.bind(this, function(settings, key) {
            if (this.state.showPlaylistTitle !== this.showPlaylistTitle) {
              this.emit('update-player-state', new PlayerState({showPlaylistTitle: this.showPlaylistTitle}));
            }
          }))
        );
        // showTracklist setting
          this._signalsId.push(
            this._settings.connect("changed::" + Settings.MEDIAPLAYER_TRACKLIST_KEY, Lang.bind(this, function(settings, key) {
              if (this.showTracklist && this.state.hasTrackList) {
                this._getTracklist();
              }
              else {
                this.emit('update-player-state', new PlayerState({showTracklist: false}));
              }
            }))
          );

        this._tracklistSignalsId.push(
          this._mediaServerTracklist.connectSignal('TrackListReplaced', Lang.bind(this, function(proxy, sender, [trackIds, currentTrackId]) {
            this._trackIds = this._checkTrackIds(trackIds);
            this._getTracklist();
          }))
        );

        this._tracklistSignalsId.push(
          this._mediaServerTracklist.connectSignal('TrackAdded', Lang.bind(this, function(proxy, sender, [trackMetadata, afterTrackId]) {
            let insertIndex = -1;
            if (afterTrackId === 'org/mpris/MediaPlayer2/TrackList/NoTrack') {
              insertIndex = 0;
            }
            else {
              let afterTrackIdIndex = this._trackIds.indexOf(afterTrackId);
              if (afterTrackIdIndex !== -1) {
                insertIndex = afterTrackIdIndex + 1;
              }
            }
            if (insertIndex !== -1) {
              let metadata = {};
              this.parseMetadata(trackMetadata, metadata);
              if (metadata.trackObj !== 'org/mpris/MediaPlayer2/TrackList/NoTrack') {
                this._trackIds.splice(insertIndex, 0, metadata.trackObj);
                this._getTracklist();
              }
            }
          }))
        );

        this._tracklistSignalsId.push(
          this._mediaServerTracklist.connectSignal('TrackRemoved', Lang.bind(this, function(proxy, sender, [trackId]) {
             let removedTrackIndex = this._trackIds.indexOf(trackId);
             if (removedTrackIndex !== -1) {
               this._trackIds.splice(removedTrackIndex, 1);
               this._getTracklist();
             }
          }))
        );

        this._tracklistSignalsId.push(
          this._mediaServerTracklist.connectSignal('TrackMetadataChanged', Lang.bind(this, function(proxy, sender, [trackId, updatedMetadata]) {
            this.emit('update-player-state', new PlayerState({updatedMetadata: updatedMetadata}));
          }))
        );

        this._playlistsId = this._mediaServerPlaylists.connectSignal('PlaylistChanged', Lang.bind(this, function(proxy, sender, [updatedPlaylist]) {
          this.emit('update-player-state', new PlayerState({updatedPlaylist: updatedPlaylist}));
        }));

        this._propChangedId = this._prop.connectSignal('PropertiesChanged', Lang.bind(this, function(proxy, sender, [iface, props]) {
          let newState = new PlayerState();

          if (props.Volume) {
            let volume = props.Volume.unpack();
            if (this.hasWrongVolumeScaling) {
              volume = Math.pow(volume, 1 / 3);
            }
            if (this.state.volume !== volume) {
              newState.volume = volume;
              newState.emitSignal = true;
            }
          }

          if (props.Shuffle) {
            let shuffle = props.Shuffle.unpack();
            if (this.state.shuffle !== shuffle) {
              newState.shuffle = shuffle;
              newState.emitSignal = true;
            }
          }

          if (props.LoopStatus) {
            let loopStatus = props.LoopStatus.unpack();
            if (this.state.loopStatus !== loopStatus) {
              newState.loopStatus = loopStatus;
              newState.emitSignal = true;
            }
          }

          if (props.CanPlay) {
            let canPlay = props.CanPlay.unpack();
            if (this.state.canPlay !== canPlay) {
              newState.canPlay = canPlay;
              newState.emitSignal = true;
            }
          }

          if (props.CanPause) {
            let canPause = props.CanPause.unpack();
            if (this.state.canPause !== canPause) {
              newState.canPause = canPause;
              newState.emitSignal = true;
            }
          }

          if (props.CanGoNext) {
            let canGoNext = props.CanGoNext.unpack();
            if (this.state.canGoNext !== canGoNext) {
              newState.canGoNext = canGoNext;
              newState.emitSignal = true;
            }
          }

          if (props.CanGoPrevious) {
            let canGoPrevious = props.CanGoPrevious.unpack();
            if (this.state.canGoPrevious !== canGoPrevious) {
              newState.canGoPrevious = canGoPrevious;
              newState.emitSignal = true;
            }
          }

          if (props.HasTrackList) {
            let hasTrackList = props.HasTrackList.unpack();
            if (this.state.hasTrackList !== hasTrackList) {
              newState.hasTrackList = hasTrackList;
              newState.emitSignal = true;
            }
          }

          if (props.CanSeek) {
            let canSeek = props.CanSeek.unpack();
            if (this.state.canSeek !== canSeek) {
              newState.canSeek = canSeek;
              newState.emitSignal = true;
            }
          }

          if (props.Orderings) {
            let orderings = this._checkOrderings(props.Orderings.deep_unpack());
            if (JSON.stringify(orderings) != JSON.stringify(this.state.orderings)) {
              newState.orderings = orderings;
              newState.emitSignal = true;
              newState.getPlaylists = true;
            }
          }

          if (props.PlaylistCount) {
            let playlistCount = props.PlaylistCount.unpack();
            if (this.state.playlistCount !== playlistCount) {
              newState.playlistCount = playlistCount;
              newState.emitSignal = true;
              if (playlistCount > 0) {
                newState.getPlaylists = true;
              }
              else {
                newState.getPlaylists = null;
              }
            }
          }

          if (props.ActivePlaylist) {
            let [playlistObj, playlistTitle] = props.ActivePlaylist.deep_unpack()[1];

            if (this.state.playlistObj !== playlistObj) {
              newState.playlistObj = playlistObj;
              newState.emitSignal = true;
            }
            if (this.state.playlistTitle !== playlistTitle) {
              newState.playlistTitle = playlistTitle;
              newState.emitSignal = true;
            }
          }

          if (props.PlaybackStatus) {
            let status = props.PlaybackStatus.unpack();
            if (this.state.status != status) {
              newState.status = status;
              newState.emitSignal = true;
            }
          }

          if (props.Metadata) {
            this.parseMetadata(props.Metadata.deep_unpack(), newState);
            newState.trackDuration = this._formatTime(newState.trackLength)
            newState.emitSignal = true;
            if (newState.trackUrl !== this.state.trackUrl || newState.trackObj !== this.state.trackObj) {
              this._refreshProperties(newState);
            }
            else {
              this.emit('update-player-state', newState);
              if (newState.getPlaylists) {
                let _orderings = newState.orderings || this.state.orderings;
                this._getPlaylists(_orderings);
              }
            }
          }
          else if (newState.emitSignal) {
            this.emit('update-player-state', newState);
            if (newState.getPlaylists) {
              let _orderings = newState.orderings || this.state.orderings;
              this._getPlaylists(_orderings);
            }
          }
        }));

        this._seekedId = this._mediaServerPlayer.connectSignal('Seeked', Lang.bind(this, function(proxy, sender, [value]) {
          if (value > 0) {
            this.trackTime = Math.round(value / 1000000);
            this._wantedSeekValue = 0;
          }
          // Banshee is buggy and always emits Seeked(0). See #34, #183,
          // also <https://bugzilla.gnome.org/show_bug.cgi?id=654524>.
          else {
            // If we caused the seek, just use the expected position.
            // This is actually needed because even Get("Position")
            // sometimes returns 0 immediately after seeking! *grumble*
            if (this._wantedSeekValue > 0) {
              this.trackTime = this._wantedSeekValue / 1000000;
              this._wantedSeekValue = 0;
            }
            // If the seek was initiated by the player itself, query it
            // for the new position.
            else {
              let newState = new PlayerState();
              this._refreshProperties(newState);
            }
          }
        }));
        if (this.desktopEntry) {
          let appSys = Shell.AppSystem.get_default();
          this.app = appSys.lookup_app(this.desktopEntry + ".desktop");
        }
        this.populate();
    }

    populate() {
      // The Tracks prop value is never updated so it's value is only good
      // for right after the player is created after that we rely on
      // the TrackListReplaced, TrackAdded, and TrackRemoved signals
      // to keep our trackIds current as per spec.
      this._trackIds = this._checkTrackIds(this._mediaServerTracklist.Tracks);

      let newState = new PlayerState({
        canGoNext: this.canGoNext,
        canGoPrevious: this.canGoPrevious,
        canPlay: this.canPlay,
        canPause: this.canPause,
        canSeek: this.canSeek,
        hasTrackList: this.hasTrackList,
        volume: this.volume,
        status: this.playbackStatus,
        playerName: this.identity,
        desktopEntry: this.desktopEntry,
        playlistCount: this.playlistCount,
        orderings: this.orderings,
        loopStatus: this.loopStatus,
        shuffle: this.shuffle,
        showPlayStatusIcon: this.showPlayStatusIcon,
        showLoopStatus: this.showLoopStatus,
        showStopButton: this.showStopButton,
        buttonIconStyle: this.buttonIconStyle,
        showVolume: this.showVolume,
        showPosition: this.showPosition,
        showRating: this.showRating,
        showPlaylist: this.showPlaylist,
        showPlaylistTitle: this.showPlaylistTitle,
        showTracklist: this.showTracklist,
        showTracklistRating: this.showTracklistRating
      });

      [newState.playlistObj, newState.playlistTitle] = this.activePlaylist;

      if (Settings.MINOR_VERSION > 19) {
        newState.hideStockMpris = this.hideStockMpris;
      }

      this.parseMetadata(this._mediaServerPlayer.Metadata, newState);

      //Delay calls 1 sec because some players make the interface available without data available in the beginning

      if (newState.playlistCount > 0 && newState.playlistTitle) {
        this._playlistTimeOutId = Mainloop.timeout_add_seconds(1, Lang.bind(this, function() {
          this._playlistTimeOutId = 0;
          this._getPlaylists(this.state.orderings);
          return false;
        }));
      }
      else {
        newState.showPlaylist = false;
      }

      let isDummyTracklist = this._trackIds.length == 1 && this._trackIds[0] == '/org/mpris/MediaPlayer2/TrackList/NoTrack';
      if (newState.hasTrackList && !isDummyTracklist) {
        this._tracklistTimeOutId = Mainloop.timeout_add_seconds(1, Lang.bind(this, function() {
          this._tracklistTimeOutId = 0;
          this._getTracklist();
          return false;
        }));
      }
      else {
        newState.showTracklist = false;
      }

      this.emit('update-player-state', newState);
    }

    _checkTrackIds(trackIds) {
      if (!trackIds || !Array.isArray(trackIds)) {
        trackIds = [];
      }
      return trackIds;
    }

    _checkOrderings(orderings) {
      if (!orderings || !Array.isArray(orderings) || orderings.length < 1) {
        orderings = ['Alphabetical'];
      }
      return orderings;
    }

    set trackTime(value) {
      // Assume that if our trackTime is equal to or greater than
      // the trackLength the song must have started over.
      let trackLength = this.state.trackLength || 0;
      if (this._trackTime >= trackLength) {
        value = 0;
      }
      let newState = new PlayerState();
      this._trackTime = value;
      newState.trackTime = value;
      newState.trackPosition = this._formatTime(value);
      this.emit('update-player-state', newState);
    }

    get trackTime() {
      return this._trackTime;
    }

    get canGoNext() {
      let canGoNext = this._mediaServerPlayer.CanGoNext;
      if (canGoNext === null) {
        canGoNext = true;
      }
      return canGoNext;
    }

    get canGoPrevious() {
      let canGoPrevious = this._mediaServerPlayer.CanGoPrevious;
      if (canGoPrevious === null) {
        canGoPrevious = true;
      }
      return canGoPrevious;
    }

    get canPlay() {
      let canPlay = this._mediaServerPlayer.CanPlay;
      if (canPlay === null) {
        canPlay = true;
      }
      return canPlay;
    }

    get canPause() {
      let canPause = this._mediaServerPlayer.CanPause;
      if (canPause === null) {
        canPause = true;
      }
      return canPause;
    }

    get canQuit() {
      return this._mediaServer.CanQuit || false;
    }

    get canSeek() {
      return this._mediaServerPlayer.CanSeek || false;
    }

    get hasTrackList() {
      return this._mediaServer.HasTrackList || false;
    }

    get volume() {
      let volume = this._mediaServerPlayer.Volume;
      if (volume === null) {
        volume = 0.0;
      }
      else if (this.hasWrongVolumeScaling) {
        volume = Math.pow(volume, 1 / 3);
      }
      return volume;
    }

    set volume(volume) {
      if (this.hasWrongVolumeScaling) {
        volume = Math.pow(volume, 3);
      }
      this._mediaServerPlayer.Volume = volume;
    }

    get shuffle() {
      return this._mediaServerPlayer.Shuffle || false;
    }

    set shuffle(shuffle) {
      if (this._mediaServerPlayer.Shuffle !== null) {
        this._mediaServerPlayer.Shuffle = shuffle;
      }
    }

    get loopStatus() {
      return this._mediaServerPlayer.LoopStatus || 'None';
    }

    set loopStatus(loopStatus) {
      if (this._mediaServerPlayer.LoopStatus !== null) {
        this._mediaServerPlayer.LoopStatus = loopStatus;
      }
    }

    get shouldShowLoopStatus() {
      return this._mediaServerPlayer.LoopStatus !== null && this._mediaServerPlayer.Shuffle !== null;
    }

    get playbackStatus() {
      return this._mediaServerPlayer.PlaybackStatus || Settings.Status.STOP;
    }

    get identity() {
      return this._mediaServer.Identity || this._identity;
    }

    get desktopEntry() {
      return (this._mediaServer.DesktopEntry || '');
    }

    get activePlaylist() {
      let activePlaylist = this._mediaServerPlaylists.ActivePlaylist;
      if (activePlaylist === null || !activePlaylist || !activePlaylist[1]) {
        activePlaylist = [null, null];
      }
      else {
        activePlaylist = activePlaylist[1];
      }
      return activePlaylist;
    }

    get playlistCount() {
      return this._mediaServerPlaylists.PlaylistCount || 0;
    }

    get orderings() {
      return this._checkOrderings(this._mediaServerPlaylists.Orderings);
    }

    get showPlayStatusIcon() {
      return this._settings.get_boolean(Settings.MEDIAPLAYER_PLAY_STATUS_ICON_KEY);
    }

    get showLoopStatus() {
      return this._settings.get_boolean(Settings.MEDIAPLAYER_LOOP_STATUS_KEY) && this.shouldShowLoopStatus && !this.noLoopStatusSupport;
    }

    get showStopButton() {
      return this._settings.get_boolean(Settings.MEDIAPLAYER_STOP_BUTTON_KEY) && !this.playerIsBroken;
    }

    get buttonIconStyle() {
      return this._settings.get_enum(Settings.MEDIAPLAYER_BUTTON_ICON_STYLE_KEY);
    }

    get showVolume() {
      return this._settings.get_boolean(Settings.MEDIAPLAYER_VOLUME_KEY) && !this.playerIsBroken;
    }

    get showPosition() {
      return this._settings.get_boolean(Settings.MEDIAPLAYER_POSITION_KEY) && !this.playerIsBroken;
    }

    get showRating() {
      return this._settings.get_boolean(Settings.MEDIAPLAYER_RATING_KEY) && !this.playerIsBroken;
    }

    get showPlaylist() {
      return this._settings.get_boolean(Settings.MEDIAPLAYER_PLAYLISTS_KEY) && !this.playerIsBroken && !this.isClementine;
    }

    get showPlaylistTitle() {
      return this._settings.get_boolean(Settings.MEDIAPLAYER_PLAYLIST_TITLE_KEY) && !this.playerIsBroken && !this.isClementine;
    }

    get showTracklist() {
      return this._settings.get_boolean(Settings.MEDIAPLAYER_TRACKLIST_KEY) && !this.playerIsBroken && !this.isClementine;
    }

    get showTracklistRating() {
      return this._settings.get_boolean(Settings.MEDIAPLAYER_TRACKLIST_RATING_KEY) && !this.playerIsBroken;
    }

    get hideStockMpris() {
      return this._settings.get_boolean(Settings.MEDIAPLAYER_HIDE_STOCK_MPRIS_KEY);
    }

    next() {
      this._mediaServerPlayer.NextRemote();
    }

    previous() {
      this._mediaServerPlayer.PreviousRemote();
    }

    playPause() {
      this._mediaServerPlayer.PlayPauseRemote();
    }

    stop() {
      this._mediaServerPlayer.StopRemote();
    }

    seek(value) {
      let time = value * this.state.trackLength;
      this._wantedSeekValue = Math.round(time * 1000000);
      this._mediaServerPlayer.SetPositionRemote(this.state.trackObj, this._wantedSeekValue);
    }

    playPlaylist(playlistObj) {
      this._mediaServerPlaylists.ActivatePlaylistRemote(playlistObj);
    }

    playTrack(track) {
      // GNOME Music crashes if you call the GoTo method.
      //https://bugzilla.gnome.org/show_bug.cgi?id=779052
      if (this.busName !== 'org.mpris.MediaPlayer2.GnomeMusic') {
        this._mediaServerTracklist.GoToRemote(track);
      }
    }

    raise() {
      if (this.app) {
        this.app.activate_full(-1, 0);
      }
      else if (this._mediaServer.CanRaise) {
        this._mediaServer.RaiseRemote();
      }
    }

    quit() {
      if (this.canQuit) {
        this._mediaServer.QuitRemote();
      }
    }

    _refreshProperties(newState) {
      // Check properties
      // Many players have a habit of changing properties without emitting
      // a PropertiesChanged signal as they should. This is basically CYA.
      // In a perfect world this would be redundant and unnecessary.
      this._prop.GetAllRemote('org.mpris.MediaPlayer2',
        Lang.bind(this, function([props], err) {
          if (!err) {
            if (newState.hasTrackList === null && props.HasTrackList) {
              let hasTrackList = props.HasTrackList.unpack();
              if (this.state.hasTrackList !== hasTrackList) {
                newState.hasTrackList = hasTrackList;
                newState.emitSignal = true;
              }
            }
          }
          this._prop.GetAllRemote('org.mpris.MediaPlayer2.Player',
            Lang.bind(this, function([props], err) {
              if (!err) {
                if (newState.canPlay === null && props.CanPlay) {
                  let canPlay = props.CanPlay.unpack();
                  if (this.state.canPlay !== canPlay) {
                    newState.canPlay = canPlay;
                    newState.emitSignal = true;
                  }
                }
                if (newState.canPause === null && props.CanPause) {
                  let canPause = props.CanPause.unpack();
                  if (this.state.canPause !== canPause) {
                    newState.canPause = canPause;
                    newState.emitSignal = true;
                  }
                }
                if (newState.canGoNext === null && props.CanGoNext) {
                let canGoNext = props.CanGoNext.unpack();
                  if (this.state.canGoNext !== canGoNext) {
                    newState.canGoNext = canGoNext;
                    newState.emitSignal = true;
                  }
                }
                if (newState.canGoPrevious === null && props.CanGoPrevious) {
                  let canGoPrevious = props.CanGoPrevious.unpack();
                    if (this.state.canGoPrevious !== canGoPrevious) {
                      newState.canGoPrevious = canGoPrevious;
                      newState.emitSignal = true;
                    }
                }
                if (newState.canSeek === null && props.CanSeek) {
                  let canSeek = props.CanSeek.unpack();
                  if (this.state.canSeek !== canSeek) {
                    newState.canSeek = canSeek;
                    newState.emitSignal = true;
                  }
                }
                if (newState.shuffle === null && props.Shuffle) {
                  let shuffle = props.Shuffle.unpack();
                  if (this.state.shuffle !== shuffle) {
                    newState.shuffle = shuffle;
                    newState.emitSignal = true;
                  }
                }
                if (newState.loopStatus === null && props.LoopStatus) {
                  let loopStatus = props.LoopStatus.unpack();
                  if (this.state.loopStatus !== loopStatus) {
                    newState.loopStatus = loopStatus;
                    newState.emitSignal = true;
                  }
                }
                if (newState.status === null && props.PlaybackStatus) {
                  let status = props.PlaybackStatus.unpack();
                  if (this.state.status != status) {
                    newState.status = status;
                    newState.emitSignal = true;
                  }
                }
                if (props.Volume) {
                  let volume = props.Volume.unpack();
                  if (this.hasWrongVolumeScaling) {
                    volume = Math.pow(volume, 1 / 3);
                  }
                  if (this.state.volume !== volume) {
                    newState.volume = volume;
                    newState.emitSignal = true;
                  }
                  if (this.state.showVolume == false && this.showVolume) {
                    // Reenable showVolume after error
                    newState.showVolume = true;
                    newState.emitSignal = true;
                  }
                }
                else if (this.state.showVolume) {
                  newState.showVolume = false;
                  newState.emitSignal = true;
                }
                if (props.Position) {
                  let position = Math.round(props.Position.unpack() / 1000000);
                  newState.timeFresh = true;
                  if (this.trackTime !== position) {
                    this._trackTime = position;
                    newState.trackTime = position;
                    newState.emitSignal = true;
                  }
                  if (this.state.showPosition == false && this.showPosition) {
                    // Reenable showPosition after error
                    newState.showPosition = true;
                    newState.emitSignal = true;
                  }
                }
                else if (this.state.showPosition) {
                  newState.showPosition = false;
                  newState.emitSignal = true;
                }
              }
              if (newState.emitSignal) {
                this.emit('update-player-state', newState);
              }
          }));
      }));
    }

    _getPlaylists(orderings) {
      // A player may have trigger the fetching of a playlist
      // before our initial startup timeout happens.
      if (this._playlistTimeOutId !== 0) {
        Mainloop.source_remove(this._playlistTimeOutId);
        this._playlistTimeOutId = 0;
      }
      // Use Alphabetical as the playlist ordering
      // unless Alphabetical is not in the Orderings,
      // in that case use the 1st available ordering in the array.
      let ordering = "Alphabetical";
      if (orderings.indexOf(ordering) === -1)
        ordering = orderings[0];
      this._mediaServerPlaylists.GetPlaylistsRemote(0, 100, ordering, false, Lang.bind(this, function([playlists]) {
        if (playlists && Array.isArray(playlists)) {
          if (this.state.showPlaylist == false && this.showPlaylist) {
            //Reenable showPlaylist after error
            this.emit('update-player-state', new PlayerState({showPlaylist: true}));
          }
          this.emit('update-player-state', new PlayerState({playlists: playlists}));
        }
        else {
          this.emit('update-player-state', new PlayerState({showPlaylist: false}));
        }
      }));
    }

    _getTracklist() {
      // A player may have trigger the fetching of a tracklist
      // before our initial startup timeout happens.
      if (this._tracklistTimeOutId !== 0) {
        Mainloop.source_remove(this._tracklistTimeOutId);
        this._tracklistTimeOutId = 0;
      }
      if (this._trackIds.length === 0) {
        this.emit('update-player-state', new PlayerState({showTracklist: false}));
      }
      else {
        this._mediaServerTracklist.GetTracksMetadataRemote(this._trackIds, Lang.bind(this, function([trackListMetaData]) {
          if (trackListMetaData && Array.isArray(trackListMetaData)) {
            if (this.state.showTracklist == false && this.showTracklist) {
              //Reenable showTracklist after error
              this.emit('update-player-state', new PlayerState({showTracklist: true}));
            }
            this.emit('update-player-state', new PlayerState({trackListMetaData: trackListMetaData}));
          }
          else {
            this.emit('update-player-state', new PlayerState({showTracklist: false}));
          }
        }));
      }
    }

    _onStatusChange(newState) {
      // If the player is broken (Spotify you suck...) we'll never see the
      // position slider any way. No need to waste CPU cycles
      // on a timer...
      if (this.playerIsBroken) {
        return;
      }
      // sync track time
      // If the time is fresh we just came from a
      // properties refresh and don't need to do it again.
      if (!newState.timeFresh) {
        let newState = new PlayerState();
        this._refreshProperties(newState);
      }
      if (this.state.status == Settings.Status.PLAY) {
        this._startTimer();
      }
      else if (this.state.status == Settings.Status.PAUSE) {
        this._stopTimer();
      }
      else if (this.state.status == Settings.Status.STOP) {
        this._stopTimer();
        this.trackTime = 0;
      }
    }

    _startTimer() {
      if (this._timerId === 0) {
        this._timerId = Mainloop.timeout_add_seconds(1, Lang.bind(this, function() {
          return this.trackTime += 1;
        }));
      }
    }

    _stopTimer() {
      if (this._timerId !== 0) {
        Mainloop.source_remove(this._timerId);
        this._timerId = 0;
      }
    }

    _formatTime(s) {
      if (Number.isNaN(s) || s < 0) {
        return '0:00'
      }
      let h = Math.floor(s / 3600);
      let m = Math.floor((s % 3600) / 60);
      s = s % 60;
      s = s < 10 ? '0' + s : s;
      m = m < 10 && h > 0 ? '0' + m + ':' : m + ':';
      h = h > 0 ? h + ':' : '';
      return h + m + s;
    }

    destroy() {
        // Cancel all pending timeouts.
        this._stopTimer();
        if (this._playlistTimeOutId !== 0) {
          Mainloop.source_remove(this._playlistTimeOutId);
          this._playlistTimeOutId = 0;
        }
        if (this._tracklistTimeOutId !== 0) {
          Mainloop.source_remove(this._tracklistTimeOutId);
          this._tracklistTimeOutId = 0;
        }
        // Disconnect all signals.
        if (this._propChangedId) {
          this._prop.disconnectSignal(this._propChangedId);
        }
        if (this._playlistsId) {
          this._mediaServerPlaylists.disconnectSignal(this._playlistsId);
        }
        if (this._seekedId) {
          this._mediaServerPlayer.disconnectSignal(this._seekedId);
        }

        for (let id in this._tracklistSignalsId) {
          if (id) {
            this._mediaServerTracklist.disconnectSignal(this._tracklistSignalsId[id]);
          }
        }

        for (let id in this._signalsId) {
            this._settings.disconnect(this._signalsId[id]);
        }
    }

    toString() {
        return "<object MPRISPlayer(%s)>".format(this.info.identity);
    }
};
Signals.addSignalMethods(MPRISPlayer.prototype);
