/* global jest */

// Pin "now" to the fixture anchor (src/mocks/fixtures.ts FIXTURE_ANCHOR) so
// the suite does not depend on the wall clock: on the evening of a seeded
// plan's date it would otherwise turn past and the tests would fail. Time
// still moves forward from the pinned instant, so timeouts behave normally.
{
  const RealDate = Date;
  const shift = new RealDate('2026-11-25T12:00:00').getTime() - RealDate.now();
  class PinnedDate extends RealDate {
    constructor(...args) {
      if (args.length === 0) super(RealDate.now() + shift);
      else super(...args);
    }
    static now() {
      return RealDate.now() + shift;
    }
  }
  global.Date = PinnedDate;
}
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

// ---- Native modules the journey tests (src/journeys) render through.
require('react-native-gesture-handler/jestSetup');
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
jest.mock('react-native-maps', () => {
  const React = require('react');
  const { View } = require('react-native');
  const Stub = (props) => React.createElement(View, props, props.children);
  return { __esModule: true, default: Stub, Marker: Stub, Polyline: Stub };
});
jest.mock('@react-native-community/datetimepicker', () => {
  const React = require('react');
  const { View } = require('react-native');
  return { __esModule: true, default: (props) => React.createElement(View, { testID: 'datetimepicker', ...props }) };
});
jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(async () => ({ granted: false })),
  launchImageLibraryAsync: jest.fn(async () => ({ canceled: true, assets: [] })),
}));
jest.mock('expo-calendar', () => ({ createEventInCalendarAsync: jest.fn(async () => ({ action: 'canceled', id: null })) }));
jest.mock('expo-splash-screen', () => ({ preventAutoHideAsync: jest.fn(async () => {}), hideAsync: jest.fn(async () => {}), setOptions: jest.fn() }));
