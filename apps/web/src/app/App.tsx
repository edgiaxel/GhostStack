import { useReducer } from 'react';
import { editorRootAttributes } from './editorRoot';
import { INITIAL_ROUTE, routeReducer } from './route';
import { ProjectLibrary } from '../features/project-library/ProjectLibrary';
import { StackWorkspace } from '../features/workspace/StackWorkspace';
import { useServices } from './services';

export function App() {
  const { preferences } = useServices();
  const [route, dispatch] = useReducer(routeReducer, INITIAL_ROUTE);

  return (
    <div className="gs-editor" {...editorRootAttributes(preferences)}>
      <h1 className="gs-app-title">GhostStack</h1>
      {route.name === 'library' ? (
        <main>
          <ProjectLibrary onOpen={(stackId) => dispatch({ type: 'open', stackId })} />
        </main>
      ) : (
        <StackWorkspace
          key={route.stackId}
          stackId={route.stackId}
          onClose={() => dispatch({ type: 'close' })}
        />
      )}
    </div>
  );
}
