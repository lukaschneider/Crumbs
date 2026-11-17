# Change Log

All notable changes to Crumbs will be documented here.

## [Unreleased]

Display filters are back, this time right above the packet list 😎. The rewrite also gets some much-needed polish for the Tree and Hex views, better Windows support, and a refreshed look.

### Added

- Display filter bar with validation while typing. Press Enter or Apply when ready; each editor pane has its own filter and shows the number of matching packets.
- Auto completion for protocols, fields, operators, and values observed in the capture.
- History for the 20 most recently applied filters, shared across captures in the local VS Code profile.
- "Apply as filter" and "Prepare as filter" menus in the Tree view, including negation and AND / OR / AND NOT / OR NOT combinations.
- Automatic detection of standard Wireshark installations on Windows. Custom sharkd paths are still supported.
- Capture error pages with useful hints, settings, retry, logs, and expandable technical details. The Tree and Hex views now have proper welcome screens too.
- A small demo capture with 37 synthetic packets, a few networking jokes, and a nod to when the original Crumbs started.
- A short feature GIF and a still screenshot for the README, with scripts to regenerate the capture and recording.
- MIT license and Marketplace metadata.
- Unit, component, and browser regression tests, plus integration tests using real VS Code and sharkd.
- Improved output log to better be able to debug issues.
- Add vim navigation keybindings (h/j/k/l) for navigating the frame list.

### Changed

- Refactored the Hex view to render only visible rows and avoid unnecessary re-rendering on hover. Protocol tree items, byte lookups, and filter suggestions are cached too.
- Improved Hex spacing and grouping, aligned it with the Tree view, and made layout settings update immediately.
- Packet colors now use matching VS Code theme colors on hover and selection, so text and selections stay readable.
- Refreshed the extension icon while keeping the original C and colors. Empty states and errors now have their own subtle icons.
- Aligned the filter bar, auto completion, and history controls with the VS Code UI. Removed redundant labels and the clear-input button.
- Disabled text selection on interface elements and removed the unused context menus from the Frame List and Hex view.
- Reworked the README to focus on features and usage, with a short development introduction and a separate development guide.
- Updated runtime and build dependencies, removed unused packages, and restricted webview scripts with a content security policy.

### Fixed

- Sharkd startup on older versions such as 3.6.2 by using explicit console mode for the default configuration and removing the unsupported `--foreground` option.
- Opening captures on installations without named Wireshark profiles. The profile setting now defaults to empty; startup errors retain profile diagnostics and explain how to use the default configuration.
- Opening captures with sharkd versions that reject a zero skip value on the first page.
- Windows capture paths and duplicate initialization when opening the same capture in split editors.
- Sharkd startup and cleanup: share the startup handshake, reject pending requests on process failures, and close sessions when they are no longer needed.
- Stale packet and filter responses overwriting newer selections or results. Packet selection is kept per editor, and repeated packet requests are deduplicated.
- Byte selection finding the wrong protocol field, old highlights remaining after changing packets, and selected fields not scrolling into view.
- Generated fields and reassembled data highlighting unrelated bytes in the captured frame.
- Hex wrapping and scrolling calculations ignoring padding, and invalid layout settings causing problems.
- Packet numbers, column labels, leading zeros, and numeric precision being lost in the Frame List.
- Auto completion not continuing immediately after inserting an operator.
- Double borders between adjacent selected packet rows, and selections becoming hard to see when focus moves to another view.
- The Tree welcome screen not matching the Hex welcome screen.
- F5 debugging now builds reliably without an extra task-matcher extension, with source maps and type checks for extension and webview code.
- Keep selected item visible on keyboard navigation.
- Vim style navigation also in column headers.

## [1.0.0]

Initial rewrite.

## [0.1.6] - 2022-02-03

The possiblity to do display filters is now finally here. It features auto completion of fields and validation of the filter.
Also introduced new issues like an complete abuse of the vscode context, which of course want to fix :)).

### Fixed

- Support for Sharkd (Wireshark) >3.6.0 ... I f***ed up.

### Added

- DISPLAY FILTERS! Via a new command "Crumbs: Apply Display Filter to Last Active Trace File".

## [0.1.5] - 2022-01-17

### Fixed

- Support for Sharkd (Wireshark) 3.6.0

## [0.1.4] - 2021-11-05

Finally a fully functional Hex View - with selection and settings. Next up will be (FINALLY) the option to set display filters.

### Added

- MacOS "Getting Started" instructions. Revived my old Macbook. Works as expected 😁.
- Option to disable rowWrapping in the new FrameHex view.
- Selecting a field in the FrameTree now selects the bytes in the FrameHex View and vice versa.

### Changed

- Disabled the contextmenu on the FrameList. The context menu is an "Enterprise" feature of AGGrid and I can therefore not make use of it properly.
- Text of the recently introduced "Open Last Active Trace File in Wireshark" feature now better describes what it does.
- Refactored FrameHex view to make it more configurable.

## [0.1.3] - 2021-08-28

Some Quality updates and an initial Hex View 🎉. In the future this new Hex View should idealy be able to focus things in the Tree View and vice versa and live in more crumbled places too.

### Added

- New "Open Last Active Trace File in Wireshark" Command. For situations where Crumbs isn't enough.
- New Severity indication in the Frame Explorer. Makes it easier to find "Expert Infos".
- Initial Hex View.

## [0.1.2] - 2021-07-03

### Changed

- Pressing enter doesn't automatically focus the Frame Tree Explorer anymore. This anoyed me...

### Fixed

- Sharkd should no longer crash when changing settings.

## [0.1.1] - 2021-05-24

React Rewrite 😎. This will make it easier to build upon in the future.

### Added

- Possiblity to pin columns.
- Automatically reload the Frame List if the configuration changes.

## [0.1.0] - 2021-03-01

This is a preview release for me to test the concept.

### Added

- Open packet traces in vscode.
- View the details of the most recently selected packet in a panel view.
