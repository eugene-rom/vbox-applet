/* global imports, global */

const { GLib, Gio, GObject, St, Shell } = imports.gi;

const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const ByteArray = imports.byteArray;

const TEXT_VBOXAPP = 'VirtualBox applet';
const TEXT_LOGID   = 'vbox-applet';
const ICON_SIZE    = 22;
const DEBUG        = false;

const SETTING_SORT = 'sort';

let settings;
let vboxapplet;
let enabled = false;

let VBoxApplet = GObject.registerClass(
class VBoxApplet extends PanelMenu.Button
{
    _init()
    {
        super._init( 0.0, TEXT_VBOXAPP );

        this._populated = false;
        this._menuitems = [];
        let gicon = Gio.icon_new_for_string( Me.path + '/icons/vbox.svg' );
        let icon = new St.Icon( { gicon: gicon, icon_size: ICON_SIZE } );
        this.add_child( icon );

        this._tmpItem = new PopupMenu.PopupMenuItem( '...' );
        this.menu.addMenuItem( this._tmpItem );

        this._startVbox = () => {
            GLib.spawn_command_line_async( 'virtualbox' );
        };

        this._startVM = ( name, id ) => {
            if ( this._isVMRunning( id ) ) {
                this._activateWindow( name );
            }
            else {
                GLib.spawn_command_line_async( 'vboxmanage startvm ' + id );
            }
        };

        this._toggleSort = ( menuitemSort ) => {
            let sort = settings.get_boolean( SETTING_SORT );
            menuitemSort.setToggleState( !sort );
            settings.set_boolean( SETTING_SORT, !sort );
            GLib.timeout_add( GLib.PRIORITY_DEFAULT, 10, this._populateMenu.bind(this) );
        };

        this._parseVMList = ( vms ) => {
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
        };

        this._populateMenu = () => {
            this._menuitems = [];
            this.menu.removeAll();

            let vms;
            let sort = settings.get_boolean( SETTING_SORT );
            try
            {
                let cmd = 'vboxmanage list ' + ( sort ? '-s' : '' ) + ' vms';
                this._log( 'Run \'' + cmd + '\'' );
                vms = ByteArray.toString( GLib.spawn_command_line_sync( cmd )[1] );
            }
            catch (err) {
                this._log( err );
                Main.notifyError( TEXT_VBOXAPP + ': ' + err );
                return;
            }

            let machines = this._parseVMList( vms );

            if ( machines.length !== 0 )
            {
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

            let menuitemRefresh = new PopupMenu.PopupMenuItem( 'Refresh' );
            menuitemRefresh.connect( 'activate', this._populateMenu.bind(this) );
            this.menu.addMenuItem( menuitemRefresh );

            let menuitemSort = new PopupMenu.PopupSwitchMenuItem( 'Sort', sort );
            menuitemSort.connect( 'toggled', this._toggleSort.bind(this, menuitemSort) );
            this.menu.addMenuItem( menuitemSort );

            let menuitemStartVBox = new PopupMenu.PopupMenuItem( 'VirtualBox...' );
            menuitemStartVBox.connect( 'activate', this._startVbox.bind(this) );
            this.menu.addMenuItem( menuitemStartVBox );

            this._populated = true;

            this._onVisibilityChanged();

            return false;
        };

        this._log = ( text ) => {
            if ( DEBUG ) {
                global.log( TEXT_LOGID, text );
            }
        };

        this._isVMRunning = ( id ) => {
            let machines = this._getRunningVMs();
            return this._searchInVMs( machines, id );
        };

        this._getRunningVMs = () => {
            let vms;
            try {
                this._log( 'Run \'vboxmanage list runningvms\'' );
                vms = ByteArray.toString( GLib.spawn_command_line_sync( 'vboxmanage list runningvms' )[1] );
            }
            catch (err) {
                this._log( err );
                return;
            }

            return this._parseVMList( vms );
        };

        this._onVisibilityChanged = () => {
            if ( this.menu.actor.visible && this._populated ) {
                GLib.timeout_add( GLib.PRIORITY_DEFAULT, 10, this._markRunning.bind(this) );
            }
        };

        this._markRunning = () => {
            let machines = this._getRunningVMs();

            for (var i = 0; i < this._menuitems.length; i++) {
                let running = this._searchInVMs( machines, this._menuitems[i]._vmid );
                this._menuitems[i].setOrnament( running ? PopupMenu.Ornament.DOT : PopupMenu.Ornament.NONE );
            }
            return false;
        };

        this._searchInVMs = ( machines, id ) => {
            for ( var i = 0; i < machines.length; i++ ) {
                if ( machines[i].id === id ) {
                    return true;
                }
            }
            return false;
        };

        this._activateWindow = ( name ) => {
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
        };

        this.menu.actor.connect( 'notify::visible', this._onVisibilityChanged.bind(this) );
        GLib.timeout_add_seconds( GLib.PRIORITY_DEFAULT, 3, this._populateMenu.bind(this) );
    }
} );

function init() {
    settings = ExtensionUtils.getSettings();
}

function enable() {
    enabled = true;
    vboxapplet = new VBoxApplet;
    Main.panel.addToStatusArea( TEXT_VBOXAPP, vboxapplet );
}

function disable() {
    enabled = false;
    vboxapplet.destroy();
}
