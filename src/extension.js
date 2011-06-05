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

const Gettext = imports.gettext.domain('gnome-shell');
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
        DBus.session.proxifyObject(this, 'org.mpris.MediaPlayer2.rhythmbox', '/org/mpris/MediaPlayer2', this);
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
        DBus.session.proxifyObject(this, 'org.mpris.MediaPlayer2.rhythmbox', '/org/mpris/MediaPlayer2', this);
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
            function(metadata, ex) {
                if (!ex)
                    callback(this, metadata);
            }));
    },
    
    setShuffle: function(value) {
        this.SetRemote('Shuffle', value);
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
        
        this._artist = new PopupMenu.PopupImageMenuItem("Unknown Artist", "system-users", { reactive: false });
        this._album = new PopupMenu.PopupImageMenuItem("Unknown Album", "media-optical", { reactive: false });
        this._title = new PopupMenu.PopupImageMenuItem("Unknown Title", "audio-x-generic", { reactive: false });
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
        
        this._updateMetadata();
        this._updateSwitches();
        this._updateButtons();
        this._prop.connect('PropertiesChanged', Lang.bind(this, function(arg) {
                this._updateMetadata();
                this._updateSwitches();
                this._updateButtons();
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
    imports.gettext.bindtextdomain('gnome-shell-extensions', metadata.localedir);

    Panel.STANDARD_TRAY_ICON_ORDER.unshift('player');
    Panel.STANDARD_TRAY_ICON_SHELL_IMPLEMENTATION['player'] = Indicator;
}
