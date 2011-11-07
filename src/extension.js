/* -*- mode: js2; js2-basic-offset: 4; indent-tabs-mode: nil -*- */

const Mainloop = imports.mainloop;
const Gio = imports.gi.Gio;
const DBus = imports.dbus;
const Lang = imports.lang;
const Clutter = imports.gi.Clutter;
const Shell = imports.gi.Shell;
const St = imports.gi.St;
const Main = imports.ui.main;
const Pango = imports.gi.Pango;
const Panel = imports.ui.panel;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const GLib = imports.gi.GLib;
const Tweener = imports.ui.tweener;

const Gettext = imports.gettext.domain('gnome-shell-extension-mediaplayer');
const _ = Gettext.gettext;

const MEDIAPLAYER_SETTINGS_SCHEMA = 'org.gnome.shell.extensions.mediaplayer';
const MEDIAPLAYER_VOLUME_MENU_KEY = 'volumemenu';
const MEDIAPLAYER_VOLUME_KEY = 'volume';
const MEDIAPLAYER_COVER_SIZE = 'coversize';

const FADE_ANIMATION_TIME = 0.16; 

const PropIFace = {
    name: 'org.freedesktop.DBus.Properties',
    signals: [{ name: 'PropertiesChanged',
                inSignature: 'a{sv}'}]
};

const MediaServer2IFace = {
    name: 'org.mpris.MediaPlayer2',
    methods: [{ name: 'Raise',
                inSignature: '',
                outSignature: '' },
              { name: 'Quit',
                inSignature: '',
                outSignature: '' }],
    properties: [{ name: 'CanRaise',
                   signature: 'b',
                   access: 'read'},
                 { name: 'CanQuit',
                   signature: 'b',
                   access: 'read'},
                 { name: 'Identity',
                   signature: 's',
                   access: 'read'},
                 { name: 'DesktopEntry',
                   signature: 's',
                   access: 'read'}],
};

const MediaServer2PlayerIFace = {
    name: 'org.mpris.MediaPlayer2.Player',
    methods: [{ name: 'PlayPause',
                inSignature: '',
                outSignature: '' },
              { name: 'Pause',
                inSignature: '',
                outSignature: '' },
              { name: 'Play',
                inSignature: '',
                outSignature: '' },
              { name: 'Stop',
                inSignature: '',
                outSignature: '' },
              { name: 'Next',
                inSignature: '',
                outSignature: '' },
              { name: 'Previous',
                inSignature: '',
                outSignature: '' },
              { name: 'SetPosition',
                inSignature: 'a{ov}',
                outSignature: '' }],
    properties: [{ name: 'Metadata',
                   signature: 'a{sv}',
                   access: 'read'},
                 { name: 'Shuffle',
                   signature: 'b',
                   access: 'readwrite'},
                 { name: 'Rate',
                   signature: 'd',
                   access: 'readwrite'},
                 { name: 'LoopStatus',
                   signature: 'b',
                   access: 'readwrite'},
                 { name: 'Volume',
                   signature: 'd',
                   access: 'readwrite'},
                 { name: 'PlaybackStatus',
                   signature: 's',
                   access: 'read'},
                 { name: 'Position',
                   signature: 'x',
                   access: 'read'},
                 { name: 'CanGoNext',
                   signature: 'b',
                   access: 'read'},
                 { name: 'CanGoPrevious',
                   signature: 'b',
                   access: 'read'},
                 { name: 'CanPlay',
                   signature: 'b',
                   access: 'read'},
                 { name: 'CanPause',
                   signature: 'b',
                   access: 'read'},
                 { name: 'CanSeek',
                   signature: 'b',
                   access: 'read'}],
    signals: [{ name: 'Seeked',
                inSignature: 'x' }]
};

/* global values */
let settings;
let compatible_players;
let support_seek;
let playerManager;
let mediaplayerMenu;
/* dummy vars for translation */
let x = _("Playing");
x = _("Paused");
x = _("Stopped");

function getSettings(schema) {
    if (Gio.Settings.list_schemas().indexOf(schema) == -1)
        throw _("Schema \"%s\" not found.").format(schema);
    return new Gio.Settings({ schema: schema });
}

function Prop() {
    this._init.apply(this, arguments);
}

