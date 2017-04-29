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

'use strict';

const Me = imports.misc.extensionUtils.getCurrentExtension();
const Lib = Me.imports.lib;

const Config = imports.misc.config;

const Gettext = imports.gettext.domain('gnome-shell-extensions-mediaplayer');
const _ = Gettext.gettext;
const N_ = function(t) { return t; };

const MEDIAPLAYER_SETTINGS_SCHEMA = 'org.gnome.shell.extensions.mediaplayer';
const MEDIAPLAYER_INDICATOR_POSITION_KEY = 'indicator-position';
const MEDIAPLAYER_STATUS_TYPE_KEY = 'status-type';
const MEDIAPLAYER_STATUS_TEXT_KEY = 'status-text';
const MEDIAPLAYER_STATUS_SIZE_KEY = 'status-size';
const MEDIAPLAYER_VOLUME_KEY = 'volume';
const MEDIAPLAYER_HIDE_AGGINDICATOR_KEY = 'hide-aggindicator';
const MEDIAPLAYER_POSITION_KEY = 'position';
const MEDIAPLAYER_PLAYLISTS_KEY = 'playlists';
const MEDIAPLAYER_TRACKLIST_KEY = 'tracklist';
const MEDIAPLAYER_TRACKLIST_RATING_KEY = 'tracklist-rating';
const MEDIAPLAYER_RATING_KEY = 'rating';
const MEDIAPLAYER_TRACKBOX_TEMPLATE = 'trackbox-template';
const MEDIAPLAYER_SMALL_COVER_SIZE_KEY = 'small-cover';
const MEDIAPLAYER_LARGE_COVER_SIZE_KEY = 'large-cover';
const MEDIAPLAYER_ENABLE_SCROLL_EVENTS_KEY = 'enable-scroll';
const MEDIAPLAYER_HIDE_STOCK_MPRIS_KEY = 'hide-stockmpris';

const MINOR_VERSION = parseInt(Config.PACKAGE_VERSION.split(".")[1])

const IndicatorPosition = {
    CENTER: 0,
    RIGHT: 1,
    VOLUMEMENU: 2
};

const FADE_ANIMATION_TIME = 0.25;

const Status = {
    STOP: N_("Stopped"),
    PLAY: N_("Playing"),
    PAUSE: N_("Paused"),
    RUN: "Run"
};

const SEND_STOP_ON_CHANGE = [
    "org.mpris.MediaPlayer2.banshee",
    "org.mpris.MediaPlayer2.vlc",
    "org.mpris.MediaPlayer2.pragha"
];

const ALTERNATIVE_PLAYLIST_TITLES = [
    {"Pithos": _("Stations")}
];

const ALTERNATIVE_TRACKLIST_TITLES = [
    {"Pithos": _("Current Playlist")}
];

const PLAYERS_THAT_CANT_STOP = [
    "Pithos",
    "Spotify"
];

const BROKEN_PLAYERS = [
    "Spotify"
];

const IndicatorStatusType = {
    ICON: 0,
    COVER: 1
};

const DEFAULT_PLAYER_OWNER = "org.gnome.shell.extensions.mediaplayer";

let gsettings;

function init() {
    gsettings = Lib.getSettings(Me);
}
