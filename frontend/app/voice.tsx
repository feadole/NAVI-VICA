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
import { useRouter } from 'expo-router';

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

// Web Speech Recognition for voice input
let recognition: any = null;
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
  }
}

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
      text: "Hello! I'm NAVI-VICA, your personal navigator. Type a command or tap the microphone to speak.",
      timestamp: new Date(),
    },
  ]);
  const [lastResponse, setLastResponse] = useState('');
  const [voiceSupported, setVoiceSupported] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    // Check if voice recognition is supported
    if (Platform.OS === 'web' && recognition) {
      setVoiceSupported(true);
      
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        console.log('Voice recognized:', transcript);
        setInputText(transcript);
        setIsListening(false);
        // Automatically process the command
        processCommand(transcript);
      };
      
      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
        speak('Sorry, I could not hear you. Please try again or type your command.');
      };
      
      recognition.onend = () => {
        setIsListening(false);
      };
    }
    
    // Welcome message
    setTimeout(() => {
      speak("Hello! I'm NAVI-VICA, your personal navigator. How can I help you today?");
    }, 500);
  }, []);

  const startListening = () => {
    if (Platform.OS === 'web' && recognition) {
      try {
        setIsListening(true);
        speak('Listening. Speak now.');
        setTimeout(() => {
          recognition.start();
        }, 1500);
      } catch (error) {
        console.error('Failed to start recognition:', error);
        setIsListening(false);
        speak('Voice recognition failed. Please type your command.');
      }
    } else {
      speak('Voice input is not supported on this device. Please type your command.');
    }
  };

  const stopListening = () => {
    if (Platform.OS === 'web' && recognition) {
      try {
        recognition.stop();
      } catch (error) {
        console.error('Failed to stop recognition:', error);
      }
    }
    setIsListening(false);
  };

  const processCommand = async (text: string) => {
    if (!text.trim()) {
      speak('Please enter a command.');
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
      setIsSpeaking(true);
      speak(result.response_text);
      setTimeout(() => setIsSpeaking(false), 8000);

      // Handle actions
      if (result.action) {
        setTimeout(() => {
          switch (result.action) {
            case 'open_camera':
              speak('Opening camera for scene analysis.');
              router.push('/camera');
              break;
            case 'open_meds':
              speak('Opening medication reminders.');
              router.push('/meds');
              break;
            case 'open_settings':
              speak('Opening settings.');
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
      speak("I'm sorry, I couldn't process that command. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const speakLastResponse = () => {
    if (lastResponse) {
      setIsSpeaking(true);
      speak(lastResponse);
      setTimeout(() => setIsSpeaking(false), 8000);
    } else {
      speak('No previous response to play.');
    }
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
            <TouchableOpacity onPress={stopSpeaking} style={styles.stopButton}>
              <Text style={styles.stopButtonText}>STOP</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Listening Indicator */}
        {isListening && (
          <View style={styles.listeningIndicator}>
            <Ionicons name="mic" size={20} color="#F44336" />
            <Text style={styles.listeningText}>Listening... Speak now!</Text>
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
        <Text style={styles.quickLabel}>Quick Commands:</Text>
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
            onPress={isListening ? stopListening : startListening}
          >
            <Ionicons
              name={isListening ? 'radio' : 'mic'}
              size={48}
              color={isListening ? '#F44336' : '#00D9FF'}
            />
          </TouchableOpacity>
          <Text style={styles.voiceHint}>
            {isListening ? 'Tap to stop' : 'Tap to speak'}
          </Text>
          {!voiceSupported && Platform.OS === 'web' && (
            <Text style={styles.voiceWarning}>Voice not supported in this browser</Text>
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
    flex: 1,
  },
  stopButton: {
    backgroundColor: '#F44336',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
  },
  stopButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  listeningIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3a1a1e',
    padding: 10,
  },
  listeningText: {
    color: '#F44336',
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
  quickLabel: {
    color: '#888',
    fontSize: 12,
    marginLeft: 16,
    marginBottom: 4,
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
  voiceWarning: {
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
