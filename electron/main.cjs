// Electron wrapper: packages Daily Digest as a real macOS .app / .dmg.
// The Node server runs inside the app, so there is nothing to start by hand.

const { app, BrowserWindow, shell, Menu } = require('electron');
const path = require('node:path');

const PORT = process.env.PORT || 4173;
process.env.PORT = PORT;
process.env.DIGEST_DATA_DIR = path.join(app.getPath('userData'), 'digests');

let win;

function createWindow() {
  win = new BrowserWindow({
    width: 1180,
    height: 860,
    minWidth: 380,
    minHeight: 520,
    title: 'Daily Digest',
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#faf8f5',
    trafficLightPosition: { x: 16, y: 18 },
    webPreferences: { contextIsolation: true, nodeIntegration: false }
  });

  win.loadURL(`http://localhost:${PORT}`);

  // Article links open in the user's real browser, not inside the app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(`http://localhost:${PORT}`)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });
}

app.whenReady().then(async () => {
  // Boot the bundled server before opening the window.
  await import(`file://${path.join(__dirname, '..', 'server', 'index.js').replace(/\/g, '/')}`);
  // Give the listener a moment to bind.
  await new Promise((r) => setTimeout(r, 400));

  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      { role: 'appMenu' },
      { role: 'editMenu' },
      {
        label: 'View',
        submenu: [
          { label: 'Refresh Digest', accelerator: 'CmdOrCtrl+R', click: () => win?.reload() },
          { type: 'separator' },
          { role: 'resetZoom' },
          { role: 'zoomIn' },
          { role: 'zoomOut' },
          { type: 'separator' },
          { role: 'togglefullscreen' }
        ]
      },
      { role: 'windowMenu' }
    ])
  );

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