Prop.prototype = {
    _init: function(owner) {
        DBus.session.proxifyObject(this, owner, '/org/mpris/MediaPlayer2', this);
    }
}
DBus.proxifyPrototype(Prop.prototype, PropIFace)

function MediaServer2() {
    this._init.apply(this, arguments);
}

MediaServer2.prototype = {
    _init: function(owner) {
        DBus.session.proxifyObject(this, owner, '/org/mpris/MediaPlayer2', this);
    },
    getIdentity: function(callback) {
        this.GetRemote('Identity', Lang.bind(this,
            function(identity, ex) {
                if (!ex)
                    callback(this, identity);
            }));
    },
    getDesktopEntry: function(callback) {
        this.GetRemote('DesktopEntry', Lang.bind(this,
            function(entry, ex) {
                if (!ex)
                    callback(this, entry);
            }));
    },
    getRaise: function(callback) {
        this.GetRemote('CanRaise', Lang.bind(this,
            function(raise, ex) {
                if (!ex)
                    callback(this, raise);
            }));
    }
}
DBus.proxifyPrototype(MediaServer2.prototype, MediaServer2IFace)

function MediaServer2Player() {
    this._init.apply(this, arguments);
}

MediaServer2Player.prototype = {
    _init: function(owner) {
        this._owner = owner;
        DBus.session.proxifyObject(this, owner, '/org/mpris/MediaPlayer2', this);
    },
    getMetadata: function(callback) {
        this.GetRemote('Metadata', Lang.bind(this,
            function(metadata, ex) {
                if (!ex)
                    callback(this, metadata);
            }));
    },
    getPlaybackStatus: function(callback) {
        this.GetRemote('PlaybackStatus', Lang.bind(this,
            function(status, ex) {
                if (!ex)
                    callback(this, status);
            }));
    },
    getPosition: function(callback) {
        this.GetRemote('Position', Lang.bind(this,
            function(position, ex) {
                if (!ex)
                    callback(this, position);
            }));
    },
    getShuffle: function(callback) {
        this.GetRemote('Shuffle', Lang.bind(this,
            function(shuffle, ex) {
                if (!ex)
                    callback(this, shuffle);
            }));
    },
    setShuffle: function(value) {
        this.SetRemote('Shuffle', value);
    },
    getVolume: function(callback) {
        this.GetRemote('Volume', Lang.bind(this,
            function(volume, ex) {
                if (!ex)
                    callback(this, volume);
            }));
    },
    setVolume: function(value) {
        this.SetRemote('Volume', parseFloat(value));
    },
    getRepeat: function(callback) {
        this.GetRemote('LoopStatus', Lang.bind(this,
            function(repeat, ex) {
                if (!ex) {
                    if (repeat == "None")
                        repeat = false
                    else
                        repeat = true
                    callback(this, repeat);
                }
            }));
    },
    setRepeat: function(value) {
        if (value)
            value = "Playlist"
        else
            value = "None"
        this.SetRemote('LoopStatus', value);
    }
}
DBus.proxifyPrototype(MediaServer2Player.prototype, MediaServer2PlayerIFace)

function ControlButton() {
    this._init.apply(this, arguments);
}

ControlButton.prototype = {
    _init: function(icon, callback) {
        this.actor = new St.Bin({style_class: 'button-container'});
        this.button = new St.Button({ style_class: 'notification-icon-button' });
        this.button.connect('clicked', callback);
        this.icon = new St.Icon({
            icon_type: St.IconType.SYMBOLIC,
            icon_name: icon,
            icon_size: 20
        });
        this.button.set_child(this.icon);
        this.actor.add_actor(this.button);

    },
    getActor: function() {
        return this.actor;
    },
    setIcon: function(icon) {
        this.icon.icon_name = icon;
    },
    hide: function() {
        this.actor.hide();
    },
    show: function() {
        this.actor.show();
    },
}

function TextImageMenuItem() {
    this._init.apply(this, arguments);
}

