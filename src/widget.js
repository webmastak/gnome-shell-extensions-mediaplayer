/* -*- mode: js2; js2-basic-offset: 4; indent-tabs-mode: nil -*- */
/* jshint esnext: true */
/* jshint -W097 */
/* jshint multistr: true */
/* global imports: false */
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

'use strict';

const Mainloop = imports.mainloop;
const St = imports.gi.St;
const PopupMenu = imports.ui.popupMenu;
const Slider = imports.ui.slider;
const Pango = imports.gi.Pango;
const GLib = imports.gi.GLib;
const Clutter = imports.gi.Clutter;
const Gtk = imports.gi.Gtk;
const Gio = imports.gi.Gio;
const Lang = imports.lang;
const Tweener = imports.ui.tweener;
const Params = imports.misc.params;

const Me = imports.misc.extensionUtils.getCurrentExtension();
const Settings = Me.imports.settings;
const Lib = Me.imports.lib;

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
        this.icon = new St.Icon({icon_name: icon});
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

    setReactive: function(reactive) {
        this._slider.actor.reactive = reactive;
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
      this._hidden = false;
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
      this._hidden = false;     
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
        this._nuvolaRatingProxy = this.getNuvolaRatingProxy();
        this._rhythmbox3Proxy = this.getRhythmbox3Proxy();
        this.parent({style_class: "track-rating", hover: false});
        this.box = new St.BoxLayout({style_class: 'star-box'});
        this.actor.add(this.box, {expand: true, x_fill: false, x_align: St.Align.MIDDLE});
        this.rate(value);
        // Supported players (except for Nuvola Player)
        this._supported = {
            "org.mpris.MediaPlayer2.banshee": this.applyBansheeRating,
            "org.mpris.MediaPlayer2.rhythmbox": this.applyRhythmbox3Rating,
            "org.mpris.MediaPlayer2.guayadeque": this.applyGuayadequeRating,
            "org.mpris.MediaPlayer2.quodlibet": this.applyQuodLibetRating,
            "org.mpris.MediaPlayer2.Lollypop": this.applyLollypopRating
        };
    },

    rate: function(value) {
        this.box.destroy_all_children();
        this._value = Math.min(Math.max(0, value), 5);
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
        else if (this._nuvolaRatingProxy) {
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

    applyQuodLibetRating: function(value) {
        // Quod Libet works on 0.0 to 1.0 scores
        GLib.spawn_command_line_async("quodlibet --set-rating=%f".format(value / 5.0));
        return true;
    },

    applyLollypopRating: function(value) {
        GLib.spawn_command_line_async("lollypop --set-rating=%s".format(value));
        return true;
    },

    applyRhythmbox3Rating: function(value) {
        if (this._rhythmbox3Proxy && this._player.state.trackUrl) {
            this._rhythmbox3Proxy.SetEntryPropertiesRemote(this._player.state.trackUrl,
                                                           {rating: GLib.Variant.new_double(value)});
            return true;
        }

        return false;
    },

    getRhythmbox3Proxy: function() {
        if (this._player.busName != 'org.mpris.MediaPlayer2.rhythmbox') {
          return false;
        }
        const Rhythmbox3Iface = '<node>\
            <interface name="org.gnome.Rhythmbox3.RhythmDB">\
                <method name="SetEntryProperties">\
                    <arg type="s" direction="in" />\
                    <arg type="a{sv}" direction="in" />\
                </method>\
            </interface>\
        </node>';
        const Rhythmbox3Proxy = Gio.DBusProxy.makeProxyWrapper(Rhythmbox3Iface);
        let proxy = new Rhythmbox3Proxy(Gio.DBus.session, "org.gnome.Rhythmbox3",
                                        "/org/gnome/Rhythmbox3/RhythmDB");
        return proxy;
    },

    getNuvolaRatingProxy: function() {
        /* Web apps running in the Nuvola Player runtime are named "org.mpris.MediaPlayer2.NuvolaAppFooBarBaz" */
        if (this._player.busName.indexOf("org.mpris.MediaPlayer2.NuvolaApp") !== 0) {
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
        let proxy = new NuvolaRatingProxy(Gio.DBus.session, this._player.busName,
                                                        "/org/mpris/MediaPlayer2");
        return proxy;
    },
    
    nuvolaRatingSupported: function() {
        let proxy = this._nuvolaRatingProxy;
        if (proxy) {
            return proxy.NuvolaCanRate;
        }
        return false;
    },
    
    applyNuvolaRating: function(value) {
        let proxy = this._nuvolaRatingProxy;
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

const ListSubMenu = new Lang.Class({
  Name: 'ListSubMenu',
  Extends: PopupMenu.PopupSubMenuMenuItem,

  _init: function(label) {
    this.parent(label, false);
    this.activeObject = null;
    this._hidden = false;
    //We have to MonkeyPatch open and close
    //So our nested menus don't close their parent menu
    //and to completely disable animation.
    this.menu.close = Lang.bind(this, this.close);
    this.menu.open = Lang.bind(this, this.open);
  },

  close: function(animate) {
    if (!this.menu.isOpen) {
      return;
    }
    this.menu.isOpen = false;
    if (this.menu._activeMenuItem) {
      this.menu._activeMenuItem.setActive(false);
    }
    this.menu.actor.hide();
    this.menu._arrow.rotation_angle_z = 0;
  },


  open: function(animate) {
    if (this.menu.isOpen || this._hidden || this.menu.isEmpty()) {
      return;
    }
    this.menu.isOpen = true;
    this.emit('ListSubMenu-opened');
    this.menu.actor.show();
    this.updateScrollbarPolicy();
    this.menu._arrow.rotation_angle_z = this.menu.actor.text_direction == Clutter.TextDirection.RTL ? -90 : 90;   
  },

  show: function() {
    this._hidden = false;
    this.actor.show();
  },

  hide: function() {
    this._hidden = true;
    this.close();
    this.actor.hide();
  },

  setScrollbarPolicyAllways: function() {
    this.menu.actor.vscrollbar_policy = Gtk.PolicyType.ALWAYS;
  },

  updateScrollbarPolicy: function(adjustment) {
    if (!this.menu.isOpen) {
      return;
    }
    this.menu.actor.vscrollbar_policy = Gtk.PolicyType.NEVER; 
    let goingToNeedScrollbar = this.needsScrollbar(adjustment);
    this.menu.actor.vscrollbar_policy = 
      goingToNeedScrollbar ? Gtk.PolicyType.ALWAYS : Gtk.PolicyType.NEVER;

    if (goingToNeedScrollbar) {
      this.menu.actor.add_style_pseudo_class('scrolled');
    }
    else {
      this.menu.actor.remove_style_pseudo_class('scrolled');
    }
  },

  needsScrollbar: function(adjustment) {
    //GNOME Shell is really bad at deciding when to reserve space for a scrollbar...
    //This is a reimplementation of:
    //https://github.com/GNOME/gnome-shell/blob/30e17036e8bec8dd47f68eb6b1d3cfe3ca037caf/js/ui/popupMenu.js#L925
    //That takes an optional adjustment value to see if we're going to need a scrollbar in the future.
    //It's not perfect but it works better than the default implementation for our purposes.
    if (!adjustment) {
      adjustment = 0;
    }
    let topMenu = this._getTopMenu();
    let [topMinHeight, topNaturalHeight] = topMenu.actor.get_preferred_height(-1);
    let topThemeNode = topMenu.actor.get_theme_node();
    let topMaxHeight = topThemeNode.get_max_height();
    return topMaxHeight >= 0 && topNaturalHeight + adjustment > topMaxHeight;
  },

  setObjectActive: function(objPath) {
    this.activeObject = objPath;
    this.menu._getMenuItems().forEach(function(listItem) {
      if (listItem.obj == objPath) {
        listItem.setOrnament(PopupMenu.Ornament.DOT);
      }
      else {
        listItem.setOrnament(PopupMenu.Ornament.NONE);
      }
    });
  },
  
  getItem: function(obj) {        
    let menuItems = this.menu._getMenuItems().filter(function(item) {
        return item.obj === obj;  
    });
    if (menuItems && menuItems[0]) {
      return menuItems[0];
    }
    else {
      return null;
    }
  },

  hasUniqueObjPaths: function(objects, isTracklistMetadata) {
    //Check for unique values in the playlist and tracklist object paths.
    let unique = objects.reduce(function(values, object) {
      if (isTracklistMetadata) {
        object = object["mpris:trackid"] ? object["mpris:trackid"].unpack() : "/org/mpris/MediaPlayer2/TrackList/NoTrack";
      }
      else {
        object = object[0];
      }
      values[object] = true;
      return values;
    }, {});
    return Object.keys(unique).length === objects.length;
  }

});

const TrackList = new Lang.Class({
    Name: "Tracklist",
    Extends: ListSubMenu,

  _init: function(label, player) {
    this.parent(label);
    this.player = player;
    this.parseMetadata = Lib.parseMetadata;
  },

  showRatings: function(value) {
    this.setScrollbarPolicyAllways();
    this.menu._getMenuItems().forEach(function(tracklistItem) {
      tracklistItem.showRatings(value);
    });
    this.updateScrollbarPolicy();
  },

  updateMetadata: function(UpdatedMetadata) {
    let metadata = {};
    this.parseMetadata(UpdatedMetadata, metadata);
    let trackListItem = this.getItem(metadata.trackObj);
    if (trackListItem) {
      metadata.fallbackIcon = 'media-optical-cd-audio-symbolic';
      if (Array.isArray(metadata.trackArtist)) {
        metadata.trackArtist = metadata.trackArtist[0];
      }
      if (metadata.isRadio) {
        metadata.fallbackIcon = 'application-rss+xml-symbolic';
      }
      trackListItem.updateMetadata(metadata);
    }
  },

  loadTracklist: function(trackListMetaData, showRatings) {
    this.menu.removeAll();
    //As per spec all object paths MUST be unique.
    //If we don't have unique object paths reject the whole array.
    let hasUniqueObjPaths = this.hasUniqueObjPaths(trackListMetaData, true);
    if (hasUniqueObjPaths) {
      this.setScrollbarPolicyAllways();
      trackListMetaData.forEach(Lang.bind(this, function(trackMetadata) {
        let metadata = {};
        this.parseMetadata(trackMetadata, metadata);
        //Don't add tracks with "/org/mpris/MediaPlayer2/TrackList/NoTrack" as the object path.
        //As per spec the "/org/mpris/MediaPlayer2/TrackList/NoTrack" object path means it's not a valid track.
        if (metadata.trackObj && metadata.trackObj !== '/org/mpris/MediaPlayer2/TrackList/NoTrack') {
          metadata.showRatings = showRatings;
          metadata.fallbackIcon = 'media-optical-cd-audio-symbolic';
          if (Array.isArray(metadata.trackArtist)) {
            metadata.trackArtist = metadata.trackArtist[0];
          }
          if (metadata.isRadio) {
            metadata.fallbackIcon = 'application-rss+xml-symbolic';
          }
          let trackUI = new TracklistItem(metadata);
          trackUI.connect('activate', Lang.bind(this, function() {
            this.player.playTrack(trackUI.obj);
          }));
          this.menu.addMenuItem(trackUI);
        }
      }));
      if (this.activeObject) {
        this.setObjectActive(this.activeObject);
      }
      this.updateScrollbarPolicy();
    }
  }

});

const Playlists = new Lang.Class({
    Name: "Playlists",
    Extends: ListSubMenu,

  _init: function(label, player) {
    this.parent(label);
    this.player = player;
  },

  loadPlaylists: function(playlists) {
    this.menu.removeAll();
    //As per spec all object paths MUST be unique.
    //If we don't have unique object paths reject the whole array.
    let hasUniqueObjPaths = this.hasUniqueObjPaths(playlists);
    if (hasUniqueObjPaths) {
      this.setScrollbarPolicyAllways();
      playlists.forEach(Lang.bind(this, function(playlist) {
        let [obj, name] = playlist;
        //Don't add playlists with just "/" as the object path.
        //Playlist object paths that just contain "/" are a way to
        //indicate invalid playlists as per spec.
        if (obj !== '/') {
          let playlistUI = new PlaylistItem(name, obj);
          playlistUI.connect('activate', Lang.bind(this, function() {
            this.player.playPlaylist(playlistUI.obj);
          }));
          this.menu.addMenuItem(playlistUI);
          }
      }));
      if (this.activeObject) {
        this.setObjectActive(this.activeObject);
      }
      this.updateScrollbarPolicy();
    }
  },

  updatePlaylist: function(UpdatedPlaylist) {
    let [obj, name] = UpdatedPlaylist;
    let playlistItem = this.getItem(obj);
    if (playlistItem) {
      playlistItem.updatePlaylistName(name);
    }
  }

});

const ListSubMenuItem = new Lang.Class({
    Name: "ListSubMenuItem",
    Extends: PopupMenu.PopupBaseMenuItem,

    _init: function () {
        this.parent();
        // We have to replace the _ornamentLabel so that it's vertically centered.
        this.actor.remove_actor(this._ornamentLabel);
        this._ornamentLabel = new St.Label({style_class: 'popup-menu-ornament'});
        this.actor.add(this._ornamentLabel, {y_expand: true, y_fill: false, y_align: St.Align.MIDDLE});
    }

});

const PlaylistItem = new Lang.Class({
    Name: "PlaylistItem",
    Extends: ListSubMenuItem,

    _init: function (text, obj) {
        this.parent();
        this.obj = obj;
        this.label = new St.Label({text: text});
        this.actor.add(this.label);
    },

    updatePlaylistName: function(name) {
      if (this.label.text != name) {
        this.label.text = name;
      }
    }

});

const TracklistItem = new Lang.Class({
    Name: "TracklistItem",
    Extends: ListSubMenuItem,

    _init: function (metadata) {
        this.parent();
        this.obj = metadata.trackObj;
        this._setCoverIconAsync = Lib.setCoverIconAsync;
        this._rating = null;
        this._coverIcon = new St.Icon({icon_name: metadata.fallbackIcon, icon_size: 24});
        if (Settings.MINOR_VERSION > 19) {
          this._coverIcon.add_style_class_name('media-message-cover-icon fallback no-padding');
        }
        this._artistLabel = new St.Label({text: metadata.trackArtist, style_class: 'tracklist-artist'});
        this._titleLabel = new St.Label({text: metadata.trackTitle, style_class: 'track-info-album'});
        this._ratingBox = new St.BoxLayout({style_class: 'star-box'});
        this._ratingBox.hide();
        this._box = new St.BoxLayout({vertical: true});
        this._box.add_child(this._artistLabel);
        this._box.add_child(this._titleLabel);
        this._box.add_child(this._ratingBox);
        this.actor.add(this._coverIcon, {y_expand: false, y_fill: false, y_align: St.Align.MIDDLE});
        this.actor.add(this._box, {y_expand: false, y_fill: false, y_align: St.Align.MIDDLE});
        this._setRating(metadata.trackRating);
        this.showRatings(metadata.showRatings);
        this._setCoverIcon(metadata.trackCoverUrl, metadata.fallbackIcon);
    },

    updateMetadata: function(metadata) {
      this._setCoverIcon(metadata.trackCoverUrl, metadata.fallbackIcon);
      this._setArtist(metadata.trackArtist);
      this._setTitle(metadata.trackTitle);
      this._setRating(metadata.trackRating);
    },

    _setArtist: function(artist) {
      if (this._artistLabel.text != artist) {
        this._artistLabel.text = artist;
      }
    },

    _setTitle: function(title) {
      if (this._titleLabel.text != title) {
        this._titleLabel.text = title;
      }
    },

    _setCoverIcon: function(coverUrl, fallbackIcon) {
      if (coverUrl) {
        this._setCoverIconAsync(this._coverIcon, coverUrl, fallbackIcon);
      }
      else {
        this._coverIcon.icon_name = fallbackIcon;
      }
    },

    _setRating: function(value) {
      value = Math.min(Math.max(0, value), 5);
      if (this._rating != value) {
        this._rating = value;
        this._ratingBox.destroy_all_children();
        for (let i = 0; i < 5; i++) {
          let starIcon;
          let icon_name = 'non-starred-symbolic';
          if (i < value) {
            icon_name = 'starred-symbolic';
          }
          starIcon = new St.Icon({style_class: 'popup-menu-icon star-icon',
                                  icon_name: icon_name
                                 });
          this._ratingBox.add_child(starIcon);
        }
      }
    },

  showRatings: function(value) {
    if (value) {
      this._ratingBox.show();
      this._coverIcon.icon_size = 48;
    }
    else {
      this._ratingBox.hide();
      this._coverIcon.icon_size = 24;
    }
  }

});
