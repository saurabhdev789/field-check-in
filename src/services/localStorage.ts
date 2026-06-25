import {createMMKV} from 'react-native-mmkv';

export const localStorage = createMMKV({
  id: 'field-agent-storage',
});
