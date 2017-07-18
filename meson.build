project('gnome-shell-extensions-mediaplayer',
  version: '2.7.4',
  meson_version: '>= 0.40.0',
  default_options: [
    'localedir=share/gnome-shell/extensions/mediaplayer@patapon.info/locale'
  ]
)
UUID = 'mediaplayer@patapon.info'
URL  = 'https://github.com/JasonLG1979/gnome-shell-extensions-mediaplayer/'
EXTENSION_DIR = join_paths(get_option('prefix'), get_option('datadir'), 'gnome-shell/extensions/', UUID)
LOCALE_DIR = join_paths(EXTENSION_DIR, 'locale')
SCHEMA_DIR = join_paths(EXTENSION_DIR, 'schemas')

subdir('po')
subdir('src')

meson.add_install_script('meson_post_install.py')
