/* -*- mode: js2; js2-basic-offset: 4; indent-tabs-mode: nil -*- */
/**
    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.
**/

const Mainloop = imports.mainloop;
const St = imports.gi.St;
const PopupMenu = imports.ui.popupMenu;
const Pango = imports.gi.Pango;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Lang = imports.lang;

const PlayerButtons = new Lang.Class({
    Name: 'PlayerButtons',
    Extends: PopupMenu.PopupBaseMenuItem,

    _init: function() {
        this.parent({reactive: false});
        this.box = new St.BoxLayout({style_class: 'controls'});
        this.addActor(this.box, {span: -1, align: St.Align.MIDDLE});
    },
    addButton: function(button) {
        this.box.add_actor(button.actor);
    }
});

const PlayerButton = new Lang.Class({
    Name: "PlayerButton",

    _init: function(icon, callback) {
        this.icon = new St.Icon({
            icon_name: icon + '-symbolic',
            icon_size: 20
        });

        this.actor = new St.Button({style_class: 'notification-icon-button control-button',
                                    child: this.icon});
        this.actor._delegate = this

        this._callback_id = this.actor.connect('clicked', callback);

        // override base style
        this.icon.set_style('padding: 0px');
        this.actor.set_style('padding: 8px');
    },

    setCallback: function(callback) {
        this.actor.disconnect(this._callback_id);
        this._callback_id = this.actor.connect('clicked', callback);
    },

    setIcon: function(icon) {
        this.icon.icon_name = icon + '-symbolic';
    },

    enable: function() {
        this.actor.remove_style_pseudo_class('disabled');
        this.actor.can_focus = true;
        this.actor.reactive = true;
    },

    disable: function() {
        this.actor.add_style_pseudo_class('disabled');
        this.actor.can_focus = false;
        this.actor.reactive = false;
    },

    show: function() {
        this.actor.show();
    },

    hide: function() {
        this.actor.hide();
    }
});

const SliderItem = new Lang.Class({
    Name: "SliderItem",
    Extends: PopupMenu.PopupSliderMenuItem,

    _init: function(text, icon, value) {
        this.parent(value);

        this.removeActor(this._slider);
        this._box = new St.Table({style_class: 'slider-item'});
        this._icon = new St.Icon({style_class: 'menu-icon', icon_name: icon + '-symbolic'});
        this._label = new St.Label({text: text});
        this._box.add(this._icon, {row: 0, col: 0, x_expand: false})
        this._box.add(this._label, {row: 0, col: 1, x_expand: false})
        this._box.add(this._slider, {row: 0, col: 2, x_expand: true})

        this.addActor(this._box, {span: -1, expand: true});
    },

    setIcon: function(icon) {
        this._icon.icon_name = icon + '-symbolic';
    },

    setLabel: function(text) {
        if (this._label.clutter_text)
            this._label.text = text;
    }
});

const TrackBox = new Lang.Class({
    Name: "TrackBox",
    Extends: PopupMenu.PopupBaseMenuItem,

    _init: function(cover) {
        this.parent({reactive: false});

        this.box = new St.Table();
        this._cover = cover;
        this._infos = new St.Table({style_class: "track-infos"});
        this.box.add(this._cover, {row: 0, col: 1, x_expand: false});
        this.box.add(this._infos, {row: 0, col: 2, x_expand: true});

        this.addActor(this.box, {span: -1, expand: true});
    },

    addInfo: function(item, row) {
        this._infos.add(item.actor, {row: row, col: 1, y_expand: false});
    }
});

const TrackTitle = new Lang.Class({
    Name: "TrackTitle",

    _init: function(prepend, text, style) {
        this.actor = new St.Table({style_class: style});
        this.actor._delegate = this;

        this._label = new St.Label();
        if (prepend) {
            this._prepend = new St.Label({style_class: 'popup-inactive-menu-item', text: prepend + " "});
            this._prepend.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;
            this.actor.add(this._prepend, {row: 0, col: 0, x_fill: true, x_expand: false});
            this.actor.add(this._label, {row: 0, col: 1});
        }
        else
            this.actor.add(this._label, {row: 0, col: 0});

        this.setText(text);
    },

    setText: function(text) {
        if (this._label.clutter_text) {
            this._label.clutter_text.line_wrap = true;
            this._label.clutter_text.line_wrap_mode = Pango.WrapMode.WORD_CHAR;
            this._label.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;
            this._label.clutter_text.set_text(text.toString());
        }
    },

    getText: function() {
        return this._label.text;
    }
});

