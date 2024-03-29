import GLib from 'gi://GLib'
import Gio from 'gi://Gio'
import GObject from 'gi://GObject'
import St from 'gi://St'
import Shell from 'gi://Shell'

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

const TEXT_VBOXAPP = 'VirtualBox applet';
const TEXT_LOGID   = 'vbox-applet';
const ICON_SIZE    = 22;
const DEBUG        = false;

const SETTING_SORT = 'sort';

let settings;
let sourceId1 = null;
let sourceId2 = null;
let sourceId3 = null;

class VBoxAppletBtn extends PanelMenu.Button
{
    static {
        GObject.registerClass(this);
    }

    constructor( path )
    {
        super( 0.0, TEXT_VBOXAPP );

        this._textdecoder = new TextDecoder();
        this._populated = false;
        this._menuitems = [];
        let gicon = Gio.icon_new_for_string( path + '/icons/vbox-symbolic.svg' );
        let icon = new St.Icon( { gicon: gicon, icon_size: ICON_SIZE } );
        this.add_child( icon );

        this._tmpItem = new PopupMenu.PopupMenuItem( '...' );
        this.menu.addMenuItem( this._tmpItem );

        this.menu.actor.connect( 'notify::visible', this._onVisibilityChanged.bind(this) );
        sourceId3 = GLib.timeout_add_seconds( GLib.PRIORITY_DEFAULT, 3, this._populateMenu.bind(this) );
    }

    _startVbox() {
        GLib.spawn_command_line_async( 'virtualbox' );
    };

    _startVM( name, id ) {
        if ( this._isVMRunning( id ) ) {
            this._activateWindow( name );
        }
        else {
            GLib.spawn_command_line_async( 'vboxmanage startvm ' + id );
        }
    };

    _toggleSort( menuitemSort ) {
        let sort = settings.get_boolean( SETTING_SORT );
        menuitemSort.setToggleState( !sort );
        settings.set_boolean( SETTING_SORT, !sort );
        sourceId1 = GLib.timeout_add( GLib.PRIORITY_DEFAULT, 10, this._populateMenu.bind(this) );
    };

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
    };

    _populateMenu()
    {
        this._menuitems = [];
        this.menu.removeAll();

        let vms;
        let sort = settings.get_boolean( SETTING_SORT );
        try
        {
            let cmd = 'vboxmanage list ' + ( sort ? '-s' : '' ) + ' vms';
            this._log( 'Run \'' + cmd + '\'' );
            vms = this._textdecoder.decode( GLib.spawn_command_line_sync( cmd )[1] );
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
            vms = this._textdecoder.decode( GLib.spawn_command_line_sync( 'vboxmanage list runningvms' )[1] );
        }
        catch (err) {
            this._log( err );
            return;
        }

        return this._parseVMList( vms );
    }

    _onVisibilityChanged() {
        if ( this.menu.actor.visible && this._populated ) {
            sourceId2 = GLib.timeout_add( GLib.PRIORITY_DEFAULT, 10, this._markRunning.bind(this) );
        }
    }

    _markRunning() {
        let machines = this._getRunningVMs();

        for (var i = 0; i < this._menuitems.length; i++) {
            let running = this._searchInVMs( machines, this._menuitems[i]._vmid );
            this._menuitems[i].setOrnament( running ? PopupMenu.Ornament.DOT : PopupMenu.Ornament.NONE );
        }
        return false;
    }

    _searchInVMs( machines, id ) {
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
}

export default class VBoxApplet extends Extension
{
    enable() {
        settings = this.getSettings();
        this._vboxapplet = new VBoxAppletBtn( this.path );
        Main.panel.addToStatusArea( TEXT_VBOXAPP, this._vboxapplet );
    }

    disable()
    {
        // GS guidelines requirements
        if ( sourceId1 ) {
            GLib.Source.remove( sourceId1 );
            sourceId1 = null;
        }
        if ( sourceId2 ) {
            GLib.Source.remove( sourceId2 );
            sourceId2 = null;
        }
        if ( sourceId3 ) {
            GLib.Source.remove( sourceId3 );
            sourceId3 = null;
        }

        this._vboxapplet.destroy();
        settings = null;
        this._vboxapplet = null;
    }
}
