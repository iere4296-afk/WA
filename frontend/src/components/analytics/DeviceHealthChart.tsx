import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

interface DeviceHealthChartProps {
  data: Array<{ name: string; health_score: number }>
}

export function DeviceHealthChart({ data }: DeviceHealthChartProps) {
  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Bar dataKey="health_score" fill="#16a34a" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
