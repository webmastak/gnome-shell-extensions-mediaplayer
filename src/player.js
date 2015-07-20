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
  playlists: null,
  playlistsMenu: null,
  currentPlaylist: null,

  trackTime: null,
  trackTitle: null,
  trackAlbum: null,
  trackArtist: null,
  trackUrl: null,
  trackNumber: null,
  trackCoverUrl: null,
  trackLength: null,
  trackCoverPath: null,
  trackObj: null,
  trackRating: null,

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
            this.emit('player-update', new PlayerState({showVolume: this._settings.get_boolean(Settings.MEDIAPLAYER_VOLUME_KEY),
                                                        volume: this.state.volume}));
          }))
        );
        this.emit('player-update', new PlayerState({showVolume: this._settings.get_boolean(Settings.MEDIAPLAYER_VOLUME_KEY)}));

        // showPosition setting
        this._signalsId.push(
          this._settings.connect("changed::" + Settings.MEDIAPLAYER_POSITION_KEY, Lang.bind(this, function() {
            this.emit('player-update', new PlayerState({showPosition: this._settings.get_boolean(Settings.MEDIAPLAYER_POSITION_KEY),
                                                        position: this.state.position}));
          }))
        );
        this.emit('player-update', new PlayerState({showPosition: this._settings.get_boolean(Settings.MEDIAPLAYER_POSITION_KEY)}));

        // showRating setting
        this._signalsId.push(
          this._settings.connect("changed::" + Settings.MEDIAPLAYER_RATING_KEY, Lang.bind(this, function() {
            this.emit('player-update', new PlayerState({showRating: this._settings.get_boolean(Settings.MEDIAPLAYER_RATING_KEY)}));
          }))
        );
        this.emit('player-update', new PlayerState({showRating: this._settings.get_boolean(Settings.MEDIAPLAYER_RATING_KEY)}));


        this.showPlaylists = this._settings.get_boolean(Settings.MEDIAPLAYER_PLAYLISTS_KEY);
        this._signalsId.push(
            this._settings.connect("changed::" + Settings.MEDIAPLAYER_PLAYLISTS_KEY, Lang.bind(this, function() {
                if (this._settings.get_boolean(Settings.MEDIAPLAYER_PLAYLISTS_KEY)) {
                    this.showPlaylists = true;
                    this._getPlaylists();
                    this._getActivePlaylist();
                }
                else {
                    this.showPlaylists = false;
                    if (this._playlistsMenu)
                        this._playlistsMenu.destroy();
                }
            }))
        );

        this._propChangedId = this._prop.connectSignal('PropertiesChanged', Lang.bind(this, function(proxy, sender, [iface, props]) {
          let newState = new PlayerState();

          if (props.Volume) {
            newState.volume = props.Volume.unpack();
          }

          if (props.PlaybackStatus) {
            let status = props.PlaybackStatus.unpack();
            if (Settings.SEND_STOP_ON_CHANGE.indexOf(this.busName) != -1) {
              // Some players send a "PlaybackStatus: Stopped" signal when changing
              // tracks, so wait a little before refreshing.
              if (this._statusId !== 0) {
                Mainloop.source_remove(this._statusId);
                this._statusId = 0;
              }
              this._statusId = Mainloop.timeout_add(300, Lang.bind(this, function() {
                this.emit('player-update', new PlayerState({status: status}));
              }));
            }
            else {
              newState.status = status;
            }
          }

          if (props.Metadata)
            this._setMetadata(props.Metadata.deep_unpack(), newState);

          if (props.ActivePlaylist)
            this._setActivePlaylist(props.ActivePlaylist.deep_unpack());

          if (props.CanGoNext || props.CanGoPrevious || props.CanSeek) {
            newState.canGoNext = props.CanGoNext.unpack() || true;
            newState.canGoPrevious = props.CanGoPrevious.unpack() || true;
            newState.canSeek = props.CanSeek.unpack() || true;
          }

          this.emit('player-update', newState);
        }));

        this._seekedId = this._mediaServerPlayer.connectSignal('Seeked', Lang.bind(this, function(proxy, sender, [value]) {
          if (value > 0) {
            this.trackTime = value / 1000000;
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
                    this._prop.GetRemote('org.mpris.MediaPlayer2.Player', 'Position', Lang.bind(this, function(value, err) {
                        if (err) {
                          this.emit('player-update', new PlayerState({showPosition: false}));
                        }
                        else {
                          this.trackTime = value[0].unpack() / 1000000;
                        }
                    }));
                }
            }
        }));

        this.emit('init-done');
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
      global.log("init populate");
        let newState = new PlayerState({
          volume: this._mediaServerPlayer.Volume,
          status: this._mediaServerPlayer.PlaybackStatus
        });

        this._setMetadata(this._mediaServerPlayer.Metadata, newState);

        if (newState.status != Settings.Status.STOP) {
          this._trackTime = this._mediaServerPlayer.Position / 1000000;
          newState.trackTime = this._trackTime;
        }

        this._getPlayerInfo();

        //if (this.showPlaylists) {
            //this._getPlaylists();
            //this._getActivePlaylist();
        //}

        this._onTrackChange();

        this.emit('player-update', newState);
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

    raise: function() {
      if (this.info.app)
        this.info.app.activate_full(-1, 0);
      else if (this.info.canRaise)
        this._mediaServer.RaiseRemote();
    },

    toString: function() {
        return "[object MPRISPlayer(%s)]".format(this.info.identity);
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
        this.emit('player-info-update');
    },

    _setActivePlaylist: function(playlist) {
        // Is there an active playlist ?
        if (playlist && playlist[0]) {
            this._currentPlaylist = playlist[1][0];
            this.state.currentPlaylist = playlist[1][0];
        }
        else {
            this.state.currentPlaylist = null;
        }
        this._setPlaylists(null);
    },

    _getActivePlaylist: function() {
        this._setActivePlaylist(this._mediaServerPlaylists.ActivePlaylist);
    },

    _setPlaylists: function(playlists) {
        if (!playlists && this._playlists)
            playlists = this._playlists;

        if (playlists && playlists[0].length > 0) {
            this._playlists = playlists;
            if (!this._playlistsMenu) {
                this._playlistsMenu = new PopupMenu.PopupSubMenuMenuItem(_("Playlists"));
                //this.addMenuItem(this._playlistsMenu);
            }
            let show = false;
            this._playlistsMenu.menu.removeAll();
            for (let p in this._playlists[0]) {
                let obj = this._playlists[0][p][0];
                let name = this._playlists[0][p][1];
                if (obj.toString().search('Video') == -1) {
                    let playlist = new Widget.PlaylistItem(name, obj);
                    playlist.connect('activate', Lang.bind(this, function(playlist) {
                        this._mediaServerPlaylists.ActivatePlaylistRemote(playlist.obj);
                    }));
                    if (obj == this._currentPlaylist)
                        playlist.setShowDot(true);
                    this._playlistsMenu.menu.addMenuItem(playlist);
                    show = true;
                }
            }
            if (!show)
                this._playlistsMenu.destroy();

        }
    },

    _getPlaylists: function() {
        this._mediaServerPlaylists.GetPlaylistsRemote(0, 100, "Alphabetical", false, Lang.bind(this, this._setPlaylists));
    },

    _setMetadata: function(metadata, state) {
      // Pragha sends a metadata dict with one
      // value on stop
      if (metadata !== null && Object.keys(metadata).length > 1) {
        // Check if the track has changed
        let trackChanged = true;
        // Check if the URL has changed
        if (metadata["xesam:url"] && metadata["xesam:url"].unpack() == this.state.trackUrl)
          trackChanged = false;
        // Reset the timer only when the track has changed
        if (trackChanged) {
          this._trackTime = 0;
          if (metadata["mpris:length"]) {
            state.trackLength = metadata["mpris:length"].unpack() / 1000000;
          }
          // refresh properties
          this._onTrackChange();
        }

        if (metadata["xesam:artist"]) {
          state.trackArtist = metadata["xesam:artist"].deep_unpack();
        }

        if (metadata["xesam:album"]) {
          state.trackAlbum = metadata["xesam:album"].unpack();
        }

        if (metadata["xesam:title"]) {
          state.trackTitle = metadata["xesam:title"].unpack();
        }

        if (metadata["xesam:url"]) {
          state.trackUrl = metadata["xesam:url"].unpack();
        }

        if (metadata["mpris:trackid"]) {
          state.trackObj = metadata["mpris:trackid"].unpack();
        }

        let rating = 0;
        if (metadata["xesam:userRating"])
          rating = (metadata["xesam:userRating"].deep_unpack() * 5);
        // Clementine
        if (metadata["rating"])
          rating = metadata["rating"].deep_unpack();
        state.trackRating = parseInt(rating);

        if (metadata["mpris:artUrl"]) {
          state.trackCoverUrl = metadata["mpris:artUrl"].unpack();
        }
        else {
          state.trackCoverUrl = '';
        }
      }
    },

    _onStatusChange: function() {
      let status = this.state.status;
      global.log("on status change");
      global.log(status);
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

    _onTrackChange: function(position) {
      global.log("on track change");
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
        if (this._seekedId) {
          this._mediaServerPlayer.disconnectSignal(this._seekedId);
        }
        for (let id in this._signalsId)
            this._settings.disconnect(this._signalsId[id]);
    }
});
Signals.addSignalMethods(MPRISPlayer.prototype);
