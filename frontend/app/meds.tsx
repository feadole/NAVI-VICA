import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Switch,
  Alert,
  Platform,
  KeyboardAvoidingView,
  Vibration,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import * as Speech from 'expo-speech';
import { Audio } from 'expo-av';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface Reminder {
  id: string;
  name: string;
  hour: number;
  minute: number;
  repeat_daily: boolean;
  enabled: boolean;
}

// Configure notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export default function MedsScreen() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [newMedName, setNewMedName] = useState('');
  const [newHour, setNewHour] = useState('');
  const [newMinute, setNewMinute] = useState('');
  const [repeatDaily, setRepeatDaily] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isAlarmPlaying, setIsAlarmPlaying] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const alarmIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Configure audio on mount
  useEffect(() => {
    const setupAudio = async () => {
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          allowsRecordingIOS: false,
          staysActiveInBackground: true,
        });
      } catch (e) {
        console.log('Audio setup error:', e);
      }
    };
    setupAudio();
    loadReminders();
    requestNotificationPermissions();
    
    // Welcome
    setTimeout(() => {
      speak('Medication reminders. Add new reminders or test the alarm sound.');
    }, 1000);
    
    return () => {
      if (alarmIntervalRef.current) clearInterval(alarmIntervalRef.current);
      Speech.stop();
    };
  }, []);

  const speak = async (text: string) => {
    try {
      // CRITICAL: Set audio mode before speaking
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        allowsRecordingIOS: false,
        staysActiveInBackground: true,
      });
      
      await Speech.stop();
      setIsSpeaking(true);
      
      Speech.speak(text, {
        language: 'en-US',
        pitch: 1.0,
        rate: 0.9,
        onStart: () => console.log('Speech started'),
        onDone: () => {
          console.log('Speech done');
          setIsSpeaking(false);
        },
        onStopped: () => setIsSpeaking(false),
        onError: (error) => {
          console.log('Speech error:', error);
          setIsSpeaking(false);
        },
      });
    } catch (error) {
      console.error('Speak error:', error);
      setIsSpeaking(false);
    }
  };

  const requestNotificationPermissions = async () => {
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Notifications needed for reminders.');
      }
    } catch (error) {
      console.error('Permission error:', error);
    }
  };

  const loadReminders = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/reminders`);
      if (response.ok) {
        const data = await response.json();
        setReminders(data);
      }
    } catch (error) {
      console.error('Load reminders error:', error);
    }
  };

  const addReminder = async () => {
    if (!newMedName.trim()) {
      speak('Please enter a medication name.');
      Alert.alert('Error', 'Please enter a medication name');
      return;
    }

    const hour = parseInt(newHour) || 0;
    const minute = parseInt(newMinute) || 0;

    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
      speak('Invalid time. Hour must be 0 to 23, minute must be 0 to 59.');
      Alert.alert('Error', 'Invalid time');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`${BACKEND_URL}/api/reminders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newMedName.trim(),
          hour,
          minute,
          repeat_daily: repeatDaily,
        }),
      });

      if (response.ok) {
        const newReminder = await response.json();
        setReminders((prev) => [...prev, newReminder]);

        setNewMedName('');
        setNewHour('');
        setNewMinute('');
        setRepeatDaily(true);

        const timeStr = formatTime(hour, minute);
        speak(`Reminder set for ${newReminder.name} at ${timeStr}.`);
      } else {
        throw new Error('Failed');
      }
    } catch (error) {
      speak('Failed to create reminder.');
      Alert.alert('Error', 'Failed to create reminder');
    } finally {
      setIsLoading(false);
    }
  };

  const deleteReminder = async (id: string, name: string) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/reminders/${id}`, { method: 'DELETE' });
      if (response.ok) {
        setReminders((prev) => prev.filter((r) => r.id !== id));
        speak(`Reminder for ${name} deleted.`);
      }
    } catch (error) {
      console.error('Delete error:', error);
    }
  };

  const toggleReminder = async (id: string, name: string) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/reminders/${id}/toggle`, { method: 'PUT' });
      if (response.ok) {
        const result = await response.json();
        setReminders((prev) => prev.map((r) => (r.id === id ? { ...r, enabled: result.enabled } : r)));
        speak(`${name} ${result.enabled ? 'enabled' : 'disabled'}.`);
      }
    } catch (error) {
      console.error('Toggle error:', error);
    }
  };

  const testAlarm = async () => {
    setIsAlarmPlaying(true);
    
    // Vibrate
    Vibration.vibrate([0, 1000, 500, 1000, 500, 1000], false);
    
    // CRITICAL: Set audio mode for alarm
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      allowsRecordingIOS: false,
      staysActiveInBackground: true,
    });
    
    // Speak alarm - THIS IS THE MAIN SOUND
    Speech.speak(
      'ATTENTION! MEDICATION REMINDER! Time to take your medication! Please take your medicine now!',
      {
        language: 'en-US',
        pitch: 1.2,
        rate: 0.8,
        onDone: () => {
          // Repeat alarm
          let count = 0;
          alarmIntervalRef.current = setInterval(() => {
            if (count < 2 && isAlarmPlaying) {
              Speech.speak('ATTENTION! Time for medication!', {
                language: 'en-US',
                pitch: 1.2,
                rate: 0.8,
              });
              count++;
            } else {
              stopAlarm();
            }
          }, 3000);
        },
      }
    );
  };

  const stopAlarm = () => {
    setIsAlarmPlaying(false);
    Speech.stop();
    Vibration.cancel();
    if (alarmIntervalRef.current) {
      clearInterval(alarmIntervalRef.current);
      alarmIntervalRef.current = null;
    }
    speak('Alarm stopped.');
  };

  const formatTime = (hour: number, minute: number) => {
    const h = hour % 12 || 12;
    const m = minute.toString().padStart(2, '0');
    const ampm = hour < 12 ? 'AM' : 'PM';
    return `${h}:${m} ${ampm}`;
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={100}>
        <ScrollView style={styles.scrollView}>
          {/* Speaking Indicator */}
          {(isSpeaking || isAlarmPlaying) && (
            <View style={[styles.speakingBanner, isAlarmPlaying && styles.alarmBanner]}>
              <Ionicons name={isAlarmPlaying ? 'notifications' : 'volume-high'} size={24} color="#fff" />
              <Text style={styles.speakingText}>{isAlarmPlaying ? 'ALARM PLAYING!' : 'SPEAKING...'}</Text>
              <TouchableOpacity onPress={isAlarmPlaying ? stopAlarm : () => Speech.stop()} style={styles.stopBtn}>
                <Ionicons name="stop" size={20} color={isAlarmPlaying ? '#fff' : '#F44336'} />
              </TouchableOpacity>
            </View>
          )}

          {/* Add Reminder */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              <Ionicons name="add-circle" size={20} color="#00D9FF" /> Add Reminder
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Medication Name (e.g., Aspirin)"
              placeholderTextColor="#666"
              value={newMedName}
              onChangeText={setNewMedName}
            />

            <View style={styles.timeRow}>
              <View style={styles.timeBox}>
                <Text style={styles.timeLabel}>Hour (0-23)</Text>
                <TextInput
                  style={styles.timeInput}
                  placeholder="8"
                  placeholderTextColor="#666"
                  value={newHour}
                  onChangeText={setNewHour}
                  keyboardType="numeric"
                  maxLength={2}
                />
              </View>
              <Text style={styles.timeSeparator}>:</Text>
              <View style={styles.timeBox}>
                <Text style={styles.timeLabel}>Minute (0-59)</Text>
                <TextInput
                  style={styles.timeInput}
                  placeholder="00"
                  placeholderTextColor="#666"
                  value={newMinute}
                  onChangeText={setNewMinute}
                  keyboardType="numeric"
                  maxLength={2}
                />
              </View>
            </View>

            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Repeat Daily</Text>
              <Switch
                value={repeatDaily}
                onValueChange={setRepeatDaily}
                trackColor={{ false: '#333', true: '#00D9FF44' }}
                thumbColor={repeatDaily ? '#00D9FF' : '#666'}
              />
            </View>

            <TouchableOpacity style={styles.addBtn} onPress={addReminder} disabled={isLoading}>
              <Ionicons name="checkmark-circle" size={24} color="#fff" />
              <Text style={styles.addBtnText}>SET REMINDER</Text>
            </TouchableOpacity>
          </View>

          {/* Test Alarm */}
          <View style={[styles.card, styles.alarmCard]}>
            <Text style={styles.cardTitle}>
              <Ionicons name="megaphone" size={20} color="#F44336" /> Test Alarm
            </Text>
            <Text style={styles.alarmNote}>Make sure your VOLUME is UP! Sound works even in silent mode.</Text>
            <TouchableOpacity
              style={[styles.alarmBtn, isAlarmPlaying && styles.alarmBtnActive]}
              onPress={isAlarmPlaying ? stopAlarm : testAlarm}
            >
              <Ionicons name={isAlarmPlaying ? 'stop-circle' : 'volume-high'} size={36} color="#fff" />
              <Text style={styles.alarmBtnText}>{isAlarmPlaying ? 'STOP ALARM' : 'TEST ALARM'}</Text>
            </TouchableOpacity>
          </View>

          {/* Reminders List */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              <Ionicons name="medical" size={20} color="#4CAF50" /> Reminders ({reminders.length})
            </Text>
            {reminders.length === 0 ? (
              <Text style={styles.emptyText}>No reminders yet. Add one above!</Text>
            ) : (
              reminders.map((r) => (
                <View key={r.id} style={[styles.reminderItem, !r.enabled && styles.reminderDisabled]}>
                  <View style={styles.reminderInfo}>
                    <Text style={styles.reminderName}>{r.name}</Text>
                    <Text style={styles.reminderTime}>{formatTime(r.hour, r.minute)} {r.repeat_daily && '• Daily'}</Text>
                  </View>
                  <Switch
                    value={r.enabled}
                    onValueChange={() => toggleReminder(r.id, r.name)}
                    trackColor={{ false: '#333', true: '#4CAF5044' }}
                    thumbColor={r.enabled ? '#4CAF50' : '#666'}
                  />
                  <TouchableOpacity onPress={() => Alert.alert('Delete?', `Delete ${r.name}?`, [
                    { text: 'Cancel' },
                    { text: 'Delete', style: 'destructive', onPress: () => deleteReminder(r.id, r.name) },
                  ])}>
                    <Ionicons name="trash" size={24} color="#F44336" />
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f1e' },
  flex: { flex: 1 },
  scrollView: { flex: 1, padding: 16 },
  speakingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#00D9FF',
    padding: 14,
    borderRadius: 12,
    marginBottom: 16,
  },
  alarmBanner: { backgroundColor: '#F44336' },
  speakingText: { color: '#fff', marginLeft: 10, flex: 1, fontWeight: 'bold', fontSize: 16 },
  stopBtn: { backgroundColor: '#fff', padding: 8, borderRadius: 20 },
  card: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  alarmCard: { backgroundColor: '#2a1a1e', borderWidth: 2, borderColor: '#F44336' },
  cardTitle: { color: '#fff', fontSize: 18, fontWeight: '600', marginBottom: 16 },
  input: {
    backgroundColor: '#2a2a4e',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#fff',
    fontSize: 16,
    marginBottom: 12,
  },
  timeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  timeBox: { alignItems: 'center' },
  timeLabel: { color: '#888', fontSize: 12, marginBottom: 6 },
  timeInput: {
    backgroundColor: '#2a2a4e',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    width: 80,
  },
  timeSeparator: { color: '#fff', fontSize: 36, fontWeight: 'bold', marginHorizontal: 12 },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#2a2a4e',
  },
  switchLabel: { color: '#ccc', fontSize: 16 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    paddingVertical: 16,
    marginTop: 8,
  },
  addBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginLeft: 8 },
  alarmNote: { color: '#F44336', fontSize: 14, marginBottom: 12, fontWeight: '500' },
  alarmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F44336',
    borderRadius: 12,
    paddingVertical: 20,
  },
  alarmBtnActive: { backgroundColor: '#B71C1C' },
  alarmBtnText: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginLeft: 12 },
  emptyText: { color: '#666', textAlign: 'center', paddingVertical: 20 },
  reminderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a4e',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  reminderDisabled: { opacity: 0.5 },
  reminderInfo: { flex: 1 },
  reminderName: { color: '#fff', fontSize: 16, fontWeight: '600' },
  reminderTime: { color: '#888', fontSize: 14, marginTop: 4 },
});
