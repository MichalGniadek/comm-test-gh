// @flow

import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';
import * as React from 'react';

import { useModalContext } from 'lib/components/modal-provider.react.js';
import {
  defaultAnonymousUserEmojiAvatar,
  getAvatarForUser,
  getDefaultAvatar,
} from 'lib/shared/avatar-utils.js';
import type {
  ClientAvatar,
  ClientEmojiAvatar,
} from 'lib/types/avatar-types.js';

import Avatar from './avatar.react.js';
import css from './emoji-avatar-selection-modal.css';
import Modal from '../modals/modal.react.js';
import ColorSelector from '../modals/threads/color-selector.react.js';
import { useSelector } from '../redux/redux-utils.js';

function EmojiAvatarSelectionModal(): React.Node {
  const { popModal } = useModalContext();

  const currentUserInfo = useSelector(state => state.currentUserInfo);
  const currentUserAvatar: ClientAvatar = getAvatarForUser(currentUserInfo);
  const defaultUserAvatar: ClientEmojiAvatar = currentUserInfo?.username
    ? getDefaultAvatar(currentUserInfo.username)
    : defaultAnonymousUserEmojiAvatar;

  // eslint-disable-next-line no-unused-vars
  const [pendingAvatarEmoji, setPendingAvatarEmoji] = React.useState(
    currentUserAvatar.type === 'emoji'
      ? currentUserAvatar.emoji
      : defaultUserAvatar.emoji,
  );

  const [pendingAvatarColor, setPendingAvatarColor] = React.useState(
    currentUserAvatar.type === 'emoji'
      ? currentUserAvatar.color
      : defaultUserAvatar.color,
  );

  const pendingEmojiAvatar: ClientEmojiAvatar = React.useMemo(
    () => ({
      type: 'emoji',
      emoji: pendingAvatarEmoji,
      color: pendingAvatarColor,
    }),
    [pendingAvatarColor, pendingAvatarEmoji],
  );

  const onEmojiSelect = React.useCallback(selection => {
    setPendingAvatarEmoji(selection.native);
  }, []);

  return (
    <Modal name="Emoji avatar selection" size="large" onClose={popModal}>
      <div className={css.modalBody}>
        <div className={css.avatarContainer}>
          <Avatar avatarInfo={pendingEmojiAvatar} size="profile" />
        </div>
        <div className={css.emojiPickerContainer}>
          <Picker data={data} theme="dark" onEmojiSelect={onEmojiSelect} />
        </div>
        <div className={css.colorSelectorContainer}>
          <ColorSelector
            currentColor={pendingAvatarColor}
            onColorSelection={setPendingAvatarColor}
          />
        </div>
      </div>
    </Modal>
  );
}

export default EmojiAvatarSelectionModal;
