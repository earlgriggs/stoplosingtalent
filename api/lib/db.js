// Minimal Supabase (PostgREST) client using the service-role key, which is
// the only key allowed to touch the feedback tables and functions.

function config() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase is not configured");
  return { url, key };
}

async function request(path, { method = "GET", body, prefer } = {}) {
  const { url, key } = config();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(prefer ? { Prefer: prefer } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const err = new Error(data?.message || `Supabase error ${response.status}`);
    err.status = response.status;
    err.details = data;
    throw err;
  }
  return data;
}

export const rpc = (name, args = {}) =>
  request(`rpc/${name}`, { method: "POST", body: args });

export const select = (table, query) => request(`${table}?${query}`);

export const insert = (table, rows) =>
  request(table, { method: "POST", body: rows, prefer: "return=minimal" });

export const update = (table, query, values) =>
  request(`${table}?${query}`, {
    method: "PATCH",
    body: values,
    prefer: "return=minimal",
  });
