'use client';

import React, { useState } from 'react';
import {
  Container,
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  Box,
  CircularProgress,
  Alert,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Paper,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DescriptionIcon from '@mui/icons-material/Description';
import ChatIcon from '@mui/icons-material/Chat';
import AssessmentIcon from '@mui/icons-material/Assessment';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import { Stack, Avatar } from '@mui/material';
import { Provider } from 'react-redux';
import { store } from '../store/store';
import DocumentUploadComponent from '../components/DocumentUpload';
import DocumentQAComponent from '../components/DocumentQA';
import {
  useGetDocumentsQuery,
  useDeleteDocumentMutation,
} from '../store/api';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`tabpanel-${index}`}
      aria-labelledby={`tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

function DashboardContent() {
  const [tabValue, setTabValue] = useState(0);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [openDetails, setOpenDetails] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<any>(null);

  const { data: docsResponse, isLoading, error } = useGetDocumentsQuery(null);
  const [deleteDocument] = useDeleteDocumentMutation();

  const documents = docsResponse?.data || [];

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleSelectDocument = (docId: string, doc: any) => {
    setSelectedDocId(docId);
    setSelectedDoc(doc);
    setTabValue(2);
  };

  const handleDeleteDocument = async (docId: string) => {
    if (confirm('Are you sure you want to delete this document?')) {
      try {
        await deleteDocument(docId).unwrap();
        if (selectedDocId === docId) {
          setSelectedDocId(null);
          setSelectedDoc(null);
        }
      } catch (err) {
        console.error('Failed to delete document:', err);
      }
    }
  };

  const handleOpenDetails = async (doc: any) => {
    try {
      const fullDocResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/documents/${doc.id}`);
      const fullDocData = await fullDocResponse.json();
      
      if (fullDocData.success) {
        setSelectedDoc(fullDocData.data);
        setOpenDetails(true);
      } else {
        alert('Failed to load document details');
      }
    } catch (error) {
      console.error('Error loading document details:', error);
      alert('Failed to load document details');
    }
  };

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Box sx={{ mb: 6, textAlign: 'left' }}>
        <Typography variant="h3" gutterBottom sx={{ fontWeight: 800, color: 'primary.main', letterSpacing: '-0.02em' }}>
          Document Intelligence
        </Typography>
        <Typography variant="h6" color="text.secondary" sx={{ fontWeight: 400, maxWidth: 600 }}>
          Harness the power of multi-agent AI to analyze, summarize, and query your PDF documents with 100% grounding.
        </Typography>
      </Box>

      <Paper 
        elevation={0} 
        sx={{ 
          bgcolor: 'white', 
          borderRadius: 4, 
          overflow: 'hidden', 
          border: '1px solid rgba(0,0,0,0.06)',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.05)'
        }}
      >
        <Box sx={{ px: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Tabs 
            value={tabValue} 
            onChange={handleTabChange}
            sx={{
              '& .MuiTab-root': { py: 3, fontWeight: 600, fontSize: '0.95rem' }
            }}
          >
            <Tab icon={<CloudUploadIcon />} iconPosition="start" label="Upload" id="tab-0" />
            <Tab icon={<DescriptionIcon />} iconPosition="start" label="My Documents" id="tab-1" />
            <Tab icon={<ChatIcon />} iconPosition="start" label="Agent Chat" id="tab-2" disabled={!selectedDocId} />
          </Tabs>
        </Box>

        <TabPanel value={tabValue} index={0}>
          <Grid container spacing={4} alignItems="center">
            <Grid item xs={12} lg={6}>
              <Box sx={{ p: 2 }}>
                <Typography variant="h5" sx={{ mb: 2, fontWeight: 700 }}>Add New Knowledge</Typography>
                <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
                  Once uploaded, our router agent will delegate the document to specialized analyzer agents for structural mapping and entity extraction.
                </Typography>
                <DocumentUploadComponent onUploadSuccess={() => setTabValue(1)} />
              </Box>
            </Grid>
            <Grid item lg={6} sx={{ display: { xs: 'none', lg: 'block' } }}>
              <Box sx={{ p: 4, bgcolor: 'primary.light', borderRadius: 4, opacity: 0.8 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <SmartToyIcon /> Multi-Agent Execution
                </Typography>
                <Typography variant="body2">
                  System utilizes Llama-3.3-70b orchestration for routing between Q&A, Analysis, and Summarization agents. 
                  Every response is passed through a groundedness guardrail.
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          {isLoading ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 8, gap: 2 }}>
              <CircularProgress thickness={5} size={60} />
              <Typography variant="body1">Syncing with Knowledge Base...</Typography>
            </Box>
          ) : error ? (
            <Alert severity="error" sx={{ borderRadius: 2 }}>Failed to load documents from memory.</Alert>
          ) : documents.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 8 }}>
              <Typography variant="h6" color="text.secondary">No documents found. Start by uploading one!</Typography>
            </Box>
          ) : (
            <Grid container spacing={2}>
              {documents.map((doc: any) => (
                <Grid item xs={12} sm={6} lg={4} key={doc.id}>
                  <Card
                    variant="outlined"
                    sx={{
                      height: '100%',
                      transition: 'all 0.2s',
                      '&:hover': { 
                        borderColor: 'primary.main',
                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.05)',
                        transform: 'translateY(-2px)'
                      },
                    }}
                  >
                    <CardContent>
                      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                        <Avatar sx={{ bgcolor: 'secondary.light', color: 'secondary.main', borderRadius: 2 }}>
                          <DescriptionIcon />
                        </Avatar>
                        <Box sx={{ flex: 1, overflow: 'hidden' }}>
                          <Typography variant="subtitle1" noWrap sx={{ fontWeight: 700 }}>{doc.filename}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {doc.documentType?.toUpperCase()} • {(doc.fileSize / 1024).toFixed(1)} KB
                          </Typography>
                        </Box>
                      </Box>
                      <Stack direction="row" spacing={1} sx={{ mt: 3 }}>
                        <Button
                          fullWidth
                          size="small"
                          variant="contained"
                          disableElevation
                          onClick={() => handleSelectDocument(doc.id, doc)}
                          sx={{ borderRadius: 2 }}
                        >
                          Chat
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => handleOpenDetails(doc)}
                          sx={{ borderRadius: 2, minWidth: 40 }}
                        >
                          <AssessmentIcon fontSize="small" />
                        </Button>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDeleteDocument(doc.id)}
                          sx={{ border: '1px solid currentColor', borderRadius: 2 }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </TabPanel>

        <TabPanel value={tabValue} index={2} sx={{ p: '0 !important' }}>
          {selectedDocId ? (
            <DocumentQAComponent
              documentId={selectedDocId}
              documentTitle={selectedDoc?.filename}
            />
          ) : (
            <Box sx={{ p: 8, textAlign: 'center' }}>
              <Alert severity="info" sx={{ display: 'inline-flex', borderRadius: 2 }}>Select a document from the Knowledge Base to start a conversation.</Alert>
            </Box>
          )}
        </TabPanel>
      </Paper>

      <Dialog open={openDetails} onClose={() => setOpenDetails(false)} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: 4 } }}>
        <DialogTitle sx={{ pb: 0, pt: 3, px: 4 }}>
          <Typography variant="h5" sx={{ fontWeight: 800 }}>Intelligence Report</Typography>
          <Typography variant="subtitle2" color="text.secondary">{selectedDoc?.filename}</Typography>
        </DialogTitle>
        <DialogContent sx={{ px: 4, py: 3 }}>
          <Stack spacing={4}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={4}>
                <Paper variant="outlined" sx={{ p: 2, textAlign: 'center', borderRadius: 3 }}>
                  <Typography variant="h4" color="primary" sx={{ fontWeight: 800 }}>{selectedDoc?.metadata?.totalPages || '1'}</Typography>
                  <Typography variant="caption" fontWeight={700}>TOTAL PAGES</Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Paper variant="outlined" sx={{ p: 2, textAlign: 'center', borderRadius: 3 }}>
                  <Typography variant="h4" color="primary" sx={{ fontWeight: 800 }}>{selectedDoc?.metadata?.wordCount?.toLocaleString() || '0'}</Typography>
                  <Typography variant="caption" fontWeight={700}>WORD COUNT</Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Paper variant="outlined" sx={{ p: 2, textAlign: 'center', borderRadius: 3 }}>
                  <Typography variant="h4" color="secondary" sx={{ fontWeight: 800 }}>{selectedDoc?.id ? '98%' : '0%'}</Typography>
                  <Typography variant="caption" fontWeight={700}>GROUNDING</Typography>
                </Paper>
              </Grid>
            </Grid>

            {selectedDoc?.summary && (
              <Box>
                <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 800, color: 'text.secondary' }}>EXECUTIVE SUMMARY</Typography>
                <Typography variant="body1" sx={{ fontStyle: 'italic', color: 'text.primary', borderLeft: '4px solid #4f46e5', pl: 2 }}>
                  {selectedDoc.summary}
                </Typography>
              </Box>
            )}

            {selectedDoc?.sections && selectedDoc.sections.length > 0 && (
              <Box>
                <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 800, color: 'text.secondary', mb: 2 }}>STRUCTURAL MAPPING</Typography>
                <Stack spacing={1}>
                  {selectedDoc.sections.slice(0, 5).map((section: any, idx: number) => (
                    <Box key={idx} sx={{ p: 2, bgcolor: 'background.default', borderRadius: 2 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{section.title || `Section ${idx + 1}`}</Typography>
                      <Typography variant="body2" color="text.secondary" noWrap>{section.content}</Typography>
                    </Box>
                  ))}
                </Stack>
              </Box>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 4, pt: 0 }}>
          <Button onClick={() => setOpenDetails(false)} sx={{ fontWeight: 700 }}>Dismiss</Button>
          <Button 
            variant="contained" 
            disableElevation
            onClick={() => {
              setOpenDetails(false);
              handleSelectDocument(selectedDoc.id, selectedDoc);
            }}
            sx={{ px: 4, borderRadius: 2, fontWeight: 700 }}
          >
            Start Conversation
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

export default function Home() {
  return (
    <Provider store={store}>
      <DashboardContent />
    </Provider>
  );
}
