import BottomNav from '@/components/BottomNav'
import TopRouteProgress from '@/components/TopRouteProgress'

export default function Loading() {
  return (
    <div className="min-h-screen bg-[#0f0e17] text-white">
      <TopRouteProgress />
      <BottomNav activeTab="home" />
    </div>
  )
}
