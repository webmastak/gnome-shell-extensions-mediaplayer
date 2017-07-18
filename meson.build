project('gnome-shell-extensions-mediaplayer',
  version: '2.7.4',
  meson_version: '>= 0.40.0'
)
UUID = 'mediaplayer@patapon.info'
URL  = 'https://github.com/JasonLG1979/gnome-shell-extensions-mediaplayer/'
EXTENSION_DIR = join_paths(get_option('prefix'), get_option('datadir'), '/gnome-shell/extensions/', UUID)
LOCALE_DIR = join_paths(get_option('prefix'), get_option('localedir'), UUID)

i18n = import('i18n')

subdir('po')
subdir('src')

meson.add_install_script('meson_post_install.py')
