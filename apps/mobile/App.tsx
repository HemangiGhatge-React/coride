import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import SplashScreen from './src/screens/SplashScreen/splashScreen';
import OnboardingOne from './src/screens/OnboardingOne';
import OnboardingTwo from './src/screens/OnboardingTwo';
import AuthScreen from './src/screens/AuthScreen';
import HomeScreen from './src/screens/HomeScreen';
import RideDetailScreen from './src/screens/RideDetailScreen';
import PostRideScreen from './src/screens/PostRideScreen';
import TripsScreen from './src/screens/TripsScreen';

export type RootStackParamList = {
  Splash: undefined;
  OnboardingOne: undefined;
  OnboardingTwo: undefined;
  Auth: undefined;
  Home: undefined;
  RideDetail: { rideId: string };
  PostRide: undefined;
  Trips: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Splash" screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Splash" component={SplashScreen} />
        <Stack.Screen name="OnboardingOne" component={OnboardingOne} />
        <Stack.Screen name="OnboardingTwo" component={OnboardingTwo} />
        <Stack.Screen name="Auth" component={AuthScreen} />
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="RideDetail" component={RideDetailScreen} />
        <Stack.Screen name="PostRide" component={PostRideScreen} />
        <Stack.Screen name="Trips" component={TripsScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}