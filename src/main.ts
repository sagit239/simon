import '@fontsource/heebo/hebrew-400.css';
import '@fontsource/heebo/hebrew-700.css';
import '@fontsource/heebo/latin-400.css';
import '@fontsource/heebo/latin-700.css';
import './styles/tokens.css';
import './styles/app.css';
import { createAudio } from './app/audio';
import { createController, type Controller, type View } from './app/controller';
import { createNavigation } from './app/navigation';
import { renderAbout } from './views/about';
import { renderHome } from './views/home';

const root = document.querySelector<HTMLElement>('#app');
if (root) {
  // Navigation resets the URL to home before anything renders.
  const navigation = createNavigation((screen) => controller.showScreen(screen));
  const home = renderHome(root, {
    onStart: () => void controller.start(),
    onResume: () => void controller.resume(),
    onPress: (color) => controller.press(color),
    onAbout: navigation.goAbout,
  });
  const about = renderAbout(root, { onBack: navigation.goHome });
  const view: View = {
    update: (model) => {
      home.update(model);
      about.update(model);
    },
  };
  const controller: Controller = createController({ view, audio: createAudio() });

  // Locking the device or switching apps pauses an active game.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) controller.pageHidden();
  });
}
