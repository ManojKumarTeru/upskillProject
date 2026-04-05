import { useState, useEffect, createContext, useContext } from 'react';
import { Platform } from 'react-native';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { useRouter, useSegments } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

type AuthContextType = {
  session: Session | null;
  user: User | null;
  profile: any | null;
  initialized: boolean;
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: null,
  initialized: false,
});

export const useAuth = () => useContext(AuthContext);

// SILENT SESSION SYNC Logic
async function registerForPushNotificationsAsync() {
  if (Platform.OS === 'web') return null;
  
  // Note: On simulators, Device.isDevice is false, and push tokens may fail.
  if (!Device.isDevice) {
    console.log('📱 Session Sync: Must use physical device for Push Tokens.');
    return 'simulated-token-for-dev';
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  
  if (finalStatus !== 'granted') {
    console.warn('📱 Session Sync: Failed to get push token for notifications!');
    return null;
  }

  try {
    const token = (await Notifications.getExpoPushTokenAsync({
      projectId: Constants.expoConfig?.extra?.eas?.projectId || 'dummy-project-id',
    })).data;
    return token;
  } catch (err: any) {
    // FALLBACK for Zero-Cost Development:
    // If Firebase is not initialized (google-services.json missing), provide a mock token.
    if (err.message.includes('FirebaseApp is not initialized')) {
      console.warn('📱 Session Sync: Firebase not ready. Using Developer Mock Token.');
      return `dev-token-${Device.osBuildId || 'unknown'}`;
    }
    throw err;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [initialized, setInitialized] = useState(false);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    // Check active session on initial load
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setInitialized(true);
    });

    // Listen to changes in auth state (login/logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Fetch Profile when Session changes
  useEffect(() => {
    if (session?.user) {
      const fetchProfile = async () => {
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .maybeSingle();
        
        if (!error && data) {
          setProfile(data);
        }
      };
      fetchProfile();
    } else {
      setProfile(null);
    }
  }, [session?.user?.id]);

  // Sync Device Session to PostgreSQL
  useEffect(() => {
    if (session?.user) {
      const syncSession = async () => {
        try {
          const token = await registerForPushNotificationsAsync();
          if (!token) return;

          const deviceType = Platform.OS === 'ios' ? 'ios' : (Platform.OS === 'android' ? 'android' : 'web');
          
          const { error } = await supabase
            .from('user_sessions')
            .upsert({
              user_id: session.user.id,
              device_token: token,
              device_type: deviceType,
              last_seen: new Date().toISOString(),
              meta: {
                modelName: Device.modelName,
                deviceName: Device.deviceName,
                osName: Device.osName,
                osVersion: Device.osVersion,
                appVersion: Constants.expoConfig?.version,
              }
            }, { onConflict: 'device_token' });

          if (error) {
            console.error('📱 Session Sync Error:', error.message);
          } else {
            console.log('📱 Session Sync: Active Device registered successfully.');
          }
        } catch (err) {
          console.error('📱 Session Sync Fatal:', err);
        }
      };

      syncSession();
    }
  }, [session?.user?.id]);

  // Routing and Access Control
  useEffect(() => {
    if (!initialized) return;
    const inAuthGroup = segments[0] === '(auth)';
    
    // Auth redirect disabled during local UI development for flexibility
    /*
    if (!session && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (session && inAuthGroup) {
      router.replace('/(tabs)');
    }
    */
  }, [session, initialized, segments]);

  if (!initialized) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a' }}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, profile, initialized }}>
      {children}
    </AuthContext.Provider>
  );
}
