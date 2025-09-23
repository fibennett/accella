// screens/coach/training/PlanProcessingScreen.js
import React, { useState, useEffect } from 'react';
import { View, Alert } from 'react-native';
import { Card, Button, ProgressBar, Text } from 'react-native-paper';
import DocumentProcessor from '../../../services/DocumentProcessor';

const PlanProcessingScreen = ({ navigation, route }) => {
  const { documentId, onComplete } = route.params;
  const [processing, setProcessing] = useState(true);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('Analyzing document...');

  useEffect(() => {
    processDocument();
  }, []);

  const processDocument = async () => {
    try {
      setProgress(0.2);
      setStatus('Extracting content...');
      
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate processing
      setProgress(0.5);
      setStatus('Parsing training plan structure...');
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      setProgress(0.8);
      setStatus('Creating training plan...');
      
      const trainingPlan = await DocumentProcessor.processTrainingPlan(documentId);
      setProgress(1);
      setStatus('Complete!');
      
      setTimeout(() => {
        Alert.alert(
          'Processing Complete!',
          `Training plan "${trainingPlan.title}" has been created successfully.`,
          [
            {
              text: 'View in Library',
              onPress: () => {
                if (onComplete) onComplete();
                else navigation.navigate('TrainingPlanLibrary');
              }
            }
          ]
        );
      }, 500);
      
    } catch (error) {
      Alert.alert('Processing Failed', error.message);
      navigation.goBack();
    } finally {
      setProcessing(false);
    }
  };

  return (
    <View style={{ flex: 1, padding: 20, justifyContent: 'center' }}>
      <Card>
        <Card.Content style={{ alignItems: 'center', padding: 40 }}>
          <Text style={{ fontSize: 24, marginBottom: 20 }}>Processing Training Plan</Text>
          <ProgressBar 
            progress={progress} 
            style={{ width: '100%', height: 8, marginBottom: 20 }} 
          />
          <Text>{status}</Text>
          <Text style={{ marginTop: 10, fontSize: 16 }}>
            {Math.round(progress * 100)}% Complete
          </Text>
        </Card.Content>
      </Card>
    </View>
  );
};

export default PlanProcessingScreen;