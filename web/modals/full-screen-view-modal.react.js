// @flow

import invariant from 'invariant';
import * as React from 'react';
import { XCircle as XCircleIcon } from 'react-feather';

import { useModalContext } from 'lib/components/modal-provider.react.js';
import type { SetState } from 'lib/types/hook-types.js';
import type { Dimensions } from 'lib/types/media-types.js';

import css from './full-screen-view-modal.css';

type BaseProps = {
  +children: React.Node,
  +contentDimensions: ?Dimensions,
  +setContentDimensions: SetState<?Dimensions>,
};

type Props = {
  ...BaseProps,
  +popModal: (modal: ?React.Node) => void,
};

class FullScreenViewModal extends React.PureComponent<Props> {
  overlay: ?HTMLDivElement;

  componentDidMount() {
    invariant(this.overlay, 'overlay ref unset');
    this.overlay.focus();
    this.calculateMediaDimensions();
    window.addEventListener('resize', this.calculateMediaDimensions);
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.calculateMediaDimensions);
  }

  render(): React.Node {
    return (
      <div
        className={css.fullScreenModalOverlay}
        onClick={this.onBackgroundClick}
      >
        <div
          ref={this.overlayRef}
          className={css.contentContainer}
          tabIndex={0}
          onKeyDown={this.onKeyDown}
        >
          {this.props.children}
        </div>
        <XCircleIcon
          onClick={this.props.popModal}
          className={css.closeFullScreenModal}
        />
      </div>
    );
  }

  overlayRef: (overlay: ?HTMLDivElement) => void = overlay => {
    this.overlay = overlay;
  };

  onBackgroundClick: (event: SyntheticEvent<HTMLDivElement>) => void =
    event => {
      if (event.target === this.overlay) {
        this.props.popModal();
      }
    };

  onKeyDown: (event: SyntheticKeyboardEvent<HTMLDivElement>) => void =
    event => {
      if (event.key === 'Escape') {
        this.props.popModal();
      }
    };

  calculateMediaDimensions: () => void = () => {
    if (!this.overlay || !this.props.contentDimensions) {
      return;
    }
    const containerWidth = this.overlay.clientWidth;
    const containerHeight = this.overlay.clientHeight;
    const containerAspectRatio = containerWidth / containerHeight;

    const { width: mediaWidth, height: mediaHeight } =
      this.props.contentDimensions;
    const mediaAspectRatio = mediaWidth / mediaHeight;

    let newWidth, newHeight;
    if (containerAspectRatio > mediaAspectRatio) {
      newWidth = Math.min(mediaWidth, containerHeight * mediaAspectRatio);
      newHeight = newWidth / mediaAspectRatio;
    } else {
      newHeight = Math.min(mediaHeight, containerWidth / mediaAspectRatio);
      newWidth = newHeight * mediaAspectRatio;
    }
    this.props.setContentDimensions({
      width: newWidth,
      height: newHeight,
    });
  };
}

function ConnectedFullScreenViewModal(props: BaseProps): React.Node {
  const modalContext = useModalContext();

  const fullScreenViewModal = React.useMemo(
    () => <FullScreenViewModal {...props} popModal={modalContext.popModal} />,
    [modalContext.popModal, props],
  );

  return fullScreenViewModal;
}

export default ConnectedFullScreenViewModal;
