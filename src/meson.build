conf = configuration_data()
conf.set('LOCALEDIR', LOCALE_DIR)
conf.set('URL', URL)
conf.set('UUID', UUID)


install_data([
    'dbus.js',
    'extension.js',
    'lib.js',
    'manager.js',
    'panel.js',
    'player.js',
    'prefs.js',
    'settings.js',
    'stylesheet.css',
    'ui.js',
    'util.js',
    'widget.js'
  ],
  install_dir: EXTENSION_DIR
)

install_data('org.gnome.shell.extensions.mediaplayer.gschema.xml',
  install_dir: EXTENSION_DIR
)

configure_file(
  input: 'metadata.json.in',
  output: 'metadata.json',
  configuration: conf,
  install: true,
  install_dir: EXTENSION_DIR
)
