/* -*- mode: js2; js2-basic-offset: 4; indent-tabs-mode: nil -*- */
/* jshint esnext: true */
/* jshint multistr: true */
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

const DBusIface = '<node>\
    <interface name="org.freedesktop.DBus">\
        <method name="GetNameOwner">\
            <arg type="s" direction="in" />\
            <arg type="s" direction="out" />\
        </method>\
        <method name="ListNames">\
            <arg type="as" direction="out" />\
        </method>\
        <signal name="NameOwnerChanged">\
            <arg type="s" direction="out" />\
            <arg type="s" direction="out" />\
            <arg type="s" direction="out" />\
        </signal>\
    </interface>\
</node>';
const DBusProxy = Gio.DBusProxy.makeProxyWrapper(DBusIface);

const PropertiesIface = '<node>\
    <interface name="org.freedesktop.DBus.Properties">\
        <method name="Get">\
            <arg type="s" direction="in" />\
            <arg type="s" direction="in" />\
            <arg type="v" direction="out" />\
        </method>\
        <signal name="PropertiesChanged">\
            <arg type="s" direction="out" />\
            <arg type="a{sv}" direction="out" />\
            <arg type="as" direction="out" />\
        </signal>\
    </interface>\
</node>';
const PropertiesProxy = Gio.DBusProxy.makeProxyWrapper(PropertiesIface);

const MediaServer2Iface = '<node>\
    <interface name="org.mpris.MediaPlayer2">\
        <method name="Raise" />\
        <property name="CanRaise" type="b" access="read" />\
        <property name="HasTrackList" type="b" access="read" />\
        <property name="Identity" type="s" access="read" />\
        <property name="DesktopEntry" type="s" access="read" />\
    </interface>\
</node>';
const MediaServer2Proxy = Gio.DBusProxy.makeProxyWrapper(MediaServer2Iface);

const MediaServer2PlayerIface = '<node>\
    <interface name="org.mpris.MediaPlayer2.Player">\
        <method name="PlayPause" />\
        <method name="Pause" />\
        <method name="Play" />\
        <method name="Stop" />\
        <method name="Next" />\
        <method name="Previous" />\
        <method name="SetPosition">\
            <arg type="o" direction="in" />\
            <arg type="x" direction="in" />\
        </method>\
        <property name="CanPause" type="b" access="read" />\
        <property name="CanSeek" type="b" access="read" />\
        <property name="CanGoNext" type="b" access="read" />\
        <property name="CanGoPrevious" type="b" access="read" />\
        <property name="Metadata" type="a{sv}" access="read" />\
        <property name="Volume" type="d" access="readwrite" />\
        <property name="PlaybackStatus" type="s" access="read" />\
        <property name="Position" type="x" access="read" />\
        <signal name="Seeked">\
            <arg type="x" direction="out" />\
        </signal>\
    </interface>\
</node>';
const MediaServer2PlayerProxy = Gio.DBusProxy.makeProxyWrapper(MediaServer2PlayerIface);

const MediaServer2PlaylistsIface = '<node>\
    <interface name="org.mpris.MediaPlayer2.Playlists">\
        <method name="ActivatePlaylist">\
            <arg type="o" direction="in" />\
        </method>\
        <method name="GetPlaylists">\
            <arg type="u" direction="in" />\
            <arg type="u" direction="in" />\
            <arg type="s" direction="in" />\
            <arg type="b" direction="in" />\
            <arg type="a(oss)" direction="out" />\
        </method>\
        <property name="PlaylistCount" type="u" access="read" />\
        <property name="Orderings" type="as" access="read" />\
        <property name="ActivePlaylist" type="(b(oss))" access="read" />\
        <signal name="PlaylistChanged">\
            <arg type="(oss)" direction="out" />\
        </signal>\
    </interface>\
</node>';
const MediaServer2PlaylistsProxy = Gio.DBusProxy.makeProxyWrapper(MediaServer2PlaylistsIface);

const MediaServer2TracklistIface = '<node>\
    <interface name="org.mpris.MediaPlayer2.TrackList">\
        <method name="GetTracksMetadata">\
            <arg type="ao" direction="in" />\
            <arg type="aa{sv}" direction="out" />\
        </method>\
        <method name="GoTo">\
            <arg type="o" direction="in" />\
        </method>\
        <property name="Tracks" type="ao" access="read" />\
        <signal name="TrackListReplaced">\
            <arg type="ao" direction="out" />\
            <arg type="o" direction="out" />\
        </signal>\
        <signal name="TrackAdded">\
            <arg type="a{sv}" direction="out" />\
            <arg type="o" direction="out" />\
        </signal>\
        <signal name="TrackRemoved">\
            <arg type="o" direction="out" />\
        </signal>\
        <signal name="TrackMetadataChanged">\
            <arg type="o" direction="out" />\
            <arg type="a{sv}" direction="out" />\
        </signal>\
    </interface>\
</node>';
const MediaServer2TracklistProxy = Gio.DBusProxy.makeProxyWrapper(MediaServer2TracklistIface);

const PithosRatingsIface = '<node>\
    <interface name="org.mpris.MediaPlayer2.ExtensionPithosRatings">\
        <method name="LoveSong">\
            <arg type="o" direction="in" />\
        </method>\
        <method name="BanSong">\
            <arg type="o" direction="in" />\
        </method>\
        <method name="TiredSong">\
            <arg type="o" direction="in" />\
        </method>\
        <method name="UnRateSong">\
            <arg type="o" direction="in" />\
        </method>\
        <property name="HasPithosExtension" type="b" access="read" />\
    </interface>\
</node>';
const PithosRatingsProxy = Gio.DBusProxy.makeProxyWrapper(PithosRatingsIface);

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

function MediaServer2Tracklist(owner, callback) {
    new MediaServer2TracklistProxy(Gio.DBus.session, owner,
                                   '/org/mpris/MediaPlayer2',
                                   callback);
}

function PithosRatings(owner, callback) {
    if (owner != 'org.mpris.MediaPlayer2.pithos') {
      callback(false);
    }
    else {
      let proxy = new PithosRatingsProxy(Gio.DBus.session, owner,
                                         '/org/mpris/MediaPlayer2');
      if (proxy.HasPithosExtension) {
        callback(proxy);
      }
      else {
        callback(false);
      }
    }
}
