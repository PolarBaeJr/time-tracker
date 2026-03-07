import { z } from 'zod';

export const EntryAttachmentSchema = z.object({
  id: z.string().uuid(),
  time_entry_id: z.string().uuid(),
  user_id: z.string().uuid(),
  file_name: z.string().min(1),
  file_size: z.number().int().positive(),
  content_type: z.string().min(1),
  storage_path: z.string().min(1),
  created_at: z.string().datetime({ offset: true }),
});

export type EntryAttachment = z.infer<typeof EntryAttachmentSchema>;
