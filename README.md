## gnome-shell-extension-mediaplayer

gnome-shell-extension-mediaplayer is a simple extension for controlling any MPRIS capable Mediaplayer.

This extension will monitor DBus to look for active players automatically. All active players are shown in the menu.

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

* master supports gnome-shell 3.2.X
* branch gnome-shell-3.0 supports gnome-shell 3.0.X

----

### Screenshots

![Screenshot](gnome-shell-extensions-mediaplayer/raw/master/data/mediaplayer1.png)

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

### Authors

* eon@patapon.info - Jean-Philippe Braun
* Based on the work of j.wielicki@sotecware.net (https://github.com/horazont/gnome-shell-extensions-mediaplayer)
* Some bits taken from Freddy Cornil (https://github.com/Caccc/Gnome-shell-extension-Mediasplayers)
