import { Model, Query, Relation } from '@nozbe/watermelondb';
import { field, date, children, relation, readonly, writer } from '@nozbe/watermelondb/decorators';

export class Group extends Model {
  static table = 'groups';
  static associations = {
    members: { type: 'has_many' as const, foreignKey: 'group_id' },
    expenses: { type: 'has_many' as const, foreignKey: 'group_id' },
    settlements: { type: 'has_many' as const, foreignKey: 'group_id' },
  };

  @field('name') name!: string;
  @field('currency') currency!: string;
  @field('owner_device_id') ownerDeviceId!: string;
  @field('is_owner') isOwner!: boolean;
  @field('is_closed') isClosed!: boolean;
  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;

  @children('members') members!: Query<Member>;
  @children('expenses') expenses!: Query<Expense>;
  @children('settlements') settlements!: Query<Settlement>;
}

export class Member extends Model {
  static table = 'members';
  static associations = {
    groups: { type: 'belongs_to' as const, key: 'group_id' },
  };

  @field('group_id') groupId!: string;
  @field('name') name!: string;
  @field('is_owner') isOwner!: boolean;
  @date('joined_at') joinedAt!: Date;
  @date('left_at') leftAt!: Date | null;
  @date('returned_at') returnedAt!: Date | null;
  @readonly @date('created_at') createdAt!: Date;

  get isActive(): boolean {
    return this.leftAt === null;
  }
}

export class Expense extends Model {
  static table = 'expenses';
  static associations = {
    groups: { type: 'belongs_to' as const, key: 'group_id' },
    payers: { type: 'has_many' as const, foreignKey: 'expense_id' },
    shares: { type: 'has_many' as const, foreignKey: 'expense_id' },
    confirmations: { type: 'has_many' as const, foreignKey: 'expense_id' },
  };

  @field('group_id') groupId!: string;
  @field('title') title!: string;
  @field('subtotal') subtotal!: number;
  @field('tip_amount') tipAmount!: number;
  @field('total_amount') totalAmount!: number;
  @field('category') category!: string;
  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;

  @children('payers') payers!: Query<Payer>;
  @children('shares') shares!: Query<Share>;
  @children('confirmations') confirmations!: Query<Confirmation>;
}

export class Payer extends Model {
  static table = 'payers';
  static associations = {
    expenses: { type: 'belongs_to' as const, key: 'expense_id' },
    members: { type: 'belongs_to' as const, key: 'member_id' },
  };

  @field('expense_id') expenseId!: string;
  @field('member_id') memberId!: string;
  @field('amount') amount!: number;
}

export class Share extends Model {
  static table = 'shares';
  static associations = {
    expenses: { type: 'belongs_to' as const, key: 'expense_id' },
    members: { type: 'belongs_to' as const, key: 'member_id' },
  };

  @field('expense_id') expenseId!: string;
  @field('member_id') memberId!: string;
  @field('weight') weight!: number;
  @field('amount') amount!: number;
}

export class Confirmation extends Model {
  static table = 'confirmations';
  static associations = {
    expenses: { type: 'belongs_to' as const, key: 'expense_id' },
    members: { type: 'belongs_to' as const, key: 'member_id' },
  };

  @field('expense_id') expenseId!: string;
  @field('member_id') memberId!: string;
  @field('is_confirmed') isConfirmed!: boolean;
  @date('confirmed_at') confirmedAt!: Date | null;
}

export class Settlement extends Model {
  static table = 'settlements';
  static associations = {
    groups: { type: 'belongs_to' as const, key: 'group_id' },
  };

  @field('group_id') groupId!: string;
  @field('from_member_id') fromMemberId!: string;
  @field('to_member_id') toMemberId!: string;
  @field('amount') amount!: number;
  @readonly @date('created_at') createdAt!: Date;
  @field('note') note!: string | null;
}

export function raw(model: any): Record<string, any> {
  return model._raw;
}

