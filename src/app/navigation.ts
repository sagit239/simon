import type { Screen } from './controller';

const HOME_HASH = '#/';
const ABOUT_HASH = '#/about';

export interface Navigation {
  goAbout(): void;
  goHome(): void;
}

function screenOf(url: string): Screen {
  return new URL(url).hash === ABOUT_HASH ? 'about' : 'home';
}

// Hash routing between the two screens. Every screen change, from in-app
// buttons or browser back/forward, arrives through the single hashchange
// listener. A fresh load always starts on home, even at the about URL.
export function createNavigation(onScreen: (screen: Screen) => void): Navigation {
  if (location.hash !== HOME_HASH) {
    history.replaceState(history.state, '', HOME_HASH);
  }

  // newURL (not location.hash) keeps very fast back-to-back changes in order.
  window.addEventListener('hashchange', (event) => {
    onScreen(screenOf(event.newURL));
    window.scrollTo(0, 0);
  });

  return {
    goAbout: () => {
      location.hash = ABOUT_HASH;
    },
    goHome: () => {
      location.hash = HOME_HASH;
    },
  };
}
