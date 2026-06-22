import React from 'react';
import { useTranslation } from 'react-i18next';
import { Layer, Tile } from '@carbon/react';
import styles from './smart-notifications-app.scss';

const SmartNotificationsApp: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className={styles.container}>
      <Layer>
        <Tile className={styles.tile}>
          <h1 className={styles.heading}>
            {t('smart-notifications-appHeading', 'SmartNotificationsApp')}
          </h1>
          <p className={styles.content}>
            {t('smart-notifications-appDescription', 'Welcome to the SmartNotificationsApp page.')}
          </p>
        </Tile>
      </Layer>
    </div>
  );
};

export default SmartNotificationsApp;