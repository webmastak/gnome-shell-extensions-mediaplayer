# gnome-shell-extensions-mediaplayer

gnome-shell-extensions-mediaplayer is a simple extension for controlling any 
MPRIS v2.1 capable media player.

This extension will monitor D-Bus for active players and automatically display them
in the GNOME Shell's volume menu by default.

## Screenshots

By default, media players shows up in the volume menu:

![Screenshot](https://github.com/eonpatapon/gnome-shell-extensions-mediaplayer/raw/master/data/mediaplayer2.png) 

Notice the support of playlists in Banshee (MPRIS 2.1 playlist interface).

- - -

But you can have the media players in a separate menu (see settings):

![Screenshot](https://github.com/eonpatapon/gnome-shell-extensions-mediaplayer/raw/master/data/mediaplayer1.png)

You can go to the next or previous track by using the mouse wheel on the status icon. 
You can also play or pause the player by clicking with the middle button on the status icon.

You may also use the status icon to run your favorite media player if no player is running 
(see the ```rundefault``` setting below).

The current track rating can also be displayed and changed depending of the
player you are using (see the ```rating``` setting below).

- - -

gnome-shell-extensions-mediaplayer can be easily configured through http://extensions.gnome.org as well as command-line (all settings are listed below).

![Screenshot](http://github.com/eonpatapon/gnome-shell-extensions-mediaplayer/raw/master/data/prefs.png)

## Installation

### Via extensions.gnome.org

  * https://extensions.gnome.org/extension/55/media-player-indicator/

### Packages

  * Arch Linux - [AUR package](https://aur.archlinux.org/packages.php?ID=49367) by Alucryd
  * Ubuntu - [webupd8 PPA](http://www.webupd8.org/2011/10/gnome-shell-mediaplayer-extension.html)
  * Frugalware - [package](http://www.frugalware.org/packages/136448) by Baste

### Manual installation

Git branches `master` and `devel` work with the current stable release of GNOME Shell (currently 3.4). For older GNOME versions (3.0 and 3.2), separate branches `gnome-shell-3.0` and `gnome-shell-3.2` exist, but they won't have most of the new features.

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

  * **Show the extension in its own menu instead of the volume menu:** (default: true)

        gsettings set org.gnome.shell.extensions.mediaplayer volumemenu false

  * **Start the default media player by clicking on the status icon if no player is running:** (default: false)

        gsettings set org.gnome.shell.extensions.mediaplayer rundefault true

    You can configure the default media player in GNOME System Settings, under *Details
    → Default Applications*.

    Note: This setting has no effect if the extension is shown in the volume menu.

  * **Show the volume control slider of the media player:** (default: false)

        gsettings set org.gnome.shell.extensions.mediaplayer volume true

  * **Show the playlists of the media player:** (default: false)

        gsettings set org.gnome.shell.extensions.mediaplayer playlists true

  * **Show the rating of the current track:** (default: false)

        gsettings set org.gnome.shell.extensions.mediaplayer rating true

    Players supported (get: show the rating, set: set a rating):

      * Banshee (get/set)
      * Rhythmbox (get/set)
      * Clementine (get)
      * Amarok (get)

    **Warning:** Ratings are not part of the MPRIS specification thus specific code
    must be written for each player to set or get the current track rating. Note that
    for some players there will be no support to get/set the rating from this extension.
    For example, Clementine does not offer any way to set the rating of a song except from the Clementine GUI (http://bit.ly/INFEon).

  * **Hide the position slider:** (default: true)

        gsettings set org.gnome.shell.extensions.mediaplayer position false

  * **Set the size of the cover:** (default: 80)

        gsettings set org.gnome.shell.extensions.mediaplayer coversize 100

## Compatible players

Any player that supports the [MPRIS v2](http://www.mpris.org/2.1/spec/) 
spec can be supported.

**Note:** Many players will require you to enable the MPRIS v2 support
manually. If your player is listed but still doesn't work, look for words
"MPRIS" or "D-Bus" in the player's plugins.

This extension has been tested with:

  * Amarok
  * Audacious (3.2 with "MPRIS 2 Server" plugin)
  * Banshee (with "MPRIS D-Bus interface" extension)
  * BeatBox
  * Clementine
  * DeaDBeeF (with third-party DeaDBeeF-MPRIS plugin)
  * GMusicBrowser
  * Guayadeque (0.3.2)
  * mpd (with [mpDris2](https://github.com/eonpatapon/mpDris2) daemon)
  * Nuvola *aka* Google Music Frame
  * Pithos
  * Pragha (with MPRIS2 enabled under "Internet Services")
  * Quod Libet (with "MPRIS D-Bus support" plugin)
  * Rhythmbox (with "MPRIS D-Bus interface" plugin)
  * Spotify
  * Tomahawk
  * Totem (with "D-Bus Service" plugin)
  * VLC (2.x with "dbus" control interface)
  * XBMC (with "MPRIS D-Bus interface" add-on)
  * *and more...*

## Known bugs

### Track position is not updated correctly

Some players do not send the MPRIS "Seeked" signal so the extension can't update
the position slider when the song is seeked from the extension or the player.

* VLC: https://trac.videolan.org/vlc/ticket/6802
* Banshee: https://bugzilla.gnome.org/show_bug.cgi?id=654524

## *Not* supported players

  * Exaile 0.3.2 – only supports MPRIS v1, not v2
  * Nightingale 1.11 – no native MPRIS support, only a third-party v1 plugin

## Authors

  * eonpatapon (Jean-Philippe Braun)
  * grawity (Mantas Mikulėnas)

Based on the work of horazont (Jonas Wielicki).
