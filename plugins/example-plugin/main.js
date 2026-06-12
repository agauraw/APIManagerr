/**
 * External Plugin — main.js  (optional)
 *
 * Export a `register` function that receives the Electron main-process context.
 * Use this to add custom IPC handlers for your plugin's backend logic.
 *
 * Context object:
 *   { ipcMain, app, path, fs, dialog }
 */
module.exports = {
  register({ ipcMain }) {
    ipcMain.handle('example-plugin:hello', (_event, name) => {
      return `Hello from the example plugin, ${name || 'world'}!`;
    });

    console.log('[example-plugin] IPC handlers registered');
  },
};
