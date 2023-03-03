# VirtualBox applet


<a href="https://extensions.gnome.org/extension/5799/" >
   <img src="/media/get-on-ego.svg" height="100px"/>
</a>


This applet is a fork from https://github.com/eugene-rom/vbox-applet repository. I just added the headless start option.

Gnome Shell VirtualBox applet provide menu to run VirtualBox machines and switch between running VMs.

VM list populated after few seconds after extension is activated, to not slow down screen unlock.
(Gnome Shell deactivates all extensions on screen lock and activates on unlock).

Applet checks if machines is running and mark items with dot shortly after popup becomes visible.
Applet is able to run a VM in headless mode by toggling the headless option.

![screenshot](screenshot.png?raw=true)

