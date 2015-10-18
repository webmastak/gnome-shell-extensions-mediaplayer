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

const Mainloop = imports.mainloop;
const Lang = imports.lang;
const Signals = imports.signals;
const Config = imports.misc.config;

const Me = imports.misc.extensionUtils.getCurrentExtension();
const Panel = Me.imports.panel;
const Player = Me.imports.player;
const Settings = Me.imports.settings;
const DBusIface = Me.imports.dbus;
const UI = Me.imports.ui;


const PlayerManager = new Lang.Class({
    Name: 'PlayerManager',

    _init: function(menu) {
        this._disabling = false;
        // the menu
        this.menu = menu;
        // players list
        this._players = {};
        // player shown in the panel
        this._activePlayer = null;
        this._activePlayerId = null;
        // the DBus interface
        this._dbus = new DBusIface.DBus();
        // player DBus name pattern
        let name_regex = /^org\.mpris\.MediaPlayer2\./;
        // load players
        this._dbus.ListNamesRemote(Lang.bind(this,
            function(names) {
                for (let n in names[0]) {
                    let name = names[0][n];
                    if (name_regex.test(name)) {
                        this._dbus.GetNameOwnerRemote(name, Lang.bind(this,
                            function(owner) {
                                if (!this._disabling)
                                    this._addPlayer(name, owner);
                            }
                        ));
                    }
                }
            }
        ));
        // watch players
        this._ownerChangedId = this._dbus.connectSignal('NameOwnerChanged', Lang.bind(this,
            function(proxy, sender, [name, old_owner, new_owner]) {
                if (name_regex.test(name)) {
                    if (!this._disabling) {
                        if (new_owner && !old_owner)
                            this._addPlayer(name, new_owner);
                        else if (old_owner && !new_owner)
                            this._removePlayerFromMenu(name, old_owner);
                        else
                            this._changePlayerOwner(name, old_owner, new_owner);
                    }
                }
            }
        ));
        this._signalsId = [];
        this._signalsId.push(
            Settings.gsettings.connect("changed::" + Settings.MEDIAPLAYER_RUN_DEFAULT, Lang.bind(this, function() {
                this._hideOrDefaultPlayer();
            }))
        );
        this._hideOrDefaultPlayer();
    },

    get activePlayer() {
      return this._activePlayer;
    },

    set activePlayer(player) {

      if (player == this._activePlayer)
        return;

      if (player === null) {
        this._activePlayerId = null;
        this._activePlayer = null;
        this.emit('player-active-remove');
        return;
      }

      if (this._activePlayerId) {
        this._activePlayer.disconnect(this._activePlayerId);
        this._activePlayerId = null;
      }
      this._activePlayer = player;
      this._activePlayerId = this._activePlayer.connect('player-update',
                                                        Lang.bind(this, this._onActivePlayerUpdate));
      for (let owner in this._players) {
        if (this._players[owner].player == player &&
            this._players[owner].ui.menu)
          this._players[owner].ui.menu.open();
      }
      this.emit('player-active-update', player.state);
    },

    nbPlayers: function() {
      return Object.keys(this._players).length;
    },

    getPlayersByStatus: function(status, preference) {
      // Return a list of running players by status and preference
      // preference is a player instance, if found in the list
      // it will be put in the first position
      return Object.keys(this._players).map(Lang.bind(this, function(owner) {
        return this._players[owner].player;
      }))
      .filter(function(player) {
        if (player && player.state.status == status)
          return true;
        else
          return false;
      })
      .sort(function(a, b) {
        if (a == preference)
          return -1;
        else if (b == preference)
          return 1;
        return 0;
      });
    },

    _isInstance: function(busName) {
        // MPRIS instances are in the form
        //   org.mpris.MediaPlayer2.name.instanceXXXX
        // ...except for VLC, which to this day uses
        //   org.mpris.MediaPlayer2.name-XXXX
        return busName.split('.').length > 4 ||
                /^org\.mpris\.MediaPlayer2\.vlc-\d+$/.test(busName);
    },

    _addPlayer: function(busName, owner) {
        let position;
        if (this._players[owner]) {
            let prevName = this._players[owner].player.busName;
            // HAVE:       ADDING:     ACTION:
            // master      master      reject, cannot happen
            // master      instance    upgrade to instance
            // instance    master      reject, duplicate
            // instance    instance    reject, cannot happen
            if (this._isInstance(busName) && !this._isInstance(prevName))
                this._players[owner].player.busName = busName;
            else
                return;
        }
        else if (owner) {
            let player = new Player.MPRISPlayer(busName, owner);
            let ui = new UI.PlayerUI(player);
            this._players[owner] = {
              player: player,
              ui: ui,
              signals: [],
              signalsUI: []
            };

            this._players[owner].signals.push(
                this._players[owner].player.connect('player-update',
                    Lang.bind(this, this._onPlayerUpdate)
                )
            );
            this._players[owner].signals.push(
                this._players[owner].player.connect('player-update-info',
                    Lang.bind(this, this._onPlayerInfoUpdate)
                )
            );
            this._players[owner].signalsUI.push(
                /* Close all other players menu when a player menu is opened */
                this._players[owner].ui.connect('player-menu-opened',
                    Lang.bind(this, function(ui) {
                      this._hideOtherPlayers(ui);
                    })
                )
            );

            // remove the default player
            if (this._players[Settings.DEFAULT_PLAYER_OWNER])
                this._removePlayerFromMenu(null, Settings.DEFAULT_PLAYER_OWNER);

            this._addPlayerToMenu(owner);
        }

        this._hideOrDefaultPlayer();
    },

    _onPlayerUpdate: function(player, newState) {
      if (newState.status)
        this._refreshActivePlayer(player);
    },

    _onActivePlayerUpdate: function(player, newState) {
      this.emit('player-active-update', newState);
    },

    _onPlayerInfoUpdate: function(player, playerInfo) {
    },

    _hideOtherPlayers: function(ui) {
      for (let owner in this._players) {
        if (this._players[owner].ui != ui)
          this._players[owner].ui.menu.close(true, true);
      }
    },

    _hideOrDefaultPlayer: function() {
        if (this._disabling)
            return;

        if (this.nbPlayers() === 0 && Settings.gsettings.get_boolean(Settings.MEDIAPLAYER_RUN_DEFAULT)) {
          if (!this._players[Settings.DEFAULT_PLAYER_OWNER]) {
            let ui = new UI.DefaultPlayerUI();
            this._players[Settings.DEFAULT_PLAYER_OWNER] = {ui: ui, signalsUI: [], signals: [], player: null};
            this._addPlayerToMenu(Settings.DEFAULT_PLAYER_OWNER);
          }
        }
        else if (this.nbPlayers() > 1 && this._players[Settings.DEFAULT_PLAYER_OWNER]) {
            this._removePlayerFromMenu(null, Settings.DEFAULT_PLAYER_OWNER);
        }
    },

    _getPlayerPosition: function() {
      let position = 0;
      if (Settings.gsettings.get_enum(Settings.MEDIAPLAYER_INDICATOR_POSITION_KEY) ==
            Settings.IndicatorPosition.VOLUMEMENU) {
        if (parseInt(Config.PACKAGE_VERSION.split(".")[1]) < 18)
          position = this.menu.numMenuItems - 2;
        else
          position = this.menu.numMenuItems - 1;
      }
      return position;
    },

    _addPlayerToMenu: function(owner) {
      let position = this._getPlayerPosition();
      this.menu.addMenuItem(this._players[owner].ui, position);
      this._refreshActivePlayer(this._players[owner].player);
    },

    _getMenuItem: function(position) {
        let items = this.menu.box.get_children().map(function(actor) {
            return actor._delegate;
        });
        if (items[position])
            return items[position];
        else
            return null;
    },

    _removeMenuItem: function(position) {
        let item = this._getMenuItem(position);
        if (item)
            item.destroy();
    },

    _getPlayerMenuPosition: function(ui) {
        let items = this.menu.box.get_children().map(function(actor) {
            return actor._delegate;
        });
        for (let i in items) {
            if (items[i] == ui)
                return i;
        }
        return null;
    },

    _removePlayerFromMenu: function(busName, owner) {
        if (this._players[owner]) {
            for (let id in this._players[owner].signals)
                this._players[owner].player.disconnect(this._players[owner].signals[id]);
            for (let id in this._players[owner].signalsUI)
                this._players[owner].ui.disconnect(this._players[owner].signalsUI[id]);
            let position = this._getPlayerMenuPosition(this._players[owner].ui);
            if (this._players[owner].ui)
              this._players[owner].ui.destroy();
            if (this._players[owner].player)
              this._players[owner].player.destroy();
            delete this._players[owner];
            this._hideOrDefaultPlayer();
        }
        this._refreshActivePlayer(null);
    },

    _changePlayerOwner: function(busName, oldOwner, newOwner) {
        if (this._players[oldOwner] && busName == this._players[oldOwner].player.busName) {
            this._players[newOwner] = this._players[oldOwner];
            this._players[newOwner].player.owner = newOwner;
            delete this._players[oldOwner];
        }
        this._refreshActivePlayer(this._players[newOwner].player);
    },

    _refreshActivePlayer: function(player) {
      // Display current status in the top panel
      if (this.nbPlayers() > 0) {
        // Get the first player
        // with status PLAY or PAUSE
        // else all players are stopped
        this.activePlayer = []
        .concat(
          this.getPlayersByStatus(Settings.Status.PLAY, player),
          this.getPlayersByStatus(Settings.Status.PAUSE, player),
          this.getPlayersByStatus(Settings.Status.STOP, player)
        )[0] || null;
      }
      else {
        this.activePlayer = null;
      }
    },

    destroy: function() {
        this._disabling = true;
        if (this._ownerChangedId)
            this._dbus.disconnectSignal(this._ownerChangedId);
        for (let id in this._signalsId)
            Settings.gsettings.disconnect(this._signalsId[id]);
        for (let owner in this._players)
            this._removePlayerFromMenu(null, owner);
    }
});
Signals.addSignalMethods(PlayerManager.prototype);
