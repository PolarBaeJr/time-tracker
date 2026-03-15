/**
 * Root Navigator
 *
 * Handles top-level navigation with authentication-based routing:
 * - Shows LoginScreen when user is not authenticated
 * - Shows MainTabs when user is authenticated
 * - Provides EntryEdit modal accessible from any screen
 */

import * as React from 'react';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';

import { Text } from '@/components/ui';
import { EntryEditModal } from '@/components/history';
import { NoteEditor } from '@/components/notes';
import { TodoEditor } from '@/components/todos';
import { useAuth, useCategories, useNote, useUpdateNote, useDeleteNote, useTodo } from '@/hooks';
import {
  LoginScreen,
  SetupScreen,
  FocusModeScreen,
  CategoriesScreen,
  GoalsScreen,
  ChatScreen,
} from '@/screens';
import { supabase } from '@/lib/supabase';
import { queryKeys } from '@/lib/queryClient';
import { TimeEntrySchema } from '@/schemas';
import type { CreateNoteInput, UpdateNoteInput } from '@/schemas';
import { useTheme } from '@/theme';
import { spacing } from '@/theme';

import { MainTabs } from './MainTabs';
import type { RootStackParamList, RootStackScreenProps } from './types';

/**
 * EntryEdit screen
 *
 * Fetches a single time entry by ID from route params and renders
 * the EntryEditModal as a full-screen modal.
 */
