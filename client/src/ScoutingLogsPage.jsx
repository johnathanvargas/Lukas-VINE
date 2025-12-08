/**
 * ScoutingLogsPage Component
 * 
 * A React component for viewing and managing scouting logs.
 * Displays a list of scouting logs with filtering and real-time updates.
 * 
 * Features:
 * - Filter logs by date range, location, crop
 * - Real-time subscription to database changes
 * - Pagination support
 * - Responsive design
 */

import React, { useState, useEffect } from 'react';
import { supabase, getCurrentUser } from './supabaseClient';

const ScoutingLogsPage = () => {
  const [user, setUser] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedLog, setExpandedLog] = useState(null);
  const [filters, setFilters] = useState({
    location: '',
    crop: '',
    date_from: '',
    date_to: ''
  });

  useEffect(() => {
    initializePage();

    // Set up realtime subscription for scouting_logs table
    const channel = supabase
      .channel('scouting-logs-changes')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'scouting_logs'
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
  }, [filters]);

  const initializePage = async () => {
    const currentUser = await getCurrentUser();
    setUser(currentUser);
    await fetchLogs();
  };

  const fetchLogs = async () => {
    setLoading(true);
    setError('');

    try {
      let query = supabase
        .from('scouting_logs')
        .select('*')
        .order('date', { ascending: false });

      // Apply filters
      if (filters.location) {
        query = query.eq('location', filters.location);
      }
      if (filters.crop) {
        query = query.eq('crop', filters.crop);
      }
      if (filters.date_from) {
        query = query.gte('date', filters.date_from);
      }
      if (filters.date_to) {
        query = query.lte('date', filters.date_to);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) {
        console.error('Fetch error:', fetchError);
        throw new Error('Failed to load scouting logs');
      }

      setLogs(data || []);
    } catch (err) {
      console.error('Error fetching logs:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRealtimeUpdate = (payload) => {
    const { eventType, new: newRecord, old: oldRecord } = payload;

    if (eventType === 'INSERT') {
      setLogs(prev => [newRecord, ...prev]);
    } else if (eventType === 'UPDATE') {
      setLogs(prev => 
        prev.map(log => log.id === newRecord.id ? newRecord : log)
      );
    } else if (eventType === 'DELETE') {
      setLogs(prev => prev.filter(log => log.id !== oldRecord.id));
    }
  };

  const toggleExpanded = (logId) => {
    setExpandedLog(expandedLog === logId ? null : logId);
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  const formatDateTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const getSeverityColor = (severity) => {
    switch (severity?.toLowerCase()) {
      case 'severe': return '#dc3545';
      case 'moderate': return '#ffc107';
      case 'light': return '#28a745';
      default: return '#6c757d';
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1 style={{ color: '#fd7e14', marginBottom: '20px' }}>Scouting Logs</h1>

      {/* Filter Controls */}
      <div style={{ 
        marginBottom: '20px', 
        padding: '15px',
        backgroundColor: '#f8f9fa',
        borderRadius: '8px',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '10px'
      }}>
        <div>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600', fontSize: '14px' }}>
            Location
          </label>
          <input
            type="text"
            name="location"
            value={filters.location}
            onChange={handleFilterChange}
            placeholder="Filter by location"
            style={{
              width: '100%',
              padding: '8px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              fontSize: '14px',
              boxSizing: 'border-box'
            }}
          />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600', fontSize: '14px' }}>
            Crop
          </label>
          <input
            type="text"
            name="crop"
            value={filters.crop}
            onChange={handleFilterChange}
            placeholder="Filter by crop"
            style={{
              width: '100%',
              padding: '8px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              fontSize: '14px',
              boxSizing: 'border-box'
            }}
          />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600', fontSize: '14px' }}>
            Date From
          </label>
          <input
            type="date"
            name="date_from"
            value={filters.date_from}
            onChange={handleFilterChange}
            style={{
              width: '100%',
              padding: '8px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              fontSize: '14px',
              boxSizing: 'border-box'
            }}
          />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600', fontSize: '14px' }}>
            Date To
          </label>
          <input
            type="date"
            name="date_to"
            value={filters.date_to}
            onChange={handleFilterChange}
            style={{
              width: '100%',
              padding: '8px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              fontSize: '14px',
              boxSizing: 'border-box'
            }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <button
            onClick={fetchLogs}
            style={{
              width: '100%',
              padding: '8px 16px',
              backgroundColor: '#fd7e14',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '600'
            }}
          >
            Apply Filters
          </button>
        </div>
      </div>

      {user && (
        <div style={{ marginBottom: '15px', fontSize: '14px', color: '#666' }}>
          Signed in as: {user.email}
        </div>
      )}

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
          Loading scouting logs...
        </div>
      ) : logs.length === 0 ? (
        <div style={{ 
          textAlign: 'center', 
          padding: '40px', 
          backgroundColor: '#f8f9fa',
          borderRadius: '8px',
          color: '#666'
        }}>
          No scouting logs found
        </div>
      ) : (
        /* Logs List */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          {logs.map(log => (
            <div
              key={log.id}
              style={{
                border: '1px solid #ddd',
                borderRadius: '8px',
                padding: '15px',
                backgroundColor: 'white',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                transition: 'box-shadow 0.2s'
              }}
            >
              {/* Log Header */}
              <div 
                style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'flex-start',
                  marginBottom: '10px',
                  cursor: 'pointer'
                }}
                onClick={() => toggleExpanded(log.id)}
              >
                <div style={{ flex: 1 }}>
                  <h3 style={{ 
                    margin: '0 0 5px 0', 
                    color: '#333',
                    fontSize: '18px'
                  }}>
                    {log.crop} - {log.location}
                  </h3>
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', fontSize: '14px', color: '#666' }}>
                    <span>📅 {formatDate(log.date)}</span>
                    <span>👤 {log.employee_name}</span>
                    <span>🐛 {log.pests_observed?.length || 0} observation(s)</span>
                  </div>
                </div>
                <div style={{ textAlign: 'right', fontSize: '12px', color: '#666' }}>
                  <div>Logged: {formatDateTime(log.created_at)}</div>
                  <div style={{ marginTop: '5px' }}>
                    {expandedLog === log.id ? '▲' : '▼'}
                  </div>
                </div>
              </div>

              {/* Log Details (Expanded) */}
              {expandedLog === log.id && (
                <div style={{ marginTop: '15px', paddingTop: '15px', borderTop: '1px solid #eee' }}>
                  {/* Pest Observations */}
                  {log.pests_observed && log.pests_observed.length > 0 && (
                    <div style={{ marginBottom: '15px' }}>
                      <strong style={{ display: 'block', marginBottom: '8px' }}>Pest/Disease Observations:</strong>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {log.pests_observed.map((pest, idx) => (
                          <div key={idx} style={{ 
                            padding: '10px', 
                            backgroundColor: '#fff3cd',
                            borderRadius: '4px',
                            borderLeft: `3px solid ${getSeverityColor(pest.severity)}`
                          }}>
                            <div style={{ fontWeight: '600' }}>{pest.name}</div>
                            <div style={{ display: 'flex', gap: '15px', marginTop: '5px', fontSize: '14px', color: '#666' }}>
                              {pest.severity && (
                                <span style={{ 
                                  padding: '2px 8px', 
                                  backgroundColor: getSeverityColor(pest.severity),
                                  color: 'white',
                                  borderRadius: '3px',
                                  fontSize: '12px',
                                  fontWeight: '600'
                                }}>
                                  {pest.severity.toUpperCase()}
                                </span>
                              )}
                              {pest.count && <span>Count: {pest.count}</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Notes */}
                  {log.notes && (
                    <div style={{ marginBottom: '15px' }}>
                      <strong>Notes:</strong>
                      <div style={{ 
                        marginTop: '5px', 
                        padding: '10px', 
                        backgroundColor: '#f8f9fa',
                        borderRadius: '4px',
                        whiteSpace: 'pre-wrap'
                      }}>
                        {log.notes}
                      </div>
                    </div>
                  )}

                  {/* Weather */}
                  {log.weather && Object.keys(log.weather).length > 0 && (
                    <div style={{ marginBottom: '15px' }}>
                      <strong>Weather Conditions:</strong>
                      <div style={{ 
                        marginTop: '5px', 
                        padding: '10px', 
                        backgroundColor: '#f8f9fa',
                        borderRadius: '4px',
                        display: 'flex',
                        gap: '15px',
                        flexWrap: 'wrap',
                        fontSize: '14px'
                      }}>
                        {log.weather.temperature && <span>🌡️ {log.weather.temperature}°F</span>}
                        {log.weather.humidity && <span>💧 {log.weather.humidity}%</span>}
                        {log.weather.wind_speed && <span>💨 {log.weather.wind_speed} mph</span>}
                        {log.weather.conditions && <span>☁️ {log.weather.conditions}</span>}
                      </div>
                    </div>
                  )}

                  {/* Photos */}
                  {log.photos && log.photos.length > 0 && (
                    <div style={{ marginBottom: '10px' }}>
                      <strong>Photos:</strong>
                      <div style={{ 
                        display: 'flex', 
                        gap: '10px', 
                        marginTop: '5px',
                        flexWrap: 'wrap'
                      }}>
                        {log.photos.map((url, idx) => (
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
                              alt={`Scouting ${idx + 1}`}
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

                  <div style={{ marginTop: '10px', fontSize: '12px', color: '#999' }}>
                    <strong>Log ID:</strong> {log.id}
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
        backgroundColor: '#fd7e14',
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

export default ScoutingLogsPage;
