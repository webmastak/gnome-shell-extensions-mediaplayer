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

var MEDIAPLAYER_INDICATOR_POSITION_KEY = 'indicator-position';
var MEDIAPLAYER_COVER_STATUS_KEY = 'cover-status';
var MEDIAPLAYER_STATUS_TEXT_KEY = 'status-text';
var MEDIAPLAYER_STATUS_SIZE_KEY = 'status-size';
var MEDIAPLAYER_PLAY_STATE_ICON_KEY = 'play-state-icon';
var MEDIAPLAYER_VOLUME_KEY = 'volume';
var MEDIAPLAYER_HIDE_AGGINDICATOR_KEY = 'hide-aggindicator';
var MEDIAPLAYER_POSITION_KEY = 'position';
var MEDIAPLAYER_PLAYLISTS_KEY = 'playlists';
var MEDIAPLAYER_STOP_BUTTON_KEY = 'stop-button';
var MEDIAPLAYER_BUTTON_ICON_STYLE_KEY = 'button-icon-style';
var MEDIAPLAYER_PLAYLIST_TITLE_KEY = 'playlist-title';
var MEDIAPLAYER_TRACKLIST_KEY = 'tracklist';
var MEDIAPLAYER_TRACKLIST_RATING_KEY = 'tracklist-rating';
var MEDIAPLAYER_LOOP_STATUS_KEY = 'loop-status';
var MEDIAPLAYER_RATING_KEY = 'rating';
var MEDIAPLAYER_ENABLE_SCROLL_EVENTS_KEY = 'enable-scroll';
var MEDIAPLAYER_HIDE_STOCK_MPRIS_KEY = 'hide-stockmpris';
var MEDIAPLAYER_KEEP_ACTIVE_OPEN_KEY = 'active-open';
var MEDIAPLAYER_PLAY_STATUS_ICON_KEY = 'playstatus';

var MINOR_VERSION = parseInt(Config.PACKAGE_VERSION.split(".")[1])

var IndicatorPosition = {
    LEFT: 3,
    CENTER: 0,
    RIGHT: 1,
    VOLUMEMENU: 2
};

var ButtonIconStyles = {
    CIRCULAR: 0,
    SMALL: 1,
    MEDIUM: 2,
    LARGE: 3
};

var Status = {
    STOP: "Stopped",
    PLAY: "Playing",
    PAUSE: "Paused"
};

var ValidPlaybackStatuses = [
    'Stopped',
    'Playing',
    'Paused'
];

var SUPPORTS_RATINGS_EXTENSION = [
    "org.mpris.MediaPlayer2.Lollypop"
];

var WRONG_VOLUME_SCALING = [
    "org.mpris.MediaPlayer2.quodlibet"
];

var ALTERNATIVE_PLAYLIST_TITLES = [
    {"org.mpris.MediaPlayer2.pithos": _("Stations")}
];

var ALTERNATIVE_TRACKLIST_TITLES = [
    {"org.mpris.MediaPlayer2.pithos": _("Current Playlist")}
];

var BROKEN_PLAYERS = [
    "org.mpris.MediaPlayer2.spotify"
];

var NO_LOOP_STATUS_SUPPORT = [
    "org.mpris.MediaPlayer2.quodlibet",
    "org.mpris.MediaPlayer2.pithos",
    "org.mpris.MediaPlayer2.spotify"
];

var gsettings;

function init() {
    gsettings = Lib.getSettings(Me);
}
