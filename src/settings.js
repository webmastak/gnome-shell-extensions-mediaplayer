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

const MEDIAPLAYER_INDICATOR_POSITION_KEY = 'indicator-position';
const MEDIAPLAYER_COVER_STATUS_KEY = 'cover-status';
const MEDIAPLAYER_STATUS_TEXT_KEY = 'status-text';
const MEDIAPLAYER_STATUS_SIZE_KEY = 'status-size';
const MEDIAPLAYER_VOLUME_KEY = 'volume';
const MEDIAPLAYER_HIDE_AGGINDICATOR_KEY = 'hide-aggindicator';
const MEDIAPLAYER_POSITION_KEY = 'position';
const MEDIAPLAYER_PLAYLISTS_KEY = 'playlists';
const MEDIAPLAYER_STOP_BUTTON_KEY = 'stop-button';
const MEDIAPLAYER_BUTTON_ICON_SIZE_KEY = 'button-icon-size';
const MEDIAPLAYER_PLAYLIST_TITLE_KEY = 'playlist-title';
const MEDIAPLAYER_TRACKLIST_KEY = 'tracklist';
const MEDIAPLAYER_TRACKLIST_RATING_KEY = 'tracklist-rating';
const MEDIAPLAYER_LOOP_STATUS_KEY = 'loop-status';
const MEDIAPLAYER_RATING_KEY = 'rating';
const MEDIAPLAYER_ENABLE_SCROLL_EVENTS_KEY = 'enable-scroll';
const MEDIAPLAYER_HIDE_STOCK_MPRIS_KEY = 'hide-stockmpris';
const MEDIAPLAYER_KEEP_ACTIVE_OPEN_KEY = 'active-open';
const MEDIAPLAYER_PLAY_STATUS_ICON_KEY = 'playstatus';

const MINOR_VERSION = parseInt(Config.PACKAGE_VERSION.split(".")[1])

const IndicatorPosition = {
    CENTER: 0,
    RIGHT: 1,
    VOLUMEMENU: 2
};

const ButtonIconSizes = {
    CIRCULAR: 0,
    SMALL: 1,
    MEDIUM: 2,
    LARGE: 3
};

const Status = {
    STOP: "Stopped",
    PLAY: "Playing",
    PAUSE: "Paused"
};

const ValidPlaybackStatuses = [
    'Stopped',
    'Playing',
    'Paused'
];

const WRONG_VOLUME_SCALING = [
    "org.mpris.MediaPlayer2.quodlibet"
];

const ALTERNATIVE_PLAYLIST_TITLES = [
    {"org.mpris.MediaPlayer2.pithos": _("Stations")}
];

const ALTERNATIVE_TRACKLIST_TITLES = [
    {"org.mpris.MediaPlayer2.pithos": _("Current Playlist")}
];

const BROKEN_PLAYERS = [
    "org.mpris.MediaPlayer2.spotify"
];

const NO_LOOP_STATUS_SUPPORT = [
    "org.mpris.MediaPlayer2.quodlibet",
    "org.mpris.MediaPlayer2.pithos",
    "org.mpris.MediaPlayer2.spotify"
];

let gsettings;

function init() {
    gsettings = Lib.getSettings(Me);
}
