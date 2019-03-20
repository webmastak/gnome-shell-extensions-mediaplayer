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

const CC_BY_SA = '<span size="small">' +
    'All artwork released under the Creative Commons Attribution-ShareAlike 4.0 International license.\n' +
    'See the <a href="https://creativecommons.org/licenses/by-sa/4.0/legalcode">' +
    'CC BY-SA 4.0</a> for details.' +
    '</span>';

const Creators = [
    {label: 'Jonas Wielicki',
     url: 'https://github.com/horazont'},
    {label: 'Jean-Philippe Braun',
     url: 'https://github.com/eonpatapon'},
    {label: 'Mantas Mikulėnas',
     url: 'https://github.com/grawity'},
    {label: 'Jason Gray',
     url: 'https://github.com/JasonLG1979'},
    {label: 'Bilal Elmoussaoui',
     url: 'https://github.com/bil-elmoussaoui'},
    {label: 'Alexander Rüedlinger',
     url: 'https://github.com/lexruee'}
];

const Artists = [
    {label: 'LinxGem33',
     url: 'https://github.com/LinxGem33'},
    {label: 'Jason Gray',
     url: 'https://github.com/JasonLG1979'}
];

const Documenters = [
    {label: 'Jean-Philippe Braun',
     url: 'https://github.com/eonpatapon'},
    {label: 'Jason Gray',
     url: 'https://github.com/JasonLG1979'}
];


const Settings = {
    'indicator-position': {
        type: "e",
        tab: "i",
        label: _("Indicator Position"),
        list: [
            {nick: 'left', name: _("Left"), id: 3},
            {nick: 'center', name: _("Center"), id: 0},
            {nick: 'right', name: _("Right"), id: 1},
            {nick: 'volume-menu', name: _("System menu"), id: 2}
        ]
    },
    'status-text': {
        type: "s",
        tab: "i",
        placeholder_text: "{trackArtist - }{trackTitle}",
        label: _("Indicator Status Text"),
        help: _("{playerName}: Player Name, {trackArtist}: Artist, {trackAlbum}: Album, {trackTitle}: Title. Pango markup supported.")
    },
    'status-size': {
        type: "i",
        tab: "i",
        label: _("Indicator Status Text Width"),
        help: _("The maximum width before the status text gets an ellipsis. Default is 300px."),
        min: 100,
        max: 900,
        step: 5,
        default: 300
    },
    'play-state-icon': {
        type: "b",
        tab: "i",
        label: _("Show the Indicator Player State Icon")
    },
    'button-icon-style': {
        type: "e",
        tab: "p",
        label: _("Player Button Style"),
        list: [
            {nick: 'circular', name: _("Circular"), id: 0},
            {nick: 'small', name: _("Small"), id: 1},
            {nick: 'medium', name: _("Medium"), id: 2},
            {nick: 'large', name: _("Large"), id: 3}
        ]
    },
    'cover-status': {
        type: "b",
        tab: "i",
        label: _("Show the Current Song's Cover in the Panel"),
        help: _("If no cover is available the Media Player's symbolic icon is shown or a generic audio mime type icon.")
    },
    'playstatus': {
        type: "b",
        tab: "i",
        label: _("Show a Play Status Icon for each Media Player")
    },
    'hide-aggindicator': {
        type: "b",
        tab: "i",
        label: _("Always hide the Indicator in the System Menu")
    },
    'volume': {
        type: "b",
        tab: "v",
        label: _("Show the Media Player's Volume Slider")
    },
    'position': {
        type: "b",
        tab: "v",
        label: _("Show the Media Player's Position Slider")
    },
    'playlists': {
        type: "b",
        tab: "v",
        label: _("Show the Media Player's Playlists"),
        help: _("Few Media Players currently support the MPRIS Playlist Interface.")
    },
    'playlist-title': {
        type: "b",
        tab: "v",
        label: _("Show the Current Playlist Title in the main Trackbox"),
        help: _("Few Media Players currently support the MPRIS Playlist Interface.")
    },
    'tracklist': {
        type: "b",
        tab: "v",
        label: _("Show the Media Player's Tracklist"),
        help: _("Very few Media Players currently support the MPRIS Tracklist Interface.")
    },
    'rating': {
        type: "b",
        tab: "v",
        label: _("Display the Current Song's Rating"),
    },
    'tracklist-rating': {
        type: "b",
        tab: "v",
        label: _("Display Song Ratings in the Tracklist"),
        help: _("Very few Media Players currently support the MPRIS Tracklist Interface.")
    },
    'enable-scroll': {
        type: "b",
        tab: "i",
        label: _("Enable Indicator Scroll Events"),
        help: _("Enables track changes on scrolling the Indicator.")
    },
    'active-open': {
        type: "b",
        tab: "i",
        label: _("Always keep the Active Media Player Open"),
        help: _("Always keep the Active Media Player when you open the indicator or system menu.")
    },
    'stop-button': {
        type: "b",
        tab: "p",
        label: _("Always show a Stop Button in the Player Controls"),
        help: _("Otherwise a Stop Button is only shown if the Media Player is Playing but can't be Paused.")
    },
    'loop-status': {
        type: "b",
        tab: "p",
        label: _("Show Shuffle and Repeat Buttons in the Player Controls"),
        help: _("Very few Media players implement this correctly, if at all.")
    },
    'hide-stockmpris': {
        type: "b",
        tab: "i",
        label: _("Hide the built-in GNOME Shell MPRIS Controls")
    },
};

