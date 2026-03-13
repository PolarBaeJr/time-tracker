/**
 * Note Schema Tests
 *
 * Tests all note Zod schemas with valid and invalid inputs.
 * Tests NoteSchema, CreateNoteSchema, UpdateNoteSchema, and NotesFilterSchema.
 */

import { NoteSchema, CreateNoteSchema, UpdateNoteSchema, NotesFilterSchema } from '@/schemas/note';

describe('Note Schemas', () => {
  // ============================================================================
  // NoteSchema Tests
  // ============================================================================

  describe('NoteSchema', () => {
    const validNote = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      user_id: '123e4567-e89b-12d3-a456-426614174001',
      title: 'Meeting Notes',
      content: 'Discussed project timeline and milestones.',
      category_id: '123e4567-e89b-12d3-a456-426614174002',
      time_entry_id: '123e4567-e89b-12d3-a456-426614174003',
      pinned: true,
      created_at: '2024-03-01T10:00:00.000Z',
      updated_at: '2024-03-01T10:30:00.000Z',
      deleted_at: null,
    };

    it('should accept valid note data', () => {
      const result = NoteSchema.safeParse(validNote);
      expect(result.success).toBe(true);
    });

    it('should require valid UUID for id', () => {
      const result = NoteSchema.safeParse({ ...validNote, id: 'invalid' });
      expect(result.success).toBe(false);
    });

    it('should require valid UUID for user_id', () => {
      const result = NoteSchema.safeParse({ ...validNote, user_id: 'invalid' });
      expect(result.success).toBe(false);
    });

    it('should allow null category_id', () => {
      const result = NoteSchema.safeParse({ ...validNote, category_id: null });
      expect(result.success).toBe(true);
    });

    it('should require valid UUID for category_id when not null', () => {
      const result = NoteSchema.safeParse({ ...validNote, category_id: 'invalid' });
      expect(result.success).toBe(false);
    });

    it('should allow null time_entry_id', () => {
      const result = NoteSchema.safeParse({ ...validNote, time_entry_id: null });
      expect(result.success).toBe(true);
    });

    it('should require valid UUID for time_entry_id when not null', () => {
      const result = NoteSchema.safeParse({ ...validNote, time_entry_id: 'invalid' });
      expect(result.success).toBe(false);
    });

    it('should allow null content', () => {
      const result = NoteSchema.safeParse({ ...validNote, content: null });
      expect(result.success).toBe(true);
    });

    it('should validate title max length (200)', () => {
      const maxTitle = 'a'.repeat(200);
      expect(NoteSchema.safeParse({ ...validNote, title: maxTitle }).success).toBe(true);

      const tooLongTitle = 'a'.repeat(201);
      expect(NoteSchema.safeParse({ ...validNote, title: tooLongTitle }).success).toBe(false);
    });

    it('should validate content max length (10000)', () => {
      const maxContent = 'a'.repeat(10000);
      expect(NoteSchema.safeParse({ ...validNote, content: maxContent }).success).toBe(true);

      const tooLongContent = 'a'.repeat(10001);
      expect(NoteSchema.safeParse({ ...validNote, content: tooLongContent }).success).toBe(false);
    });

    it('should default pinned to false', () => {
      const { pinned, ...withoutPinned } = validNote;
      const result = NoteSchema.safeParse(withoutPinned);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.pinned).toBe(false);
      }
    });

    it('should require valid datetime for created_at', () => {
      const result = NoteSchema.safeParse({ ...validNote, created_at: 'invalid-date' });
      expect(result.success).toBe(false);
    });

    it('should require valid datetime for updated_at', () => {
      const result = NoteSchema.safeParse({ ...validNote, updated_at: 'invalid-date' });
      expect(result.success).toBe(false);
    });

    it('should allow null deleted_at', () => {
      const result = NoteSchema.safeParse({ ...validNote, deleted_at: null });
      expect(result.success).toBe(true);
    });

    it('should allow optional deleted_at', () => {
      const { deleted_at, ...withoutDeletedAt } = validNote;
      const result = NoteSchema.safeParse(withoutDeletedAt);
      expect(result.success).toBe(true);
    });

    it('should reject missing required fields', () => {
      const { id, ...withoutId } = validNote;
      expect(NoteSchema.safeParse(withoutId).success).toBe(false);

      const { user_id, ...withoutUserId } = validNote;
      expect(NoteSchema.safeParse(withoutUserId).success).toBe(false);

      const { title, ...withoutTitle } = validNote;
      expect(NoteSchema.safeParse(withoutTitle).success).toBe(false);
    });
  });

  // ============================================================================
  // CreateNoteSchema Tests
  // ============================================================================

  describe('CreateNoteSchema', () => {
    const validCreate = {
      title: 'New Note',
      content: 'Some content here',
      category_id: '123e4567-e89b-12d3-a456-426614174000',
      time_entry_id: '123e4567-e89b-12d3-a456-426614174001',
      pinned: false,
    };

    it('should accept valid create data', () => {
      const result = CreateNoteSchema.safeParse(validCreate);
      expect(result.success).toBe(true);
    });

    it('should reject empty title', () => {
      const result = CreateNoteSchema.safeParse({ ...validCreate, title: '' });
      expect(result.success).toBe(false);
    });

    it('should require title (not optional)', () => {
      const { title, ...withoutTitle } = validCreate;
      const result = CreateNoteSchema.safeParse(withoutTitle);
      expect(result.success).toBe(false);
    });

    it('should validate title min length (1)', () => {
      const result = CreateNoteSchema.safeParse({ ...validCreate, title: 'a' });
      expect(result.success).toBe(true);
    });

    it('should validate title max length (200)', () => {
      const maxTitle = 'a'.repeat(200);
      expect(CreateNoteSchema.safeParse({ ...validCreate, title: maxTitle }).success).toBe(true);

      const tooLongTitle = 'a'.repeat(201);
      expect(CreateNoteSchema.safeParse({ ...validCreate, title: tooLongTitle }).success).toBe(
        false
      );
    });

    it('should allow optional content', () => {
      const { content, ...withoutContent } = validCreate;
      const result = CreateNoteSchema.safeParse(withoutContent);
      expect(result.success).toBe(true);
    });

    it('should allow null content', () => {
      const result = CreateNoteSchema.safeParse({ ...validCreate, content: null });
      expect(result.success).toBe(true);
    });

    it('should validate content max length (10000)', () => {
      const maxContent = 'a'.repeat(10000);
      expect(CreateNoteSchema.safeParse({ ...validCreate, content: maxContent }).success).toBe(
        true
      );

      const tooLongContent = 'a'.repeat(10001);
      expect(CreateNoteSchema.safeParse({ ...validCreate, content: tooLongContent }).success).toBe(
        false
      );
    });

    it('should allow optional category_id', () => {
      const { category_id, ...withoutCategoryId } = validCreate;
      const result = CreateNoteSchema.safeParse(withoutCategoryId);
      expect(result.success).toBe(true);
    });

    it('should allow null category_id', () => {
      const result = CreateNoteSchema.safeParse({ ...validCreate, category_id: null });
      expect(result.success).toBe(true);
    });

    it('should require valid UUID for category_id when provided', () => {
      const result = CreateNoteSchema.safeParse({ ...validCreate, category_id: 'invalid' });
      expect(result.success).toBe(false);
    });

    it('should allow optional time_entry_id', () => {
      const { time_entry_id, ...withoutTimeEntryId } = validCreate;
      const result = CreateNoteSchema.safeParse(withoutTimeEntryId);
      expect(result.success).toBe(true);
    });

    it('should allow optional pinned', () => {
      const { pinned, ...withoutPinned } = validCreate;
      const result = CreateNoteSchema.safeParse(withoutPinned);
      expect(result.success).toBe(true);
    });

    it('should REJECT server-managed fields', () => {
      const schema = CreateNoteSchema.shape;

      // These fields should NOT be in CreateNoteSchema
      expect('id' in schema).toBe(false);
      expect('user_id' in schema).toBe(false);
      expect('created_at' in schema).toBe(false);
      expect('updated_at' in schema).toBe(false);
      expect('deleted_at' in schema).toBe(false);
    });

    it('should accept minimal valid data (title only)', () => {
      const result = CreateNoteSchema.safeParse({ title: 'Minimal Note' });
      expect(result.success).toBe(true);
    });
  });

  // ============================================================================
  // UpdateNoteSchema Tests
  // ============================================================================

  describe('UpdateNoteSchema', () => {
    it('should accept valid update with title', () => {
      const result = UpdateNoteSchema.safeParse({ title: 'Updated Title' });
      expect(result.success).toBe(true);
    });

    it('should accept valid update with content', () => {
      const result = UpdateNoteSchema.safeParse({ content: 'Updated content' });
      expect(result.success).toBe(true);
    });

    it('should accept null content', () => {
      const result = UpdateNoteSchema.safeParse({ content: null });
      expect(result.success).toBe(true);
    });

    it('should accept valid update with pinned', () => {
      const result = UpdateNoteSchema.safeParse({ pinned: true });
      expect(result.success).toBe(true);
    });

    it('should accept empty object (no updates)', () => {
      const result = UpdateNoteSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should reject empty title when provided', () => {
      const result = UpdateNoteSchema.safeParse({ title: '' });
      expect(result.success).toBe(false);
    });

    it('should validate title max length (200) when provided', () => {
      const maxTitle = 'a'.repeat(200);
      expect(UpdateNoteSchema.safeParse({ title: maxTitle }).success).toBe(true);

      const tooLongTitle = 'a'.repeat(201);
      expect(UpdateNoteSchema.safeParse({ title: tooLongTitle }).success).toBe(false);
    });

    it('should validate content max length (10000) when provided', () => {
      const maxContent = 'a'.repeat(10000);
      expect(UpdateNoteSchema.safeParse({ content: maxContent }).success).toBe(true);

      const tooLongContent = 'a'.repeat(10001);
      expect(UpdateNoteSchema.safeParse({ content: tooLongContent }).success).toBe(false);
    });

    it('should allow null category_id', () => {
      const result = UpdateNoteSchema.safeParse({ category_id: null });
      expect(result.success).toBe(true);
    });

    it('should require valid UUID for category_id when provided and not null', () => {
      const validResult = UpdateNoteSchema.safeParse({
        category_id: '123e4567-e89b-12d3-a456-426614174000',
      });
      expect(validResult.success).toBe(true);

      const invalidResult = UpdateNoteSchema.safeParse({ category_id: 'invalid' });
      expect(invalidResult.success).toBe(false);
    });

    it('should REJECT server-managed fields', () => {
      const schema = UpdateNoteSchema.shape;

      expect('id' in schema).toBe(false);
      expect('user_id' in schema).toBe(false);
      expect('created_at' in schema).toBe(false);
      expect('updated_at' in schema).toBe(false);
      expect('deleted_at' in schema).toBe(false);
    });
  });

  // ============================================================================
  // NotesFilterSchema Tests
  // ============================================================================

  describe('NotesFilterSchema', () => {
    it('should accept valid filter with all fields', () => {
      const result = NotesFilterSchema.safeParse({
        search: 'meeting',
        categoryId: '123e4567-e89b-12d3-a456-426614174000',
        pinnedOnly: true,
        sortBy: 'created_at',
        sortOrder: 'desc',
      });
      expect(result.success).toBe(true);
    });

    it('should accept empty object (all optional)', () => {
      const result = NotesFilterSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should provide default sortBy', () => {
      const result = NotesFilterSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.sortBy).toBe('created_at');
      }
    });

    it('should provide default sortOrder', () => {
      const result = NotesFilterSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.sortOrder).toBe('desc');
      }
    });

    it('should allow optional search', () => {
      const result = NotesFilterSchema.safeParse({ search: 'test query' });
      expect(result.success).toBe(true);
    });

    it('should require valid UUID for categoryId when provided', () => {
      const validResult = NotesFilterSchema.safeParse({
        categoryId: '123e4567-e89b-12d3-a456-426614174000',
      });
      expect(validResult.success).toBe(true);

      const invalidResult = NotesFilterSchema.safeParse({ categoryId: 'invalid' });
      expect(invalidResult.success).toBe(false);
    });

    it('should accept boolean for pinnedOnly', () => {
      expect(NotesFilterSchema.safeParse({ pinnedOnly: true }).success).toBe(true);
      expect(NotesFilterSchema.safeParse({ pinnedOnly: false }).success).toBe(true);
    });

    it('should validate sortBy enum values', () => {
      expect(NotesFilterSchema.safeParse({ sortBy: 'created_at' }).success).toBe(true);
      expect(NotesFilterSchema.safeParse({ sortBy: 'updated_at' }).success).toBe(true);
      expect(NotesFilterSchema.safeParse({ sortBy: 'title' }).success).toBe(true);
      expect(NotesFilterSchema.safeParse({ sortBy: 'invalid' }).success).toBe(false);
    });

    it('should validate sortOrder enum values', () => {
      expect(NotesFilterSchema.safeParse({ sortOrder: 'asc' }).success).toBe(true);
      expect(NotesFilterSchema.safeParse({ sortOrder: 'desc' }).success).toBe(true);
      expect(NotesFilterSchema.safeParse({ sortOrder: 'invalid' }).success).toBe(false);
    });
  });
});
