import fs from 'node:fs'
import path from 'node:path'

const routeFile = path.resolve(__dirname, '../../../src/routes/caseRoutes.ts')

const routeSource = () => fs.readFileSync(routeFile, 'utf8')

describe('case routes permission guards', () => {
  it('requires explicit case permissions for every case route', () => {
    const source = routeSource()

    expect(source).toContain('requirePermission')
    expect(source).toContain("router.get('/', requirePermission('case.read_own'), listMyCases)")
    expect(source).toContain("router.post('/', requirePermission('case.create'), validateCreateCase")
    expect(source).toContain(
      "router.post('/auto-create', requirePermission('case.create'), validateAutoCreateCase"
    )
    expect(source).toContain("router.get('/:id', requirePermission('case.read_own'), getCaseDetail)")
    expect(source).toContain("router.put('/:id/assign', requirePermission('case.assign')")
    expect(source).toContain("router.post('/:id/interventions', requirePermission('case.intervene')")
    expect(source).toContain("router.put('/:id/refer', requirePermission('case.refer')")
    expect(source).toContain("router.put('/:id/close', requirePermission('case.close')")
  })
})
