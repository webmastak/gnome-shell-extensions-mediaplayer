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

----

### Installation

* Archlinux [AUR package](http://aur.archlinux.org/packages.php?ID=49367) by Alucryd
* Ubuntu [webupd8 PPA](http://www.webupd8.org/2011/10/gnome-shell-mediaplayer-extension.html)

Manual installation :

    ./autogen.sh --prefix=/usr
    make
    sudo make install
  
That's it!

----

### Settings

To show the extension in its own menu instead of the volume menu:

```gsettings set org.gnome.shell.extensions.mediaplayer volumemenu false```

To show the volume control slider of the media player:

```gsettings set org.gnome.shell.extensions.mediaplayer volume true```

Set the size of the cover (default 80):

```gsettings set org.gnome.shell.extensions.mediaplayer coversize 100```

----

### Authors

* eon@patapon.info - Jean-Philippe Braun
* Based on the work of j.wielicki@sotecware.net (https://github.com/horazont/gnome-shell-extensions-mediaplayer)
* Some bits taken from Freddy Cornil (https://github.com/Caccc/Gnome-shell-extension-Mediasplayers)
