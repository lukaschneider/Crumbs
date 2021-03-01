# Crumbs

This Visual Studio Code extension adds support to open and inspect packet traces directly within the editor.

## Features
This extension uses sharkd (Wireshark) as its data source and can therefore provide:
- Wiresharks protocol detection
- Support for various different file types
- Familiar color coding

### Planned:
- Display Filters
- Frame Hex View
- Save As different file type option
- Export selected Frames
- Capture from interface
- Packet Editing
- More and better config options and integrations within VSCode

## Requirements
In order to work you have to install `sharkd (Wireshark)` on your system.

To use this extension on Windows you need to use WSL with VSCode Remote.

> Crumbs does not work natively on Windows!


## How to Use

### Color Coded Rows
To use Wiresharks row color coding rules you have to enable it with the `crumbs.editor.coloredRows` setting. This setting is disabled by default because it doesn't get along with some color themes (especially high contrast ones) and could be too bright for night owls 🦉.

> Currently, coloring rules have to be adapted externaly in Wireshark (View → Coloring Rules...).

### Changing Columns
Columns can be customized via `crumbs.editor.columns` either globaly or per workspace.

The `type` property sets wheter you want to use one of Wiresharks predefined columns or if you want to use a custom one.

If you want to display a specific field you can set a `field`. The `type` can be ommited in this case. A list of available field names per protocol can be found in [Wiresharks Display Filter Reference](https://www.wireshark.org/docs/dfref/).

Occurence defines which occurence of a `field` should be used. By default Crumbs uses the first (0).

> Changes will apply if you reopen the packet editor or execute the `Developer: Reopen Webviews` command.

### Sorting and Shifting Columns
You can sort columns by clicking on the header. Chain sorts by holding shift while clicking on the header.

Shift a column by dragging the header to the left or the right.
> These changes do not persist.

### Viewing Frame Details
To view the details of a frame, simply double-click a line or press Enter to open the Frame Tree View normally located in the panel.

In the Frame Tree View, the last focused frame is displayed regardless of the editor.

> The Frame Tree View is only visible when a packet editor is open.

## Known Issues
* The sharkd process is not cleaned up properly currently.

To track issues please go to the Github repo https://github.com/lukaschneider/crumbs
