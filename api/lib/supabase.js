import { createClient } from '@supabase/supabase-js';

let _client = null;

function getClient() {
  if (_client) return _client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  _client = createClient(url, key);
  return _client;
}

/**
 * Log a demo usage to Supabase.
 * Fires and forgets — never throws, so a DB error never breaks a demo.
 */
export async function logDemo(demoType, inputData, result, metadata = {}) {
  const client = getClient();
  if (!client) return; // Supabase env vars not set — skip silently
  try {
    await client.from('demo_logs').insert({
      demo_type: demoType,
      input_data: inputData,
      result,
      metadata,
    });
  } catch (err) {
    console.error('[supabase] log error:', err?.message);
  }
}

export async function saveWsDraft(row) {
  const client = getClient();
  if (!client) return null;
  try {
    const { data, error } = await client
      .from('proto_ws_drafts')
      .insert(row)
      .select('id')
      .single();
    if (error) throw error;
    return data?.id || null;
  } catch (err) {
    console.error('[supabase] saveWsDraft error:', err?.message);
    return null;
  }
}

export async function saveWsFeedback(row) {
  const client = getClient();
  if (!client) return null;
  try {
    const { data, error } = await client
      .from('proto_ws_feedback')
      .insert(row)
      .select('id')
      .single();
    if (error) throw error;
    return data?.id || null;
  } catch (err) {
    console.error('[supabase] saveWsFeedback error:', err?.message);
    return null;
  }
}

export async function listWsFeedback({ limit = 20, includeEphemeral = false } = {}) {
  const client = getClient();
  if (!client) return [];
  try {
    let q = client
      .from('proto_ws_feedback')
      .select('id, created_at, kind, rule, target, notes, ephemeral, draft_id')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (!includeEphemeral) q = q.eq('ephemeral', false);
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('[supabase] listWsFeedback error:', err?.message);
    return [];
  }
}

export async function getWsDraft(id) {
  const client = getClient();
  if (!client || !id) return null;
  try {
    const { data, error } = await client
      .from('proto_ws_drafts')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  } catch (err) {
    console.error('[supabase] getWsDraft error:', err?.message);
    return null;
  }
}

export async function listWsDrafts(limit = 30) {
  const client = getClient();
  if (!client) return [];
  try {
    const { data, error } = await client
      .from('proto_ws_drafts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('[supabase] listWsDrafts error:', err?.message);
    return [];
  }
}
