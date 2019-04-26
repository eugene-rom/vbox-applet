/* global imports, global */

const { GLib, Gio, St, Shell } = imports.gi;

const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Me = imports.misc.extensionUtils.getCurrentExtension();

const TEXT_VBOXAPP = 'VirtualBox applet';
const TEXT_LOGID   = 'vbox-applet';
const ICON_SIZE    = 22;
const DEBUG        = false;

let vboxapplet;
let enabled = false;

class VBoxApplet extends PanelMenu.Button
{
    constructor() {
        super( 0.0, TEXT_VBOXAPP );

        this._populated = false;
        this._menuitems = [];
        let gicon = Gio.icon_new_for_string( Me.path + '/icons/vbox.svg' );
        let icon = new St.Icon( { gicon: gicon, icon_size: ICON_SIZE } );
        this.actor.add_child( icon );
        this.menu.actor.connect( 'notify::visible', this._onVisibilityChanged.bind(this) );

        this._tmpItem = new PopupMenu.PopupMenuItem( '...' );
        this.menu.addMenuItem( this._tmpItem );

        GLib.timeout_add_seconds( GLib.PRIORITY_DEFAULT, 5, this._populateMenu.bind(this) );
    }

    _startVbox() {
        GLib.spawn_command_line_async( 'virtualbox' );
    }

    _startVM( name, id )
    {
        if ( this._isVMRunning( id ) ) {
            this._activateWindow( name );
        }
        else {
            GLib.spawn_command_line_async( 'vboxmanage startvm ' + id );
        }
    }

    _parseVMList( vms )
    {
        let res = [];
        if ( vms.length !== 0 )
        {
            let machines = vms.toString().split('\n');
            for ( let i = 0; i < machines.length; i++ )
            {
                let machine = machines[i];
                if ( machine === '' ) {
                    continue;
                }

                let info = machine.split('" {');
                let name = info[0].replace('"', '');
                let id = info[1].replace('}', '');

                this._log( 'Machine name: ' + name + ', ID: ' + id );

                res.push( { name:name, id:id } );
            }
        }
        return res;
    }

    _populateMenu()
    {
        let vms;
        try {
            this._log( 'Run \'vboxmanage list vms\'' );
            vms = String( GLib.spawn_command_line_sync( 'vboxmanage list vms' )[1] );
        }
        catch (err) {
            this._log( err );
            Main.notifyError( TEXT_VBOXAPP + ': ' + err );
            return;
        }

        let machines = this._parseVMList( vms );

        if ( machines.length !== 0 )
        {
            this._tmpItem.destroy();

            for ( let i = 0; i < machines.length; i++ )
            {
                let name = machines[i].name;
                let id = machines[i].id;

                let menuitem = new PopupMenu.PopupMenuItem( name );
                menuitem._vmid = id;
                menuitem.connect( 'activate', this._startVM.bind(this, name, id) );
                this.menu.addMenuItem(menuitem);
                this._menuitems.push(menuitem);
            }
        }

        this.menu.addMenuItem( new PopupMenu.PopupSeparatorMenuItem() );

        let menuitem = new PopupMenu.PopupMenuItem( 'VirtualBox...' );
    	menuitem.connect( 'activate', this._startVbox.bind(this) );
        this.menu.addMenuItem( menuitem );

        this._populated = true;

        return false;
    }

    _log( text ) {
        if ( DEBUG ) {
            global.log( TEXT_LOGID, text );
        }
    }

    _isVMRunning( id ) {
        let machines = this._getRunningVMs();
        return this._searchInVMs( machines, id );
    }

    _getRunningVMs()
    {
        let vms;
        try {
            this._log( 'Run \'vboxmanage list runningvms\'' );
            vms = String( GLib.spawn_command_line_sync( 'vboxmanage list runningvms' )[1] );
        }
        catch (err) {
            this._log( err );
            return;
        }

        return this._parseVMList( vms );
    }

    _onVisibilityChanged() {
        if ( this.menu.actor.visible && this._populated ) {
            GLib.timeout_add( GLib.PRIORITY_DEFAULT, 200, this._markRunning.bind(this) );
        }
    }

    _markRunning()
    {
        let machines = this._getRunningVMs();

        for (var i = 0; i < this._menuitems.length; i++) {
            let running = this._searchInVMs( machines, this._menuitems[i]._vmid );
            this._menuitems[i].setOrnament( running ? PopupMenu.Ornament.DOT : PopupMenu.Ornament.NONE );
        }
    }

    _searchInVMs( machines, id )
    {
        for ( var i = 0; i < machines.length; i++ ) {
            if ( machines[i].id === id ) {
                return true;
            }
        }
        return false;
    }

    _activateWindow( name )
    {
        let a = global.get_window_actors();
        for (var i = 0; i < a.length; i++)
        {
            let mw = a[i].metaWindow;
            let title = mw.get_title();

            if ( title.startsWith( name ) && title.toLowerCase().includes('virtualbox') ) {
                this._log( 'activate window: ' + title );
                mw.activate( global.get_current_time() );
            }
        }
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
