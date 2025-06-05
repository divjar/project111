import { useState, useEffect, useCallback, useMemo } from 'react';
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
  Tooltip,
  Zoom,
  Chip,
} from '@mui/material';
import { 
  BarChart3, 
  Calendar, 
  FileSpreadsheet, 
  Download, 
  Table, 
  ZoomIn,
  ZoomOut,
  RefreshCw,
  Info,
} from 'lucide-react';
import { DataType } from '../../types';
import TemperatureChart from '../charts/TemperatureChart';
import HumidityChart from '../charts/HumidityChart';
import ElectricalChart from '../charts/ElectricalChart';
import { format, subHours, subDays } from 'date-fns';
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
  const [zoomLevel, setZoomLevel] = useState(1);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const { socket } = useSocket();

  // Calculate time range labels
  const timeRangeLabels = useMemo(() => ({
    '24h': {
      label: 'Last 24 Hours',
      start: format(subHours(new Date(), 24), 'dd MMM HH:mm'),
      end: format(new Date(), 'dd MMM HH:mm'),
      interval: '10 minutes'
    },
    '7d': {
      label: 'Last 7 Days',
      start: format(subDays(new Date(), 7), 'dd MMM'),
      end: format(new Date(), 'dd MMM'),
      interval: '1 hour'
    },
    '30d': {
      label: 'Last 30 Days',
      start: format(subDays(new Date(), 30), 'dd MMM'),
      end: format(new Date(), 'dd MMM'),
      interval: '6 hours'
    }
  }), []);

  // Request historical data on mount and when time range changes
  useEffect(() => {
    if (socket && autoRefresh) {
      const requestData = () => {
        socket.emit('request_historical_data', { timeRange });
      };

      requestData();
      const interval = setInterval(requestData, 10000);
      return () => clearInterval(interval);
    }
  }, [socket, timeRange, autoRefresh]);

  const handleTimeRangeChange = (
    _: React.MouseEvent<HTMLElement>,
    newTimeRange: string | null,
  ) => {
    if (newTimeRange !== null) {
      setTimeRange(newTimeRange);
      socket?.emit('request_historical_data', { timeRange: newTimeRange });
    }
  };

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
    setZoomLevel(1); // Reset zoom level on tab change
  };

  const handleExportClick = (event: React.MouseEvent<HTMLElement>) => {
    setExportAnchorEl(event.currentTarget);
  };

  const handleExportClose = () => {
    setExportAnchorEl(null);
  };

  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(prev + 0.2, 2));
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(prev - 0.2, 0.5));
  };

  const toggleAutoRefresh = () => {
    setAutoRefresh(prev => !prev);
  };

  const exportData = async () => {
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

      const response = await fetch(`${baseUrl}/api/export/${endpoint}?timeRange=${timeRange}&limit=100`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Cache-Control': 'no-cache',
          'Accept': 'text/csv'
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem('authToken');
          window.location.reload();
          throw new Error('Session expired. Please log in again.');
        }
        throw new Error(`Export failed: ${response.statusText}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      const timestamp = format(new Date(), 'yyyyMMdd_HHmmss');
      const fileName = `${endpoint}_data_${timeRange}_${timestamp}.csv`;
      
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

    } catch (error) {
      console.error('Export error:', error);
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

  const renderChart = () => {
    if (loading) {
      return <Skeleton variant="rectangular" height={300} width="100%" />;
    }

    const chartProps = {
      style: {
        transform: `scale(${zoomLevel})`,
        transformOrigin: 'center center',
        transition: 'transform 0.3s ease',
      }
    };

    switch (activeTab) {
      case 0:
        return (
          <TemperatureChart 
            nocData={data.historical.temperature?.noc || []} 
            upsData={data.historical.temperature?.ups || []} 
            timeRange={timeRange}
            {...chartProps}
          />
        );
      case 1:
        return (
          <HumidityChart 
            nocData={data.historical.humidity?.noc || []} 
            upsData={data.historical.humidity?.ups || []} 
            timeRange={timeRange}
            {...chartProps}
          />
        );
      case 2:
        return (
          <ElectricalChart 
            data={data.historical.electrical || []} 
            timeRange={timeRange}
            {...chartProps}
          />
        );
      default:
        return null;
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
          <Stack direction="row" spacing={1} alignItems="center">
            <Tooltip title="Auto Refresh" arrow>
              <Button
                variant="outlined"
                size="small"
                onClick={toggleAutoRefresh}
                color={autoRefresh ? "primary" : "inherit"}
                sx={{
                  minWidth: 40,
                  width: 40,
                  height: 40,
                  p: 0,
                }}
              >
                <RefreshCw 
                  size={20} 
                  className={autoRefresh ? 'animate-spin' : ''} 
                  style={{ 
                    animationDuration: '3s',
                    opacity: autoRefresh ? 1 : 0.5 
                  }} 
                />
              </Button>
            </Tooltip>

            <Tooltip title="Zoom In" arrow>
              <Button
                variant="outlined"
                size="small"
                onClick={handleZoomIn}
                disabled={zoomLevel >= 2}
                sx={{
                  minWidth: 40,
                  width: 40,
                  height: 40,
                  p: 0,
                }}
              >
                <ZoomIn size={20} />
              </Button>
            </Tooltip>

            <Tooltip title="Zoom Out" arrow>
              <Button
                variant="outlined"
                size="small"
                onClick={handleZoomOut}
                disabled={zoomLevel <= 0.5}
                sx={{
                  minWidth: 40,
                  width: 40,
                  height: 40,
                  p: 0,
                }}
              >
                <ZoomOut size={20} />
              </Button>
            </Tooltip>

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
            >
              <MenuItem onClick={exportData}>
                <ListItemIcon>
                  <Table size={18} />
                </ListItemIcon>
                <ListItemText>Export as CSV</ListItemText>
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
        <Box 
          sx={{ 
            mt: 1,
            position: 'relative',
            overflow: 'hidden',
            height: 300,
            '&::after': {
              content: '""',
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              background: loading ? 'rgba(0, 0, 0, 0.1)' : 'transparent',
              transition: 'background 0.3s ease',
            }
          }}
        >
          {renderChart()}
        </Box>
        
        <Box 
          sx={{ 
            mt: 2, 
            p: 2,
            borderRadius: 2,
            bgcolor: 'rgba(63, 136, 242, 0.1)', 
            border: '1px solid rgba(63, 136, 242, 0.2)',
          }}
        >
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <Box>
                <Typography variant="subtitle2" color="primary.light" sx={{ 
                  mb: 0.5,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1
                }}>
                  <Info size={16} />
                  Time Range
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {timeRangeLabels[timeRange as keyof typeof timeRangeLabels].label}
                  <br />
                  <span style={{ opacity: 0.7 }}>
                    {timeRangeLabels[timeRange as keyof typeof timeRangeLabels].start} - {timeRangeLabels[timeRange as keyof typeof timeRangeLabels].end}
                  </span>
                </Typography>
              </Box>
            </Grid>

            <Grid item xs={12} md={4}>
              <Box>
                <Typography variant="subtitle2" color="primary.light" sx={{ mb: 0.5 }}>
                  Data Resolution
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Sampling interval: {timeRangeLabels[timeRange as keyof typeof timeRangeLabels].interval}
                  <br />
                  <span style={{ opacity: 0.7 }}>
                    {timeRange === '24h' ? '144 samples' : 
                     timeRange === '7d' ? '168 samples' : 
                     '120 samples'}
                  </span>
                </Typography>
              </Box>
            </Grid>

            <Grid item xs={12} md={4}>
              <Box>
                <Typography variant="subtitle2" color="primary.light" sx={{ mb: 0.5 }}>
                  Status
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Chip 
                    size="small"
                    label={autoRefresh ? "Auto-refresh ON" : "Auto-refresh OFF"}
                    color={autoRefresh ? "success" : "default"}
                    variant="outlined"
                  />
                  <Chip 
                    size="small"
                    label={`Zoom: ${(zoomLevel * 100).toFixed(0)}%`}
                    color="primary"
                    variant="outlined"
                  />
                </Stack>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                  Last updated: {format(new Date(), 'dd MMM yyyy HH:mm:ss')}
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </Box>
      </CardContent>
    </Card>
  );
};

export default HistoricalDataSection;