import { useEffect, useState } from 'react';
import { getRequests } from '@/services/api';

interface Request {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority: number;
  plantName?: string;
  symptoms?: string;
  createdAt: string;
}

export default function RequestsPage() {
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadRequests() {
      try {
        const data = await getRequests();
        setRequests(data);
      } catch (error) {
        console.error('Failed to load requests:', error);
      } finally {
        setLoading(false);
      }
    }
    loadRequests();
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return '#f59e0b';
      case 'in_progress': return '#3b82f6';
      case 'resolved': return '#10b981';
      default: return '#6b7280';
    }
  };

  return (
    <div className="page-container">
      <h2>Diagnosis Requests</h2>
      {loading ? (
        <div className="loading">Loading requests...</div>
      ) : (
        <div className="request-list">
          {requests.length === 0 ? (
            <p>No diagnosis requests yet.</p>
          ) : (
            requests.map((request) => (
              <div key={request.id} className="request-card">
                <div className="request-header">
                  <h3>{request.title}</h3>
                  <span 
                    className="status-badge"
                    style={{ backgroundColor: getStatusColor(request.status) }}
                  >
                    {request.status}
                  </span>
                </div>
                {request.plantName && (
                  <p className="plant-name">Plant: {request.plantName}</p>
                )}
                {request.symptoms && (
                  <p className="symptoms">Symptoms: {request.symptoms}</p>
                )}
                <p className="request-date">
                  {new Date(request.createdAt).toLocaleDateString()}
                </p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
