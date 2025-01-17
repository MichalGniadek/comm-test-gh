// @flow

import invariant from 'invariant';
import _isEqual from 'lodash/fp/isEqual.js';
import * as React from 'react';

import {
  updateCalendarQueryActionTypes,
  useUpdateCalendarQuery,
} from '../actions/entry-actions.js';
import type { UpdateCalendarQueryInput } from '../actions/entry-actions.js';
import { connectionSelector } from '../selectors/keyserver-selectors.js';
import { timeUntilCalendarRangeExpiration } from '../selectors/nav-selectors.js';
import { useIsAppForegrounded } from '../shared/lifecycle-utils.js';
import type {
  CalendarQuery,
  CalendarQueryUpdateResult,
  CalendarQueryUpdateStartingPayload,
} from '../types/entry-types.js';
import { type ConnectionInfo } from '../types/socket-types.js';
import {
  type DispatchActionPromise,
  useDispatchActionPromise,
} from '../utils/action-utils.js';
import { useSelector } from '../utils/redux-utils.js';

type BaseProps = {
  +currentCalendarQuery: () => CalendarQuery,
  +frozen: boolean,
};
type Props = {
  ...BaseProps,
  +connection: ConnectionInfo,
  +calendarQuery: CalendarQuery,
  +lastUserInteractionCalendar: number,
  +foreground: boolean,
  +dispatchActionPromise: DispatchActionPromise,
  +updateCalendarQuery: (
    input: UpdateCalendarQueryInput,
  ) => Promise<CalendarQueryUpdateResult>,
};
class CalendarQueryHandler extends React.PureComponent<Props> {
  serverCalendarQuery: CalendarQuery;
  expirationTimeoutID: ?TimeoutID;

  constructor(props: Props) {
    super(props);
    this.serverCalendarQuery = this.props.calendarQuery;
  }

  componentDidMount() {
    if (this.props.connection.status === 'connected') {
      this.possiblyUpdateCalendarQuery();
    }
  }

  componentDidUpdate(prevProps: Props) {
    const { calendarQuery } = this.props;
    if (this.props.connection.status !== 'connected') {
      if (!_isEqual(this.serverCalendarQuery)(calendarQuery)) {
        this.serverCalendarQuery = calendarQuery;
      }
      return;
    }

    if (
      !_isEqual(this.serverCalendarQuery)(calendarQuery) &&
      _isEqual(this.props.currentCalendarQuery())(calendarQuery)
    ) {
      this.serverCalendarQuery = calendarQuery;
    }

    const shouldUpdate =
      (this.isExpired ||
        prevProps.connection.status !== 'connected' ||
        this.props.currentCalendarQuery !== prevProps.currentCalendarQuery) &&
      this.shouldUpdateCalendarQuery;

    if (shouldUpdate) {
      this.updateCalendarQuery();
    }
  }

  render() {
    return null;
  }

  get isExpired() {
    const timeUntilExpiration = timeUntilCalendarRangeExpiration(
      this.props.lastUserInteractionCalendar,
    );
    return (
      timeUntilExpiration !== null &&
      timeUntilExpiration !== undefined &&
      timeUntilExpiration <= 0
    );
  }

  get shouldUpdateCalendarQuery() {
    if (this.props.connection.status !== 'connected' || this.props.frozen) {
      return false;
    }
    const calendarQuery = this.props.currentCalendarQuery();
    return !_isEqual(calendarQuery)(this.serverCalendarQuery);
  }

  updateCalendarQuery() {
    const calendarQuery = this.props.currentCalendarQuery();
    this.serverCalendarQuery = calendarQuery;
    this.props.dispatchActionPromise(
      updateCalendarQueryActionTypes,
      this.props.updateCalendarQuery({
        calendarQuery,
        reduxAlreadyUpdated: true,
      }),
      undefined,
      ({ calendarQuery }: CalendarQueryUpdateStartingPayload),
    );
  }

  possiblyUpdateCalendarQuery = () => {
    if (this.shouldUpdateCalendarQuery) {
      this.updateCalendarQuery();
    }
  };
}

const ConnectedCalendarQueryHandler: React.ComponentType<BaseProps> =
  React.memo<BaseProps>(function ConnectedCalendarQueryHandler(props) {
    const connection = useSelector(connectionSelector);
    invariant(connection, 'keyserver missing from keyserverStore');
    const lastUserInteractionCalendar = useSelector(
      state => state.entryStore.lastUserInteractionCalendar,
    );
    // We include this so that componentDidUpdate will be called on foreground
    const foreground = useIsAppForegrounded();
    const callUpdateCalendarQuery = useUpdateCalendarQuery();
    const dispatchActionPromise = useDispatchActionPromise();
    const calendarQuery = useSelector(state => state.actualizedCalendarQuery);

    return (
      <CalendarQueryHandler
        {...props}
        connection={connection}
        calendarQuery={calendarQuery}
        lastUserInteractionCalendar={lastUserInteractionCalendar}
        foreground={foreground}
        updateCalendarQuery={callUpdateCalendarQuery}
        dispatchActionPromise={dispatchActionPromise}
      />
    );
  });
export default ConnectedCalendarQueryHandler;
