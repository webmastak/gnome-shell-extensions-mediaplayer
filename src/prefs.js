/* -*- mode: js2; js2-basic-offset: 4; indent-tabs-mode: nil -*- */
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

const Gtk = imports.gi.Gtk;
const GObject = imports.gi.GObject;

const Gettext = imports.gettext.domain('gnome-shell-extensions-mediaplayer');
const _ = Gettext.gettext;

const Me = imports.misc.extensionUtils.getCurrentExtension();
const Lib = Me.imports.lib;

let gsettings;
let settings;
let settings_indicator;
let vbox_indicator;

function init() {
    Lib.initTranslations(Me);
    gsettings = Lib.getSettings(Me);
    settings = {
        indicator_position: {
            type: "e",
            label: _("Position in the top panel"),
            help: _("Restart the shell to apply this setting."),
            list: [
                { nick: "center", name: _("Center"), id: 0 },
                { nick: "right", name: _("Right"), id: 1 },
                { nick: "volume-menu", name: _("Volume menu integration"), id: 2 }
            ]
        },
        rundefault: {
            type: "b",
            label: _("Allow to start the default media player"),
            help: _("Runs the default mediaplayer by clicking on the indicator or from the menu")
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
            label: _("Show media player playlists")
        },
        rating: {
            type: "b",
            label: _("Display song rating"),
            help: _("Display the currently playing song's rating on a 0 to 5 scale")
        },
        coversize: {
            type: "r",
            label: _("Album cover size"),
            help: _("The size of the cover displayed in the menu. Default is 80px width."),
            min: 50,
            max: 110,
            step: 5,
            default: 80
        }
    };
    settings_indicator = {
        status_type: {
            type: "e",
            label: _("Appearance"),
            list: [
                { nick: "icon", name: _("Symbolic icon"), id: 0 },
                { nick: "cover", name: _("Current album cover"), id: 1 }
            ]
        },
        status_text: {
            type: "s",
            label: _("Status text"),
            help: _("%a: Artist, %b: Album, %t: Title. Pango markup supported.")
        }
    };
}

function buildPrefsWidget() {
    let frame = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL,
                             border_width: 10});
    let vbox = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL,
                            margin: 20, margin_top: 10 });
    vbox_indicator = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL,
                                  margin_left: 30, margin_bottom: 10});
    let hbox;

    for (setting_indicator in settings_indicator) {
        hbox = buildHbox(settings_indicator, setting_indicator);
        vbox_indicator.add(hbox);
    }

    for (setting in settings) {
        hbox = buildHbox(settings, setting);
        vbox.add(hbox);
        if (setting == "indicator_position")
            vbox.add(vbox_indicator);
    }

    frame.add(vbox);
    frame.show_all();

    if (gsettings.get_enum("indicator-position") == 2)
        vbox_indicator.hide();

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
    if (settings[setting].type == "r")
        hbox = createRangeSetting(settings, setting);
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

        let id = model.get_value(iter, 0)
        gsettings.set_enum(setting.replace('_', '-'), id);

        if (setting == "indicator_position") {
            if (gsettings.get_enum("indicator-position") == 2)
                vbox_indicator.hide();
            else
                vbox_indicator.show();
        }
    });

    if (settings[setting].help) {
        setting_label.set_tooltip_text(settings[setting].help)
        setting_enum.set_tooltip_text(settings[setting].help)
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
    setting_string.connect('notify::text', function(entry) {
        gsettings.set_string(setting.replace('_', '-'), entry.text);
    });

    if (settings[setting].mode == "passwd") {
        setting_string.set_visibility(false);
    }

    if (settings[setting].help) {
        setting_label.set_tooltip_text(settings[setting].help)
        setting_string.set_tooltip_text(settings[setting].help)
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

    let adjustment = new Gtk.Adjustment({ lower: 1, upper: 65535, step_increment: 1});
    let setting_int = new Gtk.SpinButton({adjustment: adjustment,
                                          snap_to_ticks: true});
    setting_int.set_value(gsettings.get_int(setting.replace('_', '-')));
    setting_int.connect('value-changed', function(entry) {
        gsettings.set_int(setting.replace('_', '-'), entry.value);
    });

    if (settings[setting].help) {
        setting_label.set_tooltip_text(settings[setting].help)
        setting_int.set_tooltip_text(settings[setting].help)
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
    setting_switch.connect('notify::active', function(button) {
        gsettings.set_boolean(setting.replace('_', '-'), button.active);
    });

    if (settings[setting].help) {
        setting_label.set_tooltip_text(settings[setting].help)
        setting_switch.set_tooltip_text(settings[setting].help)
    }

    hbox.pack_start(setting_label, true, true, 0);
    hbox.add(setting_switch);

    return hbox;
}

function createRangeSetting(settings, setting) {

    let hbox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL });

    let setting_label = new Gtk.Label({ label: settings[setting].label,
                                        xalign: 0 });

    let setting_range = Gtk.HScale.new_with_range(settings[setting].min,
                                                  settings[setting].max,
                                                  settings[setting].step);
    setting_range.set_value(gsettings.get_int(setting));
    setting_range.set_draw_value(false);
    setting_range.add_mark(settings[setting].default,
                           Gtk.PositionType.BOTTOM, null);
    setting_range.set_size_request(200, -1);
    setting_range.connect('value-changed', function(slider) {
        gsettings.set_int(setting, slider.get_value());
    });

    if (settings[setting].help) {
        setting_label.set_tooltip_text(settings[setting].help)
        setting_range.set_tooltip_text(settings[setting].help)
    }

    hbox.pack_start(setting_label, true, true, 0);
    hbox.add(setting_range);

    return hbox;
}
