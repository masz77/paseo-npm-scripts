NPM Scripts adds a panel to the Explorer sidebar that lists the scripts in your project's `package.json` files and runs them with one press. It works like the npm scripts view in VS Code, for the workspace you have selected. Needs Paseo 0.13 or later.

The panel scans the selected workspace's folder for every `package.json`, including nested packages in a monorepo such as `apps/backend`. Each package gets its own card with its path and package manager, and the root `package.json` is always the first card, marked Root. Packages without scripts are left out. Press Refresh after you add or change a script.

Run uses the package manager the project declares in the `packageManager` field. Without one, it looks for the nearest lockfile: `pnpm-lock.yaml` for pnpm, `yarn.lock` for Yarn, `bun.lock` or `bun.lockb` for Bun, and npm otherwise. A subpackage looks upward to the workspace root, so a monorepo with one lockfile at the root uses that package manager everywhere.

## Terminals

Scripts run in a workspace terminal named `npm scripts`, or `npm scripts · apps/backend` for a subpackage, opened in that package's folder. Output stays in the terminal, and you stop a script there with Ctrl-C.

Press Run again and the panel reuses one of these terminals when its last script has finished, including one you stopped with Ctrl-C. While a script is still running, for example a dev server, Run opens another terminal. To tell when a script has finished, the panel adds a short `echo` after each command and reads the end of the terminal. It never types into terminals you opened yourself.

## Data and permissions

The plugin reads `package.json` and lockfiles on the computer running the Paseo daemon and sends nothing outside Paseo. It skips `node_modules`, `dist`, `build`, `out`, `coverage` and hidden folders, and looks at most four folders deep. Run types the script command into a terminal that runs as your daemon user.

## Limits

- A worktree shows the scripts in that worktree's folder, not the main checkout.
- Paseo does not tell plugins a script's exit code, so the panel can't show whether a script passed or failed.
- A reused terminal does not move to the front. Open its tab to see the output.
- If you type a command into an `npm scripts` terminal by hand and it prints nothing, the panel can treat that terminal as free.
- Commands use POSIX shell syntax and work in zsh and bash. They don't work in fish.
