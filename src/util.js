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

const Mainloop = imports.mainloop;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Gtk = imports.gi.Gtk;
const Pango = imports.gi.Pango;
const Tweener = imports.ui.tweener;


function setCoverIconAsync(icon, coverUrl, fallback_icon_name, dontAnimate, delay) {
  fallback_icon_name = fallback_icon_name || 'audio-x-generic-symbolic'
  if (coverUrl) {
    let file = Gio.File.new_for_uri(coverUrl);
    file.load_contents_async(null, function(source, result) {
      try {
        let bytes = source.load_contents_finish(result)[1];
        let newIcon = Gio.BytesIcon.new(bytes);
        if (!newIcon.equal(icon.gicon)) {
          if (dontAnimate) {
            icon.gicon = newIcon;
          }
          else if (delay) {
            Mainloop.timeout_add(250, function() {
              animateChange(icon, 'gicon', newIcon);
              return false;
            });
          }
          else {
            animateChange(icon, 'gicon', newIcon);
          }
        }
      }
      catch(err) {
        if (icon.icon_name != fallback_icon_name) {
          if (dontAnimate) {
            icon.icon_name = fallback_icon_name;
          }
          else if (delay) {
            Mainloop.timeout_add(250, function() {
              animateChange(icon, 'icon_name', fallback_icon_name);
              return false;
            });
          }
          else {
            animateChange(icon, 'icon_name', fallback_icon_name);
          }
        }
      }
    });
  }
  else if (icon.icon_name != fallback_icon_name) {
    if (dontAnimate) {
      icon.icon_name = fallback_icon_name;
    }
    else {
      animateChange(icon, 'icon_name', fallback_icon_name);
    }
  }
};

function animateChange(actor, prop, value) {
  Tweener.addTween(actor, {
    opacity: 0,
    time: 0.125,
    onComplete: function() {
      actor[prop] = value;
      Tweener.addTween(actor, {
        opacity: 255,
        time: 0.125
      });
    }
  });
};

function getPlayerSymbolicIcon(desktopEntry, fallback) {
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
  return fallback || 'audio-x-generic-symbolic';
};

function parseMetadata(metadata, state) {
  // Pragha sends a metadata dict with one value on stop
  if (!metadata || Object.keys(metadata).length < 2) {
    metadata = {};
  }
  state.trackUrl = metadata["xesam:url"] ? metadata["xesam:url"].unpack() : "";
  state.trackArtist = metadata["xesam:artist"] ? metadata["xesam:artist"].deep_unpack().join('/') : "";
  state.trackArtist = metadata["rhythmbox:streamTitle"] ? metadata["rhythmbox:streamTitle"].unpack() : state.trackArtist;
  state.trackAlbum = metadata["xesam:album"] ? metadata["xesam:album"].unpack() : "";
  state.trackTitle = metadata["xesam:title"] ? metadata["xesam:title"].unpack() : "";
  state.trackLength = metadata["mpris:length"] ? Math.round(metadata["mpris:length"].unpack() / 1000000) : 0;
  state.trackObj = metadata["mpris:trackid"] ? metadata["mpris:trackid"].unpack() : "/org/mpris/MediaPlayer2/TrackList/NoTrack";
  state.trackCoverUrl = metadata["mpris:artUrl"] ? metadata["mpris:artUrl"].unpack() : "";
  state.trackRating = metadata["xesam:userRating"] ? parseInt(metadata["xesam:userRating"].unpack() * 5) : 'no rating';
  state.trackRating = metadata["pithos:rating"] ? metadata["pithos:rating"].unpack() : state.trackRating;
  state.isRhythmboxStream = metadata["rhythmbox:streamTitle"] ? true : false;
};

var compileTemplate = function(template, playerState) {
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

var _extends = function(object1, object2) {
  Object.getOwnPropertyNames(object2).forEach(function(name, index) {
    let desc = Object.getOwnPropertyDescriptor(object2, name);
    if (! desc.writable)
      Object.defineProperty(object1.prototype, name, desc);
    else {
      object1.prototype[name] = object2[name];
    }
  });
};
