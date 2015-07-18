/* -*- mode: js2; js2-basic-offset: 4; indent-tabs-mode: nil -*- */
/* jshint esnext: true */
/* global imports: false */
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
  currentTime: null,
  trackTitle: null,
  trackAlbum: null,
  trackArtist: null,
  trackUrl: null,
  trackNumber: null,
  trackCoverUrl: null,
  trackLength: null,
  trackCoverPath: null,
  trackObj: null,
  showRating: null,
  trackRating: null,
  rating: null,

  canSeek: null,
  canGoNext: null,
  canGoPrevious: null,
  canPause: null,

  showVolume: null,
  hasVolume: null,
  volume: null,

  showPosition: null,
  hasPosition: null,
  _position: null,

  set position(value) {
    if (value == null) {
      this.hasPosition = false;
      this._position = null;
    }
    else {
      this.hasPosition = true;
      this._position = value;
    }
  },

  get position() {
    return this._position;
  }

});


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
    global.log("close: " + force);
    if (force !== true)
      return;
    this.menu._close(BoxPointer.PopupAnimation.FULL);
    this.emit('player-menu-closed');
  },

  open: function(animate) {
    if (!animate)
      animate = BoxPointer.PopupAnimation.FULL
    this.menu._open(animate);
    this.emit('player-menu-opened');
  },

  setSubmenuShown: function(open) {
    if (open)
      this.menu.open(BoxPointer.PopupAnimation.FULL);
    else
      this.menu.close(BoxPointer.PopupAnimation.FULL, true);
  }

});

const DefaultPlayer = new Lang.Class({
    Name: 'DefaultPlayer',
    Extends: PlayerMenu,

    _init: function() {
        let app = Shell.AppSystem.get_default().lookup_app(
            Gio.app_info_get_default_for_type('audio/x-vorbis+ogg', false).get_id()
        );
        let appInfo = Gio.DesktopAppInfo.new(app.get_id());
        this.parent(app.get_name(), true);
        this.icon.gicon = appInfo.get_icon();
        this._runButton = new Widget.PlayerButton('system-run-symbolic', function() {
          app.activate_full(-1, 0);
        });
        this.buttons = new Widget.PlayerButtons();
        this.buttons.addButton(this._runButton);
        this.addMenuItem(this.buttons);
    }
});


