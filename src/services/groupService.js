const { supabase } = require('../db/supabase');
const { randomBytes } = require('crypto');

async function createGroup(name, creatorId) {
  const inviteToken = await createUniqueInviteToken();
  const { data: group, error } = await supabase
    .from('groups')
    .insert({ name, creator_id: creatorId, invite_token: inviteToken })
    .select()
    .single();

  if (error) {
    throw error;
  }

  await addMember(group.id, creatorId);
  return group;
}

async function createUniqueInviteToken() {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const token = randomBytes(6).toString('base64url');
    const existing = await getGroupByInviteToken(token);

    if (!existing) {
      return token;
    }
  }

  throw new Error('Failed to create a unique invite token.');
}

async function addMember(groupId, userId) {
  const { data, error } = await supabase
    .from('group_members')
    .upsert({ group_id: groupId, user_id: userId }, { onConflict: 'group_id,user_id' })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

async function getGroupForAdmin(groupId, userId) {
  const { data, error } = await supabase
    .from('groups')
    .select('*')
    .eq('id', groupId)
    .eq('creator_id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

async function getGroupByInviteToken(inviteToken) {
  const { data, error } = await supabase
    .from('groups')
    .select('*')
    .eq('invite_token', inviteToken)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

async function deleteGroupForAdmin(groupId, userId) {
  const group = await getGroupForAdmin(groupId, userId);

  if (!group) {
    return null;
  }

  const { error } = await supabase
    .from('groups')
    .delete()
    .eq('id', groupId)
    .eq('creator_id', userId);

  if (error) {
    throw error;
  }

  return group;
}

async function getGroupForMember(groupId, userId) {
  const { data, error } = await supabase
    .from('group_members')
    .select('groups(*)')
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data?.groups || null;
}

async function listGroupsForUser(userId) {
  const { data, error } = await supabase
    .from('group_members')
    .select('groups(*)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return data.map((row) => row.groups).filter(Boolean);
}

async function listGroupMembers(groupId) {
  const { data, error } = await supabase
    .from('group_members')
    .select('users(*)')
    .eq('group_id', groupId)
    .order('created_at', { ascending: true });

  if (error) {
    throw error;
  }

  return data;
}

module.exports = {
  addMember,
  createGroup,
  deleteGroupForAdmin,
  getGroupByInviteToken,
  getGroupForAdmin,
  getGroupForMember,
  listGroupMembers,
  listGroupsForUser
};
