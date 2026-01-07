import { useState } from 'react'
import * as XLSX from 'xlsx-js-style'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

interface ProcessedData {
  이름: string
  면허번호: string
  대상연도: string
  '면허 검증결과': string
}

export function LicenseTab() {
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

  // 신청일에서 연도 추출 함수
  const extractYear = (dateString: string | undefined): string => {
    if (!dateString) return ''

    const dateStr = dateString.toString().trim()

    // YYYY-MM-DD 형식
    const match1 = dateStr.match(/(\d{4})-\d{2}-\d{2}/)
    if (match1) return match1[1]

    // YYYY.MM.DD 형식
    const match2 = dateStr.match(/(\d{4})\.\d{2}\.\d{2}/)
    if (match2) return match2[1]

    // YYYY/MM/DD 형식
    const match3 = dateStr.match(/(\d{4})\/\d{2}\/\d{2}/)
    if (match3) return match3[1]

    // YYYYMMDD 형식
    const match4 = dateStr.match(/^(\d{4})\d{4}$/)
    if (match4) return match4[1]

    // 4자리 연도만 있는 경우
    const match5 = dateStr.match(/^(\d{4})$/)
    if (match5) return match5[1]

    // 엑셀 날짜 시리얼 넘버인 경우 (숫자)
    const num = parseFloat(dateStr)
    if (!isNaN(num) && num > 40000 && num < 60000) {
      // 엑셀 날짜 변환 (1900년 1월 1일부터 계산)
      const date = new Date((num - 25569) * 86400 * 1000)
      return date.getFullYear().toString()
    }

    return ''
  }

  const processFiles = async () => {
    if (files.length === 0) return

    setIsProcessing(true)
    const allData: ProcessedData[] = []

    for (const file of files) {
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
        if (normalizedHeader === '이름' || normalizedHeader === '성명') {
          columnIndices['이름'] = index
        } else if (normalizedHeader === '면허(자격)번호' || normalizedHeader === '면허번호') {
          columnIndices['면허번호'] = index
        } else if (normalizedHeader === '신청일') {
          columnIndices['신청일'] = index
        } else if (normalizedHeader === '면허 검증결과') {
          columnIndices['면허 검증결과'] = index
        }
      })

      // 데이터 행 처리 (헤더 제외)
      for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i]
        if (!row || row.length === 0) continue

        // 신청일에서 연도 추출
        const targetYear = extractYear(row[columnIndices['신청일']]?.toString())

        const processedRow: ProcessedData = {
          이름: row[columnIndices['이름']]?.toString() || '',
          면허번호: row[columnIndices['면허번호']]?.toString() || '',
          대상연도: targetYear,
          '면허 검증결과': row[columnIndices['면허 검증결과']]?.toString() || ''
        }

        // 빈 행 스킵
        if (processedRow.이름 || processedRow.면허번호) {
          allData.push(processedRow)
        }
      }
    }

    setProcessedData(allData)
    setIsProcessing(false)
  }

  const downloadExcel = () => {
    if (processedData.length === 0) return

    // 컬럼 순서 명시적으로 지정
    const columnHeaders = ['면허번호', '이름', '대상연도', '면허 검증결과']

    const worksheet = XLSX.utils.json_to_sheet(processedData, {
      header: columnHeaders
    })
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, '면허신고')
    XLSX.writeFile(workbook, '면허신고_처리결과.xlsx')
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-6">
          <h2 className="text-xl font-semibold mb-4">면허신고</h2>

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
                    <th className="text-left p-2 font-semibold">면허 검증결과</th>
                  </tr>
                </thead>
                <tbody>
                  {processedData.slice(0, 100).map((row, index) => (
                    <tr key={index} className="border-b hover:bg-muted/50">
                      <td className="p-2">{row.면허번호}</td>
                      <td className="p-2">{row.이름}</td>
                      <td className="p-2">{row.대상연도}</td>
                      <td className="p-2">{row['면허 검증결과']}</td>
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
