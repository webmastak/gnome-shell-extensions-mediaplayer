## gnome-shell-extension-mediaplayer

gnome-shell-extension-mediaplayer is a simple extension for controlling any MPRIS capable Mediaplayer.

This extension will monitor DBus to look for active players automatically. Active players are shown automatically in the menu.

----

### Screenshots

![Screenshot](gnome-shell-extensions-mediaplayer/raw/master/data/mediaplayer1.png)

![Screenshot](gnome-shell-extensions-mediaplayer/raw/master/data/mediaplayer2.png)

----

### Installation

For installation, run the following commands:

    ./autogen.sh --prefix=/usr
    make
    sudo make install
  
That's it!

----

### Authors

* eon@patapon.info - Jean-Philippe Braun
* Based on the work of j.wielicki@sotecware.net (https://github.com/horazont/gnome-shell-extensions-mediaplayer)
* Some bits taken from Freddy Cornil (https://github.com/Caccc/Gnome-shell-extension-Mediasplayers)
