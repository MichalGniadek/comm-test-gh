// @flow

import type { EntryInfo } from './entry-info';
import { entryInfoPropType } from './entry-info';
import type { SquadInfo } from '../squad-info';
import { squadInfoPropType } from '../squad-info';
import type { LoadingStatus } from '../loading-indicator.react';

import React from 'react';
import classNames from 'classnames';
import invariant from 'invariant';
import update from 'immutability-helper';
import $ from 'jquery';

import LoadingIndicator from '../loading-indicator.react';
import { colorIsDark } from '../squad-utils';
import fetchJSON from '../fetch-json';
import Modernizr from '../modernizr-custom';

type Props = {
  entryInfo: EntryInfo,
  squadInfo: SquadInfo,
  baseURL: string,
  sessionID: string,
  removeEntriesWhere: (filterFunc: (entryInfo: EntryInfo) => bool) => void,
};
type State = {
  entryInfo: EntryInfo,
  focused: bool,
  hovered: bool,
  showSquadSelector: bool,
  loadingStatus: LoadingStatus,
};

class Entry extends React.Component {

  props: Props;
  state: State;
  textarea: ?HTMLTextAreaElement;
  creating: bool;
  needsUpdateAfterCreation: bool;
  saveAttemptIndex: number;
  mounted: bool;

  constructor(props: Props) {
    super(props);
    this.state = {
      entryInfo: props.entryInfo,
      focused: false,
      hovered: false,
      showSquadSelector: false,
      loadingStatus: "inactive",
    };
    this.creating = false;
    this.needsUpdateAfterCreation = false;
    this.saveAttemptIndex = 0;
    this.mounted = true;
  }

  componentDidMount() {
    this.updateHeight();
    // Whenever a new Entry is created, focus on it
    if (!this.state.entryInfo.id) {
      invariant(
        this.textarea instanceof HTMLTextAreaElement,
        "textarea ref not set",
      );
      this.textarea.focus();
    }
  }

  componentWillUnmount() {
    this.mounted = false;
  }

  updateHeight() {
    invariant(
      this.textarea instanceof HTMLTextAreaElement,
      "textarea ref not set",
    );
    this.textarea.style.height = 'auto';
    this.textarea.style.height = (this.textarea.scrollHeight) + 'px';
  }

  render() {
    let actionLinks = null;
    if (this.state.focused || this.state.hovered || Modernizr.touchevents) {
      let historyButton = null;
      if (this.state.entryInfo.id) {
        historyButton = (
          <a
            href="#"
            className="entry-history-button"
            onClick={this.onHistory.bind(this)}
          >
            <span className="history">≡</span>
            <span className="action-links-text">History</span>
          </a>
        );
      }
      actionLinks = (
        <div className="action-links">
          <a
            href="#"
            className="delete-entry-button"
            onClick={this.onDelete.bind(this)}
          >
            <span className="delete">✖</span>
            <span className="action-links-text">Delete</span>
          </a>
          {historyButton}
          <span className="right-action-links action-links-text">
            {this.props.squadInfo.name}
          </span>
          <div className="clear"></div>
        </div>
      );
    }

    const entryClasses = classNames({
      "entry": true,
      "dark-entry": colorIsDark(this.props.squadInfo.color),
      "focused-entry": this.state.focused || this.state.hovered,
    });
    const style = { backgroundColor: "#" + this.props.squadInfo.color };
    const textareaID = this.state.entryInfo.day + "_" +
      (this.state.entryInfo.id ? this.state.entryInfo.id : "-1");
    return (
      <div
        className={entryClasses}
        style={style}
        onMouseEnter={() => this.setState({ hovered: true })}
        onMouseLeave={() => this.setState({ hovered: false })}
      >
        <textarea
          rows="1"
          className="entry-text"
          id={textareaID}
          onChange={this.onChange.bind(this)}
          value={this.state.entryInfo.text}
          onFocus={() => this.setState({ focused: true })}
          onBlur={this.onBlur.bind(this)}
          ref={(textarea) => this.textarea = textarea}
        />
        <LoadingIndicator
          status={this.state.loadingStatus}
          baseURL={this.props.baseURL}
          className="entry-loading"
        />
        {actionLinks}
      </div>
    );
  }

