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

const Gio = imports.gi.Gio;
const Lang = imports.lang;

const DBusIface = <interface name="org.freedesktop.DBus">
<method name="GetNameOwner">
    <arg type="s" direction="in" />
    <arg type="s" direction="out" />
</method>
<method name="ListNames">
    <arg type="as" direction="out" />
</method>
<signal name="NameOwnerChanged">
    <arg type="s" direction="out" />
    <arg type="s" direction="out" />
    <arg type="s" direction="out" />
</signal>
</interface>;
const DBusProxy = Gio.DBusProxy.makeProxyWrapper(DBusIface);

const PropertiesIface = <interface name="org.freedesktop.DBus.Properties">
<method name="Get">
    <arg type="s" direction="in" />
    <arg type="s" direction="in" />
    <arg type="v" direction="out" />
</method>
<signal name="PropertiesChanged">
    <arg type="s" direction="out" />
    <arg type="a{sv}" direction="out" />
    <arg type="as" direction="out" />
</signal>
</interface>;
const PropertiesProxy = Gio.DBusProxy.makeProxyWrapper(PropertiesIface);

const MediaServer2Iface = <interface name="org.mpris.MediaPlayer2">
<method name="Raise" />
<method name="Quit" />
<property name="CanRaise" type="b" access="read" />
<property name="CanQuit" type="b" access="read" />
<property name="Identity" type="s" access="read" />
<property name="DesktopEntry" type="s" access="read" />
</interface>;
const MediaServer2Proxy = Gio.DBusProxy.makeProxyWrapper(MediaServer2Iface);

const MediaServer2PlayerIface = <interface name="org.mpris.MediaPlayer2.Player">
<method name="PlayPause" />
<method name="Pause" />
<method name="Play" />
<method name="Stop" />
<method name="Next" />
<method name="Previous" />
<method name="SetPosition">
    <arg type="o" direction="in" />
    <arg type="x" direction="in" />
</method>
<property name="CanPause" type="b" access="read" />
<property name="CanSeek" type="b" access="read" />
<property name="Metadata" type="a{sv}" access="read" />
<property name="Volume" type="d" access="readwrite" />
<property name="PlaybackStatus" type="s" access="read" />
<property name="Position" type="x" access="read" />
<signal name="Seeked">
    <arg type="x" direction="out" />
</signal>
</interface>
const MediaServer2PlayerProxy = Gio.DBusProxy.makeProxyWrapper(MediaServer2PlayerIface);

const MediaServer2PlaylistsIface = <interface name="org.mpris.MediaPlayer2.Playlists">
<method name="ActivatePlaylist">
    <arg type="o" direction="in" />
</method>
<method name="GetPlaylists">
    <arg type="u" direction="in" />
    <arg type="u" direction="in" />
    <arg type="s" direction="in" />
    <arg type="b" direction="in" />
    <arg type="a{oss}" direction="out" />
</method>
<property name="PlaylistCount" type="u" access="read" />
<property name="Orderings" type="as" access="read" />
<property name="ActivePlaylist" type="(b(oss))" access="read" />
</interface>
const MediaServer2PlaylistsProxy = Gio.DBusProxy.makeProxyWrapper(MediaServer2PlaylistsIface);

function DBus() {
    return new DBusProxy(Gio.DBus.session, 'org.freedesktop.DBus',
                         '/org/freedesktop/DBus');
}

function Properties(owner, callback) {
    new PropertiesProxy(Gio.DBus.session, owner,
                        '/org/mpris/MediaPlayer2',
                        callback);
}

function MediaServer2(owner, callback) {
    new MediaServer2Proxy(Gio.DBus.session, owner,
                          '/org/mpris/MediaPlayer2',
                          callback);
}

function MediaServer2Player(owner, callback) {
    new MediaServer2PlayerProxy(Gio.DBus.session, owner,
                                '/org/mpris/MediaPlayer2',
                                callback);
}

function MediaServer2Playlists(owner, callback) {
    new MediaServer2PlaylistsProxy(Gio.DBus.session, owner,
                                   '/org/mpris/MediaPlayer2',
                                   callback);
}
