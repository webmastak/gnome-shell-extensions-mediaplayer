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

const Lang = imports.lang;
const Clutter = imports.gi.Clutter;
const St = imports.gi.St;
const PanelMenu = imports.ui.panelMenu;
const GLib = imports.gi.GLib;

const Me = imports.misc.extensionUtils.getCurrentExtension();
const Settings = Me.imports.settings;


const MediaplayerStatusButton = new Lang.Class({
    Name: 'MediaplayerStatusButton',
    Extends: PanelMenu.Button,

    _init: function() {
        this.parent(0.0, "mediaplayer");

        this._coverPath = "";
        this._coverSize = 22;
        this._state = "";

        this._box = new St.BoxLayout();

        this._icon = new St.Icon({icon_name: 'audio-x-generic-symbolic',
                                  style_class: 'system-status-icon'});
        this._bin = new St.Bin({child: this._icon});

        this._stateText = new St.Label();
        this._stateTextBin = new St.Bin({child: this._stateText,
                                         y_align: St.Align.MIDDLE});

        this._stateIcon = new St.Icon({icon_name: 'system-run-symbolic',
                                       style_class: 'status-icon'})
        this._stateIconBin = new St.Bin({child: this._stateIcon,
                                         y_align: St.Align.END});

        this._box.add(this._bin);
        this._box.add(this._stateTextBin);
        this._box.add(this._stateIconBin);
        this.actor.add_actor(this._box);
        this.actor.add_style_class_name('panel-status-button');
        this.actor.connect('scroll-event', Lang.bind(this, this._onScrollEvent));
    },

    _showCover: function(player) {
        if (Settings.gsettings.get_enum(Settings.MEDIAPLAYER_STATUS_TYPE_KEY) == Settings.IndicatorStatusType.COVER &&
           this._coverPath != player.trackCoverPath) {
            this._coverPath = player.trackCoverPath;
            // Change cover
            if (this._coverPath && GLib.file_test(this._coverPath, GLib.FileTest.EXISTS)) {
                let cover = new St.Bin();
                let coverTexture = new Clutter.Texture({filter_quality: 2, filename: this._coverPath});
                let [coverWidth, coverHeight] = coverTexture.get_base_size();
                cover.height = this._coverSize;
                cover.width = this._coverSize;
                cover.set_child(coverTexture);
                this._bin.set_child(cover);
            }
            else
                this._bin.set_child(this._icon);
        }
    },

    _updateStateText: function(player) {
        if (player && player.trackArtist) {
            let stateText = Settings.gsettings.get_string(Settings.MEDIAPLAYER_STATUS_TEXT_KEY);
            stateText = stateText.replace(/%a/, player.trackArtist.getText())
                                 .replace(/%t/, player.trackTitle.getText())
                                 .replace(/%b/, player.trackAlbum.getText())
                                 .replace(/&/, "&amp;");
            this._stateTextCache = stateText;
        }
        this._stateText.clutter_text.set_markup(this._stateTextCache);
    },

    _clearStateText: function() {
        this._stateText.text = "";
    },

    _onScrollEvent: function(actor, event) {
        let direction = event.get_scroll_direction();

        if (direction == Clutter.ScrollDirection.DOWN)
            this._delegate.next();
        else if (direction == Clutter.ScrollDirection.UP)
            this._delegate.previous();
    },

    // Override PanelMenu.Button._onButtonPress
    _onButtonPress: function(actor, event) {
        let button = event.get_button();

        if (button == 2)
            this._delegate.playPause();
        else {
            if(this._delegate._players[Settings.DEFAULT_PLAYER_OWNER]) {
                let player = this._delegate._players[Settings.DEFAULT_PLAYER_OWNER].player;
                player._app.activate_full(-1, 0);
                return;
            }

            if (!this.menu)
                return;

            this.menu.toggle();
        }
    },

    setState: function(player) {
        if (player) {
            this._state = player._status;
            if (this._state == Settings.Status.PLAY) {
                this._stateIcon.icon_name = "media-playback-start-symbolic";
                this._updateStateText(player);
                this._showCover(player);
            }
            else if (this._state == Settings.Status.PAUSE) {
                this._stateIcon.icon_name = "media-playback-pause-symbolic";
                this._updateStateText(player);
                this._showCover(player);
            }
            else if (!this.state || this._state == Settings.Status.STOP) {
                this._stateIcon.icon_name = "media-playback-stop-symbolic";
                this._clearStateText();
                this._showCover(false);
            }
        }
        else {
            this._stateIcon.icon_name = "system-run-symbolic";
            this._clearStateText();
            this._showCover(false);
        }
    }
});