TextImageMenuItem.prototype = {
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,

    _init: function(text, icon, type, align, style) {
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this);
        this.actor = new St.BoxLayout({style_class: style});
        this.icon = new St.Icon({style_class: "menu-item-icon", icon_name: icon, icon_type: type});
        this.text = new St.Label({text: text});
        if (align === "left") {
            this.actor.add_actor(this.icon, { span: 0 });
            this.actor.add_actor(this.text, { span: -1 });
        }
        else {
            this.actor.add_actor(this.text, { span: 0 });
            this.actor.add_actor(this.icon, { span: -1 });
        }
    },
    setText: function(text) {
        this.text.text = text;
    },
    setIcon: function(icon) {
        this.icon.icon_name = icon;
    }
}

function TrackTitle() {
    this._init.apply(this, arguments);
}

TrackTitle.prototype = {
    _init: function(pattern, style) {
        this.label = new St.Label({style_class: style, text: ""});
        this.label.clutter_text.line_wrap = true;
        this.label.clutter_text.line_wrap_mode = Pango.WrapMode.WORD_CHAR;
        this.label.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;
        this.text = pattern;
    },

    format: function(values) {
        for (let i=0; i<values.length; i++) {
            values[i] = GLib.markup_escape_text(values[i].toString(), -1);
        }
        if (this.label.clutter_text)
            this.label.clutter_text.set_markup(this.text.format(values));
    }
}

function TextIconMenuItem() {
    this._init.apply(this, arguments);
}

TextIconMenuItem.prototype = {
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,

    _init: function(text, icon, align, style) {
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this);

        this.actor = new St.BoxLayout({style_class: style});
        this.icon = new St.Bin({style_class: "menu-item-icon", child: icon});
        this.text = new St.Label({text: text});
        if (align === "left") {
            this.actor.add_actor(this.icon, { span: 0 });
            this.actor.add_actor(this.text, { span: -1 });
        }
        else {
            this.actor.add_actor(this.text, { span: 0 });
            this.actor.add_actor(this.icon, { span: -1 });
        }
    },

    setText: function(text) {
        this.text.text = text;
    },

    setIcon: function(icon) {
        this.icon.set_child(icon);
    },
}

function Player() {
    this._init.apply(this, arguments);
}

