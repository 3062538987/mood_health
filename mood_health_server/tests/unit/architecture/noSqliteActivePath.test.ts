import fs from 'node:fs'
import path from 'node:path'

const sourceRoot = path.resolve(__dirname, '../../../src')
const appEntry = path.join(sourceRoot, 'app.ts')
const sqliteConfig = path.join(sourceRoot, 'config/sqlite.ts')

const resolveSourceImport = (fromFile: string, specifier: string): string | null => {
  if (!specifier.startsWith('.')) return null

  const resolved = path.resolve(path.dirname(fromFile), specifier.replace(/\.js$/, ''))
  for (const candidate of [`${resolved}.ts`, path.join(resolved, 'index.ts')]) {
    if (fs.existsSync(candidate)) return candidate
  }
  return null
}

const readStaticImports = (file: string): string[] => {
  const source = fs.readFileSync(file, 'utf8')
  const specifiers = new Set<string>()
  const patterns = [
    /(?:import|export)\s+(?:[^'";]+?\s+from\s+)?['"]([^'"]+)['"]/g,
    /require\(\s*['"]([^'"]+)['"]\s*\)/g,
  ]

  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) specifiers.add(match[1])
  }

  return [...specifiers]
    .map((specifier) => resolveSourceImport(file, specifier))
    .filter((resolved): resolved is string => resolved !== null)
}

const findImportPath = (
  current: string,
  target: string,
  visited = new Set<string>()
): string[] | null => {
  if (current === target) return [current]
  if (visited.has(current)) return null
  visited.add(current)

  for (const dependency of readStaticImports(current)) {
    const dependencyPath = findImportPath(dependency, target, visited)
    if (dependencyPath) return [current, ...dependencyPath]
  }
  return null
}

describe('SQLite runtime retirement', () => {
  it('keeps the application entry import graph away from SQLite', () => {
    const importPath = findImportPath(appEntry, sqliteConfig)
    const relativePath = importPath?.map((file) => path.relative(sourceRoot, file)) ?? null

    expect(relativePath).toBeNull()
  })
})
