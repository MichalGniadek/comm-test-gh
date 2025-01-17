// @flow

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as React from 'react';
import { useSelector } from 'react-redux';

import { isLoggedIn } from 'lib/selectors/user-selectors.js';
import { accountHasPassword } from 'lib/shared/account-utils.js';
import { getMessageForException } from 'lib/utils/errors.js';

import { BACKUP_HASH_STORAGE_KEY } from './constants.js';
import { convertObjToBytes } from './conversion-utils.js';
import { useClientBackup } from './use-client-backup.js';
import { commUtilsModule } from '../native-modules.js';
import Alert from '../utils/alert.js';
import { useStaffCanSee } from '../utils/staff-utils.js';

function BackupHandler(): null {
  const userStore = useSelector(state => state.userStore);
  const currentUserID = useSelector(
    state => state.currentUserInfo && state.currentUserInfo.id,
  );
  const isBackupEnabled = useSelector(
    state => state.localSettings.isBackupEnabled,
  );
  const loggedIn = useSelector(isLoggedIn);
  const staffCanSee = useStaffCanSee();
  const isAccountWithPassword = useSelector(state =>
    accountHasPassword(state.currentUserInfo),
  );

  const { uploadBackupProtocol } = useClientBackup();

  React.useEffect(() => {
    (async () => {
      if (
        !isBackupEnabled ||
        !loggedIn ||
        !staffCanSee ||
        !isAccountWithPassword
      ) {
        return;
      }

      const userData = { userStore };
      const userDataBytes = convertObjToBytes(userData);
      const currentBackupHash = commUtilsModule.sha256(userDataBytes.buffer);

      const mostRecentlyUploadedBackupHash = await AsyncStorage.getItem(
        BACKUP_HASH_STORAGE_KEY,
      );

      if (
        !mostRecentlyUploadedBackupHash ||
        currentBackupHash !== mostRecentlyUploadedBackupHash
      ) {
        try {
          await uploadBackupProtocol(userData);
          await AsyncStorage.setItem(
            BACKUP_HASH_STORAGE_KEY,
            currentBackupHash,
          );
        } catch (e) {
          console.error(`Backup uploading error: ${e}`);
          Alert.alert(
            'Backup protocol info',
            `Backup uploading error: ${String(getMessageForException(e))}`,
          );
        }
      }
    })();
  }, [
    currentUserID,
    isBackupEnabled,
    staffCanSee,
    loggedIn,
    uploadBackupProtocol,
    userStore,
    isAccountWithPassword,
  ]);

  return null;
}

export default BackupHandler;
