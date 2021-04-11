<p align="center">
  <a href="" rel="noopener">
 <img style="margin-bottom: -30px" width=100px height=100px src="assets/icon.png" alt="Project logo"></a>
</p>

<h1 align="center">Crumbs</h3>

<p align="center"> Open Packet Traces in Visual Studio Code.
    <br>
</p>

## Table of Contents

-   [About](#about)
-   [Getting Started](#getting_started)
-   [Usage](#usage)

## About <a name = "about"></a>

This Visual Studio Code extension adds support to open and inspect packet traces directly within the editor.

## Getting Started <a name = "getting_started"></a>

The following topic helps you to get started with Crumbs.
### Prerequisites

In order to work you have to install `sharkd (Wireshark)` on your system.

```
Ubuntu:

sudo apt install wireshark-common

```

After installing `sharkd` you should be good to go. If `sharkd` is installed on a different path or you want to use a specific version you are able set it in the `crumbs.sharkd` setting.

To use this extension on Windows you need to use WSL with VSCode Remote.

## Usage <a name="usage"></a>

Just open any packet trace in Visual Studio Code. Crumbs should be set as default editor for those files. If not run the `View: Reopen Editor With...` command and select `Packet Editor` which is provided by Crumbs.
