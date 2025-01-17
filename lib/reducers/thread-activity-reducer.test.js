// @flow

import { reduceThreadActivity } from './thread-activity-reducer.js';
import { updateThreadLastNavigatedActionType } from '../types/thread-activity-types.js';

// NOTE: These unit tests were generated by GitHub Copilot.

describe('reduceThreadActivity', () => {
  test('updates the lastNavigatedTo time for a thread', () => {
    const initialState = {
      thread1: {
        lastNavigatedTo: 1639522314170,
        lastPruned: 1639522314170,
      },
      thread2: {
        lastNavigatedTo: 1639522314170,
        lastPruned: 1639522314170,
      },
    };
    const action = {
      type: updateThreadLastNavigatedActionType,
      payload: {
        threadID: 'thread1',
        time: 1639522317443,
      },
    };
    const expectedState = {
      thread1: {
        lastNavigatedTo: 1639522317443,
        lastPruned: 1639522314170,
      },
      thread2: {
        lastNavigatedTo: 1639522314170,
        lastPruned: 1639522314170,
      },
    };
    const result = reduceThreadActivity(initialState, action);
    expect(result).toEqual(expectedState);
  });

  test('returns the initial state if the action type is not recognized', () => {
    const initialState = {
      thread1: {
        lastNavigatedTo: 1639522314170,
        lastPruned: 1639522314170,
      },
      thread2: {
        lastNavigatedTo: 1639522314170,
        lastPruned: 1639522314170,
      },
    };
    const action = {
      type: 'UPDATE_REPORTS_ENABLED',
      payload: {},
    };
    const expectedState = {
      thread1: {
        lastNavigatedTo: 1639522314170,
        lastPruned: 1639522314170,
      },
      thread2: {
        lastNavigatedTo: 1639522314170,
        lastPruned: 1639522314170,
      },
    };
    const result = reduceThreadActivity(initialState, action);
    expect(result).toEqual(expectedState);
  });
});
