/**
 * NotesScreen
 *
 * Main screen for managing notes and todos with a tabbed interface.
 * Notes tab displays notes with search, filtering, and pinning support.
 * Todos tab displays todos with filter tabs, sorting, and quick add.
 */

import * as React from 'react';
import { useState, useCallback, useMemo } from 'react';
import { View, StyleSheet, Pressable, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text, Button, Icon, type IconName } from '@/components/ui';
import { NotesList, NoteEditor } from '@/components/notes';
import { TodoList, TodoEditor, TodoQuickAdd } from '@/components/todos';
import {
  useNotes,
  useCreateNote,
  useUpdateNote,
  useDeleteNote,
  usePinNote,
  useCategories,
} from '@/hooks';
import { useTheme, spacing, fontSizes, borderRadius } from '@/theme';
import type { Note, CreateNoteInput, UpdateNoteInput, Todo } from '@/schemas';
import type { RouteProp } from '@react-navigation/native';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Tab types for the screen
 */
type TabType = 'notes' | 'todos';

/**
 * Navigation props for the screen
 */
interface NotesScreenRouteParams {
  tab?: TabType;
}

export interface NotesScreenProps {
  route?: RouteProp<{ Notes: NotesScreenRouteParams }, 'Notes'>;
}

// ============================================================================
// TAB BAR COMPONENT
// ============================================================================

interface TabBarProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

