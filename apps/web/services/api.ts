// API wrapper for frontend to call internal API routes
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

async function fetchAPI(endpoint: string, options?: RequestInit) {
  const url = `${API_BASE}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.statusText}`);
  }

  return response.json();
}

// Tasks API
export async function getTasks() {
  return fetchAPI('/api/tasks');
}

export async function createTask(data: {
  title: string;
  description?: string;
  dueDate?: string;
  priority?: number;
  projectId?: string;
}) {
  return fetchAPI('/api/tasks', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateTask(id: string, data: Partial<{
  title: string;
  description: string;
  dueDate: string;
  priority: number;
  completed: boolean;
}>) {
  return fetchAPI(`/api/tasks/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteTask(id: string) {
  return fetchAPI(`/api/tasks/${id}`, {
    method: 'DELETE',
  });
}

// Projects API
export async function getProjects() {
  return fetchAPI('/api/projects');
}

export async function createProject(data: {
  name: string;
  description?: string;
  color?: string;
}) {
  return fetchAPI('/api/projects', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// Requests API
export async function getRequests() {
  return fetchAPI('/api/requests');
}

export async function createRequest(data: {
  title: string;
  description?: string;
  plantName?: string;
  symptoms?: string;
}) {
  return fetchAPI('/api/requests', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// Diagnostics API
export async function queryDiagnostics(symptoms: string) {
  return fetchAPI('/api/diagnostics/query', {
    method: 'POST',
    body: JSON.stringify({ symptoms }),
  });
}

export async function importDiagnostics(data: any) {
  return fetchAPI('/api/diagnostics/import', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}
