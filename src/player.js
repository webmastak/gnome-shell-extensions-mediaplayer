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

  playlist: null,
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
  isRadio: null,

  showPlaylist: null,
  showTracklist: null,
  showRating: null,
  showVolume: null,
  showPosition: null,
  largeCoverSize: null,
  smallCoverSize: null,
  hideStockMpris: null,

  showTracklistRating: null,
  updatedMetadata: null,
  updatedPlaylist: null,
  hasTrackList: null,
  canSeek: null,
  canGoNext: null,
  canGoPrevious: null,
  canPause: null,

  volume: null,
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
        this._signalsId = [];
        this._tracklistSignalsId = [];

        this.parent(this._identity, true);

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
        // Wait all DBus callbacks to continue
        if (!this._mediaServer || !this._mediaServerPlayer || !this._mediaServerPlaylists || !this._mediaServerTracklist || !this._prop)
            return;

        this.info.canRaise = this._mediaServer.CanRaise;

        if (Settings.MINOR_VERSION > 19) {
        // Versions before 3.20 don't have Mpris built-in.
        // hideStockMpris setting
          this._signalsId.push(
            this._settings.connect("changed::" + Settings.MEDIAPLAYER_HIDE_STOCK_MPRIS_KEY, Lang.bind(this, function() {
              this.emit('player-update', new PlayerState({hideStockMpris: this._settings.get_boolean(Settings.MEDIAPLAYER_HIDE_STOCK_MPRIS_KEY)}));
            }))
          );
        }
        // largeCoverSize setting
        this._signalsId.push(
          this._settings.connect("changed::" + Settings.MEDIAPLAYER_LARGE_COVER_SIZE_KEY, Lang.bind(this, function() {
            this.emit('player-update', new PlayerState({largeCoverSize: this._settings.get_int(Settings.MEDIAPLAYER_LARGE_COVER_SIZE_KEY)}));
          }))
        );
        // smallCoverSize setting
        this._signalsId.push(
          this._settings.connect("changed::" + Settings.MEDIAPLAYER_SMALL_COVER_SIZE_KEY, Lang.bind(this, function() {
            this.emit('player-update', new PlayerState({smallCoverSize: this._settings.get_int(Settings.MEDIAPLAYER_SMALL_COVER_SIZE_KEY)}));
          }))
        );
        // showVolume setting
        this._signalsId.push(
          this._settings.connect("changed::" + Settings.MEDIAPLAYER_VOLUME_KEY, Lang.bind(this, function() {
            this.emit('player-update', new PlayerState({showVolume: this._settings.get_boolean(Settings.MEDIAPLAYER_VOLUME_KEY)}));
          }))
        );
        // showPosition setting
        this._signalsId.push(
          this._settings.connect("changed::" + Settings.MEDIAPLAYER_POSITION_KEY, Lang.bind(this, function() {
            this.emit('player-update', new PlayerState({showPosition: this._settings.get_boolean(Settings.MEDIAPLAYER_POSITION_KEY)}));
          }))
        );
        // showRating setting
        this._signalsId.push(
          this._settings.connect("changed::" + Settings.MEDIAPLAYER_RATING_KEY, Lang.bind(this, function() {
            this.emit('player-update', new PlayerState({showRating: this._settings.get_boolean(Settings.MEDIAPLAYER_RATING_KEY)}));
          }))
        );
        // showTracklistRating setting
        this._signalsId.push(
          this._settings.connect("changed::" + Settings.MEDIAPLAYER_TRACKLIST_RATING_KEY, Lang.bind(this, function() {
            this.emit('player-update', new PlayerState({showTracklistRating: this._settings.get_boolean(Settings.MEDIAPLAYER_TRACKLIST_RATING_KEY)}));
          }))
        );
        // showPlaylists setting
        this._signalsId.push(
          this._settings.connect("changed::" + Settings.MEDIAPLAYER_PLAYLISTS_KEY, Lang.bind(this, function() {
            this.emit('player-update', new PlayerState({showPlaylist: this._settings.get_boolean(Settings.MEDIAPLAYER_PLAYLISTS_KEY)}));
          }))
        );
        // showTracklist setting
          this._signalsId.push(
            this._settings.connect("changed::" + Settings.MEDIAPLAYER_TRACKLIST_KEY, Lang.bind(this, function() {
              if (this._settings.get_boolean(Settings.MEDIAPLAYER_TRACKLIST_KEY) && this.state.hasTrackList) {
                this._getTracklist();
              }
              this.emit('player-update', new PlayerState({showTracklist: this._settings.get_boolean(Settings.MEDIAPLAYER_TRACKLIST_KEY)}));
            }))
          );

        this._tracklistSignalsId.push(
          this._mediaServerTracklist.connectSignal('TrackListReplaced', Lang.bind(this, function(proxy, sender, [iface, props]) {
            this._getTracklist();
          }))
        );

        this._tracklistSignalsId.push(
          this._mediaServerTracklist.connectSignal('TrackAdded', Lang.bind(this, function(proxy, sender, [iface, props]) {
            this._getTracklist();
          }))
        );

        this._tracklistSignalsId.push(
          this._mediaServerTracklist.connectSignal('TrackRemoved', Lang.bind(this, function(proxy, sender, [iface, props]) {
             this._getTracklist();
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
            if (this.state.volume !== volume) {
              newState.volume = volume;
            }
          }

          if (props.CanPause) {
            let canPause = props.CanPause.unpack();
            if (this.state.canPause !== canPause) {
              newState.canPause = canPause;
            }
          }

          if (props.CanGoNext) {
            let canGoNext = props.CanGoNext.unpack();
            if (this.state.canGoNext !== canGoNext) {
              newState.canGoNext = canGoNext;
            }
          }

          if (props.CanGoPrevious) {
            let canGoPrevious = props.CanGoPrevious.unpack();
            if (this.state.canGoPrevious !== canGoPrevious) {
              newState.canGoPrevious = canGoPrevious;
            }
          }

          if (props.HasTrackList) {
            let hasTrackList = props.HasTrackList.unpack();
            if (this.state.hasTrackList !== hasTrackList) {
              newState.hasTrackList = hasTrackList;
            }
          }

          if (props.CanSeek) {
            let canSeek = props.CanSeek.unpack();
            if (this.state.canSeek !== canSeek) {
              newState.canSeek = canSeek;
              this._getPosition();
            }
          }

          if (props.PlaylistCount) {
            this._getPlaylists();
          }

          if (props.ActivePlaylist) {
            let playlist = props.ActivePlaylist.deep_unpack()[1][0];
            if (this.state.playlist !== playlist) {
              newState.playlist = playlist;
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
            let status = props.PlaybackStatus.unpack();
            if (Settings.SEND_STOP_ON_CHANGE.indexOf(this.busName) != -1 && status == Settings.Status.STOP) {
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
            else {
              newState.status = status;
            }
          }

          if (props.Metadata) {
            this.parseMetadata(props.Metadata.deep_unpack(), newState);
            if (newState.trackUrl !== this.state.trackUrl || newState.trackObj !== this.state.trackObj) {
              this._getPosition();
              this._refreshProperties();
            }
          }

          this.emit('player-update', newState);
        }));

        this._seekedId = this._mediaServerPlayer.connectSignal('Seeked', Lang.bind(this, function(proxy, sender, [value]) {
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

    populate: function() {
      let newState = new PlayerState({
        canPause: this._mediaServerPlayer.CanPause ? this._mediaServerPlayer.CanPause === (true || false): true,
        canGoNext: this._mediaServerPlayer.CanGoNext ? this._mediaServerPlayer.CanGoNext === (true || false): true,
        canGoPrevious: this._mediaServerPlayer.CanGoPrevious ? this._mediaServerPlayer.CanGoPrevious === (true || false): true,
        canSeek: this._mediaServerPlayer.CanSeek || false,
        hasTrackList: this._mediaServer.HasTrackList || false,
        showVolume: this._settings.get_boolean(Settings.MEDIAPLAYER_VOLUME_KEY),
        showPosition: this._settings.get_boolean(Settings.MEDIAPLAYER_POSITION_KEY),
        showRating: this._settings.get_boolean(Settings.MEDIAPLAYER_RATING_KEY),
        showPlaylist: this._settings.get_boolean(Settings.MEDIAPLAYER_PLAYLISTS_KEY),
        showTracklist: this._settings.get_boolean(Settings.MEDIAPLAYER_TRACKLIST_KEY),
        showTracklistRating: this._settings.get_boolean(Settings.MEDIAPLAYER_TRACKLIST_RATING_KEY),
        largeCoverSize: this._settings.get_int(Settings.MEDIAPLAYER_LARGE_COVER_SIZE_KEY),
        volume: this._mediaServerPlayer.Volume || 0.0,
        status: this._mediaServerPlayer.PlaybackStatus || Settings.Status.STOP,
        orderings: this._checkOrderings(this._mediaServerPlaylists.Orderings),
        playerName: this._mediaServer.Identity || '',
        desktopEntry: this._mediaServer.DesktopEntry || ''
      });
      if (this._mediaServerPlaylists.ActivePlaylist) {
        newState.playlist = this._mediaServerPlaylists.ActivePlaylist[1][0];
      }

      this.parseMetadata(this._mediaServerPlayer.Metadata, newState);

      if (Settings.MINOR_VERSION > 19) {
        newState.hideStockMpris = this._settings.get_boolean(Settings.MEDIAPLAYER_HIDE_STOCK_MPRIS_KEY);
      }

      this.emit('player-update', newState);
      
      //Delay calls 1 sec because some players make the interface available without data available in the beginning
      this._playlistTimeOutId = Mainloop.timeout_add_seconds(1, Lang.bind(this, function() {
        this._playlistTimeOutId = 0;
        this._getPlaylists();
        return false;
      }));

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

    next: function() {
      this._mediaServerPlayer.NextRemote();
    },

    previous: function() {
      this._mediaServerPlayer.PreviousRemote();
    },

    playPause: function() {
      this._mediaServerPlayer.PlayPauseRemote();
    },

    play: function() {
      this._mediaServerPlayer.PlayRemote();
    },

    stop: function() {
      this._mediaServerPlayer.StopRemote();
    },

    seek: function(value) {
      let time = value * this.state.trackLength;
      this._wantedSeekValue = Math.round(time * 1000000);
      this._mediaServerPlayer.SetPositionRemote(this.state.trackObj, this._wantedSeekValue);
    },

    setVolume: function(volume) {
      this._mediaServerPlayer.Volume = volume;
    },

    playPlaylist: function(playlist) {
      this._mediaServerPlaylists.ActivatePlaylistRemote(playlist);
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
          this.info.identity = this._mediaServer.Identity || '';
        }
        if (this._mediaServer.DesktopEntry) {
          this.info.desktopEntry = this._mediaServer.DesktopEntry || '';
          let appSys = Shell.AppSystem.get_default();
          this.info.app = appSys.lookup_app(this.info.desktopEntry + ".desktop");
          this.info.appInfo = Gio.DesktopAppInfo.new(this.info.desktopEntry + ".desktop");
        }
    },

    _refreshProperties: function() {
      // check Can* properties
      this._prop.GetRemote('org.mpris.MediaPlayer2.Player', 'CanSeek',
                           Lang.bind(this, function(value, err) {
                             let state = new PlayerState();
                             let canSeek = false;
                             if (!err)
                               canSeek = value[0].unpack();

                             if (this.state.canSeek != canSeek) {
                               state.canSeek = canSeek;
                               this.emit('player-update', state);
                             }
                           })
                          );
      this._prop.GetRemote('org.mpris.MediaPlayer2.Player', 'CanPause',
                           Lang.bind(this, function(value, err) {
                             let state = new PlayerState();
                             // assume the player can pause by default
                             let canPause = true;
                             if (!err)
                               canPause = value[0].unpack();

                             if (this.state.canPause != canPause) {
                               state.canPause = canPause;
                               this.emit('player-update', state);
                             }
                           })
                          );
      this._prop.GetRemote('org.mpris.MediaPlayer2.Player', 'CanGoNext',
                           Lang.bind(this, function(value, err) {
                             let state = new PlayerState();
                             // assume the player can go next by default
                             let canGoNext = true;
                             if (!err)
                               canGoNext = value[0].unpack();

                             if (this.state.canGoNext != canGoNext) {
                               state.canGoNext = canGoNext;
                               this.emit('player-update', state);
                             }
                           })
                          );
      this._prop.GetRemote('org.mpris.MediaPlayer2.Player', 'CanGoPrevious',
                           Lang.bind(this, function(value, err) {
                             let state = new PlayerState();
                             // assume the player can go previous by default
                             let canGoPrevious = true;
                             if (!err)
                               canGoPrevious = value[0].unpack();

                             if (this.state.canGoPrevious != canGoPrevious) {
                               state.canGoPrevious = canGoPrevious;
                               this.emit('player-update', state);
                             }
                           })
                          );
      this._prop.GetRemote('org.mpris.MediaPlayer2', 'HasTrackList',
                           Lang.bind(this, function(value, err) {
                             let state = new PlayerState();
                             let hasTrackList = false;
                             if (!err)
                               hasTrackList = value[0].unpack();
                             if (this.state.hasTrackList != hasTrackList) {
                               state.hasTrackList = hasTrackList;
                               this.emit('player-update', state);
                             }
                           })
                          );
      this._prop.GetRemote('org.mpris.MediaPlayer2.Playlists', 'Orderings',
                           Lang.bind(this, function(value, err) {
                             let state = new PlayerState();
                             // default to ["Alphabetical"] if all else fails
                             let orderings = ["Alphabetical"];
                             if (!err)
                               orderings = this._checkOrderings(value[0].deep_unpack());

                             if (this.state.orderings != orderings) {
                               state.orderings = orderings;
                               this.emit('player-update', state);
                             }
                           })
                          );
    },

    _getActivePlaylist: function() {
      this._prop.GetRemote('org.mpris.MediaPlayer2.Playlists', 'ActivePlaylist',
                           Lang.bind(this, function(value, err) {
                             if (!err) {
                               let playlist = value[0].deep_unpack()[1][0];
                               if (this.state.playlist != playlist) {
                                 this.emit('player-update', 
                                           new PlayerState({playlist: playlist}));
                               }
                             }
                           })
                          );
    
    },

    _getPlayBackStatus: function() {
      this._prop.GetRemote('org.mpris.MediaPlayer2.Player', 'PlaybackStatus',
                           Lang.bind(this, function(value, err) {
                             if (!err) {
                               let status = value[0].unpack();
                               if (this.state.status != status) {
                                 this.emit('player-update', 
                                           new PlayerState({status: status}));
                               }
                             }
                           })
                          );
    
    },

    _checkOrderings: function(maybeOrderings) {
      let orderings = ['Alphabetical'];
      if (Array.isArray(maybeOrderings) && maybeOrderings.length > 0)
        orderings = maybeOrderings;
      return orderings;
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
      this._mediaServerPlaylists.GetPlaylistsRemote(0, 100, ordering, false, Lang.bind(this, function(playlists) {
        if (playlists && playlists[0]) {
          if (this.state.showPlaylist == false &&
              this._settings.get_boolean(Settings.MEDIAPLAYER_PLAYLISTS_KEY)) {
            //Reenable showPlaylist after error
            this.emit('player-update', new PlayerState({showPlaylist: true}));
          }
          this.emit('player-update', new PlayerState({playlists: playlists[0]}));
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
      this._prop.GetRemote('org.mpris.MediaPlayer2.TrackList', 'Tracks', Lang.bind(this, function(value, err) {
        if (err) {
          this.emit('player-update', new PlayerState({showTracklist: false}));
        }
        else {
          let trackIds = value[0].deep_unpack();
          if (trackIds.length == 0) {
            this.emit('player-update', new PlayerState({showTracklist: false}));
          }
          else {
            this._mediaServerTracklist.GetTracksMetadataRemote(trackIds, Lang.bind(this, function(trackListMetaData) {
              if (trackListMetaData && trackListMetaData[0]) {
                if (this.state.showTracklist == false &&
                  this._settings.get_boolean(Settings.MEDIAPLAYER_TRACKLIST_KEY)) {
                  //Reenable showTracklist after error
                  this.emit('player-update', new PlayerState({showTracklist: true}));
                }
                this.emit('player-update', new PlayerState({trackListMetaData: trackListMetaData[0]}));
              }
              else {
                this.emit('player-update', new PlayerState({showTracklist: false}));
              }
            }));
          }
        }
      }));
    },

    _getPosition: function() {
      this._prop.GetRemote('org.mpris.MediaPlayer2.Player', 'Position', Lang.bind(this, function(value, err) {
        if (err) {
          this.emit('player-update', new PlayerState({showPosition: false}));
        }
        else {
          if (this.state.showPosition == false &&
              this._settings.get_boolean(Settings.MEDIAPLAYER_POSITION_KEY)) {
            // Reenable showPosition after error
            this.emit('player-update', new PlayerState({showPosition: true}));
          }
          let position = value[0].unpack() / 1000000;
          this.trackTime = position;
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
