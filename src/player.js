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

  status: null,

  playlist: null,
  playlists: null,

  trackTime: null,
  trackTitle: null,
  trackNumber: null,
  trackAlbum: null,
  trackArtist: null,
  trackUrl: null,
  trackCoverUrl: null,
  trackCoverPath: null,
  trackLength: null,
  trackObj: null,
  trackRating: null,
  isRadio: null,

  showPlaylist: null,
  showRating: null,
  showVolume: null,
  showPosition: null,

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
            canRaise: false,
            canQuit: false
        };

        this.state = new PlayerState();

        this.owner = owner;
        this.busName = busName;
        // Guess the name based on the dbus path
        // Should be overriden by the Identity property
        this._identity = baseName.charAt(0).toUpperCase() + baseName.slice(1);
        this._playlists = "";
        this._playlistsMenu = "";
        this._currentPlaylist = "";
        this._trackTime = 0;
        this._wantedSeekValue = 0;
        this._trackCoverFileTmp = null;

        this._timerId = 0;
        this._statusId = 0;

        this._settings = Settings.gsettings;
        this._signalsId = [];

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
        new DBusIface.Properties(busName,
                                 Lang.bind(this, function(proxy) {
                                    this._prop = proxy;
                                    this._init2();
                                 }));

        this.connect("player-update", Lang.bind(this, function(player, state) {
          this.state.update(state);
          if (state.status)
            this._onStatusChange();
        }));

    },

    _init2: function() {
        // Wait all DBus callbacks to continue
        if (!this._mediaServer || !this._mediaServerPlayer || !this._mediaServerPlaylists || !this._prop)
            return;

        this.info.canRaise = this._mediaServer.CanRaise;
        this.info.canQuit = this._mediaServer.CanQuit;

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
        // showPlaylists setting
        this._signalsId.push(
          this._settings.connect("changed::" + Settings.MEDIAPLAYER_PLAYLISTS_KEY, Lang.bind(this, function() {
            this.emit('player-update', new PlayerState({showPlaylist: this._settings.get_boolean(Settings.MEDIAPLAYER_PLAYLISTS_KEY)}));
          }))
        );

        this._playlistsId = this._mediaServerPlaylists.connectSignal('PlaylistChanged', Lang.bind(this, function(proxy, sender, [iface, props]) {
          this._getPlaylists();
        }));

        this._propChangedId = this._prop.connectSignal('PropertiesChanged', Lang.bind(this, function(proxy, sender, [iface, props]) {
          let newState = new PlayerState();

          if (props.Volume)
            newState.volume = props.Volume.unpack();

          if (props.CanPause)
            newState.canPause = props.CanPause.unpack();

          if (props.CanGoNext)
            newState.canGoNext = props.CanGoNext.unpack();

          if (props.CanGoPrevious)
            newState.canGoPrevious = props.CanGoPrevious.unpack();

          if (props.PlaybackStatus) {
            let status = props.PlaybackStatus.unpack();
            if (Settings.SEND_STOP_ON_CHANGE.indexOf(this.busName) != -1) {
              // Some players send a "PlaybackStatus: Stopped" signal when changing
              // tracks, so wait a little before refreshing.
              if (this._statusId !== 0) {
                Mainloop.source_remove(this._statusId);
                this._statusId = 0;
              }
              this._statusId = Mainloop.timeout_add(500, Lang.bind(this, function() {
                this.emit('player-update', new PlayerState({status: status}));
              }));
            }
            else {
              newState.status = status;
            }
          }

          if (props.Metadata)
            this._parseMetadata(props.Metadata.deep_unpack(), newState);

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
        canPause: this._mediaServerPlayer.CanPause || true,
        canGoNext: this._mediaServerPlayer.CanGoNext || true,
        canGoPrevious: this._mediaServerPlayer.CanGoPrevious || true,
        canSeek: this._mediaServerPlayer.CanSeek || true,
        showVolume: this._settings.get_boolean(Settings.MEDIAPLAYER_VOLUME_KEY),
        showPosition: this._settings.get_boolean(Settings.MEDIAPLAYER_POSITION_KEY),
        showRating: this._settings.get_boolean(Settings.MEDIAPLAYER_RATING_KEY),
        showPlaylist: this._settings.get_boolean(Settings.MEDIAPLAYER_PLAYLISTS_KEY),
        volume: this._mediaServerPlayer.Volume,
        status: this._mediaServerPlayer.PlaybackStatus
      });

      if (this._mediaServerPlaylists.ActivePlaylist) {
        newState.playlist = this._mediaServerPlaylists.ActivePlaylist[1][0];
      }

      this._parseMetadata(this._mediaServerPlayer.Metadata, newState);

      this.emit('player-update', newState);
      
      this._getPlaylists();
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

    raise: function() {
      if (this.info.app)
        this.info.app.activate_full(-1, 0);
      else if (this.info.canRaise)
        this._mediaServer.RaiseRemote();
    },

    _getPlayerInfo: function() {
        if (this._mediaServer.Identity) {
          this.info.identity = this._mediaServer.Identity;
        }
        if (this._mediaServer.DesktopEntry) {
          let entry = this._mediaServer.DesktopEntry;
          let appSys = Shell.AppSystem.get_default();
          this.info.app = appSys.lookup_app(entry + ".desktop");
          this.info.appInfo = Gio.DesktopAppInfo.new(entry + ".desktop");
        }
    },

    _parseMetadata: function(metadata, state) {
      // Pragha sends a metadata dict with one value on stop
      if (metadata === null || Object.keys(metadata).length < 2)
        return;

      state.trackUrl = metadata["xesam:url"] ? metadata["xesam:url"].unpack() : "";
      state.trackArtist = metadata["xesam:artist"] ? metadata["xesam:artist"].deep_unpack() : "";
      state.trackAlbum = metadata["xesam:album"] ? metadata["xesam:album"].unpack() : "";
      state.trackTitle = metadata["xesam:title"] ? metadata["xesam:title"].unpack() : "";
      state.trackNumber = metadata["xesam:trackNumber"] ? metadata["xesam:trackNumber"].unpack() : "";
      state.trackLength = metadata["mpris:length"] ? metadata["mpris:length"].unpack() / 1000000 : 0;
      state.trackObj = metadata["mpris:trackid"] ? metadata["mpris:trackid"].unpack() : "";
      state.trackCoverUrl = metadata["mpris:artUrl"] ? metadata["mpris:artUrl"].unpack() : "";
      state.isRadio = false;

      if (state.trackCoverUrl !== null && state.trackCoverUrl !== this.state.trackCoverUrl) {
        if (state.trackCoverUrl) {
          let cover_path = "";
          // Distant cover
          if (state.trackCoverUrl.match(/^http/)) {
            // Copy the cover to a tmp local file
            let cover = Gio.file_new_for_uri(decodeURIComponent(state.trackCoverUrl));
            // Don't create multiple tmp files
            if (!this._trackCoverFileTmp)
              this._trackCoverFileTmp = Gio.file_new_tmp('XXXXXX.mediaplayer-cover')[0];
            // asynchronous copy
            cover.read_async(null, null, Lang.bind(this, this._onReadCover));
          }
          // Local cover
          else if (state.trackCoverUrl.match(/^file/)) {
            state.trackCoverPath = decodeURIComponent(state.trackCoverUrl.substr(7));
          }
        }
        else {
          state.trackCoverPath = '';
        }
      }
      else if (state.trackCoverUrl == '' && metadata["xesam:genre"]) {
        let genres = metadata["xesam:genre"].deep_unpack();
        for (let i in genres) {
          if (genres[i].toLowerCase().indexOf("radio") > -1) {
            state.isRadio = true;
            break;
          }
        }
      }

      // Check if the track has changed
      if (state.trackUrl !== this.state.trackUrl) {
        this._getPosition();
        this._refreshProperties();
      }

      let rating = 0;
      if (metadata["xesam:userRating"])
        rating = (metadata["xesam:userRating"].deep_unpack() * 5);
      // Clementine
      if (metadata.rating)
        rating = metadata.rating.deep_unpack();
      state.trackRating = parseInt(rating);
    },

    _onReadCover: function(cover, result) {
      let inStream = cover.read_finish(result);
      let outStream = this._trackCoverFileTmp.replace(null, false,
                                                      Gio.FileCreateFlags.REPLACE_DESTINATION,
                                                      null, null);
      outStream.splice_async(inStream, Gio.OutputStreamSpliceFlags.CLOSE_TARGET,
                             0, null, Lang.bind(this, function(outStream, result) {
                               outStream.splice_finish(result, null);
                               this.emit('player-update',
                                         new PlayerState({trackCoverPath: this._trackCoverFileTmp.get_path()}));
                             }));
    },

    _refreshProperties: function() {
      // check Can* properties
      this._prop.GetRemote('org.mpris.MediaPlayer2.Player', 'CanSeek',
                           Lang.bind(this, function(value, err) {
                             let state = new PlayerState();
                             let canSeek = true;
                             if (!err)
                               canSeek = value[0].unpack();

                             if (this.state.trackLength === 0)
                               canSeek = false;

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

    _getPlaylists: function() {
      this._mediaServerPlaylists.GetPlaylistsRemote(0, 100, "Alphabetical", false, Lang.bind(this, function(playlists) {
        if (playlists && playlists[0])
          this.emit('player-update', new PlayerState({playlists: playlists[0]}));
        else
          this.emit('player-update', new PlayerState({showPlaylist: false}));
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
      let status = this.state.status;
      if (status == Settings.Status.PLAY) {
        this._startTimer();
      }
      else if (status == Settings.Status.PAUSE) {
        this._pauseTimer();
      }
      else if (status == Settings.Status.STOP) {
        this._stopTimer();
      }
    },

    _startTimer: function() {
      this._pauseTimer();
      this._timerId = Mainloop.timeout_add_seconds(1, Lang.bind(this, this._startTimer));
      this.trackTime += 1;
    },

    _pauseTimer: function() {
      if (this._timerId !== 0) {
        Mainloop.source_remove(this._timerId);
        this._timerId = 0;
      }
    },

    _stopTimer: function() {
      this.trackTime = 0;
      this._pauseTimer();
    },

    destroy: function() {
        this._stopTimer();
        if (this._propChangedId) {
          this._prop.disconnectSignal(this._propChangedId);
        }
        if (this._playlistsId) {
          this._mediaServerPlaylists.disconnectSignal(this._playlistsId);
        }
        if (this._seekedId) {
          this._mediaServerPlayer.disconnectSignal(this._seekedId);
        }
        for (let id in this._signalsId)
            this._settings.disconnect(this._signalsId[id]);
    },

    toString: function() {
        return "<object MPRISPlayer(%s)>".format(this.info.identity);
    }
});
Signals.addSignalMethods(MPRISPlayer.prototype);
