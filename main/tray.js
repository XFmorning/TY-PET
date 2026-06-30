const { Tray, Menu, nativeImage, app } = require('electron');

function createTray(mainWindow, settingsWindow) {
  const iconSize = 32;
  const canvas = Buffer.alloc(iconSize * iconSize * 4);
  for (let i = 0; i < iconSize * iconSize; i++) {
    const offset = i * 4;
    const x = i % iconSize;
    const y = Math.floor(i / iconSize);
    const cx = iconSize / 2, cy = iconSize / 2;
    const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
    const isCenter = dist < 8;
    const isPad1 = Math.sqrt((x - cx + 8) ** 2 + (y - cy + 8) ** 2) < 5;
    const isPad2 = Math.sqrt((x - cx - 8) ** 2 + (y - cy + 8) ** 2) < 5;
    const isPad3 = Math.sqrt((x - cx + 6) ** 2 + (y - cy - 7) ** 2) < 4;
    const isPad4 = Math.sqrt((x - cx - 6) ** 2 + (y - cy - 7) ** 2) < 4;
    if (isCenter || isPad1 || isPad2 || isPad3 || isPad4) {
      canvas[offset] = 0x66;
      canvas[offset + 1] = 0x99;
      canvas[offset + 2] = 0xFF;
      canvas[offset + 3] = 0xFF;
    }
  }
  const icon = nativeImage.createFromBuffer(canvas, { width: iconSize, height: iconSize });

  const tray = new Tray(icon);
  tray.setToolTip('桌面宠物');

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
        if (settingsWindow) {
          settingsWindow.show();
          settingsWindow.focus();
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
