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
const Me = imports.misc.extensionUtils.getCurrentExtension();
const Lib = Me.imports.lib;

const Gettext = imports.gettext.domain('gnome-shell-extensions-mediaplayer');
const _ = Gettext.gettext;
const N_ = function(t) { return t };

const MEDIAPLAYER_SETTINGS_SCHEMA = 'org.gnome.shell.extensions.mediaplayer';
const MEDIAPLAYER_INDICATOR_POSITION_KEY = 'indicator-position';
const MEDIAPLAYER_STATUS_TYPE_KEY = 'status-type';
const MEDIAPLAYER_STATUS_TEXT_KEY = 'status-text';
const MEDIAPLAYER_VOLUME_KEY = 'volume';
const MEDIAPLAYER_POSITION_KEY = 'position';
const MEDIAPLAYER_PLAYLISTS_KEY = 'playlists';
const MEDIAPLAYER_COVER_SIZE = 'coversize';
const MEDIAPLAYER_RUN_DEFAULT = 'rundefault';
const MEDIAPLAYER_RATING_KEY = 'rating';
// OLD SETTING
const MEDIAPLAYER_VOLUME_MENU_KEY = 'volumemenu';

const IndicatorPosition = {
    CENTER: 0,
    RIGHT: 1,
    VOLUMEMENU: 2
};

const FADE_ANIMATION_TIME = 0.16;

const Status = {
    STOP: N_("Stopped"),
    PLAY: N_("Playing"),
    PAUSE: N_("Paused"),
    RUN: "Run"
};

const SEND_STOP_ON_CHANGE = [
    "org.mpris.MediaPlayer2.banshee",
    "org.mpris.MediaPlayer2.pragha"
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
