import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildCycloneDx,
  buildLicenseReport,
  createPublishedManifest,
  validateArchiveInventory,
  validateReleasePlan,
} from '../scripts/build-release-candidate.mjs';

const sourcePackage = {
  name: '@ryjen/career-ops',
  version: '0.0.0-development',
  private: true,
  description: 'Synthetic test package',
  license: 'MPL-2.0',
  type: 'module',
  engines: { node: '>=20' },
  exports: { '.': './src/index.js' },
  bin: { 'career-ops': './src/cli.js' },
  files: ['src/', 'schemas/', 'README.md', 'LICENSE', 'SECURITY.md', 'SUPPORT.md'],
  scripts: { test: 'node --test' },
};

const plan = {
  schema_version: 1,
  package_name: '@ryjen/career-ops',
  release_version: '0.1.0',
  supported_domains: ['career-ops.opportunity-normalization@1'],
  diagnostic_contracts: ['career-ops.smoke@1'],
  distribution_state: 'candidate-only',
  publication_issue: 18,
};

test('validates the bounded v0.1 release plan', () => {
  assert.deepEqual(validateReleasePlan(plan, sourcePackage), []);
  assert.match(validateReleasePlan({ ...plan, supported_domains: ['unexpected'] }, sourcePackage).join('\n'), /only opportunity normalization/);
});

test('creates a publishable staging manifest while source stays private', () => {
  const manifest = createPublishedManifest(sourcePackage, '0.1.0');
  assert.equal(manifest.name, '@ryjen/career-ops');
  assert.equal(manifest.version, '0.1.0');
  assert.equal(manifest.private, undefined);
  assert.equal(manifest.publishConfig.access, 'public');
  assert.equal(sourcePackage.private, true);
});

test('rejects lifecycle scripts from candidate source', () => {
  assert.throws(() => createPublishedManifest({ ...sourcePackage, scripts: { postinstall: 'echo unsafe' } }, '0.1.0'), /lifecycle scripts/);
});

test('archive inventory permits only the public package surface', () => {
  const valid = [
    { path: 'LICENSE' },
    { path: 'README.md' },
    { path: 'SECURITY.md' },
    { path: 'SUPPORT.md' },
    { path: 'package.json' },
    { path: 'src/index.js' },
    { path: 'src/cli.js' },
    { path: 'schemas/example.schema.json' },
  ];
  assert.deepEqual(validateArchiveInventory(valid), []);
  assert.match(validateArchiveInventory([...valid, { path: 'test/private.test.js' }]).join('\n'), /unexpected archive path/);
  assert.match(validateArchiveInventory([...valid, { path: 'src/index.js.map' }]).join('\n'), /source maps are prohibited/);
});

test('builds deterministic lockfile-derived SBOM and license report', () => {
  const lockfile = {
    packages: {
      '': { name: '@ryjen/career-ops', version: '0.0.0-development', dependencies: { example: '^1.0.0' } },
      'node_modules/example': { name: 'example', version: '1.2.3', license: 'MIT' },
    },
  };
  const sbom = buildCycloneDx(sourcePackage, '0.1.0', lockfile);
  assert.equal(sbom.bomFormat, 'CycloneDX');
  assert.equal(sbom.metadata.component.version, '0.1.0');
  assert.equal(sbom.components[0].name, 'example');
  assert.deepEqual(sbom.dependencies[0].dependsOn, [sbom.components[0].purl]);

  const licenses = buildLicenseReport(sourcePackage, '0.1.0', lockfile);
  assert.deepEqual(licenses.dependencies, [{ name: 'example', version: '1.2.3', license: 'MIT', direct: true }]);
});

test('fails closed when dependency license metadata is missing', () => {
  const lockfile = {
    packages: {
      '': { dependencies: { example: '^1.0.0' } },
      'node_modules/example': { name: 'example', version: '1.2.3' },
    },
  };
  assert.throws(() => buildLicenseReport(sourcePackage, '0.1.0', lockfile), /license metadata missing/);
});
