// @flow

import invariant from 'invariant';
import * as React from 'react';
import { Text, TouchableWithoutFeedback, View } from 'react-native';

import type { ReactionInfo } from 'lib/selectors/chat-selectors.js';
import { threadInfoSelector } from 'lib/selectors/thread-selectors.js';
import type { ThreadInfo } from 'lib/types/thread-types.js';
import {
  entityTextToReact,
  entityTextToRawString,
  useENSNamesForEntityText,
  type EntityText,
} from 'lib/utils/entity-text.js';

import { DummyInlineEngagementNode } from './inline-engagement.react.js';
import { useNavigateToThread } from './message-list-types.js';
import Markdown from '../markdown/markdown.react.js';
import { inlineMarkdownRules } from '../markdown/rules.react.js';
import { useSelector } from '../redux/redux-utils.js';
import { useOverlayStyles } from '../themes/colors.js';
import type { ChatRobotextMessageInfoItemWithHeight } from '../types/chat-types.js';
import { useNavigateToUserProfileBottomSheet } from '../user-profile/user-profile-utils.js';

function dummyNodeForRobotextMessageHeightMeasurement(
  robotext: EntityText,
  threadID: string,
  sidebarInfo: ?ThreadInfo,
  reactions: ReactionInfo,
): React.Element<typeof View> {
  return (
    <View>
      <View style={unboundStyles.robotextContainer}>
        <Text style={unboundStyles.dummyRobotext}>
          {entityTextToRawString(robotext, { threadID })}
        </Text>
      </View>
      <DummyInlineEngagementNode
        sidebarInfo={sidebarInfo}
        reactions={reactions}
      />
    </View>
  );
}

type InnerRobotextMessageProps = {
  +item: ChatRobotextMessageInfoItemWithHeight,
  +onPress: () => void,
  +onLongPress?: () => void,
};
function InnerRobotextMessage(props: InnerRobotextMessageProps): React.Node {
  const { item, onLongPress, onPress } = props;
  const activeTheme = useSelector(state => state.globalThemeInfo.activeTheme);
  const styles = useOverlayStyles(unboundStyles);

  const { messageInfo, robotext } = item;
  const { threadID } = messageInfo;
  const robotextWithENSNames = useENSNamesForEntityText(robotext);
  invariant(
    robotextWithENSNames,
    'useENSNamesForEntityText only returns falsey when passed falsey',
  );
  const textParts = React.useMemo(() => {
    const darkColor = activeTheme === 'dark';
    return entityTextToReact(robotextWithENSNames, threadID, {
      // eslint-disable-next-line react/display-name
      renderText: ({ text }) => (
        <Markdown
          style={styles.robotext}
          rules={inlineMarkdownRules(darkColor)}
        >
          {text}
        </Markdown>
      ),
      // eslint-disable-next-line react/display-name
      renderThread: ({ id, name }) => <ThreadEntity id={id} name={name} />,
      // eslint-disable-next-line react/display-name
      renderUser: ({ userID, usernameText }) => (
        <UserEntity userID={userID} usernameText={usernameText} />
      ),
      // eslint-disable-next-line react/display-name
      renderColor: ({ hex }) => <ColorEntity color={hex} />,
    });
  }, [robotextWithENSNames, activeTheme, threadID, styles.robotext]);

  return (
    <TouchableWithoutFeedback onPress={onPress} onLongPress={onLongPress}>
      <View style={styles.robotextContainer}>
        <Text style={styles.robotext}>{textParts}</Text>
      </View>
    </TouchableWithoutFeedback>
  );
}

type ThreadEntityProps = {
  +id: string,
  +name: string,
};
function ThreadEntity(props: ThreadEntityProps) {
  const threadID = props.id;
  const threadInfo = useSelector(state => threadInfoSelector(state)[threadID]);

  const styles = useOverlayStyles(unboundStyles);

  const navigateToThread = useNavigateToThread();
  const onPressThread = React.useCallback(() => {
    invariant(threadInfo, 'onPressThread should have threadInfo');
    navigateToThread({ threadInfo });
  }, [threadInfo, navigateToThread]);

  if (!threadInfo) {
    return <Text>{props.name}</Text>;
  }
  return (
    <Text style={styles.link} onPress={onPressThread}>
      {props.name}
    </Text>
  );
}

type UserEntityProps = {
  +userID: string,
  +usernameText: string,
};
function UserEntity(props: UserEntityProps) {
  const { userID, usernameText } = props;

  const styles = useOverlayStyles(unboundStyles);

  const navigateToUserProfileBottomSheet =
    useNavigateToUserProfileBottomSheet();

  const onPressUser = React.useCallback(
    () => navigateToUserProfileBottomSheet(userID),
    [navigateToUserProfileBottomSheet, userID],
  );

  return (
    <Text style={styles.link} onPress={onPressUser}>
      {usernameText}
    </Text>
  );
}

function ColorEntity(props: { +color: string }) {
  const colorStyle = { color: props.color };
  return <Text style={colorStyle}>{props.color}</Text>;
}

const unboundStyles = {
  link: {
    color: 'link',
  },
  robotextContainer: {
    paddingTop: 6,
    paddingBottom: 11,
    paddingHorizontal: 24,
  },
  robotext: {
    color: 'listForegroundSecondaryLabel',
    fontFamily: 'Arial',
    fontSize: 15,
    textAlign: 'center',
  },
  dummyRobotext: {
    fontFamily: 'Arial',
    fontSize: 15,
    textAlign: 'center',
  },
};

const MemoizedInnerRobotextMessage: React.ComponentType<InnerRobotextMessageProps> =
  React.memo<InnerRobotextMessageProps>(InnerRobotextMessage);

export {
  dummyNodeForRobotextMessageHeightMeasurement,
  MemoizedInnerRobotextMessage as InnerRobotextMessage,
};
