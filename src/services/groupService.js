const { supabase } = require('../db/supabase');

async function createGroup(name, creatorId) {
  const { data: group, error } = await supabase
    .from('groups')
    .insert({ name, creator_id: creatorId })
    .select()
    .single();

  if (error) {
    throw error;
  }

  await addMember(group.id, creatorId);
  return group;
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
  getGroupForAdmin,
  getGroupForMember,
  listGroupMembers,
  listGroupsForUser
};
