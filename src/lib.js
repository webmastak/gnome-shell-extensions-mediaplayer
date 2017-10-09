/* -*- mode: js2; js2-basic-offset: 4; indent-tabs-mode: nil -*- */
/* jshint esnext: true */
/* jshint -W097 */
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

const Gtk = imports.gi.Gtk;
const Gio = imports.gi.Gio;
const Gettext = imports.gettext;

function getSettings(extension) {
    let schemaName = 'org.gnome.shell.extensions.mediaplayer';
    let schemaDir = extension.dir.get_child('schemas').get_path();
    let schemaSource = Gio.SettingsSchemaSource.new_from_directory(schemaDir,
                           Gio.SettingsSchemaSource.get_default(),
                           false);
    let schema = schemaSource.lookup(schemaName, false);

    return new Gio.Settings({ settings_schema: schema });
}

function initTranslations(extension) {
    let localeDir = extension.dir.get_child('locale').get_path();
    Gettext.bindtextdomain('gnome-shell-extensions-mediaplayer', localeDir);
}

function addIcon(extension) {
    let iconPath = extension.dir.get_path();
    Gtk.IconTheme.get_default().append_search_path(iconPath);
}
