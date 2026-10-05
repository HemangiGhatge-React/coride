import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import SplashScreen from './src/screens/SplashScreen';
import OnboardingOne from './src/screens/OnboardingOne';
import OnboardingTwo from './src/screens/OnboardingTwo';
import Login from './src/screens/Login';
import Signup from './src/screens/Signup';
import Home from './src/screens/Home';
import { AuthProvider, useAuth } from './src/auth/AuthContext';
// import RideDetailScreen from './src/screens/RideDetailScreen';
// import PostRideScreen from './src/screens/PostRideScreen';
// import TripsScreen from './src/screens/TripsScreen';

export type RootStackParamList = {
  Splash: undefined;
  OnboardingOne: undefined;
  OnboardingTwo: undefined;
  Auth: undefined;
  Signup: undefined;
  Home: undefined;
  RideDetail: { rideId: string };
  PostRide: undefined;
  Trips: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

function RootNavigator() {
  const { state } = useAuth();

  if (state.status === 'loading') return null; // or a loading spinner

  // Signed-in and signed-out users get different screen sets, so a session
  // expiring anywhere swaps the stack to Auth instead of leaving a dead screen.
  if (state.status === 'signedIn') {
    return (
      <Stack.Navigator key="app" initialRouteName="Home" screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Home" component={Home} />
        {/* <Stack.Screen name="RideDetail" component={RideDetailScreen} />
        <Stack.Screen name="PostRide" component={PostRideScreen} />
        <Stack.Screen name="Trips" component={TripsScreen} /> */}
      </Stack.Navigator>
    );
  }

  // Only first-time users see splash + onboarding; expired/logged-out users go straight to login.
  return (
    <Stack.Navigator
      key={`auth-${state.reason}`}
      initialRouteName={state.reason === 'fresh' ? 'Splash' : 'Auth'}
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="Splash" component={SplashScreen} />
      <Stack.Screen name="OnboardingOne" component={OnboardingOne} />
      <Stack.Screen name="OnboardingTwo" component={OnboardingTwo} />
      <Stack.Screen name="Auth" component={Login} />
      <Stack.Screen name="Signup" component={Signup} />
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <NavigationContainer>
        <RootNavigator />
      </NavigationContainer>
    </AuthProvider>
  );
}
