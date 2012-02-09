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

const Gtk = imports.gi.Gtk;

const Gettext = imports.gettext.domain('gnome-shell-extensions-mediaplayer');
const _ = Gettext.gettext;

const Me = imports.misc.extensionUtils.getCurrentExtension();
const Lib = Me.imports.lib;

const SETTINGS_SCHEMA = 'org.gnome.shell.extensions.mediaplayer';

let settings;
let settings_bool;
let settings_range;

function init() {
    Lib.initTranslations(Me);
    settings = Lib.getSettings(Me);
    settings_bool = {
        volumemenu: _("Show the media player in the volume menu"),
        volume: _("Show the media player volume slider"),
        position: _("Show the media player position slider"),
        playlists: _("Show media player playlists")
    };
    settings_range = {
        coversize: { label: _("Album cover size"), min: 50, max: 110, step: 5, default: 80 }
    };
}

function createRangeSetting(setting) {

    let hbox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL });

    let setting_label = new Gtk.Label({ label: settings_range[setting].label,
                                        xalign: 0 });

    let setting_range = Gtk.HScale.new_with_range(settings_range[setting].min,
                                                  settings_range[setting].max,
                                                  settings_range[setting].step);
    setting_range.set_value(settings.get_int(setting));
    setting_range.set_draw_value(false);
    setting_range.add_mark(settings_range[setting].default,
                           Gtk.PositionType.BOTTOM, null);
    setting_range.set_size_request(200, -1);
    setting_range.connect('value-changed', function(slider) {
        settings.set_int(setting, slider.get_value());
    });

    hbox.pack_start(setting_label, true, true, 0);
    hbox.add(setting_range);

    return hbox;
}

function createBoolSetting(setting) {

    let hbox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL });

    let setting_label = new Gtk.Label({ label: settings_bool[setting],
                                        xalign: 0 });

    let setting_switch = new Gtk.Switch({active: settings.get_boolean(setting)});
    setting_switch.connect('notify::active', function(button) {
        settings.set_boolean(setting, button.active);
    });

    hbox.pack_start(setting_label, true, true, 0);
    hbox.add(setting_switch);

    return hbox;
}

function buildPrefsWidget() {
    let frame = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL,
                              border_width: 10 });
    let vbox = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL,
                             margin: 20, margin_top: 10 });

    for (setting in settings_bool) {
        let hbox = createBoolSetting(setting);
        vbox.add(hbox);
    }

    for (setting in settings_range) {
        let hbox = createRangeSetting(setting);
        vbox.add(hbox);
    }

    frame.add(vbox);
    frame.show_all();
    return frame;
}
