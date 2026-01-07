import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ExemptionTab } from '@/components/ExemptionTab'
import { EducationCenterTab } from '@/components/EducationCenterTab'
import { EducationMemberTab } from '@/components/EducationMemberTab'
import { LicenseTab } from '@/components/LicenseTab'
import { MergeTab } from '@/components/MergeTab'
import { FilterTab } from '@/components/FilterTab'
import { DashboardTab } from '@/components/DashboardTab'

function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">
            면허 관리 시스템
          </h1>
        </header>

        <Tabs defaultValue="exemption" className="w-full">
          <TabsList className="grid w-full grid-cols-7">
            <TabsTrigger value="exemption">면제/유예/비대상자</TabsTrigger>
            <TabsTrigger value="education-center">보수교육(면허신고센터)</TabsTrigger>
            <TabsTrigger value="education-member">보수교육(회원관리)</TabsTrigger>
            <TabsTrigger value="license">면허신고</TabsTrigger>
            <TabsTrigger value="merge">통합하기</TabsTrigger>
            <TabsTrigger value="filter">필터링</TabsTrigger>
            <TabsTrigger value="dashboard">대시보드</TabsTrigger>
          </TabsList>

          <TabsContent value="exemption" className="mt-6">
            <ExemptionTab />
          </TabsContent>

          <TabsContent value="education-center" className="mt-6">
            <EducationCenterTab />
          </TabsContent>

          <TabsContent value="education-member" className="mt-6">
            <EducationMemberTab />
          </TabsContent>

          <TabsContent value="license" className="mt-6">
            <LicenseTab />
          </TabsContent>

          <TabsContent value="merge" className="mt-6">
            <MergeTab />
          </TabsContent>

          <TabsContent value="filter" className="mt-6">
            <FilterTab />
          </TabsContent>

          <TabsContent value="dashboard" className="mt-6">
            <DashboardTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

export default App