function TabBar({ activeTab, onTabChange }: TabBarProps): React.ReactElement {
  const { colors } = useTheme();

  const tabs: { key: TabType; label: string; icon: IconName }[] = [
    { key: 'notes', label: 'Notes', icon: 'file-text' },
    { key: 'todos', label: 'To-Do', icon: 'check-square' },
  ];

  return (
    <View style={[styles.tabBar, { borderBottomColor: colors.border }]}>
      {tabs.map(tab => {
        const isActive = activeTab === tab.key;
        return (
          <Pressable
            key={tab.key}
            style={[
              styles.tab,
              isActive && { borderBottomColor: colors.primary, borderBottomWidth: 2 },
            ]}
            onPress={() => onTabChange(tab.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={`${tab.label} tab`}
          >
            <Icon
              name={tab.icon}
              size={18}
              color={isActive ? colors.primary : colors.textSecondary}
              style={styles.tabIcon}
            />
            <Text
              style={[
                styles.tabText,
                { color: isActive ? colors.primary : colors.textSecondary },
                isActive && styles.tabTextActive,
              ]}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ============================================================================
// FAB COMPONENT
// ============================================================================

interface FABProps {
  onPress: () => void;
  icon?: IconName;
  label?: string;
}

function FAB({ onPress, icon = 'plus', label }: FABProps): React.ReactElement {
  const { colors } = useTheme();

  return (
    <Pressable
      style={[styles.fab, { backgroundColor: colors.primary }]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label ?? 'Create new'}
    >
      <Icon name={icon} size={24} color={colors.text} />
    </Pressable>
  );
}

// ============================================================================
// NOTES TAB CONTENT
// ============================================================================

interface NotesTabProps {
  onNotePress: (note: Note) => void;
  onCreateNote: () => void;
}

function NotesTab({ onNotePress, onCreateNote }: NotesTabProps): React.ReactElement {
  const { colors } = useTheme();

  // State for search and filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch notes
  const {
    data: notes = [],
    isLoading,
    refetch,
  } = useNotes({
    filters: {
      search: searchQuery || undefined,
      categoryId: selectedCategoryId || undefined,
      sortBy: 'updated_at',
      sortOrder: 'desc',
    },
  });

  // Fetch categories
  const { data: categories = [] } = useCategories();

  // Mutations
  const deleteNote = useDeleteNote();
  const pinNote = usePinNote();

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refetch();
    } finally {
      setIsRefreshing(false);
    }
  }, [refetch]);

  // Handle delete
  const handleDelete = useCallback(
    (note: Note) => {
      const confirmDelete = () => {
        deleteNote.mutate(note.id);
      };

      if (Platform.OS === 'web') {
        if (confirm(`Delete "${note.title}"? This action cannot be undone.`)) {
          confirmDelete();
        }
      } else {
        Alert.alert('Delete Note', `Delete "${note.title}"? This action cannot be undone.`, [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: confirmDelete },
        ]);
      }
    },
    [deleteNote]
  );

  // Handle pin
  const handlePin = useCallback(
    (note: Note) => {
      pinNote.mutate({ id: note.id, pinned: !note.pinned });
    },
    [pinNote]
  );

  return (
    <View style={styles.tabContent}>
      <NotesList
        notes={notes}
        categories={categories}
        isLoading={isLoading}
        isRefreshing={isRefreshing}
        onRefresh={handleRefresh}
        onNotePress={onNotePress}
        onNoteEdit={onNotePress}
        onNoteDelete={handleDelete}
        onNotePin={handlePin}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedCategoryId={selectedCategoryId}
        onCategoryChange={setSelectedCategoryId}
        showFilters
      />
      <FAB onPress={onCreateNote} label="Create new note" />
    </View>
  );
}

// ============================================================================
// TODOS TAB CONTENT
// ============================================================================

interface TodosTabProps {
  onTodoPress: (todo: Todo) => void;
  onCreateTodo: () => void;
}

function TodosTab({ onTodoPress, onCreateTodo }: TodosTabProps): React.ReactElement {
  const { colors } = useTheme();

  return (
    <View style={styles.tabContent}>
      <TodoList
        onTodoPress={onTodoPress}
        onCreatePress={onCreateTodo}
        showFilterTabs
        showSortOptions
      />

      {/* Quick add at bottom */}
      <View
        style={[
          styles.quickAddContainer,
          { backgroundColor: colors.surface, borderTopColor: colors.border },
        ]}
      >
        <TodoQuickAdd placeholder="Quick add a todo..." />
      </View>

      <FAB onPress={onCreateTodo} label="Create new todo with details" />
    </View>
  );
}

// ============================================================================
// MAIN SCREEN COMPONENT
// ============================================================================

/**
 * NotesScreen component displaying notes and todos in a tabbed interface
 */
export function NotesScreen({ route }: NotesScreenProps): React.ReactElement {
  const { colors } = useTheme();

  // Get initial tab from route params
  const initialTab = route?.params?.tab ?? 'notes';

  // State
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);
  const [showNoteEditor, setShowNoteEditor] = useState(false);
  const [showTodoEditor, setShowTodoEditor] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);

  // Fetch categories for NoteEditor
  const { data: categories = [] } = useCategories();

  // Note mutations
  const createNote = useCreateNote({
    onSuccess: () => {
      setShowNoteEditor(false);
      setEditingNote(null);
    },
  });

  const updateNote = useUpdateNote({
    onSuccess: () => {
      setShowNoteEditor(false);
      setEditingNote(null);
    },
  });

  const deleteNoteFromEditor = useDeleteNote({
    onSuccess: () => {
      setShowNoteEditor(false);
      setEditingNote(null);
    },
  });

  // Handle note press (edit)
  const handleNotePress = useCallback((note: Note) => {
    setEditingNote(note);
    setShowNoteEditor(true);
  }, []);

  // Handle create note
  const handleCreateNote = useCallback(() => {
    setEditingNote(null);
    setShowNoteEditor(true);
  }, []);

  // Handle note editor submit
  const handleNoteSubmit = useCallback(
    (data: CreateNoteInput | UpdateNoteInput, noteId?: string) => {
      if (noteId) {
        // Edit mode
        updateNote.mutate({ id: noteId, data: data as UpdateNoteInput });
      } else {
        // Create mode
        createNote.mutate(data as CreateNoteInput);
      }
    },
    [createNote, updateNote]
  );

  // Handle note delete from editor
  const handleNoteDeleteFromEditor = useCallback(
    (noteId: string) => {
      deleteNoteFromEditor.mutate(noteId);
    },
    [deleteNoteFromEditor]
  );

  // Handle todo press (edit)
  const handleTodoPress = useCallback((todo: Todo) => {
    setEditingTodo(todo);
    setShowTodoEditor(true);
  }, []);

  // Handle create todo (with full editor)
  const handleCreateTodo = useCallback(() => {
    setEditingTodo(null);
    setShowTodoEditor(true);
  }, []);

  // Handle todo editor success
  const handleTodoSuccess = useCallback(() => {
    setShowTodoEditor(false);
    setEditingTodo(null);
  }, []);

  // Handle todo editor cancel
  const handleTodoCancel = useCallback(() => {
    setShowTodoEditor(false);
    setEditingTodo(null);
  }, []);

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['bottom']}
    >
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text variant="display" style={styles.headerTitle}>
          Notes & Tasks
        </Text>
      </View>

      {/* Tab Bar */}
      <TabBar activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Content */}
      {activeTab === 'notes' ? (
        <NotesTab onNotePress={handleNotePress} onCreateNote={handleCreateNote} />
      ) : (
        <TodosTab onTodoPress={handleTodoPress} onCreateTodo={handleCreateTodo} />
      )}

      {/* Note Editor Modal */}
      <NoteEditor
        visible={showNoteEditor}
        onClose={() => {
          setShowNoteEditor(false);
          setEditingNote(null);
        }}
        note={editingNote}
        categories={categories}
        isSaving={createNote.isPending || updateNote.isPending}
        isDeleting={deleteNoteFromEditor.isPending}
        onSubmit={handleNoteSubmit}
        onDelete={handleNoteDeleteFromEditor}
      />

      {/* Todo Editor Modal */}
      {showTodoEditor && (
        <View style={styles.todoEditorOverlay}>
          <View style={[styles.todoEditorContainer, { backgroundColor: colors.surface }]}>
            <View style={[styles.todoEditorHeader, { borderBottomColor: colors.border }]}>
              <Pressable onPress={handleTodoCancel}>
                <Text style={{ color: colors.primary }}>Cancel</Text>
              </Pressable>
              <Text variant="heading">{editingTodo ? 'Edit Todo' : 'New Todo'}</Text>
              <View style={{ width: 50 }} />
            </View>
            <TodoEditor
              todo={editingTodo}
              onSuccess={handleTodoSuccess}
              onCancel={handleTodoCancel}
            />
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 28,
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  tabIcon: {
    marginRight: spacing.xs,
  },
  tabText: {
    fontSize: fontSizes.md,
  },
  tabTextActive: {
    fontWeight: '600',
  },
  tabContent: {
    flex: 1,
  },
  fab: {
    position: 'absolute',
    right: spacing.md,
    bottom: spacing.xxl,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  quickAddContainer: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    marginBottom: 72, // Space for FAB
  },
  todoEditorOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  todoEditorContainer: {
    width: '90%',
    maxWidth: 500,
    maxHeight: '80%',
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  todoEditorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
  },
});

export default NotesScreen;
