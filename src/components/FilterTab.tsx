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
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      const jsonData = XLSX.utils.sheet_to_json(worksheet) as Record<string, any>[]

      if (jsonData.length === 0) {
        setIsProcessing(false)
        return
      }

      // 컬럼명 찾기
      const columns = Object.keys(jsonData[0])
      const licenseAcquisitionYearCol = columns.find(col =>
        col.includes('면허취득연도')
      )

      // 연도 컬럼 찾기 (4자리 숫자로 된 컬럼명)
      const yearColumns = columns.filter(col => /^\d{4}$/.test(col.trim()))

      // 컬럼 순서 재구성을 위한 정보 수집
      const isYearCol = (col: string) => /^\d{4}$/.test(col.trim())
      const licenseNumCol = columns.find(col => col === '면허번호' || col === '면허(자격)번호')
      const nameCol = columns.find(col => col === '이름' || col === '성명')

      // 연도 컬럼들 정렬
      const sortedYearCols = yearColumns.sort()

      // 기타 컬럼들
      const otherCols = columns.filter(col =>
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
      if (columns.includes('면허취득연도')) correctOrder.push('면허취득연도')
      correctOrder.push(...sortedYearCols)
      if (columns.includes('면허신고연도')) correctOrder.push('면허신고연도')

      console.log('필터링 처리 시 컬럼 순서:', correctOrder)

      // 데이터 처리 및 컬럼 순서 재정렬
      const processed = jsonData.map(row => {
        // 먼저 연도 컬럼 값 수정
        const modifiedRow = { ...row }

        if (licenseAcquisitionYearCol) {
          const acquiredYear = parseInt(row[licenseAcquisitionYearCol]?.toString().trim() || '0')

          if (acquiredYear > 0) {
            yearColumns.forEach(yearCol => {
              const yearColValue = parseInt(yearCol.trim())

              if (yearColValue < acquiredYear) {
                // 연도별 컬럼 수치 < 면허취득연도 → 공백
                modifiedRow[yearCol] = ''
              } else if (yearColValue === acquiredYear) {
                // 연도별 컬럼 수치 = 면허취득연도 → "면제"
                modifiedRow[yearCol] = '면제'
              }
              // 연도별 컬럼 수치 > 면허취득연도 → 기존 값 유지
            })
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
            <p className="text-sm text-muted-foreground">
              통합하기에서 받은 파일을 이용해서 다음 작업을 진행해 주세요.
            </p>

            {/* 1. 교육이수여부 */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">1. 교육이수여부</h3>

              <div className="space-y-3 ml-4">
                <div className="flex gap-3">
                  <span className="font-semibold text-sm min-w-[2rem]">1)</span>
                  <p className="text-sm">V2 셀로 가기</p>
                </div>

                <div className="flex gap-3">
                  <span className="font-semibold text-sm min-w-[2rem]">2)</span>
                  <div className="flex-1">
                    <p className="text-sm mb-2">아래 코드 스니펫을 복사하여 붙여넣기</p>
                    <div className="bg-slate-900 text-slate-100 p-4 rounded-md overflow-x-auto">
                      <pre className="text-xs font-mono whitespace-pre">
{`=IFERROR(
    VLOOKUP(
        $A2,
        INDIRECT("'" & V$1 & "'!$A$2:$E$50000"),
        5,
        FALSE
    ),
    "미이수"
)`}
                      </pre>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <span className="font-semibold text-sm min-w-[2rem]">3)</span>
                  <p className="text-sm">쭉 끌어서 나머지 데이터 채우기</p>
                </div>

                <div className="flex gap-3">
                  <span className="font-semibold text-sm min-w-[2rem]">4)</span>
                  <p className="text-sm">데이터를 다 채운 후 업로드하기</p>
                </div>
              </div>
            </div>

            {/* 2. 면허신고연도 */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">2. 면허신고연도</h3>

              <div className="space-y-3 ml-4">
                <div className="flex gap-3">
                  <span className="font-semibold text-sm min-w-[2rem]">1)</span>
                  <p className="text-sm">AG2 셀로 가기</p>
                </div>

                <div className="flex gap-3">
                  <span className="font-semibold text-sm min-w-[2rem]">2)</span>
                  <div className="flex-1">
                    <p className="text-sm mb-2">아래 코드 스니펫을 복사하여 붙여넣기</p>
                    <div className="bg-slate-900 text-slate-100 p-4 rounded-md overflow-x-auto">
                      <pre className="text-xs font-mono whitespace-pre">
{`==IF(
    COUNTIF('면허신고 데이터'!$B$2:$B$50000, $A2)=0,
    IF(YEAR(TODAY()) - $U2 < 3, "미대상", "미신고"),
    AGGREGATE(
        14, 6,
        '면허신고 데이터'!$C$2:$C$50000 /
        ('면허신고 데이터'!$B$2:$B$50000 = $A2),
        1
    )
)`}
                      </pre>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <span className="font-semibold text-sm min-w-[2rem]">3)</span>
                  <p className="text-sm">쭉 끌어서 나머지 데이터 채우기</p>
                </div>

                <div className="flex gap-3">
                  <span className="font-semibold text-sm min-w-[2rem]">4)</span>
                  <p className="text-sm">데이터를 다 채운 후 업로드하기</p>
                </div>
              </div>
            </div>

            {/* 3. 파일 업로드 */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">3. 그 후에 엑셀파일을 저장하고, 아래에 업로드해 주세요.</h3>

              <div className="ml-4 space-y-4">
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
                  >
                    {isProcessing ? '처리 중...' : '파일 처리하기'}
                  </Button>

                  {processedData.length > 0 && (
                    <Button variant="secondary" onClick={downloadExcel}>
                      엑셀 다운로드
                    </Button>
                  )}
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
