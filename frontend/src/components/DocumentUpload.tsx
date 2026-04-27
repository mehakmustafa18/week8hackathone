'use client';

import React, { useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Alert,
  LinearProgress,
  Card,
  CardContent,
  Typography,
  Chip,
  Paper,
  Grid,
  Stack,
  Avatar,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DescriptionIcon from '@mui/icons-material/Description';
import { useUploadPDFMutation } from '../store/api';

interface DocumentUploadProps {
  onUploadSuccess: () => void;
}

export default function DocumentUploadComponent({ onUploadSuccess }: DocumentUploadProps) {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadResult, setUploadResult] = useState<any>(null);

  const [uploadPDF, { isLoading }] = useUploadPDFMutation();

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = e.dataTransfer.files;
    if (files && files[0]) {
      const file = files[0];
      
      // Check file type
      if (file.type !== 'application/pdf') {
        alert(`❌ Invalid File Type\n\nDropped file: ${file.name}\nType: ${file.type || 'Unknown'}\n\nPlease drop a PDF file (.pdf extension)`);
        return;
      }
      
      // Check file size (20MB max)
      const maxSizeMB = 20;
      const fileSizeMB = file.size / 1024 / 1024;
      
      if (fileSizeMB > maxSizeMB) {
        alert(`❌ File Too Large\n\nDropped file: ${file.name}\nSize: ${fileSizeMB.toFixed(2)}MB\nMaximum allowed: ${maxSizeMB}MB\n\nPlease drop a smaller PDF file`);
        return;
      }
      
      setSelectedFile(file);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      // Check file type
      if (file.type !== 'application/pdf') {
        alert(`❌ Invalid File Type\n\nSelected file: ${file.name}\nType: ${file.type || 'Unknown'}\n\nPlease select a PDF file (.pdf extension)`);
        e.target.value = ''; // Clear the input
        return;
      }
      
      // Check file size (20MB max)
      const maxSizeMB = 20;
      const fileSizeMB = file.size / 1024 / 1024;
      
      if (fileSizeMB > maxSizeMB) {
        alert(`❌ File Too Large\n\nSelected file: ${file.name}\nSize: ${fileSizeMB.toFixed(2)}MB\nMaximum allowed: ${maxSizeMB}MB\n\nPlease select a smaller PDF file`);
        e.target.value = ''; // Clear the input
        return;
      }
      
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    // Validate file before upload
    if (selectedFile.type !== 'application/pdf') {
      alert(`❌ Invalid File Type\n\nSelected file: ${selectedFile.name}\nType: ${selectedFile.type || 'Unknown'}\n\nPlease select a PDF file (.pdf extension)`);
      return;
    }

    const maxSizeMB = 20; // 20MB
    const fileSizeMB = selectedFile.size / 1024 / 1024;
    
    if (fileSizeMB > maxSizeMB) {
      alert(`❌ File Too Large\n\nSelected file: ${selectedFile.name}\nSize: ${fileSizeMB.toFixed(2)}MB\nMaximum allowed: ${maxSizeMB}MB\n\nPlease select a smaller PDF file`);
      return;
    }

    const apiUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/upload`;
    console.log('Ingesting to:', apiUrl);

    if (!apiUrl.startsWith('https') && !apiUrl.includes('localhost')) {
      alert('⚠️ Security Warning: You are attempting to upload over an insecure connection (http). Many browsers block this. Please use https://');
    }

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      setUploadProgress(20);
      const result = await uploadPDF(formData).unwrap();
      setUploadProgress(100);
      setUploadResult(result.data);
      setSelectedFile(null);

      // Call success callback after delay
      setTimeout(() => {
        onUploadSuccess();
      }, 2000);
    } catch (error: any) {
      console.error('Full Upload Error Object:', error);
      let errorMessage = 'The orchestrating agents encountered an issue. ';
      
      if (error?.status === 'FETCH_ERROR') {
        errorMessage = 'Cannot connect to the backend. PROBABLY A CORS OR PROTOCOL ISSUE. \n\n1. Ensure your NEXT_PUBLIC_API_URL starts with https://\n2. Verify the backend domain is correct.\n3. Check browser console (F12) for "CRO-Origin" errors.';
      } else if (error?.status === 504) {
        errorMessage = 'Deployment Timeout: Analysis took more than 10s. Vercel Hobby plan has a strict 10s limit.';
      } else if (error?.data?.message) {
        errorMessage += error.data.message;
      }
      
      alert(`❌ Ingestion Failed\n\n${errorMessage}\n\nRAW ERROR: ${JSON.stringify(error)}`);
      setUploadProgress(0);
    }
  };

  if (uploadResult) {
    return (
      <Box sx={{ animation: 'fadeIn 0.5s ease-out' }}>
        <Typography variant="h5" sx={{ mb: 3, fontWeight: 800, color: 'success.main', display: 'flex', alignItems: 'center', gap: 1 }}>
          <CheckCircleIcon /> Intelligence Mapping Complete
        </Typography>

        <Grid container spacing={3}>
          {/* Metadata Cards */}
          <Grid item xs={12} sm={6} md={3}>
            <Paper variant="outlined" sx={{ p: 2, textAlign: 'center', borderRadius: 3, border: '1px solid rgba(0,0,0,0.08)' }}>
              <Typography variant="h5" sx={{ fontWeight: 800 }}>{uploadResult.analysis.pageCount || 1}</Typography>
              <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>PAGES ANALYZED</Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Paper variant="outlined" sx={{ p: 2, textAlign: 'center', borderRadius: 3, border: '1px solid rgba(0,0,0,0.08)' }}>
              <Typography variant="h5" sx={{ fontWeight: 800 }}>{uploadResult.analysis.wordCount?.toLocaleString() || 0}</Typography>
              <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>WORDS PARSED</Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Paper variant="outlined" sx={{ p: 2, textAlign: 'center', borderRadius: 3, border: '1px solid rgba(0,0,0,0.08)' }}>
              <Typography variant="h5" sx={{ fontWeight: 800 }}>{uploadResult.analysis.sections?.length || 0}</Typography>
              <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>SECTIONS MAPPED</Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Paper variant="outlined" sx={{ p: 2, textAlign: 'center', borderRadius: 3, border: '1px solid rgba(0,0,0,0.08)' }}>
              <Typography variant="h5" sx={{ fontWeight: 800 }}>{uploadResult.analysis.keyThemes?.length || 0}</Typography>
              <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>THEMES DETECTED</Typography>
            </Paper>
          </Grid>

          {/* Analysis Content */}
          <Grid item xs={12} md={7}>
            <Paper variant="outlined" sx={{ p: 3, borderRadius: 4, height: '100%', border: '1px solid rgba(0,0,0,0.08)' }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 2, color: 'primary.main' }}>EXECUTIVE ANALYSIS</Typography>
              <Typography variant="body1" sx={{ lineHeight: 1.8, color: 'text.primary', fontStyle: 'italic' }}>
                {uploadResult.analysis.summary || 'Summary not available.'}
              </Typography>
              
              <Box sx={{ mt: 4 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 2 }}>CORE THEMES</Typography>
                <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                  {uploadResult.analysis.keyThemes?.map((theme: string, i: number) => (
                    <Chip key={i} label={theme} size="small" sx={{ bgcolor: 'primary.light', color: 'primary.main', fontWeight: 700, borderRadius: 1.5 }} />
                  ))}
                </Stack>
              </Box>
            </Paper>
          </Grid>

          <Grid item xs={12} md={5}>
            <Stack spacing={3}>
              <Paper variant="outlined" sx={{ p: 3, borderRadius: 4, bgcolor: '#f8fafc', border: 'none' }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 2 }}>KEY ENTITIES</Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="caption" fontWeight={800} color="text.secondary" display="block">PEOPLE</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>{uploadResult.analysis.entities?.people?.slice(0,3).join(', ') || 'N/A'}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" fontWeight={800} color="text.secondary" display="block">ORGS</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>{uploadResult.analysis.entities?.organizations?.slice(0,3).join(', ') || 'N/A'}</Typography>
                  </Grid>
                </Grid>
              </Paper>

              <Button 
                variant="contained" 
                fullWidth 
                size="large" 
                onClick={onUploadSuccess}
                sx={{ 
                  borderRadius: 3, 
                  py: 2, 
                  fontWeight: 800, 
                  boxShadow: '0 10px 15px -3px rgba(79, 70, 229, 0.3)',
                  fontSize: '1rem'
                }}
              >
                PROCEED TO AGENT CHAT
              </Button>
            </Stack>
          </Grid>
        </Grid>
      </Box>
    );
  }

  return (
    <Box>
      <Box
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        sx={{
          border: '3px dashed',
          borderColor: dragActive ? 'primary.main' : '#e2e8f0',
          borderRadius: 6,
          p: 6,
          textAlign: 'center',
          cursor: 'pointer',
          transition: 'all 0.2s',
          bgcolor: dragActive ? 'primary.light' : '#f8fafc',
          '&:hover': { borderColor: 'primary.main', bgcolor: '#f1f5f9' },
          mb: 4,
        }}
      >
        <Avatar sx={{ bgcolor: 'white', border: '1px solid #e2e8f0', width: 80, height: 80, mx: 'auto', mb: 2 }}>
          <CloudUploadIcon sx={{ fontSize: 40, color: 'primary.main' }} />
        </Avatar>
        <Typography variant="h5" sx={{ fontWeight: 800, mb: 1 }}>Ingest Knowledge</Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          Drag and drop your PDF report. Agents will begin structural mapping instantly.
        </Typography>

        <input
          type="file"
          accept=".pdf"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
          id="file-input"
        />
        <label htmlFor="file-input">
          <Button variant="outlined" component="span" sx={{ borderRadius: 2, px: 4, fontWeight: 700 }}>
            Browse Local Files
          </Button>
        </label>
      </Box>

      {selectedFile && !isLoading && (
        <Paper variant="outlined" sx={{ p: 2, mb: 3, display: 'flex', alignItems: 'center', gap: 2, borderRadius: 3, border: '1px solid #4f46e5' }}>
          <DescriptionIcon color="primary" />
          <Box sx={{ flex: 1 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{selectedFile.name}</Typography>
            <Typography variant="caption">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB • Ready for ingestion</Typography>
          </Box>
          <Button variant="contained" disableElevation onClick={handleUpload} sx={{ borderRadius: 2, fontWeight: 700 }}>
            Start Ingestion
          </Button>
        </Paper>
      )}

      {isLoading && (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <CircularProgress size={60} thickness={5} sx={{ mb: 2 }} />
          <Typography variant="h6" sx={{ fontWeight: 800 }}>Orchestrating Agents...</Typography>
          <Typography variant="body2" color="text.secondary">Mapping structural components and extracting core entities.</Typography>
          <Box sx={{ width: '100%', mt: 3 }}>
            <LinearProgress variant="indeterminate" sx={{ height: 10, borderRadius: 5 }} />
          </Box>
        </Box>
      )}
    </Box>
  );
}
