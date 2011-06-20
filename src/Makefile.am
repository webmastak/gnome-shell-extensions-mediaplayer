extensionurl = https://github.com/eonpatapon/gnome-shell-extensions-mediaplayer

# Change these to modify how installation is performed
topextensiondir = $(datadir)/gnome-shell/extensions

uuid = mediaplayer@patapon.info

extensiondir = $(topextensiondir)/$(uuid)

dist_extension_DATA = extension.js stylesheet.css cover.png icons/*.svg
nodist_extension_DATA = metadata.json $(EXTRA_EXTENSION)

EXTRA_DIST = metadata.json.in

metadata.json: metadata.json.in $(top_builddir)/config.status
	$(AM_V_GEN) sed -e "s|[@]LOCALEDIR@|$(datadir)/locale|" \
	    -e "s|[@]EXTENSIONDIR@|$(extensiondir)|" \
	    -e "s|[@]UUID@|$(uuid)|" \
	    -e "s|[@]SHELLVERSION@|$(PACKAGE_VERSION)|" \
	    -e "s|[@]URL@|$(extensionurl)|" $< > $@

CLEANFILES = metadata.json
