import { useState, useEffect, useCallback, useMemo } from 'react';
import { Box, Grid, Container } from '@mui/material';
import TemperatureHumiditySection from './sections/TemperatureHumiditySection';
import ElectricalSection from './sections/ElectricalSection';
import FireSmokeSection from './sections/FireSmokeSection';
import AccessDoorSection from './sections/AccessDoorSection';
import HistoricalDataSection from './sections/HistoricalDataSection';
import { useSocket } from '../contexts/SocketContext';
import { mockedData } from '../utils/mockData';
import { DataType } from '../types';

interface DashboardProps {
  addAlert: (message: string) => void;
  isMobile: boolean;
}

const Dashboard = ({ addAlert, isMobile }: DashboardProps) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DataType>(mockedData);
  const { socket, connected } = useSocket();

  // Memoize thresholds to prevent unnecessary re-renders
  const thresholds = useMemo(() => ({
    temperature: {
      warning: { low: 18, high: 23 },
      critical: { low: 18, high: 25 }
    },
    humidity: {
      warning: { low: 30, high: 60 },
      critical: { low: 30, high: 60 }
    },
    smoke: { warning: 1 },
    fire: { warning: 1024 },
    voltage: { 
      warning: { low: 210, high: 240 }, 
      critical: { low: 200, high: 250 } 
    }
  }), []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 1000); // Reduced initial loading time
    return () => clearTimeout(timer);
  }, []);

  // Memoize threshold check functions
  const checkTemperatureThresholds = useCallback((label: string, value: number) => {
    if (value < thresholds.temperature.warning.low || value > thresholds.temperature.critical.high) {
      addAlert(`CRITICAL ALERT: ${label} is at ${value}°C (outside safe range: ${thresholds.temperature.warning.low}°C - ${thresholds.temperature.critical.high}°C)!`);
    } else if (value >= thresholds.temperature.warning.high && value <= thresholds.temperature.critical.high) {
      addAlert(`WARNING: ${label} is at ${value}°C (warning range: ${thresholds.temperature.warning.high}°C - ${thresholds.temperature.critical.high}°C)!`);
    }
  }, [thresholds.temperature, addAlert]);

  const checkHumidityThresholds = useCallback((label: string, value: number) => {
    if (value < thresholds.humidity.warning.low) {
      addAlert(`WARNING: ${label} is too low at ${value}% (minimum: ${thresholds.humidity.warning.low}%)!`);
    } else if (value > thresholds.humidity.warning.high) {
      addAlert(`WARNING: ${label} is too high at ${value}% (maximum: ${thresholds.humidity.warning.high}%)!`);
    }
  }, [thresholds.humidity, addAlert]);

  const checkVoltageThresholds = useCallback((label: string, value: number) => {
    if (value <= thresholds.voltage.critical.low) {
      addAlert(`CRITICAL ALERT: ${label} voltage is too low at ${value}V (threshold: ${thresholds.voltage.critical.low}V)!`);
    } else if (value >= thresholds.voltage.critical.high) {
      addAlert(`CRITICAL ALERT: ${label} voltage is too high at ${value}V (threshold: ${thresholds.voltage.critical.high}V)!`);
    } else if (value <= thresholds.voltage.warning.low) {
      addAlert(`WARNING: ${label} voltage is low at ${value}V (threshold: ${thresholds.voltage.warning.low}V)!`);
    } else if (value >= thresholds.voltage.warning.high) {
      addAlert(`WARNING: ${label} voltage is high at ${value}V (threshold: ${thresholds.voltage.warning.high}V)!`);
    }
  }, [thresholds.voltage, addAlert]);

  useEffect(() => {
    if (!socket || !connected) return;

    const handleNocTemperature = (newData: any) => {
      setData(prev => ({ ...prev, nocTemperature: newData }));
      checkTemperatureThresholds('NOC temperature', newData.suhu);
    };

    const handleUpsTemperature = (newData: any) => {
      setData(prev => ({ ...prev, upsTemperature: newData }));
      checkTemperatureThresholds('UPS temperature', newData.suhu);
    };

    const handleNocHumidity = (newData: any) => {
      setData(prev => ({ ...prev, nocHumidity: newData }));
      checkHumidityThresholds('NOC humidity', newData.kelembapan);
    };

    const handleUpsHumidity = (newData: any) => {
      setData(prev => ({ ...prev, upsHumidity: newData }));
      checkHumidityThresholds('UPS humidity', newData.kelembapan);
    };

    const handleElectricalData = (newData: any) => {
      setData(prev => ({ ...prev, electrical: newData }));
      checkVoltageThresholds('Phase R', newData.phase_r);
      checkVoltageThresholds('Phase S', newData.phase_s);
      checkVoltageThresholds('Phase T', newData.phase_t);
    };

    const handleFireSmokeData = (newData: any) => {
      setData(prev => ({ ...prev, fireSmoke: newData }));
      if (newData.api_value < 50) {
        addAlert('CRITICAL ALERT: Fire detected! Take immediate action.');
      }
      if (newData.asap_value === 0) {
        addAlert('WARNING: Smoke detected! Investigate immediately.');
      }
    };

    const handleHistoricalData = (newData: any) => {
      setData(prev => ({ ...prev, historical: newData }));
    };

    // Socket event listeners
    socket.on('noc_temperature', handleNocTemperature);
    socket.on('ups_temperature', handleUpsTemperature);
    socket.on('noc_humidity', handleNocHumidity);
    socket.on('ups_humidity', handleUpsHumidity);
    socket.on('electrical_data', handleElectricalData);
    socket.on('fire_smoke_data', handleFireSmokeData);
    socket.on('historical_data', handleHistoricalData);

    return () => {
      socket.off('noc_temperature', handleNocTemperature);
      socket.off('ups_temperature', handleUpsTemperature);
      socket.off('noc_humidity', handleNocHumidity);
      socket.off('ups_humidity', handleUpsHumidity);
      socket.off('electrical_data', handleElectricalData);
      socket.off('fire_smoke_data', handleFireSmokeData);
      socket.off('historical_data', handleHistoricalData);
    };
  }, [socket, connected, addAlert, checkTemperatureThresholds, checkHumidityThresholds, checkVoltageThresholds]);

  // Memoize grid layout
  const mainContent = useMemo(() => (
    <Grid container spacing={2}>
      {/* Main Monitoring Section */}
      <Grid item xs={12} lg={8}>
        <Grid container spacing={2}>
          {/* Temperature & Humidity Section */}
          <Grid item xs={12}>
            <TemperatureHumiditySection 
              data={data} 
              loading={loading}
              thresholds={thresholds}
            />
          </Grid>
          
          {/* Electrical Section */}
          <Grid item xs={12}>
            <ElectricalSection 
              data={data.electrical} 
              loading={loading}
              thresholds={thresholds.voltage}
            />
          </Grid>
        </Grid>
      </Grid>

      {/* Side Panel */}
      <Grid item xs={12} lg={4}>
        <Grid container spacing={2}>
          {/* Fire & Smoke Detection Section */}
          <Grid item xs={12}>
            <FireSmokeSection 
              data={data.fireSmoke} 
              loading={loading}
            />
          </Grid>
          
          {/* Access Door Logs Section */}
          <Grid item xs={12}>
            <AccessDoorSection />
          </Grid>
        </Grid>
      </Grid>

      {/* Historical Data Section - Full Width at Bottom */}
      <Grid item xs={12}>
        <HistoricalDataSection 
          data={data} 
          loading={loading}
          isMobile={isMobile}
        />
      </Grid>
    </Grid>
  ), [data, loading, isMobile, thresholds]);

  return (
    <Box 
      component="main" 
      sx={{ 
        flexGrow: 1, 
        py: 2,
        willChange: 'transform', // Optimize animations
        contain: 'content', // Improve performance
      }}
    >
      <Container maxWidth={false}>
        {mainContent}
      </Container>
    </Box>
  );
};

export default Dashboard;