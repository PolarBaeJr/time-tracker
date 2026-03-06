import { Platform } from 'react-native';

import storageNative from './storage.native';
import storageWeb from './storage.web';

const storage = Platform.OS === 'web' ? storageWeb : storageNative;

export default storage;
