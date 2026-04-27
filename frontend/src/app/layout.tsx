'use client';

import React, { useMemo } from 'react';
import { CssBaseline, ThemeProvider, createTheme, Box } from '@mui/material';
import { AppBar, Toolbar, Typography } from '@mui/material';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const theme = useMemo(() => createTheme({
    palette: {
      primary: {
        main: '#4f46e5', // Modern Indigo
        dark: '#3730a3',
        light: '#818cf8',
      },
      secondary: {
        main: '#10b981', // Emerald
      },
      background: {
        default: '#f8fafc', // Light Slate background
        paper: '#ffffff',
      },
      text: {
        primary: '#1e293b',
        secondary: '#64748b',
      },
    },
    shape: {
      borderRadius: 12,
    },
    typography: {
      fontFamily: '"Inter", "Outfit", "Roboto", "Helvetica", "Arial", sans-serif',
      h6: {
        fontWeight: 700,
        letterSpacing: '-0.02em',
      },
      body1: {
        fontSize: '0.95rem',
        lineHeight: 1.6,
      },
    },
  }), []);

  return (
    <html lang="en">
      <body>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <AppBar position="sticky" elevation={2} sx={{ maxWidth: '1440px', mx: 'auto', borderRadius: '0 0 16px 16px', mt: 1 }}>
            <Toolbar>
              <Typography variant="h6" component="div" sx={{ flexGrow: 1, fontWeight: 800 }}>
                📄 Smart PDF Intelligence
              </Typography>
              <Typography variant="caption" sx={{ fontWeight: 600, opacity: 0.9 }}>
                Multi-Agent System v1.0
              </Typography>
            </Toolbar>
          </AppBar>
          <Box sx={{ minHeight: 'calc(100vh - 64px)', bgcolor: 'transparent', p: 4, maxWidth: '1440px', mx: 'auto', width: '100%' }}>
            {children}
          </Box>
        </ThemeProvider>
      </body>
    </html>
  );
}
