// @flow

import { deepDiff, invertObjectToMap } from './objects.js';

describe('deepDiff tests', () => {
  it('should return an empty object if the objects are identical', () => {
    const obj1 = {
      key1: 'value1',
      key2: { foo: 'bar' },
    };
    const obj2 = {
      key1: 'value1',
      key2: { foo: 'bar' },
    };
    const diff = deepDiff(obj1, obj2);
    expect(diff).toEqual({});
  });

  it('should return the differences between two objects', () => {
    const obj1 = {
      key1: 'value1',
      key2: { prop: 'a' },
    };
    const obj2 = {
      key1: 'value2',
      key2: { prop: 'b' },
    };
    const diff = deepDiff(obj1, obj2);
    expect(diff).toEqual({
      key1: 'value1',
      key2: {
        prop: 'a',
      },
    });
  });

  it('should handle objects nested in objects', () => {
    const obj1 = {
      key1: 'value1',
      key2: { prop: 'a', nested: { xyz: 123 } },
    };
    const obj2 = {
      key1: 'value1',
      key2: { prop: 'a', nested: { xyz: 124 } },
    };
    const diff = deepDiff(obj1, obj2);
    expect(diff).toEqual({
      key2: {
        nested: {
          xyz: 123,
        },
      },
    });
  });

  it('should handle nested objects with null and undefined values', () => {
    const obj1 = {
      key1: null,
      key2: { prop: undefined },
    };
    const obj2 = {
      key1: undefined,
      key2: { prop: null },
    };
    const diff = deepDiff(obj1, obj2);
    expect(diff).toEqual({
      key1: null,
      key2: {
        prop: undefined,
      },
    });
  });

  it('should handle objects with different value types', () => {
    const obj1 = {
      key1: 'value1',
      key2: 123,
    };
    const obj2 = {
      key1: 'value1',
      key2: '123',
    };
    const diff = deepDiff(obj1, obj2);
    expect(diff).toEqual({
      key2: 123,
    });
  });

  it('should handle objects with array value types', () => {
    const obj1 = {
      key1: ['value1'],
      key2: ['a', 1],
    };
    const obj2 = {
      key1: ['value1'],
      key2: ['a', 2],
    };
    const diff = deepDiff(obj1, obj2);
    expect(diff).toEqual({
      key2: ['a', 1],
    });
  });
});

// NOTE: `invertObjectToMap` unit tests were generated by GitHub Copilot.
describe('invertObjectToMap', () => {
  it('should invert an object to a map', () => {
    const obj = {
      key1: 'value1',
      key2: 'value2',
    };
    const map = new Map();
    map.set('value1', 'key1');
    map.set('value2', 'key2');
    expect(invertObjectToMap(obj)).toEqual(map);
  });

  it('should invert an object with non-string keys to a map', () => {
    const obj = {
      key1: 1,
      key2: 2,
    };
    const map = new Map();
    map.set(1, 'key1');
    map.set(2, 'key2');
    expect(invertObjectToMap(obj)).toEqual(map);
  });

  it('should invert an object with BigInt values to map with BigInt keys', () => {
    const obj = {
      // $FlowIssue bigint-unsupported
      key1: 1n,
      // $FlowIssue bigint-unsupported
      key2: 2n,
    };
    const map = new Map();
    // $FlowIssue bigint-unsupported
    map.set(1n, 'key1');
    // $FlowIssue bigint-unsupported
    map.set(2n, 'key2');
    expect(invertObjectToMap(obj)).toEqual(map);
  });

  it('should invert an object with null values to map with null keys', () => {
    const obj = {
      key1: null,
      key2: null,
    };
    const map = new Map();
    map.set(null, 'key2');
    expect(() => invertObjectToMap(obj)).toThrowError(
      'invertObjectToMap: obj[key2] is already in invertedMap',
    );
  });
});
