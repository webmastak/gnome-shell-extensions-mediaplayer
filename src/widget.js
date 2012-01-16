/* -*- mode: js2; js2-basic-offset: 4; indent-tabs-mode: nil -*- */

const St = imports.gi.St;
const PopupMenu = imports.ui.popupMenu;
const Pango = imports.gi.Pango;
const GLib = imports.gi.GLib;

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

function SliderItem() {
    this._init.apply(this, arguments);
}

SliderItem.prototype = {
    __proto__: PopupMenu.PopupSliderMenuItem.prototype,

    _init: function(text, icon, value) {
        PopupMenu.PopupSliderMenuItem.prototype._init.call(this, value);
        this.removeActor(this._slider);
        this._holder = new St.BoxLayout({style_class: 'slider-item'});
        this._icon = new St.Icon({style_class: 'menu-icon', icon_name: icon});
        this._label = new St.Label({text: text});
        this._holder.add_actor(this._icon);
        this._holder.add_actor(this._label);
        this._holder.add_actor(this._slider);
        this.addActor(this._holder);
    },

    setIcon: function(icon) {
        this._icon.icon_name = icon;
    },

    setLabel: function(text) {
        this._label.text = text;
    }
}

function TrackTitle() {
    this._init.apply(this, arguments);
}

TrackTitle.prototype = {
    _init: function(pattern, style) {
        this.label = new St.Label({style_class: style, text: ""});
        this.text = pattern;
    },

    format: function(values) {
        for (let i=0; i<values.length; i++) {
            values[i] = GLib.markup_escape_text(values[i].toString(), -1);
        }
        if (this.label.clutter_text) {
            this.label.clutter_text.line_wrap = true;
            this.label.clutter_text.line_wrap_mode = Pango.WrapMode.WORD_CHAR;
            this.label.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;
            this.label.clutter_text.set_markup(this.text.format(values));
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
        this.button = new St.Button();
        this.button.connect('clicked', callback);
        this.button_icon = new St.Icon({
            icon_type: St.IconType.SYMBOLIC,
            icon_name: 'window-close',
            icon_size: 16
        });
        this.button.set_child(this.button_icon);
        this.box.add_actor(this.icon);
        this.box.add_actor(this.label);
        this.addActor(this.button, {align: St.Align.END});
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
