/* -*- mode: js2; js2-basic-offset: 4; indent-tabs-mode: nil -*- */
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

const Gettext = imports.gettext.domain('gnome-shell-extensions-mediaplayer');
const _ = Gettext.gettext;

const Me = imports.misc.extensionUtils.getCurrentExtension();
const Widget = Me.imports.widget;
const DBusIface = Me.imports.dbus;
const Settings = Me.imports.settings;


const DefaultPlayer = new Lang.Class({
    Name: 'DefaultPlayer',
    Extends: PopupMenu.PopupMenuSection,

    _init: function() {
        this.parent();

        this._app = Shell.AppSystem.get_default().lookup_app(
            Gio.app_info_get_default_for_type('audio/x-vorbis+ogg', false).get_id()
        );

        let icon = this._app.create_icon_texture(16);
        this.playerTitle = new Widget.TitleItem(this._app.get_name(),
                                                icon,
                                                function() {});
        this.playerTitle.setSensitive(false);
        this.playerTitle.actor.remove_style_pseudo_class('insensitive');
        this.playerTitle.hideButton();

        this.addMenuItem(this.playerTitle);

        this._runButton = new Widget.PlayerButton('system-run-symbolic',
                                                  Lang.bind(this, function () {
                                                      this._app.activate_full(-1, 0);
                                                  }));

        this.trackControls = new Widget.PlayerButtons();
        this.trackControls.addButton(this._runButton);

        this.addMenuItem(this.trackControls);
    }
});


