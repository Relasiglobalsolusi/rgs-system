"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const data = [
  { month: "Jan", revenue: 420 },
  { month: "Feb", revenue: 510 },
  { month: "Mar", revenue: 480 },
  { month: "Apr", revenue: 760 },
  { month: "May", revenue: 890 },
  { month: "Jun", revenue: 1030 },
  { month: "Jul", revenue: 1240 },
  { month: "Aug", revenue: 1380 },
  { month: "Sep", revenue: 1510 },
  { month: "Oct", revenue: 1670 },
  { month: "Nov", revenue: 1810 },
  { month: "Dec", revenue: 2040 },
];

export default function RevenueChart() {
  return (
    <div className="h-[340px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{
            top: 10,
            right: 10,
            left: -20,
            bottom: 0,
          }}
        >
          <defs>
            <linearGradient
              id="colorRevenue"
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop
                offset="0%"
                stopColor="#54BFB4"
                stopOpacity={0.55}
              />
              <stop
                offset="100%"
                stopColor="#54BFB4"
                stopOpacity={0}
              />
            </linearGradient>
          </defs>

          <CartesianGrid
            stroke="#252C34"
            strokeDasharray="4 4"
            vertical={false}
          />

          <XAxis
            dataKey="month"
            tick={{
              fill: "#6B7280",
              fontSize: 12,
            }}
            tickLine={false}
            axisLine={false}
          />

          <YAxis
            tick={{
              fill: "#6B7280",
              fontSize: 12,
            }}
            tickLine={false}
            axisLine={false}
          />

          <Tooltip
            cursor={{
              stroke: "#54BFB4",
              strokeDasharray: "4 4",
            }}
            contentStyle={{
              background: "#181E25",
              border: "1px solid rgba(255,255,255,.08)",
              borderRadius: 18,
              color: "#fff",
            }}
          />

          <Area
            type="monotone"
            dataKey="revenue"
            stroke="#54BFB4"
            strokeWidth={4}
            fill="url(#colorRevenue)"
            activeDot={{
              r: 6,
              fill: "#54BFB4",
              stroke: "#0B0F14",
              strokeWidth: 3,
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}