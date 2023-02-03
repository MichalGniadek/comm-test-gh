// @flow

import '@rainbow-me/rainbowkit/dist/index.css';

import {
  ConnectButton,
  darkTheme,
  getDefaultWallets,
  RainbowKitProvider,
  useConnectModal,
} from '@rainbow-me/rainbowkit';
import invariant from 'invariant';
import _merge from 'lodash/fp/merge';
import * as React from 'react';
import { FaEthereum } from 'react-icons/fa';
import {
  chain,
  configureChains,
  createClient,
  useAccount,
  useSigner,
  WagmiConfig,
} from 'wagmi';
import { alchemyProvider } from 'wagmi/providers/alchemy';
import { publicProvider } from 'wagmi/providers/public';

import {
  getSIWENonce,
  getSIWENonceActionTypes,
  siweAuth,
  siweAuthActionTypes,
} from 'lib/actions/siwe-actions';
import { createLoadingStatusSelector } from 'lib/selectors/loading-selectors';
import type { LogInStartingPayload } from 'lib/types/account-types.js';
import {
  useDispatchActionPromise,
  useServerCall,
} from 'lib/utils/action-utils';
import {
  createSIWEMessage,
  siweMessageSigningExplanationStatements,
  siweStatementWithoutPublicKey,
} from 'lib/utils/siwe-utils.js';

import Button from '../components/button.react';
import LoadingIndicator from '../loading-indicator.react';
import { useSelector } from '../redux/redux-utils';
import { webLogInExtraInfoSelector } from '../selectors/account-selectors.js';
import css from './siwe.css';

// details can be found https://0.6.x.wagmi.sh/docs/providers/configuring-chains
const availableProviders = process.env.COMM_ALCHEMY_KEY
  ? [alchemyProvider({ apiKey: process.env.COMM_ALCHEMY_KEY })]
  : [publicProvider()];
const { chains, provider } = configureChains(
  [chain.mainnet],
  availableProviders,
);

const { connectors } = getDefaultWallets({
  appName: 'comm',
  chains,
});

const wagmiClient = createClient({
  autoConnect: true,
  connectors,
  provider,
});

const getSIWENonceLoadingStatusSelector = createLoadingStatusSelector(
  getSIWENonceActionTypes,
);
function SIWE(): React.Node {
  const { openConnectModal } = useConnectModal();
  const { address } = useAccount();
  const { data: signer } = useSigner();
  const dispatchActionPromise = useDispatchActionPromise();
  const getSIWENonceCall = useServerCall(getSIWENonce);
  const getSIWENonceCallLoadingStatus = useSelector(
    getSIWENonceLoadingStatusSelector,
  );
  const siweAuthCall = useServerCall(siweAuth);
  const logInExtraInfo = useSelector(webLogInExtraInfoSelector);

  const [siweNonce, setSIWENonce] = React.useState<?string>(null);

  React.useEffect(() => {
    if (!signer) {
      setSIWENonce(null);
      return;
    }
    dispatchActionPromise(
      getSIWENonceActionTypes,
      (async () => {
        const response = await getSIWENonceCall();
        setSIWENonce(response);
      })(),
    );
  }, [dispatchActionPromise, getSIWENonceCall, signer]);

  const siweButtonColor = React.useMemo(
    () => ({ backgroundColor: 'white', color: 'black' }),
    [],
  );

  const callSIWEAuthEndpoint = React.useCallback(
    (message: string, signature: string, extraInfo) =>
      siweAuthCall({
        message,
        signature,
        ...extraInfo,
      }),
    [siweAuthCall],
  );

  const attemptSIWEAuth = React.useCallback(
    (message: string, signature: string) => {
      const extraInfo = logInExtraInfo();
      dispatchActionPromise(
        siweAuthActionTypes,
        callSIWEAuthEndpoint(message, signature, extraInfo),
        undefined,
        ({ calendarQuery: extraInfo.calendarQuery }: LogInStartingPayload),
      );
    },
    [callSIWEAuthEndpoint, dispatchActionPromise, logInExtraInfo],
  );

  const onSignInButtonClick = React.useCallback(async () => {
    invariant(siweNonce, 'nonce must be present during SIWE attempt');
    const message = createSIWEMessage(
      address,
      siweStatementWithoutPublicKey,
      siweNonce,
    );
    const signature = await signer.signMessage(message);
    attemptSIWEAuth(message, signature);
  }, [address, attemptSIWEAuth, signer, siweNonce]);

  let siweLoginForm;
  if (signer && !siweNonce) {
    siweLoginForm = (
      <div className={css.connectButtonContainer}>
        <LoadingIndicator
          status={getSIWENonceCallLoadingStatus}
          size="medium"
        />
      </div>
    );
  } else if (signer) {
    siweLoginForm = (
      <div className={css.siweLoginFormContainer}>
        <div className={css.connectButtonContainer}>
          <ConnectButton />
        </div>
        <p>{siweMessageSigningExplanationStatements[0]}</p>
        <p>{siweMessageSigningExplanationStatements[1]}</p>
        <Button variant="filled" onClick={onSignInButtonClick}>
          Sign in
        </Button>
      </div>
    );
  }

  const onSIWEButtonClick = React.useCallback(() => {
    openConnectModal && openConnectModal();
  }, [openConnectModal]);

  let siweButton;
  if (openConnectModal) {
    siweButton = (
      <>
        <Button
          onClick={onSIWEButtonClick}
          variant="filled"
          buttonColor={siweButtonColor}
        >
          <div className={css.ethereumLogoContainer}>
            <FaEthereum />
          </div>
          Sign in with Ethereum
        </Button>
      </>
    );
  }
  return (
    <div className={css.siweContainer}>
      <hr />
      {siweLoginForm}
      {siweButton}
    </div>
  );
}

function SIWEWrapper(): React.Node {
  const theme = React.useMemo(() => {
    return _merge(darkTheme())({
      radii: {
        modal: 0,
        modalMobile: 0,
      },
      colors: {
        modalBackdrop: '#242529',
      },
    });
  }, []);
  return (
    <WagmiConfig client={wagmiClient}>
      <RainbowKitProvider chains={chains} theme={theme} modalSize="compact">
        <SIWE />
      </RainbowKitProvider>
    </WagmiConfig>
  );
}

export default SIWEWrapper;