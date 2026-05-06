// GET /api/agents
//
// Public agent directory. Returns registered agent profiles and their
// recent activity (page_views rows linked via user_id).
//
// Response: { agents: [...], generated_at: ISO }
// Each agent: { display_name, agent_kind, agent_purpose, joined, activity }
// Each activity: { path, event, at }
//
// Auth: none required. All fields returned are explicitly public
// (operator_email is excluded). Cache-Control: public, max-age=60.

import { admin, json, handlePreflight } from './_shared.js';

export default async (req, _context) => {
  const pre = handlePreflight(req);
  if (pre) return pre;
  if (req.method !== 'GET') return json({ error: 'method_not_allowed' }, { status: 405 });

  // Fetch all agent accounts — public fields only (no operator_email).
  const { data: agents, error: agentsErr } = await admin
    .from('accounts')
    .select('user_id, display_name, agent_kind, agent_purpose, created_at')
    .eq('is_agent', true)
    .order('created_at', { ascending: true });

  if (agentsErr) {
    console.error('[agents] accounts query failed:', agentsErr);
    return json({ error: 'internal' }, { status: 500 });
  }

  if (!agents || agents.length === 0) {
    return json(
      { agents: [], generated_at: new Date().toISOString() },
      { headers: { 'cache-control': 'public, max-age=60' } }
    );
  }

  // Fetch recent activity for all agents in a single query.
  const agentIds = agents.map(a => a.user_id);
  const { data: activity, error: actErr } = await admin
    .from('page_views')
    .select('user_id, path, metadata, created_at')
    .in('user_id', agentIds)
    .order('created_at', { ascending: false })
    .limit(200);

  if (actErr) {
    console.warn('[agents] activity query failed (non-fatal):', actErr);
  }

  // Group activity by user_id, cap at 10 per agent.
  const actByAgent = {};
  for (const row of (activity || [])) {
    if (!actByAgent[row.user_id]) actByAgent[row.user_id] = [];
    if (actByAgent[row.user_id].length < 10) {
      actByAgent[row.user_id].push({
        path: row.path,
        event: row.metadata?.event || null,
        at: row.created_at
      });
    }
  }

  const result = agents.map(a => ({
    display_name: a.display_name,
    agent_kind: a.agent_kind || null,
    agent_purpose: a.agent_purpose || null,
    joined: a.created_at,
    activity: actByAgent[a.user_id] || []
  }));

  return json(
    { agents: result, generated_at: new Date().toISOString() },
    { headers: { 'cache-control': 'public, max-age=60' } }
  );
};

export const config = { path: '/api/agents' };
