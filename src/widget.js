/* -*- mode: js2; js2-basic-offset: 4; indent-tabs-mode: nil -*- */
/* jshint esnext: true */
/* jshint -W097 */
/* jshint multistr: true */
/* global imports: false */
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

'use strict';

const Mainloop = imports.mainloop;
const St = imports.gi.St;
const PopupMenu = imports.ui.popupMenu;
const Slider = imports.ui.slider;
const Pango = imports.gi.Pango;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Lang = imports.lang;
const Tweener = imports.ui.tweener;
const Params = imports.misc.params;

const Me = imports.misc.extensionUtils.getCurrentExtension();
const Settings = Me.imports.settings;

const PlayerButtons = new Lang.Class({
    Name: 'PlayerButtons',
    Extends: PopupMenu.PopupBaseMenuItem,

    _init: function() {
        this.parent({hover: false});
        this.box = new St.BoxLayout({style_class: 'controls'});
        this.actor.add(this.box, {expand: true, x_fill: false, x_align: St.Align.MIDDLE});
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
        });
        this.actor = new St.Button({style_class: 'system-menu-action popup-inactive-menu-item',
                                    child: this.icon});
        this.actor._delegate = this;

        this._callback_id = this.actor.connect('clicked', callback);
    },

    setCallback: function(callback) {
        this.actor.disconnect(this._callback_id);
        this._callback_id = this.actor.connect('clicked', callback);
    },

    setIcon: function(icon) {
        this.icon.icon_name = icon;
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
    Extends: PopupMenu.PopupBaseMenuItem,

    _init: function(icon, value) {
        this.parent({style_class: 'slider-item', hover: false});

        this._icon = new St.Icon({style_class: 'popup-menu-icon', icon_name: icon});
        this._slider = new Slider.Slider(value);

        this.actor.add(this._icon);
        this.actor.add(this._slider.actor, {expand: true});
    },

    setValue: function(value) {
        this._slider.setValue(value);
    },

    setIcon: function(icon) {
        this._icon.icon_name = icon;
    },

    connect: function(signal, callback) {
        this._slider.connect(signal, callback);
    }
});

const TrackBox = new Lang.Class({
    Name: "TrackBox",
    Extends: PopupMenu.PopupBaseMenuItem,

    _init: function(cover) {
      this.parent({hover: false});
      this._cover = cover;      
      this.infos = new St.BoxLayout({vertical: true});
      this._content = new St.BoxLayout({style_class: 'track-box', vertical: false}); 
      this._content.add_child(this._cover);
      this._content.add_child(this.infos);
      this.actor.add(this._content, {expand: true, x_fill: false, x_align: St.Align.MIDDLE});
    },

    addInfo: function(item, row) {
        this.infos.add(item.actor);
    },

    empty: function() {
        this.infos.destroy_all_children();
    },

    get hidden() {
      return this._hidden || false;
    },

    set hidden(value) {
      this._hidden = value;
    },

    hide: function() {
      this.actor.hide();
      this.actor.opacity = 0;
      this.actor.set_height(0);
      this.hidden = true;
    },

    show: function() {
      this.actor.show();
      this.actor.opacity = 255;
      this.actor.set_height(-1);
      this.hidden = false;
    },

    showAnimate: function() {
      if (!this.actor.get_stage() || this._hidden === false)
        return;

      this.actor.set_height(-1);
      let [minHeight, naturalHeight] = this.actor.get_preferred_height(-1);
      this.actor.set_height(0);
      this.actor.show();
      Tweener.addTween(this.actor, {
        opacity: 255,
        height: naturalHeight,
        time: Settings.FADE_ANIMATION_TIME,
        transition: 'easeOutQuad',
        onComplete: function() {
          this.show();
        },
        onCompleteScope: this
      });
    },

    hideAnimate: function() {
      if (!this.actor.get_stage() || this._hidden === true)
        return;

      Tweener.addTween(this.actor, {
        opacity: 0,
        height: 0,
        time: Settings.FADE_ANIMATION_TIME,
        transition: 'easeOutQuad',
        onComplete: function() {
          this.hide();
        },
        onCompleteScope: this
      });
    }
});

