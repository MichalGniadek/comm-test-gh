// @flow

import { isInvalidPinSourceForThread } from '../shared/message-utils.js';
import { threadHasPermission } from '../shared/thread-utils.js';
import type { RawMessageInfo, MessageInfo } from '../types/message-types.js';
import { threadPermissions } from '../types/thread-permission-types.js';
import type { RawThreadInfo, ThreadInfo } from '../types/thread-types.js';

function canToggleMessagePin(
  messageInfo: RawMessageInfo | MessageInfo,
  threadInfo: RawThreadInfo | ThreadInfo,
): boolean {
  const isValidMessage = !isInvalidPinSourceForThread(messageInfo, threadInfo);
  const hasManagePinsPermission = threadHasPermission(
    threadInfo,
    threadPermissions.MANAGE_PINS,
  );

  return isValidMessage && hasManagePinsPermission;
}

export { canToggleMessagePin };
