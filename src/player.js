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
const Lib = Me.imports.lib;


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

  showTracklistRating: null,
  updatedMetadata: null,
  updatedPlaylist: null,
  hasTrackList: null,
  canSeek: null,
  canGoNext: null,
  canGoPrevious: null,

  volume: null,
  pithosRating: null,
  showPlaylistTitle: null,
  playlistTitle: null,
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
        this.parseMetadata = Lib.parseMetadata;
        this._isTypeOf = Lib.isTypeOf;
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
            this.emit('player-update', new PlayerState({showVolume: settings.get_boolean(key)}));
          }))
        );
        // showPosition setting
        this._signalsId.push(
          this._settings.connect("changed::" + Settings.MEDIAPLAYER_POSITION_KEY, Lang.bind(this, function(settings, key) {
            this.emit('player-update', new PlayerState({showPosition: settings.get_boolean(key)}));
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
        // showPlaylists setting
        this._signalsId.push(
          this._settings.connect("changed::" + Settings.MEDIAPLAYER_PLAYLISTS_KEY, Lang.bind(this, function(settings, key) {
            this.emit('player-update', new PlayerState({showPlaylist: settings.get_boolean(key)}));
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
            let volume = this._checkVolume(props.Volume.unpack());
            if (this.state.volume !== volume) {
              newState.volume = volume;
            }
          }

          if (props.CanGoNext) {
            let canGoNext = this._checkBoolProp(props.CanGoNext.unpack(), true);
            if (this.state.canGoNext !== canGoNext) {
              newState.canGoNext = canGoNext;
            }
          }

          if (props.CanGoPrevious) {
            let canGoPrevious = this._checkBoolProp(props.CanGoPrevious.unpack(), true);
            if (this.state.canGoPrevious !== canGoPrevious) {
              newState.canGoPrevious = canGoPrevious;
            }
          }

          if (props.HasTrackList) {
            let hasTrackList = this._checkBoolProp(props.HasTrackList.unpack(), false);
            if (this.state.hasTrackList !== hasTrackList) {
              newState.hasTrackList = hasTrackList;
            }
          }

          if (props.CanSeek) {
            let canSeek = this._checkBoolProp(props.CanSeek.unpack(), false);
            if (this.state.canSeek !== canSeek) {
              newState.canSeek = canSeek;
            }
          }

          if (props.PlaylistCount) {
            this._getPlaylists();
          }

          if (props.ActivePlaylist) {
            let [playlistObj, playlistTitle] = this._checkActivePlaylist(props.ActivePlaylist.deep_unpack());
            
            if (this.state.playlistObj !== playlistObj) {
              newState.playlistObj = playlistObj;
            }
            if (this.state.playlistTitle !== playlistTitle) {
              newState.playlistTitle = playlistTitle;
            }
          }

          if (props.Orderings) {
            let orderings = this._checkOrderings(props.Orderings.deep_unpack());
            if (this.state.orderings != orderings) {
              newState.orderings = orderings;
              this.emit('player-update', newState);
              this._getPlaylists();
            }
          }

          if (props.PlaybackStatus) {
            let status = this._checkPlaybackStatus(props.PlaybackStatus.unpack());
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

          if (props.Metadata) {
            this.parseMetadata(props.Metadata.deep_unpack(), newState);
            if (newState.trackUrl !== this.state.trackUrl || newState.trackObj !== this.state.trackObj) {
              this._refreshProperties(newState);
            }
            else {
              this.emit('player-update', newState);
            }
          }
          else {
            this.emit('player-update', newState);
          }
        }));

        this._seekedId = this._mediaServerPlayer.connectSignal('Seeked', Lang.bind(this, function(proxy, sender, [value]) {
          value = this._isTypeOf(value, Number) ? value : 0;
          if (value > 0) {
            this.trackTime = value / 1000000;
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
      let newState = new PlayerState({
        canGoNext: this.canGoNext,
        canGoPrevious: this.canGoPrevious,
        canSeek: this.canSeek,
        hasTrackList: this.hasTrackList,
        volume: this.volume,
        status: this.playbackStatus,
        playerName: this.identity,
        desktopEntry: this.desktopEntry,
        orderings: this.orderings,
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

      this.emit('player-update', newState);

      
      //Delay calls 1 sec because some players make the interface available without data available in the beginning
      this._playlistTimeOutId = Mainloop.timeout_add_seconds(1, Lang.bind(this, function() {
        this._playlistTimeOutId = 0;
        this._getPlaylists();
        return false;
      }));

      // The Tracks prop value is never updated so it's value is only good
      // for right after the player is created after that we rely on
      // the TrackListReplaced, TrackAdded, and TrackRemoved signals
      // to keep our trackIds current as per spec.
      this._trackIds = this._checkTrackIds(this._mediaServerTracklist.Tracks);

      if (newState.hasTrackList) {
        this._tracklistTimeOutId = Mainloop.timeout_add_seconds(1, Lang.bind(this, function() {
          this._tracklistTimeOutId = 0;
          this._getTracklist();
          return false;
        }));
      }

      this._getPlayerInfo();

      this.emit('player-update-info', this.info);
    },

    // Evil Type Checking...
    // We check to make sure things are what they are suppose to be.
    // And if they are not we return a default value.
    //
    // The MPRIS spec is poorly implemented more often than not.
    // Players can and do send all sorts of wackadoo types and values for things...
    //
    // TODO: Meaningful error/log messages when things aren't as expected.

    _checkActivePlaylist: function(activePlaylist) {
      if (activePlaylist && activePlaylist[1] && Array.isArray(activePlaylist[1])) {
        let [playlistObj, playlistTitle] = activePlaylist[1];
        if (this._isTypeOf(playlistObj, String) && this._isTypeOf(playlistTitle, String)) {
          return [playlistObj, playlistTitle];
        }
      }
      return [null, null];
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

    _checkVolume: function(volume) {
      if (!this._isTypeOf(volume, Number)) {
        volume = 0.0;
      }
      if (this.hasWrongVolumeScaling) {
        volume = Math.pow(volume, 1 / 3);
      }
      return volume;
    },

    _checkPosition: function(position) {
      return this._isTypeOf(position, Number) ? position / 1000000 : 0;
    },

    _checkBoolProp: function(boolProp, defaultValue) {
      return this._isTypeOf(boolProp, Boolean) ? boolProp : defaultValue;
    },

    _checkPlaybackStatus: function(playbackStatus) {
      if (!playbackStatus || !this._isTypeOf(playbackStatus, String) || Settings.ValidPlaybackStatuses.indexOf(playbackStatus) == -1) {
        playbackStatus = Settings.Status.STOP;
      }
      return playbackStatus;
    },

    set trackTime(value) {
      this._trackTime = value;
      let newState = new PlayerState({
        trackTime: this._trackTime,
        trackLength: this.state.trackLength || 0
      });
      this.emit('player-update', newState);
    },

    get trackTime() {
      return this._trackTime;
    },

    get canGoNext() {
      try {
        let canGoNext = this._mediaServerPlayer.CanGoNext;
        return this._checkBoolProp(canGoNext, true);
      }
      catch(err) {
        return true;
      }
    },

    get canGoPrevious() {
      try {
        let canGoPrevious = this._mediaServerPlayer.CanGoPrevious;
        return this._checkBoolProp(canGoPrevious, true);
      }
      catch(err) {
        return true;
      }
    },

    get canSeek() {
      try {
        let canSeek = this._mediaServerPlayer.CanSeek;
        return this._checkBoolProp(canSeek, false);
      }
      catch(err) {
        return false;
      }
    },

    get hasTrackList() {
      try {
        let hasTrackList = this._mediaServer.HasTrackList;
        return this._checkBoolProp(hasTrackList, false);
      }
      catch(err) {
        return false;
      }
    },

    get volume() {
      try {
        let volume = this._mediaServerPlayer.Volume;
        return this._checkVolume(volume);
      }
      catch(err) {
        return 0.0;
      }
    },

    set volume(volume) {
      if (this.hasWrongVolumeScaling) {
        volume = Math.pow(volume, 3);
      }
      this._mediaServerPlayer.Volume = volume;
    },

    get playbackStatus() {
      try {
        let playbackStatus = this._mediaServerPlayer.PlaybackStatus;
        return this._checkPlaybackStatus(playbackStatus);
      }
      catch(err) {
        return Settings.Status.STOP;
      }
    },

    get orderings() {
      try {
        let orderings = this._mediaServerPlaylists.Orderings;
        return this._checkOrderings(orderings);
      }
      catch(err) {
        return ['Alphabetical'];
      }
    },

    get identity() {
      try {
        let identity = this._mediaServer.Identity;
        return this._isTypeOf(identity, String) ? identity : '';
      }
      catch(err) {
        return '';
      }
    },

    get desktopEntry() {
      try {
        let desktopEntry = this._mediaServer.DesktopEntry
        return this._isTypeOf(desktopEntry, String) ? desktopEntry : '';
      }
      catch(err) {
        return '';
      }
    },

    get activePlaylist() {
      try {
        let activePlaylist = this._mediaServerPlaylists.ActivePlaylist;
        return this._checkActivePlaylist(activePlaylist);
      }
      catch(err) {
        return [null, null];
      }
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
      this._prop.GetRemote('org.mpris.MediaPlayer2.Playlists', 'Orderings',
        Lang.bind(this, function([orderings], err) {
          if (!err && newState.orderings === null) {
            orderings = this._checkOrderings(orderings.deep_unpack());
            if (this.state.orderings != orderings) {
              newState.orderings = orderings;
            }
          }
          this._prop.GetRemote('org.mpris.MediaPlayer2', 'HasTrackList',
            Lang.bind(this, function([hasTrackList], err) {
              if (!err && newState.hasTrackList === null) {
                hasTrackList = this._checkBoolProp(hasTrackList.unpack(), false);
                if (this.state.hasTrackList != hasTrackList) {
                  newState.hasTrackList = hasTrackList;
                }
              }
              this._prop.GetAllRemote('org.mpris.MediaPlayer2.Player',
                Lang.bind(this, function([props], err) {
                  if (!err) {                             
                    if (newState.canGoNext === null && props.CanGoNext) {
                    let canGoNext = this._checkBoolProp(props.CanGoNext.unpack(), true);
                      if (this.state.canGoNext !== canGoNext) {
                        newState.canGoNext = canGoNext;
                      }
                    }
                    if (newState.canGoPrevious === null && props.CanGoPrevious) {
                      let canGoPrevious = this._checkBoolProp(props.CanGoPrevious.unpack(), true);
                        if (this.state.canGoPrevious !== canGoPrevious) {
                          newState.canGoPrevious = canGoPrevious;
                        }
                    }
                    if (newState.canSeek === null && props.CanSeek) {
                      let canSeek = this._checkBoolProp(props.CanSeek.unpack(), false);
                      if (this.state.canSeek !== canSeek) {
                        newState.canSeek = canSeek;
                      }
                    }
                    if (newState.volume === null && props.Volume) {
                      let volume = this._checkVolume(props.Volume.unpack());
                      if (this.state.volume !== volume) {
                        newState.volume = volume;
                      }
                    }
                    if (props.Position) {
                      let position = this._checkPosition(props.Position.unpack());
                      if (this.trackTime !== position) {
                        this._trackTime = position;
                          newState.trackTime = position;
                      }
                    }
                  }
                  this.emit('player-update', newState);
              }));
          }));
      }));
    },

    _getActivePlaylist: function() {
      this._prop.GetRemote('org.mpris.MediaPlayer2.Playlists', 'ActivePlaylist',
                           Lang.bind(this, function([value], err) {
                             if (!err) {
                               let [playlistObj, playlistTitle] = this._checkActivePlaylist(value.deep_unpack());

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
                               let status = this._checkPlaybackStatus(value.unpack());
                               if (this.state.status != status) {
                                 this.emit('player-update', 
                                           new PlayerState({status: status}));
                               }
                             }
                           })
                          );
    
    },

    _getPlaylists: function() {
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
      let orderings = this.state.orderings;
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

    _getPosition: function() {
      this._prop.GetRemote('org.mpris.MediaPlayer2.Player', 'Position', Lang.bind(this, function([value], err) {
        if (err) {
          this.emit('player-update', new PlayerState({showPosition: false}));
        }
        else {
          if (this.state.showPosition == false &&
              this._settings.get_boolean(Settings.MEDIAPLAYER_POSITION_KEY)) {
            // Reenable showPosition after error
            this.emit('player-update', new PlayerState({showPosition: true}));
          }
          let position = this._checkPosition(value.unpack());
          if (this.trackTime !== position) {
            this.trackTime = position;
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
