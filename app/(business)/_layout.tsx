import { Stack } from 'expo-router';

export default function BusinessLayout() {
  return (
    <Stack>
      <Stack.Screen 
        name="dashboard" 
        options={{ 
          headerShown: false,
          animation: 'fade',
        }} 
      />
      <Stack.Screen 
        name="register" 
        options={{ 
          headerShown: false,
          title: 'Register Business'
        }} 
      />
      <Stack.Screen 
        name="scan-customer" 
        options={{ 
          headerShown: false,
          presentation: 'modal'
        }} 
      />
    </Stack>
  );
}
