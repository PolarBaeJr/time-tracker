import { Platform } from 'react-native';

import secureStorageNative from './secureStorage.native';
import secureStorageWeb from './secureStorage.web';

const secureStorage = Platform.OS === 'web' ? secureStorageWeb : secureStorageNative;

export default secureStorage;
