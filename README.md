## gnome-shell-extension-mediaplayer

gnome-shell-extension-mediaplayer is a simple extension for controlling any MPRIS v2.1 capable Mediaplayer.

This extension will monitor DBus to look for active players automatically (player names are referenced in the 
metadata.json file). All active players are shown in the gnome-shell volume menu by default.

Tested players :

* Clementine
* Banshee (with MPRIS D-Bus interface plugin)
* Rhythmbox (with MPRIS D-Bus interface plugin)
* mpd (with mpDris2)
* Pragha
* Quod Libet (with MPRIS D-Bus interface plugin)
* Guayadeque 0.3.2
* Amarok
* Spotify
* Nuvola
* and more...

----

### Gnome Shell support

* master (stable branch)
* devel (unstable branch)
* branch gnome-shell-3.0 supports gnome-shell 3.0.X

----

### Screenshots

By default, media players shows up in the volume menu:

![Screenshot](http://github.com/eonpatapon/gnome-shell-extensions-mediaplayer/raw/devel/data/mediaplayer2.png) 

But you can have the media players in a separate menu (see settings):

![Screenshot](http://github.com/eonpatapon/gnome-shell-extensions-mediaplayer/raw/devel/data/mediaplayer1.png)

Notice the support of playlists in Banshee (MPRIS 2.1 player interface).

----

### Installation

## Via extensions.gnome.org

* https://extensions.gnome.org/extension/55/media-player-indicator/

Note that this version does not include gsettings options.

## Packages

* Archlinux [AUR package](http://aur.archlinux.org/packages.php?ID=49367) by Alucryd
* Ubuntu [webupd8 PPA](http://www.webupd8.org/2011/10/gnome-shell-mediaplayer-extension.html)
* Frugalware [package](http://www.frugalware.org/packages/136448) by Baste

## Manual installation

    ./autogen.sh
    make
    sudo make install
  
----

### Settings

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


----

### Authors

* eonpatapon (Jean-Philippe Braun)
* grawity (Mantas Mikulėnas)

Based on the work of horazont (Jonas Wielicki)
