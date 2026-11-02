/* VXSK PWA install button */
'use strict';
(() => {
  const button = document.getElementById('vxsk-app-install');
  const status = document.getElementById('vxsk-app-install-status');
  if (!button || !status) return;

  let installPrompt = null;
  const isInstalled = () =>
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;

  const showBrowserHelp = () => {
    const ua = navigator.userAgent || '';
    if (/iphone|ipad|ipod/i.test(ua)) {
      status.textContent = 'On iPhone or iPad: open this page in Safari, tap Share, then choose “Add to Home Screen”.';
    } else {
      status.textContent = 'To install VXSK, open your browser menu and choose “Install app” or “Install VXSK” when that option is available.';
    }
  };

  if (isInstalled()) {
    button.disabled = true;
    button.textContent = 'VXSK ALREADY INSTALLED';
    status.textContent = 'VXSK is already installed on this device.';
  }

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    installPrompt = event;
    button.disabled = false;
    button.textContent = 'INSTALL VXSK APP';
    status.textContent = 'VXSK is ready to install on this device.';
  });

  button.addEventListener('click', async () => {
    if (!installPrompt) {
      showBrowserHelp();
      return;
    }

    button.disabled = true;
    try {
      installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      status.textContent = choice && choice.outcome === 'accepted'
        ? 'Installation accepted. VXSK will appear with your installed apps.'
        : 'Installation was cancelled. You can install VXSK later from your browser menu.';
    } catch (_) {
      showBrowserHelp();
    } finally {
      installPrompt = null;
      button.disabled = false;
    }
  });

  window.addEventListener('appinstalled', () => {
    installPrompt = null;
    button.disabled = true;
    button.textContent = 'VXSK ALREADY INSTALLED';
    status.textContent = 'VXSK has been installed successfully on this device.';
  });
})();
