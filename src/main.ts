import '@fontsource/special-elite/400.css';
import '@fontsource/courier-prime/400.css';
import '@fontsource/ibm-plex-mono/400.css';
import './styles/main.css';
import { App } from './app/App';
import { logger } from './utils/logger';

async function bootstrap(): Promise<void> {
  const root = document.getElementById('app');
  if (!root) {
    logger.error('Корневой элемент #app не найден');
    return;
  }

  const app = new App(root);
  try {
    await app.start();
  } catch (err) {
    logger.error('Критическая ошибка запуска', err);
    root.innerHTML = `
      <main style="padding:2rem;font-family:system-ui;color:#f3ead7;background:#1a1612;min-height:100vh">
        <h1>Не удалось запустить редактор</h1>
        <p>Обновите страницу или откройте приложение в современном браузере.</p>
      </main>
    `;
  }
}

void bootstrap();
