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
const Lang = imports.lang;

const Gettext = imports.gettext.domain('gnome-shell-extensions-mediaplayer');
const _ = Gettext.gettext;

const Me = imports.misc.extensionUtils.getCurrentExtension();
const Lib = Me.imports.lib;

const Gsettings = Lib.getSettings(Me);

const Settings = {
    indicator_position: {
        type: "e",
        tab: "i",
        label: _("Indicator Position"),
        list: [
            {nick: 'center', name: _("Center"), id: 0},
            {nick: 'right', name: _("Right"), id: 1},
            {nick: 'volume-menu', name: _("System menu"), id: 2}
        ]
    },
    status_text: {
        type: "s",
        tab: "i",
        placeholder_text: "{trackArtist - }{trackTitle}",
        label: _("Indicator Status Text"),
        help: _("{playerName}: Player Name, {trackArtist}: Artist, {trackAlbum}: Album, {trackTitle}: Title. Pango markup supported.")
    },
    status_size: {
        type: "i",
        tab: "i",
        label: _("Indicator Status Text Width"),
        help: _("The maximum width before the status text gets an ellipsis. Default is 300px."),
        min: 100,
        max: 900,
        step: 5,
        default: 300
    },
    button_icon_size: {
        type: "e",
        tab: "p",
        label: _("Player Button Size"),
        list: [
            {nick: 'small', name: _("Small"), id: 0},
            {nick: 'medium', name: _("Medium"), id: 1},
            {nick: 'large', name: _("Large"), id: 2}
        ]
    },
    cover_status: {
        type: "b",
        tab: "i",
        label: _("Show the Current Song's Cover in the Panel"),
        help: _("If no cover is available the Player's symbolic icon is shown or a generic audio mime type icon.")
    },
    playstatus: {
        type: "b",
        tab: "i",
        label: _("Show a Play Status Icon for each Media Player")
    },
    hide_aggindicator: {
        type: "b",
        tab: "i",
        label: _("Always hide the Indicator in the System Menu")
    },
    volume: {
        type: "b",
        tab: "v",
        label: _("Show the Media Player's Volume Slider")
    },
    position: {
        type: "b",
        tab: "v",
        label: _("Show the Media Player's Position Slider")
    },
    playlists: {
        type: "b",
        tab: "v",
        label: _("Show the Media Player's Playlists"),
        help: _("Few players currently support the Mpris Playlist Interface.")
    },
    playlist_title: {
        type: "b",
        tab: "v",
        label: _("Show the Current Playlist Title in the main Trackbox"),
        help: _("Few players currently support the Mpris Playlist Interface.")
    },
    tracklist: {
        type: "b",
        tab: "v",
        label: _("Show the Media Player's Tracklist"),
        help: _("Very few players currently support the Mpris Tracklist Interface.")
    },
    rating: {
        type: "b",
        tab: "v",
        label: _("Display the Current Song's Rating"),
    },
    tracklist_rating: {
        type: "b",
        tab: "v",
        label: _("Display Song Ratings in the Tracklist"),
    },
    enable_scroll: {
        type: "b",
        tab: "i",
        label: _("Enable Indicator Scroll Events"),
        help: _("Enables track changes on scrolling the Indicator.")
    },
    active_open: {
        type: "b",
        tab: "i",
        label: _("Always keep the Active Media Player Open"),
        help: _("Always keep the active player open when you open the indicator or system menu.")
    },
    stop_button: {
        type: "b",
        tab: "p",
        label: _("Always show a Stop Button in the Player Controls"),
        help: _("Otherwise a Stop Button is only shown if the Player is Playing but can't be Paused.")
    },
    loop_status: {
        type: "b",
        tab: "p",
        label: _("Show Shuffle and Repeat Buttons in the Player Controls"),
        help: _("Very few player implement this correctly, if at all.")
    },
    hide_stockmpris: {
        type: "b",
        tab: "i",
        label: _("Hide the built-in GNOME Shell Mpris Controls")
    },
};

const Frame = new GObject.Class({
    Name: 'Frame',
    GTypeName: 'Frame',
    Extends: Gtk.Box,

    _init: function(title) {
        this.parent({
            orientation: Gtk.Orientation.VERTICAL,
            margin_bottom: 6,
            margin_start: 6,
            margin_end: 6,
            width_request: 600,
            hexpand: true,
            vexpand: true
        });
    }
});