const SecondaryInfo = new Lang.Class({
    Name: "SecondaryInfo",
    Extends: PopupMenu.PopupBaseMenuItem,

    _init: function() {
      this.parent({hover: false});     
      this.infos = new St.BoxLayout({vertical: true});
      this.actor.add(this.infos, {expand: true, x_fill: false, x_align: St.Align.MIDDLE});
    },

    addInfo: function(item, row) {
        this.infos.add(item.actor, {expand: true, x_fill: false, x_align: St.Align.MIDDLE});
    },

    empty: function() {
        this.infos.destroy_all_children();
    },

    get hidden() {
      return this._hidden || false;
    },

    set hidden(value) {
      this._hidden = value;
    },

    hide: function() {
      this.actor.hide();
      this.actor.opacity = 0;
      this.actor.set_height(0);
      this.hidden = true;
    },

    show: function() {
      this.actor.show();
      this.actor.opacity = 255;
      this.actor.set_height(-1);
      this.hidden = false;
    },

    showAnimate: function() {
      if (!this.actor.get_stage() || this._hidden === false)
        return;

      this.actor.set_height(-1);
      let [minHeight, naturalHeight] = this.actor.get_preferred_height(-1);
      this.actor.set_height(0);
      this.actor.show();
      Tweener.addTween(this.actor, {
        opacity: 255,
        height: naturalHeight,
        time: Settings.FADE_ANIMATION_TIME,
        transition: 'easeOutQuad',
        onComplete: function() {
          this.show();
        },
        onCompleteScope: this
      });
    },

    hideAnimate: function() {
      if (!this.actor.get_stage() || this._hidden === true)
        return;

      Tweener.addTween(this.actor, {
        opacity: 0,
        height: 0,
        time: Settings.FADE_ANIMATION_TIME,
        transition: 'easeInQuad',
        onComplete: function() {
          this.hide();
        },
        onCompleteScope: this
      });
    }
});


const TrackInfo = new Lang.Class({
    Name: "TrackInfo",

    _init: function(text, style) {
      this.actor = new St.Label({style_class: style});
      this.actor._delegate = this;

      this.setText(text);
    },

    setText: function(text) {
      if (this.actor.clutter_text) {
        this.actor.clutter_text.ellipsize = Pango.EllipsizeMode.END;
        this.actor.clutter_text.set_markup(text);
      }
    },

    getText: function() {
      return this.actor.text;
    }
});