const Frame = GObject.registerClass(class Frame extends Gtk.Box {

    _init(title) {
        super._init({
            orientation: Gtk.Orientation.VERTICAL,
            margin_bottom: 6,
            margin_start: 6,
            margin_end: 6,
            hexpand: true,
            vexpand: true
        });
    }
});

const Notebook = GObject.registerClass(class Notebook extends Gtk.Notebook {

    _init() {
        super._init({
            margin_top: 6,
            margin_bottom: 6,
            margin_start: 6,
            margin_end: 6,
            hexpand: true,
            vexpand: true
        });
    }

    append_page(notebookPage) {
        Gtk.Notebook.prototype.append_page.call(
            this,
            notebookPage,
            notebookPage.getTitleLabel()
        );
    }
});

const NotebookPage = GObject.registerClass(class NotebookPage extends Gtk.Box {

    _init(title) {
        super._init({
            orientation: Gtk.Orientation.VERTICAL,
            homogeneous: false
        });
        this._title = new Gtk.Label({
            label: title,
        });
    }

    getTitleLabel() {
        return this._title;
    }

    addSettingsBox(settingsBox) {
        this.pack_start(settingsBox, false, false, 0);
        let sep = new Gtk.Separator({
            orientation: Gtk.Orientation.HORIZONTAL,
            margin_start: 6,
            margin_end: 6
        });
        this.add(sep);
    }
});

const SettingsLabel = GObject.registerClass(class SettingsLabel extends Gtk.Label {

    _init(label) {
        super._init({
            label: label,
            valign: Gtk.Align.CENTER,
            halign: Gtk.Align.START
        });
    }
});

const SettingsBox = GObject.registerClass(class SettingsBox extends Gtk.Box {

    _init(setting) {
        super._init({
            orientation: Gtk.Orientation.HORIZONTAL,
            margin_top: 6,
            margin_bottom: 6,
            margin_start: 12,
            margin_end: 12
        });

        let label = new SettingsLabel(Settings[setting].label);

        let toolTip = Settings[setting].help;

        if (toolTip) {
            this.set_tooltip_text(toolTip);
        }

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

        this.pack_start(label, true, true, 0);
        this.pack_end(widget, true, true, 0);
    }
});

const SettingsSwitch = GObject.registerClass(class SettingsSwitch extends Gtk.Switch {

    _init(setting) {
        let active = Gsettings.get_boolean(setting);

        super._init({
            valign: Gtk.Align.CENTER,
            halign: Gtk.Align.END,
            active: active
        });

        Gsettings.bind(
            setting,
            this,
            'active',
            Gio.SettingsBindFlags.DEFAULT
        );
    }
});

