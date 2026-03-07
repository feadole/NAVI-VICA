import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Speech from 'expo-speech';
import { Audio } from 'expo-av';
import { useRouter } from 'expo-router';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface Message {
  id: string;
  type: 'user' | 'assistant';
  text: string;
  timestamp: Date;
}

export default function VoiceScreen() {
  const router = useRouter();
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'assistant',
      text: "Hello! I'm NAVI-VICA, your personal navigator. Upload a photo and I'll guide you, or speak to me — I'm listening!",
      timestamp: new Date(),
    },
  ]);
  const [lastResponse, setLastResponse] = useState('');
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    requestAudioPermissions();
    // Speak welcome message
    speakText("Hello! I'm NAVI-VICA, your personal navigator. How can I help you today?");
    
    return () => {
      if (recording) {
        recording.stopAndUnloadAsync();
      }
    };
  }, []);

  const speakText = (text: string) => {
    setIsSpeaking(true);
    Speech.speak(text, {
      rate: 0.9,
      pitch: 1.0,
      onDone: () => setIsSpeaking(false),
      onStopped: () => setIsSpeaking(false),
      onError: () => setIsSpeaking(false),
    });
  };

  const requestAudioPermissions = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status === 'granted') {
        setPermissionGranted(true);
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        });
      } else {
        Alert.alert(
          'Permission Required',
          'Microphone permission is needed for voice commands. Please enable it in settings.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error requesting audio permissions:', error);
    }
  };

  const startListening = async () => {
    if (!permissionGranted) {
      await requestAudioPermissions();
      return;
    }

    try {
      setIsListening(true);
      speakText('I am listening. Speak now.');
      
      // Small delay to let the speech finish
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(newRecording);
    } catch (error) {
      console.error('Failed to start recording:', error);
      setIsListening(false);
      speakText('Sorry, I could not start listening. Please try typing your command.');
    }
  };

  const stopListening = async () => {
    try {
      setIsListening(false);
      
      if (recording) {
        await recording.stopAndUnloadAsync();
        const uri = recording.getURI();
        setRecording(null);
        
        // Since we don't have speech-to-text API, prompt user to type
        speakText('Recording stopped. Please type your command in the text box below, or try the quick command buttons.');
      }
    } catch (error) {
      console.error('Failed to stop recording:', error);
    }
  };

  const processCommand = async (text: string) => {
    if (!text.trim()) {
      speakText('Please enter a command.');
      return;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      text: text.trim(),
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    Keyboard.dismiss();
    setIsProcessing(true);
    
    // Speak that we're processing
    speakText('Processing your command.');

    try {
      const response = await fetch(`${BACKEND_URL}/api/process-voice`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text.trim(),
          context: 'voice_assistant',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to process command');
      }

      const result = await response.json();
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        text: result.response_text,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setLastResponse(result.response_text);

      // ALWAYS speak the response
      speakText(result.response_text);

      // Handle actions
      if (result.action) {
        setTimeout(() => {
          switch (result.action) {
            case 'open_camera':
              speakText('Opening camera for scene analysis.');
              router.push('/camera');
              break;
            case 'open_meds':
              speakText('Opening medication reminders.');
              router.push('/meds');
              break;
            case 'open_settings':
              speakText('Opening settings.');
              router.push('/settings');
              break;
          }
        }, 3000);
      }
    } catch (error) {
      console.error('Error processing command:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        text: "I'm sorry, I couldn't process that command. Please try again.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      speakText("I'm sorry, I couldn't process that command. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const speakLastResponse = () => {
    if (lastResponse) {
      speakText(lastResponse);
    } else {
      speakText('No previous response to play.');
    }
  };

  const stopSpeaking = () => {
    Speech.stop();
    setIsSpeaking(false);
  };

  const quickCommands = [
    { text: 'What can you see?', icon: 'eye' },
    { text: 'Help me navigate', icon: 'navigate' },
    { text: 'Check my medications', icon: 'medical' },
    { text: 'What time is it?', icon: 'time' },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={100}
      >
        {/* Speaking Indicator */}
        {isSpeaking && (
          <View style={styles.speakingIndicator}>
            <Ionicons name="volume-high" size={20} color="#00D9FF" />
            <Text style={styles.speakingText}>NAVI-VICA is speaking...</Text>
          </View>
        )}

        {/* Conversation Area */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.conversationArea}
          contentContainerStyle={styles.conversationContent}
          onContentSizeChange={() =>
            scrollViewRef.current?.scrollToEnd({ animated: true })
          }
        >
          {messages.map((message) => (
            <View
              key={message.id}
              style={[
                styles.messageBubble,
                message.type === 'user' ? styles.userBubble : styles.assistantBubble,
              ]}
            >
              {message.type === 'assistant' && (
                <View style={styles.assistantHeader}>
                  <Ionicons name="eye" size={16} color="#00D9FF" />
                  <Text style={styles.assistantName}>NAVI-VICA</Text>
                </View>
              )}
              <Text
                style={[
                  styles.messageText,
                  message.type === 'user' && styles.userMessageText,
                ]}
              >
                {message.text}
              </Text>
            </View>
          ))}
          {isProcessing && (
            <View style={styles.processingIndicator}>
              <ActivityIndicator size="small" color="#00D9FF" />
              <Text style={styles.processingText}>Thinking...</Text>
            </View>
          )}
        </ScrollView>

        {/* Last Response Player */}
        {lastResponse && (
          <View style={styles.responsePlayer}>
            <Ionicons name="volume-high" size={20} color="#888" />
            <Text style={styles.responsePlayerText} numberOfLines={1}>
              {lastResponse}
            </Text>
            <TouchableOpacity
              onPress={isSpeaking ? stopSpeaking : speakLastResponse}
              style={styles.playButton}
            >
              <Ionicons
                name={isSpeaking ? 'stop' : 'play'}
                size={20}
                color="#00D9FF"
              />
            </TouchableOpacity>
          </View>
        )}

        {/* Quick Commands */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.quickCommandsContainer}
        >
          {quickCommands.map((cmd, index) => (
            <TouchableOpacity
              key={index}
              style={styles.quickCommandButton}
              onPress={() => processCommand(cmd.text)}
            >
              <Ionicons name={cmd.icon as any} size={16} color="#00D9FF" />
              <Text style={styles.quickCommandText}>{cmd.text}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Voice Input Button */}
        <View style={styles.voiceInputContainer}>
          <TouchableOpacity
            style={[
              styles.voiceButton,
              isListening && styles.voiceButtonActive,
            ]}
            onPressIn={startListening}
            onPressOut={stopListening}
          >
            <Ionicons
              name={isListening ? 'radio' : 'mic'}
              size={48}
              color={isListening ? '#F44336' : '#00D9FF'}
            />
          </TouchableOpacity>
          <Text style={styles.voiceHint}>
            {isListening ? 'Release to stop' : 'Hold to speak'}
          </Text>
          {!permissionGranted && (
            <Text style={styles.permissionWarning}>Microphone permission required</Text>
          )}
        </View>

        {/* Text Input Alternative */}
        <View style={styles.textInputContainer}>
          <TextInput
            style={styles.textInput}
            placeholder="Type your command here..."
            placeholderTextColor="#666"
            value={inputText}
            onChangeText={setInputText}
            onSubmitEditing={() => processCommand(inputText)}
            returnKeyType="send"
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              !inputText.trim() && styles.sendButtonDisabled,
            ]}
            onPress={() => processCommand(inputText)}
            disabled={!inputText.trim()}
          >
            <Ionicons name="send" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
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
  speakingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a3a5e',
    padding: 10,
  },
  speakingText: {
    color: '#00D9FF',
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '600',
  },
  conversationArea: {
    flex: 1,
  },
  conversationContent: {
    padding: 16,
  },
  messageBubble: {
    maxWidth: '85%',
    padding: 14,
    borderRadius: 16,
    marginBottom: 12,
  },
  userBubble: {
    backgroundColor: '#00D9FF',
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    backgroundColor: '#1a1a2e',
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
  },
  assistantHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  assistantName: {
    color: '#00D9FF',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
  },
  messageText: {
    color: '#fff',
    fontSize: 15,
    lineHeight: 22,
  },
  userMessageText: {
    color: '#000',
  },
  processingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#1a1a2e',
    padding: 12,
    borderRadius: 16,
  },
  processingText: {
    color: '#888',
    marginLeft: 8,
    fontSize: 14,
  },
  responsePlayer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    marginHorizontal: 16,
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  responsePlayerText: {
    flex: 1,
    color: '#888',
    fontSize: 13,
    marginHorizontal: 12,
  },
  playButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2a2a4e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickCommandsContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  quickCommandButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#2a2a4e',
  },
  quickCommandText: {
    color: '#ccc',
    fontSize: 13,
    marginLeft: 8,
  },
  voiceInputContainer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  voiceButton: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#1a1a2e',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#00D9FF33',
  },
  voiceButtonActive: {
    backgroundColor: '#2a1a1e',
    borderColor: '#F44336',
  },
  voiceHint: {
    color: '#666',
    fontSize: 13,
    marginTop: 8,
  },
  permissionWarning: {
    color: '#F44336',
    fontSize: 11,
    marginTop: 4,
  },
  textInputContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  textInput: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 14,
    color: '#fff',
    fontSize: 15,
    marginRight: 12,
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#00D9FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#333',
  },
});
