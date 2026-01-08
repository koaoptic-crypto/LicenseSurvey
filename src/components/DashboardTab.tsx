import { useState, useMemo, useRef } from 'react'
import * as XLSX from 'xlsx-js-style'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import html2canvas from 'html2canvas'

type FilterValues = {
  [key: string]: string[]
}

export function DashboardTab() {
  const [file, setFile] = useState<File | null>(null)
  const [data, setData] = useState<any[]>([])
  const [filters, setFilters] = useState<FilterValues>({
    '지부': [],
    '분회': [],
    '회원구분': [],
    '개설현황': []
  })
  const [availableOptions, setAvailableOptions] = useState<{ [key: string]: string[] }>({
    '지부': [],
    '분회': [],
    '회원구분': [],
    '개설현황': []
  })
  // 지부-분회 매핑 (지부 -> 분회 목록)
  const [branchMapping, setBranchMapping] = useState<Map<string, string[]>>(new Map())
  // 대시보드 캡처를 위한 ref
  const dashboardRef = useRef<HTMLDivElement>(null)
  const yearlyDashboardRef = useRef<HTMLDivElement>(null)
  const [isDownloading, setIsDownloading] = useState(false)
  const [isDownloadingYearly, setIsDownloadingYearly] = useState(false)

  // 연도별 현황용 선택 state
  const [selectedYear, setSelectedYear] = useState<string>('')
  const [selectedJibuForYearly, setSelectedJibuForYearly] = useState<string>('all')

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = event.target.files?.[0]
    if (uploadedFile) {
      setFile(uploadedFile)
      processFile(uploadedFile)
    }
  }

  const processFile = async (uploadedFile: File) => {
    try {
      const arrayBuffer = await uploadedFile.arrayBuffer()
      const workbook = XLSX.read(arrayBuffer)
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      const jsonData = XLSX.utils.sheet_to_json(worksheet) as Record<string, any>[]

      setData(jsonData)

      // 필터 옵션 추출
      const filterKeys = ['지부', '분회', '회원구분', '개설현황']
      const options: { [key: string]: string[] } = {}

      filterKeys.forEach(key => {
        const uniqueValues = Array.from(new Set(
          jsonData
            .map(row => row[key]?.toString().trim())
            .filter(val => val && val !== '')
        )).sort()
        options[key] = uniqueValues as string[]
      })

      // 지부-분회 매핑 생성
      const mapping = new Map<string, string[]>()
      jsonData.forEach(row => {
        const jibu = row['지부']?.toString().trim()
        const bunhoe = row['분회']?.toString().trim()

        if (jibu && jibu !== '' && bunhoe && bunhoe !== '') {
          if (!mapping.has(jibu)) {
            mapping.set(jibu, [])
          }
          const bunhoes = mapping.get(jibu)!
          if (!bunhoes.includes(bunhoe)) {
            bunhoes.push(bunhoe)
          }
        }
      })

      // 각 지부의 분회 목록 정렬
      mapping.forEach((bunhoes, jibu) => {
        mapping.set(jibu, bunhoes.sort())
      })

      setBranchMapping(mapping)
      setAvailableOptions(options)

      // 기본적으로 전체 선택
      const defaultFilters: FilterValues = {}
      filterKeys.forEach(key => {
        defaultFilters[key] = options[key] || []
      })
      setFilters(defaultFilters)
    } catch (error) {
      console.error('파일 처리 중 오류 발생:', error)
      alert('파일 처리 중 오류가 발생했습니다.')
    }
  }

  const handleFilterChange = (filterKey: string, value: string, checked: boolean) => {
    setFilters(prev => {
      const current = prev[filterKey] || []
      let newFilters: FilterValues

      if (checked) {
        newFilters = { ...prev, [filterKey]: [...current, value] }
      } else {
        newFilters = { ...prev, [filterKey]: current.filter(v => v !== value) }
      }

      // 지부가 변경되면 분회 선택도 업데이트
      if (filterKey === '지부') {
        const selectedJibus = newFilters['지부']
        const availableBunhoes = new Set<string>()

        selectedJibus.forEach(jibu => {
          const bunhoes = branchMapping.get(jibu) || []
          bunhoes.forEach(b => availableBunhoes.add(b))
        })

        // 현재 선택된 분회 중 유효한 것만 유지
        newFilters['분회'] = prev['분회'].filter(b => availableBunhoes.has(b))
      }

      return newFilters
    })
  }

  const handleSelectAll = (filterKey: string) => {
    if (filterKey === '분회') {
      // 분회는 현재 선택된 지부에 속한 것만 전체 선택
      const availableBunhoes = getAvailableBunhoes()
      setFilters(prev => ({
        ...prev,
        [filterKey]: availableBunhoes
      }))
    } else {
      setFilters(prev => ({
        ...prev,
        [filterKey]: availableOptions[filterKey] || []
      }))
    }
  }

  const handleDeselectAll = (filterKey: string) => {
    setFilters(prev => ({
      ...prev,
      [filterKey]: []
    }))
  }

  // 선택된 지부에 속한 분회 목록 계산
  const getAvailableBunhoes = (): string[] => {
    const selectedJibus = filters['지부']
    if (selectedJibus.length === 0) {
      // 지부가 선택되지 않았으면 모든 분회 반환
      return availableOptions['분회'] || []
    }

    const availableBunhoes = new Set<string>()
    selectedJibus.forEach(jibu => {
      const bunhoes = branchMapping.get(jibu) || []
      bunhoes.forEach(b => availableBunhoes.add(b))
    })

    return Array.from(availableBunhoes).sort()
  }

  // 선택된 지부에 따라 사용 가능한 분회 목록
  const availableBunhoes = useMemo(() => getAvailableBunhoes(), [filters['지부'], branchMapping, availableOptions])

  // 연도별 현황 이미지 다운로드 함수
  const downloadYearlyDashboardAsImage = async () => {
    if (!yearlyDashboardRef.current) return

    setIsDownloadingYearly(true)

    try {
      await new Promise(resolve => setTimeout(resolve, 100))

      const canvas = await html2canvas(yearlyDashboardRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        windowWidth: yearlyDashboardRef.current.scrollWidth,
        windowHeight: yearlyDashboardRef.current.scrollHeight
      })

      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob)
          const link = document.createElement('a')
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
          const jibuText = selectedJibuForYearly && selectedJibuForYearly !== 'all' ? `_${selectedJibuForYearly}지부` : ''
          link.download = `연도별현황_${selectedYear}년${jibuText}_${timestamp}.png`
          link.href = url
          link.click()
          URL.revokeObjectURL(url)
        }
      })
    } catch (error) {
      console.error('이미지 다운로드 중 오류 발생:', error)
      alert('이미지 다운로드 중 오류가 발생했습니다.')
    } finally {
      setIsDownloadingYearly(false)
    }
  }

  // 대시보드 이미지 다운로드 함수
  const downloadDashboardAsImage = async () => {
    if (!dashboardRef.current) return

    setIsDownloading(true)

    try {
      // 약간의 지연을 주어 UI가 업데이트되도록 함
      await new Promise(resolve => setTimeout(resolve, 100))

      const canvas = await html2canvas(dashboardRef.current, {
        scale: 2, // 고화질을 위해 스케일 증가
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        windowWidth: dashboardRef.current.scrollWidth,
        windowHeight: dashboardRef.current.scrollHeight
      })

      // Canvas를 이미지로 변환
      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob)
          const link = document.createElement('a')
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
          link.download = `대시보드_${timestamp}.png`
          link.href = url
          link.click()
          URL.revokeObjectURL(url)
        }
      })
    } catch (error) {
      console.error('이미지 다운로드 중 오류 발생:', error)
      alert('이미지 다운로드 중 오류가 발생했습니다.')
    } finally {
      setIsDownloading(false)
    }
  }

  // 필터링된 데이터
  const filteredData = useMemo(() => {
    if (data.length === 0) return []

    return data.filter(row => {
      return Object.keys(filters).every(filterKey => {
        const selectedValues = filters[filterKey]
        if (selectedValues.length === 0) return true
        const rowValue = row[filterKey]?.toString().trim()
        // 빈 값이면 항상 통과 (필터링하지 않음)
        if (!rowValue || rowValue === '') return true
        return selectedValues.includes(rowValue)
      })
    })
  }, [data, filters])

  // 대시보드 통계 계산
  const dashboardStats = useMemo(() => {
    if (filteredData.length === 0) return null

    const totalMembers = filteredData.length

    // 연도 컬럼 찾기 (4자리 숫자)
    const columns = Object.keys(filteredData[0])
    const yearColumns = columns.filter(col => /^\d{4}$/.test(col.trim())).sort()

    // 최신 연도 기준 이수 현황
    const latestYear = yearColumns[yearColumns.length - 1]
    let completedCount = 0
    let notCompletedCount = 0
    let exemptCount = 0

    if (latestYear) {
      filteredData.forEach(row => {
        const status = row[latestYear]?.toString().trim()
        if (status === '이수자') completedCount++
        else if (status === '미이수') notCompletedCount++
        else if (status === '면제' || status === '유예' || status === '비대상자') exemptCount++
      })
    }

    // 면허신고 현황
    let reportedCount = 0
    let notReportedCount = 0
    let notApplicableCount = 0

    filteredData.forEach(row => {
      const reportStatus = row['면허신고연도']?.toString().trim()
      if (!reportStatus || reportStatus === '미신고') notReportedCount++
      else if (reportStatus === '미대상') notApplicableCount++
      else reportedCount++
    })

    // 연도별 이수율 계산
    const yearlyStats = yearColumns.map(year => {
      let completed = 0
      let total = 0

      filteredData.forEach(row => {
        const status = row[year]?.toString().trim()
        if (status && status !== '') {
          total++
          if (status === '이수자') completed++
        }
      })

      return {
        year,
        completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
        completed,
        total
      }
    })

    // 미이수 연도 수별 통계 (각 사람마다 미이수 연도가 몇 년인지)
    const notCompletedYearsMap = new Map<number, number>()

    filteredData.forEach(row => {
      let notCompletedYearsCount = 0

      yearColumns.forEach(year => {
        const status = row[year]?.toString().trim()
        if (status === '미이수') {
          notCompletedYearsCount++
        }
      })

      // 0년(완전 이수)부터 모두 집계
      notCompletedYearsMap.set(
        notCompletedYearsCount,
        (notCompletedYearsMap.get(notCompletedYearsCount) || 0) + 1
      )
    })

    // Map을 배열로 변환하고 정렬
    const notCompletedYearsStats = Array.from(notCompletedYearsMap.entries())
      .map(([yearsNotCompleted, count]) => ({
        yearsNotCompleted,
        count
      }))
      .sort((a, b) => a.yearsNotCompleted - b.yearsNotCompleted)

    return {
      totalMembers,
      latestYear,
      completedCount,
      notCompletedCount,
      exemptCount,
      reportedCount,
      notReportedCount,
      notApplicableCount,
      yearlyStats,
      notCompletedYearsStats
    }
  }, [filteredData])

  // 동적 제목 생성
  const dashboardTitle = useMemo(() => {
    const selectedJibus = filters['지부']
    const selectedBunhoes = filters['분회']

    // 분회가 1개만 선택되었을 때
    if (selectedBunhoes.length === 1 && selectedJibus.length === 1) {
      return `${selectedJibus[0]}지부 ${selectedBunhoes[0]}분회 면허 관리 대시보드`
    }

    // 지부가 1개만 선택되었을 때
    if (selectedJibus.length === 1) {
      return `${selectedJibus[0]}지부 면허 관리 대시보드`
    }

    // 지부가 여러 개 또는 선택되지 않았을 때
    return '면허 관리 대시보드'
  }, [filters])

  // 연도별 현황 통계 계산
  const yearlyStatusStats = useMemo(() => {
    if (!selectedYear || data.length === 0) return null

    const stats: { [key: string]: { 개설: number; 종사: number; 미취업: number; 합계: number } } = {}

    // 지부를 선택하지 않은 경우: 지부별 집계
    if (!selectedJibuForYearly || selectedJibuForYearly === 'all') {
      data.forEach(row => {
        const jibu = row['지부']?.toString().trim()
        const yearStatus = row[selectedYear]?.toString().trim()
        const gaeseolStatus = row['개설현황']?.toString().trim()

        // 해당 연도에 데이터가 있는 경우만 집계 (공백이 아닌 경우)
        if (jibu && yearStatus && yearStatus !== '' && gaeseolStatus) {
          if (!stats[jibu]) {
            stats[jibu] = { 개설: 0, 종사: 0, 미취업: 0, 합계: 0 }
          }

          if (gaeseolStatus === '개설') stats[jibu].개설++
          else if (gaeseolStatus === '종사') stats[jibu].종사++
          else if (gaeseolStatus === '미취업') stats[jibu].미취업++

          stats[jibu].합계++
        }
      })
    } else {
      // 특정 지부 선택: 분회별 집계
      data.forEach(row => {
        const jibu = row['지부']?.toString().trim()
        const bunhoe = row['분회']?.toString().trim()
        const yearStatus = row[selectedYear]?.toString().trim()
        const gaeseolStatus = row['개설현황']?.toString().trim()

        // 선택한 지부와 일치하고, 해당 연도에 데이터가 있는 경우만 집계
        if (jibu === selectedJibuForYearly && bunhoe && yearStatus && yearStatus !== '' && gaeseolStatus) {
          if (!stats[bunhoe]) {
            stats[bunhoe] = { 개설: 0, 종사: 0, 미취업: 0, 합계: 0 }
          }

          if (gaeseolStatus === '개설') stats[bunhoe].개설++
          else if (gaeseolStatus === '종사') stats[bunhoe].종사++
          else if (gaeseolStatus === '미취업') stats[bunhoe].미취업++

          stats[bunhoe].합계++
        }
      })
    }

    // 객체를 배열로 변환하고 정렬
    return Object.entries(stats)
      .map(([name, counts]) => ({ name, ...counts }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [data, selectedYear, selectedJibuForYearly])

  // 연도 목록 추출
  const availableYears = useMemo(() => {
    if (data.length === 0) return []
    const columns = Object.keys(data[0])
    return columns.filter(col => /^\d{4}$/.test(col.trim())).sort()
  }, [data])

  const COLORS = ['#4472C4', '#ED7D31', '#A5A5A5', '#FFC000', '#5B9BD5']

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-6">
          <h2 className="text-xl font-semibold mb-6">대시보드</h2>

          <div className="space-y-6">
            <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-md p-4">
              <div className="flex items-start gap-2">
                <span className="text-blue-600 dark:text-blue-400 font-bold">ℹ️</span>
                <div className="text-sm text-blue-800 dark:text-blue-200">
                  <p className="font-semibold mb-1">대시보드 안내</p>
                  <p>필터링 탭에서 생성한 엑셀 파일을 업로드하여 대시보드를 확인하세요.</p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold">데이터 파일 업로드</h3>

              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileUpload}
                className="block w-full text-sm text-slate-500
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-md file:border-0
                  file:text-sm file:font-semibold
                  file:bg-primary file:text-primary-foreground
                  hover:file:bg-primary/90
                  cursor-pointer"
              />
              {file && (
                <p className="text-sm text-green-600 dark:text-green-400">
                  ✓ {file.name} ({filteredData.length}건)
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {data.length > 0 && (
        <>
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold mb-4">필터</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {Object.keys(availableOptions).map(filterKey => (
                  <div key={filterKey} className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold">
                        {filterKey}
                        {filterKey === '분회' && filters['지부'].length === 0 && (
                          <span className="text-xs text-muted-foreground ml-2">(지부 선택 필요)</span>
                        )}
                      </h4>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSelectAll(filterKey)}
                          className="h-7 text-xs"
                        >
                          전체선택
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeselectAll(filterKey)}
                          className="h-7 text-xs"
                        >
                          선택해제
                        </Button>
                      </div>
                    </div>

                    <div className="max-h-48 overflow-y-auto border rounded-md p-3 space-y-2">
                      {filterKey === '분회' && filters['지부'].length === 0 ? (
                        <div className="text-sm text-muted-foreground p-2 text-center">
                          지부를 먼저 선택해주세요
                        </div>
                      ) : (
                        (filterKey === '분회' ? availableBunhoes : (availableOptions[filterKey] || [])).map(option => (
                          <div key={option} className="flex items-center space-x-2">
                            <Checkbox
                              id={`${filterKey}-${option}`}
                              checked={filters[filterKey]?.includes(option)}
                              onCheckedChange={(checked) =>
                                handleFilterChange(filterKey, option, checked === true)
                              }
                            />
                            <label
                              htmlFor={`${filterKey}-${option}`}
                              className="text-sm cursor-pointer"
                            >
                              {option}
                            </label>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {dashboardStats && (
            <Tabs defaultValue="overall" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="overall">전체현황</TabsTrigger>
                <TabsTrigger value="yearly">연도별 현황</TabsTrigger>
              </TabsList>

              <TabsContent value="overall" className="mt-6">
                <div className="flex justify-end mb-4">
                  <Button
                    onClick={downloadDashboardAsImage}
                    disabled={isDownloading}
                    size="lg"
                    variant="default"
                  >
                    {isDownloading ? '이미지 생성 중...' : '대시보드 이미지 다운로드'}
                  </Button>
                </div>

                <div ref={dashboardRef} className="space-y-6 bg-white p-6 rounded-lg">
                <div className="text-center mb-6 pb-4 border-b-2 border-gray-300">
                  <h2 className="text-2xl font-bold">{dashboardTitle}</h2>
                  <p className="text-sm text-muted-foreground mt-2">
                    생성일시: {new Date().toLocaleString('ko-KR')}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="border-2 border-gray-300">
                  <CardContent className="p-6">
                    <div className="text-sm text-muted-foreground">총 회원 수</div>
                    <div className="text-3xl font-bold mt-2">{dashboardStats.totalMembers.toLocaleString()}</div>
                  </CardContent>
                </Card>

                <Card className="border-2 border-gray-300">
                  <CardContent className="p-6">
                    <div className="text-sm text-muted-foreground">이수자 ({dashboardStats.latestYear})</div>
                    <div className="text-3xl font-bold mt-2 text-green-600">
                      {dashboardStats.completedCount.toLocaleString()}
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-2 border-gray-300">
                  <CardContent className="p-6">
                    <div className="text-sm text-muted-foreground">미이수자 ({dashboardStats.latestYear})</div>
                    <div className="text-3xl font-bold mt-2 text-red-600">
                      {dashboardStats.notCompletedCount.toLocaleString()}
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-2 border-gray-300">
                  <CardContent className="p-6">
                    <div className="text-sm text-muted-foreground">면허 미신고</div>
                    <div className="text-3xl font-bold mt-2 text-orange-600">
                      {dashboardStats.notReportedCount.toLocaleString()}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="border-2 border-gray-300">
                  <CardContent className="p-6">
                    <h3 className="text-lg font-semibold mb-4">연도별 이수율</h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={dashboardStats.yearlyStats}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="year" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="completionRate" fill="#4472C4" name="이수율 (%)" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card className="border-2 border-gray-300">
                  <CardContent className="p-6">
                    <h3 className="text-lg font-semibold mb-4">교육이수 현황 ({dashboardStats.latestYear})</h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={[
                            { name: '이수자', value: dashboardStats.completedCount },
                            { name: '미이수자', value: dashboardStats.notCompletedCount },
                            { name: '면제/유예/비대상', value: dashboardStats.exemptCount }
                          ]}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {[0, 1, 2].map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card className="border-2 border-gray-300">
                  <CardContent className="p-6">
                    <h3 className="text-lg font-semibold mb-4">면허신고 현황</h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={[
                            { name: '신고', value: dashboardStats.reportedCount },
                            { name: '미신고', value: dashboardStats.notReportedCount },
                            { name: '미대상', value: dashboardStats.notApplicableCount }
                          ]}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {[0, 1, 2].map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card className="border-2 border-gray-300">
                  <CardContent className="p-6">
                    <h3 className="text-lg font-semibold mb-4">연도별 이수 현황</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm border-2 border-gray-300">
                        <thead>
                          <tr className="border-b-2 border-gray-300">
                            <th className="text-left p-2 border-r border-gray-300">연도</th>
                            <th className="text-right p-2 border-r border-gray-300">이수자</th>
                            <th className="text-right p-2 border-r border-gray-300">전체</th>
                            <th className="text-right p-2">이수율</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dashboardStats.yearlyStats.map(stat => (
                            <tr key={stat.year} className="border-b border-gray-300">
                              <td className="p-2 border-r border-gray-300">{stat.year}</td>
                              <td className="text-right p-2 border-r border-gray-300">{stat.completed.toLocaleString()}</td>
                              <td className="text-right p-2 border-r border-gray-300">{stat.total.toLocaleString()}</td>
                              <td className="text-right p-2">{stat.completionRate}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {dashboardStats.notCompletedYearsStats.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                  <Card className="border-2 border-gray-300">
                    <CardContent className="p-6">
                      <h3 className="text-lg font-semibold mb-4">미이수 연도 수별 인원</h3>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={dashboardStats.notCompletedYearsStats}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="yearsNotCompleted" label={{ value: '미이수 연도 수', position: 'insideBottom', offset: -5 }} />
                          <YAxis label={{ value: '인원 수', angle: -90, position: 'insideLeft' }} />
                          <Tooltip
                            formatter={(value) => [`${(value || 0).toLocaleString()}명`, '인원']}
                            labelFormatter={(label) => `${label}년 미이수`}
                          />
                          <Bar dataKey="count" fill="#ED7D31" name="인원 수" />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <Card className="border-2 border-gray-300">
                    <CardContent className="p-6">
                      <h3 className="text-lg font-semibold mb-4">미이수 연도 수별 상세 현황</h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm border-2 border-gray-300">
                          <thead>
                            <tr className="border-b-2 border-gray-300">
                              <th className="text-left p-2 border-r border-gray-300">미이수 연도 수</th>
                              <th className="text-right p-2 border-r border-gray-300">인원</th>
                              <th className="text-right p-2">비율</th>
                            </tr>
                          </thead>
                          <tbody>
                            {dashboardStats.notCompletedYearsStats.map(stat => {
                              const totalWithNotCompleted = dashboardStats.notCompletedYearsStats.reduce((sum, s) => sum + s.count, 0)
                              const percentage = ((stat.count / totalWithNotCompleted) * 100).toFixed(1)
                              return (
                                <tr key={stat.yearsNotCompleted} className="border-b border-gray-300">
                                  <td className="p-2 border-r border-gray-300">{stat.yearsNotCompleted}년</td>
                                  <td className="text-right p-2 border-r border-gray-300">{stat.count.toLocaleString()}명</td>
                                  <td className="text-right p-2">{percentage}%</td>
                                </tr>
                              )
                            })}
                            <tr className="border-t-2 border-gray-300 font-semibold">
                              <td className="p-2 border-r border-gray-300">합계</td>
                              <td className="text-right p-2 border-r border-gray-300">
                                {dashboardStats.notCompletedYearsStats.reduce((sum, s) => sum + s.count, 0).toLocaleString()}명
                              </td>
                              <td className="text-right p-2">100.0%</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                      <div className="mt-4 text-xs text-muted-foreground">
                        * 0년: 모든 연도의 교육을 이수한 회원 / 1년 이상: 해당 연도만큼 미이수한 회원
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
              </div>
              </TabsContent>

              <TabsContent value="yearly" className="mt-6">
                {selectedYear && yearlyStatusStats && yearlyStatusStats.length > 0 && (
                  <div className="flex justify-end mb-4">
                    <Button
                      onClick={downloadYearlyDashboardAsImage}
                      disabled={isDownloadingYearly}
                      size="lg"
                      variant="default"
                    >
                      {isDownloadingYearly ? '이미지 생성 중...' : '연도별 현황 이미지 다운로드'}
                    </Button>
                  </div>
                )}

                <Card>
                  <CardContent className="p-6">
                    <h3 className="text-lg font-semibold mb-4">연도별 현황</h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">년도 선택</label>
                        <Select value={selectedYear} onValueChange={setSelectedYear}>
                          <SelectTrigger>
                            <SelectValue placeholder="년도를 선택하세요" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableYears.map(year => (
                              <SelectItem key={year} value={year}>
                                {year}년
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium">지부 선택 (선택사항)</label>
                        <Select value={selectedJibuForYearly} onValueChange={setSelectedJibuForYearly}>
                          <SelectTrigger>
                            <SelectValue placeholder="전체 지부" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">전체 지부</SelectItem>
                            {availableOptions['지부']?.map(jibu => (
                              <SelectItem key={jibu} value={jibu}>
                                {jibu}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {!selectedYear ? (
                      <div className="text-center text-muted-foreground py-8">
                        년도를 선택하세요
                      </div>
                    ) : yearlyStatusStats && yearlyStatusStats.length > 0 ? (
                      <div ref={yearlyDashboardRef} className="bg-white p-6 rounded-lg">
                        <div className="text-center mb-6 pb-4 border-b-2 border-gray-300">
                          <h2 className="text-2xl font-bold">
                            {selectedYear}년 보수교육 이수 현황
                            {selectedJibuForYearly && selectedJibuForYearly !== 'all' && ` - ${selectedJibuForYearly}지부`}
                          </h2>
                          <p className="text-sm text-muted-foreground mt-2">
                            생성일시: {new Date().toLocaleString('ko-KR')}
                          </p>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full text-sm border-2 border-gray-300">
                          <thead>
                            <tr className="border-b-2 border-gray-300 bg-gray-50">
                              <th className="text-left p-3 border-r border-gray-300 font-semibold">
                                {selectedJibuForYearly && selectedJibuForYearly !== 'all' ? '분회' : '지부'}
                              </th>
                              <th className="text-right p-3 border-r border-gray-300 font-semibold">개설</th>
                              <th className="text-right p-3 border-r border-gray-300 font-semibold">종사</th>
                              <th className="text-right p-3 border-r border-gray-300 font-semibold">미취업</th>
                              <th className="text-right p-3 font-semibold">합계</th>
                            </tr>
                          </thead>
                          <tbody>
                            {yearlyStatusStats.map((stat, index) => (
                              <tr key={stat.name} className={`border-b border-gray-300 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                                <td className="p-3 border-r border-gray-300">{stat.name}</td>
                                <td className="text-right p-3 border-r border-gray-300">{stat.개설.toLocaleString()}명</td>
                                <td className="text-right p-3 border-r border-gray-300">{stat.종사.toLocaleString()}명</td>
                                <td className="text-right p-3 border-r border-gray-300">{stat.미취업.toLocaleString()}명</td>
                                <td className="text-right p-3 font-semibold">{stat.합계.toLocaleString()}명</td>
                              </tr>
                            ))}
                            <tr className="border-t-2 border-gray-300 bg-blue-50 font-semibold">
                              <td className="p-3 border-r border-gray-300">합계</td>
                              <td className="text-right p-3 border-r border-gray-300">
                                {yearlyStatusStats.reduce((sum, s) => sum + s.개설, 0).toLocaleString()}명
                              </td>
                              <td className="text-right p-3 border-r border-gray-300">
                                {yearlyStatusStats.reduce((sum, s) => sum + s.종사, 0).toLocaleString()}명
                              </td>
                              <td className="text-right p-3 border-r border-gray-300">
                                {yearlyStatusStats.reduce((sum, s) => sum + s.미취업, 0).toLocaleString()}명
                              </td>
                              <td className="text-right p-3">
                                {yearlyStatusStats.reduce((sum, s) => sum + s.합계, 0).toLocaleString()}명
                              </td>
                            </tr>
                          </tbody>
                        </table>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center text-muted-foreground py-8">
                        선택한 조건에 해당하는 데이터가 없습니다
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          )}
        </>
      )}
    </div>
  )
}
