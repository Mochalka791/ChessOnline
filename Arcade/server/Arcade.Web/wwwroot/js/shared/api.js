export async function apiGet(url, signal) {
  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw await buildError(response);
  }
  return response.json();
}

export async function apiPost(url, body, signal) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
    signal,
  });

  if (!response.ok) {
    throw await buildError(response);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

async function buildError(response) {
  let detail = response.statusText;
  try {
    const data = await response.json();
    detail = data.detail ?? data.message ?? detail;
  } catch (_) {
    // ignore
  }
  const error = new Error(detail);
  error.status = response.status;
  return error;
}
