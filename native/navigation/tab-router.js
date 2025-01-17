// @flow

import type {
  Router,
  RouterConfigOptions,
  TabRouterOptions,
  TabNavigationState,
} from '@react-navigation/native';
import { TabRouter } from '@react-navigation/native';

import {
  getChatNavStateFromTabNavState,
  getRemoveEditMode,
} from './nav-selectors.js';

type TabRouterNavigationAction = empty;

export type TabRouterExtraNavigationHelpers = {};

function CustomTabRouter(
  routerOptions: TabRouterOptions,
): Router<TabNavigationState, TabRouterNavigationAction> {
  const { getStateForAction: baseGetStateForAction, ...rest } =
    TabRouter(routerOptions);
  return {
    ...rest,
    getStateForAction: (
      lastState: TabNavigationState,
      action: TabRouterNavigationAction,
      options: RouterConfigOptions,
    ) => {
      const chatNavState = getChatNavStateFromTabNavState(lastState);
      const removeEditMode = getRemoveEditMode(chatNavState);
      if (removeEditMode && removeEditMode(action) === 'ignore_action') {
        return lastState;
      }
      return baseGetStateForAction(lastState, action, options);
    },
  };
}

export default CustomTabRouter;
