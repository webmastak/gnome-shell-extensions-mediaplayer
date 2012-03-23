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
const DBus = imports.dbus;
const Lang = imports.lang;
const Clutter = imports.gi.Clutter;
const Shell = imports.gi.Shell;
const St = imports.gi.St;
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const GLib = imports.gi.GLib;
const Tweener = imports.ui.tweener;

const Gettext = imports.gettext.domain('gnome-shell-extensions-mediaplayer');
const _ = Gettext.gettext;

const MEDIAPLAYER_SETTINGS_SCHEMA = 'org.gnome.shell.extensions.mediaplayer';
const MEDIAPLAYER_VOLUME_MENU_KEY = 'volumemenu';
const MEDIAPLAYER_VOLUME_KEY = 'volume';
const MEDIAPLAYER_POSITION_KEY = 'position';
const MEDIAPLAYER_PLAYLISTS_KEY = 'playlists';
const MEDIAPLAYER_COVER_SIZE = 'coversize';

const FADE_ANIMATION_TIME = 0.16;

const Me = imports.misc.extensionUtils.getCurrentExtension();
const Widget = Me.imports.widget;
const DBusIface = Me.imports.dbus;
const Lib = Me.imports.lib;

const Status = {
    STOP: "Stopped",
    PLAY: "Playing",
    PAUSE: "Paused"
};

/* global values */
let metadata = Me.metadata;
let settings;
let playerManager;
let mediaplayerMenu;
/* dummy vars for translation */
let x = _(Status.PLAY);
x = _(Status.PAUSE);
x = _(Status.STOP);


