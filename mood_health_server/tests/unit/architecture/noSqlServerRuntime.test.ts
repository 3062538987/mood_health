import fs from 'node:fs'
import path from 'node:path'

const backendRoot = path.resolve(__dirname, '../../..')

const readTypeScriptFiles = (directory: string): string[] =>
  fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name)

    if (entry.isDirectory()) {
      return readTypeScriptFiles(entryPath)
    }

    return entry.isFile() && entry.name.endsWith('.ts') ? [entryPath] : []
  })

describe('SQL Server retirement', () => {
  it('keeps SQL Server packages out of backend dependencies', () => {
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(backendRoot, 'package.json'), 'utf8')
    )
    const dependencies = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    }

    expect(dependencies).not.toHaveProperty('mssql')
    expect(dependencies).not.toHaveProperty('@types/mssql')
  })

  it('keeps SQL Server imports and the retired database adapter out of source', () => {
    const sourceFiles = readTypeScriptFiles(path.join(backendRoot, 'src'))
    const violations = sourceFiles.filter((file) => {
      const source = fs.readFileSync(file, 'utf8')
      return (
        source.includes("from 'mssql'") ||
        source.includes('from "mssql"') ||
        source.includes("config/database'") ||
        source.includes('config/database"')
      )
    })

    expect(violations.map((file) => path.relative(backendRoot, file))).toEqual([])
  })
})
