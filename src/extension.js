/* -*- mode: js2; js2-basic-offset: 4; indent-tabs-mode: nil -*- */
/* jshint esnext: true */
/* jshint -W097 */
/* global imports: false */
/* global global: false */
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

const Main = imports.ui.main;
const Gettext = imports.gettext.domain('gnome-shell-extensions-mediaplayer');

const Me = imports.misc.extensionUtils.getCurrentExtension();
const Lib = Me.imports.lib;
const Manager = Me.imports.manager;
const Panel = Me.imports.panel;
const Settings = Me.imports.settings;

/* global values */
let playerManager;
let mediaplayerMenu;
let indicator;

function init() {
    Lib.initTranslations(Me);
    Settings.init();
    Settings.gsettings.connect("changed::" + Settings.MEDIAPLAYER_INDICATOR_POSITION_KEY, function() {
        disable();
        enable();
    });
}

function enable() {
    let position = Settings.gsettings.get_enum(Settings.MEDIAPLAYER_INDICATOR_POSITION_KEY);

    if (position == Settings.IndicatorPosition.VOLUMEMENU) {
        mediaplayerMenu = Main.panel.statusArea.aggregateMenu;
    }
    else {
        mediaplayerMenu = new Panel.MediaplayerStatusButton();
        //if (position == Settings.IndicatorPosition.RIGHT)
            //Main.panel.addToStatusArea('mediaplayer', mediaplayerMenu);
        //else if (position == Settings.IndicatorPosition.CENTER)
            //Main.panel.addToStatusArea('mediaplayer', mediaplayerMenu, 999, 'center');
    }

    playerManager = new Manager.PlayerManager(mediaplayerMenu);
    indicator = new Panel.Indicator(playerManager);

    if (position == Settings.IndicatorPosition.VOLUMEMENU) {
      let nbIndicators = mediaplayerMenu._indicators.get_children().length;
      mediaplayerMenu._indicators.insert_child_at_index(indicator.indicators, nbIndicators - 1);
    }
    else {
      Main.panel.addToStatusArea('mediaplayer', indicator, 999, 'center');
    }

}

function disable() {
    playerManager.destroy();
    playerManager = null;
    if (mediaplayerMenu instanceof Panel.MediaplayerStatusButton) {
      mediaplayerMenu.destroy();
      mediaplayerMenu = null;
    }
    else {
      indicator.destroy();
      indicator = null;
    }
}
