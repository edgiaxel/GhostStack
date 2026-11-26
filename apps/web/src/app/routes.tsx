import { navigate } from './router';
import type { RouteDef } from './router';
import { ProjectLibraryPage } from '../features/project-library';
import { PreviewPage } from '../features/preview';
import { WorkspacePage } from '../features/workspace';
import { DesignGallery } from '../components/DesignGallery';

/** Central route table. Each feature exports exactly one page from its `index.tsx`. */
export const routes: RouteDef[] = [
  {
    path: '/',
    render: () => {
      navigate('/library');
      return null;
    },
  },
  { path: '/design', render: () => <DesignGallery /> },
  { path: '/library', render: () => <ProjectLibraryPage /> },
  { path: '/stack/:stackId', render: ({ params }) => <WorkspacePage stackId={params['stackId']!} /> },
  { path: '/stack/:stackId/preview', render: ({ params }) => <PreviewPage stackId={params['stackId']!} /> },
  {
    path: '/stack/:stackId/card/:cardId',
    render: ({ params }) => <WorkspacePage stackId={params['stackId']!} cardId={params['cardId']!} />,
  },
];
