export async function api(path, body) {
  let res;
  try {
    res = await fetch(path, body === undefined ? undefined : {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error('The API server is not reachable. Is `npm run dev` still running?');
  }
  let data = null;
  try { data = await res.json(); } catch {}
  if (!res.ok) {
    const err = new Error(data?.error ?? `The API answered HTTP ${res.status}.`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const clock = (date) => {
  const when = new Date(date);
  const hms = when.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  return `${hms}.${String(when.getMilliseconds()).padStart(3, '0')}`;
};
