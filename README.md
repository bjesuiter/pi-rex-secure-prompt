# Pi Rex Secure Prompt

`rex_sudo` lets Pi request approval for one sudo command in Rex. If sudo
requires authentication, a masked desktop dialog collects the password.

## Install

Requires Pi and a Rex app and CLI that support [custom UI prompts](https://www.superlogical.com/rex/docs/customize/custom-ui).

- macOS uses the built-in dialog.
- Linux uses Zenity from `/usr/bin/zenity`. Install it with your distribution’s package manager.

Password entry requires a graphical session on the host running Pi. For Linux,
the Rex terminal must inherit the desktop display environment.

Install the package, then start Pi in a Rex terminal with `rex` on its PATH.

```sh
pi install git:github.com/bjesuiter/pi-rex-secure-prompt
```

## Use

Ask Pi to “Run `/usr/bin/id -u` using `rex_sudo`.” Check the working directory
and exact command in the Pi tool call and Rex prompt. Type `approve` in Rex
only if you want to run that command as root. Enter the password in the masked
desktop dialog if it appears. Successful output should be `0`.

Rex uses `rex.ui.input` for approval because its text field has no documented
masking option and prompts are shown to connected Rex apps. Use that field
only for the word `approve`. The local askpass helper sends the password
directly to sudo through sudo's private pipe. Pi receives command output or a
status. The password stays out of Pi chat, tool arguments, session history,
command-line arguments, environment variables, and files.

The extension invokes `/usr/bin/sudo -k -A --` with the approved arguments
and without a shell. With a command, `-k` tells sudo to ignore any cached
credentials and to avoid refreshing them. Sudo policy still applies.
This tool runs commands without interactive stdin. It does not intercept
Pi's built-in shell tool or enforce a policy on commands run through it.
