import { useState } from 'react'
import * as XLSX from 'xlsx'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export function FilterTab() {
  const [file, setFile] = useState<File | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [processedData, setProcessedData] = useState<any[]>([])

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = event.target.files?.[0]
    if (uploadedFile) {
      setFile(uploadedFile)
      setProcessedData([])
    }
  }

  const processFile = async () => {
    if (!file) return

    setIsProcessing(true)

    try {
      const data = await file.arrayBuffer()
      const workbook = XLSX.read(data)

      // 1. 회원 데이터 시트 읽기 (첫 번째 시트)
      const memberSheetName = workbook.SheetNames[0]
      const memberSheet = workbook.Sheets[memberSheetName]
      const memberData = XLSX.utils.sheet_to_json(memberSheet) as Record<string, any>[]

      if (memberData.length === 0) {
        setIsProcessing(false)
        return
      }

      // 2. 연도별 시트 읽기 (면허번호 -> 결과 매핑)
      const yearSheetDataMap: { [year: string]: Map<string, string> } = {}

      // 회원 데이터의 연도 컬럼 찾기
      const memberColumns = Object.keys(memberData[0])
      const yearColumns = memberColumns.filter(col => /^\d{4}$/.test(col.trim())).sort()

      // 각 연도별 시트 읽기
      for (const sheetName of workbook.SheetNames.slice(1)) {
        // 마지막 시트(면허신고 데이터)가 아닌 경우
        if (sheetName !== '면허신고 데이터' && /^\d{4}$/.test(sheetName.trim())) {
          const sheet = workbook.Sheets[sheetName]
          const sheetData = XLSX.utils.sheet_to_json(sheet) as Record<string, any>[]

          const resultMap = new Map<string, string>()
          sheetData.forEach((row: any) => {
            const licenseNum = (row['면허번호'] || '').toString().trim()
            const result = (row['결과'] || '').toString().trim()
            if (licenseNum && result) {
              resultMap.set(licenseNum, result)
            }
          })

          yearSheetDataMap[sheetName] = resultMap
        }
      }

      // 3. 면허신고 데이터 시트 읽기 (면허번호 -> 최대 연도 매핑)
      const licenseReportMap = new Map<string, number>()
      const licenseSheetName = '면허신고 데이터'

      if (workbook.SheetNames.includes(licenseSheetName)) {
        const licenseSheet = workbook.Sheets[licenseSheetName]
        const licenseData = XLSX.utils.sheet_to_json(licenseSheet) as Record<string, any>[]

        // 면허번호별로 최대 연도 찾기
        licenseData.forEach((row: any) => {
          // B열: 면허번호, C열: 면허신고연도
          const licenseNumCol = Object.keys(row).find(col =>
            col.includes('면허번호') || col === '면허번호'
          )
          const yearCol = Object.keys(row).find(col =>
            col.includes('신고연도') || col.includes('연도')
          )

          if (licenseNumCol && yearCol) {
            const licenseNum = (row[licenseNumCol] || '').toString().trim()
            const year = parseInt((row[yearCol] || '').toString().trim())

            if (licenseNum && !isNaN(year)) {
              const currentMax = licenseReportMap.get(licenseNum) || 0
              if (year > currentMax) {
                licenseReportMap.set(licenseNum, year)
              }
            }
          }
        })
      }

      // 4. 컬럼명 찾기
      const licenseAcquisitionYearCol = memberColumns.find(col =>
        col.includes('면허취득연도')
      )

      // 컬럼 순서 재구성을 위한 정보 수집
      const isYearCol = (col: string) => /^\d{4}$/.test(col.trim())
      const licenseNumCol = memberColumns.find(col => col === '면허번호' || col === '면허(자격)번호')
      const nameCol = memberColumns.find(col => col === '이름' || col === '성명')

      // 기타 컬럼들
      const otherCols = memberColumns.filter(col =>
        col !== licenseNumCol &&
        col !== nameCol &&
        !isYearCol(col) &&
        col !== '면허취득연도' &&
        col !== '면허신고연도'
      )

      // 올바른 컬럼 순서
      const correctOrder: string[] = []
      if (licenseNumCol) correctOrder.push(licenseNumCol)
      if (nameCol) correctOrder.push(nameCol)
      correctOrder.push(...otherCols)
      if (memberColumns.includes('면허취득연도')) correctOrder.push('면허취득연도')
      correctOrder.push(...yearColumns)
      if (memberColumns.includes('면허신고연도')) correctOrder.push('면허신고연도')

      console.log('필터링 처리 시 컬럼 순서:', correctOrder)

      // 5. 현재 연도
      const currentYear = new Date().getFullYear()

      // 6. 데이터 처리
      const processed = memberData.map(row => {
        const modifiedRow = { ...row }
        const licenseNum = licenseNumCol ? (row[licenseNumCol] || '').toString().trim() : ''

        // 면허취득연도 추출
        const acquiredYear = licenseAcquisitionYearCol
          ? parseInt(row[licenseAcquisitionYearCol]?.toString().trim() || '0')
          : 0

        // 연도별 컬럼 처리
        if (acquiredYear > 0) {
          yearColumns.forEach(yearCol => {
            const yearColValue = parseInt(yearCol.trim())

            if (yearColValue < acquiredYear) {
              // 연도별 컬럼 수치 < 면허취득연도 → 공백
              modifiedRow[yearCol] = ''
            } else if (yearColValue === acquiredYear) {
              // 연도별 컬럼 수치 = 면허취득연도 → "면제"
              modifiedRow[yearCol] = '면제'
            } else {
              // 연도별 컬럼 수치 > 면허취득연도
              // VLOOKUP 로직: 해당 연도 시트에서 면허번호로 결과 찾기
              const yearSheetData = yearSheetDataMap[yearCol]
              if (yearSheetData && licenseNum) {
                const result = yearSheetData.get(licenseNum)
                modifiedRow[yearCol] = result || '미이수'
              } else {
                modifiedRow[yearCol] = '미이수'
              }
            }
          })
        }

        // 면허신고연도 계산
        if (licenseReportMap.has(licenseNum)) {
          // 면허신고 데이터에 있는 경우: 최대 연도 반환
          modifiedRow['면허신고연도'] = licenseReportMap.get(licenseNum)
        } else {
          // 면허신고 데이터에 없는 경우
          if (acquiredYear > 0 && (currentYear - acquiredYear) < 3) {
            modifiedRow['면허신고연도'] = '미대상'
          } else {
            modifiedRow['면허신고연도'] = '미신고'
          }
        }

        // 올바른 순서로 새 객체 생성
        const reorderedRow: Record<string, any> = {}
        correctOrder.forEach(col => {
          reorderedRow[col] = modifiedRow[col]
        })

        return reorderedRow
      })

      setProcessedData(processed)
    } catch (error) {
      console.error('파일 처리 중 오류 발생:', error)
      alert('파일 처리 중 오류가 발생했습니다. 통합하기에서 받은 파일을 사용하고 있는지 확인해주세요.')
    } finally {
      setIsProcessing(false)
    }
  }

  const downloadExcel = () => {
    if (processedData.length === 0) return

    // 컬럼 순서 구성
    const allColumns = Object.keys(processedData[0])

    // 연도 컬럼 패턴 (4자리 숫자)
    const isYearColumn = (col: string) => /^\d{4}$/.test(col.trim())

    // 면허번호, 이름 찾기
    const licenseNumCol = allColumns.find(col => col === '면허번호' || col === '면허(자격)번호')
    const nameCol = allColumns.find(col => col === '이름' || col === '성명')

    // 연도 컬럼들 추출 및 정렬
    const yearColumns = allColumns.filter(col => isYearColumn(col)).sort()

    // 기타 컬럼들 (면허번호, 이름, 연도 컬럼, 면허취득연도, 면허신고연도 제외)
    const otherCols = allColumns.filter(col =>
      col !== licenseNumCol &&
      col !== nameCol &&
      !isYearColumn(col) &&
      col !== '면허취득연도' &&
      col !== '면허신고연도'
    )

    // 명시적 컬럼 순서: 면허번호 → 이름 → 기타컬럼들 → 면허취득연도 → 2014~2025 → 면허신고연도
    const columnOrder: string[] = []

    if (licenseNumCol) columnOrder.push(licenseNumCol)
    if (nameCol) columnOrder.push(nameCol)
    columnOrder.push(...otherCols)
    if (allColumns.includes('면허취득연도')) columnOrder.push('면허취득연도')
    columnOrder.push(...yearColumns)
    if (allColumns.includes('면허신고연도')) columnOrder.push('면허신고연도')

    console.log('필터링 탭 최종 컬럼 순서:', columnOrder)

    const worksheet = XLSX.utils.json_to_sheet(processedData, {
      header: columnOrder
    })
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, '필터링_처리결과')
    XLSX.writeFile(workbook, '필터링_처리결과.xlsx', {
      compression: true,
      bookSST: false
    })
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-6">
          <h2 className="text-xl font-semibold mb-6">필터링</h2>

          <div className="space-y-6">
            <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-md p-4">
              <div className="flex items-start gap-2">
                <span className="text-blue-600 dark:text-blue-400 font-bold">ℹ️</span>
                <div className="text-sm text-blue-800 dark:text-blue-200">
                  <p className="font-semibold mb-1">자동 처리 안내</p>
                  <p>통합하기에서 받은 파일을 업로드하면 교육이수여부와 면허신고연도를 자동으로 계산합니다.</p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold">통합 데이터 파일 업로드</h3>

              <div className="space-y-4">
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
                    ✓ {file.name}
                  </p>
                )}

                <div className="flex gap-2">
                  <Button
                    onClick={processFile}
                    disabled={!file || isProcessing}
                    size="lg"
                  >
                    {isProcessing ? '처리 중...' : '파일 처리하기'}
                  </Button>

                  {processedData.length > 0 && (
                    <Button variant="secondary" size="lg" onClick={downloadExcel}>
                      엑셀 다운로드
                    </Button>
                  )}
                </div>

                <div className="text-sm text-muted-foreground space-y-1">
                  <p>처리 내용:</p>
                  <ul className="list-disc list-inside ml-2 space-y-1">
                    <li>교육이수여부 자동 계산 (연도별 시트 데이터 기반 VLOOKUP)</li>
                    <li>면허신고연도 자동 계산 (면허신고 데이터 기반)</li>
                    <li>면허취득연도 기준 면제 처리</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {processedData.length > 0 && (
        <Card>
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold mb-4">
              처리 결과 ({processedData.length}건)
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b">
                    {Object.keys(processedData[0]).map((key, index) => (
                      <th key={index} className="text-left p-2 font-semibold">
                        {key}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {processedData.slice(0, 100).map((row, index) => (
                    <tr key={index} className="border-b hover:bg-muted/50">
                      {Object.values(row).map((value: any, cellIndex) => (
                        <td key={cellIndex} className="p-2">
                          {value?.toString() || ''}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {processedData.length > 100 && (
                <p className="text-sm text-muted-foreground mt-4 text-center">
                  처음 100건만 표시됨. 전체 데이터는 엑셀 다운로드를 이용하세요.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
