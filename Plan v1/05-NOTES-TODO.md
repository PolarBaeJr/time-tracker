# 05 - Notes & To-Do List

## Phase: 3 (Personal Productivity)

## Summary

Built-in note-taking and task management with categories, due dates, and AI-powered task creation from natural language. Integrates with time tracking (link tasks to time entries) and calendar (tasks with due dates show in calendar).

## Features

1. **Quick Notes** - Markdown-supported notes with tags
2. **Task Lists** - Checkable tasks with due dates, priorities, and categories
3. **AI Task Creation** - "Call dentist tomorrow at 2pm" -> structured task
4. **Time Entry Linking** - Associate tasks with time entries
5. **Calendar Integration** - Tasks with due dates appear in calendar widget
6. **Recurring Tasks** - Daily/weekly/monthly recurring tasks

## Architecture

```
src/
  lib/
    notes/
      types.ts                # Note, Task, Tag types
  hooks/
    useNotes.ts               # Note CRUD queries
    useNoteMutations.ts       # Create/edit/delete notes
    useTasks.ts               # Task CRUD queries
    useTaskMutations.ts       # Create/edit/complete/delete tasks
  components/
    notes/
      NotesWidget.tsx         # Hub widget (pinned notes + recent)
      TasksWidget.tsx         # Hub widget (today's tasks)
      NoteEditor.tsx          # Rich note editor
      TaskEditor.tsx          # Task create/edit form
      TaskList.tsx            # Filterable task list
      TaskItem.tsx            # Single task with checkbox
    settings/
      NotesSettings.tsx       # Default category, reminder preferences
  screens/
    NotesScreen.tsx           # Full notes view
    TasksScreen.tsx           # Full tasks view
```

## Database Schema

```sql
CREATE TABLE notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL DEFAULT auth.uid(),
  title TEXT,
  content TEXT,                     -- Markdown content
  tags TEXT[],
  is_pinned BOOLEAN DEFAULT false,
  category_id UUID REFERENCES categories,
  deleted_at TIMESTAMPTZ,           -- Soft delete (consistent with time_entries)
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL DEFAULT auth.uid(),
  title TEXT NOT NULL,
  description TEXT,
  due_at TIMESTAMPTZ,
  priority INTEGER DEFAULT 3,       -- 1 (highest) to 5 (lowest)
  status TEXT DEFAULT 'pending',    -- pending | in_progress | completed | cancelled
  completed_at TIMESTAMPTZ,
  category_id UUID REFERENCES categories,
  time_entry_id UUID REFERENCES time_entries,  -- Linked time entry
  recurrence_rule TEXT,             -- RRULE string for recurring tasks
  parent_task_id UUID REFERENCES tasks, -- Subtasks
  sort_order INTEGER DEFAULT 0,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_notes" ON notes FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_tasks" ON tasks FOR ALL USING (auth.uid() = user_id);
```

## AI Task Creation

User types natural language in the quick-add bar:

```
"Call dentist tomorrow at 2pm"
→ { title: "Call dentist", due_at: "2024-03-11T14:00:00", priority: 3 }

"URGENT: Review PR #42 by Friday"
→ { title: "Review PR #42", due_at: "2024-03-15", priority: 1 }

"Buy groceries every Saturday"
→ { title: "Buy groceries", recurrence_rule: "FREQ=WEEKLY;BYDAY=SA", priority: 3 }
```

Uses the AI Engine's `taskExtraction` prompt template.

## Tasks Widget (Hub)

```
+---------------------------------------+
|  Today's Tasks                  3/7   |
|  ─────────────────────────────────── |
|  [x] Review PR #42          Work     |
|  [ ] Call dentist            2:00 PM  |
|  [ ] Write API docs         Work     |
|  ─────────────────────────────────── |
|  + Add task...                        |
|  [View All]                           |
+---------------------------------------+
```

## Time Tracking Integration

- Start timer directly from a task (pre-fills category)
- When timer stops, link the time entry to the task
- Task detail view shows total time spent
- Analytics can break down time by task
