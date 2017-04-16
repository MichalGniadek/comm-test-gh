// @flow

import type { AppState, NavInfo } from '../redux-setup';

import React from 'react';
import classNames from 'classnames';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';

import css from '../style.css';
import NewCalendarModal from '../modals/new-calendar-modal.react';
import LogInFirstModal from '../modals/account/log-in-first-modal.react';
import { monthURL } from '../url-utils';
import history from '../router-history';

export type NavID = "home" | "new";
type Props = {
  navID: NavID,
  name: string,
  monthURL: string,
  loggedIn: bool,
  setModal: (modal: React.Element<any>) => void,
  clearModal: () => void,
  freezeTypeahead: (navID: string) => void,
  unfreezeTypeahead: (navID: string) => void,
  onTransition: () => void,
  frozen?: bool,
};

class TypeaheadActionOption extends React.PureComponent {

  static defaultProps = { frozen: false };
  props: Props;

  render() {
    return (
      <div
        className={classNames(
          css['calendar-nav-option'],
          {[css['calendar-nav-frozen-option']]: this.props.frozen},
        )}
        onClick={this.onClick}
      >
        <div>
          <div className={css['calendar-nav-option-name']}>
            {this.props.name}
          </div>
          <div className={css['clear']} />
        </div>
      </div>
    );
  }

  onClick = (event: SyntheticEvent) => {
    if (this.props.navID === 'new') {
      this.props.freezeTypeahead(this.props.navID);
      const onClose = () => {
        this.props.unfreezeTypeahead(this.props.navID);
        this.props.onTransition();
        this.props.clearModal();
      }
      if (this.props.loggedIn) {
        this.props.setModal(
          <NewCalendarModal
            onClose={onClose}
          />
        );
      } else {
        this.props.setModal(
          <LogInFirstModal
            inOrderTo="create a new calendar"
            onClose={onClose}
            setModal={this.props.setModal}
          />
        );
      }
    } else if (this.props.navID == 'home') {
      history.push(`/home/${this.props.monthURL}`);
      this.props.onTransition();
    } 
  }

}

TypeaheadActionOption.propTypes = {
  navID: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  monthURL: PropTypes.string.isRequired,
  loggedIn: PropTypes.bool.isRequired,
  setModal: PropTypes.func.isRequired,
  clearModal: PropTypes.func.isRequired,
  freezeTypeahead: PropTypes.func.isRequired,
  unfreezeTypeahead: PropTypes.func.isRequired,
  onTransition: PropTypes.func.isRequired,
  frozen: PropTypes.bool,
};

export default connect((state: AppState) => ({
  monthURL: monthURL(state),
  loggedIn: !!state.userInfo,
}))(TypeaheadActionOption);
