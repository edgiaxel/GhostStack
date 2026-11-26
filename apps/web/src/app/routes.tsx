import { navigate } from './router';
import type { RouteDef } from './router';
import { Suspense, lazy } from 'react';
import type { ReactNode } from 'react';
import { ProjectLibraryPage } from '../features/project-library';

const PreviewPage = lazy(() => import('../features/preview').then((m) => ({ default: m.PreviewPage })));
const WorkspacePage = lazy(() => import('../features/workspace').then((m) => ({ default: m.WorkspacePage })));
const DesignGallery = lazy(() =>
  import('../components/DesignGallery').then((m) => ({ default: m.DesignGallery })),
);

const loading = (page: ReactNode): ReactNode => (
  <Suspense
    fallback={
      <p className="gs-empty" role="status">
        Loading...
      </p>
    }
  >
    {page}
  </Suspense>
);

/** Central route table. Each feature exports exactly one page from its `index.tsx`. */
export const routes: RouteDef[] = [
  {
    path: '/',
    render: () => {
      navigate('/library');
      return null;
    },
  },
  { path: '/design', render: () => loading(<DesignGallery />) },
  { path: '/library', render: () => <ProjectLibraryPage /> },
  {
    path: '/stack/:stackId',
    render: ({ params }) => loading(<WorkspacePage stackId={params['stackId']!} />),
  },
  {
    path: '/stack/:stackId/preview',
    render: ({ params }) => loading(<PreviewPage stackId={params['stackId']!} />),
  },
  {
    path: '/stack/:stackId/card/:cardId',
    render: ({ params }) =>
      loading(<WorkspacePage stackId={params['stackId']!} cardId={params['cardId']!} />),
  },
];