const Notebook = new GObject.Class({
    Name: 'Notebook',
    GTypeName: 'Notebook',
    Extends: Gtk.Notebook,

    _init: function() {
        this.parent({
            margin_top: 6,
            margin_bottom: 6,
            margin_start: 6,
            margin_end: 6,
            hexpand: true,
            vexpand: true,
            valign: Gtk.Align.CENTER,
            halign: Gtk.Align.CENTER
        });
    },

    append_page: function(notebookPage) {
        Gtk.Notebook.prototype.append_page.call(
            this,
            notebookPage,
            notebookPage.getTitleLabel()
        );
    }
});

const NotebookPage = new GObject.Class({
    Name: 'NotebookPage',
    GTypeName: 'NotebookPage',
    Extends: Gtk.Box,

    _init: function(title) {
        this.parent({
            orientation: Gtk.Orientation.VERTICAL,
            homogeneous: false,
            hexpand: true,
            vexpand: true
        });
        this._title = new Gtk.Label({
            label: "<b>" + title + "</b>",
            use_markup: true,
            valign: Gtk.Align.CENTER,
            halign: Gtk.Align.CENTER,
            margin_start: 12,
            margin_end: 12
        });
    },

    getTitleLabel: function() {
        return this._title;
    },

    addSettingsBox: function(settingsBox) {
        this.pack_start(settingsBox, false, false, 0);
        let sep = new Gtk.Separator({
            orientation: Gtk.Orientation.HORIZONTAL,
            margin_start: 6,
            margin_end: 6
        });
        this.add(sep);
    }
});

const SettingsLabel = new GObject.Class({
    Name: 'SettingsLabel',
    GTypeName: 'SettingsLabel',
    Extends: Gtk.Label,

    _init: function(label) {
        this.parent({
            label: label,
            valign: Gtk.Align.CENTER,
            halign: Gtk.Align.START,
            hexpand: true,
            vexpand: false
        });
    }
});

const SettingsBox = new GObject.Class({
    Name: 'SettingsBox',
    GTypeName: 'SettingsBox',
    Extends: Gtk.Box,

    _init: function(text, widget, toolTip) {
        this.parent({
            orientation: Gtk.Orientation.HORIZONTAL,
            margin_top: 6,
            margin_bottom: 6,
            margin_start: 12,
            margin_end: 12,
            width_request: 600,
            hexpand: true,
            vexpand: false
        });

        if (toolTip) {
            this.set_tooltip_text(toolTip);
        }

        let label = new SettingsLabel(text);

        this.pack_start(label, true, true, 0);
        this.pack_end(widget, true, true, 0);
    }
});

const SettingsSwitch = new GObject.Class({
    Name: 'SettingsSwitch',
    GTypeName: 'SettingsSwitch',
    Extends: Gtk.Switch,

    _init: function(setting) {
        let active = Gsettings.get_boolean(setting.replace(/_/g, '-'));

        this.parent({
            valign: Gtk.Align.CENTER,
            halign: Gtk.Align.END,
            active: active,
            hexpand: false,
            vexpand: false
        });

        Gsettings.bind(
            setting.replace(/_/g, '-'),
            this,
            'active',
            Gio.SettingsBindFlags.DEFAULT
        );
    }
});

const SettingsCombo = new GObject.Class({
    Name: 'SettingsCombo',
    GTypeName: 'SettingsCombo',
    Extends: Gtk.ComboBoxText,

    _init: function(setting) {
        this.parent({
            valign: Gtk.Align.CENTER,
            halign: Gtk.Align.END,
            hexpand: false,
            vexpand: false
        });

        Settings[setting].list.forEach(Lang.bind(this, function(item) {
            this.append(item.nick, item.name);
            if (item.id == Gsettings.get_enum(setting.replace(/_/g, '-'))) {
                this.set_active(item.id);
            }
        }));

        Gsettings.bind(
            setting.replace(/_/g, '-'),
            this,
            'active-id',
            Gio.SettingsBindFlags.DEFAULT
        );
    }
});

