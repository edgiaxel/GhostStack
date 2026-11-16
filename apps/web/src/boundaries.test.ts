import { describe, expect, it } from 'vitest';
import libraryCss from './library/projectLibrary.css?raw';
import workspaceCss from './workspace/stackWorkspace.css?raw';

const rawSources = (modules: Record<string, string>) =>
  Object.entries(modules).filter(([path]) => !/\.test\.tsx?$/.test(path));

const webSources = rawSources(
  import.meta.glob('./**/*.{ts,tsx}', { eager: true, query: '?raw', import: 'default' }),
);
const domainSources = rawSources(
  import.meta.glob('../../../packages/domain/src/**/*.ts', {
    eager: true,
    query: '?raw',
    import: 'default',
  }),
);
const projectFormatSources = rawSources(
  import.meta.glob('../../../packages/project-format/src/**/*.ts', {
    eager: true,
    query: '?raw',
    import: 'default',
  }),
);
const storageCoreSources = rawSources(
  import.meta.glob(
    ['../../../packages/storage/src/port/**/*.ts', '../../../packages/storage/src/memory/**/*.ts'],
    { eager: true, query: '?raw', import: 'default' },
  ),
);
const manifests = import.meta.glob<string>('../../../packages/*/package.json', {
  eager: true,
  query: '?raw',
  import: 'default',
});
const webManifest = import.meta.glob<string>('../package.json', {
  eager: true,
  query: '?raw',
  import: 'default',
});

function manifestOf(packageName: string): Record<string, Record<string, string> | undefined> {
  const entry = Object.entries(manifests).find(([path]) => path.includes(`/${packageName}/`));
  if (entry === undefined) throw new Error(`No package.json found for ${packageName}`);
  return JSON.parse(entry[1]) as Record<string, Record<string, string> | undefined>;
}

function dependencyNames(manifest: Record<string, Record<string, string> | undefined>): string[] {
  return ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'].flatMap(
    (key) => Object.keys(manifest[key] ?? {}),
  );
}

// Strips comments so prose that mentions a banned name does not trip the scan.
function code(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

function offenders(sources: [string, string][], pattern: RegExp): string[] {
  return sources.filter(([, text]) => pattern.test(code(text))).map(([path]) => path);
}

const REACT_OR_DOM_PACKAGE =
  /^(react|react-dom|react-dom\/.*|@types\/react(-dom)?|jsdom|happy-dom)$/;
const REACT_IMPORT = /(from\s+|import\s*\(\s*|require\(\s*)['"](react|react-dom)(\/[^'"]*)?['"]/;
const BROWSER_GLOBAL = /\b(window|document|localStorage|sessionStorage|navigator)\b\s*[.[]/;

describe('scan inputs', () => {
  it('find source files in every scanned area', () => {
    expect(webSources.length).toBeGreaterThan(10);
    expect(domainSources.length).toBeGreaterThan(5);
    expect(projectFormatSources.length).toBeGreaterThan(5);
    expect(storageCoreSources.length).toBeGreaterThan(3);
    expect(Object.keys(manifests).length).toBeGreaterThanOrEqual(3);
  });
});

describe('package boundaries', () => {
  it.each(['domain', 'project-format', 'storage'])(
    '%s lists no React or DOM library in package.json',
    (name) => {
      const banned = dependencyNames(manifestOf(name)).filter((dep) =>
        REACT_OR_DOM_PACKAGE.test(dep),
      );
      expect(banned).toEqual([]);
    },
  );

  it.each([
    ['domain', domainSources],
    ['project-format', projectFormatSources],
    ['storage port and memory', storageCoreSources],
  ] as const)('%s source imports no React and uses no browser global', (_name, sources) => {
    expect(offenders([...sources], REACT_IMPORT)).toEqual([]);
    expect(offenders([...sources], BROWSER_GLOBAL)).toEqual([]);
  });

  it('apps/web does not depend on or import project-format (T-023)', () => {
    const manifest = JSON.parse(Object.values(webManifest)[0] ?? '{}') as Record<
      string,
      Record<string, string> | undefined
    >;
    expect(dependencyNames(manifest)).not.toContain('@ghoststack/project-format');
    expect(offenders(webSources, /['"]@ghoststack\/project-format(\/[^'"]*)?['"]/)).toEqual([]);
  });
});

describe('apps/web security boundaries', () => {
  it('has no eval, new Function or injected HTML', () => {
    expect(offenders(webSources, /\beval\s*\(/)).toEqual([]);
    expect(offenders(webSources, /\bnew\s+Function\b/)).toEqual([]);
    expect(offenders(webSources, /\.innerHTML\b|\.outerHTML\b|insertAdjacentHTML/)).toEqual([]);
    expect(offenders(webSources, /dangerouslySetInnerHTML/)).toEqual([]);
  });

  it('issues no fetch or XMLHttpRequest', () => {
    expect(offenders(webSources, /\bfetch\s*\(/)).toEqual([]);
    expect(offenders(webSources, /\bXMLHttpRequest\b/)).toEqual([]);
  });

  it('the scanner flags a violation', () => {
    const sample: [string, string][] = [['x.ts', 'const f = new Function("return 1"); eval("1");']];
    expect(offenders(sample, /\bnew\s+Function\b/)).toEqual(['x.ts']);
    expect(offenders(sample, /\beval\s*\(/)).toEqual(['x.ts']);
    expect(offenders([['y.ts', '// eval( is banned']], /\beval\s*\(/)).toEqual([]);
  });
});

describe('layout resilience CSS', () => {
  it('sets min-width: 0 on workspace grid children', () => {
    expect(workspaceCss).toMatch(/\.gs-workspace\s*>\s*\*\s*\{[^}]*min-width:\s*0\s*;/);
  });

  it('sets overflow-wrap: anywhere on the workspace title', () => {
    expect(workspaceCss).toMatch(/\.gs-ws-title\s*\{[^}]*overflow-wrap:\s*anywhere\s*;/);
  });

  it('lets the library grid shrink and wraps long row titles', () => {
    expect(libraryCss).toMatch(/\.gs-lib-body\s*\{[^}]*minmax\(0,\s*1fr\)/);
    expect(libraryCss).toMatch(/\.gs-lib-row-title\s*\{[^}]*overflow-wrap:\s*anywhere\s*;/);
  });
});
