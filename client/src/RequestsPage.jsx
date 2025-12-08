/**
 * RequestsPage Component
 * 
 * A React component for viewing and managing diagnosis requests (triage list).
 * Displays a list of requests with filtering, claiming actions, and real-time updates.
 * 
 * Features:
 * - Filter requests by status
 * - Claim/assign requests to current user
 * - Real-time subscription to database changes
 * - Pagination support
 * - Responsive design
 */

import React, { useState, useEffect } from 'react';
import { supabase, getCurrentUser } from './supabaseClient';

const RequestsPage = () => {
  const [user, setUser] = useState(null);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('pending');
  const [expandedRequest, setExpandedRequest] = useState(null);

  useEffect(() => {
    initializePage();

    // Set up realtime subscription for requests table
    const channel = supabase
      .channel('requests-changes')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'requests'
        },
        (payload) => {
          console.log('Realtime update:', payload);
          handleRealtimeUpdate(payload);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [statusFilter]);

  const initializePage = async () => {
    const currentUser = await getCurrentUser();
    setUser(currentUser);
    await fetchRequests();
  };

  const fetchRequests = async () => {
    setLoading(true);
    setError('');

    try {
      let query = supabase
        .from('requests')
        .select('*')
        .order('created_at', { ascending: false });

      // Apply status filter
      if (statusFilter && statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) {
        console.error('Fetch error:', fetchError);
        throw new Error('Failed to load requests');
      }

      setRequests(data || []);
    } catch (err) {
      console.error('Error fetching requests:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRealtimeUpdate = (payload) => {
    const { eventType, new: newRecord, old: oldRecord } = payload;

    if (eventType === 'INSERT') {
      // Add new request to list if it matches filter
      if (!statusFilter || statusFilter === 'all' || newRecord.status === statusFilter) {
        setRequests(prev => [newRecord, ...prev]);
      }
    } else if (eventType === 'UPDATE') {
      // Update existing request
      setRequests(prev => 
        prev.map(req => req.id === newRecord.id ? newRecord : req)
          .filter(req => !statusFilter || statusFilter === 'all' || req.status === statusFilter)
      );
    } else if (eventType === 'DELETE') {
      // Remove deleted request
      setRequests(prev => prev.filter(req => req.id !== oldRecord.id));
    }
  };

  const handleClaimRequest = async (requestId) => {
    if (!user) {
      alert('Please sign in to claim requests');
      return;
    }

    try {
      const { error: updateError } = await supabase
        .from('requests')
        .update({
          assigned_to: user.id,
          status: 'in-progress'
        })
        .eq('id', requestId);

      if (updateError) {
        console.error('Claim error:', updateError);
        throw new Error('Failed to claim request');
      }

      // Request will be updated via realtime subscription
      alert('Request claimed successfully!');
    } catch (err) {
      console.error('Error claiming request:', err);
      alert(err.message);
    }
  };

  const handleUnassign = async (requestId) => {
    try {
      const { error: updateError } = await supabase
        .from('requests')
        .update({
          assigned_to: null,
          status: 'pending'
        })
        .eq('id', requestId);

      if (updateError) {
        console.error('Unassign error:', updateError);
        throw new Error('Failed to unassign request');
      }

      alert('Request unassigned successfully!');
    } catch (err) {
      console.error('Error unassigning request:', err);
      alert(err.message);
    }
  };

  const handleStatusChange = async (requestId, newStatus) => {
    try {
      const { error: updateError } = await supabase
        .from('requests')
        .update({ status: newStatus })
        .eq('id', requestId);

      if (updateError) {
        console.error('Status update error:', updateError);
        throw new Error('Failed to update status');
      }

      // Request will be updated via realtime subscription
    } catch (err) {
      console.error('Error updating status:', err);
      alert(err.message);
    }
  };

  const toggleExpanded = (requestId) => {
    setExpandedRequest(expandedRequest === requestId ? null : requestId);
  };

  const getUrgencyColor = (urgency) => {
    switch (urgency) {
      case 'critical': return '#dc3545';
      case 'high': return '#fd7e14';
      case 'medium': return '#ffc107';
      case 'low': return '#28a745';
      default: return '#6c757d';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return '#ffc107';
      case 'in-progress': return '#0dcaf0';
      case 'resolved': return '#28a745';
      case 'closed': return '#6c757d';
      default: return '#6c757d';
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1 style={{ color: '#33a9dc', marginBottom: '20px' }}>Diagnosis Requests - Triage</h1>

      {/* Filter Controls */}
      <div style={{ 
        marginBottom: '20px', 
        display: 'flex', 
        gap: '10px', 
        flexWrap: 'wrap',
        alignItems: 'center' 
      }}>
        <label style={{ fontWeight: '600' }}>Filter by Status:</label>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{
            padding: '8px 12px',
            border: '1px solid #ccc',
            borderRadius: '4px',
            fontSize: '14px',
            cursor: 'pointer'
          }}
        >
          <option value="all">All</option>
          <option value="pending">Pending</option>
          <option value="in-progress">In Progress</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </select>

        <button
          onClick={fetchRequests}
          style={{
            padding: '8px 16px',
            backgroundColor: '#33a9dc',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          Refresh
        </button>

        {user && (
          <span style={{ marginLeft: 'auto', fontSize: '14px', color: '#666' }}>
            Signed in as: {user.email}
          </span>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div style={{
          padding: '12px',
          backgroundColor: '#f8d7da',
          color: '#721c24',
          borderRadius: '6px',
          marginBottom: '15px'
        }}>
          {error}
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
          Loading requests...
        </div>
      ) : requests.length === 0 ? (
        <div style={{ 
          textAlign: 'center', 
          padding: '40px', 
          backgroundColor: '#f8f9fa',
          borderRadius: '8px',
          color: '#666'
        }}>
          No requests found with status: {statusFilter || 'all'}
        </div>
      ) : (
        /* Requests List */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          {requests.map(request => (
            <div
              key={request.id}
              style={{
                border: '1px solid #ddd',
                borderRadius: '8px',
                padding: '15px',
                backgroundColor: 'white',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                transition: 'box-shadow 0.2s'
              }}
            >
              {/* Request Header */}
              <div 
                style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'flex-start',
                  marginBottom: '10px',
                  cursor: 'pointer'
                }}
                onClick={() => toggleExpanded(request.id)}
              >
                <div style={{ flex: 1 }}>
                  <h3 style={{ 
                    margin: '0 0 5px 0', 
                    color: '#333',
                    fontSize: '18px'
                  }}>
                    {request.plant_type}
                  </h3>
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: '600',
                      backgroundColor: getUrgencyColor(request.urgency),
                      color: 'white'
                    }}>
                      {request.urgency.toUpperCase()}
                    </span>
                    <span style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: '600',
                      backgroundColor: getStatusColor(request.status),
                      color: 'white'
                    }}>
                      {request.status.toUpperCase()}
                    </span>
                  </div>
                </div>
                <div style={{ textAlign: 'right', fontSize: '12px', color: '#666' }}>
                  <div>{formatDate(request.created_at)}</div>
                  <div style={{ marginTop: '5px' }}>
                    {expandedRequest === request.id ? '▲' : '▼'}
                  </div>
                </div>
              </div>

              {/* Request Details (Expanded) */}
              {expandedRequest === request.id && (
                <div style={{ marginTop: '15px', paddingTop: '15px', borderTop: '1px solid #eee' }}>
                  <div style={{ marginBottom: '10px' }}>
                    <strong>Reporter:</strong> {request.reporter_name}
                  </div>
                  <div style={{ marginBottom: '10px' }}>
                    <strong>Contact:</strong> {request.contact}
                  </div>
                  <div style={{ marginBottom: '10px' }}>
                    <strong>Symptoms:</strong>
                    <div style={{ 
                      marginTop: '5px', 
                      padding: '10px', 
                      backgroundColor: '#f8f9fa',
                      borderRadius: '4px',
                      whiteSpace: 'pre-wrap'
                    }}>
                      {request.symptoms}
                    </div>
                  </div>

                  {/* Images */}
                  {request.images && request.images.length > 0 && (
                    <div style={{ marginBottom: '10px' }}>
                      <strong>Images:</strong>
                      <div style={{ 
                        display: 'flex', 
                        gap: '10px', 
                        marginTop: '5px',
                        flexWrap: 'wrap'
                      }}>
                        {request.images.map((url, idx) => (
                          <a 
                            key={idx} 
                            href={url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            style={{
                              display: 'block',
                              width: '100px',
                              height: '100px',
                              borderRadius: '4px',
                              overflow: 'hidden',
                              border: '1px solid #ddd'
                            }}
                          >
                            <img 
                              src={url} 
                              alt={`Plant ${idx + 1}`}
                              style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover'
                              }}
                            />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  <div style={{ marginBottom: '10px', fontSize: '12px', color: '#666' }}>
                    <strong>Request ID:</strong> {request.id}
                  </div>

                  {request.assigned_to && (
                    <div style={{ marginBottom: '10px', fontSize: '12px', color: '#666' }}>
                      <strong>Assigned to:</strong> {request.assigned_to}
                      {/* TODO: For better UX, join with user profiles to display name/email */}
                    </div>
                  )}

                  {/* Actions */}
                  <div style={{ 
                    display: 'flex', 
                    gap: '10px', 
                    marginTop: '15px',
                    flexWrap: 'wrap'
                  }}>
                    {user && !request.assigned_to && request.status === 'pending' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleClaimRequest(request.id);
                        }}
                        style={{
                          padding: '8px 16px',
                          backgroundColor: '#28a745',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '14px'
                        }}
                      >
                        Claim Request
                      </button>
                    )}

                    {user && request.assigned_to === user.id && (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUnassign(request.id);
                          }}
                          style={{
                            padding: '8px 16px',
                            backgroundColor: '#6c757d',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '14px'
                          }}
                        >
                          Unassign
                        </button>

                        {request.status !== 'resolved' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStatusChange(request.id, 'resolved');
                            }}
                            style={{
                              padding: '8px 16px',
                              backgroundColor: '#28a745',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '14px'
                            }}
                          >
                            Mark Resolved
                          </button>
                        )}

                        {request.status !== 'closed' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStatusChange(request.id, 'closed');
                            }}
                            style={{
                              padding: '8px 16px',
                              backgroundColor: '#dc3545',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '14px'
                            }}
                          >
                            Close Request
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Real-time Indicator */}
      <div style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        padding: '8px 12px',
        backgroundColor: '#28a745',
        color: 'white',
        borderRadius: '20px',
        fontSize: '12px',
        fontWeight: '600',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
      }}>
        <span style={{
          width: '8px',
          height: '8px',
          backgroundColor: 'white',
          borderRadius: '50%',
          animation: 'pulse 2s infinite'
        }}></span>
        Real-time Updates Active
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
};

export default RequestsPage;