const TrackRating = new Lang.Class({
    Name: "TrackRating",
    Extends: PopupMenu.PopupBaseMenuItem,

    _init: function(player, value) {
        this._player = player;
        this.parent({style_class: "track-rating", hover: false});
        this.box = new St.BoxLayout({style_class: 'star-box'});
        this.actor.add(this.box, {expand: true, x_fill: false, x_align: St.Align.MIDDLE});
        this.rate(value);
        // Supported players (except for Nuvola Player)
        this._supported = {
            "org.mpris.MediaPlayer2.banshee": this.applyBansheeRating,
            "org.mpris.MediaPlayer2.rhythmbox": this.applyRhythmbox3Rating,
            "org.mpris.MediaPlayer2.guayadeque": this.applyGuayadequeRating,
            "org.mpris.MediaPlayer2.Lollypop": this.applyLollypopRating
        };
    },

    rate: function(value) {
        this.box.destroy_all_children();
        this._value = value;
        this._starIcon = [];
        this._starButton = [];
        for(let i=0; i < 5; i++) {
            // Create star icons
            this._starIcon[i] = new St.Icon({style_class: 'popup-menu-icon star-icon',
                                             icon_name: 'non-starred-symbolic'
                                             });
            // Create the button with starred icon
            this._starButton[i] = new St.Button({x_align: St.Align.MIDDLE,
                                                 y_align: St.Align.MIDDLE,
                                                 track_hover: true,
                                                 child: this._starIcon[i]
                                                });
            this._starButton[i]._rateValue = i + 1;
            this._starButton[i]._starred = false;
            this._starButton[i].connect('notify::hover', Lang.bind(this, this.newRating));
            this._starButton[i].connect('clicked', Lang.bind(this, this.applyRating));

            // Put the button in the box
            this.box.add_child(this._starButton[i]);
        }
        this.setRating(this._value);
    },

    newRating: function(button) {
        if (this._supported[this._player.busName] || this.nuvolaRatingSupported()) {
            if (button.hover)
                this.hoverRating(button._rateValue);
            else
                this.setRating(this._value);
        }
    },

    hoverRating: function(value) {
        for (let i = 0; i < 5; i++) {
            this._starButton[i].child.icon_name = "non-starred-symbolic";
        }
        for (let i = 0; i < value; i++) {
            this._starButton[i].child.icon_name = "starred-symbolic";
        }
    },

    setRating: function(value) {
        value = Math.round(value);
        if (value > 5)
          value = 5;
        if (value < 0)
          value = 0;
        for (let i = 0; i < 5; i++) {
            this._starButton[i].child.icon_name = "non-starred-symbolic";
            this._starButton[i]._starred = false;
        }
        for (let i = 0; i < value; i++) {
            this._starButton[i].child.icon_name = "starred-symbolic";
            this._starButton[i]._starred = true;
        }
        this._value = value;
    },

    applyRating: function(button) {
        let rateValue;
        // Click on a already starred icon, unrates
        if (button._starred && button._rateValue == this._value)
            rateValue = 0;
        else
            rateValue = button._rateValue;
        // Apply the rating in the player
        let applied = false;
        if (this._supported[this._player.busName]) {
            let applyFunc = Lang.bind(this, this._supported[this._player.busName]);
            applied = applyFunc(rateValue);
        }
        else if (this.getNuvolaRatingProxy()) {
            applied = this.applyNuvolaRating(rateValue);
        }
        if (applied) {
            this.setRating(rateValue);
        }
    },

    applyBansheeRating: function(value) {
        GLib.spawn_command_line_async("banshee --set-rating=%s".format(value));
        return true;
    },

    applyGuayadequeRating: function(value) {
        GLib.spawn_command_line_async("guayadeque --set-rating=%s".format(value));
        return true;
    },

    applyLollypopRating: function(value) {
        GLib.spawn_command_line_async("lollypop --set-rating=%s".format(value));
        return true;
    },

    applyRhythmbox3Rating: function(value) {
        const Rhythmbox3Iface = '<node>\
            <interface name="org.gnome.Rhythmbox3.RhythmDB">\
                <method name="SetEntryProperties">\
                    <arg type="s" direction="in" />\
                    <arg type="a{sv}" direction="in" />\
                </method>\
            </interface>\
        </node>';
        const Rhythmbox3Proxy = Gio.DBusProxy.makeProxyWrapper(Rhythmbox3Iface);

        if (this._player.state.trackUrl) {
            let proxy = new Rhythmbox3Proxy(Gio.DBus.session, "org.gnome.Rhythmbox3",
                                            "/org/gnome/Rhythmbox3/RhythmDB");
            proxy.SetEntryPropertiesRemote(this._player.state.trackUrl, {rating: GLib.Variant.new_double(value)});
            return true;
        }

        return false;
    },

    getNuvolaRatingProxy: function() {
        if (this._nuvolaRatingProxy === false) {
            return false;
        }
        if (this._nuvolaRatingProxy) {
            return this._nuvolaRatingProxy;
        }
        /* Web apps running in the Nuvola Player runtime are named "org.mpris.MediaPlayer2.NuvolaAppFooBarBaz" */
        if (this._player.busName.indexOf("org.mpris.MediaPlayer2.NuvolaApp") !== 0) {
            this._nuvolaRatingProxy = false;
            return false;
        }
        const NuvolaRatingIface = '<node>\
            <interface name="org.mpris.MediaPlayer2.Player">\
                <method name="NuvolaSetRating">\
                    <arg type="d" direction="in" />\
                </method>\
                <property name="NuvolaCanRate" type="b" access="read" />\
            </interface>\
        </node>';
        const NuvolaRatingProxy = Gio.DBusProxy.makeProxyWrapper(NuvolaRatingIface);
        this._nuvolaRatingProxy = new NuvolaRatingProxy(Gio.DBus.session, this._player.busName,
                                                        "/org/mpris/MediaPlayer2");
        return this._nuvolaRatingProxy;
    },
    
    nuvolaRatingSupported: function() {
        let proxy = this.getNuvolaRatingProxy();
        if (proxy) {
            return proxy.NuvolaCanRate;
        }
        return false;
    },
    
    applyNuvolaRating: function(value) {
        let proxy = this.getNuvolaRatingProxy();
        if (proxy && proxy.NuvolaCanRate) {
            proxy.NuvolaSetRatingRemote(value / 5.0);
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

    _init: function (text, obj) {
        this.parent();
        this.obj = obj;
        this.label = new St.Label({text: text});
        this.actor.add(this.label);
    },

    setPlaylistActive: function(value) {
      if (value) {
        this.setOrnament(PopupMenu.Ornament.DOT);
      }
      else {
        this.setOrnament(PopupMenu.Ornament.NONE);
      }
    },

    isPlaylistActive: function() {
      return this._ornament !== PopupMenu.Ornament.NONE;
    }
});
