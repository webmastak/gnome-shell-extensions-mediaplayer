# gnome-shell-extensions-mediaplayer

gnome-shell-extensions-mediaplayer is a gnome-shell extension for controlling any
MPRIS v2.1 capable media player.

This extension will monitor D-Bus for active players and automatically display them 
in the GNOME Shell's system menu by default.

## Screenshot

[Screenshot](https://github.com/eonpatapon/gnome-shell-extensions-mediaplayer/raw/master/data/screenshot.png)

## Features
 
- 3 positions: center or right in its own menu, or in the system menu
- support multiple players
- interactive indicator icon: scroll (next/previous), middle click (play/pause)
- playlist support (org.mpris.MediaPlayer2.Playlists interface)
- rating support (see notes below)
- and more...

- - -

gnome-shell-extensions-mediaplayer can be easily configured through
http://extensions.gnome.org or Tweak Tool as well as command-line (all settings are
listed below).

## Installation

### Via extensions.gnome.org

  * https://extensions.gnome.org/extension/55/media-player-indicator/

### Packages

  * Arch Linux - [AUR package](https://aur.archlinux.org/packages.php?ID=49367) by Alucryd
  * Ubuntu - [webupd8 PPA](http://www.webupd8.org/2011/10/gnome-shell-mediaplayer-extension.html)
  * Frugalware - [package](http://www.frugalware.org/packages/136448) by Baste

### Manual installation

Git branches `master` and `devel` work with GNOME Shell 3.10 up to 3.16+.

Other branches: gnome-shell-3.0, gnome-shell-3.2, gnome-shell-3.8 (for g-s 3.4 up to 3.8)

Prerequisites: automake, gnome-common, gettext, glib2 devel files

#### System-wide:

    ./autogen.sh
    make
    sudo make install

#### In your ~/.local directory:

    ./autogen.sh
    make install-zip

Restart the shell and then enable the extension.

## Settings

All settings can be changed from within the `gnome-shell-extension-prefs` tool, or from the command line.

 * **Position of the indicator:** (default: 'volume-menu')

        gsettings set org.gnome.shell.extensions.mediaplayer indicator-position 'center'|'right'|'volume-menu'

 * **Show the default media player in the menu if no other player is running:** (default: false)

        gsettings set org.gnome.shell.extensions.mediaplayer rundefault true

    You can configure the default media player in GNOME System Settings, under *Details
    → Default Applications*.

 * **Indicator appearance:** (default: 'icon')

        gsettings set org.gnome.shell.extensions.mediaplayer status-type 'icon'|'cover'

 * **Hide the position slider:** (default: true)

        gsettings set org.gnome.shell.extensions.mediaplayer position false

 * **Show the volume control slider of the media player:** (default: false)

        gsettings set org.gnome.shell.extensions.mediaplayer volume true

 * **Show the playlists of the media player:** (default: false)

        gsettings set org.gnome.shell.extensions.mediaplayer playlists true

 * **Show the rating of the current track:** (default: false)

        gsettings set org.gnome.shell.extensions.mediaplayer rating true

    Players supported (get: show the rating, set: set a rating):

      * Banshee (get/set)
      * Rhythmbox (get/set)
      * Guayadeque (get/set)
      * Clementine (get)
      * Amarok (get)

    **Warning:** Ratings are not part of the MPRIS specification thus specific code
    must be written for each player to set or get the current track rating. Note that
    for some players there will be no support to get/set the rating from this extension.
    For example, Clementine does not offer any way to set the rating of a song except from the Clementine GUI (http://bit.ly/INFEon).

 * **Indicator status text template:** (default: '')

        gsettings set org.gnome.shell.extensions.mediaplayer status-text '<span color="#76B0EC" font="9">{trackTitle}</span>'

    The status template text can be formatted with the [Pango markup](https://developer.gnome.org/pango/stable/PangoMarkupFormat.html)
    syntax. Placeholders will be replaced with the actual value of the playing track. 
    
    Common placeholders to use: trackAlbum, trackArtist, trackNumber, trackTitle...
    
    You can also append text to the placeholder only if it has a value.
    For example with the template ``{trackAlbum| - }{trackTitle}`` the ``-`` will be
    displayed only if the current track has an album defined.

 * **Menu track informations template:** (default: ``'[{"template": "{trackArtist}", "style_class": "track-info track-info-big"}, {"template": "{trackTitle}", "style_class": "track-info track-info-medium"}, {"template": "{trackAlbum}", "style_class": "track-info"}]'``)
 
    The track informations (title, album, artist) that are displayed in the menu can be customized 
    with this setting. The value must be a valid JSON string. The value is a list of objects with 
    two attributes: ``template`` and ``style_class``. ``template`` is the text of the line containing
    placeholders that will be replaced by the current track values. ``style_class`` is the CSS classes 
    applied to the line.

    For example, if you wish to include the number of the track before the track title, you can do:
 
        gsettings --schemadir .local/share/gnome-shell/extensions/mediaplayer@patapon.info/schemas/ set org.gnome.shell.extensions.mediaplayer trackbox-template '[{"template": "{trackArtist}", "style_class": "track-info track-info-big"}, {"template": "{trackNumber|. }{trackTitle}", "style_class": "track-info track-info-medium"}, {"template": "<span color=\\"#aaa\\">{trackAlbum}</span>", "style_class": "track-info"}]'
 
    See the previous setting for more information about template formatting.

## Compatible players

Any player that supports the [MPRIS v2](http://www.mpris.org/2.1/spec/)
spec can be supported.

**Note:** Many players will require you to enable the MPRIS v2 support
manually. If your player is listed but still doesn't work, look for words
"MPRIS" or "D-Bus" in the player's plugins.

This extension has been tested with:

  * Amarok
  * Audacious (≥ 3.2, with "MPRIS 2 Server" plugin)
  * Banshee (with "MPRIS D-Bus interface" extension)
  * BeatBox
  * Clementine
  * DeaDBeeF (with third-party [deadbeef-mpris2](https://github.com/Serranya/deadbeef-mpris2-plugin) plugin)
  * Dragon Player
  * Exaile (with third-party [Sound Menu](https://github.com/grawity/Exaile-Soundmenu-Indicator) plugin)
  * GMusicBrowser
  * GNOME MPlayer (≥ 1.0.7)
  * GNOME Music
  * Guayadeque (≥ 0.3.2)
  * JuK
  * mpd (with [mpDris2](https://github.com/eonpatapon/mpDris2) daemon)
  * Nuvola *aka* Google Music Frame
  * Pithos
  * Pragha (with MPRIS2 enabled under "Internet Services")
  * Quod Libet (with "MPRIS D-Bus support" plugin)
  * Rhythmbox (with "MPRIS D-Bus interface" plugin)
  * Spotify
  * Tomahawk
  * Totem (≥ 3.1.91, with "D-Bus Service" plugin)
  * VLC (≥ 2.0, with "dbus" control interface)
  * XBMC (with "MPRIS D-Bus interface" add-on)
  * Lollypop
  * *and more...*

## Known bugs

### Track position is not updated correctly

Some players do not send the MPRIS "Seeked" signal so the extension can't update
the position slider when the song is seeked from the extension or the player.

  * Banshee ([bug report](https://bugzilla.gnome.org/show_bug.cgi?id=654524), issue #34, issue #183)
  * Exaile – fixed in 3.3.0 ([bug report](https://bugs.launchpad.net/exaile/+bug/1021645))
  * VLC – fixed in 2.x? ([bug report](https://trac.videolan.org/vlc/ticket/6802))
  * Spotify

## *Not* supported players

  * Nightingale 1.11 – no native MPRIS support, only a third-party v1 plugin

## Authors

  * eonpatapon (Jean-Philippe Braun)
  * grawity (Mantas Mikulėnas)

Based on the work of horazont (Jonas Wielicki).
