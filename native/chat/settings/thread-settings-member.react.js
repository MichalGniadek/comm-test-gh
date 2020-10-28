// @flow

import {
  type ThreadInfo,
  type RelativeMemberInfo,
  threadPermissions,
} from 'lib/types/thread-types';
import type { LoadingStatus } from 'lib/types/loading-types';
import type { VerticalBounds } from '../../types/layout-types';
import { ThreadSettingsMemberTooltipModalRouteName } from '../../navigation/route-names';
import type { ThreadSettingsNavigate } from './thread-settings.react';

import * as React from 'react';
import {
  View,
  Text,
  Platform,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import invariant from 'invariant';

import {
  threadHasPermission,
  memberIsAdmin,
  memberIsParentAdmin,
} from 'lib/shared/thread-utils';
import { stringForUser } from 'lib/shared/user-utils';
import {
  removeUsersFromThreadActionTypes,
  changeThreadMemberRolesActionTypes,
} from 'lib/actions/thread-actions';
import { createLoadingStatusSelector } from 'lib/selectors/loading-selectors';

import PencilIcon from '../../components/pencil-icon.react';
import { type Colors, useColors, useStyles } from '../../themes/colors';
import {
  type KeyboardState,
  KeyboardContext,
} from '../../keyboard/keyboard-state';
import {
  OverlayContext,
  type OverlayContextType,
} from '../../navigation/overlay-context';
import { SingleLine } from '../../components/single-line.react';
import { useSelector } from '../../redux/redux-utils';

type BaseProps = {|
  +memberInfo: RelativeMemberInfo,
  +threadInfo: ThreadInfo,
  +canEdit: boolean,
  +navigate: ThreadSettingsNavigate,
  +firstListItem: boolean,
  +lastListItem: boolean,
  +verticalBounds: ?VerticalBounds,
  +threadSettingsRouteKey: string,
|};
type Props = {|
  ...BaseProps,
  // Redux state
  +removeUserLoadingStatus: LoadingStatus,
  +changeRoleLoadingStatus: LoadingStatus,
  +colors: Colors,
  +styles: typeof unboundStyles,
  // withKeyboardState
  +keyboardState: ?KeyboardState,
  // withOverlayContext
  +overlayContext: ?OverlayContextType,
|};
class ThreadSettingsMember extends React.PureComponent<Props> {
  editButton: ?React.ElementRef<typeof View>;

  visibleEntryIDs() {
    const role = this.props.memberInfo.role;
    if (!this.props.canEdit || !role) {
      return [];
    }

    const canRemoveMembers = threadHasPermission(
      this.props.threadInfo,
      threadPermissions.REMOVE_MEMBERS,
    );
    const canChangeRoles = threadHasPermission(
      this.props.threadInfo,
      threadPermissions.CHANGE_ROLE,
    );

    const result = [];
    if (
      canRemoveMembers &&
      !this.props.memberInfo.isViewer &&
      (canChangeRoles ||
        (this.props.threadInfo.roles[role] &&
          this.props.threadInfo.roles[role].isDefault))
    ) {
      result.push('remove_user');
    }

    if (canChangeRoles && this.props.memberInfo.username) {
      result.push(
        memberIsAdmin(this.props.memberInfo, this.props.threadInfo)
          ? 'remove_admin'
          : 'make_admin',
      );
    }

    return result;
  }

  render() {
    const userText = stringForUser(this.props.memberInfo);
    let userInfo = null;
    if (this.props.memberInfo.username) {
      userInfo = (
        <SingleLine style={this.props.styles.username}>{userText}</SingleLine>
      );
    } else {
      userInfo = (
        <SingleLine
          style={[this.props.styles.username, this.props.styles.anonymous]}
        >
          {userText}
        </SingleLine>
      );
    }

    let editButton = null;
    if (
      this.props.removeUserLoadingStatus === 'loading' ||
      this.props.changeRoleLoadingStatus === 'loading'
    ) {
      editButton = (
        <ActivityIndicator
          size="small"
          color={this.props.colors.panelForegroundSecondaryLabel}
        />
      );
    } else if (this.visibleEntryIDs().length !== 0) {
      editButton = (
        <TouchableOpacity
          onPress={this.onPressEdit}
          style={this.props.styles.editButton}
        >
          <View onLayout={this.onEditButtonLayout} ref={this.editButtonRef}>
            <PencilIcon />
          </View>
        </TouchableOpacity>
      );
    }

    let roleInfo = null;
    if (memberIsAdmin(this.props.memberInfo, this.props.threadInfo)) {
      roleInfo = (
        <View style={this.props.styles.row}>
          <Text style={this.props.styles.role} numberOfLines={1}>
            admin
          </Text>
        </View>
      );
    } else if (memberIsParentAdmin(this.props.memberInfo)) {
      roleInfo = (
        <View style={this.props.styles.row}>
          <Text style={this.props.styles.role} numberOfLines={1}>
            parent admin
          </Text>
        </View>
      );
    }

    const firstItem = this.props.firstListItem
      ? null
      : this.props.styles.topBorder;
    const lastItem = this.props.lastListItem
      ? this.props.styles.lastInnerContainer
      : null;
    return (
      <View style={this.props.styles.container}>
        <View style={[this.props.styles.innerContainer, firstItem, lastItem]}>
          <View style={this.props.styles.row}>
            {userInfo}
            {editButton}
          </View>
          {roleInfo}
        </View>
      </View>
    );
  }

  editButtonRef = (editButton: ?React.ElementRef<typeof View>) => {
    this.editButton = editButton;
  };

  onEditButtonLayout = () => {};

  onPressEdit = () => {
    if (this.dismissKeyboardIfShowing()) {
      return;
    }

    const {
      editButton,
      props: { verticalBounds },
    } = this;
    if (!editButton || !verticalBounds) {
      return;
    }

    const { overlayContext } = this.props;
    invariant(
      overlayContext,
      'ThreadSettingsMember should have OverlayContext',
    );
    overlayContext.setScrollBlockingModalStatus('open');

    editButton.measure((x, y, width, height, pageX, pageY) => {
      const coordinates = { x: pageX, y: pageY, width, height };
      this.props.navigate({
        name: ThreadSettingsMemberTooltipModalRouteName,
        params: {
          presentedFrom: this.props.threadSettingsRouteKey,
          initialCoordinates: coordinates,
          verticalBounds,
          visibleEntryIDs: this.visibleEntryIDs(),
          memberInfo: this.props.memberInfo,
          threadInfo: this.props.threadInfo,
        },
      });
    });
  };

  dismissKeyboardIfShowing = () => {
    const { keyboardState } = this.props;
    return !!(keyboardState && keyboardState.dismissKeyboardIfShowing());
  };
}

const unboundStyles = {
  anonymous: {
    color: 'panelForegroundTertiaryLabel',
    fontStyle: 'italic',
  },
  container: {
    backgroundColor: 'panelForeground',
    flex: 1,
    paddingHorizontal: 12,
  },
  editButton: {
    paddingLeft: 10,
  },
  topBorder: {
    borderColor: 'panelForegroundBorder',
    borderTopWidth: 1,
  },
  innerContainer: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  lastInnerContainer: {
    paddingBottom: Platform.OS === 'ios' ? 12 : 10,
  },
  role: {
    color: 'panelForegroundTertiaryLabel',
    flex: 1,
    fontSize: 14,
    paddingTop: 4,
  },
  row: {
    flex: 1,
    flexDirection: 'row',
  },
  username: {
    color: 'panelForegroundSecondaryLabel',
    flex: 1,
    fontSize: 16,
    lineHeight: 20,
  },
};

export default React.memo<BaseProps>(function ConnectedThreadSettingsMember(
  props: BaseProps,
) {
  const memberID = props.memberInfo.id;
  const removeUserLoadingStatus = useSelector((state) =>
    createLoadingStatusSelector(
      removeUsersFromThreadActionTypes,
      `${removeUsersFromThreadActionTypes.started}:${memberID}`,
    )(state),
  );
  const changeRoleLoadingStatus = useSelector((state) =>
    createLoadingStatusSelector(
      changeThreadMemberRolesActionTypes,
      `${changeThreadMemberRolesActionTypes.started}:${memberID}`,
    )(state),
  );

  const colors = useColors();
  const styles = useStyles(unboundStyles);
  const keyboardState = React.useContext(KeyboardContext);
  const overlayContext = React.useContext(OverlayContext);
  return (
    <ThreadSettingsMember
      {...props}
      removeUserLoadingStatus={removeUserLoadingStatus}
      changeRoleLoadingStatus={changeRoleLoadingStatus}
      colors={colors}
      styles={styles}
      keyboardState={keyboardState}
      overlayContext={overlayContext}
    />
  );
});
