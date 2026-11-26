/* global jest */
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// In-memory stand-in for expo-file-system's File/Directory API (avatars).
jest.mock('expo-file-system', () => {
  const files = new Set();
  const join = (...parts) => parts.map((p) => (typeof p === 'string' ? p : p.uri)).join('/');
  class Directory {
    constructor(...parts) { this.uri = join(...parts); }
    get exists() { return true; }
    create() {}
  }
  class File {
    constructor(...parts) { this.uri = join(...parts); }
    get exists() { return files.has(this.uri); }
    copy(dest) { files.add(dest.uri); }
    delete() { files.delete(this.uri); }
  }
  return { Directory, File, Paths: { document: 'file:///doc' }, __files: files };
});
