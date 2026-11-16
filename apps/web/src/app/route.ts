export type Route = { name: 'library' } | { name: 'workspace'; stackId: string };

export type AppAction = { type: 'open'; stackId: string } | { type: 'close' };

// Startup always shows the Project Library, even when lastProjectId is set.
export const INITIAL_ROUTE: Route = { name: 'library' };

export function routeReducer(state: Route, action: AppAction): Route {
  switch (action.type) {
    case 'open':
      return { name: 'workspace', stackId: action.stackId };
    case 'close':
      return state.name === 'library' ? state : { name: 'library' };
  }
}
