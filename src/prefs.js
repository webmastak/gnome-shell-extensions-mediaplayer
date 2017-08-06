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

const GNU_SOFTWARE = '<span size="small">' +
    'This program comes with absolutely no warranty.\n' +
    'See the <a href="https://gnu.org/licenses/old-licenses/gpl-2.0.html">' +
	'GNU General Public License, version 2 or later</a> for details.' +
	'</span>';

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
        help: _("If no cover is available the Media Player's symbolic icon is shown or a generic audio mime type icon.")
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
        help: _("Few Media Players currently support the MPRIS Playlist Interface.")
    },
    playlist_title: {
        type: "b",
        tab: "v",
        label: _("Show the Current Playlist Title in the main Trackbox"),
        help: _("Few Media Players currently support the MPRIS Playlist Interface.")
    },
    tracklist: {
        type: "b",
        tab: "v",
        label: _("Show the Media Player's Tracklist"),
        help: _("Very few Media Players currently support the MPRIS Tracklist Interface.")
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
        help: _("Always keep the Active Media Player when you open the indicator or system menu.")
    },
    stop_button: {
        type: "b",
        tab: "p",
        label: _("Always show a Stop Button in the Player Controls"),
        help: _("Otherwise a Stop Button is only shown if the Media Player is Playing but can't be Paused.")
    },
    loop_status: {
        type: "b",
        tab: "p",
        label: _("Show Shuffle and Repeat Buttons in the Player Controls"),
        help: _("Very few Media players implement this correctly, if at all.")
    },
    hide_stockmpris: {
        type: "b",
        tab: "i",
        label: _("Hide the built-in GNOME Shell MPRIS Controls")
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
            vexpand: true
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
            homogeneous: false
        });
        this._title = new Gtk.Label({
            label: "<b>" + title + "</b>",
            use_markup: true
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
            halign: Gtk.Align.START
        });
    }
});

const SettingsBox = new GObject.Class({
    Name: 'SettingsBox',
    GTypeName: 'SettingsBox',
    Extends: Gtk.Box,

    _init: function(setting) {
        this.parent({
            orientation: Gtk.Orientation.HORIZONTAL,
            margin_top: 6,
            margin_bottom: 6,
            margin_start: 12,
            margin_end: 12
        });

        let label = new SettingsLabel(Settings[setting].label);
        
        let widget;

        if (Settings[setting].type == 's') {
            widget = new SettingsEntry(setting);
        }
        if (Settings[setting].type == "i") {
            widget = new SettingsSpinButton(setting);
        }
        if (Settings[setting].type == "b") {
            widget = new SettingsSwitch(setting);
        }
        if (Settings[setting].type == "e") {
            widget = new SettingsCombo(setting);
        }

        if (Settings[setting].help) {
            this.set_tooltip_text(Settings[setting].help);
        }

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
            active: active
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
            halign: Gtk.Align.END
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
            placeholder_text: placeholder_text
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
            adjustment: adjustment
        });

        Gsettings.bind(
            setting.replace(/_/g, '-'),
            this,
            'value',
            Gio.SettingsBindFlags.DEFAULT
        );
    }
});

const AboutPage = new Lang.Class({
    Name: 'AboutPage',
    Extends: NotebookPage,

    _init: function(settings) {
        this.parent(_('About'));
        let releaseVersion = Me.metadata['version'] || 'bleeding-edge ;-)';
        let projectDescription = Me.metadata['description'];
        let projectUrl = Me.metadata['url'];

        let menuLabel = new Gtk.Label({
            label: '<b><big>' + _('Media Player Indicator') + '</big></b>',
            use_markup: true,
            margin_top: 6,
            margin_start: 12,
            margin_end: 12
        });
        let versionLabel = new Gtk.Label({
        	label:  _('version: ') + releaseVersion,
                margin_bottom: 6,
                margin_start: 12,
                margin_end: 12
        });
        let projectLinkButton = new Gtk.LinkButton({
            label: _('Website'),
            uri: projectUrl,
            margin_top: 6,
            margin_bottom: 6,
            margin_start: 12,
            margin_end: 12
        });

        let gnuSofwareLabel = new Gtk.Label({
            label: GNU_SOFTWARE,
            use_markup: true,
            justify: Gtk.Justification.CENTER,
            margin_top: 6,
            margin_bottom: 6,
            margin_start: 12,
            margin_end: 12
        });

        this.add(menuLabel);
        this.add(versionLabel);
        this.add(projectLinkButton);
        this.add(gnuSofwareLabel);
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

        this._notebook.append_page(new AboutPage());

        this.pack_start(this._notebook, true, true, 0);

        let settingsBox;

        for (let setting in Settings) { 
            settingsBox = new SettingsBox(setting);

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
