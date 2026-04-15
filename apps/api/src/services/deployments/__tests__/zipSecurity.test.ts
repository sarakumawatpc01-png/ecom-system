import test from 'node:test';
import assert from 'node:assert/strict';
import { validateZipEntries } from '../zipSecurity';

test('zip validator blocks zip-slip path traversal', () => {
  assert.throws(() =>
    validateZipEntries([
      {
        filename: '../etc/passwd',
        file_size: 10,
        compress_size: 10,
        is_dir: false,
        is_symlink: false,
        is_device: false
      }
    ])
  );
});

test('zip validator blocks symlink entry', () => {
  assert.throws(() =>
    validateZipEntries([
      {
        filename: 'link',
        file_size: 0,
        compress_size: 0,
        is_dir: false,
        is_symlink: true,
        is_device: false
      }
    ])
  );
});

