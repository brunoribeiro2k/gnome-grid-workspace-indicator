// Loads the installed prefs.js through the real ExtensionPreferences base class, drives the
// widget <-> GSettings bindings without a pointer, and writes one PASS/FAIL line.
// Usage: gjs -m prefs-harness.js <extension dir> <output file>
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Gdk from 'gi://Gdk?version=4.0';
import Gtk from 'gi://Gtk?version=4.0';
import Adw from 'gi://Adw?version=1';

const [extDir, outFile] = ARGV;
let line;
try {
    Gio.Resource.load('/usr/share/gnome-shell/org.gnome.Shell.Extensions.src.gresource')._register();
    Adw.init();
    const dir = Gio.File.new_for_path(extDir);
    const metadata = JSON.parse(new TextDecoder().decode(dir.get_child('metadata.json').load_contents(null)[1]));
    const { default: Prefs } = await import(`file://${extDir}/prefs.js`);
    const win = new Adw.PreferencesWindow();
    new Prefs({ ...metadata, dir, path: dir.get_path() }).fillPreferencesWindow(win);
    win.present();

    const settings = win._settings;
    const page = win.get_visible_page();
    const all = [];
    const walk = w => { for (let c = w.get_first_child(); c; c = c.get_next_sibling()) { all.push(c); walk(c); } };
    walk(page);
    const buttons = all.filter(w => w instanceof Gtk.ColorDialogButton);
    const active = buttons[0];

    let writes = 0;
    const id = settings.connect('changed::active-fill', () => writes++);
    const red = new Gdk.RGBA(); red.parse('rgba(255, 0, 0, 0.5)');
    active.set_rgba(red);                                   // what a finished color dialog does
    const picked = settings.get_string('active-fill'), pickWrites = writes;
    settings.set_string('active-fill', 'rgba(0, 128, 255, 1)');  // external change
    const synced = active.get_rgba().to_string(), extWrites = writes - pickWrites;
    all.find(w => w instanceof Gtk.Button && w.label === 'Reset all settings').emit('clicked');
    const reset = settings.get_string('active-fill');
    settings.disconnect(id);
    win.close();
    settings.set_string('active-fill', 'rgba(1, 2, 3, 1)');    // must no longer reach the button
    const afterClose = active.get_rgba().to_string();
    settings.reset('active-fill');
    const build = all.find(w => w instanceof Gtk.Label && w.label?.startsWith('Build'))?.label;

    const ok = buttons.length === 3 && buttons.every(b => b.dialog.with_alpha) &&
        picked === 'rgba(255,0,0,0.5)' && pickWrites === 1 &&
        synced === 'rgb(0,128,255)' && extWrites === 1 &&
        reset === 'rgba(255, 255, 255, 1)' && afterClose === 'rgb(255,255,255)' && !!build;
    line = `${ok ? 'PASS' : 'FAIL'} buttons=${buttons.length} picked=${picked} pickWrites=${pickWrites} ` +
        `synced=${synced} extWrites=${extWrites} reset=${reset} afterClose=${afterClose} build="${build}"`;
} catch (e) {
    line = `FAIL ${e} ${e.stack?.split('\n')[0]}`;
}
GLib.file_set_contents(outFile, line);
