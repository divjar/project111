import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, Grid, Typography, Box, Divider, Skeleton } from '@mui/material';
import { DoorOpen, UserCheck, UserX } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useSocket } from '../../contexts/SocketContext';

interface AccessLog {
  username: string;
  door_name: string;
  access_time: string;
  access_granted: boolean;
}

const AccessDoorSection = () => {
  const [accessLogs, setAccessLogs] = useState<AccessLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { socket, connected } = useSocket();

  useEffect(() => {
    const fetchAccessLogs = async () => {
      try {
        setError(null);
        const baseUrl = import.meta.env.VITE_SOCKET_SERVER || 'http://10.10.1.25:3000';
        const token = localStorage.getItem('authToken');

        if (!token) {
          throw new Error('No authentication token found. Please log in again.');
        }

        const response = await fetch(`${baseUrl}/api/access-logs`, {
          headers: {
            'Accept': 'application/json',
            'Authorization': `Bearer ${token}`,
            'Cache-Control': 'no-cache'
          }
        });

        if (!response.ok) {
          if (response.status === 401) {
            localStorage.removeItem('authToken');
            window.location.reload();
            throw new Error('Session expired. Please log in again.');
          }
          throw new Error(`Failed to fetch access logs (${response.status})`);
        }

        const data = await response.json();
        if (Array.isArray(data)) {
          setAccessLogs(data);
        } else {
          throw new Error('Invalid data format received');
        }
        setLoading(false);
      } catch (error) {
        console.error('Error fetching access logs:', error);
        setError(error instanceof Error ? error.message : 'Failed to fetch access logs');
        setLoading(false);
      }
    };

    if (connected) {
      fetchAccessLogs();

      socket?.on('access_logs', (newLogs) => {
        if (Array.isArray(newLogs)) {
          setAccessLogs(newLogs);
          setError(null);
        }
      });

      const interval = setInterval(fetchAccessLogs, 30000);

      return () => {
        socket?.off('access_logs');
        clearInterval(interval);
      };
    }
  }, [connected, socket]);

  const formatTime = (timeString: string) => {
    try {
      const date = parseISO(timeString);
      return format(date, 'dd MMM yyyy HH:mm:ss');
    } catch (error) {
      return timeString;
    }
  };

  if (error) {
    return (
      <Card 
        sx={{ 
          backgroundImage: 'linear-gradient(to bottom right, rgba(30, 30, 60, 0.4), rgba(30, 30, 60, 0.1))',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 82, 82, 0.3)',
          height: '100%'
        }}
      >
        <CardContent>
          <Typography color="error" align="center">
            {error}
          </Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card 
      sx={{ 
        height: '100%',
        backgroundImage: 'linear-gradient(to bottom right, rgba(30, 30, 60, 0.4), rgba(30, 30, 60, 0.1))',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
      }}
      className="card"
    >
      <CardHeader 
        title={
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <DoorOpen size={24} color="#3f88f2" />
            <Typography variant="h5" sx={{ ml: 1, fontWeight: 600 }}>
              Access Door Logs
            </Typography>
          </Box>
        } 
        sx={{ pb: 1 }}
      />
      <Divider sx={{ opacity: 0.1 }} />
      <CardContent>
        {loading ? (
          <Grid container spacing={1}>
            {[1, 2, 3].map((i) => (
              <Grid item xs={12} key={i}>
                <Skeleton variant="rectangular" height={60} />
              </Grid>
            ))}
          </Grid>
        ) : (
          <Grid container spacing={1}>
            {accessLogs.map((log, index) => (
              <Grid item xs={12} key={index}>
                <Box
                  sx={{
                    p: 1.5,
                    borderRadius: 2,
                    bgcolor: 'rgba(26, 26, 46, 0.4)',
                    border: '1px solid',
                    borderColor: log.access_granted ? 'rgba(76, 175, 80, 0.3)' : 'rgba(255, 82, 82, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                  }}
                >
                  {log.access_granted ? (
                    <UserCheck size={20} color="#4caf50" />
                  ) : (
                    <UserX size={20} color="#ff5252" />
                  )}
                  <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                    <Typography variant="body1" sx={{ fontWeight: 500 }} noWrap>
                      {log.username || 'Unknown User'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="block" noWrap>
                      {log.door_name || 'Unknown Door'} • {formatTime(log.access_time)}
                    </Typography>
                  </Box>
                  <Box
                    sx={{
                      px: 1.5,
                      py: 0.5,
                      borderRadius: 1,
                      bgcolor: log.access_granted ? 'rgba(76, 175, 80, 0.1)' : 'rgba(255, 82, 82, 0.1)',
                      color: log.access_granted ? 'success.main' : 'error.main',
                      minWidth: 100,
                      textAlign: 'center'
                    }}
                  >
                    <Typography variant="caption" sx={{ fontWeight: 500 }}>
                      {log.access_granted ? 'GRANTED' : 'DENIED'}
                    </Typography>
                  </Box>
                </Box>
              </Grid>
            ))}
          </Grid>
        )}
      </CardContent>
    </Card>
  );
};

export default AccessDoorSection;