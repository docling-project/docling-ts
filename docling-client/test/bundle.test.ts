import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  DoclingArtifactDownloadError,
  documentFromBundle,
  documentFromBundleAsync,
} from '../src';
import { utf8, zip } from './zip-fixture';

// Archives written by real tools (Python zipfile, Info-ZIP `zip -9 -r`) holding
// manual.json (picture -> artifacts/p.png) and the 8-byte PNG signature.
const PYTHON_ZIP =
  'UEsDBBQAAAAIAEZNal3BE3vkjAAAAPMJAAALAAAAbWFudWFsLmpzb27tzE0KwkAMBeCrlKwHC26Err2FiIRpHAPNdJifhZa5e1PxBm6zype8RzYo/kWCj4hCMMF19QvHoKMJxQoOfkEmXHRL7GvLVGC6bcCCQbMNhIXqOx29721MMWh5TgzT5eyg8OfodQct6wkwV36ir2VMp6Pa+11f46zRsmaSgVNpMpjNZrPZbDab/zf0HVBLAwQUAAAACABGTWpdpAkHegoAAAAIAAAADwAAAGFydGlmYWN0cy9wLnBuZ+sM8HPn5ZLiAgBQSwECFAMUAAAACABGTWpdwRN75IwAAADzCQAACwAAAAAAAAAAAAAApIEAAAAAbWFudWFsLmpzb25QSwECFAMUAAAACABGTWpdpAkHegoAAAAIAAAADwAAAAAAAAAAAAAApIG1AAAAYXJ0aWZhY3RzL3AucG5nUEsFBgAAAAACAAIAdgAAAOwAAAAAAA==';
const INFO_ZIP =
  'UEsDBBQAAgAIAEZNal3BE3vkjAAAAPMJAAALABwAbWFudWFsLmpzb25VVAkAA+TY8mrk2PJqdXgLAAEE9QEAAAQAAAAA7cxNCsJADAXgq5SsBwtuhK69hYiEaRwDzXSYn4WWuXtT8QZus8qXvEc2KP5Fgo+IQjDBdfULx6CjCcUKDn5BJlx0S+xry1Rgum3AgkGzDYSF6jsdve9tTDFoeU4M0+XsoPDn6HUHLesJMFd+oq9lTKej2vtdX+Os0bJmkoFTaTKYzWaz2Ww2m/839B1QSwMECgAAAAAARk1qXQAAAAAAAAAAAAAAAAoAHABhcnRpZmFjdHMvVVQJAAPk2PJq5NjyanV4CwABBPUBAAAEAAAAAFBLAwQKAAIAAABGTWpdpAkHeggAAAAIAAAADwAcAGFydGlmYWN0cy9wLnBuZ1VUCQAD5NjyauTY8mp1eAsAAQT1AQAABAAAAACJUE5HDQoaClBLAQIeAxQAAgAIAEZNal3BE3vkjAAAAPMJAAALABgAAAAAAAEAAACkgQAAAABtYW51YWwuanNvblVUBQAD5NjyanV4CwABBPUBAAAEAAAAAFBLAQIeAwoAAAAAAEZNal0AAAAAAAAAAAAAAAAKABgAAAAAAAAAEADtQdEAAABhcnRpZmFjdHMvVVQFAAPk2PJqdXgLAAEE9QEAAAQAAAAAUEsBAh4DCgACAAAARk1qXaQJB3oIAAAACAAAAA8AGAAAAAAAAQAAAKSBFQEAAGFydGlmYWN0cy9wLnBuZ1VUBQAD5NjyanV4CwABBPUBAAAEAAAAAFBLBQYAAAAAAwADAPYAAABmAQAAAAA=';

const PNG_DATA_URI = 'data:image/png;base64,iVBORw0KGgo=';

interface Bundle {
  name: string;
  pictures: Array<{ image: { uri: string } }>;
  pad: string;
}

type Reader = (bytes: Uint8Array) => Promise<Bundle>;

const syncReader: Reader = async bytes => documentFromBundle<Bundle>(bytes);
const asyncReader: Reader = bytes => documentFromBundleAsync<Bundle>(bytes);

// Node 18 (and other runtimes without "deflate-raw") must fall back cleanly.
const withoutDecompressionStream: Reader = bytes => {
  vi.stubGlobal(
    'DecompressionStream',
    class {
      constructor() {
        throw new TypeError('unsupported format');
      }
    }
  );
  return documentFromBundleAsync<Bundle>(bytes);
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe.each([
  ['documentFromBundle (deprecated sync)', syncReader],
  ['documentFromBundleAsync (DecompressionStream)', asyncReader],
  ['documentFromBundleAsync (fallback inflater)', withoutDecompressionStream],
])('%s', (_name, read) => {
  it.each([
    ['Python zipfile', PYTHON_ZIP],
    ['Info-ZIP', INFO_ZIP],
  ])('reads a bundle written by %s', async (_label, encoded) => {
    const document = await read(new Uint8Array(Buffer.from(encoded, 'base64')));
    expect(document.name).toBe('real');
    expect(document.pad.length).toBe(2400);
    expect(document.pictures[0]?.image.uri).toBe(PNG_DATA_URI);
  });

  it('rejects input that is not a ZIP', async () => {
    await expect(read(utf8('this is not a zip archive'))).rejects.toBeInstanceOf(
      DoclingArtifactDownloadError
    );
    await expect(read(new Uint8Array(0))).rejects.toBeInstanceOf(
      DoclingArtifactDownloadError
    );
  });

  it('rejects an entry that inflates beyond its declared size (zip bomb)', async () => {
    const archive = zip({ 'manual.json': new Uint8Array(1_000_000) });
    const view = new DataView(archive.buffer);
    for (let offset = 0; offset + 4 < archive.length; offset += 1) {
      const signature = view.getUint32(offset, true);
      if (signature === 0x02014b50) view.setUint32(offset + 24, 100, true);
      if (signature === 0x04034b50) view.setUint32(offset + 22, 100, true);
    }
    await expect(read(archive)).rejects.toBeInstanceOf(DoclingArtifactDownloadError);
  });
});
