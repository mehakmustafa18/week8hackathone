'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  CircularProgress,
  Alert,
  Typography,
  Chip,
  Paper,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemText,
  LinearProgress,
  Grid,
  Stack,
  Avatar,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import RouterIcon from '@mui/icons-material/Router';
import BuildIcon from '@mui/icons-material/Build';
import DescriptionIcon from '@mui/icons-material/Description';
import AssessmentIcon from '@mui/icons-material/Assessment';
import SummarizeIcon from '@mui/icons-material/Summarize';
import QuestionAnswerIcon from '@mui/icons-material/QuestionAnswer';
import StarsIcon from '@mui/icons-material/Stars';
import TimelineIcon from '@mui/icons-material/Timeline';
import { useAskQuestionMutation, useGetChatHistoryQuery } from '../store/api';

interface DocumentQAProps {
  documentId: string;
  documentTitle?: string;
}

export default function DocumentQAComponent({
  documentId,
  documentTitle = 'Document',
}: DocumentQAProps) {
  const [query, setQuery] = useState('');
  const [responses, setResponses] = useState<any[]>([]);
  const [expandedResponse, setExpandedResponse] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [askQuestion, { isLoading }] = useAskQuestionMutation();
  const { data: chatHistory } = useGetChatHistoryQuery(documentId);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [responses]);

  const handleAskQuestion = async () => {
    if (!query.trim()) return;
    
    if (!documentId || documentId.trim() === '') {
      alert('❌ No document selected. Please select a document first.');
      return;
    }

    const userQuery = query;
    setQuery('');

    try {
      console.log(`[FRONTEND] Asking question: ${userQuery} for document ${documentId}`);
      
      const result = await askQuestion({
        documentId,
        query: userQuery,
      }).unwrap();

      console.log(`[FRONTEND] Question response received:`, result);
      
      setResponses((prev) => [
        ...prev,
        {
          query: userQuery,
          response: result.data?.response || result.response,
          trace: result.trace,
          timestamp: new Date(),
        },
      ]);
    } catch (error: any) {
      console.error(`[FRONTEND] Question failed:`, error);
      
      let errorMessage = 'Failed to process query: ';
      if (error?.data?.message) {
        errorMessage += error.data.message;
      } else if (error?.error) {
        errorMessage += error.error;
      } else if (error?.message) {
        errorMessage += error.message;
      } else if (error?.status) {
        errorMessage += `Server error: ${error.status}`;
      } else {
        errorMessage += 'Unknown error. Check console for details.';
      }
      
      alert(`❌ Question Failed\n\n${errorMessage}\n\nPlease check:\n1. Document was uploaded successfully\n2. Backend server is running\n3. Check browser console for details`);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAskQuestion();
    }
  };

  return (
    <Box sx={{ height: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column' }}>
      <Grid container spacing={3} sx={{ height: '100%', overflow: 'hidden' }}>
        {/* Left Sidebar: Document Info & Stats */}
        <Grid item xs={12} md={4} lg={3} sx={{ height: '100%', overflowY: 'auto', display: { xs: 'none', md: 'block' } }}>
          <Stack spacing={3}>
            <Card variant="outlined" sx={{ border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 1.5 }}>
                  <Avatar sx={{ bgcolor: 'primary.main', width: 48, height: 48 }}>
                    <DescriptionIcon />
                  </Avatar>
                  <Box>
                    <Typography variant="h6" sx={{ fontSize: '1.1rem' }}>{documentTitle}</Typography>
                    <Typography variant="caption" color="text.secondary">Document Context Active</Typography>
                  </Box>
                </Box>
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 700 }}>AI Capabilities</Typography>
                <Stack spacing={1}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <RouterIcon fontSize="small" color="primary" />
                    <Typography variant="body2">Intelligent Routing</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <AssessmentIcon fontSize="small" color="primary" />
                    <Typography variant="body2">Deep Analysis</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <SummarizeIcon fontSize="small" color="primary" />
                    <Typography variant="body2">Smart Summarization</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <QuestionAnswerIcon fontSize="small" color="primary" />
                    <Typography variant="body2">Grounded Q&A</Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>

            <Alert severity="info" variant="standard" sx={{ borderRadius: 3 }}>
              Try asking about sections, key themes, or a summary!
            </Alert>
          </Stack>
        </Grid>

        {/* Right Area: Chat & Responses */}
        <Grid item xs={12} md={8} lg={9} sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          <Paper 
            sx={{ 
              flex: 1, 
              mb: 2, 
              p: 3, 
              overflowY: 'auto', 
              bgcolor: 'transparent',
              boxShadow: 'none',
              display: 'flex',
              flexDirection: 'column',
              gap: 3
            }}
          >
            {responses.length === 0 ? (
              <Box sx={{ m: 'auto', textAlign: 'center', opacity: 0.6 }}>
                <SmartToyIcon sx={{ fontSize: 64, mb: 2, color: 'primary.light' }} />
                <Typography variant="h5" gutterBottom sx={{ fontWeight: 600 }}>Hello! I'm your PDF Agent.</Typography>
                <Typography variant="body1">Upload a document and ask me anything below.</Typography>
              </Box>
            ) : (
              responses.map((resp, idx) => (
                <Box key={idx} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {/* User Message */}
                  <Box sx={{ alignSelf: 'flex-end', maxWidth: '80%' }}>
                    <Paper 
                      sx={{ 
                        p: 2, 
                        bgcolor: 'primary.main', 
                        color: 'white', 
                        borderRadius: '20px 20px 4px 20px',
                        boxShadow: '0 10px 15px -3px rgba(79, 70, 229, 0.2)'
                      }}
                    >
                      <Typography variant="body1">{resp.query}</Typography>
                      <Typography variant="caption" sx={{ mt: 1, display: 'block', opacity: 0.8, textAlign: 'right' }}>
                        {resp.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Typography>
                    </Paper>
                  </Box>

                  {/* Agent Response Wrapper */}
                  <Box sx={{ alignSelf: 'flex-start', maxWidth: '90%', width: '100%' }}>
                    <Box sx={{ display: 'flex', gap: 2 }}>
                      <Avatar sx={{ bgcolor: 'secondary.main', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)' }}>
                        {resp.response?.routing?.targetAgent === 'analyzer' ? <AssessmentIcon /> :
                         resp.response?.routing?.targetAgent === 'summarizer' ? <SummarizeIcon /> :
                         <QuestionAnswerIcon />}
                      </Avatar>
                      
                      <Box sx={{ flex: 1 }}>
                        <Paper 
                          variant="outlined" 
                          sx={{ 
                            p: 3, 
                            borderRadius: '4px 20px 20px 20px', 
                            bgcolor: 'white',
                            border: '1px solid rgba(0,0,0,0.06)',
                            boxShadow: '0 4px 20px rgba(0,0,0,0.03)'
                          }}
                        >
                          {/* Reasoning / Routing Badge */}
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                            <Chip 
                              icon={<RouterIcon />} 
                              label={`${resp.response?.routing?.targetAgent?.toUpperCase()} AGENT`} 
                              size="small" 
                              color="primary" 
                              variant="outlined"
                              sx={{ fontWeight: 700, borderRadius: 1 }}
                            />
                            <Typography variant="caption" color="text.secondary">
                              {(resp.response?.routing?.confidence * 100).toFixed(0)}% Confidence
                            </Typography>
                          </Box>

                          {/* Success/Not Found Logic */}
                          {resp.response?.data?.notFound ? (
                            <Alert severity="warning" variant="outlined" sx={{ borderRadius: 2 }}>
                              {resp.response.data.answer}
                            </Alert>
                          ) : (
                            <Box>
                              <Typography variant="body1" sx={{ color: 'text.primary', fontWeight: 500, lineHeight: 1.7 }}>
                                {resp.response?.data?.answer || resp.response?.data?.executiveSummary || resp.response?.data?.analysis}
                              </Typography>

                              {/* Highlights */}
                              {resp.response?.data?.keyHighlights && (
                                <Box sx={{ mt: 2 }}>
                                  <Typography variant="subtitle2" color="primary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1, fontWeight: 700 }}>
                                    <StarsIcon fontSize="small" /> Key Insights
                                  </Typography>
                                  <Grid container spacing={1}>
                                    {resp.response.data.keyHighlights.slice(0, 4).map((h: string, i: number) => (
                                      <Grid item xs={12} sm={6} key={i}>
                                        <Paper variant="outlined" sx={{ p: 1.5, display: 'flex', gap: 1, bgcolor: '#f1f5f9', border: 'none' }}>
                                          <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>{h}</Typography>
                                        </Paper>
                                      </Grid>
                                    ))}
                                  </Grid>
                                </Box>
                              )}
                            </Box>
                          )}

                          {/* Expandable Trace (Professional Step-driven) */}
                          <Accordion disableGutters elevation={0} sx={{ mt: 2, bgcolor: 'transparent', '&:before': { display: 'none' } }}>
                            <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: 0, minHeight: 40 }}>
                              <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <TimelineIcon fontSize="inherit" /> VIEW EXECUTION STEPS
                              </Typography>
                            </AccordionSummary>
                            <AccordionDetails sx={{ px: 0, pt: 0 }}>
                              <Box sx={{ pl: 2, borderLeft: '2px dashed #e2e8f0', ml: 1 }}>
                                <Typography variant="caption" display="block" sx={{ mb: 1 }}>
                                  <strong>Handoff:</strong> Router → {resp.response?.routing?.targetAgent}
                                </Typography>
                                <Typography variant="caption" display="block" sx={{ mb: 1 }}>
                                  <strong>Reasoning:</strong> {resp.response?.routing?.reasoning || resp.trace?.routing?.routingReasoning}
                                </Typography>
                                <Typography variant="caption" display="block">
                                  <strong>Tools:</strong> {resp.response?.data?.toolsUsed?.join(', ') || 'Direct Context'}
                                </Typography>
                              </Box>
                            </AccordionDetails>
                          </Accordion>
                        </Paper>
                      </Box>
                    </Box>
                  </Box>
                </Box>
              ))
            )}
            <div ref={messagesEndRef} />
          </Paper>

          {/* Input Bar */}
          <Paper 
            elevation={10} 
            sx={{ 
              p: '4px 8px', 
              display: 'flex', 
              alignItems: 'center', 
              borderRadius: 4,
              border: '1px solid rgba(0,0,0,0.05)',
              mb: 1
            }}
          >
            <TextField
              fullWidth
              multiline
              maxRows={4}
              placeholder="Ask your PDF agent..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleAskQuestion();
                }
              }}
              disabled={isLoading}
              variant="standard"
              InputProps={{ disableUnderline: true, sx: { px: 2, py: 1.5 } }}
            />
            <Button
              variant="contained"
              size="large"
              onClick={handleAskQuestion}
              disabled={isLoading || !query.trim()}
              sx={{ 
                borderRadius: 3, 
                minWidth: 56, 
                height: 56,
                boxShadow: '0 4px 14px 0 rgba(79, 70, 229, 0.39)'
              }}
            >
              {isLoading ? <CircularProgress size={24} color="inherit" /> : <SendIcon />}
            </Button>
          </Paper>
          <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center', mb: 2, display: 'block' }}>
            Built with multi-agent orchestration for 100% document grounding.
          </Typography>
        </Grid>
      </Grid>
    </Box>
  );
}
