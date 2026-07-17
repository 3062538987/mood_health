import fs from 'node:fs'
import path from 'node:path'

const routeFile = path.resolve(__dirname, '../../../src/routes/caseRoutes.ts')

const routeSource = () => fs.readFileSync(routeFile, 'utf8')

describe('case routes', () => {
  it('authenticates every case route', () => {
    const source = routeSource()

    expect(source).toContain('authenticate')
    expect(source).toContain("router.get('/', listMyCases)")
    expect(source).toContain("router.post('/', validateCreateCase, validateRequest, createCase)")
    expect(source).toContain(
      "router.post('/auto-create', validateAutoCreateCase, validateRequest, autoCreateCase"
    )
    expect(source).toContain("router.get('/:id', getCaseDetail)")
    expect(source).toContain("router.put('/:id/assign', validateAssignCase, validateRequest, assignCase)")
    expect(source).toContain("router.post('/:id/interventions', validateAddIntervention, validateRequest, addIntervention)")
    expect(source).toContain("router.put('/:id/refer', validateReferCase, validateRequest, referCase)")
    expect(source).toContain("router.put('/:id/close', validateCloseCase, validateRequest, closeCase)")
  })
})