const MPRISPlayer = new Lang.Class({
    Name: 'MPRISPlayer',
    Extends: PlayerMenu,

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
        this._app = "";
        this._status = "";
        // Guess the name based on the dbus path
        // Should be overriden by the Identity property
        this._identity = baseName.charAt(0).toUpperCase() + baseName.slice(1);
        this._playlists = "";
        this._playlistsMenu = "";
        this._currentPlaylist = "";
        this._currentTime = -1;
        this._wantedSeekValue = 0;
        this._timeoutId = 0;
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

        this._signalsId.push(
          this.connect("player-update", Lang.bind(this, function(player, state) {
            this.state.update(state);
          }))
        );

    },

    _init2: function() {
        // Wait all DBus callbacks to continue
        if (!this._mediaServer || !this._mediaServerPlayer || !this._mediaServerPlaylists || !this._prop)
            return;

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

        this.coverSize = this._settings.get_int(Settings.MEDIAPLAYER_COVER_SIZE);
        this._signalsId.push(
            this._settings.connect("changed::" + Settings.MEDIAPLAYER_COVER_SIZE, Lang.bind(this, function() {
                this.coverSize = this._settings.get_int(Settings.MEDIAPLAYER_COVER_SIZE);
            }))
        );

        this._prevButton = new Widget.PlayerButton('media-skip-backward-symbolic',
            Lang.bind(this, function () { this._mediaServerPlayer.PreviousRemote(); }));
        this._playButton = new Widget.PlayerButton('media-playback-start-symbolic',
            Lang.bind(this, function () { this._mediaServerPlayer.PlayPauseRemote(); }));
        this._stopButton = new Widget.PlayerButton('media-playback-stop-symbolic',
            Lang.bind(this, function () { this._mediaServerPlayer.StopRemote(); }));
        this._stopButton.hide();
        this._nextButton = new Widget.PlayerButton('media-skip-forward-symbolic',
            Lang.bind(this, function () { this._mediaServerPlayer.NextRemote(); }));

        this.trackControls = new Widget.PlayerButtons();
        this.trackControls.addButton(this._prevButton);
        this.trackControls.addButton(this._playButton);
        this.trackControls.addButton(this._stopButton);
        this.trackControls.addButton(this._nextButton);

        if (this._mediaServer.CanRaise) {
            this.info.canRaise = true;

          this._raiseButton = new Widget.PlayerButton('media-eject',
                                                      Lang.bind(this, function() {
                                                        // If we have an application in the appSystem
                                                        // Bring it to the front else let the player decide
                                                        if (this._app)
                                                          this._app.activate_full(-1, 0);
                                                        else
                                                          this._mediaServer.RaiseRemote();
                                                        // Close the indicator
                                                        this.emit("menu-close");
                                                      }));
          this.trackControls.addButton(this._raiseButton);
        }

        this.addMenuItem(this.trackControls);

        if (this._mediaServer.CanQuit)
            this.info.canQuit = true;
            //this.playerTitle.hideButton();

          this._propChangedId = this._prop.connectSignal('PropertiesChanged', Lang.bind(this, function(proxy, sender, [iface, props]) {
            let newState = new PlayerState();
            if (props.Volume) {
              newState.volume = props.Volume.unpack();
            }
            if (props.PlaybackStatus) {
              this._setStatus(props.PlaybackStatus.unpack());
              newState.status = props.PlaybackStatus.unpack();
              global.log(newState.status);
            }
            if (props.Metadata)
              this._setMetadata(props.Metadata.deep_unpack(), newState);
            if (props.ActivePlaylist)
              this._setActivePlaylist(props.ActivePlaylist.deep_unpack());
            if (props.CanGoNext || props.CanGoPrevious) {
              newState.canGoNext = props.CanGoNext.unpack() || true;
              newState.canGoPrevious = props.CanGoPrevious.unpack() || true;
            }

            global.log("'PropertiesChanged'");
            this.emit('player-update', newState);
          }));

        this._seekedId = this._mediaServerPlayer.connectSignal('Seeked', Lang.bind(this, function(proxy, sender, [value]) {
            let newState = new PlayerState();
            if (value > 0) {
                newState.position = value / 1000000 / this.state.trackLength;
                this._currentTime = value / 1000000
                this.emit('player-update', newState);
            }
            // Banshee is buggy and always emits Seeked(0). See #34, #183,
            // also <https://bugzilla.gnome.org/show_bug.cgi?id=654524>.
            else {
                // If we caused the seek, just use the expected position.
                // This is actually needed because even Get("Position")
                // sometimes returns 0 immediately after seeking! *grumble*
                if (this._wantedSeekValue > 0) {
                    newState.position = this._wantedSeekValue / this.state.trackLength;
                    this._currentTime = this._wantedSeekValue / 1000000
                    this._wantedSeekValue = 0;
                    this.emit('player-update', newState);
                }
                // If the seek was initiated by the player itself, query it
                // for the new position.
                else {
                    this._prop.GetRemote('org.mpris.MediaPlayer2.Player', 'Position', Lang.bind(this, function(value, err) {
                        if (err)
                            newState.position = null;
                        else {
                            newState.position = value[0].unpack() / 1000000 / this.state.trackLength;
                            this._currentTime = value[0].unpack() / 1000000;
                        }
                        this.emit('player-update', newState);
                    }));
                }
            }
        }));

        this.emit('init-done');
    },

    populate: function() {
      global.log("init populate");
        let newState = new PlayerState({
          volume: this._mediaServerPlayer.Volume,
          status: this._mediaServerPlayer.PlaybackStatus
        });

        this._setMetadata(this._mediaServerPlayer.Metadata, newState);

        if (newState.status != Settings.Status.STOP) {
          newState.position = this._mediaServerPlayer.Position / 1000000 / newState.trackLength;
          this._currentTime = this._mediaServerPlayer.Position / 1000000;
        }

        this._getIdentity();
        this._getDesktopEntry();

        // FIXME
        // Hack to avoid the trackBox.box.get_stage() == null
        Mainloop.timeout_add(300, Lang.bind(this, this._getStatus));
        //if (this.showPlaylists) {
            //this._getPlaylists();
            //this._getActivePlaylist();
        //}
        this._updateSliders();

        this.emit('player-update', newState);

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
      this.emit('player-update', new PlayerState({
        positionText: this._formatTime(time) + " / " + this._formatTime(this.state.trackLength)
      }));
    },

    toString: function() {
        return "[object Player(%s,%s)]".format(this._identity, this._status);
    },

    _getIdentity: function() {
        if (this._mediaServer.Identity) {
            this.info.identity = this._mediaServer.Identity;

            this._identity = this._mediaServer.Identity;
            this._setIdentity();
        }
    },

    _setIdentity: function() {
        this.label.text = this._identity;
        if (this._status) {
          this.status.text = _(this._status);
        }
        else {
          this.status.text = null;
        }
    },

    _getDesktopEntry: function() {
        let entry = this._mediaServer.DesktopEntry;
        let appSys = Shell.AppSystem.get_default();
        this._app = appSys.lookup_app(entry + ".desktop");
        this.info.app = this._app;
        let appInfo = Gio.DesktopAppInfo.new(entry + ".desktop");
        this.info.appInfo = appInfo;
        if (appInfo) {
            this.icon.gicon = appInfo.get_icon();
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
                this.addMenuItem(this._playlistsMenu);
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
          this._currentTime = -1;
          if (metadata["mpris:length"]) {
            state.trackLength = metadata["mpris:length"].unpack() / 1000000;
          }
          if (Settings.SEND_STOP_ON_CHANGE.indexOf(this.busName) != -1) {
            // Some players send a "PlaybackStatus: Stopped" signal when changing
            // tracks, so wait a little before refreshing sliders
            Mainloop.timeout_add_seconds(1, Lang.bind(this, this._updateSliders));
          } else {
            this._updateSliders();
          }
          // Check if the current track can be paused
          this._updateControls();
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
          state.trackCoverFile = metadata["mpris:artUrl"].unpack();
        }
      }
    },

    _setStatus: function(status) {
        if (status != this._status) {
            this._status = status;
            if (this._status == Settings.Status.PLAY) {
                this._startTimer();
            }
            else if (this._status == Settings.Status.PAUSE) {
                this._pauseTimer();
            }
            else if (this._status == Settings.Status.STOP) {
                this._stopTimer();
            }

            if (Settings.SEND_STOP_ON_CHANGE.indexOf(this.busName) != -1) {
                // Some players send a "PlaybackStatus: Stopped" signal when changing
                // tracks, so wait a little before refreshing.
                Mainloop.timeout_add(300, Lang.bind(this, this._refreshStatus));
            }
            else {
                this._refreshStatus();
            }
        }
    },

    _refreshStatus: function() {
        this._updateSliders();
        this._updateControls();
        this._setIdentity();
    },

    _updateSliders: function(position) {
      this._prop.GetRemote('org.mpris.MediaPlayer2.Player', 'CanSeek',
                           Lang.bind(this, function(value, err) {
                             let state = new PlayerState();
                             let canSeek = true;
                             if (!err)
                               canSeek = value[0].unpack();

                             if (this.state.trackLength === 0)
                               canSeek = false

                             if (this.state.canSeek != canSeek) {
                               state.canSeek = canSeek;
                               this.emit('player-update', state);
                             }
                           })
                          );
    },

    _updateControls: function() {
      // called for each song change and status change
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

    _getStatus: function() {
        this._setStatus(this._mediaServerPlayer.PlaybackStatus);
    },

    _updateTimer: function() {
      this.emit('player-update', new PlayerState({
        position: this._currentTime / this.state.trackLength,
        positionText: this._formatTime(this._currentTime) + " / " + this._formatTime(this.state.trackLength)
      }));
    },

    _startTimer: function() {
        if (this._status == Settings.Status.PLAY) {
            this._timeoutId = Mainloop.timeout_add_seconds(1, Lang.bind(this, this._startTimer));
            this._currentTime += 1;
            this._updateTimer();
        }
    },

    _pauseTimer: function() {
        if (this._timeoutId !== 0) {
            Mainloop.source_remove(this._timeoutId);
            this._timeoutId = 0;
        }
        this._updateTimer();
    },

    _stopTimer: function() {
        this._currentTime = 0;
        this._pauseTimer();
        this._updateTimer();
    },

    _formatTime: function(s) {
        let ms = s * 1000;
        let msSecs = (1000);
        let msMins = (msSecs * 60);
        let msHours = (msMins * 60);
        let numHours = Math.floor(ms/msHours);
        let numMins = Math.floor((ms - (numHours * msHours)) / msMins);
        let numSecs = Math.floor((ms - (numHours * msHours) - (numMins * msMins))/ msSecs);
        if (numSecs < 10)
            numSecs = "0" + numSecs.toString();
        if (numMins < 10 && numHours > 0)
            numMins = "0" + numMins.toString();
        if (numHours > 0)
            numHours = numHours.toString() + ":";
        else
            numHours = "";
        return numHours + numMins.toString() + ":" + numSecs.toString();
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
        this.parent();
    }
});
