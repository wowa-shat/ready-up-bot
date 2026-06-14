(async () => {
  // Reads config from window.READYUP_CONFIG set in index.html
  const SUPABASE_URL = window.READYUP_CONFIG?.SUPABASE_URL || 'https://your-project.supabase.co';
  const SUPABASE_KEY = window.READYUP_CONFIG?.SUPABASE_KEY || 'your-supabase-anon-key';
  const BOT_USERNAME = window.READYUP_CONFIG?.BOT_USERNAME || 'your_bot_username';

  const tg = window.Telegram.WebApp;
  tg.ready();
  tg.expand();

  const { createClient } = window.supabase;
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  let currentUser = null;
  let groups = [];
  let events = [];

  // ========== Navigation ==========
  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
  }

  document.querySelectorAll('.btn-back').forEach(btn => {
    btn.addEventListener('click', () => showScreen('main'));
  });

  // Tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.tab + '-tab').classList.add('active');
    });
  });

  // ========== Auth / User ==========
  async function initUser() {
    const initDataUnsafe = tg.initDataUnsafe;
    const telegramUser = initDataUnsafe?.user;

    if (!telegramUser) {
      showError('Open this app from Telegram.');
      return false;
    }

    const { data, error } = await supabase
      .from('users')
      .upsert({
        telegram_id: telegramUser.id,
        username: telegramUser.username || null,
        first_name: telegramUser.first_name || null,
        last_name: telegramUser.last_name || null
      }, { onConflict: 'telegram_id' })
      .select()
      .single();

    if (error) {
      console.error('User upsert error:', error);
      showError('Failed to load user.');
      return false;
    }

    currentUser = data;
    return true;
  }

  // ========== Data Loading ==========
  async function loadGroups() {
    const { data, error } = await supabase
      .from('group_members')
      .select('groups(*)')
      .eq('user_id', currentUser.id);

    if (error) {
      console.error('Load groups error:', error);
      return;
    }

    groups = (data || []).map(row => row.groups).filter(Boolean);
    renderGroups();
  }

  async function loadEvents() {
    if (groups.length === 0) {
      events = [];
      renderEvents();
      return;
    }

    const groupIds = groups.map(g => g.id);
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('events')
      .select('*, groups(name)')
      .in('group_id', groupIds)
      .gte('starts_at', now)
      .neq('status', 'cancelled')
      .order('starts_at', { ascending: true });

    if (error) {
      console.error('Load events error:', error);
      return;
    }

    const loadedEvents = data || [];
    const eventIds = loadedEvents.map(e => e.id);

    // Load responses for all events
    let responsesMap = {};
    if (eventIds.length > 0) {
      const { data: respData } = await supabase
        .from('event_responses')
        .select('event_id, status')
        .in('event_id', eventIds);

      for (const r of (respData || [])) {
        if (!responsesMap[r.event_id]) responsesMap[r.event_id] = { going: 0, maybe: 0, no: 0 };
        responsesMap[r.event_id][r.status]++;
      }
    }

    // Load member counts for all groups
    const { data: membersData } = await supabase
      .from('group_members')
      .select('group_id')
      .in('group_id', groupIds);

    const memberCountMap = {};
    for (const m of (membersData || [])) {
      memberCountMap[m.group_id] = (memberCountMap[m.group_id] || 0) + 1;
    }

    events = loadedEvents.map(e => ({
      ...e,
      _responses: responsesMap[e.id] || { going: 0, maybe: 0, no: 0 },
      _memberCount: memberCountMap[e.group_id] || 0
    }));

    renderEvents();
  }

  async function loadEventResponses(eventId) {
    const { data, error } = await supabase
      .from('event_responses')
      .select('status, users(*)')
      .eq('event_id', eventId)
      .order('updated_at', { ascending: true });

    if (error) {
      console.error('Load responses error:', error);
      return [];
    }

    return data || [];
  }

  async function loadGroupMembers(groupId) {
    const { data, error } = await supabase
      .from('group_members')
      .select('users(*)')
      .eq('group_id', groupId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Load members error:', error);
      return [];
    }

    return (data || []).map(row => row.users).filter(Boolean);
  }

  // ========== Rendering ==========
  function renderGroups() {
    const container = document.getElementById('groups-list');
    if (groups.length === 0) {
      container.innerHTML = '<div class="empty-state">No groups yet. Create one!</div>';
      return;
    }

    container.innerHTML = groups.map(g => `
      <div class="list-item" data-group-id="${g.id}">
        <div class="list-item-title">${escapeHtml(g.name)}</div>
        <div class="list-item-subtitle">Tap to view details</div>
      </div>
    `).join('');

    container.querySelectorAll('.list-item').forEach(item => {
      item.addEventListener('click', () => openGroupDetail(item.dataset.groupId));
    });
  }

  function renderEvents() {
    const container = document.getElementById('events-list');
    if (events.length === 0) {
      container.innerHTML = '<div class="empty-state">No upcoming events.</div>';
      return;
    }

    container.innerHTML = events.map(e => {
      const startsAt = new Date(e.starts_at);
      const relative = formatRelativeTime(startsAt);
      const statusClass = e.status === 'full' ? 'badge-full' : 'badge-open';
      const r = e._responses || { going: 0, maybe: 0, no: 0 };
      const total = r.going + r.maybe + r.no;
      const memberCount = e._memberCount || 0;
      const pctGoing = total > 0 ? (r.going / total * 100) : 0;
      const pctMaybe = total > 0 ? (r.maybe / total * 100) : 0;
      const pctNo = total > 0 ? (r.no / total * 100) : 0;

      let barHtml = '';
      if (total > 0) {
        barHtml = `
          <div class="response-bar">
            ${pctGoing > 0 ? `<div class="response-bar-segment going" style="width:${pctGoing.toFixed(1)}%"></div>` : ''}
            ${pctMaybe > 0 ? `<div class="response-bar-segment maybe" style="width:${pctMaybe.toFixed(1)}%"></div>` : ''}
            ${pctNo > 0 ? `<div class="response-bar-segment no" style="width:${pctNo.toFixed(1)}%"></div>` : ''}
          </div>
          <div class="response-bar-label">${total}/${memberCount} responded</div>
        `;
      } else {
        barHtml = `<div class="response-bar-label">0/${memberCount} responded</div>`;
      }

      return `
        <div class="event-card" data-event-id="${e.id}">
          <span class="event-status-badge ${statusClass}">${e.status}</span>
          <div class="event-card-title">${escapeHtml(e.title)}</div>
          ${e.description ? `<div class="event-card-desc">${escapeHtml(e.description)}</div>` : ''}
          <div class="event-card-meta">${escapeHtml(e.groups?.name || 'Unknown')} &middot; ${relative}</div>
          ${barHtml}
        </div>
      `;
    }).join('');

    container.querySelectorAll('.event-card').forEach(card => {
      card.addEventListener('click', () => openEventDetail(card.dataset.eventId));
    });
  }

  async function openGroupDetail(groupId) {
    const group = groups.find(g => g.id === groupId);
    if (!group) return;

    document.getElementById('group-detail-name').textContent = group.name;
    const content = document.getElementById('group-detail-content');

    const members = await loadGroupMembers(groupId);
    const botUsername = BOT_USERNAME;
    const inviteLink = `https://t.me/${botUsername}?start=join_${group.invite_token}`;

    content.innerHTML = `
      <div class="invite-box">
        <label>Invite link</label>
        <code id="invite-link-code">${escapeHtml(inviteLink)}</code>
        <button class="btn-secondary" id="btn-copy-invite" style="width:100%;margin-top:8px;">Copy to clipboard</button>
      </div>
      <h3 style="margin-top:20px;font-size:15px;font-weight:600;">Members (${members.length})</h3>
      <div class="members-list">
        ${members.map(m => `
          <div class="member-item">
            <div class="member-avatar">${(m.first_name?.[0] || m.username?.[0] || '?').toUpperCase()}</div>
            <div class="member-name">${escapeHtml(m.first_name || m.username || m.telegram_id)}</div>
          </div>
        `).join('')}
      </div>
      ${group.creator_id === currentUser.id ? `
        <div style="margin-top:20px;">
          <button class="btn-destructive" id="btn-delete-group" style="width:100%;">Delete Group</button>
        </div>
      ` : ''}
    `;

    const deleteBtn = document.getElementById('btn-delete-group');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', async () => {
        if (!confirm('Delete this group?')) return;
        const { error } = await supabase.from('groups').delete().eq('id', groupId).eq('creator_id', currentUser.id);
        if (error) {
          tg.showAlert('Failed to delete group.');
          return;
        }
        await loadGroups();
        showScreen('main');
      });
    }

    const copyBtn = document.getElementById('btn-copy-invite');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(inviteLink).then(() => {
          tg.showPopup({ title: 'Copied', message: 'Invite link copied to clipboard!' });
        }).catch(() => {
          tg.showAlert('Failed to copy link.');
        });
      });
    }

    showScreen('group-detail');
  }

  async function openEventDetail(eventId) {
    const event = events.find(e => e.id === eventId);
    if (!event) return;

    document.getElementById('event-detail-title').textContent = event.title;
    const content = document.getElementById('event-detail-content');

    const responses = await loadEventResponses(eventId);
    const grouped = { going: [], maybe: [], no: [] };
    for (const r of responses) {
      const label = r.users?.username || r.users?.first_name || 'User';
      grouped[r.status].push(escapeHtml(label));
    }

    const myResponse = responses.find(r => r.users?.id === currentUser.id);
    const isCreator = event.creator_id === currentUser.id;
    const startsAt = new Date(event.starts_at);
    const relative = formatRelativeTime(startsAt);

    content.innerHTML = `
      <div class="event-card" style="margin-bottom:16px;">
        <span class="event-status-badge ${event.status === 'full' ? 'badge-full' : 'badge-open'}">${event.status}</span>
        ${event.description ? `<div class="event-card-desc">${escapeHtml(event.description)}</div>` : ''}
        <div class="event-card-meta">${escapeHtml(event.groups?.name || 'Unknown')} &middot; ${relative}</div>
        ${event.required_players ? `<div class="event-card-meta">Required: ${event.required_players} players</div>` : ''}
      </div>

      <div class="response-buttons">
        <button class="response-btn going ${myResponse?.status === 'going' ? 'selected' : ''}" data-status="going">Going</button>
        <button class="response-btn maybe ${myResponse?.status === 'maybe' ? 'selected' : ''}" data-status="maybe">Maybe</button>
        <button class="response-btn no ${myResponse?.status === 'no' ? 'selected' : ''}" data-status="no">No</button>
      </div>

      <div class="responses-summary">
        <div class="response-row"><span>Going</span><span class="count">${grouped.going.length}</span></div>
        <div class="response-row"><span>Maybe</span><span class="count">${grouped.maybe.length}</span></div>
        <div class="response-row"><span>No</span><span class="count">${grouped.no.length}</span></div>
      </div>

      <div style="margin-top:12px;font-size:13px;color:var(--tg-hint);">
        ${grouped.going.length > 0 ? `<div>Going: ${grouped.going.join(', ')}</div>` : ''}
        ${grouped.maybe.length > 0 ? `<div>Maybe: ${grouped.maybe.join(', ')}</div>` : ''}
        ${grouped.no.length > 0 ? `<div>No: ${grouped.no.join(', ')}</div>` : ''}
      </div>

      ${isCreator && event.status !== 'cancelled' ? `
        <div style="margin-top:20px;">
          <button class="btn-destructive" id="btn-cancel-event" style="width:100%;">Cancel Event</button>
        </div>
      ` : ''}
    `;

    content.querySelectorAll('.response-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const status = btn.dataset.status;
        await saveResponse(eventId, status);
        await openEventDetail(eventId);
      });
    });

    const cancelBtn = document.getElementById('btn-cancel-event');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', async () => {
        if (!confirm('Cancel this event?')) return;
        const { error } = await supabase.from('events').update({ status: 'cancelled' }).eq('id', eventId);
        if (error) {
          tg.showAlert('Failed to cancel event.');
          return;
        }
        tg.showAlert('Event cancelled.');
        await loadEvents();
        showScreen('main');
      });
    }

    showScreen('event-detail');
  }

  // ========== Actions ==========
  async function saveResponse(eventId, status) {
    const { error } = await supabase
      .from('event_responses')
      .upsert({ event_id: eventId, user_id: currentUser.id, status }, { onConflict: 'event_id,user_id' });

    if (error) {
      console.error('Save response error:', error);
      tg.showAlert('Failed to save response.');
      return;
    }

    // Recompute event status
    const { data: responses } = await supabase
      .from('event_responses')
      .select('status')
      .eq('event_id', eventId);

    const goingCount = (responses || []).filter(r => r.status === 'going').length;
    const { data: event } = await supabase.from('events').select('required_players').eq('id', eventId).single();
    const newStatus = event?.required_players && goingCount >= event.required_players ? 'full' : 'open';

    await supabase.from('events').update({ status: newStatus }).eq('id', eventId);
  }

  // Create group
  document.getElementById('btn-create-group').addEventListener('click', () => {
    document.getElementById('group-name-input').value = '';
    showScreen('create-group');
  });

  document.getElementById('btn-submit-group').addEventListener('click', async () => {
    const name = document.getElementById('group-name-input').value.trim();
    if (!name) {
      tg.showAlert('Enter a group name.');
      return;
    }

    tg.MainButton.setText('Creating...').show().setParams({ is_active: false });

    const { data, error } = await supabase.rpc('create_group', {
      p_name: name,
      p_creator_id: currentUser.id
    });

    // Fallback if RPC not available
    if (error && error.message.includes('create_group')) {
      const token = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(9)))).replace(/[^a-zA-Z0-9]/g, '').slice(0, 8);
      const { data: group, error: err2 } = await supabase
        .from('groups')
        .insert({ name, creator_id: currentUser.id, invite_token: token })
        .select()
        .single();

      if (!err2 && group) {
        await supabase.from('group_members').insert({ group_id: group.id, user_id: currentUser.id });
      }
    }

    tg.MainButton.hide();
    if (error && !error.message.includes('create_group')) {
      tg.showAlert('Failed to create group.');
      return;
    }

    await loadGroups();
    showScreen('main');
  });

  // Create event
  document.getElementById('btn-create-event').addEventListener('click', () => {
    const select = document.getElementById('event-group-select');
    select.innerHTML = groups.map(g => `<option value="${g.id}">${escapeHtml(g.name)}</option>`).join('');
    document.getElementById('event-title-input').value = '';
    document.getElementById('event-desc-input').value = '';
    document.getElementById('event-minutes-input').value = '';
    document.getElementById('event-players-input').value = '';
    showScreen('create-event');
  });

  document.getElementById('btn-submit-event').addEventListener('click', async () => {
    const groupId = document.getElementById('event-group-select').value;
    const title = document.getElementById('event-title-input').value.trim();
    const description = document.getElementById('event-desc-input').value.trim() || null;
    const minutes = parseInt(document.getElementById('event-minutes-input').value, 10);
    const requiredPlayers = parseInt(document.getElementById('event-players-input').value, 10) || null;

    if (!title || !Number.isInteger(minutes) || minutes < 0) {
      tg.showAlert('Enter a title and valid start time.');
      return;
    }

    const startsAt = new Date(Date.now() + minutes * 60000).toISOString();

    const { error } = await supabase
      .from('events')
      .insert({
        group_id: groupId,
        creator_id: currentUser.id,
        title,
        description,
        starts_at: startsAt,
        required_players: requiredPlayers,
        status: 'open'
      });

    if (error) {
      console.error('Create event error:', error);
      tg.showAlert('Failed to create event.');
      return;
    }

    await loadEvents();
    showScreen('main');
  });

  // ========== Helpers ==========
  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function formatRelativeTime(date) {
    const now = new Date();
    const diffMs = date - now;
    const diffMin = Math.round(diffMs / 60000);

    if (diffMin < 0) return 'Started';
    if (diffMin < 60) return `in ${diffMin} min`;
    const diffH = Math.round(diffMin / 60);
    if (diffH < 24) return `in ${diffH} h`;
    const diffD = Math.round(diffH / 24);
    return `in ${diffD} d`;
  }

  function showError(msg) {
    document.getElementById('loading').innerHTML = `<p style="color:#ff3b30;">${escapeHtml(msg)}</p>`;
  }

  // ========== Init ==========
  showScreen('loading');
  const ok = await initUser();
  if (ok) {
    await loadGroups();
    await loadEvents();
    showScreen('main');
  }
})();
