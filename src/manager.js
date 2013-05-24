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

const Mainloop = imports.mainloop;
const Lang = imports.lang;
const PopupMenu = imports.ui.popupMenu;

const Me = imports.misc.extensionUtils.getCurrentExtension();
const Panel = Me.imports.panel;
const Player = Me.imports.player;
const Settings = Me.imports.settings;
const DBusIface = Me.imports.dbus;


const PlayerManager = new Lang.Class({
    Name: 'PlayerManager',

    _init: function(menu) {
        this._disabling = false;
        // the menu
        this.menu = menu;
        // players list
        this._players = {};
        // player shown in the panel
        this._status_player = false;
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
                            this._removePlayer(name, old_owner);
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

    _isInstance: function(busName) {
        // MPRIS instances are in the form
        //   org.mpris.MediaPlayer2.name.instanceXXXX
        // ...except for VLC, which to this day uses
        //   org.mpris.MediaPlayer2.name-XXXX
        return busName.split('.').length > 4 ||
                /^org\.mpris\.MediaPlayer2\.vlc-\d+$/.test(busName);
    },

    _getPlayerPosition: function() {
        let position = 0;
        if (Settings.gsettings.get_enum(Settings.MEDIAPLAYER_INDICATOR_POSITION_KEY) == Settings.IndicatorPosition.VOLUMEMENU)
                position = this.menu.menu.numMenuItems - 2;
        return position;
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
        } else if (owner) {
            this._players[owner] = {player: new Player.MPRISPlayer(busName, owner), signals: []};
            this._players[owner].signals.push(
                this._players[owner].player.connect('player-metadata-changed',
                    Lang.bind(this, this._refreshStatus)
                )
            );
            this._players[owner].signals.push(
                this._players[owner].player.connect('player-status-changed',
                    Lang.bind(this, this._refreshStatus)
                )
            );
            this._players[owner].signals.push(
                this._players[owner].player.connect('player-cover-changed',
                    Lang.bind(this, this._refreshStatus)
                )
            );
            this._players[owner].signals.push(
                this._players[owner].player.connect('menu-close',
                    Lang.bind(this, function() {
                        if (this.menu instanceof Panel.MediaplayerStatusButton)
                            this.menu.close();
                    })
                )
            );
            this._players[owner].signals.push(
                this._players[owner].player.connect('init-done',
                    Lang.bind(this, function(player) {
                        player.populate();
                    })
                )
            );

            // remove the default player
            if (this._players[Settings.DEFAULT_PLAYER_OWNER])
                this._removePlayer(null, Settings.DEFAULT_PLAYER_OWNER);

            this._addPlayerMenu(this._players[owner].player);
        }

        this._hideOrDefaultPlayer();

        this._refreshStatus();
    },

    _hideOrDefaultPlayer: function() {
        if (this._disabling)
            return;
            
        if (this._nbPlayers() == 0 && Settings.gsettings.get_boolean(Settings.MEDIAPLAYER_RUN_DEFAULT)) {
            if (!this._players[Settings.DEFAULT_PLAYER_OWNER]) {
                let player = new Player.DefaultPlayer();
                this._players[Settings.DEFAULT_PLAYER_OWNER] = {player: player, signals: []};
                this._addPlayerMenu(player);
            }
        }
        else if (this._nbPlayers() > 1 && this._players[Settings.DEFAULT_PLAYER_OWNER]) {
            this._removePlayer(null, Settings.DEFAULT_PLAYER_OWNER);
        }
        this._hideOrShowMenu();
    },

    _addPlayerMenu: function(player) {
        let position = this._getPlayerPosition();

        let item = this._getMenuItem(position);
        if (item && ! (item instanceof PopupMenu.PopupSeparatorMenuItem)) {
            this.menu.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem(),
                                       position);
        }

        this.menu.menu.addMenuItem(player, position);

        let item = this._getMenuItem(position - 1);
        if (item && ! (item instanceof PopupMenu.PopupSeparatorMenuItem)) {
            this.menu.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem(),
                                       position);
        }
        this.menu.actor.show();
    },

    _getMenuItem: function(position) {
        let items = this.menu.menu.box.get_children().map(function(actor) {
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

    _getPlayerMenuPosition: function(player) {
        let items = this.menu.menu.box.get_children().map(function(actor) {
            return actor._delegate;
        });
        for (let i in items) {
            if (items[i] == player)
                return i;
        }
        return null;
    },

    _hideOrShowMenu: function() {
        // Never hide the menu in this case
        if (Settings.gsettings.get_boolean(Settings.MEDIAPLAYER_RUN_DEFAULT) ||
            Settings.gsettings.get_enum(Settings.MEDIAPLAYER_INDICATOR_POSITION_KEY) == Settings.IndicatorPosition.VOLUMEMENU) {
            this.menu.actor.show();
            return;
        }
        // No player or just the default player
        if (this._nbPlayers() == 0 || (this._nbPlayers() == 1 && this._players[Settings.DEFAULT_PLAYER_OWNER]))
                this.menu.actor.hide();
    },

    _removePlayer: function(busName, owner) {
        if (this._players[owner]) {
            for (let id in this._players[owner].signals)
                this._players[owner].player.disconnect(this._players[owner].signals[id]);
            let position = this._getPlayerMenuPosition(this._players[owner].player);
            // Remove the bottom separator
            this._players[owner].player.destroy();
            if (position)
                this._removeMenuItem(position);
            delete this._players[owner];
            this._hideOrDefaultPlayer();
        }
        this._refreshStatus();
    },

    _changePlayerOwner: function(busName, oldOwner, newOwner) {
        if (this._players[oldOwner] && busName == this._players[oldOwner].player.busName) {
            this._players[newOwner] = this._players[oldOwner];
            this._players[newOwner].player.owner = newOwner;
            delete this._players[oldOwner];
        }
        this._refreshStatus();
    },

    _nbPlayers: function() {
        return Object.keys(this._players).length;
    },

    _refreshStatus: function() {
        // Display current status in the top panel
        if (this.menu instanceof Panel.MediaplayerStatusButton) {
            this._status_player = false;
            if (this._nbPlayers() > 0) {
                // Get the first player
                // with status PLAY or PAUSE
                // else all players are stopped
                for (let owner in this._players) {
                    let player = this._players[owner].player;
                    if (player._status == Settings.Status.PLAY) {
                        this._status_player = player;
                        break
                    }
                    if (player._status == Settings.Status.PAUSE && !this._status_player)
                        this._status_player = player;
                    if (player._status == Settings.Status.STOP && !this._status_player)
                        this._status_player = player;
                }
            }
            this.menu.setState(this._status_player);
        }
    },

    next: function() {
        if (this._status_player && this._status_player._status == Settings.Status.PLAY)
            this._status_player._mediaServerPlayer.NextRemote();
    },

    previous: function() {
        if (this._status_player && this._status_player._status == Settings.Status.PLAY)
            this._status_player._mediaServerPlayer.PreviousRemote();
    },

    playPause: function() {
        if (this._status_player &&
                (this._status_player._status == Settings.Status.PLAY || this._status_player._status == Settings.Status.PAUSE))
            this._status_player._mediaServerPlayer.PlayPauseRemote();
    },

    destroy: function() {
        this._disabling = true;
        if (this._ownerChangedId)
            this._dbus.disconnectSignal(this._ownerChangedId);
        for (let id in this._signalsId)
            Settings.gsettings.disconnect(this._signalsId[id]);
        for (let owner in this._players)
            this._removePlayer(null, owner);
    }
});
