import fs from 'fs';
import path from 'path';

import { parseBinaryAndroidManifestVersions } from '../androidManifest';

// Compiled with aapt2 from a manifest declaring versionCode="42" and versionName="1.2.3".
const manifestPath = path.join(__dirname, 'fixtures', 'AndroidManifest.bin.xml');

it('reads versions from a binary AndroidManifest.xml', () => {
  expect(parseBinaryAndroidManifestVersions(fs.readFileSync(manifestPath))).toEqual({
    versionCode: '42',
    versionName: '1.2.3',
  });
});

it('throws on non-binary manifests', () => {
  expect(() => parseBinaryAndroidManifestVersions(Buffer.from('<manifest />'))).toThrow();
});
