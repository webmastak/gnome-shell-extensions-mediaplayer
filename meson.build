project('gnome-shell-extensions-mediaplayer',
  meson_version: '>= 0.40.0'
)

UUID = 'mediaplayer@patapon.info'
EXTENSION_DIR = join_paths(get_option('prefix'), get_option('datadir'), 'gnome-shell/extensions/', UUID)
LOCALE_DIR = join_paths(EXTENSION_DIR, 'locale')
SCHEMA_DIR = join_paths(EXTENSION_DIR, 'schemas')

subdir('po')
subdir('src')

meson.add_install_script('meson_post_install.py')