const SettingsCombo = GObject.registerClass(class SettingsCombo extends Gtk.ComboBoxText {

    _init(setting) {
        super._init({
            valign: Gtk.Align.CENTER,
            halign: Gtk.Align.END
        });

        Settings[setting].list.forEach(Lang.bind(this, function(item) {
            this.append(item.nick, item.name);
            if (item.id == Gsettings.get_enum(setting)) {
                this.set_active(item.id);
            }
        }));

        Gsettings.bind(
            setting,
            this,
            'active-id',
            Gio.SettingsBindFlags.DEFAULT
        );
    }
});

const SettingsEntry = GObject.registerClass(class SettingsEntry extends Gtk.Entry {

    _init(setting) {
        let text = Gsettings.get_string(setting);

        super._init({
            valign: Gtk.Align.CENTER,
            halign: Gtk.Align.END,
            width_chars: 30,
            text: text
        });

        let placeholder_text = Settings[setting].placeholder_text;

        if (placeholder_text) {
            this.set_placeholder_text(placeholder_text);
        }

        Gsettings.bind(
            setting,
            this,
            'text',
            Gio.SettingsBindFlags.DEFAULT
        );
    }
});

const SettingsSpinButton = GObject.registerClass(class SettingsSpinButton extends Gtk.SpinButton {

    _init(setting) {
        let adjustment = new Gtk.Adjustment({
            lower: Settings[setting].min,
            upper: Settings[setting].max,
            step_increment: Settings[setting].step
        });

        let value = Gsettings.get_int(setting);

        super._init({
            valign: Gtk.Align.CENTER,
            halign: Gtk.Align.END,
            climb_rate: 1.0,
            snap_to_ticks: true,
            value: value,
            adjustment: adjustment
        });

        Gsettings.bind(
            setting,
            this,
            'value',
            Gio.SettingsBindFlags.DEFAULT
        );
    }
});

const CreditBox = GObject.registerClass(class CreditBox extends Gtk.Box {

    _init() {
        super._init({
            orientation: Gtk.Orientation.VERTICAL,
            margin_top: 6,
            margin_bottom: 6,
            hexpand: true,
            vexpand: true
        });

        let viewPort = new Gtk.Viewport({
            shadow_type: Gtk.ShadowType.NONE,
            margin_start: 12,
            margin_end: 12,
            hexpand: true,
            vexpand: true
        });

        let scrolledWindow = new Gtk.ScrolledWindow({
            hscrollbar_policy: Gtk.PolicyType.NEVER,
            shadow_type: Gtk.ShadowType.IN,
            margin_start: 12,
            margin_end: 12,
            hexpand: true,
            vexpand: true
        });

        let innerCreditBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            halign: Gtk.Align.CENTER,
            valign: Gtk.Align.CENTER,
            margin_top: 0,
            margin_bottom: 0,
            margin_start: 0,
            margin_end: 0,
            hexpand: true,
            vexpand: true
        });

        let creatorLabel = new Gtk.Label({
            label: _("Created By"),
            halign: Gtk.Align.CENTER,
            margin_top: 0,
            margin_bottom: 0,
            margin_start: 12,
            margin_end: 12,
            hexpand: true,
            vexpand: false
        });

        innerCreditBox.add(creatorLabel);

        Creators.forEach(function(creator) {
            let creatorLinkButton = new Gtk.LinkButton({
                label: creator.label,
                uri: creator.url,
                halign: Gtk.Align.CENTER,
                valign: Gtk.Align.CENTER,
                margin_top: 0,
                margin_bottom: 0,
                margin_start: 12,
                margin_end: 12,
                hexpand: true,
                vexpand: false
             });

             innerCreditBox.add(creatorLinkButton);
        });

        let artistLabel = new Gtk.Label({
            label: _("Artwork By"),
            halign: Gtk.Align.CENTER,
            margin_top: 12,
            margin_bottom: 0,
            margin_start: 12,
            margin_end: 12,
            hexpand: true,
            vexpand: false
        });

        innerCreditBox.add(artistLabel);

        Artists.forEach(function(artist) {
            let artistLinkButton = new Gtk.LinkButton({
                label: artist.label,
                uri: artist.url,
                halign: Gtk.Align.CENTER,
                valign: Gtk.Align.CENTER,
                margin_top: 0,
                margin_bottom: 0,
                margin_start: 12,
                margin_end: 12,
                hexpand: true,
                vexpand: false
             });

             innerCreditBox.add(artistLinkButton);
        });

        let documenterLabel = new Gtk.Label({
            label: _("Documentation By"),
            halign: Gtk.Align.CENTER,
            margin_top: 12,
            margin_bottom: 0,
            margin_start: 12,
            margin_end: 12,
            hexpand: true,
            vexpand: false
        });

        innerCreditBox.add(documenterLabel);

        Documenters.forEach(function(documenter) {
            let documenterButton = new Gtk.LinkButton({
                label: documenter.label,
                uri: documenter.url,
                halign: Gtk.Align.CENTER,
                valign: Gtk.Align.CENTER,
                margin_top: 0,
                margin_bottom: 0,
                margin_start: 12,
                margin_end: 12,
                hexpand: true,
                vexpand: false
             });

             innerCreditBox.add(documenterButton);
        });

        viewPort.add(innerCreditBox);
        scrolledWindow.add(viewPort);
        this.add(scrolledWindow);
    }
});