const TitleItem = new Lang.Class({
    Name: "TitleItem",
    Extends: PopupMenu.PopupBaseMenuItem,

    _init: function(text, icon, callback) {
        this.parent();

        this.box = new St.BoxLayout();
        this.addActor(this.box);
        this.label = new St.Label({text: text});
        this.icon = new St.Bin({style_class: "menu-icon", child: icon});
        this.button = new St.Button({style_class: "button-quit"});
        this.button.connect('clicked', callback);
        this.button_icon = new St.Icon({
            icon_name: 'window-close-symbolic',
            icon_size: 16
        });
        this.button.set_child(this.button_icon);
        this.box.add_actor(this.icon);
        this.box.add_actor(this.label);
        this.addActor(this.button, {span: -1, expand: true, align: St.Align.END});
        this.hideButton();
    },

    setLabel: function(text) {
        this.label.text = text;
    },

    setIcon: function(icon) {
        this.icon.set_child(icon);
    },

    hideButton: function() {
        this.button.hide();
    },

    showButton: function() {
        this.button.show();
    }
});

const TrackRating = new Lang.Class({
    Name: "TrackRating",

    _init: function(prepend, value, style, player) {
        this.actor = new St.BoxLayout({style_class: style});
        this.actor._delegate = this;

        if (prepend) {
            this._prepend = new St.Label({style_class: 'popup-inactive-menu-item', text: prepend + ": "});
            this._prepend.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;
            this.actor.add(this._prepend);
        }
        // Reference to our player
        this._player = player;
        // Current value
        this._value = value;
        // Supported players
        this._supported = {
            "org.mpris.MediaPlayer2.banshee": this.applyBansheeRating,
            "org.mpris.MediaPlayer2.rhythmbox": this.applyRhythmbox3Rating,
        };
        // Icons
        this._starredIcon = [];
        this._nonStarredIcon = [];
        this._starButton = [];
        for(let i=0; i < 5; i++) {
            // Create starred icons
            this._starredIcon[i] = new St.Icon({style_class: 'star-icon',
                                                icon_size: 16,
                                                icon_name: 'starred-symbolic'
                                               });
            // Create non-starred icons
            this._nonStarredIcon[i] = new St.Icon({style_class: 'star-icon',
                                                   icon_size: 16,
                                                   icon_name: 'non-starred-symbolic'
                                                  });
            // Create the button with starred icon
            this._starButton[i] = new St.Button({style_class: 'button-star',
                                                 x_align: St.Align.START,
                                                 y_align: St.Align.MIDDLE,
                                                 track_hover: true,
                                                 child: this._starredIcon[i]
                                                });
            this._starButton[i]._rateValue = i + 1;
            this._starButton[i].connect('notify::hover', Lang.bind(this, this.newRating));
            this._starButton[i].connect('clicked', Lang.bind(this, this.applyRating));

            // Put the button in the box
            this.actor.add(this._starButton[i]);
        }
        this.showRating(this._value);
    },

    newRating: function(button) {
        if (this._supported[this._player.busName]) {
            if (button.hover)
                this.showRating(button._rateValue);
            else
                this.showRating(this._value);
        }
    },

    showRating: function(value) {
        for (let i = 0; i < 5; i++)
            this._starButton[i].set_child(this._nonStarredIcon[i]);
        for (let i = 0; i < value; i++)
            this._starButton[i].set_child(this._starredIcon[i]);
    },

    setRating: function(value) {
        this._value = value;
    },

    applyRating: function(button) {
        // Apply the rating in the player
        let applied = false;
        if (this._supported[this._player.busName]) {
            let applyFunc = Lang.bind(this, this._supported[this._player.busName]);
            applied = applyFunc(button._rateValue);
        }
        if (applied) {
            this.setRating(button._rateValue);
            this.showRating(button._rateValue);
        }
    },

    applyBansheeRating: function(value) {
        GLib.spawn_command_line_async("banshee --set-rating=%s".format(value));
        return true;
    },

    applyRhythmbox3Rating: function(value) {
        const Rhythmbox3Iface = <interface name="org.gnome.Rhythmbox3.RhythmDB">
        <method name="SetEntryProperties">
            <arg type="s" direction="in" />
            <arg type="a{sv}" direction="in" />
        </method>
        </interface>;
        const Rhythmbox3Proxy = Gio.DBusProxy.makeProxyWrapper(Rhythmbox3Iface);

        if (this._player.trackUrl) {
            let proxy = new Rhythmbox3Proxy(Gio.DBus.session, "org.gnome.Rhythmbox3",
                                            "/org/gnome/Rhythmbox3/RhythmDB");
            proxy.SetEntryPropertiesRemote(this._player.trackUrl, {rating: GLib.Variant.new_double(value)});
            return true;
        }

        return false;
    },

    destroy: function() {
        this.actor.destroy();
    },
});

const PlaylistItem = new Lang.Class({
    Name: "PlaylistItem",
    Extends: PopupMenu.PopupBaseMenuItem,

    _init: function (text, obj, icon) {
        this.parent();

        this.obj = obj;
        this.box = new St.BoxLayout();
        this.label = new St.Label({text: text});
        this.icon = new St.Icon({style_class: 'menu-icon', icon_name: 'view-list-symbolic'});
        this.box.add_actor(this.icon);
        this.box.add_actor(this.label);

        this.addActor(this.box);
    }
});
