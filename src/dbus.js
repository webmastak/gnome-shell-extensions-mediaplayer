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
const Me = imports.misc.extensionUtils.getCurrentExtension();
const Settings = Me.imports.settings;

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
        <method name="GetAll"> \
            <arg direction="in" type="s"/> \
            <arg direction="out" type="a{sv}"/> \
        </method> \
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


// For some reason the Nuvola dev was told to scab in a non-spec
// prop and method for the support of setting ratings instead of
// making a seperate ratings extension interface.
// Oh well, they really don't hurt anything. No other player will try
// to use them anyway...
const MediaServer2PlayerIface = '<node>\
    <interface name="org.mpris.MediaPlayer2.Player">\
        <method name="PlayPause" />\
        <method name="Next" />\
        <method name="Previous" />\
        <method name="Stop" />\
        <method name="SetPosition">\
            <arg type="o" direction="in" />\
            <arg type="x" direction="in" />\
        </method>\
        <method name="NuvolaSetRating">\
            <arg type="d" direction="in" />\
        </method>\
        <property name="NuvolaCanRate" type="b" access="read" />\
        <property name="CanPlay" type="b" access="read" />\
        <property name="CanPause" type="b" access="read" />\
        <property name="CanSeek" type="b" access="read" />\
        <property name="CanGoNext" type="b" access="read" />\
        <property name="CanGoPrevious" type="b" access="read" />\
        <property name="Metadata" type="a{sv}" access="read" />\
        <property name="Volume" type="d" access="readwrite" />\
        <property name="LoopStatus" type="s" access="readwrite" />\
        <property name="Shuffle" type="b" access="readwrite" />\
        <property name="PlaybackStatus" type="s" access="read" />\
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

const RatingsExtensionIface = '<node>\
    <interface name="org.mpris.MediaPlayer2.ExtensionSetRatings">\
        <method name="SetRating">\
            <arg type="o" direction="in" />\
            <arg type="d" direction="in" />\
        </method>\
        <property name="HasRatingsExtension" type="b" access="read" />\
    </interface>\
</node>';
const RatingsExtensionProxy = Gio.DBusProxy.makeProxyWrapper(RatingsExtensionIface);

const Rhythmbox3Iface = '<node>\
    <interface name="org.gnome.Rhythmbox3.RhythmDB">\
        <method name="SetEntryProperties">\
            <arg type="s" direction="in" />\
            <arg type="a{sv}" direction="in" />\
        </method>\
    </interface>\
 </node>';

const Rhythmbox3Proxy = Gio.DBusProxy.makeProxyWrapper(Rhythmbox3Iface);

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

function RatingsExtension(owner, callback) {
    if (Settings.SUPPORTS_RATINGS_EXTENSION.indexOf(owner) == -1) {
      callback(false);
    }
    else {
      let proxy = new RatingsExtensionProxy(Gio.DBus.session, owner,
                                            '/org/mpris/MediaPlayer2');   
      if (proxy.HasRatingsExtension) {
        callback(proxy);
      }
      else {
        callback(false);
      }
    }
}

function RhythmboxRatings(owner) {
    if (owner != 'org.mpris.MediaPlayer2.rhythmbox') {
      return false;
    }
    else {
      return new Rhythmbox3Proxy(Gio.DBus.session, "org.gnome.Rhythmbox3",
                                 "/org/gnome/Rhythmbox3/RhythmDB");
    }
}