const AboutPage = GObject.registerClass(class AboutPage extends NotebookPage {

    _init(settings) {
        super._init(_('About'));
        let releaseVersion = Me.metadata['version'] ? _('Version ') + Me.metadata['version'] : 'git-master';
        let projectName = Me.metadata['name'];
        let projectDescription = Me.metadata['description'];
        let projectUrl = Me.metadata['url'];

        let icon = new Gtk.Image({
            icon_name: 'mpi-symbolic',
            pixel_size: 32,
            margin_top: 12,
            margin_start: 12,
            margin_end: 12,
            margin_bottom: 3
        });

        let nameLabel = new Gtk.Label({
            label: '<b>' + projectName + '</b>',
            use_markup: true,
            margin_top: 3,
            margin_start: 12,
            margin_end: 12,
            margin_bottom: 3
        });
        let versionLabel = new Gtk.Label({
            label: releaseVersion,
            margin_top: 3,
            margin_start: 12,
            margin_end: 12,
            margin_bottom: 3
        });

        let projectDescriptionLabel = new Gtk.Label({
            label: projectDescription,
            margin_top: 3,
            margin_start: 12,
            margin_end: 12,
            margin_bottom: 3
        });

        let projectLinkButton = new Gtk.LinkButton({
            label: _('Website'),
            uri: projectUrl,
            margin_top: 3,
            margin_start: 12,
            margin_end: 12,
            margin_bottom: 6
        });

        let creditLabel = new Gtk.Label({
            label: '<small>' + _("Credits") + '</small>',
            use_markup: true,
            margin_start: 12,
            margin_end: 12
        });

        let gnuSofwareLabel = new Gtk.Label({
            label: GNU_SOFTWARE,
            use_markup: true,
            justify: Gtk.Justification.CENTER,
            margin_top: 0,
            margin_start: 12,
            margin_end: 12,
            margin_bottom: 6
        });

        let cLabel = new Gtk.Label({
            label: CC_BY_SA,
            use_markup: true,
            justify: Gtk.Justification.CENTER,
            margin_top: 0,
            margin_start: 12,
            margin_end: 12,
            margin_bottom: 12
        });

        this.add(icon);
        this.add(nameLabel);
        this.add(versionLabel);
        this.add(projectDescriptionLabel);
        this.add(projectLinkButton);
        this.add(creditLabel);
        this.add(new CreditBox());
        this.add(gnuSofwareLabel);
        this.add(cLabel);
    }
});

const PrefsWidget = GObject.registerClass(class PrefsWidget extends Frame {

    _init() {
        super._init();
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

            if (Gtk.get_minor_version() < 20 && setting == "hide-stockmpris") {
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
    Lib.addIcon(Me);
}

function buildPrefsWidget() {
    let widget = new PrefsWidget();
    widget.show_all();
    return widget;
}
