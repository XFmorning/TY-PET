const { Tray, Menu, nativeImage, app } = require('electron');
const path = require('path');

function createTray(mainWindow, getSettingsWindow) {
  const iconPath = path.join(__dirname, '..', 'assets', 'icon.png');
  const icon = nativeImage.createFromPath(iconPath).resize({ width: 32, height: 32 });

  const tray = new Tray(icon);
  tray.setToolTip('TY AI');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示/隐藏宠物',
      click: () => {
        mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
      }
    },
    {
      label: '打开管理',
      click: () => {
        const win = getSettingsWindow ? getSettingsWindow() : null;
        if (win) {
          win.show();
          win.focus();
        }
      }
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);
  return tray;
}

module.exports = { createTray };
