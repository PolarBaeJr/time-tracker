/**
 * Entry Templates Query & Mutation Hooks
 *
 * Provides TanStack Query hooks for fetching, creating, updating, and deleting
 * entry templates. Also includes a migration hook for moving local templates
 * to Supabase.
 *
 * SECURITY:
 * - RLS policies ensure only the authenticated user's templates are returned
 * - user_id is NOT included in queries; it's enforced server-side
 */

import { useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { storage } from '@/lib';
import { queryKeys } from '@/lib/queryClient';
import {
  EntryTemplateSchema,
  CreateEntryTemplateSchema,
  UpdateEntryTemplateSchema,
  type EntryTemplate,
  type CreateEntryTemplateInput,
  type UpdateEntryTemplateInput,
} from '@/schemas';
import { getLocalTemplatesAndClear } from '@/stores/entryTemplateStore';

/**
 * Error thrown when a template operation fails
 */
export class EntryTemplateError extends Error {
  constructor(
    message: string,
    public readonly code?: string
  ) {
    super(message);
    this.name = 'EntryTemplateError';
  }
}

// ============================================================================
// FETCH
// ============================================================================

async function fetchEntryTemplates(): Promise<EntryTemplate[]> {
  const { data, error } = await supabase
    .from('entry_templates')
    .select('*')
    .order('name', { ascending: true });

  if (error) {
    throw new EntryTemplateError(error.message, error.code);
  }

  if (!data) {
    return [];
  }

  return data.map(template => {
    const parsed = EntryTemplateSchema.safeParse(template);
    if (!parsed.success) {
      console.warn('Invalid template data:', template, parsed.error);
      return template as EntryTemplate;
    }
    return parsed.data;
  });
}

// ============================================================================
// MUTATIONS
// ============================================================================

async function createEntryTemplate(input: CreateEntryTemplateInput): Promise<EntryTemplate> {
  const validatedInput = CreateEntryTemplateSchema.parse(input);

  const { data, error } = await supabase
    .from('entry_templates')
    .insert(validatedInput)
    .select()
    .single();

  if (error) {
    throw new EntryTemplateError(error.message, error.code);
  }

  if (!data) {
    throw new EntryTemplateError('No data returned from create');
  }

  return data as EntryTemplate;
}

async function updateEntryTemplate({
  id,
  ...input
}: UpdateEntryTemplateInput & { id: string }): Promise<EntryTemplate> {
  const validatedInput = UpdateEntryTemplateSchema.parse(input);

  const { data, error } = await supabase
    .from('entry_templates')
    .update(validatedInput)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new EntryTemplateError(error.message, error.code);
  }

  if (!data) {
    throw new EntryTemplateError('No data returned from update');
  }

  return data as EntryTemplate;
}

async function deleteEntryTemplate(id: string): Promise<void> {
  const { error } = await supabase.from('entry_templates').delete().eq('id', id);

  if (error) {
    throw new EntryTemplateError(error.message, error.code);
  }
}

// ============================================================================
// HOOKS
// ============================================================================

export function useEntryTemplatesQuery() {
  return useQuery({
    queryKey: queryKeys.entryTemplates,
    queryFn: fetchEntryTemplates,
  });
}

export function useCreateEntryTemplate() {
  const queryClient = useQueryClient();

  return useMutation<EntryTemplate, EntryTemplateError, CreateEntryTemplateInput>({
    mutationFn: createEntryTemplate,
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.entryTemplates,
      });
    },
  });
}

export function useUpdateEntryTemplate() {
  const queryClient = useQueryClient();

  return useMutation<EntryTemplate, EntryTemplateError, UpdateEntryTemplateInput & { id: string }>({
    mutationFn: updateEntryTemplate,
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.entryTemplates,
      });
    },
  });
}

export function useDeleteEntryTemplate() {
  const queryClient = useQueryClient();

  return useMutation<void, EntryTemplateError, string>({
    mutationFn: deleteEntryTemplate,
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.entryTemplates,
      });
    },
  });
}

// ============================================================================
// MIGRATION
// ============================================================================

const MIGRATION_FLAG_KEY = 'worktracker.templates-migrated.v1';

export function useMigrateLocalTemplates(isAuthenticated: boolean): void {
  const createTemplate = useCreateEntryTemplate();
  const hasRun = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || hasRun.current) {
      return;
    }

    const migrate = async () => {
      try {
        const flag = await storage.getItem(MIGRATION_FLAG_KEY);
        if (flag === 'true') {
          hasRun.current = true;
          return;
        }

        const localTemplates = await getLocalTemplatesAndClear();

        for (const template of localTemplates) {
          try {
            await createTemplate.mutateAsync({
              name: template.name,
              category_id: template.categoryId,
              notes: template.notes,
              duration_seconds: template.durationSeconds,
              is_billable: template.isBillable,
            });
          } catch (error) {
            console.error(
              '[useMigrateLocalTemplates] Failed to migrate template:',
              template.name,
              error
            );
          }
        }

        await storage.setItem(MIGRATION_FLAG_KEY, 'true');
        hasRun.current = true;
      } catch (error) {
        console.error('[useMigrateLocalTemplates] Migration failed:', error);
      }
    };

    void migrate();
  }, [isAuthenticated, createTemplate]);
}

export type UseEntryTemplatesQueryResult = ReturnType<typeof useEntryTemplatesQuery>;
export type UseCreateEntryTemplateResult = ReturnType<typeof useCreateEntryTemplate>;
export type UseUpdateEntryTemplateResult = ReturnType<typeof useUpdateEntryTemplate>;
export type UseDeleteEntryTemplateResult = ReturnType<typeof useDeleteEntryTemplate>;
