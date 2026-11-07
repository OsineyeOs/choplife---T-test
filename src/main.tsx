/**
 * Choplife Republic — Pre-React Resilient Bootloader
 * 
 * Architectural Guarantee:
 * 1. ZERO static imports of App, AppContext, or heavy UI components at top level.
 * 2. Instant Pure DOM/Inline-CSS BootScreen ("Choplife Republic - Starting application...").
 * 3. Dynamic import('./App.tsx') and import('./index.css') inside try/catch so any module evaluation failures
 *    or browser execution errors are immediately caught and presented on-screen.
 * 4. PWA Service Worker is completely disabled in development and AI Studio preview,
 *    and never runs on the critical boot path.
 */

// 1. Initial Pure DOM Boot Screen (No React, No Tailwind, No Google Fonts, No Lucide)
function renderInitialBootScreen(container: HTMLElement) {
  container.innerHTML = `
    <div id="choplife-preboot-container" role="status" aria-live="polite" style="min-height: 100vh; display: flex; align-items: center; justify-content: center; background-color: #FAF7F2; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
      <div style="background-color: #ffffff; border: 2px solid #4D080F; border-radius: 24px; padding: 36px 28px; max-width: 440px; width: 100%; text-align: center; box-shadow: 0 12px 32px rgba(77, 8, 15, 0.12);">
        <div style="width: 56px; height: 56px; margin: 0 auto 16px auto; background-color: #4D080F; border-radius: 16px; display: flex; align-items: center; justify-content: center; border: 2px solid #FFC700;">
          <span style="color: #FFC700; font-size: 26px; font-weight: 900; line-height: 1;">C</span>
        </div>
        <h1 style="color: #4D080F; font-size: 22px; font-weight: 900; margin: 0 0 6px 0; letter-spacing: -0.02em; text-transform: uppercase;">
          Choplife Republic
        </h1>
        <p style="color: #E62E00; font-size: 11px; font-weight: 800; margin: 0 0 16px 0; letter-spacing: 0.1em; text-transform: uppercase;">
          100% Maximum Enjoyment • Benin City
        </p>
        <div style="display: flex; align-items: center; justify-content: center; gap: 8px; margin: 20px 0;">
          <div id="choplife-preboot-pulse" style="width: 10px; height: 10px; border-radius: 50%; background-color: #E62E00; animation: choplife-pulse 1.2s infinite ease-in-out;"></div>
          <span style="color: #4D080F; font-size: 13px; font-weight: 600;">Starting application…</span>
        </div>
        <p style="color: #7A6A65; font-size: 11px; margin: 0;">
          Connecting kitchens in Okabere, GRA &amp; Ugbowo
        </p>
      </div>
    </div>
    <style>
      @keyframes choplife-pulse {
        0%, 100% { transform: scale(0.85); opacity: 0.5; }
        50% { transform: scale(1.2); opacity: 1; }
      }
      @media (prefers-reduced-motion: reduce) {
        #choplife-preboot-pulse {
          animation: none !important;
          opacity: 0.8 !important;
        }
      }
    </style>
  `;
}

