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

const Main = imports.ui.main;
const Panel = imports.ui.panel;

const PropIFace = {
    name: 'org.freedesktop.DBus.Properties',
    signals: [{ name: 'PropertiesChanged',
                inSignature: 'a{sv}'}]
}

let default_cover = "";

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
              { name: 'Stop',
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
                 { name: 'PlaybackStatus',
                   signature: 's',
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

    getPlaybackStatus: function(callback) {
        this.GetRemote('PlaybackStatus', Lang.bind(this,
            function(status, ex) {
                if (!ex)
                    callback(this, status);
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

function TrackInfo() {
    this._init.apply(this, arguments);
}

TrackInfo.prototype = {
    _init: function(label, icon) {
        this.actor = new St.BoxLayout({style_class: 'track-info'});
        this.label = new St.Label({text: label.toString(), style_class: 'track-info-text'});
        this.icon = new St.Icon({icon_name: icon.toString(), style_class: 'track-info-icon'});
        this.actor.add_actor(this.icon, { span: 0 });
        this.actor.add_actor(this.label, { span: -1 });
    },
    getActor: function() {
        return this.actor;
    },
    setLabel: function(label) {
        this.label.text = label;
    },
};

function Indicator() {
    this._init.apply(this, arguments);
}

Indicator.prototype = {
    __proto__: PanelMenu.SystemStatusButton.prototype,

    _init: function() {
        PanelMenu.SystemStatusButton.prototype._init.call(this, 'audio-x-generic', null);

        this._mediaServer = new MediaServer2Player();
        this._prop = new Prop();

        this._trackCover = new St.Bin({style_class: 'track-cover'})
        let coverImg = new Clutter.Texture(
            {
                keep_aspect_ratio: true,
                height: 100,
                filename: default_cover,
            }
        );
        this._trackCover.set_child(coverImg);
        this._trackInfos = new St.Bin({style_class: 'track-infos'});

        let mainBox = new St.BoxLayout({style_class: 'track-box'});
        mainBox.add_actor(this._trackCover);
        mainBox.add_actor(this._trackInfos);

        this.menu.addActor(mainBox);

        let infos = new St.BoxLayout({vertical: true});
        this._artist = new TrackInfo(_('Unknown Artist'), "system-users");
        this._album = new TrackInfo(_('Unknown Album'), "media-optical");
        this._title = new TrackInfo(_('Unknown Title'), "audio-x-generic");
        infos.add_actor(this._artist.getActor());
        infos.add_actor(this._album.getActor());
        infos.add_actor(this._title.getActor());

        let controls = new St.BoxLayout({style_class: 'playback-control'});
        infos.add_actor(controls);

        this._trackInfos.set_child(infos);

        /*this._openApp = new St.Button({ style_class: 'button' });
        this._openApp.connect('clicked', Lang.bind(this, this._loadPlayer));
        controlsBox.add_actor(this._openApp);*/

        this._mediaPrev = new St.Button({ style_class: 'button' });
        this._mediaPrev.connect('clicked', Lang.bind(this,
            function () {
                this._mediaServer.PreviousRemote();
            }
        ));
        controls.add_actor(this._mediaPrev);

        this._mediaPlay = new St.Button({ style_class: 'button' });
        this._mediaPlay.connect('clicked', Lang.bind(this,
                function () {
                    this._mediaServer.PlayPauseRemote();
                }
        ));
        controls.add_actor(this._mediaPlay);

        this._mediaStop = new St.Button({ style_class: 'button' });
        this._mediaStop.connect('clicked', Lang.bind(this,
                function () {
                    this._mediaServer.StopRemote();
                }
        ));
        controls.add_actor(this._mediaStop);

        this._mediaNext = new St.Button({ style_class: 'button' });
        this._mediaNext.connect('clicked', Lang.bind(this,
            function () {
                this._mediaServer.NextRemote();
            }
        ));
        controls.add_actor(this._mediaNext);

        /*let openAppI = new St.Icon({
            icon_type: St.IconType.SYMBOLIC,
            icon_name: 'media-eject'
        });
        this._openApp.set_child(openAppI);*/

        this._mediaPrevIcon = new St.Icon({
            icon_type: St.IconType.SYMBOLIC,
            icon_name: 'media-skip-backward',
            style_class: 'button-icon',
        });
        this._mediaPrev.set_child(this._mediaPrevIcon);

        this._mediaPlayIcon = new St.Icon({
            icon_type: St.IconType.SYMBOLIC,
            icon_name: 'media-playback-start',
            style_class: 'button-icon',
        });
        this._mediaPlay.set_child(this._mediaPlayIcon);

        this._mediaPauseIcon = new St.Icon({
            icon_type: St.IconType.SYMBOLIC,
            icon_name: 'media-playback-pause',
            style_class: 'button-icon',
        });

        this._mediaStopIcon = new St.Icon({
            icon_type: St.IconType.SYMBOLIC,
            icon_name: 'media-playback-stop',
            style_class: 'button-icon',
        });
        this._mediaStop.set_child(this._mediaStopIcon);

        this._mediaNextIcon = new St.Icon({
            icon_type: St.IconType.SYMBOLIC,
            icon_name: 'media-skip-forward',
            style_class: 'button-icon',
        });
        this._mediaNext.set_child(this._mediaNextIcon);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

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

        this._volumeText = new PopupMenu.PopupImageMenuItem(_("Volume"), "audio-volume-high", { reactive: false });
        this._volume = new PopupMenu.PopupSliderMenuItem(0);
        this._volume.connect('value-changed', Lang.bind(this, function(item) {
            this._mediaServer.setVolume(item._value);
        }));
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this.menu.addMenuItem(this._volumeText);
        this.menu.addMenuItem(this._volume);

        this._updateMetadata();
        this._updateSwitches();
        this._updateButtons();
        this._updateVolume();
        this._updateButtons();

        this._prop.connect('PropertiesChanged', Lang.bind(this, function(arg) {
            this._updateMetadata();
            this._updateSwitches();
            this._updateButtons();
            this._updateVolume();
            this._updateButtons();
        }));
    },

    _updateMetadata: function() {
        this._mediaServer.getMetadata(Lang.bind(this,
            function(sender, metadata) {
                if (metadata["xesam:artist"])
                    this._artist.setLabel(metadata["xesam:artist"].toString());
                else
                    this._artist.setLabel(_("Unknown Artist"));
                if (metadata["xesam:album"])
                    this._album.setLabel(metadata["xesam:album"].toString());
                else
                    this._album.setLabel(_("Unknown Album"));
                if (metadata["xesam:title"])
                    this._title.setLabel(metadata["xesam:title"].toString());
                else
                    this._title.setLabel(_("Unknown Title"));
	   
                let cover = "";
                if (metadata["mpris:artUrl"]) {
                    cover = metadata["mpris:artUrl"].toString();
                    cover = cover.substr(7);
                }
                else
                    cover = default_cover;

                let coverImg = new Clutter.Texture(
                    {
	        	        keep_aspect_ratio: true,
        	        	height: 100,
	                	filename: cover,
                    }
                );
	        	this._trackCover.set_child(coverImg);
            }
        ));
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
                this._volumeText.setIcon = "audio-volume-low";
                if (volume > 0.30) {
                    this._volumeText.setIcon = "audio-volume-medium";
                }
                if (volume > 0.70) {
                    this._volumeText.setIcon = "audio-volume-high";
                }
                this._volume.setValue(volume);
            }
        ));
    },

    _updateButtons: function() {
        this._mediaServer.getPlaybackStatus(Lang.bind(this,
            function(sender, status) {
                if (status == "Playing")
                    this._mediaPlay.set_child(this._mediaPauseIcon);
                else if (status == "Paused" || status == "Stopped")
                    this._mediaPlay.set_child(this._mediaPlayIcon);
            }
        ));
    }
};

// Put your extension initialization code here
function main(metadata) {
    imports.gettext.bindtextdomain('gnome-shell-extension-mediaplayer', metadata.locale);
    default_cover = metadata.path + '/cover.png'

    Panel.STANDARD_TRAY_ICON_ORDER.unshift('player');
    Panel.STANDARD_TRAY_ICON_SHELL_IMPLEMENTATION['player'] = Indicator;
}