Player.prototype = {
    __proto__: PopupMenu.PopupMenuSection.prototype,

    _init: function(owner) {
        PopupMenu.PopupMenuSection.prototype._init.call(this);

        this._owner = owner;
        this._name = this._owner.split('.')[3];
        this._identity = this._name.charAt(0).toUpperCase() + this._name.slice(1);
        this._mediaServerPlayer = new MediaServer2Player(owner);
        this._mediaServer = new MediaServer2(owner);
        this._prop = new Prop(owner);
        this._settings = settings;
        this._status = "";
        
        this.showVolume = this._settings.get_boolean(MEDIAPLAYER_VOLUME_KEY);
        this.coverSize = this._settings.get_int(MEDIAPLAYER_COVER_SIZE);

        let genericIcon = new St.Icon({icon_name: "audio-x-generic", icon_size: 16, icon_type: St.IconType.SYMBOLIC});
        this.playerTitle = new TextIconMenuItem(this._identity, genericIcon, "left", "player-title");
        this.addMenuItem(this.playerTitle);

        this.trackCoverContainer = new St.Button({style_class: 'track-cover-container', x_align: St.Align.START, y_align: St.Align.START});
        this.trackCoverContainer.connect('clicked', Lang.bind(this, this._toggleCover));
        this.trackCover = new St.Icon({icon_name: "media-optical-cd-audio", icon_size: this.coverSize, icon_type: St.IconType.FULLCOLOR});
        this.trackCoverContainer.set_child(this.trackCover);
        this._trackControls = new St.Bin({style_class: 'playback-control', x_align: St.Align.MIDDLE});

        this.trackBox = new St.BoxLayout({style_class: 'track-box'});
        this.trackBox.add_actor(this.trackCoverContainer);

        this.trackTitle = new TrackTitle('%s', 'track-title');
        this.trackTitle.format([_('Unknown Title')]);
        this.trackArtist = new TrackTitle('<span foreground="#ccc">' + _("by") +'</span> %s', 'track-artist');
        this.trackArtist.format([_('Unknown Artist')]);
        this.trackAlbum = new TrackTitle('<span foreground="#ccc">' + _("from") + '</span> %s', 'track-album');
        this.trackAlbum.format([_('Unknown Album')]);

        /*this._time = new TrackInfo("0:00 / 0:00", "document-open-recent");*/
        this.trackInfos = new St.Table({style_class: "track-infos"});
        this.trackInfos.add(this.trackTitle.label, {row: 0, col: 1, y_expand: false});
        this.trackInfos.add(this.trackArtist.label, {row: 1, col: 1, y_expand: false});
        this.trackInfos.add(this.trackAlbum.label, {row: 2, col: 1, y_expand: false});
        this.trackBox.add(this.trackInfos);

        this.addActor(this.trackBox);
                           
        this.trackBox.hide();
        this.trackBox.opacity = 0;
        this.trackBox.set_height(-1);

        this._prevButton = new ControlButton('media-skip-backward',
            Lang.bind(this, function () { this._mediaServerPlayer.PreviousRemote(); }));
        this._playButton = new ControlButton('media-playback-start',
            Lang.bind(this, function () { this._mediaServerPlayer.PlayPauseRemote(); }));
        this._stopButton = new ControlButton('media-playback-stop',
            Lang.bind(this, function () { this._mediaServerPlayer.StopRemote(); }));
        this._stopButton.hide();
        this._nextButton = new ControlButton('media-skip-forward',
            Lang.bind(this, function () { this._mediaServerPlayer.NextRemote(); }));

        this.controls = new St.BoxLayout();
        this.controls.add_actor(this._prevButton.getActor());
        this.controls.add_actor(this._playButton.getActor());
        this.controls.add_actor(this._stopButton.getActor());
        this.controls.add_actor(this._nextButton.getActor());
        this._trackControls.set_child(this.controls);
        this.addActor(this._trackControls);

        this._mediaServer.getRaise(Lang.bind(this, function(sender, raise) {
            if (raise) {
                this._raiseButton = new ControlButton('go-up',
                    Lang.bind(this, function () { 
                        this._mediaServer.RaiseRemote();
                        mediaplayerMenu.menu.close();
                    })
                );
                this.controls.add_actor(this._raiseButton.getActor());
            }
        }));

        if (this.showVolume) {
            this._volumeInfo = new TextImageMenuItem(_("Volume"), "audio-volume-high", St.IconType.SYMBOLIC, "right", "volume-menu-item");
            this._volume = new PopupMenu.PopupSliderMenuItem(0, {style_class: 'volume-slider'});
            this._volume.connect('value-changed', Lang.bind(this, function(item) {
                this._mediaServerPlayer.setVolume(item._value);
            }));
            this.addMenuItem(this._volumeInfo);
            this.addMenuItem(this._volume);
        }

        /*this._trackPosition = new PopupMenu.PopupSliderMenuItem(0, {style_class: 'position-slider'});
        this._trackPosition.connect('value-changed', Lang.bind(this, function(item) {
            this._mediaServerPlayer.SetPositionRemote(this._trackId, item._value * this._songLength);
        }));*/
        /*this.addMenuItem(this._trackPosition);*/

        this._getIdentity();
        this._getDesktopEntry();

        /* this players don't support seek */
        /*if (support_seek.indexOf(this._name) == -1)
            this._time.hide();*/
        this._getStatus();
        this._trackId = {};
        this._getMetadata();
        this._getVolume();
        this._currentTime = 0;
        this._getPosition();

        this._prop.connect('PropertiesChanged', Lang.bind(this, function(sender, iface, value) {
            if (value["Volume"])
                this._setVolume(iface, value["Volume"]);
            if (value["PlaybackStatus"])
                this._setStatus(iface, value["PlaybackStatus"]);
            if (value["Metadata"])
                this._setMetadata(iface, value["Metadata"]);
        }));

        this._mediaServerPlayer.connect('Seeked', Lang.bind(this, function(sender, value) {
            this._setPosition(sender, value);
        }));
    },

    _getIdentity: function() {
        this._mediaServer.getIdentity(Lang.bind(this,
            function(sender, identity) {
                this._identity = identity;
                this._setName();
            }));
    },

    _getDesktopEntry: function() {
        this._mediaServer.getDesktopEntry(Lang.bind(this,
            function(sender, entry) {
                let appSys = Shell.AppSystem.get_default();
                let app = appSys.lookup_app(entry+".desktop");
                if (app) {
                    let icon = app.create_icon_texture(16);
                    this.playerTitle.setIcon(icon);
                }
            }));
    },

    _setName: function() {
        if (this._status)
            this.playerTitle.setText(this._identity + " - " + _(this._status));
        else
            this.playerTitle.setText(this._identity);
    },

    _setPosition: function(sender, value) {
        this._stopTimer();
        this._currentTime = value / 1000000;
        if (this._status == "Playing")
            this._runTimer();
    },

    _getPosition: function() {
        this._mediaServerPlayer.getPosition(Lang.bind(this,
            this._setPosition
        ));
    },

    _setMetadata: function(sender, metadata) {
        // Pragha sends a metadata dict with one
        // value on stop
        if (Object.keys(metadata).length > 1) {
            if (metadata["mpris:length"]) {
                // song length in secs
                this._songLength = metadata["mpris:length"] / 1000000;
                // FIXME upstream
                if (this._name == "quodlibet")
                    this._songLength = metadata["mpris:length"] / 1000;
                // reset timer
                this._stopTimer();
                if (this._status == "Playing")
                    this._runTimer();
            }
            else {
                this._songLength = 0;
                this._stopTimer();
            }
            if (metadata["xesam:artist"])
                this.trackArtist.format([metadata["xesam:artist"].toString()]);
            else 
                this.trackArtist.format([_("Unknown Artist")]);
            if (metadata["xesam:album"])
                this.trackAlbum.format([metadata["xesam:album"].toString()]);
            else
                this.trackAlbum.format([_("Unknown Album")]);
            if (metadata["xesam:title"])
                this.trackTitle.format([metadata["xesam:title"].toString()]);
            else
                this.trackTitle.format([_("Unknown Title")]);

            /*if (metadata["mpris:trackid"]) {
                this._trackId = {
                    _init: function() {
                        DBus.session.proxifyObject(this, this._owner, metadata["mpris:trackid"]);
                    }
                }
            }*/

            // Hide the old cover
            Tweener.addTween(this.trackCoverContainer, { opacity: 0,
                time: 0.3,
                transition: 'easeOutCubic',
                onComplete: Lang.bind(this, function() {
                    // Change cover
                    if (metadata["mpris:artUrl"]) {
                        let cover = metadata["mpris:artUrl"].toString();
                        cover = decodeURIComponent(cover.substr(7));
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
                    else
                        this.trackCover = new St.Icon({icon_name: "media-optical-cd-audio", icon_size: this.coverSize, icon_type: St.IconType.FULLCOLOR});
                    this.trackCoverContainer.set_child(this.trackCover);
                    // Show the new cover
                    Tweener.addTween(this.trackCoverContainer, { opacity: 255,
                        time: 0.3,
                        transition: 'easeInCubic'
                    });
                })
            });
        }
    },

    _getMetadata: function() {
        this._mediaServerPlayer.getMetadata(Lang.bind(this,
            this._setMetadata
        ));
    },

    _setVolume: function(sender, value) {
        if (this.showVolume) {
            if (value === 0)
                this._volumeInfo.setIcon("audio-volume-muted");
            if (value > 0)
                this._volumeInfo.setIcon("audio-volume-low");
            if (value > 0.30)
                this._volumeInfo.setIcon("audio-volume-medium");
            if (value > 0.80)
                this._volumeInfo.setIcon("audio-volume-high");
            this._volume.setValue(value);
        }
    },

    _getVolume: function() {
        this._mediaServerPlayer.getVolume(Lang.bind(this,
            this._setVolume
        ));
    },

    _setStatus: function(sender, status) {
        if (status != this._status) {
            this._status = status;
            if (this._status == "Playing") {
                this._playButton.setIcon("media-playback-pause");
                this._runTimer();
            }
            else if (this._status == "Paused") {
                this._playButton.setIcon("media-playback-start");
                this._pauseTimer();
            }
            else if (this._status == "Stopped") {
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
        if (this._status == "Playing") {
            if (this.trackBox.opacity == 0) {
                this.trackBox.show();
                let [minHeight, naturalHeight] = this.trackBox.get_preferred_height(-1);
                this.trackBox.opacity = 0;
                this.trackBox.set_height(0);
                Tweener.addTween(this.trackBox,
                    { opacity: 255,
                      height: naturalHeight,
                      time: FADE_ANIMATION_TIME,
                      transition: 'easeOutQuad',
                      onComplete: function() {
                           this.trackBox.set_height(-1);
                      },
                      onCompleteScope: this
                    });
            }
            this._stopButton.show();
        }
        else if (this._status == "Stopped") {
            if (this.trackBox.opacity == 255) {
                Tweener.addTween(this.trackBox,
                    { opacity: 0,
                      height: 0,
                      time: FADE_ANIMATION_TIME,
                      transition: 'easeOutQuad',
                      onComplete: function() {
                           this.trackBox.hide();
                           this.trackBox.set_height(-1);
                      },
                      onCompleteScope: this
                    });
            }
            this._stopButton.hide();
        }
        this._setName();
    },

    _getStatus: function() {
        this._mediaServerPlayer.getPlaybackStatus(Lang.bind(this,
            this._setStatus
        ));
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
        /*this._time.setLabel(this._formatTime(this._currentTime) + " / " + this._formatTime(this._songLength));*/
        /*if (this._currentTime > 0)
            this._trackPosition.setValue(this._currentTime / this._songLength);
        else
            this._trackPosition.setValue(0);*/
    },

    _runTimer: function() {
        /*if (!Tweener.resumeTweens(this)) {
            Tweener.addTween(this,
                { _currentTime: this._songLength,
                  time: this._songLength - this._currentTime,
                  transition: 'linear',
                  onUpdate: Lang.bind(this, this._updateTimer) });
        }*/
    },

    _pauseTimer: function() {
        //Tweener.pauseTweens(this);
    },

    _stopTimer: function() {
        //Tweener.removeTweens(this);
        this._currentTime = 0;
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

}

function PlayerManager() {
    this._init.apply(this, arguments);
}

PlayerManager.prototype = {

    _init: function(menu) {
        // the menu
        this.menu = menu;
        // players list
        this._players = {};
        // hide the menu by default
        if (!settings.get_boolean(MEDIAPLAYER_VOLUME_MENU_KEY))
           this.menu.actor.hide();
        // watch players
        for (var p=0; p<compatible_players.length; p++) {
            DBus.session.watch_name('org.mpris.MediaPlayer2.'+compatible_players[p], false,
                Lang.bind(this, this._addPlayer),
                Lang.bind(this, this._removePlayer)
            );
        }
    },

    _addPlayer: function(owner) {
        let position;
        this._players[owner] = new Player(owner);
        if (settings.get_boolean(MEDIAPLAYER_VOLUME_MENU_KEY))
            position = this.menu.menu.numMenuItems - 2;
        else
            position = 0;
        this.menu.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem(), position)
        this.menu.menu.addMenuItem(this._players[owner], position);
        this.menu.actor.show();
    },

    _removePlayer: function(owner) {
        this._players[owner].destroy();
        delete this._players[owner];
        if (!settings.get_boolean(MEDIAPLAYER_VOLUME_MENU_KEY) && this._nbPlayers() == 0)
            this.menu.actor.hide();
    },

    _nbPlayers: function() {
        return Object.keys(this._players).length;
    },

    destroy: function() {
        for (owner in this._players) {
            this._players[owner].destroy();
        }
    }
}

function PlayerMenu() {
    this._init.apply(this, arguments);
}

PlayerMenu.prototype = {
    __proto__: PanelMenu.SystemStatusButton.prototype,

    _init: function() {
        PanelMenu.SystemStatusButton.prototype._init.call(this, 'audio-x-generic', null);
    }
}

function init(metadata) {
    imports.gettext.bindtextdomain('gnome-shell-extension-mediaplayer', metadata.locale);
    settings = getSettings(MEDIAPLAYER_SETTINGS_SCHEMA);
    compatible_players = metadata.players;
    support_seek = metadata.support_seek;
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
        mediaplayerMenu = new PlayerMenu();
        Main.panel.addToStatusArea('mediaplayer', mediaplayerMenu);
    }    
    playerManager = new PlayerManager(mediaplayerMenu);
}

function disable() {
    playerManager.destroy();
    if (!settings.get_boolean(MEDIAPLAYER_VOLUME_MENU_KEY)) {
        mediaplayerMenu.destroy();
    }
}

