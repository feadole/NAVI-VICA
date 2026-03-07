import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Speech from 'expo-speech';
import Slider from '@react-native-community/slider';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface Settings {
  voice_speed: number;
  voice_pitch: number;
  language: string;
  alarm_sound: boolean;
  voice_guidance: boolean;
  warning_alerts: boolean;
  user_profile: string;
}

const languages = [
  { code: 'en-US', label: 'English (US)' },
  { code: 'en-GB', label: 'English (UK)' },
  { code: 'tr-TR', label: 'Turkish' },
  { code: 'ar-SA', label: 'Arabic' },
  { code: 'fr-FR', label: 'French' },
  { code: 'es-ES', label: 'Spanish' },
  { code: 'de-DE', label: 'German' },
];

const profiles = [
  { key: 'general', label: 'General', icon: 'person' },
  { key: 'mobility', label: 'Mobility Limited', icon: 'walk' },
  { key: 'vision', label: 'Vision Impaired', icon: 'eye' },
  { key: 'cognitive', label: 'Cognitive Support', icon: 'bulb' },
  { key: 'health', label: 'Health Monitor', icon: 'heart' },
];

export default function SettingsScreen() {
  const [settings, setSettings] = useState<Settings>({
    voice_speed: 1.0,
    voice_pitch: 1.0,
    language: 'en-US',
    alarm_sound: true,
    voice_guidance: true,
    warning_alerts: true,
    user_profile: 'general',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [currentTime, setCurrentTime] = useState('');

  useEffect(() => {
    loadSettings();
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const updateTime = () => {
    const now = new Date();
    setCurrentTime(now.toLocaleTimeString());
  };

  const loadSettings = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/settings`);
      if (response.ok) {
        const data = await response.json();
        setSettings(data);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const saveSettings = async (newSettings: Settings) => {
    setSettings(newSettings);
    setIsSaving(true);

    try {
      await fetch(`${BACKEND_URL}/api/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newSettings),
      });
    } catch (error) {
      console.error('Error saving settings:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const testVoice = () => {
    Speech.speak(
      'This is how I will sound with the current settings. You can adjust the speed and pitch to your preference.',
      {
        rate: settings.voice_speed,
        pitch: settings.voice_pitch,
        language: settings.language,
      }
    );
  };

  const updateSetting = (key: keyof Settings, value: any) => {
    const newSettings = { ...settings, [key]: value };
    saveSettings(newSettings);
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* User Profile */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="person-circle" size={24} color="#00D9FF" />
            <Text style={styles.sectionTitle}>User Profile</Text>
          </View>
          <Text style={styles.sectionDescription}>
            Select your profile for personalized assistance
          </Text>
          <View style={styles.profileGrid}>
            {profiles.map((profile) => (
              <TouchableOpacity
                key={profile.key}
                style={[
                  styles.profileOption,
                  settings.user_profile === profile.key && styles.profileOptionActive,
                ]}
                onPress={() => updateSetting('user_profile', profile.key)}
              >
                <Ionicons
                  name={profile.icon as any}
                  size={24}
                  color={settings.user_profile === profile.key ? '#00D9FF' : '#888'}
                />
                <Text
                  style={[
                    styles.profileOptionText,
                    settings.user_profile === profile.key &&
                      styles.profileOptionTextActive,
                  ]}
                >
                  {profile.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Speech Settings */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="volume-high" size={24} color="#D900FF" />
            <Text style={styles.sectionTitle}>Speech Settings</Text>
          </View>

          <View style={styles.sliderContainer}>
            <View style={styles.sliderHeader}>
              <Text style={styles.sliderLabel}>Voice Speed</Text>
              <Text style={styles.sliderValue}>{settings.voice_speed.toFixed(1)}x</Text>
            </View>
            <Slider
              style={styles.slider}
              minimumValue={0.5}
              maximumValue={2.0}
              step={0.1}
              value={settings.voice_speed}
              onSlidingComplete={(value) => updateSetting('voice_speed', value)}
              minimumTrackTintColor="#D900FF"
              maximumTrackTintColor="#333"
              thumbTintColor="#D900FF"
            />
          </View>

          <View style={styles.sliderContainer}>
            <View style={styles.sliderHeader}>
              <Text style={styles.sliderLabel}>Voice Pitch</Text>
              <Text style={styles.sliderValue}>{settings.voice_pitch.toFixed(1)}</Text>
            </View>
            <Slider
              style={styles.slider}
              minimumValue={0.5}
              maximumValue={2.0}
              step={0.1}
              value={settings.voice_pitch}
              onSlidingComplete={(value) => updateSetting('voice_pitch', value)}
              minimumTrackTintColor="#D900FF"
              maximumTrackTintColor="#333"
              thumbTintColor="#D900FF"
            />
          </View>

          <View style={styles.languageContainer}>
            <Text style={styles.sliderLabel}>Language</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {languages.map((lang) => (
                <TouchableOpacity
                  key={lang.code}
                  style={[
                    styles.languageOption,
                    settings.language === lang.code && styles.languageOptionActive,
                  ]}
                  onPress={() => updateSetting('language', lang.code)}
                >
                  <Text
                    style={[
                      styles.languageOptionText,
                      settings.language === lang.code &&
                        styles.languageOptionTextActive,
                    ]}
                  >
                    {lang.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <TouchableOpacity style={styles.testButton} onPress={testVoice}>
            <Ionicons name="play" size={20} color="#fff" />
            <Text style={styles.testButtonText}>Test Voice</Text>
          </TouchableOpacity>
        </View>

        {/* Notifications */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="notifications" size={24} color="#F44336" />
            <Text style={styles.sectionTitle}>Notifications</Text>
          </View>

          <View style={styles.switchRow}>
            <View style={styles.switchInfo}>
              <Text style={styles.switchLabel}>Alarm Sound</Text>
              <Text style={styles.switchDescription}>Play sound for reminders</Text>
            </View>
            <Switch
              value={settings.alarm_sound}
              onValueChange={(value) => updateSetting('alarm_sound', value)}
              trackColor={{ false: '#333', true: '#F4433644' }}
              thumbColor={settings.alarm_sound ? '#F44336' : '#666'}
            />
          </View>

          <View style={styles.switchRow}>
            <View style={styles.switchInfo}>
              <Text style={styles.switchLabel}>Voice Guidance</Text>
              <Text style={styles.switchDescription}>Speak scene descriptions</Text>
            </View>
            <Switch
              value={settings.voice_guidance}
              onValueChange={(value) => updateSetting('voice_guidance', value)}
              trackColor={{ false: '#333', true: '#4CAF5044' }}
              thumbColor={settings.voice_guidance ? '#4CAF50' : '#666'}
            />
          </View>

          <View style={styles.switchRow}>
            <View style={styles.switchInfo}>
              <Text style={styles.switchLabel}>Warning Alerts</Text>
              <Text style={styles.switchDescription}>5-minute warning before medications</Text>
            </View>
            <Switch
              value={settings.warning_alerts}
              onValueChange={(value) => updateSetting('warning_alerts', value)}
              trackColor={{ false: '#333', true: '#FF980044' }}
              thumbColor={settings.warning_alerts ? '#FF9800' : '#666'}
            />
          </View>
        </View>

        {/* Current Time */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="time" size={24} color="#00D9FF" />
            <Text style={styles.sectionTitle}>Current Time</Text>
          </View>
          <Text style={styles.currentTime}>{currentTime}</Text>
        </View>

        {/* About */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="information-circle" size={24} color="#888" />
            <Text style={styles.sectionTitle}>About NAVI-VICA</Text>
          </View>
          <Text style={styles.aboutText}>
            NAVI-VICA is your AI-powered accessibility navigator. Designed to assist
            people with mobility limitations, vision impairment, cognitive challenges,
            and health monitoring needs.
          </Text>
          <View style={styles.aboutDetails}>
            <View style={styles.aboutRow}>
              <Text style={styles.aboutLabel}>VERSION:</Text>
              <Text style={styles.aboutValue}>2.0.0</Text>
            </View>
            <View style={styles.aboutRow}>
              <Text style={styles.aboutLabel}>ENGINE:</Text>
              <Text style={styles.aboutValue}>YOLOv9 + Gemini AI</Text>
            </View>
            <View style={styles.aboutRow}>
              <Text style={styles.aboutLabel}>TTS:</Text>
              <Text style={styles.aboutValue}>Device Speech API</Text>
            </View>
          </View>
        </View>

        {/* Saving Indicator */}
        {isSaving && (
          <View style={styles.savingIndicator}>
            <Text style={styles.savingText}>Saving settings...</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f1e',
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 16,
  },
  section: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 10,
  },
  sectionDescription: {
    color: '#888',
    fontSize: 14,
    marginBottom: 12,
  },
  profileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  profileOption: {
    width: '48%',
    backgroundColor: '#2a2a4e',
    borderRadius: 12,
    padding: 14,
    margin: 4,
    alignItems: 'center',
  },
  profileOptionActive: {
    backgroundColor: '#1a3a5e',
    borderColor: '#00D9FF',
    borderWidth: 1,
  },
  profileOptionText: {
    color: '#888',
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
  },
  profileOptionTextActive: {
    color: '#00D9FF',
  },
  sliderContainer: {
    marginBottom: 16,
  },
  sliderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sliderLabel: {
    color: '#ccc',
    fontSize: 15,
  },
  sliderValue: {
    color: '#00D9FF',
    fontSize: 15,
    fontWeight: '600',
  },
  slider: {
    width: '100%',
    height: 40,
  },
  languageContainer: {
    marginBottom: 16,
  },
  languageOption: {
    backgroundColor: '#2a2a4e',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 10,
    marginTop: 10,
  },
  languageOptionActive: {
    backgroundColor: '#1a3a5e',
    borderColor: '#D900FF',
    borderWidth: 1,
  },
  languageOptionText: {
    color: '#888',
    fontSize: 13,
  },
  languageOptionTextActive: {
    color: '#D900FF',
  },
  testButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D900FF',
    borderRadius: 12,
    paddingVertical: 14,
  },
  testButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a4e',
  },
  switchInfo: {
    flex: 1,
  },
  switchLabel: {
    color: '#fff',
    fontSize: 15,
  },
  switchDescription: {
    color: '#666',
    fontSize: 12,
    marginTop: 2,
  },
  currentTime: {
    color: '#00D9FF',
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  aboutText: {
    color: '#888',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  aboutDetails: {
    backgroundColor: '#2a2a4e',
    borderRadius: 12,
    padding: 12,
  },
  aboutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  aboutLabel: {
    color: '#666',
    fontSize: 12,
  },
  aboutValue: {
    color: '#ccc',
    fontSize: 12,
  },
  savingIndicator: {
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: 24,
  },
  savingText: {
    color: '#00D9FF',
    fontSize: 12,
  },
});
