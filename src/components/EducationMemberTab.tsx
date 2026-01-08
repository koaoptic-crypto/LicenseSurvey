import { useState } from 'react'
import * as XLSX from 'xlsx-js-style'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

interface ProcessedData {
  이름: string
  면허번호: string
  대상연도: string
  구분: string
}

export function EducationMemberTab() {
  const [files, setFiles] = useState<File[]>([])
  const [processedData, setProcessedData] = useState<ProcessedData[]>([])
  const [isProcessing, setIsProcessing] = useState(false)

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = event.target.files
    if (selectedFiles) {
      setFiles(Array.from(selectedFiles))
      setProcessedData([])
    }
  }


  // 파일명에서 연도 추출 함수
  const extractYearFromFilename = (filename: string): string => {
    // 확장자 제거
    const nameWithoutExt = filename.replace(/\.(xlsx|xls)$/i, '')

    // 4자리 연도 찾기 (2000-2099 범위)
    const match = nameWithoutExt.match(/20\d{2}/)

    return match ? match[0] : ''
  }

  const processFiles = async () => {
    if (files.length === 0) return

    setIsProcessing(true)
    const allData: ProcessedData[] = []

    for (const file of files) {
      // 파일명에서 연도 추출
      const yearFromFilename = extractYearFromFilename(file.name)

      if (!yearFromFilename) {
        alert(`파일 "${file.name}"에서 연도를 찾을 수 없습니다.\n파일명에 4자리 연도를 포함해주세요. (예: 2024.xlsx, 보수교육_2024.xlsx)`)
        continue
      }

      const data = await file.arrayBuffer()
      const workbook = XLSX.read(data)
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as string[][]

      if (jsonData.length === 0) continue

      // 헤더 행 찾기
      const headers = jsonData[0] as string[]

      // 필요한 컬럼 인덱스 찾기
      const columnIndices: { [key: string]: number } = {}

      headers.forEach((header, index) => {
        const normalizedHeader = header?.trim()
        if (normalizedHeader === '성명' || normalizedHeader === '이름') {
          columnIndices['이름'] = index
        } else if (normalizedHeader === '면허번호' || normalizedHeader === '면허(자격)번호') {
          columnIndices['면허번호'] = index
        }
      })

      // 데이터 행 처리 (헤더 제외)
      for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i]
        if (!row || row.length === 0) continue

        const processedRow: ProcessedData = {
          이름: row[columnIndices['이름']]?.toString()?.trim() || '',
          면허번호: row[columnIndices['면허번호']]?.toString()?.trim() || '',
          대상연도: yearFromFilename,
          구분: '보수교육'
        }

        // 이름과 면허번호가 모두 있는 경우만 저장
        if (processedRow.이름 && processedRow.면허번호) {
          allData.push(processedRow)
        }
      }
    }

    setProcessedData(allData)
    setIsProcessing(false)
  }

  const downloadExcel = () => {
    if (processedData.length === 0) return

    // 연도별로 데이터 그룹화
    const groupedByYear: { [key: string]: ProcessedData[] } = {}

    processedData.forEach((row) => {
      const year = row.대상연도 || '기타'
      if (!groupedByYear[year]) {
        groupedByYear[year] = []
      }
      groupedByYear[year].push(row)
    })

    // 워크북 생성
    const workbook = XLSX.utils.book_new()

    // 연도별로 시트 생성 (연도순으로 정렬)
    const sortedYears = Object.keys(groupedByYear).sort()

    // 컬럼 순서 명시적으로 지정
    const columnHeaders = ['면허번호', '이름', '대상연도', '구분']

    sortedYears.forEach((year) => {
      const worksheet = XLSX.utils.json_to_sheet(groupedByYear[year], {
        header: columnHeaders
      })
      XLSX.utils.book_append_sheet(workbook, worksheet, year)
    })

    XLSX.writeFile(workbook, '보수교육_회원관리_처리결과.xlsx')
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-6">
          <h2 className="text-xl font-semibold mb-4">보수교육(회원관리)</h2>

          <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-md p-4 mb-4 space-y-3">
            <div className="flex items-start gap-2">
              <span className="text-blue-600 dark:text-blue-400 font-bold">ℹ️</span>
              <div className="text-sm text-blue-800 dark:text-blue-200 space-y-2">
                <p className="font-semibold text-base">사용 방법</p>

                <div className="bg-white dark:bg-blue-900 rounded p-3 space-y-2 border border-blue-300 dark:border-blue-700">
                  <p className="font-semibold">1단계: 파일명에 연도 포함하기</p>
                  <ul className="list-disc list-inside space-y-1 ml-2">
                    <li>다운로드한 엑셀 파일의 이름에 <strong>4자리 연도</strong>를 포함시켜주세요</li>
                    <li>연도만 입력하셔도 되고, 다른 텍스트와 함께 입력하셔도 됩니다</li>
                    <li><strong>여러 연도의 파일을 한 번에 업로드</strong>할 수 있습니다</li>
                  </ul>
                </div>

                <div className="bg-yellow-50 dark:bg-yellow-900/30 rounded p-3 space-y-2 border border-yellow-300 dark:border-yellow-700">
                  <p className="font-semibold text-yellow-900 dark:text-yellow-200">파일명 예시</p>
                  <div className="text-sm space-y-1 ml-2">
                    <div className="flex items-center gap-2">
                      <span className="text-green-600 dark:text-green-400">✓</span>
                      <code className="bg-white dark:bg-gray-800 px-2 py-1 rounded">2024.xlsx</code>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-green-600 dark:text-green-400">✓</span>
                      <code className="bg-white dark:bg-gray-800 px-2 py-1 rounded">보수교육_2024.xlsx</code>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-green-600 dark:text-green-400">✓</span>
                      <code className="bg-white dark:bg-gray-800 px-2 py-1 rounded">2024년_보수교육_이수자명단.xlsx</code>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-green-600 dark:text-green-400">✓</span>
                      <code className="bg-white dark:bg-gray-800 px-2 py-1 rounded">회원관리2023.xlsx</code>
                    </div>
                  </div>
                </div>

                <div className="bg-white dark:bg-blue-900 rounded p-3 space-y-2 border border-blue-300 dark:border-blue-700">
                  <p className="font-semibold">2단계: 파일 형식 변환하기</p>
                  <ul className="list-disc list-inside space-y-1 ml-2">
                    <li>엑셀 상단 메뉴에서 <strong>"파일"</strong> → <strong>"다른 이름으로 저장"</strong> 클릭</li>
                    <li>파일명에 연도를 포함하여 입력 (예: <strong>2024.xlsx</strong>)</li>
                    <li>파일 형식을 <strong>"Excel 통합 문서 (.xlsx)"</strong>로 선택</li>
                    <li>저장 후 이 페이지에서 파일을 업로드하세요</li>
                  </ul>
                </div>

                <div className="bg-white dark:bg-blue-900 rounded p-3 border border-blue-300 dark:border-blue-700">
                  <p className="font-semibold">참고사항</p>
                  <ul className="list-disc list-inside space-y-1 ml-2">
                    <li><strong>최근연도</strong>만 이 탭을 사용하시고, <strong>이전연도</strong>는 "보수교육(면허신고센터)" 탭을 이용해주세요</li>
                    <li>파일명에 연도가 없는 파일은 자동으로 건너뛰어지며 경고 메시지가 표시됩니다</li>
                    <li>엑셀 파일에는 <strong>"이름"</strong>과 <strong>"면허번호"</strong> 컬럼이 필수로 있어야 합니다</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                엑셀 파일 업로드 (여러 파일 선택 가능)
              </label>
              <input
                type="file"
                accept=".xlsx,.xls"
                multiple
                onChange={handleFileUpload}
                className="block w-full text-sm text-slate-500
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-md file:border-0
                  file:text-sm file:font-semibold
                  file:bg-primary file:text-primary-foreground
                  hover:file:bg-primary/90
                  cursor-pointer"
              />
            </div>

            {files.length > 0 && (
              <div className="bg-muted p-4 rounded-md">
                <p className="text-sm font-medium mb-2">선택된 파일: {files.length}개</p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {files.map((file, index) => (
                    <li key={index}>• {file.name}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                onClick={processFiles}
                disabled={files.length === 0 || isProcessing}
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
                    <th className="text-left p-2 font-semibold">면허번호</th>
                    <th className="text-left p-2 font-semibold">이름</th>
                    <th className="text-left p-2 font-semibold">대상연도</th>
                    <th className="text-left p-2 font-semibold">구분</th>
                  </tr>
                </thead>
                <tbody>
                  {processedData.slice(0, 100).map((row, index) => (
                    <tr key={index} className="border-b hover:bg-muted/50">
                      <td className="p-2">{row.면허번호}</td>
                      <td className="p-2">{row.이름}</td>
                      <td className="p-2">{row.대상연도}</td>
                      <td className="p-2">{row.구분}</td>
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
