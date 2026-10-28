import { appSchema, tableSchema } from '@nozbe/watermelondb';

export const schema = appSchema({
  version: 1,
  tables: [
    tableSchema({
      name: 'groups',
      columns: [
        { name: 'name', type: 'string' },
        { name: 'currency', type: 'string' },
        { name: 'owner_device_id', type: 'string' },
        { name: 'is_owner', type: 'boolean' },
        { name: 'is_closed', type: 'boolean' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'members',
      columns: [
        { name: 'group_id', type: 'string', isIndexed: true },
        { name: 'name', type: 'string' },
        { name: 'is_owner', type: 'boolean' },
        { name: 'joined_at', type: 'number' },
        { name: 'left_at', type: 'number', isOptional: true },
        { name: 'returned_at', type: 'number', isOptional: true },
        { name: 'created_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'expenses',
      columns: [
        { name: 'group_id', type: 'string', isIndexed: true },
        { name: 'title', type: 'string' },
        { name: 'subtotal', type: 'number' },
        { name: 'tip_amount', type: 'number' },
        { name: 'total_amount', type: 'number' },
        { name: 'category', type: 'string' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'payers',
      columns: [
        { name: 'expense_id', type: 'string', isIndexed: true },
        { name: 'member_id', type: 'string', isIndexed: true },
        { name: 'amount', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'shares',
      columns: [
        { name: 'expense_id', type: 'string', isIndexed: true },
        { name: 'member_id', type: 'string', isIndexed: true },
        { name: 'weight', type: 'number' },
        { name: 'amount', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'confirmations',
      columns: [
        { name: 'expense_id', type: 'string', isIndexed: true },
        { name: 'member_id', type: 'string', isIndexed: true },
        { name: 'is_confirmed', type: 'boolean' },
        { name: 'confirmed_at', type: 'number', isOptional: true },
      ],
    }),
    tableSchema({
      name: 'settlements',
      columns: [
        { name: 'group_id', type: 'string', isIndexed: true },
        { name: 'from_member_id', type: 'string' },
        { name: 'to_member_id', type: 'string' },
        { name: 'amount', type: 'number' },
        { name: 'created_at', type: 'number' },
        { name: 'note', type: 'string', isOptional: true },
      ],
    }),
  ],
});
