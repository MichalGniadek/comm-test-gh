// @flow

import * as React from 'react';

import CyclingHeader from './cycling-header.react';
import InfoCard from './info-card.react';
import css from './landing.css';
import StarBackground from './star-background.react';

const screenshots = [
  {
    alt: 'a mobile phone conversation list screen',
    file: 'federated-prototype',
  },
  {
    alt: 'a mobile phone with customized dashboard screen',
    file: 'customizable-prototype',
  },
  {
    alt: 'a mobile phone chat conversation screen',
    file: 'e2e-encrypted-prototype',
  },
  {
    alt: 'a mobile phone user information screen',
    file: 'sovereign-prototype',
  },
  {
    alt: 'a mobile phone addon app selection screen',
    file: 'open-source-prototype',
  },
  {
    alt: 'a mobile phone notification options screen',
    file: 'less-noisy-prototype',
  },
];

const LandingAssetsS3URL = 'https://dh9fld3hutpxf.cloudfront.net';

function AppLanding(): React.Node {
  React.useEffect(() => {
    const testWEBP = 'UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA';
    const testImg = new Image();

    // preload webp if supported
    testImg.onload = () => {
      for (const imageFileName of screenshots) {
        const image = new Image();
        image.src = `${LandingAssetsS3URL}/${imageFileName.file}.webp`;
      }
    };

    // preload png if webp not supported
    testImg.onerror = () => {
      for (const imageFileName of screenshots) {
        const image = new Image();
        image.src = `${LandingAssetsS3URL}/${imageFileName.file}.png`;
      }
    };

    testImg.src = `data:image/webp;base64,${testWEBP}`;
  }, []);

  return (
    <>
      <StarBackground />
      <div className={css.app_landing_grid}>
        <div className={css.app_preview}>
          <picture>
            <source
              srcSet={`${LandingAssetsS3URL}/${screenshots[0].file}.webp`}
              type="image/webp"
            />
            <source
              srcSet={`${LandingAssetsS3URL}/${screenshots[0].file}.png`}
              type="image/png"
            />
            <img
              src={`${LandingAssetsS3URL}/${screenshots[0].file}.png`}
              alt={screenshots[0].alt}
            />
          </picture>
        </div>
        <div className={css.app_copy}>
          <div className={css.app_copy_wrapper}>
            <CyclingHeader />
            <p className={css.app_landing_subheading}>
              (think &quot;Web3 Discord&quot;)
            </p>
          </div>

          <div className={css.tile_grid}>
            <InfoCard
              title="Federated"
              description="Comm is a protocol paired with an app. Each community hosts its
                own backend, which we call a keyserver. Our keyserver software
                is built to be forked."
              baseStyle={css.tile_one}
            />

            <InfoCard
              title="Customizable"
              description="Write mini-apps and custom modules in React. Skin your
                community. Customize your tabs and your home page."
              baseStyle={css.tile_two}
            />

            <InfoCard
              title="E2E-encrypted"
              description="Comm started as a project to build a private, decentralized
                alternative to Discord. Privacy is in our DNA."
              baseStyle={css.tile_three}
            />

            <InfoCard
              title="Sovereign"
              description="Log in with your ETH wallet. Use ENS as your username. On Comm,
                your identity and data are yours to control."
              baseStyle={css.tile_four}
            />

            <InfoCard
              title="Open Source"
              description="All of our code is open source. Keyservers, iOS/Android app, our
                cloud services… all of it. We believe in open platforms."
              baseStyle={css.tile_five}
            />

            <InfoCard
              title="Less Noisy"
              description="We let each user decide what they want to follow with detailed
                notif controls and a powerful unified inbox."
              baseStyle={css.tile_six}
            />
          </div>
        </div>
      </div>
    </>
  );
}

export default AppLanding;
