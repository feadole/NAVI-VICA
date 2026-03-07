import React, { useState, useEffect } from 'react';
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

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

// Cross-platform speech function
const speak = (text: string, rate: number = 0.9) => {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = rate;
    utterance.pitch = 1.0;
    utterance.lang = 'en-US';
    window.speechSynthesis.speak(utterance);
    console.log('Speaking:', text);
  } else {
    import('expo-speech').then(Speech => {
      Speech.speak(text, { rate, pitch: 1.0 });
    });
  }
};

const stopSpeaking = () => {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  } else {
    import('expo-speech').then(Speech => {
      Speech.stop();
    });
  }
};

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
    shouldShowBanner: true,
    shouldShowList: true,
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

  useEffect(() => {
    loadReminders();
    requestNotificationPermissions();
    
    // Speak welcome
    setTimeout(() => {
      speak('Medication reminders screen. You can add new reminders or test the alarm sound.');
    }, 500);
  }, []);

  const requestNotificationPermissions = async () => {
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Notification permission is needed for medication reminders to work properly.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error requesting notification permissions:', error);
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
      console.error('Error loading reminders:', error);
    }
  };

  const scheduleNotification = async (reminder: Reminder) => {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '💊 Medication Reminder',
          body: `Time to take ${reminder.name}`,
          sound: true,
          priority: Notifications.AndroidNotificationPriority.HIGH,
        },
        trigger: {
          hour: reminder.hour,
          minute: reminder.minute,
          repeats: reminder.repeat_daily,
        },
      });
    } catch (error) {
      console.error('Error scheduling notification:', error);
    }
  };

  const addReminder = async () => {
    if (!newMedName.trim()) {
      speak('Please enter a medication name');
      Alert.alert('Error', 'Please enter a medication name');
      return;
    }

    const hour = parseInt(newHour) || 0;
    const minute = parseInt(newMinute) || 0;

    if (hour < 0 || hour > 23) {
      speak('Hour must be between 0 and 23');
      Alert.alert('Error', 'Hour must be between 0 and 23');
      return;
    }

    if (minute < 0 || minute > 59) {
      speak('Minute must be between 0 and 59');
      Alert.alert('Error', 'Minute must be between 0 and 59');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`${BACKEND_URL}/api/reminders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
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
        await scheduleNotification(newReminder);

        // Clear form
        setNewMedName('');
        setNewHour('');
        setNewMinute('');
        setRepeatDaily(true);

        const timeStr = formatTime(hour, minute);
        speak(`Reminder set successfully for ${newReminder.name} at ${timeStr}`);
      } else {
        throw new Error('Failed to create reminder');
      }
    } catch (error) {
      console.error('Error adding reminder:', error);
      speak('Failed to create reminder. Please try again.');
      Alert.alert('Error', 'Failed to create reminder');
    } finally {
      setIsLoading(false);
    }
  };

  const deleteReminder = async (id: string, name: string) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/reminders/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setReminders((prev) => prev.filter((r) => r.id !== id));
        speak(`Reminder for ${name} deleted`);
      }
    } catch (error) {
      console.error('Error deleting reminder:', error);
    }
  };

  const toggleReminder = async (id: string, name: string) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/reminders/${id}/toggle`, {
        method: 'PUT',
      });

      if (response.ok) {
        const result = await response.json();
        setReminders((prev) =>
          prev.map((r) => (r.id === id ? { ...r, enabled: result.enabled } : r))
        );
        speak(`Reminder for ${name} ${result.enabled ? 'enabled' : 'disabled'}`);
      }
    } catch (error) {
      console.error('Error toggling reminder:', error);
    }
  };

  const testAlarm = async () => {
    setIsAlarmPlaying(true);
    
    // Vibrate
    if (Platform.OS !== 'web') {
      Vibration.vibrate([0, 500, 200, 500, 200, 500], false);
    }
    
    // Speak the alarm message loudly and clearly
    speak(
      'ATTENTION! MEDICATION REMINDER! It is time to take your medication. This is your medication alarm. Please take your medicine now.',
      0.85
    );
    
    // Auto stop after 10 seconds
    setTimeout(() => {
      setIsAlarmPlaying(false);
    }, 10000);
  };

  const stopAlarm = () => {
    if (Platform.OS !== 'web') {
      Vibration.cancel();
    }
    stopSpeaking();
    setIsAlarmPlaying(false);
  };

  const formatTime = (hour: number, minute: number) => {
    const h = hour % 12 || 12;
    const m = minute.toString().padStart(2, '0');
    const ampm = hour < 12 ? 'AM' : 'PM';
    return `${h}:${m} ${ampm}`;
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={100}
      >
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Add Reminder Form */}
          <View style={styles.formSection}>
            <View style={styles.sectionHeader}>
              <Ionicons name="add-circle" size={24} color="#00D9FF" />
              <Text style={styles.sectionTitle}>Add Reminder</Text>
            </View>

            <TextInput
              style={styles.input}
              placeholder="Medication Name (e.g., Aspirin)"
              placeholderTextColor="#666"
              value={newMedName}
              onChangeText={setNewMedName}
              accessibilityLabel="Medication name input"
            />

            <View style={styles.timeInputRow}>
              <View style={styles.timeInputContainer}>
                <Text style={styles.timeLabel}>Hour (0-23)</Text>
                <TextInput
                  style={styles.timeInput}
                  placeholder="8"
                  placeholderTextColor="#666"
                  value={newHour}
                  onChangeText={setNewHour}
                  keyboardType="numeric"
                  maxLength={2}
                  accessibilityLabel="Hour input"
                />
              </View>
              <Text style={styles.timeSeparator}>:</Text>
              <View style={styles.timeInputContainer}>
                <Text style={styles.timeLabel}>Minute (0-59)</Text>
                <TextInput
                  style={styles.timeInput}
                  placeholder="00"
                  placeholderTextColor="#666"
                  value={newMinute}
                  onChangeText={setNewMinute}
                  keyboardType="numeric"
                  maxLength={2}
                  accessibilityLabel="Minute input"
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
                accessibilityLabel="Repeat daily toggle"
              />
            </View>

            <TouchableOpacity
              style={[styles.addButton, isLoading && styles.addButtonDisabled]}
              onPress={addReminder}
              disabled={isLoading}
              accessibilityLabel="Set reminder button"
            >
              <Ionicons name="checkmark" size={20} color="#fff" />
              <Text style={styles.addButtonText}>SET REMINDER</Text>
            </TouchableOpacity>
          </View>

          {/* Test Alarm */}
          <View style={styles.testSection}>
            <View style={styles.sectionHeader}>
              <Ionicons name="notifications" size={24} color="#F44336" />
              <Text style={styles.sectionTitle}>Test Alarm</Text>
            </View>
            <Text style={styles.testDescription}>
              Test the alarm to ensure it's loud and clear. This will speak the alarm message.
            </Text>
            <TouchableOpacity
              style={[styles.testButton, isAlarmPlaying && styles.testButtonActive]}
              onPress={isAlarmPlaying ? stopAlarm : testAlarm}
              accessibilityLabel={isAlarmPlaying ? "Stop alarm" : "Test alarm"}
            >
              <Ionicons
                name={isAlarmPlaying ? 'stop-circle' : 'volume-high'}
                size={24}
                color={isAlarmPlaying ? '#fff' : '#F44336'}
              />
              <Text style={[styles.testButtonText, isAlarmPlaying && styles.testButtonTextActive]}>
                {isAlarmPlaying ? 'STOP ALARM' : 'PLAY ALARM SOUND'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Active Reminders */}
          <View style={styles.remindersSection}>
            <View style={styles.sectionHeader}>
              <Ionicons name="medical" size={24} color="#4CAF50" />
              <Text style={styles.sectionTitle}>
                Active Reminders ({reminders.length})
              </Text>
            </View>

            {reminders.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="medical-outline" size={48} color="#333" />
                <Text style={styles.emptyStateText}>No reminders set yet</Text>
                <Text style={styles.emptyStateSubtext}>Add a reminder above to get started</Text>
              </View>
            ) : (
              reminders.map((reminder) => (
                <View
                  key={reminder.id}
                  style={[
                    styles.reminderCard,
                    !reminder.enabled && styles.reminderCardDisabled,
                  ]}
                >
                  <View style={styles.reminderInfo}>
                    <Text style={styles.reminderName}>{reminder.name}</Text>
                    <View style={styles.reminderTimeRow}>
                      <Ionicons name="time-outline" size={16} color="#888" />
                      <Text style={styles.reminderTime}>
                        {formatTime(reminder.hour, reminder.minute)}
                      </Text>
                      {reminder.repeat_daily && (
                        <View style={styles.repeatBadge}>
                          <Ionicons name="repeat" size={12} color="#00D9FF" />
                          <Text style={styles.repeatText}>Daily</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <View style={styles.reminderActions}>
                    <Switch
                      value={reminder.enabled}
                      onValueChange={() => toggleReminder(reminder.id, reminder.name)}
                      trackColor={{ false: '#333', true: '#4CAF5044' }}
                      thumbColor={reminder.enabled ? '#4CAF50' : '#666'}
                    />
                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={() =>
                        Alert.alert(
                          'Delete Reminder',
                          `Delete reminder for ${reminder.name}?`,
                          [
                            { text: 'Cancel', style: 'cancel' },
                            {
                              text: 'Delete',
                              style: 'destructive',
                              onPress: () => deleteReminder(reminder.id, reminder.name),
                            },
                          ]
                        )
                      }
                    >
                      <Ionicons name="trash-outline" size={20} color="#F44336" />
                    </TouchableOpacity>
                  </View>
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
  container: {
    flex: 1,
    backgroundColor: '#0f0f1e',
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 16,
  },
  formSection: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 10,
  },
  input: {
    backgroundColor: '#2a2a4e',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#fff',
    fontSize: 16,
    marginBottom: 12,
  },
  timeInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  timeInputContainer: {
    alignItems: 'center',
  },
  timeLabel: {
    color: '#888',
    fontSize: 12,
    marginBottom: 6,
  },
  timeInput: {
    backgroundColor: '#2a2a4e',
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 14,
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    width: 80,
  },
  timeSeparator: {
    color: '#fff',
    fontSize: 32,
    fontWeight: 'bold',
    marginHorizontal: 12,
    marginTop: 16,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#2a2a4e',
  },
  switchLabel: {
    color: '#ccc',
    fontSize: 16,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 8,
  },
  addButtonDisabled: {
    backgroundColor: '#333',
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  testSection: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
  },
  testDescription: {
    color: '#888',
    fontSize: 14,
    marginBottom: 12,
    lineHeight: 20,
  },
  testButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2a1a1e',
    borderRadius: 12,
    paddingVertical: 16,
    borderWidth: 2,
    borderColor: '#F44336',
  },
  testButtonActive: {
    backgroundColor: '#F44336',
  },
  testButtonText: {
    color: '#F44336',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 10,
  },
  testButtonTextActive: {
    color: '#fff',
  },
  remindersSection: {
    marginTop: 16,
    marginBottom: 24,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
  },
  emptyStateText: {
    color: '#666',
    fontSize: 16,
    marginTop: 12,
  },
  emptyStateSubtext: {
    color: '#444',
    fontSize: 13,
    marginTop: 4,
  },
  reminderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
  },
  reminderCardDisabled: {
    opacity: 0.5,
  },
  reminderInfo: {
    flex: 1,
  },
  reminderName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  reminderTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  reminderTime: {
    color: '#888',
    fontSize: 14,
    marginLeft: 6,
  },
  repeatBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#00D9FF22',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 10,
  },
  repeatText: {
    color: '#00D9FF',
    fontSize: 11,
    marginLeft: 4,
  },
  reminderActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deleteButton: {
    padding: 8,
    marginLeft: 8,
  },
});
