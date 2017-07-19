#!/usr/bin/env python3

from os import environ, path
from subprocess import call

HOME = path.join(path.expanduser('~'), '.local/')
PREFIX = environ.get('MESON_INSTALL_PREFIX', HOME)
DATA_DIR = path.join(PREFIX, 'share')
DEST_DIR = environ.get('DESTDIR', '')
EXTENSION_DIR = path.join(DATA_DIR,
                          "gnome-shell/extensions/mediaplayer@patapon.info")

if not DEST_DIR:
    print("Installing new Schemas")
    call(['glib-compile-schemas', path.join(EXTENSION_DIR, 'schemas/')])
