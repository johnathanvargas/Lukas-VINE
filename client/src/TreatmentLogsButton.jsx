/**
 * TreatmentLogsButton Component
 * 
 * A React component for submitting treatment log entries.
 * Requires user authentication via Supabase Auth.
 * Uploads photos directly to Supabase Storage and inserts log into database.
 * 
 * Features:
 * - Authentication check before submission
 * - Direct upload to Supabase Storage (bucket: 'request-images')
 * - Form validation
 * - Progress feedback
 * - Displays tracking ID on success
 */

import React, { useState, useEffect } from 'react';
import { supabase, getCurrentUser } from './supabaseClient';

// Storage bucket name - ensure this bucket exists in your Supabase project
const STORAGE_BUCKET = 'request-images';

const TreatmentLogsButton = () => {
  const [user, setUser] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [trackingId, setTrackingId] = useState('');
  const [error, setError] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    employee_name: '',
    date: new Date().toISOString().split('T')[0], // Today's date
    location: '',
    crop: '',
    notes: ''
  });
  const [inputs, setInputs] = useState([{ name: '', rate: '', active_ingredient: '' }]);
  const [weather, setWeather] = useState({ temperature: '', humidity: '', wind_speed: '', conditions: '' });
  const [selectedFiles, setSelectedFiles] = useState([]);

  // Check authentication on mount
  useEffect(() => {
    checkUser();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
      if (session?.user && formData.employee_name === '') {
        setFormData(prev => ({
          ...prev,
          employee_name: session.user.email?.split('@')[0] || ''
        }));
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkUser = async () => {
    const currentUser = await getCurrentUser();
    setUser(currentUser);
    if (currentUser) {
      setFormData(prev => ({
        ...prev,
        employee_name: currentUser.email?.split('@')[0] || ''
      }));
    }
  };

  const handleSignIn = async () => {
    try {
      const email = prompt('Enter your email for sign-in link:');
      if (!email) return;

      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: window.location.href
        }
      });

      if (error) throw error;

      alert('Check your email for the sign-in link!');
    } catch (err) {
      console.error('Sign in error:', err);
      setError('Failed to send sign-in link. Please try again.');
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleWeatherChange = (e) => {
    const { name, value } = e.target;
    setWeather(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleInputsChange = (index, field, value) => {
    const newInputs = [...inputs];
    newInputs[index][field] = value;
    setInputs(newInputs);
  };

  const addInputRow = () => {
    setInputs([...inputs, { name: '', rate: '', active_ingredient: '' }]);
  };

  const removeInputRow = (index) => {
    if (inputs.length > 1) {
      setInputs(inputs.filter((_, i) => i !== index));
    }
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    
    // Validate file count
    if (files.length > 5) {
      setError('Maximum 5 photos allowed');
      return;
    }

    // Validate file sizes
    const maxSize = 10 * 1024 * 1024; // 10MB
    const oversizedFiles = files.filter(f => f.size > maxSize);
    if (oversizedFiles.length > 0) {
      setError('Each file must be under 10MB');
      return;
    }

    // Validate file types
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    const invalidFiles = files.filter(f => !validTypes.includes(f.type));
    if (invalidFiles.length > 0) {
      setError('Only image files (JPEG, PNG, GIF, WebP) are allowed');
      return;
    }

    setSelectedFiles(files);
    setError('');
  };

  const uploadPhotos = async (logId) => {
    if (selectedFiles.length === 0) {
      return [];
    }

    const uploadPromises = selectedFiles.map(async (file, index) => {
      const fileExt = file.name.split('.').pop();
      const fileName = `${logId}/${Date.now()}-${index}.${fileExt}`;

      const { data, error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        console.error('Upload error:', error);
        throw new Error(`Failed to upload ${file.name}`);
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(fileName);

      return publicUrl;
    });

    return Promise.all(uploadPromises);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      // Validate form
      if (!formData.employee_name || !formData.date || !formData.location || !formData.crop) {
        throw new Error('Please fill in all required fields');
      }

      // Validate at least one input
      const validInputs = inputs.filter(inp => inp.name.trim());
      if (validInputs.length === 0) {
        throw new Error('Please add at least one treatment input');
      }

      if (!user) {
        throw new Error('You must be signed in to submit a treatment log');
      }

      // Prepare weather data (only if at least one field is filled)
      const hasWeatherData = Object.values(weather).some(val => val !== '');
      const weatherData = hasWeatherData ? weather : null;

      // Insert treatment log into database
      const { data: log, error: insertError } = await supabase
        .from('treatment_logs')
        .insert({
          employee_id: user.id,
          employee_name: formData.employee_name,
          date: formData.date,
          location: formData.location,
          crop: formData.crop,
          inputs: validInputs,
          notes: formData.notes || null,
          weather: weatherData
        })
        .select()
        .single();

      if (insertError) {
        console.error('Insert error:', insertError);
        throw new Error('Failed to submit treatment log. Please try again.');
      }

      // Upload photos if any
      let photoUrls = [];
      if (selectedFiles.length > 0) {
        try {
          photoUrls = await uploadPhotos(log.id);

          // Update log with photo URLs
          const { error: updateError } = await supabase
            .from('treatment_logs')
            .update({ photos: photoUrls })
            .eq('id', log.id);

          if (updateError) {
            console.error('Failed to update with photos:', updateError);
            // Continue anyway - log is submitted
          }
        } catch (uploadError) {
          console.error('Photo upload error:', uploadError);
          // Continue - log is submitted, just without photos
          setError('Treatment log submitted but some photos failed to upload');
        }
      }

      // Success!
      setSuccess(true);
      setTrackingId(log.id);
      
      // Reset form
      setFormData({
        employee_name: user.email?.split('@')[0] || '',
        date: new Date().toISOString().split('T')[0],
        location: '',
        crop: '',
        notes: ''
      });
      setInputs([{ name: '', rate: '', active_ingredient: '' }]);
      setWeather({ temperature: '', humidity: '', wind_speed: '', conditions: '' });
      setSelectedFiles([]);

      // Close form after 5 seconds
      setTimeout(() => {
        setShowForm(false);
        setSuccess(false);
      }, 5000);

    } catch (err) {
      console.error('Submit error:', err);
      setError(err.message || 'Failed to submit treatment log');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setShowForm(false);
    setSuccess(false);
    setError('');
  };

  return (
    <div className="treatment-logs-button-container">
      {!showForm ? (
        <button 
          onClick={() => setShowForm(true)}
          className="treatment-logs-button"
          style={{
            padding: '12px 24px',
            backgroundColor: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '16px',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'background-color 0.2s'
          }}
          onMouseOver={(e) => e.target.style.backgroundColor = '#218838'}
          onMouseOut={(e) => e.target.style.backgroundColor = '#28a745'}
        >
          Submit Treatment Log
        </button>
      ) : (
        <div 
          className="treatment-logs-form-modal"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}
        >
          <div 
            className="treatment-logs-form-content"
            style={{
              backgroundColor: 'white',
              padding: '30px',
              borderRadius: '8px',
              maxWidth: '700px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              position: 'relative'
            }}
          >
            <button
              onClick={handleClose}
              style={{
                position: 'absolute',
                top: '15px',
                right: '15px',
                background: 'none',
                border: 'none',
                fontSize: '24px',
                cursor: 'pointer',
                color: '#666'
              }}
            >
              ×
            </button>

            <h2 style={{ marginTop: 0, color: '#28a745' }}>Submit Treatment Log</h2>

            {!user ? (
              <div style={{ textAlign: 'center', padding: '20px' }}>
                <p>Please sign in to submit a treatment log.</p>
                <button 
                  onClick={handleSignIn}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#28a745',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '16px',
                    marginTop: '10px'
                  }}
                >
                  Sign In
                </button>
              </div>
            ) : success ? (
              <div style={{ 
                padding: '20px', 
                backgroundColor: '#d4edda', 
                borderRadius: '6px',
                textAlign: 'center'
              }}>
                <h3 style={{ color: '#155724', marginTop: 0 }}>Treatment Log Submitted Successfully!</h3>
                <p style={{ color: '#155724' }}>Your tracking ID:</p>
                <code style={{ 
                  display: 'block',
                  padding: '10px',
                  backgroundColor: 'white',
                  borderRadius: '4px',
                  fontSize: '14px',
                  wordBreak: 'break-all',
                  margin: '10px 0'
                }}>
                  {trackingId}
                </code>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                {error && (
                  <div style={{
                    padding: '12px',
                    backgroundColor: '#f8d7da',
                    color: '#721c24',
                    borderRadius: '6px',
                    marginBottom: '15px',
                    fontSize: '14px'
                  }}>
                    {error}
                  </div>
                )}

                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
                    Employee Name *
                  </label>
                  <input
                    type="text"
                    name="employee_name"
                    value={formData.employee_name}
                    onChange={handleInputChange}
                    required
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

                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
                    Date *
                  </label>
                  <input
                    type="date"
                    name="date"
                    value={formData.date}
                    onChange={handleInputChange}
                    required
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

                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
                    Location/Zone *
                  </label>
                  <input
                    type="text"
                    name="location"
                    value={formData.location}
                    onChange={handleInputChange}
                    placeholder="e.g., North Field, Block A, Greenhouse 3"
                    required
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

                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
                    Crop *
                  </label>
                  <input
                    type="text"
                    name="crop"
                    value={formData.crop}
                    onChange={handleInputChange}
                    placeholder="e.g., Tomatoes, Corn, Roses"
                    required
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

                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '10px', fontWeight: '600' }}>
                    Treatment Inputs/Pesticides *
                  </label>
                  {inputs.map((input, index) => (
                    <div key={index} style={{ 
                      marginBottom: '10px', 
                      padding: '10px', 
                      border: '1px solid #ddd', 
                      borderRadius: '4px',
                      backgroundColor: '#f8f9fa'
                    }}>
                      <div style={{ display: 'flex', gap: '10px', marginBottom: '8px' }}>
                        <input
                          type="text"
                          placeholder="Product name"
                          value={input.name}
                          onChange={(e) => handleInputsChange(index, 'name', e.target.value)}
                          required
                          style={{
                            flex: 1,
                            padding: '6px',
                            border: '1px solid #ccc',
                            borderRadius: '4px',
                            fontSize: '14px'
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => removeInputRow(index)}
                          style={{
                            padding: '6px 12px',
                            backgroundColor: '#dc3545',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '14px'
                          }}
                        >
                          Remove
                        </button>
                      </div>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <input
                          type="text"
                          placeholder="Rate (e.g., 2 qt/acre)"
                          value={input.rate}
                          onChange={(e) => handleInputsChange(index, 'rate', e.target.value)}
                          style={{
                            flex: 1,
                            padding: '6px',
                            border: '1px solid #ccc',
                            borderRadius: '4px',
                            fontSize: '14px'
                          }}
                        />
                        <input
                          type="text"
                          placeholder="Active ingredient (optional)"
                          value={input.active_ingredient}
                          onChange={(e) => handleInputsChange(index, 'active_ingredient', e.target.value)}
                          style={{
                            flex: 1,
                            padding: '6px',
                            border: '1px solid #ccc',
                            borderRadius: '4px',
                            fontSize: '14px'
                          }}
                        />
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addInputRow}
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
                    + Add Another Input
                  </button>
                </div>

                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
                    Notes (Optional)
                  </label>
                  <textarea
                    name="notes"
                    value={formData.notes}
                    onChange={handleInputChange}
                    placeholder="Any additional observations or notes"
                    rows={3}
                    style={{
                      width: '100%',
                      padding: '8px',
                      border: '1px solid #ccc',
                      borderRadius: '4px',
                      fontSize: '14px',
                      boxSizing: 'border-box',
                      fontFamily: 'inherit'
                    }}
                  />
                </div>

                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '10px', fontWeight: '600' }}>
                    Weather Conditions (Optional)
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <input
                      type="text"
                      name="temperature"
                      placeholder="Temp (°F)"
                      value={weather.temperature}
                      onChange={handleWeatherChange}
                      style={{
                        padding: '6px',
                        border: '1px solid #ccc',
                        borderRadius: '4px',
                        fontSize: '14px'
                      }}
                    />
                    <input
                      type="text"
                      name="humidity"
                      placeholder="Humidity (%)"
                      value={weather.humidity}
                      onChange={handleWeatherChange}
                      style={{
                        padding: '6px',
                        border: '1px solid #ccc',
                        borderRadius: '4px',
                        fontSize: '14px'
                      }}
                    />
                    <input
                      type="text"
                      name="wind_speed"
                      placeholder="Wind (mph)"
                      value={weather.wind_speed}
                      onChange={handleWeatherChange}
                      style={{
                        padding: '6px',
                        border: '1px solid #ccc',
                        borderRadius: '4px',
                        fontSize: '14px'
                      }}
                    />
                    <input
                      type="text"
                      name="conditions"
                      placeholder="Conditions"
                      value={weather.conditions}
                      onChange={handleWeatherChange}
                      style={{
                        padding: '6px',
                        border: '1px solid #ccc',
                        borderRadius: '4px',
                        fontSize: '14px'
                      }}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
                    Photos (Optional, max 5 files)
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleFileChange}
                    style={{
                      width: '100%',
                      padding: '8px',
                      border: '1px solid #ccc',
                      borderRadius: '4px',
                      fontSize: '14px',
                      boxSizing: 'border-box'
                    }}
                  />
                  {selectedFiles.length > 0 && (
                    <p style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
                      {selectedFiles.length} file(s) selected
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    width: '100%',
                    padding: '12px',
                    backgroundColor: loading ? '#ccc' : '#28a745',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '16px',
                    fontWeight: '600',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    transition: 'background-color 0.2s'
                  }}
                >
                  {loading ? 'Submitting...' : 'Submit Treatment Log'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TreatmentLogsButton;
