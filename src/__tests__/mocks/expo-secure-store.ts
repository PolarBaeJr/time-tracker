const store: Record<string, string> = {};

export const getItemAsync = jest.fn(async (key: string) => store[key] ?? null);
export const setItemAsync = jest.fn(async (key: string, value: string) => {
  store[key] = value;
});
export const deleteItemAsync = jest.fn(async (key: string) => {
  delete store[key];
});
export const isAvailableAsync = jest.fn(async () => true);
export const AFTER_FIRST_UNLOCK = 'afterFirstUnlock';
export const AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY = 'afterFirstUnlockThisDeviceOnly';
export const ALWAYS = 'always';
export const ALWAYS_THIS_DEVICE_ONLY = 'alwaysThisDeviceOnly';
export const WHEN_PASSCODE_SET_THIS_DEVICE_ONLY = 'whenPasscodeSetThisDeviceOnly';
export const WHEN_UNLOCKED = 'whenUnlocked';
export const WHEN_UNLOCKED_THIS_DEVICE_ONLY = 'whenUnlockedThisDeviceOnly';
