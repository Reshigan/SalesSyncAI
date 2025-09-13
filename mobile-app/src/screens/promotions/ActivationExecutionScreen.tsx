import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Title, Paragraph, Card } from 'react-native-paper';
import { theme } from '../../theme/theme';

const ActivationExecutionScreen: React.FC = () => {
  return (
    <View style={styles.container}>
      <Card style={styles.card}>
        <Card.Content>
          <Title>Activation Execution</Title>
          <Paragraph>Live activation execution with GPS tracking and performance monitoring coming soon...</Paragraph>
        </Card.Content>
      </Card>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    padding: theme.spacing.md,
  },
  card: {
    elevation: theme.elevation.small,
  },
});

export default ActivationExecutionScreen;