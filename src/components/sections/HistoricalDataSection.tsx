import { useState, useEffect } from 'react';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  Grid, 
  Typography, 
  Box, 
  Divider, 
  Skeleton,
  ToggleButtonGroup,
  ToggleButton,
  Tab,
  Tabs,
  Button,
  CircularProgress,
  Stack,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import { BarChart3, Calendar, FileSpreadsheet, Download, Table, LineChart } from 'lucide-react';
import { DataType } from '../../types';
import TemperatureChart from '../charts/TemperatureChart';
import HumidityChart from '../charts/HumidityChart';
import ElectricalChart from '../charts/ElectricalChart';
import { format } from 'date-fns';
import { useSocket } from '../../contexts/SocketContext';

interface HistoricalDataSectionProps {
  data: DataType;
  loading: boolean;
  isMobile: boolean;
}

const HistoricalDataSection = ({ data, loading, isMobile }: HistoricalDataSectionProps) => {
  const [timeRange, setTimeRange] = useState('24h');
  const [activeTab, setActiveTab] = useState(0);
  const [exportLoading, setExportLoading] = useState(false);
  const [exportAnchorEl, setExportAnchorEl] = useState<null | HTMLElement>(null);
  const { socket } = useSocket();

  // Request initial historical data
  useEffect(() => {
    if (socket) {
      socket.emit('request_historical_data', { timeRange });
    }
  }, [socket, timeRange]);

  const handleTimeRangeChange = (
    _: React.MouseEvent<HTMLElement>,
    newTimeRange: string | null,
  ) => {
    if (newTimeRange !== null) {
      setTimeRange(newTimeRange);
      // Request new historical data when time range changes
      socket?.emit('request_historical_data', { timeRange: newTimeRange });
    }
  };

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const handleExportClick = (event: React.MouseEvent<HTMLElement>) => {
    setExportAnchorEl(event.currentTarget);
  };

  const handleExportClose = () => {
    setExportAnchorEl(null);
  };

  const exportData = async (format: 'csv' | 'excel') => {
    try {
      setExportLoading(true);
      handleExportClose();

      const baseUrl = import.meta.env.VITE_SOCKET_SERVER || 'http://10.10.1.25:3000';
      let endpoint = '';
      
      switch (activeTab) {
        case 0:
          endpoint = 'temperature';
          break;
        case 1:
          endpoint = 'humidity';
          break;
        case 2:
          endpoint = 'electrical';
          break;
        default:
          throw new Error('Invalid tab selection');
      }

      const token = localStorage.getItem('authToken');
      if (!token) {
        throw new Error('Authentication token not found');
      }

      const response = await fetch(`${baseUrl}/api/export/${endpoint}?timeRange=${timeRange}&format=${format}`, {
        method: 'GET',
        headers: {
          'Accept': format === 'csv' ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Authorization': `Bearer ${token}`,
          'Cache-Control': 'no-cache'
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Session expired. Please log in again.');
        }
        throw new Error(`Export failed: ${response.statusText}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      const timestamp = format(new Date(), 'yyyyMMdd_HHmmss');
      link.href = url;
      link.download = `${endpoint}_data_${timeRange}_${timestamp}.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

    } catch (error) {
      console.error('Export error:', error);
      // You might want to show an error message to the user here
      alert(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setExportLoading(false);
    }
  };

  const getTabLabel = (index: number) => {
    switch (index) {
      case 0:
        return 'Temperature Data';
      case 1:
        return 'Humidity Data';
      case 2:
        return 'Electrical Data';
      default:
        return '';
    }
  };

  return (
    <Card 
      sx={{ 
        backgroundImage: 'linear-gradient(to bottom right, rgba(30, 30, 60, 0.4), rgba(30, 30, 60, 0.1))',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
      }}
      className="card"
    >
      <CardHeader 
        title={
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <BarChart3 size={24} color="#3f88f2" />
            <Typography variant="h5" sx={{ ml: 1, fontWeight: 600 }}>
              Historical Data
            </Typography>
          </Box>
        } 
        action={
          <Stack direction="row" spacing={2} alignItems="center">
            <Button
              variant="outlined"
              onClick={handleExportClick}
              startIcon={exportLoading ? <CircularProgress size={20} /> : <FileSpreadsheet size={20} />}
              disabled={exportLoading}
              sx={{
                borderColor: 'rgba(255, 255, 255, 0.2)',
                color: 'text.primary',
                '&:hover': {
                  borderColor: 'primary.main',
                  backgroundColor: 'rgba(63, 136, 242, 0.1)',
                }
              }}
            >
              Export Data
            </Button>
            <Menu
              anchorEl={exportAnchorEl}
              open={Boolean(exportAnchorEl)}
              onClose={handleExportClose}
              PaperProps={{
                sx: {
                  mt: 1.5,
                  minWidth: 180,
                  backdropFilter: 'blur(10px)',
                  backgroundColor: 'rgba(26, 26, 46, 0.9)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
                }
              }}
              transformOrigin={{ horizontal: 'right', vertical: 'top' }}
              anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
            >
              <MenuItem onClick={() => exportData('csv')}>
                <ListItemIcon>
                  <Table size={18} />
                </ListItemIcon>
                <ListItemText>Export as CSV</ListItemText>
              </MenuItem>
              <MenuItem onClick={() => exportData('excel')}>
                <ListItemIcon>
                  <LineChart size={18} />
                </ListItemIcon>
                <ListItemText>Export as Excel</ListItemText>
              </MenuItem>
            </Menu>
            <ToggleButtonGroup
              size="small"
              value={timeRange}
              exclusive
              onChange={handleTimeRangeChange}
              aria-label="time range"
              sx={{ 
                border: '1px solid rgba(255, 255, 255, 0.1)',
                '.MuiToggleButton-root': {
                  color: 'text.secondary',
                  '&.Mui-selected': {
                    color: 'primary.main',
                    backgroundColor: 'rgba(63, 136, 242, 0.1)',
                  }
                } 
              }}
            >
              <ToggleButton value="24h" aria-label="24 hours">
                24h
              </ToggleButton>
              <ToggleButton value="7d" aria-label="7 days">
                7d
              </ToggleButton>
              <ToggleButton value="30d" aria-label="30 days">
                30d
              </ToggleButton>
            </ToggleButtonGroup>
          </Stack>
        }
        sx={{ pb: 0 }}
      />
      
      <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}>
        <Tabs 
          value={activeTab} 
          onChange={handleTabChange} 
          variant={isMobile ? "scrollable" : "fullWidth"}
          scrollButtons={isMobile ? "auto" : false}
          sx={{ 
            '.MuiTab-root': { 
              textTransform: 'none',
              fontWeight: 500,
              minHeight: '48px',
            } 
          }}
        >
          <Tab 
            label="Temperature" 
            icon={<Calendar size={16} />} 
            iconPosition="start"
          />
          <Tab 
            label="Humidity" 
            icon={<Calendar size={16} />} 
            iconPosition="start"
          />
          <Tab 
            label="Electrical" 
            icon={<Calendar size={16} />} 
            iconPosition="start"
          />
        </Tabs>
      </Box>
      
      <CardContent>
        {loading ? (
          <Skeleton variant="rectangular\" height={300} width="100%" />
        ) : (
          <Box sx={{ mt: 1 }}>
            {activeTab === 0 && (
              <TemperatureChart 
                nocData={data.historical.temperature?.noc || []} 
                upsData={data.historical.temperature?.ups || []} 
                timeRange={timeRange}
              />
            )}
            
            {activeTab === 1 && (
              <HumidityChart 
                nocData={data.historical.humidity?.noc || []} 
                upsData={data.historical.humidity?.ups || []} 
                timeRange={timeRange}
              />
            )}
            
            {activeTab === 2 && (
              <ElectricalChart 
                data={data.historical.electrical || []} 
                timeRange={timeRange}
              />
            )}
          </Box>
        )}
        
        <Box 
          sx={{ 
            mt: 2, 
            p: 2,
            borderRadius: 2,
            bgcolor: 'rgba(63, 136, 242, 0.1)', 
            border: '1px solid rgba(63, 136, 242, 0.2)',
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            justifyContent: 'space-between',
            gap: 2
          }}
        >
          <Box>
            <Typography variant="subtitle2" color="primary.light" sx={{ mb: 0.5 }}>
              Current View
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {getTabLabel(activeTab)} • {timeRange === '24h' ? 'Last 24 Hours' : timeRange === '7d' ? 'Last 7 Days' : 'Last 30 Days'}
            </Typography>
          </Box>
          <Box>
            <Typography variant="subtitle2" color="primary.light" sx={{ mb: 0.5 }}>
              Data Points
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {timeRange === '24h' ? '144 samples (10 min intervals)' : 
               timeRange === '7d' ? '168 samples (1 hour intervals)' : 
               '120 samples (6 hour intervals)'}
            </Typography>
          </Box>
          <Box>
            <Typography variant="subtitle2" color="primary.light" sx={{ mb: 0.5 }}>
              Last Updated
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {format(new Date(), 'dd MMM yyyy HH:mm:ss')}
            </Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

export default HistoricalDataSection;