const SettingsEntry = new GObject.Class({
    Name: 'SettingsEntry',
    GTypeName: 'SettingsEntry',
    Extends: Gtk.Entry,

    _init: function(setting) {
        let text = Gsettings.get_string(setting.replace(/_/g, '-'));
        let placeholder_text = Settings[setting].placeholder_text || "";

        this.parent({
            valign: Gtk.Align.CENTER,
            halign: Gtk.Align.END,
            width_chars: 30,
            text: text,
            placeholder_text: placeholder_text,
            hexpand: false,
            vexpand: false
        });

        Gsettings.bind(
            setting.replace(/_/g, '-'),
            this,
            'text',
            Gio.SettingsBindFlags.DEFAULT
        );
    }
});

const SettingsSpinButton = new GObject.Class({
    Name: 'SettingsSpinButton',
    GTypeName: 'SettingsSpinButton',
    Extends: Gtk.SpinButton,

    _init: function(setting) {
        let adjustment = new Gtk.Adjustment({
            lower: Settings[setting].min,
            upper: Settings[setting].max,
            step_increment: Settings[setting].step
        });

        let value = Gsettings.get_int(setting.replace(/_/g, '-'));

        this.parent({
            valign: Gtk.Align.CENTER,
            halign: Gtk.Align.END,
            climb_rate: 1.0,
            snap_to_ticks: true,
            value: value,
            adjustment: adjustment,
            hexpand: false,
            vexpand: false
        });

        Gsettings.bind(
            setting.replace(/_/g, '-'),
            this,
            'value',
            Gio.SettingsBindFlags.DEFAULT
        );
    }
});

const PrefsWidget = new GObject.Class({
    Name: 'PrefsWidget',
    GTypeName: 'PrefsWidget',
    Extends: Frame,

    _init: function() {
        this.parent();
        this._notebook = new Notebook();

        this._indicatorPage = new NotebookPage(_("Indicator"));
        this._notebook.append_page(this._indicatorPage);

        this._playerControlsPage = new NotebookPage(_("Player Controls"));
        this._notebook.append_page(this._playerControlsPage);

        this._visibleWidgetsPage = new NotebookPage(_("Visible Widgets"));
        this._notebook.append_page(this._visibleWidgetsPage);

        this.pack_start(this._notebook, true, true, 0);

        let githubHbox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            margin_top: 6,
            margin_bottom: 6,
            margin_start: 12,
            margin_end: 12,
            width_request: 600,
            hexpand: false,
            vexpand: false
         });

        let githubButton = new Gtk.LinkButton({
            label: _("Visit the GitHub page to file a bug report or request a feature."),
            uri: 'https://github.com/JasonLG1979/gnome-shell-extensions-mediaplayer/wiki/Bug-Reports-and-Feature-Requests'
        });

        githubHbox.pack_start(githubButton, true, true, 0);
        this.pack_end(githubHbox, true, true, 0);

        this._buildPages();
    },

    _buildPages: function() {
        for (let setting in Settings) { 
            this._putInPage(setting);
        }
    },

    _putInPage: function(setting) {
        let widget = this._getWidget(setting);
        let toolTip = Settings[setting].help || null;
        let settingsBox = new SettingsBox(Settings[setting].label, widget, toolTip);
        if (Gtk.get_minor_version() < 20 && setting == "hide_stockmpris") {
            settingsBox.set_sensitive(false);
        }

        if (Settings[setting].tab == "i") {
           this._indicatorPage.addSettingsBox(settingsBox);
        }
        if (Settings[setting].tab == "p") {
           this._playerControlsPage.addSettingsBox(settingsBox);
        }
        if (Settings[setting].tab == "v") {
           this._visibleWidgetsPage.addSettingsBox(settingsBox);
        }
    },

    _getWidget: function(setting) {
        if (Settings[setting].type == 's') {
            return new SettingsEntry(setting);
        }
        if (Settings[setting].type == "i") {
            return new SettingsSpinButton(setting);
        }
        if (Settings[setting].type == "b") {
            return new SettingsSwitch(setting);
        }
        if (Settings[setting].type == "e") {
            return new SettingsCombo(setting);
        }

    }
});    

function init() {
    Lib.initTranslations(Me); 
}

function buildPrefsWidget() {
    let widget = new PrefsWidget();
    widget.show_all();
    return widget;
}
