import React, {useEffect} from 'react';
import {StatusBar, StyleSheet} from 'react-native';
import {NavigationContainer, DefaultTheme} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {SafeAreaProvider} from 'react-native-safe-area-context';

import CheckInScreen from './src/screens/CheckInScreen';
import RouteMapScreen from './src/screens/RouteMapScreen';
import {initBackgroundSync} from './src/services/backgroundSync';
import {queueStore} from './src/services/queueStore';

export type RootStackParamList = {
  CheckIn: undefined;
  RouteMap: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: '#f5f7f8',
    primary: '#1d6f61',
  },
};

function App(): React.JSX.Element {
  useEffect(() => {
    queueStore.hydrate().catch(() => undefined);
    initBackgroundSync();
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" backgroundColor="#f5f7f8" />
      <NavigationContainer theme={theme}>
        <Stack.Navigator
          screenOptions={{
            headerStyle: styles.header,
            headerTitleStyle: styles.headerTitle,
            headerShadowVisible: false,
          }}>
          <Stack.Screen
            name="CheckIn"
            component={CheckInScreen}
            options={{title: 'Field Check-In'}}
          />
          <Stack.Screen
            name="RouteMap"
            component={RouteMapScreen}
            options={{title: 'Live Route'}}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: '#f5f7f8',
  },
  headerTitle: {
    color: '#14322e',
    fontWeight: '700',
  },
});

export default App;
