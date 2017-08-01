/* -*- mode: js2; js2-basic-offset: 4; indent-tabs-mode: nil -*- */
/* jshint esnext: true */
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
const Gtk = imports.gi.Gtk;
const GObject = imports.gi.GObject;
const Gio = imports.gi.Gio;

const Gettext = imports.gettext.domain('gnome-shell-extensions-mediaplayer');
const _ = Gettext.gettext;

const Me = imports.misc.extensionUtils.getCurrentExtension();
const Lib = Me.imports.lib;

let gsettings;
let settings;
let settings_indicator;

function init() {
    Lib.initTranslations(Me);
    gsettings = Lib.getSettings(Me);
    settings = {
        indicator_position: {
            type: "e",
            label: _("Indicator position"),
            list: [
                { nick: 'center', name: _("Center"), id: 0 },
                { nick: 'right', name: _("Right"), id: 1 },
                { nick: 'volume-menu', name: _("System menu"), id: 2 }
            ]
        },
        status_text: {
            type: "s",
            label: _("Indicator status text"),
            help: _("{playerName}: Player Name, {trackArtist}: Artist, {trackAlbum}: Album, {trackTitle}: Title. Pango markup supported.")
        },
        status_size: {
            type: "i",
            label: _("Indicator status text width"),
            help: _("The maximum width before the status text gets an ellipsis. Default is 300px."),
            min: 100,
            max: 900,
            step: 5,
            default: 300
        },
        button_icon_size: {
            type: "e",
            label: _("Player button size"),
            list: [
                { nick: 'small', name: _("Small"), id: 0 },
                { nick: 'medium', name: _("Medium"), id: 1 },
                { nick: 'large', name: _("Large"), id: 2 }
            ]
        },
        cover_status: {
            type: "b",
            label: _("Show the current Song's cover in the Panel."),
            help: _("If no cover is available the Player's symbolic icon is shown or a generic audio mime type icon.")
        },
        playstatus: {
            type: "b",
            label: _("Show a Play Status Icon for each Player.")
        },
        hide_aggindicator: {
            type: "b",
            label: _("Always hide the Indicator in the system menu"),
            help: _("Whether to always hide the panel indicator when the extension is in the system menu.")
        },
        volume: {
            type: "b",
            label: _("Show the Media Player's volume slider")
        },
        position: {
            type: "b",
            label: _("Show the Media Player's position slider")
        },
        playlists: {
            type: "b",
            label: _("Show the Media Player's playlists"),
            help: _("Few players currently support the Mpris Playlist Interface.")
        },
        playlist_title: {
            type: "b",
            label: _("Show the current Playlist Title in the main trackbox"),
            help: _("Few players currently support the Mpris Playlist Interface.")
        },
        tracklist: {
            type: "b",
            label: _("Show the Media Player's tracklist"),
            help: _("Very few players currently support the Mpris Tracklist Interface.")
        },
        rating: {
            type: "b",
            label: _("Display the current Song's rating"),
        },
        tracklist_rating: {
            type: "b",
            label: _("Display song ratings in the tracklist"),
        },
        enable_scroll: {
            type: "b",
            label: _("Enable Indicator scroll events"),
            help: _("Enables track changes on scrolling the Indicator.")
        },
        active_open: {
            type: "b",
            label: _("Always keep the active Player open"),
            help: _("Always keep the active player open when you open the indicator or system menu.")
        },
        stop_button: {
            type: "b",
            label: _("Always show a Stop Button in the Player Controls"),
            help: _("Otherwise a Stop Button is only shown if the Player is Playing but can't be Paused.")
        },
        loop_status: {
            type: "b",
            label: _("Show Shuffle and Repeat Buttons in the Player Controls"),
            help: _("Very few player implement this correctly, if at all.")
        }
    };

    if (Gtk.get_minor_version() > 19) {
      settings.hide_stockmpris = {
        type: "b",
        label: _("Hide the built-in Mpris controls"),
        help: _("Whether to hide the built-in Mpris controls.")
      };
    } 
}

