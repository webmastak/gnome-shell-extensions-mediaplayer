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

function TrackBox() {
    this._init.apply(this, arguments);
}

TrackBox.prototype = {
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,

    _init: function(cover) {
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this, {reactive: false});
        this.box = new St.Table();
        this._cover = cover;
        this._infos = new St.Table({style_class: "track-infos"});
        this.addActor(this.box, {span: -1, expand: true});
        this.box.add(this._cover, {row: 0, col: 1, x_expand: false});
        this.box.add(this._infos, {row: 0, col: 2, x_expand: true});
    },

    addInfo: function(item, row) {
        this._infos.add(item, {row: row, col: 1, y_expand: false});
    }
}

function ControlButtons() {
    this._init.apply(this, arguments);
}

ControlButtons.prototype = {
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,

    _init: function() {
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this, {reactive: false});
        this.box = new St.BoxLayout();
        this.addActor(this.box, {span: -1, align: St.Align.MIDDLE});
    },
    addButton: function(button) {
        this.box.add_actor(button);
    }
}

function ControlButton() {
    this._init.apply(this, arguments);
}

ControlButton.prototype = {
    _init: function(icon, callback) {
        this.actor = new St.Bin({style_class: 'button-container'});
        this.icon = new St.Icon({
            style_class: 'button-icon',
            icon_type: St.IconType.SYMBOLIC,
            icon_name: icon,
        });
        this.button = new St.Button({style_class: 'hotplug-resident-eject-button',
                                     child: this.icon});
        this.button.connect('clicked', callback);
        this.actor.add_actor(this.button);
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

function SliderItem() {
    this._init.apply(this, arguments);
}

SliderItem.prototype = {
    __proto__: PopupMenu.PopupSliderMenuItem.prototype,

    _init: function(text, icon, value) {
        PopupMenu.PopupSliderMenuItem.prototype._init.call(this, value);
        this.removeActor(this._slider);
        this._holder = new St.Table({style_class: 'slider-item'});
        this._icon = new St.Icon({style_class: 'menu-icon', icon_name: icon});
        this._label = new St.Label({text: text});
        this._holder.add(this._icon, {row: 0, col: 0, x_expand: false})
        this._holder.add(this._label, {row: 0, col: 1, x_expand: false})
        this._holder.add(this._slider, {row: 0, col: 2, x_expand: true})
        this.addActor(this._holder, {span: -1, expand: true});
    },

    setIcon: function(icon) {
        this._icon.icon_name = icon;
    },

    setLabel: function(text) {
        if (this._label.clutter_text)
            this._label.text = text;
    }
}

function TrackTitle() {
    this._init.apply(this, arguments);
}

TrackTitle.prototype = {
    _init: function(prepend, text, style) {
        this.box = new St.Table({style_class: style});
        this._label = new St.Label();
        if (prepend) {
            this._prepend = new St.Label({style_class: 'popup-inactive-menu-item', text: prepend + " "});
            this._prepend.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;
            this.box.add(this._prepend, {row: 0, col: 0, x_fill: true, x_expand: false});
            this.box.add(this._label, {row: 0, col: 1});
        }
        else
            this.box.add(this._label, {row: 0, col: 0});

        this.setText(text);
    },

    setText: function(text) {
        if (this._label.clutter_text) {
            this._label.clutter_text.line_wrap = true;
            this._label.clutter_text.line_wrap_mode = Pango.WrapMode.WORD_CHAR;
            this._label.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;
            this._label.clutter_text.set_text(text.toString());
        }
    }
}

function TitleItem() {
    this._init.apply(this, arguments);
}

TitleItem.prototype = {
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,

    _init: function(text, icon, callback) {
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this);

        this.box = new St.BoxLayout();
        this.addActor(this.box);
        this.label = new St.Label({text: text});
        this.icon = new St.Bin({style_class: "menu-icon", child: icon});
        this.button = new St.Button({style_class: "button-quit"});
        this.button.connect('clicked', callback);
        this.button_icon = new St.Icon({
            icon_type: St.IconType.SYMBOLIC,
            icon_name: 'window-close',
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
}


function TrackRating() {
    this._init.apply(this, arguments);
}

TrackRating.prototype = {
    _init: function(prepend, value, style, player) {
        this.box = new St.BoxLayout({style_class: style});
        if (prepend) {
            this._prepend = new St.Label({style_class: 'popup-inactive-menu-item', text: prepend + ": "});
            this._prepend.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;
            this.box.add(this._prepend);
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
                                                icon_type: St.IconType.SYMBOLIC,
                                                icon_name: 'starred'
                                               });
            // Create non-starred icons
            this._nonStarredIcon[i] = new St.Icon({style_class: 'star-icon',
                                                   icon_size: 16,
                                                   icon_type: St.IconType.SYMBOLIC,
                                                   icon_name: 'non-starred'
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
            this.box.add(this._starButton[i]);
        }
        this.showRating(this._value);
    },

    newRating: function(button) {
        if (this._supported[this._player._busName]) {
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
        if (this._supported[this._player._busName]) {
            let applyFunc = Lang.bind(this, this._supported[this._player._busName]);
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
        this.box.destroy();
    },
}

function PlaylistItem() {
    this._init.apply(this, arguments);
}

PlaylistItem.prototype = {
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,

    _init: function (text, obj, icon) {
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this);
        this.obj = obj;
        this.box = new St.BoxLayout();
        this.addActor(this.box);
        this.label = new St.Label({text: text});
        this.icon = new St.Icon({style_class: 'menu-icon', icon_name: 'view-list'});
        this.box.add_actor(this.icon);
        this.box.add_actor(this.label);
    }
};
