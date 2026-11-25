import { navigate } from './router';
import type { RouteDef } from './router';
import { ProjectLibraryPage } from '../features/project-library';
import { WorkspacePage } from '../features/workspace';

/** Central route table. Each feature exports exactly one page from its `index.ts`. */
export const routes: RouteDef[] = [
  {
    path: '/',
    render: () => {
      navigate('/library');
      return null;
    },
  },
  { path: '/library', render: () => <ProjectLibraryPage /> },
  { path: '/stack/:stackId', render: ({ params }) => <WorkspacePage stackId={params['stackId']!} /> },
  {
    path: '/stack/:stackId/card/:cardId',
    render: ({ params }) => <WorkspacePage stackId={params['stackId']!} cardId={params['cardId']!} />,
  },
];
