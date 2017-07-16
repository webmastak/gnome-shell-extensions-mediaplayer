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
const PopupMenu = imports.ui.popupMenu;
const GLib = imports.gi.GLib;
const Signals = imports.signals;

const Gettext = imports.gettext.domain('gnome-shell-extensions-mediaplayer');
const _ = Gettext.gettext;

const Me = imports.misc.extensionUtils.getCurrentExtension();
const Widget = Me.imports.widget;
const DBusIface = Me.imports.dbus;
const Settings = Me.imports.settings;
const Util = Me.imports.util;


const PlayerState = new Lang.Class({
  Name: 'PlayerState',

  _init: function(params) {
    this.update(params || {});
  },

  update: function(state) {
    for (let key in state) {
      if (state[key] !== null)
        this[key] = state[key];
    }
  },

  playerName: null,
  desktopEntry: null,
  status: null,

  playlistObj: null,
  playlists: null,
  playlistCount: null,
  orderings: null,

  trackListMetaData: null,

  trackTime: null,
  trackTitle: null,
  trackAlbum: null,
  trackArtist: null,
  trackUrl: null,
  trackCoverUrl: null,
  trackLength: null,
  trackObj: null,
  trackRating: null,
  fallbackIcon: null,

  showPlaylist: null,
  showTracklist: null,
  showRating: null,
  showVolume: null,
  showPosition: null,
  hideStockMpris: null,
  showStopButton: null,
  showLoopStatus: null,

  showTracklistRating: null,
  updatedMetadata: null,
  updatedPlaylist: null,
  hasTrackList: null,
  canSeek: null,
  canGoNext: null,
  canGoPrevious: null,

  volume: null,
  showPlaylistTitle: null,
  playlistTitle: null,

  getPlaylists: null,

  isRhythmboxStream: null,

  shuffle: null,
  loopStatus: null,

  emitSignal: null,
});


