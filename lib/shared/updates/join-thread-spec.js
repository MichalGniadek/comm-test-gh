// @flow

import invariant from 'invariant';
import _isEqual from 'lodash/fp/isEqual.js';

import type { UpdateInfoFromRawInfoParams, UpdateSpec } from './update-spec.js';
import type { RawEntryInfo } from '../../types/entry-types.js';
import type {
  RawMessageInfo,
  MessageTruncationStatuses,
} from '../../types/message-types.js';
import type { RawThreadInfos } from '../../types/thread-types.js';
import { updateTypes } from '../../types/update-types-enum.js';
import type {
  ThreadJoinUpdateInfo,
  ThreadJoinRawUpdateInfo,
  ThreadJoinUpdateData,
} from '../../types/update-types.js';
import { combineTruncationStatuses } from '../message-utils.js';
import { threadInFilterList } from '../thread-utils.js';

export const joinThreadSpec: UpdateSpec<
  ThreadJoinUpdateInfo,
  ThreadJoinRawUpdateInfo,
  ThreadJoinUpdateData,
> = Object.freeze({
  generateOpsForThreadUpdates(
    storeThreadInfos: RawThreadInfos,
    update: ThreadJoinUpdateInfo,
  ) {
    if (_isEqual(storeThreadInfos[update.threadInfo.id])(update.threadInfo)) {
      return null;
    }
    return [
      {
        type: 'replace',
        payload: {
          id: update.threadInfo.id,
          threadInfo: update.threadInfo,
        },
      },
    ];
  },
  mergeEntryInfos(
    entryIDs: Set<string>,
    mergedEntryInfos: Array<RawEntryInfo>,
    update: ThreadJoinUpdateInfo,
  ) {
    for (const entryInfo of update.rawEntryInfos) {
      const entryID = entryInfo.id;
      if (!entryID || entryIDs.has(entryID)) {
        continue;
      }
      mergedEntryInfos.push(entryInfo);
      entryIDs.add(entryID);
    }
  },
  reduceCalendarThreadFilters(
    filteredThreadIDs: $ReadOnlySet<string>,
    update: ThreadJoinUpdateInfo,
  ) {
    if (
      !threadInFilterList(update.threadInfo) ||
      filteredThreadIDs.has(update.threadInfo.id)
    ) {
      return filteredThreadIDs;
    }
    return new Set([...filteredThreadIDs, update.threadInfo.id]);
  },
  getRawMessageInfos(update: ThreadJoinUpdateInfo) {
    return update.rawMessageInfos;
  },
  mergeMessageInfosAndTruncationStatuses(
    messageIDs: Set<string>,
    messageInfos: Array<RawMessageInfo>,
    truncationStatuses: MessageTruncationStatuses,
    update: ThreadJoinUpdateInfo,
  ) {
    for (const messageInfo of update.rawMessageInfos) {
      const messageID = messageInfo.id;
      if (!messageID || messageIDs.has(messageID)) {
        continue;
      }
      messageInfos.push(messageInfo);
      messageIDs.add(messageID);
    }

    truncationStatuses[update.threadInfo.id] = combineTruncationStatuses(
      update.truncationStatus,
      truncationStatuses[update.threadInfo.id],
    );
  },
  rawUpdateInfoFromRow(row: Object) {
    const { threadID } = JSON.parse(row.content);
    return {
      type: updateTypes.JOIN_THREAD,
      id: row.id.toString(),
      time: row.time,
      threadID,
    };
  },
  updateContentForServerDB(data: ThreadJoinUpdateData) {
    const { threadID } = data;
    return JSON.stringify({ threadID });
  },
  entitiesToFetch(update: ThreadJoinRawUpdateInfo) {
    return {
      threadID: update.threadID,
      detailedThreadID: update.threadID,
    };
  },
  updateInfoFromRawInfo(
    info: ThreadJoinRawUpdateInfo,
    params: UpdateInfoFromRawInfoParams,
  ) {
    const { data, rawEntryInfosByThreadID, rawMessageInfosByThreadID } = params;
    const { threadInfos, calendarResult, messageInfosResult } = data;
    const threadInfo = threadInfos[info.threadID];
    if (!threadInfo) {
      console.warn(
        "failed to hydrate updateTypes.JOIN_THREAD because we couldn't " +
          `fetch RawThreadInfo for ${info.threadID}`,
      );
      return null;
    }

    invariant(calendarResult, 'should be set');
    const rawEntryInfos = rawEntryInfosByThreadID[info.threadID] ?? [];
    invariant(messageInfosResult, 'should be set');
    const rawMessageInfos = rawMessageInfosByThreadID[info.threadID] ?? [];

    return {
      type: updateTypes.JOIN_THREAD,
      id: info.id,
      time: info.time,
      threadInfo,
      rawMessageInfos,
      truncationStatus: messageInfosResult.truncationStatuses[info.threadID],
      rawEntryInfos,
    };
  },
  deleteCondition: 'all_types',
  typesOfReplacedUpdatesForMatchingKey: 'all_types',
});
