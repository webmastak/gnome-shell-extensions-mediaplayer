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
let manager;
let indicator;
let _stockMpris;
let _stockMprisOldShouldShow;

function init() {
  Lib.initTranslations(Me);
  Lib.addIcon(Me);
  Settings.init();
  if (Settings.MINOR_VERSION > 19) {
    //Monkey patch
    _stockMpris = Main.panel.statusArea.dateMenu._messageList._mediaSection;
    _stockMprisOldShouldShow = _stockMpris._shouldShow;
  }
  Settings.gsettings.connect("changed::" + Settings.MEDIAPLAYER_INDICATOR_POSITION_KEY, function() {
    _reset();
  });
}

function _reset() {
  if (manager) {
    disable();
    enable();
  }
}

function enable() {
  let position = Settings.gsettings.get_enum(Settings.MEDIAPLAYER_INDICATOR_POSITION_KEY),
      menu, desiredMenuPosition;

  if (position == Settings.IndicatorPosition.VOLUMEMENU) {
    indicator = new Panel.AggregateMenuIndicator();
    menu = Main.panel.statusArea.aggregateMenu.menu;
    desiredMenuPosition = Main.panel.statusArea.aggregateMenu.menu._getMenuItems().indexOf(Main.panel.statusArea.aggregateMenu._rfkill.menu);
  }
  else {
    indicator = new Panel.PanelIndicator();
    menu = indicator.menu;
    desiredMenuPosition = 0;
  }

  manager = new Manager.PlayerManager(menu, desiredMenuPosition);
  if (position == Settings.IndicatorPosition.LEFT) {
    Main.panel.addToStatusArea('mediaplayer', indicator, 999, 'left');
  }
  else if (position == Settings.IndicatorPosition.RIGHT) {
    Main.panel.addToStatusArea('mediaplayer', indicator);
  }
  else if (position == Settings.IndicatorPosition.CENTER) {
    Main.panel.addToStatusArea('mediaplayer', indicator, 999, 'center');
  }
  else {
    Main.panel.statusArea.aggregateMenu._indicators.insert_child_below(indicator.indicators, Main.panel.statusArea.aggregateMenu._screencast.indicators);
  }

  indicator.manager = manager;
}

function disable() {
  manager.destroy();
  manager = null;
  if (indicator instanceof Panel.PanelIndicator) {
    indicator.destroy();
  }
  else {
    indicator.indicators.destroy();
  }
  indicator = null;
  if (Settings.MINOR_VERSION > 19) {
    //Revert Monkey patch
    _stockMpris._shouldShow = _stockMprisOldShouldShow;
    if (_stockMpris._shouldShow()) {
      _stockMpris.actor.show();
    }
  }
}
