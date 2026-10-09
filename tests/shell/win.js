// Opens a plain GTK window titled 'gsitest' so the checks have an app window to move around.
imports.gi.versions.Gtk = '4.0';
const {Gtk, GLib} = imports.gi;
Gtk.init();
new Gtk.Window({title: 'gsitest'}).present();
GLib.MainLoop.new(null, false).run();
