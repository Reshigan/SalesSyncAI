import React, { useState } from 'react';
import { Box, Typography, Link } from '@mui/material';

const GoNxtFooter: React.FC = () => {
  const [imageError, setImageError] = useState(false);

  const handleImageError = () => {
    setImageError(true);
  };

  return (
    <Box
      sx={{
        position: 'fixed',
        bottom: 16,
        right: 16,
        zIndex: 1000,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(10px)',
        borderRadius: 2,
        padding: '8px 12px',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
        border: '1px solid rgba(0, 0, 0, 0.05)',
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        transition: 'all 0.3s ease',
        '&:hover': {
          backgroundColor: 'rgba(255, 255, 255, 1)',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.15)',
          transform: 'translateY(-2px)',
        },
      }}
    >
      <Typography
        variant="caption"
        sx={{
          color: 'text.secondary',
          fontSize: '0.75rem',
          fontWeight: 500,
        }}
      >
        Developed by
      </Typography>
      <Link
        href="https://gonxt.co.za"
        target="_blank"
        rel="noopener noreferrer"
        sx={{
          textDecoration: 'none',
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          '&:hover': {
            textDecoration: 'none',
          },
        }}
      >
        {!imageError && (
          <Box
            component="img"
            src="/assets/gonxt-logo.svg"
            alt="GoNxt Logo"
            sx={{
              height: 20,
              width: 'auto',
              transition: 'all 0.3s ease',
              '&:hover': {
                transform: 'scale(1.05)',
              },
            }}
            onError={handleImageError}
          />
        )}
        {imageError && (
          <Box
            sx={{
              background: 'linear-gradient(45deg, #1976d2, #42a5f5)',
              borderRadius: 1,
              px: 1,
              py: 0.5,
              minWidth: 50,
              textAlign: 'center',
            }}
          >
            <Typography
              variant="caption"
              sx={{
                color: 'white',
                fontSize: '0.7rem',
                fontWeight: 700,
                letterSpacing: '0.5px',
              }}
            >
              GoNxt
            </Typography>
          </Box>
        )}
      </Link>
    </Box>
  );
};

export default GoNxtFooter;