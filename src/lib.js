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

const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Gtk = imports.gi.Gtk;
const Gettext = imports.gettext;
const Pango = imports.gi.Pango;

function getSettings(extension) {
    let schemaName = 'org.gnome.shell.extensions.mediaplayer';
    let schemaDir = extension.dir.get_child('schemas').get_path();

    // Extension installed in .local
    if (GLib.file_test(schemaDir + '/gschemas.compiled', GLib.FileTest.EXISTS)) {
        let schemaSource = Gio.SettingsSchemaSource.new_from_directory(schemaDir,
                                  Gio.SettingsSchemaSource.get_default(),
                                  false);
        let schema = schemaSource.lookup(schemaName, false);

        return new Gio.Settings({ settings_schema: schema });
    }
    // Extension installed system-wide
    else {
        if (Gio.Settings.list_schemas().indexOf(schemaName) == -1)
            throw "Schema \"%s\" not found.".format(schemaName);
        return new Gio.Settings({ schema: schemaName });
    }
}

function initTranslations(extension) {
    let localeDir = extension.dir.get_child('locale').get_path();

    // Extension installed in .local
    if (GLib.file_test(localeDir, GLib.FileTest.EXISTS)) {
        Gettext.bindtextdomain('gnome-shell-extensions-mediaplayer', localeDir);
    }
    // Extension installed system-wide
    else {
        Gettext.bindtextdomain('gnome-shell-extensions-mediaplayer', extension.metadata.locale);
    }
}

function setCoverIconAsync(icon, coverUrl, fallback_icon_name) {
  fallback_icon_name = fallback_icon_name || 'audio-x-generic-symbolic'
  if (coverUrl) {
    let file = Gio.File.new_for_uri(coverUrl);
    file.load_contents_async(null, function(source, result) {
      try {
        let bytes = source.load_contents_finish(result)[1];
        icon.gicon = Gio.BytesIcon.new(bytes);
      }
      catch(err) {
        if (icon.icon_name != fallback_icon_name) {
          icon.icon_name = fallback_icon_name;
        }
      }
    });
  }
  else if (icon.icon_name != fallback_icon_name) {
    icon.icon_name = fallback_icon_name;
  }
}

function getPlayerSymbolicIcon(desktopEntry) {
  if (desktopEntry) {
    //The Player's symbolic Icon name *should* be it's
    //Desktop Entry + '-symbolic'.
    //For example, Pithos:
    //Desktop Entry - 'io.github.Pithos'
    //Symbolic Icon Name - 'io.github.Pithos-symbolic' 
    let possibleIconName = desktopEntry + '-symbolic';
    let currentIconTheme = Gtk.IconTheme.get_default();
    let IconExists = currentIconTheme.has_icon(possibleIconName);
    if (IconExists) {
      return possibleIconName;
    }
  }
  return 'audio-x-generic-symbolic';
}

function parseMetadata(metadata, state) {
  // Pragha sends a metadata dict with one value on stop
  if (!metadata || Object.keys(metadata).length < 2) {
    metadata = {};
  }
  for (let prop in metadata) {
    metadata[prop] = metadata[prop].deep_unpack();
  }

  state.trackUrl = metadata["xesam:url"] && metadata["xesam:url"].constructor === String ? metadata["xesam:url"] : "";
  state.trackArtist = metadata["xesam:artist"] && Array.isArray(metadata["xesam:artist"]) ? metadata["xesam:artist"].join(', ') : "";
  state.trackAlbum = metadata["xesam:album"] && metadata["xesam:album"].constructor === String ? metadata["xesam:album"] : "";
  state.trackTitle = metadata["xesam:title"] && metadata["xesam:title"].constructor === String ? metadata["xesam:title"] : "";
  state.trackLength = metadata["mpris:length"] && metadata["mpris:length"].constructor === Number ? metadata["mpris:length"] / 1000000 : 0;
  state.trackObj = metadata["mpris:trackid"] && metadata["mpris:trackid"].constructor === String ? metadata["mpris:trackid"] : "/org/mpris/MediaPlayer2/TrackList/NoTrack";
  state.trackCoverUrl = metadata["mpris:artUrl"] && metadata["mpris:artUrl"].constructor === String ? metadata["mpris:artUrl"] : "";
  state.pithosRating = metadata["pithos:rating"] && metadata["pithos:rating"].constructor === String ? metadata["pithos:rating"] : "";
  state.trackRating = metadata["xesam:userRating"] && metadata["xesam:userRating"].constructor === Number ? parseInt(metadata["xesam:userRating"] * 5) : 0;
  state.trackRating = metadata.rating && metadata.rating.constructor === Number ? parseInt(metadata.rating) : state.trackRating;
};

let compileTemplate = function(template, playerState) {
  let escapedText = template.replace(/{(\w+)\|?([^}]*)}/g, function(match, fieldName, appendText) {
    let text = "";
    if (playerState[fieldName] && playerState[fieldName].toString() !== "") {
      text = playerState[fieldName].toString() + appendText;
      text = GLib.markup_escape_text(text, -1);
    }
    return text;
  });
  //Validate Pango markup.
  try {
    let validMarkup = Pango.parse_markup(escapedText, -1, '')[0];
    if (!validMarkup) {
      escapedText = 'Invalid Syntax';
    }        
  }
  catch(err) {
    escapedText = 'Invalid Syntax';
  }
  return escapedText;
};

let _extends = function(object1, object2) {
  Object.getOwnPropertyNames(object2).forEach(function(name, index) {
    let desc = Object.getOwnPropertyDescriptor(object2, name);
    if (! desc.writable)
      Object.defineProperty(object1.prototype, name, desc);
    else {
      object1.prototype[name] = object2[name];
    }
  });
};
