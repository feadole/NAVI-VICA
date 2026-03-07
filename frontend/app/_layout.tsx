import React, { useEffect } from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform, Alert } from 'react-native';
import { Audio } from 'expo-av';

export default function TabLayout() {
  // CRITICAL: Configure audio to work in iOS Silent Mode
  useEffect(() => {
    const setupAudio = async () => {
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          allowsRecordingIOS: true,
          staysActiveInBackground: false,
        });
        console.log('Audio configured for iOS silent mode');
      } catch (error) {
        console.error('Failed to configure audio:', error);
      }
    };
    
    setupAudio();
  }, []);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#00D9FF',
        tabBarInactiveTintColor: '#888',
        tabBarStyle: {
          backgroundColor: '#1a1a2e',
          borderTopColor: '#2a2a4e',
          height: Platform.OS === 'ios' ? 88 : 70,
          paddingBottom: Platform.OS === 'ios' ? 28 : 10,
          paddingTop: 10,
        },
        headerStyle: {
          backgroundColor: '#0f0f1e',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={size} color={color} />
          ),
          headerTitle: 'NAVI-VICA',
        }}
      />
      <Tabs.Screen
        name="camera"
        options={{
          title: 'Camera',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="camera" size={size} color={color} />
          ),
          headerTitle: 'Scene Analysis',
        }}
      />
      <Tabs.Screen
        name="voice"
        options={{
          title: 'Voice',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="mic" size={size} color={color} />
          ),
          headerTitle: 'Voice Commands',
        }}
      />
      <Tabs.Screen
        name="meds"
        options={{
          title: 'Meds',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="medical" size={size} color={color} />
          ),
          headerTitle: 'Medication Reminders',
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings" size={size} color={color} />
          ),
          headerTitle: 'Settings',
        }}
      />
    </Tabs>
  );
}