function EntryEditScreen({
  route,
  navigation,
}: RootStackScreenProps<'EntryEdit'>): React.ReactElement {
  const { entryId } = route.params;
  const { colors } = useTheme();

  // Fetch the single time entry by ID
  const {
    data: entry,
    isLoading: entryLoading,
    error: entryError,
  } = useQuery({
    queryKey: queryKeys.timeEntry(entryId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('time_entries')
        .select('*')
        .eq('id', entryId)
        .single();

      if (error) throw new Error(error.message);
      return TimeEntrySchema.parse(data);
    },
  });

  // Fetch categories for the category picker
  const { data: categories = [], isLoading: categoriesLoading } = useCategories();

  const handleClose = React.useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  // Loading state
  if (entryLoading || categoriesLoading) {
    return (
      <View style={[styles.placeholderContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text variant="body" color="muted" center style={styles.placeholderSubtext}>
          Loading entry...
        </Text>
      </View>
    );
  }

  // Error state
  if (entryError || !entry) {
    return (
      <View style={[styles.placeholderContainer, { backgroundColor: colors.background }]}>
        <Text variant="heading" center>
          Entry not found
        </Text>
        <Text variant="body" color="muted" center style={styles.placeholderSubtext}>
          {entryError?.message || 'The entry could not be loaded.'}
        </Text>
      </View>
    );
  }

  return (
    <EntryEditModal
      entry={entry}
      categories={categories}
      visible={true}
      onClose={handleClose}
      onSaveSuccess={handleClose}
      onDeleteSuccess={handleClose}
      embedded
    />
  );
}

/**
 * NoteEdit screen
 *
 * Fetches a single note by ID from route params and renders
 * the NoteEditor as a full-screen modal.
 */
function NoteEditScreen({
  route,
  navigation,
}: RootStackScreenProps<'NoteEdit'>): React.ReactElement {
  const { noteId } = route.params;
  const { colors } = useTheme();

  // Fetch the single note by ID
  const { data: note, isLoading: noteLoading, error: noteError } = useNote(noteId);

  // Fetch categories for the category picker
  const { data: categories = [], isLoading: categoriesLoading } = useCategories();

  // Update and delete mutations
  const updateNote = useUpdateNote({
    onSuccess: () => {
      navigation.goBack();
    },
  });

  const deleteNote = useDeleteNote({
    onSuccess: () => {
      navigation.goBack();
    },
  });

  const handleClose = React.useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const handleSubmit = React.useCallback(
    (data: CreateNoteInput | UpdateNoteInput, _noteId?: string) => {
      updateNote.mutate({ id: noteId, data: data as UpdateNoteInput });
    },
    [updateNote, noteId]
  );

  const handleDelete = React.useCallback(
    (_noteId: string) => {
      deleteNote.mutate(noteId);
    },
    [deleteNote, noteId]
  );

  // Loading state
  if (noteLoading || categoriesLoading) {
    return (
      <View style={[styles.placeholderContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text variant="body" color="muted" center style={styles.placeholderSubtext}>
          Loading note...
        </Text>
      </View>
    );
  }

  // Error state
  if (noteError || !note) {
    return (
      <View style={[styles.placeholderContainer, { backgroundColor: colors.background }]}>
        <Text variant="heading" center>
          Note not found
        </Text>
        <Text variant="body" color="muted" center style={styles.placeholderSubtext}>
          {noteError instanceof Error ? noteError.message : 'The note could not be loaded.'}
        </Text>
      </View>
    );
  }

  return (
    <NoteEditor
      visible={true}
      onClose={handleClose}
      note={note}
      categories={categories}
      isSaving={updateNote.isPending}
      isDeleting={deleteNote.isPending}
      onSubmit={handleSubmit}
      onDelete={handleDelete}
    />
  );
}

/**
 * TodoEdit screen
 *
 * Fetches a single todo by ID from route params and renders
 * the TodoEditor as a full-screen modal.
 */
function TodoEditScreen({
  route,
  navigation,
}: RootStackScreenProps<'TodoEdit'>): React.ReactElement {
  const { todoId } = route.params;
  const { colors } = useTheme();

  // Fetch the single todo by ID
  const { data: todo, isLoading: todoLoading, error: todoError } = useTodo(todoId);

  const handleClose = React.useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const handleSuccess = React.useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  // Loading state
  if (todoLoading) {
    return (
      <View style={[styles.placeholderContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text variant="body" color="muted" center style={styles.placeholderSubtext}>
          Loading todo...
        </Text>
      </View>
    );
  }

  // Error state
  if (todoError || !todo) {
    return (
      <View style={[styles.placeholderContainer, { backgroundColor: colors.background }]}>
        <Text variant="heading" center>
          Todo not found
        </Text>
        <Text variant="body" color="muted" center style={styles.placeholderSubtext}>
          {todoError instanceof Error ? todoError.message : 'The todo could not be loaded.'}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.todoEditContainer, { backgroundColor: colors.surface }]}>
      <TodoEditor todo={todo} onSuccess={handleSuccess} onCancel={handleClose} />
    </View>
  );
}

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * Root Navigator Component
 *
 * Conditionally renders:
 * - Login screen when not authenticated
 * - Main tab navigator when authenticated
 * - EntryEdit modal (presented over both states)
 */
export function RootNavigator(): React.ReactElement {
  const { isAuthenticated, user } = useAuth();
  const { colors } = useTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: {
          backgroundColor: colors.background,
        },
        animation: 'fade',
      }}
    >
      {!isAuthenticated ? (
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{ animationTypeForReplace: 'pop' }}
        />
      ) : !user?.onboarding_complete ? (
        <Stack.Screen name="Setup" component={SetupScreen} />
      ) : (
        <>
          <Stack.Screen name="Main" component={MainTabs} />
          <Stack.Screen
            name="EntryEdit"
            component={EntryEditScreen}
            options={{
              presentation: 'modal',
              headerShown: true,
              headerTitle: 'Edit Entry',
              headerStyle: { backgroundColor: colors.surface },
              headerTintColor: colors.text,
              headerShadowVisible: false,
            }}
          />
          <Stack.Screen
            name="FocusMode"
            component={FocusModeScreen}
            options={{ presentation: 'fullScreenModal', headerShown: false }}
          />
          <Stack.Screen
            name="Categories"
            component={CategoriesScreen}
            options={{
              presentation: 'modal',
              headerShown: true,
              headerTitle: 'Categories',
              headerStyle: { backgroundColor: colors.surface },
              headerTintColor: colors.text,
              headerShadowVisible: false,
            }}
          />
          <Stack.Screen
            name="Goals"
            component={GoalsScreen}
            options={{
              presentation: 'modal',
              headerShown: true,
              headerTitle: 'Goals',
              headerStyle: { backgroundColor: colors.surface },
              headerTintColor: colors.text,
              headerShadowVisible: false,
            }}
          />
          <Stack.Screen
            name="Chat"
            component={ChatScreen}
            options={{
              presentation: 'modal',
              headerShown: false, // ChatScreen has its own header
            }}
          />
          <Stack.Screen
            name="NoteEdit"
            component={NoteEditScreen}
            options={{
              presentation: 'modal',
              headerShown: true,
              headerTitle: 'Edit Note',
              headerStyle: { backgroundColor: colors.surface },
              headerTintColor: colors.text,
              headerShadowVisible: false,
            }}
          />
          <Stack.Screen
            name="TodoEdit"
            component={TodoEditScreen}
            options={{
              presentation: 'modal',
              headerShown: true,
              headerTitle: 'Edit Todo',
              headerStyle: { backgroundColor: colors.surface },
              headerTintColor: colors.text,
              headerShadowVisible: false,
            }}
          />
        </>
      )}
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  placeholderContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  placeholderSubtext: {
    marginTop: spacing.sm,
  },
  todoEditContainer: {
    flex: 1,
  },
});

export default RootNavigator;