function buildPrefsWidget() {
    let frame = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL,
                             border_width: 10});
    let vbox = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL,
                            margin: 20, margin_top: 10 });
    let hbox;

    for (let setting in settings) {
        hbox = buildHbox(settings, setting);
        vbox.add(hbox);
    }

    let githubHbox = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL,
                                  margin_top: 5});

    let githubButton = new Gtk.LinkButton({label: _("Visit the GitHub page to file a bug report or request a feature."),
                                           uri: 'https://github.com/JasonLG1979/gnome-shell-extensions-mediaplayer/wiki/Bug-Reports-and-Feature-Requests'});

    githubHbox.pack_start(githubButton, true, true, 0);
    vbox.add(githubHbox);

    frame.add(vbox);
    frame.show_all();

    return frame;
}

function buildHbox(settings, setting) {
    let hbox;

    if (settings[setting].type == 's')
        hbox = createStringSetting(settings, setting);
    if (settings[setting].type == "i")
        hbox = createIntSetting(settings, setting);
    if (settings[setting].type == "b")
        hbox = createBoolSetting(settings, setting);
    if (settings[setting].type == "e")
        hbox = createEnumSetting(settings, setting);

    return hbox;
}

function createEnumSetting(settings, setting) {

    let hbox = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL,
                            margin_top: 5});

    let setting_label = new Gtk.Label({label: settings[setting].label,
                                       xalign: 0 });

    let setting_enum = new Gtk.ComboBoxText();
    setting_enum.get_style_context().add_class(Gtk.STYLE_CLASS_RAISED);

    settings[setting].list.forEach(function(item) {
      setting_enum.append(item.nick, item.name);
      if (item.id == gsettings.get_enum(setting.replace(/_/g, '-'))) {
        setting_enum.set_active(item.id);
      }
    });

    gsettings.bind(setting.replace(/_/g, '-'), setting_enum, 'active-id', Gio.SettingsBindFlags.DEFAULT);

    if (settings[setting].help) {
        setting_label.set_tooltip_text(settings[setting].help);
        setting_enum.set_tooltip_text(settings[setting].help);
    }

    hbox.pack_start(setting_label, true, true, 0);
    hbox.add(setting_enum);

    return hbox;

}

function createStringSetting(settings, setting) {

    let hbox = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL,
                            margin_top: 5});

    let setting_label = new Gtk.Label({label: settings[setting].label,
                                       xalign: 0 });

    let setting_string = new Gtk.Entry({text: gsettings.get_string(setting.replace(/_/g, '-'))});
    setting_string.set_width_chars(30);
    gsettings.bind(setting.replace(/_/g, '-') , setting_string, 'text', Gio.SettingsBindFlags.DEFAULT);

    if (settings[setting].help) {
        setting_label.set_tooltip_text(settings[setting].help);
        setting_string.set_tooltip_text(settings[setting].help);
    }

    hbox.pack_start(setting_label, true, true, 0);
    hbox.add(setting_string);

    return hbox;
}

function createIntSetting(settings, setting) {

    let hbox = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL,
                            margin_top: 5});

    let setting_label = new Gtk.Label({label: settings[setting].label,
                                       xalign: 0 });

    let adjustment = new Gtk.Adjustment({lower: settings[setting].min,
                                         upper: settings[setting].max,
                                         step_increment: settings[setting].step});
    let setting_int = new Gtk.SpinButton({adjustment: adjustment,
                                          climb_rate: 1.0,
                                          digits: 0,
                                          snap_to_ticks: true});
    gsettings.bind(setting.replace(/_/g, '-') , setting_int, 'value', Gio.SettingsBindFlags.DEFAULT);

    if (settings[setting].help) {
        setting_label.set_tooltip_text(settings[setting].help);
        setting_int.set_tooltip_text(settings[setting].help);
    }

    hbox.pack_start(setting_label, true, true, 0);
    hbox.add(setting_int);

    return hbox;
}

function createBoolSetting(settings, setting) {

    let hbox = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL,
                            margin_top: 5});

    let setting_label = new Gtk.Label({label: settings[setting].label,
                                       xalign: 0 });

    let setting_switch = new Gtk.Switch({active: gsettings.get_boolean(setting.replace(/_/g, '-'))});
    gsettings.bind(setting.replace(/_/g, '-') , setting_switch, 'active', Gio.SettingsBindFlags.DEFAULT);

    if (settings[setting].help) {
        setting_label.set_tooltip_text(settings[setting].help);
        setting_switch.set_tooltip_text(settings[setting].help);
    }

    hbox.pack_start(setting_label, true, true, 0);
    hbox.add(setting_switch);

    return hbox;
}
