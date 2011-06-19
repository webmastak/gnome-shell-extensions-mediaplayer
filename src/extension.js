/* -*- mode: js2; js2-basic-offset: 4; indent-tabs-mode: nil -*- */

const Mainloop = imports.mainloop;
const DBus = imports.dbus;
const Lang = imports.lang;
const Clutter = imports.gi.Clutter;
const St = imports.gi.St;
const Panel = imports.ui.panel;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;

const Gettext = imports.gettext.domain('gnome-shell-extension-mediaplayer');
const _ = Gettext.gettext;

const MonitorIFace = {
    name: 'org.freedesktop.DBus',
    methods: [{ name: 'ListNames',
                inSignature: '',
                outSignature: 'as' }],
    signals: [{ name: 'NameOwnerChanged',
                inSignature: 'a{sv}'}]
};

const PropIFace = {
    name: 'org.freedesktop.DBus.Properties',
    signals: [{ name: 'PropertiesChanged',
                inSignature: 'a{sv}'}]
};

const NotificationIFace = {
    name: 'org.freedesktop.Notifications',
    methods: [{ name: 'Notify',
                inSignature: 'susssasa{sv}i',
                outSignature: 'u'}]
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

let default_cover = null;
/* dummy vars for translation */
let x = _("Playing");
x = _("Paused");
x = _("Stopped");

function Monitor() {
    this._init.apply(this, arguments);
}

Monitor.prototype = {
    _init: function() {
        DBus.session.proxifyObject(this, 'org.freedesktop.DBus', '/org/freedesktop/DBus', this);
    },
}
DBus.proxifyPrototype(Monitor.prototype, MonitorIFace)

function Notification() {
    this._init.apply(this, arguments);
}

Notification.prototype = {
    _init: function() {
        DBus.session.proxifyObject(this, 'org.freedesktop.Notifications', '/org/freedesktop/Notifications', this);
    },
}
DBus.proxifyPrototype(Notification.prototype, NotificationIFace)

function Prop() {
    this._init.apply(this, arguments);
}

Prop.prototype = {
    _init: function(player) {
        DBus.session.proxifyObject(this, 'org.mpris.MediaPlayer2.'+player, '/org/mpris/MediaPlayer2', this);
    }
}
DBus.proxifyPrototype(Prop.prototype, PropIFace)


function MediaServer2Player() {
    this._init.apply(this, arguments);
}
MediaServer2Player.prototype = {
    _init: function(player) {
        DBus.session.proxifyObject(this, 'org.mpris.MediaPlayer2.'+player, '/org/mpris/MediaPlayer2', this);
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
    getLabel: function() {
        return this.label.text.toString();
    },
};

function ControlButton() {
    this._init.apply(this, arguments);
}

ControlButton.prototype = {
    _init: function(icon, callback) {
        this.actor = new St.Bin({style_class: 'button-container'});
        this.button = new St.Button({ style_class: 'button' });
        this.button.connect('clicked', callback);
        this.icon = new St.Icon({
            icon_type: St.IconType.SYMBOLIC,
            icon_name: icon,
            style_class: 'button-icon',
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
}

function Player() {
    this._init.apply(this, arguments);
}

Player.prototype = {
    __proto__: PopupMenu.PopupMenuSection.prototype,
    
    _init: function(name) {
        PopupMenu.PopupMenuSection.prototype._init.call(this);

        this.name = name;

        this._mediaServer = new MediaServer2Player(name);
        this._prop = new Prop(name);
        this._notif = new Notification();

        this._playerInfo = new St.BoxLayout({style_class: 'player-info'});
        this._playerIcon = new St.Icon({icon_name: "audio-x-generic", style_class: 'player-icon'});
        this._playerName = new St.Label({text: this._getName(), style_class: 'player-name'});
        this._playerInfo.add_actor(this._playerIcon, { span: 0 });
        this._playerInfo.add_actor(this._playerName, { span: -1 });
        
        this.addActor(this._playerInfo);

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

        this.addActor(mainBox);

        let infos = new St.BoxLayout({vertical: true});
        this._artist = new TrackInfo(_('Unknown Artist'), "system-users");
        this._album = new TrackInfo(_('Unknown Album'), "media-optical");
        this._title = new TrackInfo(_('Unknown Title'), "audio-x-generic");
        infos.add_actor(this._artist.getActor());
        infos.add_actor(this._album.getActor());
        infos.add_actor(this._title.getActor());
        this._trackInfos.set_child(infos);

        let controls = new St.BoxLayout({style_class: 'playback-control'});
        infos.add_actor(controls);

        this._prevButton = new ControlButton('media-skip-backward',
            Lang.bind(this, function () { this._mediaServer.PreviousRemote(); }));
        this._playButton = new ControlButton('media-playback-start',
            Lang.bind(this, function () { this._mediaServer.PlayPauseRemote(); }));
        this._stopButton = new ControlButton('media-playback-stop',
            Lang.bind(this, function () { this._mediaServer.StopRemote(); }));
        this._nextButton = new ControlButton('media-skip-forward',
            Lang.bind(this, function () { this._mediaServer.NextRemote(); }));

        controls.add_actor(this._prevButton.getActor());
        controls.add_actor(this._playButton.getActor());
        controls.add_actor(this._stopButton.getActor());
        controls.add_actor(this._nextButton.getActor());

        this._volumeText = new PopupMenu.PopupImageMenuItem(_("Volume"), "audio-volume-high", {reactive: false});
        this._volume = new PopupMenu.PopupSliderMenuItem(0, {style_class: 'volume-slider'});
        this._volume.connect('value-changed', Lang.bind(this, function(item) {
            this._mediaServer.setVolume(item._value);
        }));
        this.addMenuItem(this._volumeText);
        this.addMenuItem(this._volume);

        this._updateMetadata();
        this._updateButtons();
        this._updateVolume();

        this._prop.connect('PropertiesChanged', Lang.bind(this, function(arg) {
            this._updateMetadata();
            this._updateButtons();
            this._updateVolume();
        }));

    },

    _getName: function() {
        return this.name.charAt(0).toUpperCase() + this.name.slice(1);

    },

    _setName: function(status) {
        this._playerName.text = this._getName() + " - " + _(status);
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
                    cover = decodeURIComponent(cover.substr(7));
                }
                else
                    cover = default_cover;

                let coverImg = new Clutter.Texture(
                    {
                        keep_aspect_ratio: true,
                        height: 100,
                        filter_quality: 2,
                        filename: cover,
                    }
                );
	        	this._trackCover.set_child(coverImg);
                /*this._notif.NotifyRemote(
                    this.name, 0, 'dialog-info', this._getName(),
                    this._artist.getLabel() + ' - ' + this._title.getLabel(),
                    [], {}, 120, function(result, err){}
                );*/
            }
        ));
    },

    _updateVolume: function() {
        this._mediaServer.getVolume(Lang.bind(this,
            function(sender, volume) {
                this._volumeText.setIcon("audio-volume-low");
                if (volume > 0.30) 
                    this._volumeText.setIcon("audio-volume-medium");
                if (volume > 0.70)
                    this._volumeText.setIcon("audio-volume-high");
                this._volume.setValue(volume);
            }
        ));
    },

    _updateButtons: function() {
        this._mediaServer.getPlaybackStatus(Lang.bind(this,
            function(sender, status) {
                if (status == "Playing")
                    this._playButton.setIcon("media-playback-pause");
                else if (status == "Paused" || status == "Stopped")
                    this._playButton.setIcon("media-playback-start");
                this._setName(status);
            }
        ));
    },


}

function Indicator() {
    this._init.apply(this, arguments);
}

Indicator.prototype = {
    __proto__: PanelMenu.SystemStatusButton.prototype,

    _init: function() {
        PanelMenu.SystemStatusButton.prototype._init.call(this, 'audio-x-generic', null);
        this._players = {};
        this._queue = {};
        this._monitor = new Monitor();
        this._monitor.connect('NameOwnerChanged', Lang.bind(this, this._setPlayerStatus));
        this._loadPlayers();
        this.menu.connect('players-loaded', Lang.bind(this,
            function(sender, state) {
                if (this._nbPlayers() == 0) {
                    this.menu.addMenuItem(new PopupMenu.PopupMenuItem(_("No player running"), { reactive: false }));
                }
            }
        ));
    },

    _nbPlayers: function() {
        if (!this._players)
            return 0
        else
            return Object.keys(this._players).length;
    },

    _loadPlayers: function() {
        this._monitor.ListNamesRemote(Lang.bind(this, 
            function(names) {
                names = names.toString().split(',');
                for (let i = 0; i < names.length; i++) {
                    if (names[i].match('^org.mpris.MediaPlayer2')) {
                        let player = names[i].split('.');
                        player = player[player.length-1];
                        this._addPlayer(player);
                    }
                }
                this.menu.emit('players-loaded', true);
            }
        ));
    },

    _addPlayer: function(name) {
        // ensure menu is empty
        if (this._nbPlayers() == 0)
            this.menu.removeAll();
        this._players[name] = new Player(name);
        this.menu.addMenuItem(this._players[name]);
    },

    _removePlayer: function(name) {
        delete this._players[name];
        this.menu.removeAll();
        for (name in this._players) { 
            this._addPlayer(name);
        }
        this.menu.emit('players-loaded', true);
    },
    
    _setPlayerStatus: function(dbus, name, id1, id2) {
        if (id2 == name && !this._queue[id2]) {
            this._queue[id2] = { state: "requested", name: "" };
        }
        else if (name.match('^org.mpris.MediaPlayer2') && this._queue[id2] && this._queue[id2].state == "requested") {
            let player = name.split('.');
            player = player[player.length-1];
            this._queue[id2].state = "active";
            this._queue[id2].name = player;
            this._addPlayer(player);
        }
        else if (this._queue[id2] && this._queue[id2] == "requested") {
            // not a MPRIS player
            delete this._queue[id2];
        }
        else if (name.match('^org.mpris.MediaPlayer2')) {
            let player = name.split('.');
            player = player[player.length-1];
            this._removePlayer(player);
            if (this._queue[id1] && this._queue[id1].state == "active")
                delete this._queue[id1];
        }
    },

};

// Put your extension initialization code here
function main(metadata) {
    imports.gettext.bindtextdomain('gnome-shell-extension-mediaplayer', metadata.locale);
    default_cover = metadata.path + '/cover.png'

    Panel.STANDARD_TRAY_ICON_ORDER.unshift('player');
    Panel.STANDARD_TRAY_ICON_SHELL_IMPLEMENTATION['player'] = Indicator;
}
