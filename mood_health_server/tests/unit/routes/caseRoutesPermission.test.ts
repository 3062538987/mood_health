import fs from 'node:fs'
import path from 'node:path'

const routeFile = path.resolve(__dirname, '../../../src/routes/caseRoutes.ts')

const routeSource = () => fs.readFileSync(routeFile, 'utf8')

describe('case routes', () => {
  it('authenticates every case route and enforces permissions', () => {
    const source = routeSource()

    expect(source).toContain('authenticate')
    expect(source).toContain('requirePermission')
    expect(source).toContain("router.get('/', requirePermission('case.read_own'), listMyCases)")
    expect(source).toContain("router.post('/', requirePermission('case.create'), validateCreateCase, validateRequest, createCase)")
    expect(source).toContain(
      "router.post('/auto-create', requirePermission('case.create'), validateAutoCreateCase, validateRequest, autoCreateCase"
    )
    expect(source).toContain("router.get('/:id', requirePermission('case.read_own'), getCaseDetail)")
    expect(source).toContain("router.put('/:id/assign', requirePermission('case.assign'), validateAssignCase, validateRequest, assignCase)")
    expect(source).toContain("router.post('/:id/interventions', requirePermission('case.intervene'), validateAddIntervention, validateRequest, addIntervention)")
    expect(source).toContain("router.put('/:id/refer', requirePermission('case.refer'), validateReferCase, validateRequest, referCase)")
    expect(source).toContain("router.put('/:id/close', requirePermission('case.close'), validateCloseCase, validateRequest, closeCase)")
  })
})
