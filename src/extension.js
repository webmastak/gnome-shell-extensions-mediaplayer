/* -*- mode: js2; js2-basic-offset: 4; indent-tabs-mode: nil -*- */

const Clutter = imports.gi.Clutter;
const DBus = imports.dbus;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const Shell = imports.gi.Shell;
const Gvc = imports.gi.Gvc;
const Signals = imports.signals;
const St = imports.gi.St;

const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Util = imports.misc.util;

const Gettext = imports.gettext.domain('gnome-shell-extension-mediaplayer');
const _ = Gettext.gettext;

const VOLUME_ADJUSTMENT_STEP = 0.05; /* Volume adjustment step in % */
const VOLUME_NOTIFY_ID = 1;

const Main = imports.ui.main;
const Panel = imports.ui.panel;

const PropIFace = {
    name: 'org.freedesktop.DBus.Properties',
    signals: [{ name: 'PropertiesChanged',
                inSignature: 'a{sv}'}]
}

function Prop() {
    this._init();
}

Prop.prototype = {
    _init: function() {
        DBus.session.proxifyObject(this, 'org.mpris.MediaPlayer2.mpd', '/org/mpris/MediaPlayer2', this);
    }
}
DBus.proxifyPrototype(Prop.prototype, PropIFace)

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
              { name: 'Next',
                inSignature: '',
                outSignature: '' },
              { name: 'Previous',
                inSignature: '',
                outSignature: '' }],
    properties: [{ name: 'Metadata',
                   signature: 'a{sv}',
                   access: 'read'},
                 { name: 'Shuffle',
                   signature: 'b',
                   access: 'readwrite'},
                 { name: 'LoopStatus',
                   signature: 'b',
                   access: 'readwrite'},
                 { name: 'Volume',
                   signature: 'd',
                   access: 'readwrite'},
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
                   access: 'read'}],
    signals: [{ name: 'Seeked',
                inSignature: 'x' }]
};

function MediaServer2Player() {
    this._init();
}
MediaServer2Player.prototype = {
    _init: function() {
        DBus.session.proxifyObject(this, 'org.mpris.MediaPlayer2.mpd', '/org/mpris/MediaPlayer2', this);
    },


    getMetadata: function(callback) {
        this.GetRemote('Metadata', Lang.bind(this,
            function(metadata, ex) {
                if (!ex)
                    callback(this, metadata);
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
        this.SetRemote('Volume', value);
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

function Indicator() {
    this._init.apply(this, arguments);
}

Indicator.prototype = {
    __proto__: PanelMenu.SystemStatusButton.prototype,

    _init: function() {
        PanelMenu.SystemStatusButton.prototype._init.call(this, 'audio-x-generic', null);

        this._mediaServer = new MediaServer2Player();
        this._prop = new Prop();

        this._artist = new PopupMenu.PopupImageMenuItem(_("Unknown Artist"), "system-users", { reactive: false });
        this._album = new PopupMenu.PopupImageMenuItem(_("Unknown Album"), "media-optical", { reactive: false });
        this._title = new PopupMenu.PopupImageMenuItem(_("Unknown Title"), "audio-x-generic", { reactive: false });
        this.menu.addMenuItem(this._artist);
        this.menu.addMenuItem(this._album);
        this.menu.addMenuItem(this._title);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        this._prev = new PopupMenu.PopupImageMenuItem(_("Previous"), "media-skip-backward");
        this._prev.connect('activate', Lang.bind(this,
            function () {
                this._mediaServer.PreviousRemote();
                this._updateMetadata();
            }
        ));
        this._togglePlayback = new PopupMenu.PopupImageMenuItem(_("Toggle playback"), "media-playback-start");
        this._togglePlayback.connect('activate', Lang.bind(this,
            function () {
                this._mediaServer.PlayPauseRemote();
                this._updateMetadata();
            }
        ));
        this._next = new PopupMenu.PopupImageMenuItem(_("Next"), "media-skip-forward");
        this._next.connect('activate', Lang.bind(this,
            function () {
                this._mediaServer.NextRemote();
                this._updateMetadata();
            }
        ));
        this.menu.addMenuItem(this._prev);
        this.menu.addMenuItem(this._togglePlayback);
        this.menu.addMenuItem(this._next);

        this._shuffle = new PopupMenu.PopupSwitchMenuItem(_("Shuffle"), false);
        this._shuffle.connect('toggled', Lang.bind(this, function(item) {
            this._mediaServer.setShuffle(item.state);
            this._updateSwitches();
        }));
        this.menu.addMenuItem(this._shuffle);

        this._repeat = new PopupMenu.PopupSwitchMenuItem(_("Repeat"), false);
        this._repeat.connect('toggled', Lang.bind(this, function(item) {
            this._mediaServer.setRepeat(item.state);
            this._updateSwitches();
        }));
        this.menu.addMenuItem(this._repeat);

        this._volume_text = new PopupMenu.PopupImageMenuItem(_("Volume"), "audio-volume-high", { reactive: false });
        this._volume = new PopupMenu.PopupSliderMenuItem(0);
        this._volume.connect('value-changed', Lang.bind(this, function(item) {
            this._mediaServer.setVolume(item._value);
        }));
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this.menu.addMenuItem(this._volume_text);
        this.menu.addMenuItem(this._volume);

        this._updateMetadata();
        this._updateSwitches();
        this._updateButtons();
        this._updateVolume();
        this._prop.connect('PropertiesChanged', Lang.bind(this, function(arg) {
                this._updateMetadata();
                this._updateSwitches();
                this._updateButtons();
                this._updateVolume();
            }));
    },

    _updateMetadata: function() {
        this._mediaServer.getMetadata(Lang.bind(this,
            function(sender, metadata) {
                this._artist.label.set_text(metadata["xesam:artist"].toString());
                this._album.label.set_text(metadata["xesam:album"].toString());
                this._title.label.set_text(metadata["xesam:title"].toString());
            }));
    },

    _updateSwitches: function() {
        this._mediaServer.getShuffle(Lang.bind(this,
            function(sender, shuffle) {
                this._shuffle.setToggleState(shuffle);
            }
        ));
        this._mediaServer.getRepeat(Lang.bind(this,
            function(sender, repeat) {
                this._repeat.setToggleState(repeat);
            }
        ));
    },

    _updateVolume: function() {
        this._mediaServer.getVolume(Lang.bind(this,
        function(sender, volume) {
            global.log(this._volume_text);
        this._volume_text.setIcon = "audio-volume-low";
            if (volume > 0.30) {
            this._volume_text.setIcon = "audio-volume-medium";
        }
            if (volume > 0.70) {
            this._volume_text.setIcon = "audio-volume-high";
        }
            this._volume.setValue(volume);
        }
    ));
    },

    _updateButtons: function() {
        /*this._mediaServer.getCanGoNext(Lang.bind(this,
            function(sender, canGoNext) {
                this._next.
            }
        ));*/
    }
};

// Put your extension initialization code here
function main(metadata) {
    imports.gettext.bindtextdomain('gnome-shell-extension-mediaplayer', metadata.localedir);

    Panel.STANDARD_TRAY_ICON_ORDER.unshift('player');
    Panel.STANDARD_TRAY_ICON_SHELL_IMPLEMENTATION['player'] = Indicator;
}
