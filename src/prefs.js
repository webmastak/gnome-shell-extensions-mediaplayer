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
                { name: _("Center"), id: 0 },
                { name: _("Right"), id: 1 },
                { name: _("System menu"), id: 2 }
            ]
        },
        status_type: {
            type: "e",
            label: _("Indicator appearance"),
            list: [
                { name: _("Symbolic icon"), id: 0 },
                { name: _("Current album cover"), id: 1 }
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
        start_zoomed: {
            type: "b",
            label: _("Start with the cover zoomed"),
            help: _("Always start with the cover zoomed out (Large).")
        },
        raise_click: {
            type: "b",
            label: _("Raise the Player when the cover is clicked"),
            help: _("Raise the Player when the cover is clicked instead of zooming in or out.")
        },
        hide_aggindicator: {
            type: "b",
            label: _("Always hide the indicator in the system menu"),
            help: _("Whether to always hide the panel indicator when the extension is in the system menu.")
        },
        volume: {
            type: "b",
            label: _("Show the media player volume slider")
        },
        position: {
            type: "b",
            label: _("Show the media player position slider")
        },
        playlists: {
            type: "b",
            label: _("Show the media player playlists"),
            help: _("Few players currently support the Mpris Playlist Interface.")
        },
        tracklist: {
            type: "b",
            label: _("Show the media player tracklist"),
            help: _("Very few players currently support the Mpris Tracklist Interface.")
        },
        rating: {
            type: "b",
            label: _("Display the current song's rating"),
            help: _("Display the currently playing song's rating on a 0 to 5 scale")
        },
        tracklist_rating: {
            type: "b",
            label: _("Display song ratings in the tracklist"),
            help: _("Display the ratings of the songs in tracklist on a 0 to 5 scale")
        },
        enable_scroll: {
            type: "b",
            label: _("Enable Indicator scroll events"),
            help: _("Enables track changes on scrolling the Indicator.")
        },
        active_open: {
            type: "b",
            label: _("Always keep the active player open"),
            help: _("Always keep the active player open when you open the indicator or system menu.")
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

    let model = new Gtk.ListStore();
    model.set_column_types([GObject.TYPE_INT, GObject.TYPE_STRING]);
    let setting_enum = new Gtk.ComboBox({model: model});
    setting_enum.get_style_context().add_class(Gtk.STYLE_CLASS_RAISED);
    let renderer = new Gtk.CellRendererText();
    setting_enum.pack_start(renderer, true);
    setting_enum.add_attribute(renderer, 'text', 1);

    for (let i=0; i<settings[setting].list.length; i++) {
        let item = settings[setting].list[i];
        let iter = model.append();
        model.set(iter, [0, 1], [item.id, item.name]);
        if (item.id == gsettings.get_enum(setting.replace('_', '-'))) {
            setting_enum.set_active(item.id);
        }
    }

    setting_enum.connect('changed', function(entry) {
        let [success, iter] = setting_enum.get_active_iter();
        if (!success)
            return;

        let id = model.get_value(iter, 0);
        gsettings.set_enum(setting.replace('_', '-'), id);
    });

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

    let setting_string = new Gtk.Entry({text: gsettings.get_string(setting.replace('_', '-'))});
    setting_string.set_width_chars(30);
    gsettings.bind(setting.replace('_', '-') , setting_string, 'text', Gio.SettingsBindFlags.DEFAULT);

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
    gsettings.bind(setting.replace('_', '-') , setting_int, 'value', Gio.SettingsBindFlags.DEFAULT);

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

    let setting_switch = new Gtk.Switch({active: gsettings.get_boolean(setting.replace('_', '-'))});
    gsettings.bind(setting.replace('_', '-') , setting_switch, 'active', Gio.SettingsBindFlags.DEFAULT);

    if (settings[setting].help) {
        setting_label.set_tooltip_text(settings[setting].help);
        setting_switch.set_tooltip_text(settings[setting].help);
    }

    hbox.pack_start(setting_label, true, true, 0);
    hbox.add(setting_switch);

    return hbox;
}
