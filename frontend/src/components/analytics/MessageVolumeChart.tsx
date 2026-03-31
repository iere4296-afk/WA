import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AnalyticsSummary } from '@/types'

interface MessageVolumeChartProps {
  data: AnalyticsSummary['volumeByDay']
}

export function MessageVolumeChart({ data }: MessageVolumeChartProps) {
  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis />
          <Tooltip />
          <Area type="monotone" dataKey="sent" stroke="#0f766e" fill="#99f6e4" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
