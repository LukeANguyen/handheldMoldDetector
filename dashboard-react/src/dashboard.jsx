import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
import { Bell, User, Search, MoreVertical, Menu } from 'lucide-react';

export default function Dashboard() {
  // --- State for Live Clock ---
  const [time, setTime] = useState(new Date('2026-05-26T01:42:28'));

  // --- State for Live Sensor Data ---
  const [sensorData, setSensorData] = useState({
    temp: 22.1,
    humidity: 63.8,
    risk: 12.5,
    status: 'SAFE'
  });

  // --- State for Chart History ---
  const [history, setHistory] = useState(
    Array.from({ length: 60 }, (_, i) => ({
      time: i,
      temp: 21 + Math.sin(i / 5) * 1.5 + Math.random() * 0.2,
      humidity: 60 + Math.cos(i / 8) * 5 + Math.random() * 1
    }))
  );

  // --- Mock Data Pump & Clock Tick ---
  useEffect(() => {
    const timer = setInterval(() => {
      // Update Clock
      setTime(new Date());

      // Generate slight fluctuations
      setSensorData(prev => {
        const newTemp = prev.temp + (Math.random() - 0.5) * 0.2;
        const newHum = prev.humidity + (Math.random() - 0.5) * 0.5;
        
        // Intersection Risk Logic
        const calcRisk = newHum > 60 && newTemp > 21 
          ? Math.min(100, ((newHum - 60) / 40) * ((newTemp - 21) / 15) * 100)
          : 0;
          
        let newStatus = 'SAFE';
        if (calcRisk > 45) newStatus = 'MOLD CONDITIONS';
        else if (calcRisk > 0.5) newStatus = 'HIGH RISK';

        return {
          temp: newTemp,
          humidity: newHum,
          risk: calcRisk,
          status: newStatus
        };
      });

      // Shift chart data
      setHistory(prev => {
        const newHistory = [...prev.slice(1)];
        newHistory.push({
          time: prev[prev.length - 1].time + 1,
          temp: sensorData.temp,
          humidity: sensorData.humidity
        });
        return newHistory;
      });

    }, 1000);

    return () => clearInterval(timer);
  }, [sensorData.temp, sensorData.humidity]);

  // --- Helper to style the status pill ---
  const getStatusColor = (status) => {
    switch(status) {
      case 'SAFE': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
      case 'HIGH RISK': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
      case 'MOLD CONDITIONS': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="min-h-screen bg-muted/30 text-foreground font-sans flex flex-col">
      
      {/* Top Navigation Bar */}
      <header className="flex items-center justify-between px-6 py-4 bg-card border-b border-border shadow-sm">
        <div className="flex items-center gap-4">
          <Menu className="w-5 h-5 text-muted-foreground cursor-pointer" />
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-blue-600 text-white flex items-center justify-center font-bold">M</div>
            <h1 className="text-lg font-medium">MoldGuard Handheld Checker</h1>
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="Search..." 
              className="pl-9 pr-4 py-2 bg-input-background rounded-full text-sm outline-none focus:ring-2 focus:ring-ring border border-transparent w-64"
            />
          </div>
          <Bell className="w-5 h-5 text-muted-foreground cursor-pointer" />
          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center cursor-pointer">
            <User className="w-4 h-4 text-muted-foreground" />
          </div>
        </div>
      </header>

      {/* Main Dashboard Grid */}
      <main className="flex-1 p-6 grid grid-cols-1 md:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: Status & Time */}
        <div className="col-span-12 md:col-span-3 flex flex-col gap-6">
          
          {/* Current System Status Card (Old Logic Applied) */}
          <div className="bg-card rounded-xl border border-border shadow-sm p-6 flex flex-col relative">
            <MoreVertical className="absolute right-4 top-4 w-4 h-4 text-muted-foreground cursor-pointer" />
            <div className="flex items-center gap-2 mb-6 text-sm text-muted-foreground font-medium uppercase tracking-wider">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
              Current System Status
            </div>
            
            <div className="space-y-6">
              <div>
                <div className="text-sm text-muted-foreground mb-1">TEMPERATURE:</div>
                <div className="text-4xl font-bold">{sensorData.temp.toFixed(1)}°C</div>
              </div>
              
              <div>
                <div className="text-sm text-muted-foreground mb-1">HUMIDITY:</div>
                <div className="text-4xl font-bold">{sensorData.humidity.toFixed(1)}%</div>
              </div>

              <div className="pt-4 border-t border-border space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">MOLD RISK INDEX:</span>
                  <span className="font-semibold">{sensorData.risk.toFixed(1)} / 100</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">CONDITION:</span>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${getStatusColor(sensorData.status)}`}>
                    {sensorData.status}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Current Time & Date Card */}
          <div className="bg-card rounded-xl border border-border shadow-sm p-6 relative">
            <MoreVertical className="absolute right-4 top-4 w-4 h-4 text-muted-foreground cursor-pointer" />
            <div className="text-sm text-muted-foreground font-medium uppercase tracking-wider mb-4">
              Current Time & Date
            </div>
            <div className="text-3xl font-bold tracking-tight mb-1">
              {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
            <div className="text-muted-foreground">
              {time.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </div>
          </div>
        </div>

        {/* MIDDLE COLUMN: Charts */}
        <div className="col-span-12 md:col-span-6 flex flex-col gap-6">
          
          {/* Temperature Trend */}
          <div className="bg-card rounded-xl border border-border shadow-sm p-6 relative h-[300px] flex flex-col">
            <MoreVertical className="absolute right-4 top-4 w-4 h-4 text-muted-foreground cursor-pointer" />
            <div className="text-sm text-muted-foreground font-medium uppercase tracking-wider mb-6">
              Temperature Trend (Last 1 Hour)
            </div>
            <div className="flex-1 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={history} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorTemp" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={true} horizontal={true} stroke="var(--border)" opacity={0.4} />
                  <XAxis dataKey="time" hide />
                  <YAxis domain={['auto', 'auto']} tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Area type="monotone" dataKey="temp" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorTemp)" isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Humidity Trend */}
          <div className="bg-card rounded-xl border border-border shadow-sm p-6 relative h-[300px] flex flex-col">
            <MoreVertical className="absolute right-4 top-4 w-4 h-4 text-muted-foreground cursor-pointer" />
            <div className="text-sm text-muted-foreground font-medium uppercase tracking-wider mb-6">
              Humidity Trend (Last 1 Hour)
            </div>
            <div className="flex-1 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={history} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorHum" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={true} horizontal={true} stroke="var(--border)" opacity={0.4} />
                  <XAxis dataKey="time" hide />
                  <YAxis domain={['auto', 'auto']} tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Area type="monotone" dataKey="humidity" stroke="#22c55e" strokeWidth={3} fillOpacity={1} fill="url(#colorHum)" isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Risk Analysis & Logs */}
        <div className="col-span-12 md:col-span-3 flex flex-col gap-6">
          
          {/* Mold Risk Analysis List */}
          <div className="bg-card rounded-xl border border-border shadow-sm p-6">
            <div className="flex justify-between items-center mb-6">
              <div className="text-sm text-muted-foreground font-medium uppercase tracking-wider">
                Mold Risk Analysis
              </div>
              <MoreVertical className="w-4 h-4 text-muted-foreground cursor-pointer" />
            </div>

            <div className="space-y-6">
              {/* Item 1 */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium">Behind Drywall (75%) ⭐</span>
                  <span className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 px-2 py-0.5 rounded text-xs font-bold">HIGH RISK</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div className="bg-orange-500 h-2 rounded-full" style={{ width: '75%' }}></div>
                </div>
              </div>

              {/* Item 2 */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium">Basement Corner (93%)</span>
                  <span className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-2 py-0.5 rounded text-xs font-bold">SAFE</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div className="bg-green-500 h-2 rounded-full" style={{ width: '93%' }}></div>
                </div>
              </div>

              {/* Item 3 */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium">Under Sink (46%)</span>
                  <span className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 px-2 py-0.5 rounded text-xs font-bold">HIGH RISK</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div className="bg-orange-500 h-2 rounded-full" style={{ width: '46%' }}></div>
                </div>
              </div>
            </div>
          </div>

          {/* System Logs & Alerts */}
          <div className="bg-card rounded-xl border border-border shadow-sm p-6 relative">
            <MoreVertical className="absolute right-4 top-4 w-4 h-4 text-muted-foreground cursor-pointer" />
            <div className="text-sm text-muted-foreground font-medium uppercase tracking-wider mb-6">
              System Logs & Alerts
            </div>
            
            <div className="space-y-4">
              <div className="flex gap-3 items-start">
                <div className="w-2 h-2 rounded-full bg-orange-500 mt-1.5 shrink-0"></div>
                <div>
                  <div className="text-sm font-medium">Humidity spike detected</div>
                  <div className="text-xs text-muted-foreground">10:28 AM</div>
                </div>
              </div>
              
              <div className="flex gap-3 items-start">
                <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0"></div>
                <div>
                  <div className="text-sm font-medium">Reading stable</div>
                  <div className="text-xs text-muted-foreground">10:23 AM</div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}