// 2. Fatal Boot Diagnostic Screen (Pure DOM/Inline-CSS, Zero dependencies)
function renderBootFailure(error: any) {
  console.error('[FATAL BOOT DIAGNOSTIC] Failed to boot Choplife Republic:', error);
  const root = document.getElementById('root') || document.body;
  const errorMsg = String(error?.message || error || 'Unknown bootstrap exception');
  const errorStack = String(error?.stack || '');

  root.innerHTML = `
    <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; background-color: #FAF7F2; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
      <div style="background-color: #ffffff; border: 2px solid #800D15; border-radius: 24px; padding: 32px 24px; max-width: 520px; width: 100%; box-shadow: 0 16px 40px rgba(128, 13, 21, 0.15);">
        <div style="text-align: center; margin-bottom: 20px;">
          <div style="width: 52px; height: 52px; margin: 0 auto 12px auto; background-color: #FFF2F2; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2px solid #800D15;">
            <span style="font-size: 24px;">⚠️</span>
          </div>
          <h1 style="color: #800D15; font-size: 20px; font-weight: 900; margin: 0 0 6px 0; text-transform: uppercase;">
            Choplife Republic could not start.
          </h1>
          <p style="color: #5C4540; font-size: 13px; margin: 0; line-height: 1.4;">
            A pre-React boot exception occurred before the application storefront could initialize.
          </p>
        </div>

        <div style="background-color: #1C1210; border: 1px solid rgba(255, 199, 0, 0.3); border-radius: 12px; padding: 14px; margin-bottom: 20px; text-align: left;">
          <div style="color: #FFC700; font-size: 11px; font-weight: bold; font-family: monospace; text-transform: uppercase; margin-bottom: 6px;">
            Error Diagnostics:
          </div>
          <div style="color: #FFAAA6; font-size: 12px; font-family: monospace; word-break: break-word; line-height: 1.4;">
            ${escapeHtml(errorMsg)}
          </div>
          ${errorStack ? `
            <details style="margin-top: 10px; border-top: 1px solid #332220; padding-top: 8px;">
              <summary style="color: #998885; font-size: 10px; cursor: pointer; font-family: monospace;">Technical Stack Trace</summary>
              <pre style="color: #776664; font-size: 10px; font-family: monospace; overflow-x: auto; max-height: 120px; white-space: pre-wrap; margin-top: 6px;">${escapeHtml(errorStack.slice(0, 1000))}</pre>
            </details>
          ` : ''}
        </div>

        <div style="display: flex; gap: 10px;">
          <button onclick="window.location.reload()" style="flex: 1; padding: 12px; background-color: #E62E00; color: #ffffff; border: none; border-radius: 12px; font-weight: bold; font-size: 12px; cursor: pointer;">
            Retry Boot
          </button>
          <button onclick="if(confirm('Are you sure you want to clear local application state and cached data?')){try{localStorage.clear();sessionStorage.clear();}catch(e){};window.location.reload();}" style="flex: 1; padding: 12px; background-color: #FAF7F2; color: #4D080F; border: 1px solid #D5C8B8; border-radius: 12px; font-weight: bold; font-size: 12px; cursor: pointer;">
            Clear State &amp; Reload
          </button>
        </div>
      </div>
    </div>
  `;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// 3. Main Boot Orchestrator
async function bootChoplifeApp() {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    throw new Error('Container element "#root" was not found in the DOM.');
  }

  // Immediately render pure DOM pre-boot screen
  renderInitialBootScreen(rootElement);

  try {
    // Dynamic imports for React, App, and CSS to ensure no top-level evaluation failures bypass this boundary
    const [reactModule, reactDomModule, appModule] = await Promise.all([
      import('react'),
      import('react-dom/client'),
      import('./App.tsx'),
      import('./index.css'),
    ]);

    const { StrictMode } = reactModule;
    const { createRoot } = reactDomModule;
    const App = appModule.default || appModule.ChoplifeApp;

    if (!App) {
      throw new Error('Default or ChoplifeApp component was not found in ./App.tsx export.');
    }

    const root = createRoot(rootElement);
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    );

    console.log('[CHOPLIFE BOOT] Storefront successfully mounted.');

    // 4. Deferred Post-Boot Service Worker Lifecycle (NEVER on critical boot path)
    // Completely disabled in development, localhost, and Google AI Studio Preview
    setTimeout(async () => {
      try {
        const isPreviewOrDev =
          window.location.hostname.includes('run.app') ||
          window.location.hostname.includes('google.com') ||
          window.location.hostname === 'localhost' ||
          window.location.hostname === '127.0.0.1' ||
          window.location.port === '3000';

        if (isPreviewOrDev) {
          // In AI Studio Preview and dev, ensure no service worker intercepts preview network traffic
          if ('serviceWorker' in navigator) {
            const registrations = await navigator.serviceWorker.getRegistrations();
            for (const reg of registrations) {
              await reg.unregister();
            }
          }
          return;
        }

        // Only register in actual standalone production
        const offlineModule = await import('./utils/offlineManager');
        if (offlineModule.registerChoplifeServiceWorker) {
          offlineModule.registerChoplifeServiceWorker();
        }
      } catch (swErr) {
        console.warn('[PWA] Post-boot service worker initialization skipped:', swErr);
      }
    }, 2000);
  } catch (err: any) {
    renderBootFailure(err);
  }
}

// Execute boot
bootChoplifeApp();
