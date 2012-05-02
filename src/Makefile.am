include ../include.mk

dist_extension_DATA = extension.js widget.js dbus.js lib.js prefs.js stylesheet.css 
nodist_extension_DATA = metadata.json

EXTRA_DIST = metadata.json.in
CLEANFILES = metadata.json

gschemas_in = $(gschemabase).$(extensionname).gschema.xml.in

@INTLTOOL_XML_NOMERGE_RULE@

gsettings_SCHEMAS = $(gschemas_in:.xml.in=.xml)

@GSETTINGS_RULES@

CLEANFILES += $(gschemas_in:.xml.in=.valid) $(gsettings_SCHEMAS)
EXTRA_DIST += $(gschemas_in)

metadata.json: metadata.json.in $(top_builddir)/config.status
	$(AM_V_GEN) sed -e "s|[@]UUID@|$(uuid)|" \
        -e "s|[@]LOCALEDIR@|$(datadir)/locale|" \
	    -e "s|[@]URL@|$(extensionurl)|" $< > $@