const MPRISPlayer = new Lang.Class({
    Name: 'MPRISPlayer',
    Extends: PopupMenu.PopupMenuSection,

    _init: function(busName, owner) {
        this.parent();

        let baseName = busName.split('.')[3];
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
    },

    _init2: function() {
        // Wait all DBus callbacks to continue
        if (!this._mediaServer || !this._mediaServerPlayer || !this._mediaServerPlaylists || !this._prop)
            return;

        this.showVolume = this._settings.get_boolean(Settings.MEDIAPLAYER_VOLUME_KEY);
        this._signalsId.push(
            this._settings.connect("changed::" + Settings.MEDIAPLAYER_VOLUME_KEY, Lang.bind(this, function() {
                this.showVolume = this._settings.get_boolean(Settings.MEDIAPLAYER_VOLUME_KEY);
                this._updateSliders();
            }))
        );
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
        this.showRating = this._settings.get_boolean(Settings.MEDIAPLAYER_RATING_KEY);
        this._signalsId.push(
            this._settings.connect("changed::" + Settings.MEDIAPLAYER_RATING_KEY, Lang.bind(this, function() {
                if (this._settings.get_boolean(Settings.MEDIAPLAYER_RATING_KEY)) {
                    this.showRating = true;
                    this.trackRating = new Widget.TrackRating(_("rating"), 0, 'track-rating', this);
                    this.trackBox.addInfo(this.trackRating, 3);
                }
                else {
                    this.showRating = false;
                    this.trackRating.destroy();
                }
            }))
        );
        let genericIcon = new St.Icon({icon_name: "audio-x-generic-symbolic", icon_size: 16});
        this.playerTitle = new Widget.TitleItem(this._identity, genericIcon, Lang.bind(this, function() { this._mediaServer.QuitRemote(); }));

        this.addMenuItem(this.playerTitle);

        this.trackCoverContainer = new St.Button({style_class: 'track-cover-container', x_align: St.Align.START, y_align: St.Align.START});
        this.trackCoverContainer.connect('clicked', Lang.bind(this, this._toggleCover));
        this.trackCoverFile = false;
        this.trackCoverFileTmp = false;
        this.trackCover = new St.Icon({icon_name: "media-optical-cd-audio", icon_size: this.coverSize});
        this.trackCoverContainer.set_child(this.trackCover);

        this.trackTitle = new Widget.TrackTitle(null, _('Unknown Title'), 'track-title');
        this.trackArtist = new Widget.TrackTitle(_("by"), _('Unknown Artist'), 'track-artist');
        this.trackAlbum = new Widget.TrackTitle(_("from"), _('Unknown Album'), 'track-album');

        this.trackBox = new Widget.TrackBox(this.trackCoverContainer);
        this.trackBox.addInfo(this.trackTitle, 0);
        this.trackBox.addInfo(this.trackArtist, 1);
        this.trackBox.addInfo(this.trackAlbum, 2);
        if (this.showRating) {
            this.trackRating = new Widget.TrackRating(_("rating"), 0, 'track-rating', this);
            this.trackBox.addInfo(this.trackRating, 3);
        }

        this.addMenuItem(this.trackBox);

        this.trackBox.box.hide();
        this.trackBox.box.opacity = 0;
        this.trackBox.box.set_height(0);

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

        this.addMenuItem(this.trackControls);

        this.showPosition = this._settings.get_boolean(Settings.MEDIAPLAYER_POSITION_KEY);
        this._position = new Widget.SliderItem("0:00 / 0:00", "document-open-recent", 0);
        this._position.connect('value-changed', Lang.bind(this, function(item) {
            let time = item._value * this._songLength;
            this._position.setLabel(this._formatTime(time) + " / " + this._formatTime(this._songLength));
            this._wantedSeekValue = Math.round(time * 1000000);
            this._mediaServerPlayer.SetPositionRemote(this.trackObj, time * 1000000);
        }));
        this._signalsId.push(
            this._settings.connect("changed::" + Settings.MEDIAPLAYER_POSITION_KEY, Lang.bind(this, function() {
                this.showPosition = this._settings.get_boolean(Settings.MEDIAPLAYER_POSITION_KEY);
                this._updateSliders();
            }))
        );
        this.addMenuItem(this._position);

        this._volume = new Widget.SliderItem(_("Volume"), "audio-volume-high-symbolic", 0);
        this._volume.connect('value-changed', Lang.bind(this, function(item) {
            this._mediaServerPlayer.Volume = item._value;
        }));
        this.addMenuItem(this._volume);

        if (this._mediaServer.CanRaise) {
            this.playerTitle.connect('activate',
                Lang.bind(this, function () {
                    // If we have an application in the appSystem
                    // Bring it to the front else let the player decide
                    if (this._app)
                        this._app.activate_full(-1, 0);
                    else
                        this._mediaServer.RaiseRemote();
                    // Close the indicator
                    this.emit("close-menu");
                })
            );
        }
        else {
            // Make the player title insensitive
            this.playerTitle.setSensitive(false);
            this.playerTitle.actor.remove_style_pseudo_class('insensitive');
        }

        if (this._mediaServer.CanQuit) {
            this.playerTitle.showButton();
        }

        this._propChangedId = this._prop.connectSignal('PropertiesChanged', Lang.bind(this, function(proxy, sender, [iface, props]) {
            if (props.Volume)
                this._setVolume(props.Volume.unpack());
            if (props.PlaybackStatus)
                this._setStatus(props.PlaybackStatus.unpack());
            if (props.Metadata)
                this._setMetadata(props.Metadata.deep_unpack());
            if (props.ActivePlaylist)
                this._setActivePlaylist(props.ActivePlaylist.deep_unpack());
            if (props.CanGoNext || props.CanGoPrevious)
                this._updateControls();
        }));

        this._seekedId = this._mediaServerPlayer.connectSignal('Seeked', Lang.bind(this, function(proxy, sender, [value]) {
            if (value > 0) {
                this._setPosition(value);
            }
            // Seek initiated by the position slider
            else if (this._wantedSeekValue > 0) {
                // Some broken gstreamer players (Banshee) reports always 0
                // when the track is seeked so we set the position at the
                // value we set on the slider
                this._setPosition(this._wantedSeekValue);
            }
            // Seek value send by the player
            else
                this._setPosition(value);

            this._wantedSeekValue = 0;
        }));

        this.emit('init-done');
    },

    populate: function() {
        this._getVolume();
        this._getIdentity();
        this._getDesktopEntry();
        this._getMetadata();
        // FIXME
        // Hack to avoid the trackBox.box.get_stage() == null
        Mainloop.timeout_add(300, Lang.bind(this, this._getStatus));
        this._getPosition();
        if (this.showPlaylists) {
            this._getPlaylists();
            this._getActivePlaylist();
        }
        this._updateSliders();
    },

    toString: function() {
        return "[object Player(%s,%s)]".format(this._identity, this._status);
    },

    _getIdentity: function() {
        if (this._mediaServer.Identity) {
            this._identity = this._mediaServer.Identity;
            this._setIdentity();
        }
    },

    _getDesktopEntry: function() {
        let entry = this._mediaServer.DesktopEntry;
        let appSys = Shell.AppSystem.get_default();
        this._app = appSys.lookup_app(entry+".desktop");
        if (this._app) {
            let icon = this._app.create_icon_texture(16);
            this.playerTitle.setIcon(icon);
        }
    },

    _setActivePlaylist: function(playlist) {
        // Is there an active playlist ?
        if (playlist && playlist[0]) {
            this._currentPlaylist = playlist[1][0];
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

    _setIdentity: function() {
        if (this._status)
            this.playerTitle.setLabel(this._identity + " - " + _(this._status));
        else
            this.playerTitle.setLabel(this._identity);
    },

    _setPosition: function(value) {
        // Player does not have a position property
        if (value == null && this._status != Settings.Status.STOP) {
            this._updateSliders(false);
        }
        else {
            this._currentTime = value / 1000000;
            this._updateTimer();
        }
    },

    _getPosition: function() {
        this._setPosition(this._mediaServerPlayer.Position);
    },

    _setMetadata: function(metadata) {
        // Pragha sends a metadata dict with one
        // value on stop
        if (metadata != null && Object.keys(metadata).length > 1) {
            // Check if the track has changed
            let trackChanged = true;
            // Check if the URL has changed
            if (metadata["xesam:url"] && metadata["xesam:url"].unpack() == this.trackUrl)
                trackChanged = false;
            // Reset the timer only when the track has changed
            if (trackChanged) {
                this._currentTime = -1;
                if (metadata["mpris:length"])
                    this._songLength = metadata["mpris:length"].unpack() / 1000000;
                else
                    this._songLength = 0;
                if (Settings.SEND_STOP_ON_CHANGE.indexOf(this.busName) != -1) {
                    // Some players send a "PlaybackStatus: Stopped" signal when changing
                    // tracks, so wait a little before refreshing sliders.
                    Mainloop.timeout_add_seconds(1, Lang.bind(this, this._updateSliders));
                } else {
                    this._updateSliders();
                }
                // Check if the current track can be paused
                this._updateControls();
            }

            if (metadata["xesam:artist"])
                this.trackArtist.setText(metadata["xesam:artist"].deep_unpack());
            else
                this.trackArtist.setText(_("Unknown Artist"));
            if (metadata["xesam:album"])
                this.trackAlbum.setText(metadata["xesam:album"].unpack());
            else
                this.trackAlbum.setText(_("Unknown Album"));
            if (metadata["xesam:title"])
                this.trackTitle.setText(metadata["xesam:title"].unpack());
            else
                this.trackTitle.setText(_("Unknown Title"));

            if (metadata["xesam:url"])
                this.trackUrl = metadata["xesam:url"].unpack();
            else
                this.trackUrl = false;

            if (metadata["mpris:trackid"])
                this.trackObj = metadata["mpris:trackid"].unpack();

            if (this.showRating) {
                let rating = 0;
                if (metadata["xesam:userRating"])
                    rating = (metadata["xesam:userRating"].deep_unpack() * 5);
                // Clementine
                if (metadata["rating"])
                    rating = metadata["rating"].deep_unpack();
                this.trackRating.setRating(parseInt(rating));
                this.trackRating.showRating(parseInt(rating));
            }

            let change = false;
            if (metadata["mpris:artUrl"]) {
                if (this.trackCoverFile != metadata["mpris:artUrl"].unpack()) {
                    this.trackCoverFile = metadata["mpris:artUrl"].unpack();
                    change = true;
                }
            }
            else {
                if (this.trackCoverFile != false) {
                    this.trackCoverFile = false;
                    change = true;
                }
            }

            if (change) {
                if (this.trackCoverFile) {
                    let cover_path = "";
                    // Distant cover
                    if (this.trackCoverFile.match(/^http/)) {
                        // hide current cover
                        this._hideCover();
                        // Copy the cover to a tmp local file
                        let cover = Gio.file_new_for_uri(decodeURIComponent(this.trackCoverFile));
                        // Don't create multiple tmp files
                        if (!this.trackCoverFileTmp)
                            this.trackCoverFileTmp = Gio.file_new_tmp('XXXXXX.mediaplayer-cover')[0];
                        // asynchronous copy
                        cover.read_async(null, null, Lang.bind(this, this._onReadCover));
                    }
                    // Local cover
                    else if (this.trackCoverFile.match(/^file/)) {
                        this.trackCoverPath = decodeURIComponent(this.trackCoverFile.substr(7));
                        this._showCover();
                    }
                }
                else {
                    this.trackCoverPath = false;
                    this._showCover();
                }
            }

            this.emit('player-metadata-changed');
        }
    },

    _onReadCover: function(cover, result) {
        let inStream = cover.read_finish(result);
        let outStream = this.trackCoverFileTmp.replace(null, false, Gio.FileCreateFlags.REPLACE_DESTINATION, null, null);
        outStream.splice_async(inStream, Gio.OutputStreamSpliceFlags.CLOSE_TARGET, 0, null, Lang.bind(this, this._onSavedCover));
    },

    _onSavedCover: function(outStream, result) {
        outStream.splice_finish(result, null);
        this.trackCoverPath = this.trackCoverFileTmp.get_path();
        this._showCover();
    },

    _hideCover: function() {
        Tweener.addTween(this.trackCoverContainer, { opacity: 0,
            time: 0.3,
            transition: 'easeOutCubic',
        });
    },

    _showCover: function() {
        this.emit('player-cover-changed');
        Tweener.addTween(this.trackCoverContainer, { opacity: 0,
            time: 0.3,
            transition: 'easeOutCubic',
            onComplete: Lang.bind(this, function() {
                // Change cover
                if (! this.trackCoverPath || ! GLib.file_test(this.trackCoverPath, GLib.FileTest.EXISTS)) {
                    this.trackCover = new St.Icon({icon_name: "media-optical-cd-audio", icon_size: this.coverSize});
                }
                else {
                    this.trackCover = new St.Bin({style_class: 'track-cover'});
                    let coverTexture = new Clutter.Texture({filter_quality: 2, filename: this.trackCoverPath});
                    let [coverWidth, coverHeight] = coverTexture.get_base_size();
                    this.trackCover.width = this.coverSize;
                    this.trackCover.height = coverHeight / (coverWidth / this.coverSize);
                    this.trackCover.set_child(coverTexture);
                }
                this.trackCoverContainer.set_child(this.trackCover);
                // Show the new cover
                Tweener.addTween(this.trackCoverContainer, { opacity: 255,
                    time: 0.3,
                    transition: 'easeInCubic',
                    onComplete: this.emit('player-cover-changed')
                });
            })
        });
    },

    _toggleCover: function() {
        if (this.trackCover.has_style_class_name('track-cover')) {
            let factor = 2;
            let [coverWidth, coverHeight] = this.trackCover.get_size();
            if (coverWidth > this.coverSize)
                factor = 0.5;
            Tweener.addTween(this.trackCover, { height: coverHeight * factor, width: coverWidth * factor,
                time: 0.3,
                transition: 'easeInCubic'
            });
        }
    },

    _getMetadata: function() {
        this._setMetadata(this._mediaServerPlayer.Metadata);
    },

    _setVolume: function(value) {
        // Player does not have a volume property
        if (value == null)
            this.showVolume = false;

        if (this.showVolume) {
            if (value == 0)
                this._volume.setIcon("audio-volume-muted-symbolic");
            if (value > 0)
                this._volume.setIcon("audio-volume-low-symbolic");
            if (value > 0.30)
                this._volume.setIcon("audio-volume-medium-symbolic");
            if (value > 0.80)
                this._volume.setIcon("audio-volume-high-symbolic");
            this._volume.setValue(value);
        }
    },

    _getVolume: function() {
        this._setVolume(this._mediaServerPlayer.Volume);
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
            } else {
                this._refreshStatus();
            }
        }
    },

    _refreshStatus: function() {
        this._updateSliders();
        this._updateControls();
        this._setIdentity();
        if (this._status != Settings.Status.STOP) {
            this.emit('player-cover-changed');
            if (this.trackBox.box.get_stage() && this.trackBox.box.opacity == 0) {
                this.trackBox.box.show();
                this.trackBox.box.set_height(-1);
                let [minHeight, naturalHeight] = this.trackBox.box.get_preferred_height(-1);
                this.trackBox.box.opacity = 0;
                this.trackBox.box.set_height(0);
                Tweener.addTween(this.trackBox.box,
                    { opacity: 255,
                      height: naturalHeight,
                      time: Settings.FADE_ANIMATION_TIME,
                      transition: 'easeOutQuad',
                      onComplete: function() {
                           this.trackBox.box.set_height(-1);
                      },
                      onCompleteScope: this
                    });
            }
        }
        else {
            if (this.trackBox.box.get_stage() && this.trackBox.box.opacity == 255) {
                Tweener.addTween(this.trackBox.box,
                    { opacity: 0,
                      height: 0,
                      time: Settings.FADE_ANIMATION_TIME,
                      transition: 'easeOutQuad',
                      onComplete: function() {
                           this.trackBox.box.hide();
                      },
                      onCompleteScope: this
                    });
            }
        }
        this.emit('player-status-changed');
    },

    _updateSliders: function(position) {
        this._prop.GetRemote('org.mpris.MediaPlayer2.Player', 'CanSeek',
            Lang.bind(this, function(value, err) {
                this._canSeek = true;
                if (!err)
                    this._canSeek = value[0].unpack();
                if (this._songLength == 0 || position == false)
                    this._canSeek = false

                if (this._status != Settings.Status.STOP && this._canSeek && this.showPosition)
                    this._position.actor.show();
                else
                    this._position.actor.hide();

                if (this._status != Settings.Status.STOP && this.showVolume)
                    this._volume.actor.show();
                else
                    this._volume.actor.hide();
            })
        );
    },

    _updateControls: function() {
        // called for each song change and status change
        this._prop.GetRemote('org.mpris.MediaPlayer2.Player', 'CanPause',
            Lang.bind(this, function(value, err) {
                // assume the player can pause by default
                let canPause = true;
                if (!err)
                    canPause = value[0].unpack();

                if (canPause) {
                    this._playButton.setCallback(Lang.bind(this, function() {
                        this._mediaServerPlayer.PlayPauseRemote();
                    }));
                }
                else {
                    this._playButton.setCallback(Lang.bind(this, function() {
                        this._mediaServerPlayer.PlayRemote();
                    }));
                }

                if (this._status == Settings.Status.PLAY) {
                    this._stopButton.show();
                    if (canPause)
                        this._playButton.setIcon("media-playback-pause");
                    else
                        this._playButton.hide();
                }

                if (this._status == Settings.Status.PAUSE)
                    this._playButton.setIcon("media-playback-start");

                if (this._status == Settings.Status.STOP) {
                    this._stopButton.hide();
                    this._playButton.show();
                    this._playButton.setIcon("media-playback-start");
                }
            })
        );
        this._prop.GetRemote('org.mpris.MediaPlayer2.Player', 'CanGoNext',
            Lang.bind(this, function(value, err) {
                // assume the player can go next by default
                let canGoNext = true;
                if (!err)
                    canGoNext = value[0].unpack();

                if (canGoNext)
                    this._nextButton.enable();
                else
                    this._nextButton.disable();
            })
        );
        this._prop.GetRemote('org.mpris.MediaPlayer2.Player', 'CanGoPrevious',
            Lang.bind(this, function(value, err) {
                // assume the player can go previous by default
                let canGoPrevious = true;
                if (!err)
                    canGoPrevious = value[0].unpack();

                if (canGoPrevious)
                    this._prevButton.enable();
                else
                    this._prevButton.disable();
            })
        );
    },

    _getStatus: function() {
        this._setStatus(this._mediaServerPlayer.PlaybackStatus);
    },

    _updateTimer: function() {
        if (this.showPosition && this._canSeek) {
            if (!isNaN(this._currentTime) && !isNaN(this._songLength) && this._currentTime > 0)
                this._position.setValue(this._currentTime / this._songLength);
            else
                this._position.setValue(0);
            this._position.setLabel(this._formatTime(this._currentTime) + " / " + this._formatTime(this._songLength));
        }
    },

    _startTimer: function() {
        if (this._status == Settings.Status.PLAY) {
            this._timeoutId = Mainloop.timeout_add_seconds(1, Lang.bind(this, this._startTimer));
            this._currentTime += 1;
            this._updateTimer();
        }
    },

    _pauseTimer: function() {
        if (this._timeoutId != 0) {
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
        if (this._propChangedId)
            this._prop.disconnectSignal(this._propChangedId);
        if (this._seekedId)
            this._mediaServerPlayer.disconnectSignal(this._seekedId);
        for (let id in this._signalsId)
            this._settings.disconnect(this._signalsId[id]);
        this.parent();
    }
});
