import { Home } from './pages/Home';
import { Setup } from './pages/Setup';
import { Documentation } from './pages/Documentation';
import { Playground } from './pages/Playground';
import { useCurrentPage } from './router';

export default function App() {
  const page = useCurrentPage();

  switch (page) {
    case 'Setup':
      return <Setup />;
    case 'Documentation':
      return <Documentation />;
    case 'Playground':
      return <Playground />;
    default:
      return <Home />;
  }
}
