'use client';

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export function LeadsChart({ data }: { data: { day: string; leads: number }[] }) {
  return (
    <div className="h-64 w-full" role="img" aria-label="Leads per day over the last 30 days">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="lcfill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#B8924A" stopOpacity={0.22} />
              <stop offset="100%" stopColor="#B8924A" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#E8E3DA" vertical={false} />
          <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#6B675F' }} interval="preserveStartEnd" minTickGap={28} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#6B675F' }} />
          <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E8E3DA', boxShadow: '0 8px 30px rgba(28,27,25,0.08)', fontSize: 13 }} />
          <Area type="monotone" dataKey="leads" stroke="#B8924A" strokeWidth={2} fill="url(#lcfill)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
