/**
 * RequestButton Component
 * 
 * A React component for submitting plant diagnosis requests.
 * Requires user authentication via Supabase Auth.
 * Uploads images directly to Supabase Storage and inserts request into database.
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

const RequestButton = () => {
  const [user, setUser] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [trackingId, setTrackingId] = useState('');
  const [error, setError] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    reporter_name: '',
    contact: '',
    plant_type: '',
    symptoms: '',
    urgency: 'medium'
  });
  const [selectedFiles, setSelectedFiles] = useState([]);

  // Check authentication on mount
  useEffect(() => {
    checkUser();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
      if (session?.user && formData.reporter_name === '') {
        setFormData(prev => ({
          ...prev,
          reporter_name: session.user.email?.split('@')[0] || '',
          contact: session.user.email || ''
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
        reporter_name: currentUser.email?.split('@')[0] || '',
        contact: currentUser.email || ''
      }));
    }
  };

  const handleSignIn = async () => {
    try {
      // Simple magic link authentication for this minimal implementation
      // For production, consider using Supabase Auth UI component:
      // https://supabase.com/docs/guides/auth/auth-helpers/auth-ui
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

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    
    // Validate file count
    if (files.length > 5) {
      setError('Maximum 5 images allowed');
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

  const uploadImages = async (requestId) => {
    if (selectedFiles.length === 0) {
      return [];
    }

    const uploadPromises = selectedFiles.map(async (file, index) => {
      const fileExt = file.name.split('.').pop();
      const fileName = `${requestId}/${Date.now()}-${index}.${fileExt}`;

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
      if (!formData.reporter_name || !formData.contact || !formData.plant_type || !formData.symptoms) {
        throw new Error('Please fill in all required fields');
      }

      if (!user) {
        throw new Error('You must be signed in to submit a request');
      }

      // Insert request into database
      const { data: request, error: insertError } = await supabase
        .from('requests')
        .insert({
          reporter_id: user.id,
          reporter_name: formData.reporter_name,
          contact: formData.contact,
          plant_type: formData.plant_type,
          symptoms: formData.symptoms,
          urgency: formData.urgency,
          status: 'pending'
        })
        .select()
        .single();

      if (insertError) {
        console.error('Insert error:', insertError);
        throw new Error('Failed to submit request. Please try again.');
      }

      // Upload images if any
      let imageUrls = [];
      if (selectedFiles.length > 0) {
        try {
          imageUrls = await uploadImages(request.id);

          // Update request with image URLs
          const { error: updateError } = await supabase
            .from('requests')
            .update({ images: imageUrls })
            .eq('id', request.id);

          if (updateError) {
            console.error('Failed to update with images:', updateError);
            // Continue anyway - request is submitted
          }
        } catch (uploadError) {
          console.error('Image upload error:', uploadError);
          // Continue - request is submitted, just without images
          setError('Request submitted but some images failed to upload');
        }
      }

      // Success!
      setSuccess(true);
      setTrackingId(request.id);
      
      // Reset form
      setFormData({
        reporter_name: user.email?.split('@')[0] || '',
        contact: user.email || '',
        plant_type: '',
        symptoms: '',
        urgency: 'medium'
      });
      setSelectedFiles([]);

      // Close form after 5 seconds
      setTimeout(() => {
        setShowForm(false);
        setSuccess(false);
      }, 5000);

    } catch (err) {
      console.error('Submit error:', err);
      setError(err.message || 'Failed to submit request');
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
    <div className="request-button-container">
      {!showForm ? (
        <button 
          onClick={() => setShowForm(true)}
          className="request-button"
          style={{
            padding: '12px 24px',
            backgroundColor: '#33a9dc',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '16px',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'background-color 0.2s'
          }}
          onMouseOver={(e) => e.target.style.backgroundColor = '#2890bd'}
          onMouseOut={(e) => e.target.style.backgroundColor = '#33a9dc'}
        >
          Request Diagnosis
        </button>
      ) : (
        <div 
          className="request-form-modal"
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
            className="request-form-content"
            style={{
              backgroundColor: 'white',
              padding: '30px',
              borderRadius: '8px',
              maxWidth: '600px',
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

            <h2 style={{ marginTop: 0, color: '#33a9dc' }}>Request Plant Diagnosis</h2>

            {!user ? (
              <div style={{ textAlign: 'center', padding: '20px' }}>
                <p>Please sign in to submit a diagnosis request.</p>
                <button 
                  onClick={handleSignIn}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#33a9dc',
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
                <h3 style={{ color: '#155724', marginTop: 0 }}>Request Submitted Successfully!</h3>
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
                <p style={{ color: '#155724', fontSize: '14px' }}>
                  Save this ID to track your request. You'll be notified when a diagnosis is available.
                </p>
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
                    Your Name *
                  </label>
                  <input
                    type="text"
                    name="reporter_name"
                    value={formData.reporter_name}
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
                    Contact (Email/Phone) *
                  </label>
                  <input
                    type="text"
                    name="contact"
                    value={formData.contact}
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
                    Plant Type *
                  </label>
                  <input
                    type="text"
                    name="plant_type"
                    value={formData.plant_type}
                    onChange={handleInputChange}
                    placeholder="e.g., Rose, Tomato, Oak Tree"
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
                    Symptoms *
                  </label>
                  <textarea
                    name="symptoms"
                    value={formData.symptoms}
                    onChange={handleInputChange}
                    placeholder="Describe the problem: yellowing leaves, spots, wilting, etc."
                    required
                    rows={4}
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
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
                    Urgency *
                  </label>
                  <select
                    name="urgency"
                    value={formData.urgency}
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
                  >
                    <option value="low">Low - Not urgent</option>
                    <option value="medium">Medium - Within a week</option>
                    <option value="high">High - Within 2-3 days</option>
                    <option value="critical">Critical - Immediate attention needed</option>
                  </select>
                </div>

                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
                    Images (Optional, max 5 files)
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
                    backgroundColor: loading ? '#ccc' : '#33a9dc',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '16px',
                    fontWeight: '600',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    transition: 'background-color 0.2s'
                  }}
                >
                  {loading ? 'Submitting...' : 'Submit Request'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default RequestButton;