  async onBlur(event: SyntheticEvent) {
    this.setState({ focused: false });
    invariant(
      this.textarea instanceof HTMLTextAreaElement,
      "textarea ref not set",
    );
    if (this.textarea.value.trim() === "") {
      await this.delete(this.state.entryInfo.id);
    }
  }

  async onChange(event: SyntheticEvent) {
    const target = event.target;
    invariant(target instanceof HTMLTextAreaElement, "target not textarea");
    this.setState(
      (prevState, props) => {
        return update(prevState, {
          entryInfo: {
            text: { $set: target.value },
          }
        });
      },
      this.updateHeight.bind(this),
    );
    await this.save(this.state.entryInfo.id, target.value);
  }

  async save(serverID: ?string, newText: string) {
    if (newText.trim() === "") {
      // We don't save the empty string, since as soon as the element loses
      // focus it'll get deleted
      return;
    }

    if (!serverID) {
      if (this.creating) {
        // We need the first save call to return so we know the ID of the entry
        // we're updating, so we'll need to handle this save later
        this.needsUpdateAfterCreation = true;
        return;
      } else {
        this.creating = true;
      }
    }

    const curSaveAttempt = ++this.saveAttemptIndex;
    this.setState({ loadingStatus: "loading" });

    const creationTime = Date.now();
    const entryID = serverID ? serverID : "-1";
    const payload: Object = {
      'text': newText,
      'prev_text': this.props.entryInfo.text,
      'session_id': this.props.sessionID,
      'timestamp': creationTime,
      'entry_id': entryID,
    };
    if (!serverID) {
      payload['day'] = this.state.entryInfo.day;
      payload['month'] = this.state.entryInfo.month;
      payload['year'] = this.state.entryInfo.year;
      payload['squad'] = this.state.entryInfo.squadID;
    }
    const response = await fetchJSON('save.php', payload);

    if (curSaveAttempt === this.saveAttemptIndex) {
      this.setState({ 
        loadingStatus: response.success ? "inactive" : "error",
      });
    }
    if (response.error === 'concurrent_modification') {
      // TODO: Reactify this modal
      $('div#concurrent-modification-modal-overlay').show();
      return;
    }
    if (!serverID && response.entry_id) {
      const needsUpdate = this.needsUpdateAfterCreation;
      if (needsUpdate && !this.mounted) {
        await this.delete(response.entry_id);
      } else {
        this.setState((prevState, props) => {
          return update(prevState, {
            entryInfo: {
              id: { $set: response.entry_id },
            }
          });
        });
      }
      this.creating = false;
      this.needsUpdateAfterCreation = false;
      // TODO: update Day's EntryInfo for us with ID and creation time
      if (needsUpdate && this.mounted) {
        invariant(
          this.textarea instanceof HTMLTextAreaElement,
          "textarea ref not set",
        );
        await this.save(response.entry_id, this.textarea.value);
      }
    }
  }

  async onDelete(event: SyntheticEvent) {
    await this.delete(this.state.entryInfo.id);
    // TODO: some way to pass the focus on to the next
  }

  async delete(serverID: ?string) {
    if (serverID) {
      await fetchJSON('delete_entry.php', {
        'id': serverID,
        'prev_text': this.props.entryInfo.text,
        'session_id': this.props.sessionID,
        'timestamp': Date.now(),
      });
    } else if (this.creating) {
      this.needsUpdateAfterCreation = true;
    }
    this.props.removeEntriesWhere((candidate) => {
      const ei = this.state.entryInfo;
      return (!!candidate.id && candidate.id === serverID) ||
        (!!candidate.localID && candidate.localID === ei.localID);
    });
  }

  async onHistory(event: SyntheticEvent) {
    // TODO: handle history
  }

}

Entry.propTypes = {
  entryInfo: entryInfoPropType.isRequired,
  squadInfo: squadInfoPropType.isRequired,
  baseURL: React.PropTypes.string.isRequired,
  sessionID: React.PropTypes.string.isRequired,
  removeEntriesWhere: React.PropTypes.func.isRequired,
}

export default Entry;