const MPRISPlayer = new Lang.Class({
    Name: 'MPRISPlayer',

    _init: function(busName, owner) {
        let baseName = busName.split('.')[3];

        this.info = {
            owner: owner,
            busName: busName,
            app: null,
            appInfo: null,
            // Guess a name based on the dbus path
            identity: baseName.charAt(0).toUpperCase() + baseName.slice(1),
            canRaise: false
        };

        this.state = new PlayerState();

        this.owner = owner;
        this.busName = busName;
        // Guess the name based on the dbus path
        // Should be overriden by the Identity property
        this._identity = baseName.charAt(0).toUpperCase() + baseName.slice(1);
        this._trackTime = 0;
        this._wantedSeekValue = 0;

        this._timerId = 0;
        this._statusId = 0;
        this._playlistTimeOutId = 0;
        this._tracklistTimeOutId = 0;

        this._settings = Settings.gsettings;
        this.parseMetadata = Util.parseMetadata;
        this._signalsId = [];
        this._tracklistSignalsId = [];
        this._trackIds = [];

        this.parent(this._identity, true);
        this._mediaServer = null;
        this._mediaServerPlayer = null;
        this._mediaServerPlaylists = null;
        this._mediaServerTracklist = null;
        this._prop = null;
        this._pithosRatings = null;
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
        new DBusIface.Properties(busName,
                                 Lang.bind(this, function(proxy) {
                                    this._prop = proxy;
                                    this._init2();
                                 }));

        this.connect("player-update", Lang.bind(this, function(player, state) {
          //global.log(JSON.stringify(state));
          this.state.update(state);
          if (state.status)
            this._onStatusChange();
        }));

    },

    _init2: function() {
        // Wait for all DBus callbacks to continue
        if (this._mediaServer !== null
            && this._mediaServerPlayer !== null
            && this._mediaServerPlaylists !== null
            && this._mediaServerTracklist !== null
            && this._prop !== null
            && this._pithosRatings !== null) {
            this._init3();
        }
    },

    _init3: function() {
        this.info.canRaise = this._mediaServer.CanRaise;
        this.sendsStopOnSongChange = Settings.SEND_STOP_ON_CHANGE.indexOf(this.busName) != -1;
        this.hasWrongVolumeScaling = Settings.WRONG_VOLUME_SCALING.indexOf(this.busName) != -1;
        if (Settings.MINOR_VERSION > 19) {
        // Versions before 3.20 don't have Mpris built-in.
        // hideStockMpris setting
          this._signalsId.push(
            this._settings.connect("changed::" + Settings.MEDIAPLAYER_HIDE_STOCK_MPRIS_KEY, Lang.bind(this, function(settings, key) {
              this.emit('player-update', new PlayerState({hideStockMpris: settings.get_boolean(key)}));
            }))
          );
        }
        // showVolume setting
        this._signalsId.push(
          this._settings.connect("changed::" + Settings.MEDIAPLAYER_VOLUME_KEY, Lang.bind(this, function(settings, key) {
            let showVolume = settings.get_boolean(key);
            if (this.state.showVolume !== showVolume) {
              if (showVolume) {
                this._prop.GetRemote('org.mpris.MediaPlayer2.Player', 'Volume', Lang.bind(this, function([value], err) {
                  if (!err) {
                    let newState = new PlayerState();
                    newState.showVolume = true;
                    let volume = value.unpack();
                    if (this.state.volume !== volume) {
                      newState.volume = volume;
                    }
                    this.emit('player-update', newState);
                  }
                }));
              }
              else {
                this.emit('player-update', new PlayerState({showVolume: false}));
              }
            }              
          }))
        );
        // showPosition setting
        this._signalsId.push(
          this._settings.connect("changed::" + Settings.MEDIAPLAYER_POSITION_KEY, Lang.bind(this, function(settings, key) {
            let showPosition = settings.get_boolean(key);
            if (this.state.showPosition !== showPosition) {
              if (settings.get_boolean(key)) {
                this._getPosition(true);
              }
              else {
                this.emit('player-update', new PlayerState({showPosition: false}));
              }
            }
          }))
        );
        // showRating setting
        this._signalsId.push(
          this._settings.connect("changed::" + Settings.MEDIAPLAYER_RATING_KEY, Lang.bind(this, function(settings, key) {
            this.emit('player-update', new PlayerState({showRating: settings.get_boolean(key)}));
          }))
        );
        // showTracklistRating setting
        this._signalsId.push(
          this._settings.connect("changed::" + Settings.MEDIAPLAYER_TRACKLIST_RATING_KEY, Lang.bind(this, function(settings, key) {
            this.emit('player-update', new PlayerState({showTracklistRating: settings.get_boolean(key)}));
          }))
        );
        // showStopButton setting
        this._signalsId.push(
          this._settings.connect("changed::" + Settings.MEDIAPLAYER_STOP_BUTTON_KEY, Lang.bind(this, function(settings, key) {
            this.emit('player-update', new PlayerState({showStopButton: settings.get_boolean(key)}));
          }))
        );
        // showLoopStatus setting
        this._signalsId.push(
          this._settings.connect("changed::" + Settings.MEDIAPLAYER_LOOP_STATUS_KEY, Lang.bind(this, function(settings, key) {
            let showLoopStatus = settings.get_boolean(key) && this.shouldShowLoopStatus;
            this.emit('player-update', new PlayerState({showLoopStatus: showLoopStatus}));
          }))
        );
        // showPlaylists setting
        this._signalsId.push(
          this._settings.connect("changed::" + Settings.MEDIAPLAYER_PLAYLISTS_KEY, Lang.bind(this, function(settings, key) {
            let showPlaylist = settings.get_boolean(key);
            if (this.state.showPlaylist !== showPlaylist) {
              if (showPlaylist) {
                if (this.state.playlistCount > 0) {
                  this._getPlaylists(this.state.orderings);
                }
              }
              else {
                this.emit('player-update', new PlayerState({showPlaylist: false}));
              }
            }
          }))
        );
        // showPlaylistTitle setting
        this._signalsId.push(
          this._settings.connect("changed::" + Settings.MEDIAPLAYER_PLAYLIST_TITLE_KEY, Lang.bind(this, function(settings, key) {
            this.emit('player-update', new PlayerState({showPlaylistTitle: settings.get_boolean(key)}));
          }))
        );
        // showTracklist setting
          this._signalsId.push(
            this._settings.connect("changed::" + Settings.MEDIAPLAYER_TRACKLIST_KEY, Lang.bind(this, function(settings, key) {
              let showTracklist = settings.get_boolean(key);
              if (showTracklist && this.state.hasTrackList) {
                this._getTracklist();
              }
              this.emit('player-update', new PlayerState({showTracklist: showTracklist}));
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
            this.emit('player-update', new PlayerState({updatedMetadata: updatedMetadata}));
          }))
        );

        this._playlistsId = this._mediaServerPlaylists.connectSignal('PlaylistChanged', Lang.bind(this, function(proxy, sender, [updatedPlaylist]) {
          this.emit('player-update', new PlayerState({updatedPlaylist: updatedPlaylist}));
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
            if (this.sendsStopOnSongChange && status == Settings.Status.STOP) {
              // Some players send a "PlaybackStatus: Stopped" signal when changing
              // tracks, so wait a little before refreshing if they send a "Stopped" signal.
              if (this._statusId !== 0) {
                Mainloop.source_remove(this._statusId);
                this._statusId = 0;
              }
              this._statusId = Mainloop.timeout_add_seconds(1, Lang.bind(this, function() {
                this._getPlayBackStatus();
                this._statusId = 0;
                return false;
              }));
            }
            else if (this.state.status != status) {
              newState.status = status;
              newState.emitSignal = true;
            }
          }

          if (props.Metadata) {
            this.parseMetadata(props.Metadata.deep_unpack(), newState);
            if (newState.trackUrl !== this.state.trackUrl || newState.trackObj !== this.state.trackObj) {
              this._refreshProperties(newState);
            }
            else {
              this.emit('player-update', newState);
              if (newState.getPlaylists) {
                let _orderings = newState.orderings || this.state.orderings;
                this._getPlaylists(_orderings);
              }
            }
          }
          else if (newState.emitSignal) {
            this.emit('player-update', newState);
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
              this._getPosition();
            }
          }
        }));

        this.populate();
    },

    populate: function() {
      // The Tracks prop value is never updated so it's value is only good
      // for right after the player is created after that we rely on
      // the TrackListReplaced, TrackAdded, and TrackRemoved signals
      // to keep our trackIds current as per spec.
      this._trackIds = this._checkTrackIds(this._mediaServerTracklist.Tracks);

      let newState = new PlayerState({
        canGoNext: this.canGoNext,
        canGoPrevious: this.canGoPrevious,
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
        showLoopStatus: this._settings.get_boolean(Settings.MEDIAPLAYER_LOOP_STATUS_KEY) && this.shouldShowLoopStatus,
        showStopButton: this._settings.get_boolean(Settings.MEDIAPLAYER_STOP_BUTTON_KEY),
        showVolume: this._settings.get_boolean(Settings.MEDIAPLAYER_VOLUME_KEY),
        showPosition: this._settings.get_boolean(Settings.MEDIAPLAYER_POSITION_KEY),
        showRating: this._settings.get_boolean(Settings.MEDIAPLAYER_RATING_KEY),
        showPlaylist: this._settings.get_boolean(Settings.MEDIAPLAYER_PLAYLISTS_KEY),
        showPlaylistTitle: this._settings.get_boolean(Settings.MEDIAPLAYER_PLAYLIST_TITLE_KEY),
        showTracklist: this._settings.get_boolean(Settings.MEDIAPLAYER_TRACKLIST_KEY),
        showTracklistRating: this._settings.get_boolean(Settings.MEDIAPLAYER_TRACKLIST_RATING_KEY)
      });

      [newState.playlistObj, newState.playlistTitle] = this.activePlaylist;

      if (Settings.MINOR_VERSION > 19) {
        newState.hideStockMpris = this._settings.get_boolean(Settings.MEDIAPLAYER_HIDE_STOCK_MPRIS_KEY);
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

      this._getPlayerInfo();

      this.emit('player-update-info', this.info);

      this.emit('player-update', newState);
    },

    _checkTrackIds: function(trackIds) {
      if (!trackIds || !Array.isArray(trackIds)) {
        trackIds = [];
      }
      return trackIds;
    },

    _checkOrderings: function(orderings) {
      if (!orderings || !Array.isArray(orderings) || orderings.length < 1) {
        orderings = ['Alphabetical'];
      }
      return orderings;
    },

    set trackTime(value) {
      this._trackTime = value;
      this.emit('player-update', new PlayerState({trackTime: this._trackTime}));
    },

    get trackTime() {
      return this._trackTime;
    },

    get canGoNext() {
      let canGoNext = this._mediaServerPlayer.CanGoNext;
      if (canGoNext === null) {
        canGoNext = true;
      }
      return canGoNext;
    },

    get canGoPrevious() {
      let canGoPrevious = this._mediaServerPlayer.CanGoPrevious;
      if (canGoPrevious === null) {
        canGoPrevious = true;
      }
      return canGoPrevious;
    },

    get canSeek() {
      return this._mediaServerPlayer.CanSeek || false;
    },

    get hasTrackList() {
      return this._mediaServer.HasTrackList || false;
    },

    get volume() {
      let volume = this._mediaServerPlayer.Volume;
      if (volume === null) {
        volume = 0.0;
      }
      else if (this.hasWrongVolumeScaling) {
        volume = Math.pow(volume, 1 / 3);
      }
      return volume;
    },

    set volume(volume) {
      if (this.hasWrongVolumeScaling) {
        volume = Math.pow(volume, 3);
      }
      this._mediaServerPlayer.Volume = volume;
    },

    get shuffle() {
      return this._mediaServerPlayer.Shuffle || false;
    },

    set shuffle(shuffle) {
      if (this._mediaServerPlayer.Shuffle !== null) {
        this._mediaServerPlayer.Shuffle = shuffle;
      }
    },

    get loopStatus() {
      return this._mediaServerPlayer.LoopStatus || 'None';
    },

    set loopStatus(loopStatus) {
      if (this._mediaServerPlayer.LoopStatus !== null) {
        this._mediaServerPlayer.LoopStatus = loopStatus;
      }
    },

    get shouldShowLoopStatus() {
      return this._mediaServerPlayer.LoopStatus !== null && this._mediaServerPlayer.Shuffle !== null;
    },

    get playbackStatus() {
      return this._mediaServerPlayer.PlaybackStatus || Settings.Status.STOP;
    },

    get identity() {
      return this._mediaServer.Identity || '';
    },

    get desktopEntry() {
      return this._mediaServer.DesktopEntry || ''
    },

    get activePlaylist() {
      let activePlaylist = this._mediaServerPlaylists.ActivePlaylist;
      if (activePlaylist === null || !activePlaylist || !activePlaylist[1]) {
        activePlaylist = [null, null]
      }
      else {
        activePlaylist = activePlaylist[1];
      }      
      return activePlaylist;
    },

    get playlistCount() {
      return this._mediaServerPlaylists.PlaylistCount || 0;
    },

    get orderings() {
      return this._checkOrderings(this._mediaServerPlaylists.Orderings);
    },

    next: function() {
      this._mediaServerPlayer.NextRemote();
    },

    previous: function() {
      this._mediaServerPlayer.PreviousRemote();
    },

    playPause: function() {
      this._mediaServerPlayer.PlayPauseRemote();
    },

    stop: function() {
      this._mediaServerPlayer.StopRemote();
    },

    seek: function(value) {
      let time = value * this.state.trackLength;
      this._wantedSeekValue = Math.round(time * 1000000);
      this._mediaServerPlayer.SetPositionRemote(this.state.trackObj, this._wantedSeekValue);
    },

    playPlaylist: function(playlistObj) {
      this._mediaServerPlaylists.ActivatePlaylistRemote(playlistObj);
      this._getActivePlaylist();
    },

    playTrack: function(track) {
      // GNOME Music crashes if you call the GoTo method.
      //https://bugzilla.gnome.org/show_bug.cgi?id=779052
      if (this.busName !== 'org.mpris.MediaPlayer2.GnomeMusic') {
        this._mediaServerTracklist.GoToRemote(track);
      }
    },

    raise: function() {
      if (this.info.app)
        this.info.app.activate_full(-1, 0);
      else if (this.info.canRaise)
        this._mediaServer.RaiseRemote();
    },

    _getPlayerInfo: function() {
        if (this._mediaServer.Identity) {
          this.info.identity = this.identity;
        }
        if (this._mediaServer.DesktopEntry) {
          this.info.desktopEntry = this.desktopEntry;
          let appSys = Shell.AppSystem.get_default();
          this.info.app = appSys.lookup_app(this.info.desktopEntry + ".desktop");
          this.info.appInfo = Gio.DesktopAppInfo.new(this.info.desktopEntry + ".desktop");
        }
    },

    _refreshProperties: function(newState) {
      // Check properties
      // Many players have a habit of changing properties without emitting
      // a PropertiesChanged signal as they should. This is basically CYA.
      // In a perfect world this would be redundant and unnecessary.
      this._prop.GetRemote('org.mpris.MediaPlayer2', 'HasTrackList',
        Lang.bind(this, function([hasTrackList], err) {
          if (!err && newState.hasTrackList === null) {
            hasTrackList = hasTrackList.unpack();
            if (this.state.hasTrackList != hasTrackList) {
              newState.hasTrackList = hasTrackList;
            }
          }
          this._prop.GetAllRemote('org.mpris.MediaPlayer2.Player',
            Lang.bind(this, function([props], err) {
              if (!err) {                             
                if (newState.canGoNext === null && props.CanGoNext) {
                let canGoNext = props.CanGoNext.unpack();
                  if (this.state.canGoNext !== canGoNext) {
                    newState.canGoNext = canGoNext;
                  }
                }
                if (newState.canGoPrevious === null && props.CanGoPrevious) {
                  let canGoPrevious = props.CanGoPrevious.unpack();
                    if (this.state.canGoPrevious !== canGoPrevious) {
                      newState.canGoPrevious = canGoPrevious;
                    }
                }
                if (newState.canSeek === null && props.CanSeek) {
                  let canSeek = props.CanSeek.unpack();
                  if (this.state.canSeek !== canSeek) {
                    newState.canSeek = canSeek;
                  }
                }
                if (newState.shuffle === null && props.Shuffle) {
                  let shuffle = props.Shuffle.unpack();
                  if (this.state.shuffle !== shuffle) {
                    newState.shuffle = shuffle;
                  }
                }
                if (newState.loopStatus === null && props.LoopStatus) {
                  let loopStatus = props.LoopStatus.unpack();
                  if (this.state.loopStatus !== loopStatus) {
                    newState.loopStatus = loopStatus;
                  }
                }
                if (newState.status === null && props.PlaybackStatus) {
                  let status = props.PlaybackStatus.unpack();
                  if (this.sendsStopOnSongChange && status == Settings.Status.STOP) {
                  // Some players send a "PlaybackStatus: Stopped" signal when changing
                  // tracks, so wait a little before refreshing if they send a "Stopped" signal.
                    if (this._statusId !== 0) {
                      Mainloop.source_remove(this._statusId);
                      this._statusId = 0;
                    }
                    this._statusId = Mainloop.timeout_add_seconds(1, Lang.bind(this, function() {
                      this._getPlayBackStatus();
                      this._statusId = 0;
                      return false;
                    }));
                  }
                  else if (this.state.status != status) {
                    newState.status = status;
                  }
                }
                if (props.Volume) {
                  let volume = props.Volume.unpack();
                  if (this.hasWrongVolumeScaling) {
                    volume = Math.pow(volume, 1 / 3);
                  }
                  if (this.state.volume !== volume) {
                    newState.volume = volume;
                  }
                  if (this.state.showVolume == false && this._settings.get_boolean(Settings.MEDIAPLAYER_VOLUME_KEY)) {
                    // Reenable showVolume after error
                    newState.showVolume = true;
                  }
                }
                else if (this.state.showVolume) {
                  newState.showVolume = false;
                }
                if (props.Position) {
                  let position = Math.round(props.Position.unpack() / 1000000);
                  if (this.trackTime !== position) {
                    this._trackTime = position;
                    newState.trackTime = position;
                  }
                  if (this.state.showPosition == false && this._settings.get_boolean(Settings.MEDIAPLAYER_POSITION_KEY)) {
                    // Reenable showPosition after error
                    newState.showPosition = true;
                  }
                }
                else if (this.state.showPosition) {
                  newState.showPosition = false;
                }
              }
              this.emit('player-update', newState);
          }));
      }));
    },

    _getActivePlaylist: function() {
      this._prop.GetRemote('org.mpris.MediaPlayer2.Playlists', 'ActivePlaylist',
                           Lang.bind(this, function([value], err) {
                             if (!err) {
                               let [playlistObj, playlistTitle] = value.deep_unpack()[1];

                               if (this.state.playlistObj != playlistObj) {
                                 this.emit('player-update', 
                                           new PlayerState({playlistObj: playlistObj}));
                               }
                               if (this.state.playlistTitle != playlistTitle) {
                                 this.emit('player-update', 
                                           new PlayerState({playlistTitle: playlistTitle}));
                               }
                             }
                           })
                          );
    
    },

    _getPlayBackStatus: function() {
      this._prop.GetRemote('org.mpris.MediaPlayer2.Player', 'PlaybackStatus',
                           Lang.bind(this, function([value], err) {
                             if (!err) {
                               let status = value.unpack();
                               if (this.state.status != status) {
                                 this.emit('player-update', 
                                           new PlayerState({status: status}));
                               }
                             }
                           })
                          );
    
    },

    _getPlaylists: function(orderings) {
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
          if (this.state.showPlaylist == false &&
              this._settings.get_boolean(Settings.MEDIAPLAYER_PLAYLISTS_KEY)) {
            //Reenable showPlaylist after error
            this.emit('player-update', new PlayerState({showPlaylist: true}));
          }
          this.emit('player-update', new PlayerState({playlists: playlists}));
        } 
        else {
          this.emit('player-update', new PlayerState({showPlaylist: false}));
        }
      }));
    },

    _getTracklist: function() {
      // A player may have trigger the fetching of a tracklist
      // before our initial startup timeout happens.
      if (this._tracklistTimeOutId !== 0) {
        Mainloop.source_remove(this._tracklistTimeOutId);
        this._tracklistTimeOutId = 0;
      }
      if (this._trackIds.length === 0) {
        this.emit('player-update', new PlayerState({showTracklist: false}));
      }
      else {
        this._mediaServerTracklist.GetTracksMetadataRemote(this._trackIds, Lang.bind(this, function([trackListMetaData]) {
          if (trackListMetaData && Array.isArray(trackListMetaData)) {
            if (this.state.showTracklist == false && this._settings.get_boolean(Settings.MEDIAPLAYER_TRACKLIST_KEY)) {
              //Reenable showTracklist after error
              this.emit('player-update', new PlayerState({showTracklist: true}));
            }
            this.emit('player-update', new PlayerState({trackListMetaData: trackListMetaData}));
          }
          else {
            this.emit('player-update', new PlayerState({showTracklist: false}));
          }
        }));
      }
    },

    _getPosition: function(showPosition) {
      this._prop.GetRemote('org.mpris.MediaPlayer2.Player', 'Position', Lang.bind(this, function([value], err) {
        if (err && this.state.showPosition) {
          this.emit('player-update', new PlayerState({showPosition: false}));
        }
        else if (value) {
          let newState = new PlayerState();
          showPosition = showPosition || this._settings.get_boolean(Settings.MEDIAPLAYER_POSITION_KEY);
          if (this.state.showPosition == false && showPosition) {
            // Reenable showPosition after error
            newState.showPosition = true;
            newState.emitSignal = true;
          }
          let position = Math.round(value.unpack() / 1000000);
          if (this.trackTime !== position) {
            this._trackTime = position;
            newState.trackTime = position;
            newState.emitSignal = true;
          }
          if (newState.emitSignal) {
            this.emit('player-update', newState);
          }
        }
      }));
    },

    _onStatusChange: function() {
      // sync track time
      this._getPosition();
      let status = this.state.status;
      if (status == Settings.Status.PLAY) {
        this._startTimer();
      }
      else if (status == Settings.Status.PAUSE) {
        this._stopTimer();
      }
      else if (status == Settings.Status.STOP) {
        this._stopTimer();
        this.trackTime = 0;
      }
    },

    _startTimer: function() {
      if (this._timerId === 0) {
        this._timerId = Mainloop.timeout_add_seconds(1, Lang.bind(this, function() {
          return this.trackTime += 1;
        }));
      }
    },

    _stopTimer: function() {
      if (this._timerId !== 0) {
        Mainloop.source_remove(this._timerId);
        this._timerId = 0;
      }
    },

    destroy: function() {
        // Cancel all pending timeouts.
        this._stopTimer();
        if (this._statusId !== 0) {
          Mainloop.source_remove(this._statusId);
          this._statusId = 0;
        }
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

        for (let id in this._signalsId)
            this._settings.disconnect(this._signalsId[id]);
    },

    toString: function() {
        return "<object MPRISPlayer(%s)>".format(this.info.identity);
    }
});
Signals.addSignalMethods(MPRISPlayer.prototype);
