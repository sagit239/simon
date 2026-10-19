import '@fontsource/heebo/hebrew-400.css';
import '@fontsource/heebo/hebrew-700.css';
import '@fontsource/heebo/latin-400.css';
import '@fontsource/heebo/latin-700.css';
import './styles/tokens.css';
import './styles/app.css';
import { createAudio } from './app/audio';
import { createController } from './app/controller';
import { renderHome } from './views/home';

const root = document.querySelector<HTMLElement>('#app');
if (root) {
  const view = renderHome(root, {
    onStart: () => void controller.start(),
    onPress: (color) => controller.press(color),
  });
  const controller = createController({ view, audio: createAudio() });
}