const Player = new Lang.Class({
    Name: 'Player',
    Extends: PopupMenu.PopupMenuSection,

    _init: function(owner) {
        this.parent();

        this._owner = owner;
        this._app = "";
        this._status = "";
        // Guess the name based on the dbus path
        // Should be overriden by the Identity property
        this._identity = this._owner.split('.')[3].charAt(0).toUpperCase() + this._owner.split('.')[3].slice(1);
        this._playlists = "";
        this._playlistsMenu = "";
        this._currentPlaylist = "";
        this._currentTime = -1;
        this._timeoutId = 0;
        this._mediaServer = new DBusIface.MediaServer2(owner);
        this._mediaServerPlayer = new DBusIface.MediaServer2Player(owner);
        this._mediaServerPlaylists = new DBusIface.MediaServer2Playlists(owner);
        this._prop = new DBusIface.Properties(owner);
        this._settings = settings;

        this.showVolume = this._settings.get_boolean(MEDIAPLAYER_VOLUME_KEY);
        this._settings.connect("changed::" + MEDIAPLAYER_VOLUME_KEY, Lang.bind(this, function() {
            if (this._settings.get_boolean(MEDIAPLAYER_VOLUME_KEY)) {
                this.showVolume = true;
                if (this._status != Status.STOP)
                    this._volume.actor.show();
            }
            else {
                this.showVolume = false;
                this._volume.actor.hide();
            }
        }));
        this.showPosition = this._settings.get_boolean(MEDIAPLAYER_POSITION_KEY);
        this.supportPosition = true;
        this._settings.connect("changed::" + MEDIAPLAYER_POSITION_KEY, Lang.bind(this, function() {
            if (this._settings.get_boolean(MEDIAPLAYER_POSITION_KEY)) {
                this.showPosition = true;
                if (this._status != Status.STOP && this.supportPosition)
                    this._position.actor.show();
            }
            else {
                this.showPosition = false;
                this._position.actor.hide();
            }
        }));
        this.showPlaylists = this._settings.get_boolean(MEDIAPLAYER_PLAYLISTS_KEY);
        this._settings.connect("changed::" + MEDIAPLAYER_PLAYLISTS_KEY, Lang.bind(this, function() {
            if (this._settings.get_boolean(MEDIAPLAYER_PLAYLISTS_KEY)) {
                this.showPlaylists = true;
                this._getPlaylists();
                this._getActivePlaylist();
            }
            else {
                this.showPlaylists = false;
                if (this._playlistsMenu)
                    this._playlistsMenu.destroy();
            }
        }));
        this.coverSize = this._settings.get_int(MEDIAPLAYER_COVER_SIZE);
        this._settings.connect("changed::" + MEDIAPLAYER_COVER_SIZE, Lang.bind(this, function() {
            this.coverSize = this._settings.get_int(MEDIAPLAYER_COVER_SIZE);
        }));

        let genericIcon = new St.Icon({icon_name: "audio-x-generic", icon_size: 16, icon_type: St.IconType.SYMBOLIC});
        this.playerTitle = new Widget.TitleItem(this._identity, genericIcon, Lang.bind(this, function() { this._mediaServer.QuitRemote(); }));

        this.addMenuItem(this.playerTitle);

        this.trackCoverContainer = new St.Button({style_class: 'track-cover-container', x_align: St.Align.START, y_align: St.Align.START});
        this.trackCoverContainer.connect('clicked', Lang.bind(this, this._toggleCover));
        this.trackCoverFile = false;
        this.trackCover = new St.Icon({icon_name: "media-optical-cd-audio", icon_size: this.coverSize, icon_type: St.IconType.FULLCOLOR});
        this.trackCoverContainer.set_child(this.trackCover);

        this.trackTitle = new Widget.TrackTitle(null, _('Unknown Title'), 'track-title');
        this.trackArtist = new Widget.TrackTitle(_("by"), _('Unknown Artist'), 'track-artist');
        this.trackAlbum = new Widget.TrackTitle(_("from"), _('Unknown Album'), 'track-album');

        this.trackBox = new Widget.TrackBox(this.trackCoverContainer);
        this.trackBox._infos.add(this.trackTitle.box, {row: 0, col: 1, y_expand: false});
        this.trackBox._infos.add(this.trackArtist.box, {row: 1, col: 1, y_expand: false});
        this.trackBox._infos.add(this.trackAlbum.box, {row: 2, col: 1, y_expand: false});

        this.addMenuItem(this.trackBox);

        this.trackBox.box.hide();
        this.trackBox.box.opacity = 0;
        this.trackBox.box.set_height(0);

        this._prevButton = new Widget.ControlButton('media-skip-backward',
            Lang.bind(this, function () { this._mediaServerPlayer.PreviousRemote(); }));
        this._playButton = new Widget.ControlButton('media-playback-start',
            Lang.bind(this, function () { this._mediaServerPlayer.PlayPauseRemote(); }));
        this._stopButton = new Widget.ControlButton('media-playback-stop',
            Lang.bind(this, function () { this._mediaServerPlayer.StopRemote(); }));
        this._stopButton.hide();
        this._nextButton = new Widget.ControlButton('media-skip-forward',
            Lang.bind(this, function () { this._mediaServerPlayer.NextRemote(); }));

        this.trackControls = new Widget.ControlButtons();
        this.trackControls.addButton(this._prevButton.actor);
        this.trackControls.addButton(this._playButton.actor);
        this.trackControls.addButton(this._stopButton.actor);
        this.trackControls.addButton(this._nextButton.actor);

        this.addMenuItem(this.trackControls);

        this._position = new Widget.SliderItem("0:00 / 0:00", "document-open-recent", 0);
        this._position.connect('value-changed', Lang.bind(this, function(item) {
            let time = item._value * this._songLength;
            this._position.setLabel(this._formatTime(time) + " / " + this._formatTime(this._songLength));
            this._mediaServerPlayer.SetPositionRemote(this.trackObj, time * 1000000);
        }));
        this.addMenuItem(this._position);
        this._position.actor.hide();

        this._volume = new Widget.SliderItem(_("Volume"), "audio-volume-high", 0);
        this._volume.connect('value-changed', Lang.bind(this, function(item) {
            this._mediaServerPlayer.Volume = item._value;
        }));
        this.addMenuItem(this._volume);
        this._volume.actor.hide();

        this._getVolume();
        this._getIdentity();
        this._getDesktopEntry();
        this._getMetadata();
        this._getStatus();
        this._getPosition();
        if (this.showPlaylists) {
            this._getPlaylists();
            this._getActivePlaylist();
        }

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
                    mediaplayerMenu.menu.close();
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

        this._prop.connectSignal('PropertiesChanged', Lang.bind(this, function(proxy, sender, [iface, props]) {
            if (props.Volume)
                this._setVolume(props.Volume.unpack());
            if (props.PlaybackStatus)
                this._setStatus(props.PlaybackStatus.unpack());
            if (props.Metadata)
                this._setMetadata(props.Metadata.deep_unpack());
            if (props.ActivePlaylist)
                this._setActivePlaylist(props.ActivePlaylist.deep_unpack());
        }));

        this._mediaServerPlayer.connectSignal('Seeked', Lang.bind(this, function(proxy, sender, [value]) {
            this._setPosition(value);
        }));
    },

    _getIdentity: function() {
        this._identity = this._mediaServer.Identity;
        this._setIdentity();
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
        if (value == null && this._status != Status.STOP) {
            this.supportPosition = false;
            this._position.actor.hide();
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
            this._currentTime = -1;
            if (metadata["mpris:length"]) {
                this._songLength = metadata["mpris:length"].unpack() / 1000000;
                this.supportPosition = true;
                if (this.showPosition && this._status != Status.STOP)
                    this._position.actor.show();
            }
            else {
                this._songLength = 0;
                this.supportPosition = false;
                this._position.actor.hide();
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

            if (metadata["mpris:trackid"]) {
                this.trackObj = metadata["mpris:trackid"].unpack();
            }

            let animate = false;
            if (metadata["mpris:artUrl"]) {
                if (this.trackCoverFile != metadata["mpris:artUrl"].unpack()) {
                    this.trackCoverFile = metadata["mpris:artUrl"].unpack();
                    animate = true;
                }
            }
            else {
                if (this.trackCoverFile != false) {
                    this.trackCoverFile = false;
                    animate = true;
                }
            }

            if (animate) {
                // Hide the old cover
                Tweener.addTween(this.trackCoverContainer, { opacity: 0,
                    time: 0.3,
                    transition: 'easeOutCubic',
                    onComplete: Lang.bind(this, function() {
                        // Change cover
                        if (this.trackCoverFile) {
                            let cover = decodeURIComponent(this.trackCoverFile.substr(7));
                            if (! GLib.file_test(cover, GLib.FileTest.EXISTS)) {
                                this.trackCover = new St.Icon({icon_name: "media-optical-cd-audio", icon_size: this.coverSize, icon_type: St.IconType.FULLCOLOR});
                            }
                            else {
                                this.trackCover = new St.Bin({style_class: 'track-cover'});
                                cover = new Clutter.Texture({filter_quality: 2, filename: cover});
                                let [coverWidth, coverHeight] = cover.get_base_size();
                                this.trackCover.width = this.coverSize;
                                this.trackCover.height = coverHeight / (coverWidth / this.coverSize);
                                this.trackCover.set_child(cover);
                            }
                        }
                        else {
                            this.trackCover = new St.Icon({icon_name: "media-optical-cd-audio", icon_size: this.coverSize, icon_type: St.IconType.FULLCOLOR});
                        }
                        this.trackCoverContainer.set_child(this.trackCover);
                        // Show the new cover
                        Tweener.addTween(this.trackCoverContainer, { opacity: 255,
                            time: 0.3,
                            transition: 'easeInCubic'
                        });
                    })
                });
            }
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
                this._volume.setIcon("audio-volume-muted");
            if (value > 0)
                this._volume.setIcon("audio-volume-low");
            if (value > 0.30)
                this._volume.setIcon("audio-volume-medium");
            if (value > 0.80)
                this._volume.setIcon("audio-volume-high");
            this._volume.setValue(value);
        }
    },

    _getVolume: function() {
        this._setVolume(this._mediaServerPlayer.Volume);
    },

    _setStatus: function(status) {
        if (status != this._status) {
            this._status = status;
            if (this._status == Status.PLAY) {
                this._playButton.setIcon("media-playback-pause");
                this._startTimer();
            }
            else if (this._status == Status.PAUSE) {
                this._playButton.setIcon("media-playback-start");
                this._pauseTimer();
            }
            else if (this._status == Status.STOP) {
                this._playButton.setIcon("media-playback-start");
                this._stopTimer();
            }

            // Wait a little before changing the state
            // Some players are sending the stopped signal
            // when changing tracks
            Mainloop.timeout_add(1000, Lang.bind(this, this._refreshStatus));
        }
    },

    _refreshStatus: function() {
        if (this._status != Status.STOP) {
            if (this.trackBox.box.get_stage() && this.trackBox.box.opacity == 0) {
                this.trackBox.box.show();
                this.trackBox.box.set_height(-1);
                let [minHeight, naturalHeight] = this.trackBox.box.get_preferred_height(-1);
                this.trackBox.box.opacity = 0;
                this.trackBox.box.set_height(0);
                Tweener.addTween(this.trackBox.box,
                    { opacity: 255,
                      height: naturalHeight,
                      time: FADE_ANIMATION_TIME,
                      transition: 'easeOutQuad',
                      onComplete: function() {
                           this.trackBox.box.set_height(-1);
                      },
                      onCompleteScope: this
                    });
            }
            this._stopButton.show();
            if (this.showVolume)
                this._volume.actor.show();
            if (this.showPosition && this.supportPosition)
                this._position.actor.show();
        }
        else {
            if (this.trackBox.box.get_stage() && this.trackBox.box.opacity == 255) {
                Tweener.addTween(this.trackBox.box,
                    { opacity: 0,
                      height: 0,
                      time: FADE_ANIMATION_TIME,
                      transition: 'easeOutQuad',
                      onComplete: function() {
                           this.trackBox.box.hide();
                      },
                      onCompleteScope: this
                    });
            }
            this._stopButton.hide();
            this._volume.actor.hide();
            this._position.actor.hide();
        }
        this._setIdentity();
        this.emit('status-changed');
    },

    _getStatus: function() {
        this._setStatus(this._mediaServerPlayer.PlaybackStatus);
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

    _updateTimer: function() {
        if (this.showPosition && this.supportPosition) {
            if (!isNaN(this._currentTime) && !isNaN(this._songLength) && this._currentTime > 0)
                this._position.setValue(this._currentTime / this._songLength);
            else
                this._position.setValue(0);
            this._position.setLabel(this._formatTime(this._currentTime) + " / " + this._formatTime(this._songLength));
        }
    },

    _startTimer: function() {
        if (this._status == Status.PLAY) {
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
        PopupMenu.PopupMenuSection.prototype.destroy.call(this);
    }
});

const PlayerManager = new Lang.Class({
    Name: 'PlayerManager',

    _init: function(menu) {
        // the menu
        this.menu = menu;
        // players list
        this._players = {};
        // watch list
        this._watch = [];
        // hide the menu by default
        if (!settings.get_boolean(MEDIAPLAYER_VOLUME_MENU_KEY))
           this.menu.actor.hide();
        // watch players
        for (var p=0; p<metadata.players.length; p++) {
            this._watch.push(Gio.DBus.session.watch_name('org.mpris.MediaPlayer2.'+metadata.players[p],
                Gio.BusNameWatcherFlags.NONE,
                Lang.bind(this, this._addPlayer),
                Lang.bind(this, this._removePlayer)
            ));
        }
    },

    _addPlayer: function(conn, owner) {
        let position;
        this._players[owner] = {player: new Player(owner)};
        this._players[owner].player.connect('status-changed', Lang.bind(this, this._statusChanged));
        if (settings.get_boolean(MEDIAPLAYER_VOLUME_MENU_KEY))
            position = this.menu.menu.numMenuItems - 2;
        else
            position = 0;
        this.menu.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem(), position)
        this.menu.menu.addMenuItem(this._players[owner].player, position);
        this.menu.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem(), position)
        this.menu.actor.show();
    },

    _removePlayer: function(conn, owner) {
        if (this._players[owner]) {
            this._players[owner].player.destroy();
            delete this._players[owner];
            if (!settings.get_boolean(MEDIAPLAYER_VOLUME_MENU_KEY) && this._nbPlayers() == 0)
                this.menu.actor.hide();
        }
        this._refreshStatus();
    },

    _nbPlayers: function() {
        return Object.keys(this._players).length;
    },

    _statusChanged: function(player) {
        let owner = player._owner;
        let status = player._status;
        this._players[owner].status = status;
        this._refreshStatus();
    },

    _refreshStatus: function() {
        // Display current status in the top panel
        if (mediaplayerMenu instanceof MediaplayerStatusButton) {
            let globalStatus = false;
            for (let owner in this._players) {
                if (this._players[owner].status == Status.PLAY)
                    globalStatus = this._players[owner].status;
                if (this._players[owner].status == Status.PAUSE && !globalStatus)
                    globalStatus = this._players[owner].status;
            }
            if (!globalStatus)
                globalStatus = Status.STOP;
            mediaplayerMenu.setState(globalStatus);
        }
    },

    next: function() {
        // Ignore stopped or paused players
        for (let owner in this._players) {
            if (this._players[owner].status == Status.PLAY)
                this._players[owner].player._mediaServerPlayer.NextRemote();
        }
    },

    previous: function() {
        // Ignore stopped or paused players
        for (let owner in this._players) {
            if (this._players[owner].status == Status.PLAY)
                this._players[owner].player._mediaServerPlayer.PreviousRemote();
        }
    },

    playPause: function() {
        // Ignore stopped players
        for (let owner in this._players) {
            if (this._players[owner].status == Status.PLAY ||
                this._players[owner].status == Status.PAUSE)
                this._players[owner].player._mediaServerPlayer.PlayPauseRemote();
        }

    },

    destroy: function() {
        for (let w = 0; w<this._watch.length; w++) {
            Gio.DBus.session.unwatch_name(this._watch[w]);
        }
        for (let owner in this._players) {
            this._players[owner].player.destroy();
        }
    }
});

const MediaplayerStatusButton = new Lang.Class({
    Name: 'MediaplayerStatusButton',
    Extends: PanelMenu.Button,

    _init: function() {
        this.parent(0.0, "mediaplayer");

        this._iconBox = new St.BoxLayout();
        this._iconIndicator = new St.Icon({icon_name: 'audio-x-generic',
                                           style_class: 'system-status-icon'});
        this._iconState = new St.Icon({icon_name: 'view-refresh',
                                       style_class: 'status-icon'})
        this._iconStateBin = new St.Bin({child: this._iconState,
                                         y_align: St.Align.END});

        this._iconBox.add(this._iconIndicator);
        this._iconBox.add(this._iconStateBin);
        this.actor.add_actor(this._iconBox);
        this.actor.add_style_class_name('panel-status-button');
        this.actor.connect('scroll-event', Lang.bind(this, this._onScrollEvent));
    },

    _onScrollEvent: function(actor, event) {
        let direction = event.get_scroll_direction();

        if (direction == Clutter.ScrollDirection.DOWN)
            playerManager.previous();
        else if (direction == Clutter.ScrollDirection.UP)
            playerManager.next();
    },

    // Override PanelMenu.Button._onButtonPress
    _onButtonPress: function(actor, event) {
        let button = event.get_button();

        if (button == 2)
            playerManager.playPause();
        else {
            if (!this.menu)
                return;

            this.menu.toggle();
        }
    },

    setState: function(state) {
        if (state == Status.PLAY)
            this._iconState.icon_name = "media-playback-start";
        else if (state == Status.PAUSE)
            this._iconState.icon_name = "media-playback-pause";
        else if (state == Status.STOP)
            this._iconState.icon_name = "media-playback-stop";
    }
});

function init() {
    Lib.initTranslations(Me);
    settings = Lib.getSettings(Me);
}

function enable() {
    if (settings.get_boolean(MEDIAPLAYER_VOLUME_MENU_KEY)) {
        // wait for the volume menu
        while(Main.panel._statusArea['volume']) {
            mediaplayerMenu = Main.panel._statusArea['volume'];
            break;
        }
    }
    else {
        mediaplayerMenu = new MediaplayerStatusButton();
        Main.panel.addToStatusArea('mediaplayer', mediaplayerMenu);
    }
    playerManager = new PlayerManager(mediaplayerMenu);

    settings.connect("changed::" + MEDIAPLAYER_VOLUME_MENU_KEY, function() {
        disable();
        enable();
    });
}

function disable() {
    playerManager.destroy();
    if (mediaplayerMenu instanceof MediaplayerStatusButton)
        mediaplayerMenu.destroy();
}

