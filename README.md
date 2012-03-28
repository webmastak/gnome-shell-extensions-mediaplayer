# gnome-shell-extensions-mediaplayer

gnome-shell-extensions-mediaplayer is a simple extension for controlling any 
MPRIS v2.1 capable Mediaplayer.

This extension will monitor DBus to look for active players automatically 
(player names are referenced in the metadata.json file). All active players 
are shown in the gnome-shell volume menu by default.

# Screenshots

By default, media players shows up in the volume menu:

![Screenshot](https://github.com/eonpatapon/gnome-shell-extensions-mediaplayer/raw/master/data/mediaplayer2.png) 

Notice the support of playlists in Banshee (MPRIS 2.1 playlist interface).

- - -

But you can have the media players in a separate menu (see settings):

![Screenshot](https://github.com/eonpatapon/gnome-shell-extensions-mediaplayer/raw/master/data/mediaplayer1.png)

You can go to the next or previous track by using the mouse wheel on the statuc icon. 
You can also play or pause the player by clicking with the middle button on the status icon.

- - -

gnome-shell-extensions-mediaplayer can be easily configured through http://extensions.gnome.org

![Screenshot](http://github.com/eonpatapon/gnome-shell-extensions-mediaplayer/raw/master/data/prefs.png)

## Installation

### Via extensions.gnome.org

* https://extensions.gnome.org/extension/55/media-player-indicator/

## Packages

* ArchLinux - [AUR package](https://aur.archlinux.org/packages.php?ID=49367) by Alucryd
* Ubuntu - [webupd8 PPA](http://www.webupd8.org/2011/10/gnome-shell-mediaplayer-extension.html)
* Frugalware - [package](http://www.frugalware.org/packages/136448) by Baste

## Manual installation

Prerequisites: automake, gnome-common, gettext, glib2 devel files

### System wide:

    ./autogen.sh
    make
    sudo make install

### In your .local directory:

    ./autogen.sh
    make install-zip

Restart the shell and then enable the extension.

## Settings

Settings can be set with the gnome-shell-extension-prefs tool or via the
command line.

To show the extension in its own menu instead of the volume menu:

```gsettings set org.gnome.shell.extensions.mediaplayer volumemenu false```

To show the volume control slider of the media player:

```gsettings set org.gnome.shell.extensions.mediaplayer volume true```

To show the playlists of the media player:

```gsettings set org.gnome.shell.extensions.mediaplayer playlists true```

To hide the position slider:

```gsettings set org.gnome.shell.extensions.mediaplayer position false```

To set the size of the cover (default 80):

```gsettings set org.gnome.shell.extensions.mediaplayer coversize 100```

## Compatible players

Any player that supports the [MPRIS v2](http://www.mpris.org/2.1/spec/) spec can be supported; however, due to certain limitations, players must be added to `metadata.json`.

This extension has been tested with:

* Amarok
* Audacious (3.2)
* Banshee (with "MPRIS D-Bus interface" extension)
* BeatBox
* Clementine
* DeaDBeeF (with third-party DeaDBeeF-MPRIS-plugin)
* GMusicBrowser
* Guayadeque (0.3.2)
* mpd (with [mpDris2](https://github.com/eonpatapon/mpDris2))
* Nuvola *aka* Google Music Frame
* Pithos
* Pragha (with MPRIS2 enabled under "Internet Services")
* Quod Libet (with "MPRIS D-Bus support" plugin)
* Rhythmbox (with "MPRIS D-Bus interface" plugin)
* Spotify
* Tomahawk
* Totem (with "D-Bus Service" plugin)
* VLC (2.x with `dbus` control interface)
* XBMC (with "MPRIS D-Bus interface" add-on)
* *and more...*

## GNOME Shell support

Branches `master` and `devel` work with the current stable release of GNOME Shell (currently 3.4).

* branch `gnome-shell-3.0` supports GNOME Shell 3.0.X
* branch `gnome-shell-3.2` supports GNOME Shell 3.2.X

## Authors

* eonpatapon (Jean-Philippe Braun)
* grawity (Mantas Mikulėnas)

Based on the work of horazont (Jonas Wielicki)
