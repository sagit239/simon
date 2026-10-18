import '@fontsource/heebo/hebrew-400.css';
import '@fontsource/heebo/hebrew-700.css';
import '@fontsource/heebo/latin-400.css';
import '@fontsource/heebo/latin-700.css';
import './styles/tokens.css';
import './styles/app.css';
import { renderHome } from './views/home';

const root = document.querySelector<HTMLElement>('#app');
if (root) renderHome(root);
