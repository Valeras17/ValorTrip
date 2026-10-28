import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { Q } from '@nozbe/watermelondb';
import { withObservables } from '@nozbe/watermelondb/react';
import { database, Group } from '@/db';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState, SectionHeader } from '@/components/ui/EmptyState';
import { formatMoney } from '@/lib/money';

// ── Group card ──────────────────────────────────────────────────────────────

interface GroupCardProps {
  group: Group;
}

function GroupCardRaw({ group }: GroupCardProps) {
  const [memberCount, setMemberCount] = useState(0);

  useEffect(() => {
    group.members.fetchCount().then(setMemberCount).catch(console.error);
  }, [group]);

  return (
    <TouchableOpacity
      onPress={() => router.push(`/group/${group.id}`)}
      activeOpacity={0.8}
    >
      <Card className="mb-3 mx-4">
        <View className="flex-row items-start justify-between">
          <View className="flex-1 mr-3">
            <Text className="text-white font-bold text-lg" numberOfLines={1}>
              {group.name}
            </Text>
            <Text className="text-slate-400 text-sm mt-0.5">
              {memberCount} {memberCount === 1 ? 'member' : 'members'} ·{' '}
              {group.currency}
            </Text>
          </View>
          {group.isClosed && (
            <View className="bg-slate-700 rounded-full px-2.5 py-1">
              <Text className="text-slate-300 text-xs font-medium">Closed</Text>
            </View>
          )}
          {!group.isClosed && group.isOwner && (
            <View className="bg-brand-500/20 rounded-full px-2.5 py-1">
              <Text className="text-brand-300 text-xs font-medium">Owner</Text>
            </View>
          )}
          {!group.isOwner && (
            <View className="bg-accent-500/20 rounded-full px-2.5 py-1">
              <Text className="text-accent-400 text-xs font-medium">Observer</Text>
            </View>
          )}
        </View>
      </Card>
    </TouchableOpacity>
  );
}

// ── Main screen ──────────────────────────────────────────────────────────────

interface HomeScreenProps {
  myGroups: Group[];
  receivedGroups: Group[];
}

function HomeScreenInner({ myGroups, receivedGroups }: HomeScreenProps) {
  const hasGroups = myGroups.length > 0 || receivedGroups.length > 0;

  return (
    <View className="flex-1 bg-surface-950">
      {/* Header gradient strip */}
      <View className="px-4 pt-4 pb-2">
        <View className="flex-row gap-2">
          <Button
            label="New Trip"
            variant="primary"
            size="md"
            onPress={() => router.push('/create-group')}
            style={{ flex: 1 }}
            fullWidth
          />
          <Button
            label="Scan QR"
            variant="secondary"
            size="md"
            onPress={() => router.push('/join-group')}
            style={{ flex: 1 }}
            fullWidth
          />
        </View>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {!hasGroups && (
          <EmptyState
            emoji="🗺️"
            title="No trips yet"
            subtitle="Create your first trip or scan a QR code to join one."
          />
        )}

        {myGroups.length > 0 && (
          <>
            <SectionHeader title="My Trips" count={myGroups.length} />
            {myGroups.map((g) => (
              <GroupCardRaw key={g.id} group={g} />
            ))}
          </>
        )}

        {receivedGroups.length > 0 && (
          <>
            <SectionHeader title="Received" count={receivedGroups.length} />
            {receivedGroups.map((g) => (
              <GroupCardRaw key={g.id} group={g} />
            ))}
          </>
        )}

        <View className="h-8" />
      </ScrollView>
    </View>
  );
}

// WatermelonDB reactive wrapper
const enhance = withObservables([], () => ({
  myGroups: database
    .get<Group>('groups')
    .query(Q.where('is_owner', true))
    .observeWithColumns(['name', 'currency', 'is_closed']),
  receivedGroups: database
    .get<Group>('groups')
    .query(Q.where('is_owner', false))
    .observeWithColumns(['name', 'currency', 'is_closed']),
}));

const HomeScreen = enhance(HomeScreenInner as any);
export default HomeScreen;
