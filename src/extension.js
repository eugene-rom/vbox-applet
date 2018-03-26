/* global imports */

const St = imports.gi.St;
const Gio = imports.gi.Gio;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const GLib = imports.gi.GLib;
const Main = imports.ui.main;
const Mainloop = imports.mainloop;
const Me = imports.misc.extensionUtils.getCurrentExtension();

const TEXT_VBOXAPP = 'VirtualBox applet';
const TEXT_LOGID   = 'vbox-applet';

let vboxapplet;
let enabled = false;

class VBoxApplet extends PanelMenu.Button
{
    constructor() {
        super( 0.0, TEXT_VBOXAPP );

        let hbox = new St.BoxLayout( { style_class: 'panel-status-menu-box' } );
        let gicon = Gio.icon_new_for_string( Me.path + '/icons/vbox.svg' );
        hbox.add_child( new St.Icon( { gicon: gicon, style_class: 'system-status-icon' } ) );
        this.actor.add_child(hbox);

        this._tmpItem = new PopupMenu.PopupMenuItem( '...' );
        this.menu.addMenuItem( this._tmpItem );

        Mainloop.timeout_add_seconds( 10, this.populateMenu.bind(this) );
    }

    startVbox() {
		GLib.spawn_command_line_async( 'virtualbox' );
    }

    startVM(id) {
		GLib.spawn_command_line_async( 'virtualbox --startvm ' + id );
    }

    populateMenu()
    {
        let vms;
        try {
            vms = String( GLib.spawn_command_line_sync( 'vboxmanage list vms' )[1] );
        }
        catch (err) {
            Main.notifyError( TEXT_VBOXAPP + ': ' + err );
            return;
        }

        if ( vms.length !== 0 )
        {
            this._tmpItem.destroy();

            let machines = vms.toString().split('\n');
            for ( let i = 0; i<machines.length; i++ )
            {
                let machine = machines[i];
                if ( machine === '' ) {
                    continue;
                }

                let info = machine.split('" {');
                let name = info[0].replace('"', '');
                let id = info[1].replace('}', '');

                //global.log( TEXT_LOGID, 'Machine name: ' + name + ', ID: ' + id );

                let menuitem = new PopupMenu.PopupMenuItem( name );
                menuitem.connect( 'activate', this.startVM.bind(this, id) );
                this.menu.addMenuItem(menuitem);
            }
        }

        this.menu.addMenuItem( new PopupMenu.PopupSeparatorMenuItem() );

        let menuitem = new PopupMenu.PopupMenuItem( 'VirtualBox...' );
    	menuitem.connect( 'activate', this.startVbox.bind(this) );
        this.menu.addMenuItem( menuitem );

        return false;
    }
};


function enable() {
    enabled = true;
    vboxapplet = new VBoxApplet;
    Main.panel.addToStatusArea( TEXT_VBOXAPP, vboxapplet );
}

function disable() {
    enabled = false;
    vboxapplet.destroy();
}
