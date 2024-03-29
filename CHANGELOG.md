# Change Log

All notable changes to Crumbs will be documented here.
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