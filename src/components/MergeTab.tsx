import { useState } from 'react'
import * as XLSX from 'xlsx'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export function MergeTab() {
  const [memberFile, setMemberFile] = useState<File | null>(null)
  const [exemptionFile, setExemptionFile] = useState<File | null>(null)
  const [educationCenterFile, setEducationCenterFile] = useState<File | null>(null)
  const [educationMemberFile, setEducationMemberFile] = useState<File | null>(null)
  const [licenseFile, setLicenseFile] = useState<File | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  const handleFileUpload = (
    event: React.ChangeEvent<HTMLInputElement>,
    setFile: (file: File | null) => void
  ) => {
    const file = event.target.files?.[0]
    if (file) {
      setFile(file)
    }
  }

  // 면허취득일에서 연도 추출 함수
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
      const date = new Date((num - 25569) * 86400 * 1000)
      return date.getFullYear().toString()
    }

    return ''
  }

  const mergeAndDownload = async () => {
    if (!memberFile || !exemptionFile || !educationCenterFile || !educationMemberFile || !licenseFile) {
      alert('모든 파일을 업로드해주세요.')
      return
    }

    setIsProcessing(true)

    try {
      // 1. 회원 데이터 읽기 (첫 번째 시트만)
      const memberData = await memberFile.arrayBuffer()
      const memberWorkbook = XLSX.read(memberData)
      const memberSheetOriginal = memberWorkbook.Sheets[memberWorkbook.SheetNames[0]]

      // 서식 제거 및 빈 행 필터링을 위해 JSON으로 변환 후 다시 시트 생성
      const memberJsonRaw = XLSX.utils.sheet_to_json(memberSheetOriginal, {
        raw: false,  // 셀 서식 제거
        defval: ''   // 빈 셀은 빈 문자열로
      }) as any[]

      // 완전히 빈 행 제거
      const memberJsonFiltered = memberJsonRaw.filter(row =>
        Object.values(row).some(val => val !== null && val !== undefined && val !== '')
      )

      // 최적화된 시트로 재생성
      const memberSheet = XLSX.utils.json_to_sheet(memberJsonFiltered)
      console.log('회원 데이터:', memberJsonFiltered.length, '행,', Object.keys(memberJsonFiltered[0] || {}).length, '컬럼')

      // 2. 면제유예비대상 데이터의 모든 시트 읽기
      const exemptionData = await exemptionFile.arrayBuffer()
      const exemptionWorkbook = XLSX.read(exemptionData)

      // 3. 보수교육(면허신고센터) 데이터의 모든 시트 읽기
      const educationCenterData = await educationCenterFile.arrayBuffer()
      const educationCenterWorkbook = XLSX.read(educationCenterData)

      // 4. 보수교육(회원관리) 데이터 읽기 (첫 번째 시트만)
      const educationMemberData = await educationMemberFile.arrayBuffer()
      const educationMemberWorkbook = XLSX.read(educationMemberData)
      const educationMemberSheet = educationMemberWorkbook.Sheets[educationMemberWorkbook.SheetNames[0]]
      const educationMemberJson = XLSX.utils.sheet_to_json(educationMemberSheet) as any[]

      // 5. 연도별로 데이터 그룹화
      const yearDataMap: { [year: string]: any[] } = {}

      // 면제유예비대상 데이터 추가
      exemptionWorkbook.SheetNames.forEach((sheetName) => {
        const sheet = exemptionWorkbook.Sheets[sheetName]
        const jsonData = XLSX.utils.sheet_to_json(sheet)
        if (!yearDataMap[sheetName]) {
          yearDataMap[sheetName] = []
        }
        yearDataMap[sheetName].push(...jsonData)
      })

      // 보수교육(면허신고센터) 데이터 추가
      educationCenterWorkbook.SheetNames.forEach((sheetName) => {
        const sheet = educationCenterWorkbook.Sheets[sheetName]
        const jsonData = XLSX.utils.sheet_to_json(sheet)
        if (!yearDataMap[sheetName]) {
          yearDataMap[sheetName] = []
        }
        yearDataMap[sheetName].push(...jsonData)
      })

      // 보수교육(회원관리) 데이터 추가 (대상연도 기준으로 그룹화)
      educationMemberJson.forEach((row: any) => {
        const year = row['대상연도'] || '기타'
        if (!yearDataMap[year]) {
          yearDataMap[year] = []
        }
        yearDataMap[year].push(row)
      })

      // 6. 면허신고 데이터 읽기 (첫 번째 시트만)
      const licenseData = await licenseFile.arrayBuffer()
      const licenseWorkbook = XLSX.read(licenseData)
      const licenseSheetOriginal = licenseWorkbook.Sheets[licenseWorkbook.SheetNames[0]]

      // 서식 제거 및 빈 행 필터링을 위해 JSON으로 변환 후 다시 시트 생성
      const licenseJsonRaw = XLSX.utils.sheet_to_json(licenseSheetOriginal, {
        raw: false,  // 셀 서식 제거
        defval: ''   // 빈 셀은 빈 문자열로
      }) as any[]

      // 완전히 빈 행 제거
      const licenseJsonFiltered = licenseJsonRaw.filter(row =>
        Object.values(row).some(val => val !== null && val !== undefined && val !== '')
      )

      // 최적화된 시트로 재생성
      const licenseSheet = XLSX.utils.json_to_sheet(licenseJsonFiltered)
      console.log('면허신고 데이터:', licenseJsonFiltered.length, '행,', Object.keys(licenseJsonFiltered[0] || {}).length, '컬럼')

      // 7. 연도별 시트 이름 정렬
      const sortedYears = Object.keys(yearDataMap).sort()

      // 8. 회원 데이터에 연도별 컬럼 추가
      const memberJsonData = XLSX.utils.sheet_to_json(memberSheet) as any[]

      // "성명" 컬럼을 "이름"으로 변경 및 면허취득연도 추가
      const memberDataWithRenamedColumn = memberJsonData.map((row) => {
        const newRow = { ...row }

        // 성명 → 이름 변경
        if ('성명' in newRow) {
          newRow['이름'] = newRow['성명']
          delete newRow['성명']
        }

        // 면허취득일에서 연도 추출하여 면허취득연도 컬럼 추가
        const licenseAcquisitionDateCol = Object.keys(newRow).find(col =>
          col.includes('면허취득일') || col.includes('취득일')
        )

        if (licenseAcquisitionDateCol) {
          newRow['면허취득연도'] = extractYear(newRow[licenseAcquisitionDateCol])
        } else {
          newRow['면허취득연도'] = ''
        }

        return newRow
      })

      // 원래 회원 데이터의 컬럼 이름 추출 ("성명" → "이름"으로 변경 반영)
      const originalColumns = memberDataWithRenamedColumn.length > 0
        ? Object.keys(memberDataWithRenamedColumn[0])
        : []

      // 연도 컬럼 패턴 (4자리 숫자)
      const isYearColumn = (col: string) => /^\d{4}$/.test(col.trim())

      // 면허번호와 이름 컬럼을 찾아서 재배열
      const licenseNumCol = originalColumns.find(col => col === '면허번호' || col === '면허(자격)번호')
      const nameCol = '이름'

      // 다른 컬럼들 (연도 컬럼, 면허번호, 이름, 면허취득연도, 면허신고연도 제외)
      const otherCols = originalColumns.filter(col =>
        col !== licenseNumCol &&
        col !== nameCol &&
        !isYearColumn(col) &&
        col !== '면허취득연도' &&
        col !== '면허신고연도'
      )

      // 재배열된 컬럼 순서: 면허번호 - 이름 - 나머지 - 면허취득연도
      const baseColumns = licenseNumCol && nameCol
        ? [licenseNumCol, nameCol, ...otherCols, '면허취득연도']
        : originalColumns.filter(col => !isYearColumn(col) && col !== '면허신고연도')

      // 각 회원 데이터 행에 연도별 빈 컬럼 추가
      const memberDataWithYearColumns = memberDataWithRenamedColumn.map((row) => {
        const newRow = { ...row }
        sortedYears.forEach((year) => {
          newRow[year] = '' // 빈 값으로 초기화
        })
        newRow['면허신고연도'] = '' // 면허신고연도 컬럼 추가
        return newRow
      })

      // 컬럼 순서 지정: 기본 컬럼들 + 연도 컬럼들 + 면허신고연도
      const columnOrder = [...baseColumns, ...sortedYears, '면허신고연도']

      // 수정된 회원 데이터를 시트로 변환 (컬럼 순서 지정)
      const updatedMemberSheet = XLSX.utils.json_to_sheet(memberDataWithYearColumns, { header: columnOrder })

      // 9. 새로운 통합 워크북 생성
      const mergedWorkbook = XLSX.utils.book_new()

      // 10. 회원 데이터 시트 추가 (연도 컬럼이 추가된 버전)
      XLSX.utils.book_append_sheet(mergedWorkbook, updatedMemberSheet, '회원 데이터')

      // 11. 연도별 시트 추가 (연도순으로 정렬)
      // 구분 값을 결과 값으로 매핑하는 함수
      const mapToResult = (gubun: string): string => {
        const trimmedGubun = gubun.trim()
        switch (trimmedGubun) {
          case '면제자':
            return '면제'
          case '비대상자':
            return '비대상자'
          case '유예자':
            return '유예'
          case '보수교육':
            return '이수자'
          default:
            return ''
        }
      }

      // 컬럼 순서 명시적으로 지정
      const yearSheetHeaders = ['면허번호', '이름', '대상연도', '구분', '결과']

      sortedYears.forEach((year) => {
        // 빈 행 필터링 및 데이터 최적화
        const filteredYearData = yearDataMap[year]
          .filter(row => row && (row['면허번호'] || row['이름'] || row['대상연도'] || row['구분']))
          .map(row => {
            const gubun = (row['구분'] || '').toString().trim()
            return {
              '면허번호': (row['면허번호'] || '').toString().trim(),
              '이름': (row['이름'] || '').toString().trim(),
              '대상연도': (row['대상연도'] || '').toString().trim(),
              '구분': gubun,
              '결과': mapToResult(gubun)
            }
          })

        console.log(`${year} 시트:`, filteredYearData.length, '행')

        const mergedSheet = XLSX.utils.json_to_sheet(filteredYearData, {
          header: yearSheetHeaders
        })
        XLSX.utils.book_append_sheet(mergedWorkbook, mergedSheet, year)
      })

      // 12. 면허신고 데이터 시트 추가
      XLSX.utils.book_append_sheet(mergedWorkbook, licenseSheet, '면허신고 데이터')

      // 13. 파일 다운로드 (압축 옵션 적용)
      XLSX.writeFile(mergedWorkbook, '통합_데이터.xlsx', {
        compression: true,
        bookSST: false  // Shared Strings Table 비활성화
      })

      alert('통합이 완료되었습니다!')
    } catch (error) {
      console.error('파일 처리 중 오류 발생:', error)
      alert('파일 처리 중 오류가 발생했습니다. 파일 형식을 확인해주세요.')
    } finally {
      setIsProcessing(false)
    }
  }

  const allFilesUploaded = memberFile && exemptionFile && educationCenterFile && educationMemberFile && licenseFile

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-6">
          <h2 className="text-xl font-semibold mb-4">통합하기</h2>

          <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-md p-4 mb-6">
            <div className="flex items-start gap-2">
              <span className="text-blue-600 dark:text-blue-400 font-bold">ℹ️</span>
              <div className="text-sm text-blue-800 dark:text-blue-200">
                <p className="font-semibold mb-1">중요 안내사항</p>
                <p>다운로드 받은 <strong>회원 데이터 파일</strong>을 "다른 이름으로 저장"을 눌러 파일 형식을 <strong>"Excel 통합 문서(.xlsx)"</strong>로 저장한 후 업로드해주세요.</p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {/* 회원 데이터 */}
            <div className="border rounded-md p-4">
              <label className="block text-sm font-medium mb-2">
                1. 회원 데이터
              </label>
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => handleFileUpload(e, setMemberFile)}
                className="block w-full text-sm text-slate-500
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-md file:border-0
                  file:text-sm file:font-semibold
                  file:bg-primary file:text-primary-foreground
                  hover:file:bg-primary/90
                  cursor-pointer"
              />
              {memberFile && (
                <p className="text-sm text-green-600 dark:text-green-400 mt-2">
                  ✓ {memberFile.name}
                </p>
              )}
            </div>

            {/* 면제유예비대상 데이터 */}
            <div className="border rounded-md p-4">
              <label className="block text-sm font-medium mb-2">
                2. 면제유예비대상 데이터
              </label>
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => handleFileUpload(e, setExemptionFile)}
                className="block w-full text-sm text-slate-500
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-md file:border-0
                  file:text-sm file:font-semibold
                  file:bg-primary file:text-primary-foreground
                  hover:file:bg-primary/90
                  cursor-pointer"
              />
              {exemptionFile && (
                <p className="text-sm text-green-600 dark:text-green-400 mt-2">
                  ✓ {exemptionFile.name}
                </p>
              )}
            </div>

            {/* 보수교육(면허신고센터) 데이터 */}
            <div className="border rounded-md p-4">
              <label className="block text-sm font-medium mb-2">
                3. 보수교육(면허신고센터) 데이터
              </label>
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => handleFileUpload(e, setEducationCenterFile)}
                className="block w-full text-sm text-slate-500
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-md file:border-0
                  file:text-sm file:font-semibold
                  file:bg-primary file:text-primary-foreground
                  hover:file:bg-primary/90
                  cursor-pointer"
              />
              {educationCenterFile && (
                <p className="text-sm text-green-600 dark:text-green-400 mt-2">
                  ✓ {educationCenterFile.name}
                </p>
              )}
            </div>

            {/* 보수교육(회원관리) 데이터 */}
            <div className="border rounded-md p-4">
              <label className="block text-sm font-medium mb-2">
                4. 보수교육(회원관리) 데이터
              </label>
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => handleFileUpload(e, setEducationMemberFile)}
                className="block w-full text-sm text-slate-500
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-md file:border-0
                  file:text-sm file:font-semibold
                  file:bg-primary file:text-primary-foreground
                  hover:file:bg-primary/90
                  cursor-pointer"
              />
              {educationMemberFile && (
                <p className="text-sm text-green-600 dark:text-green-400 mt-2">
                  ✓ {educationMemberFile.name}
                </p>
              )}
            </div>

            {/* 면허신고 데이터 */}
            <div className="border rounded-md p-4">
              <label className="block text-sm font-medium mb-2">
                5. 면허신고 데이터
              </label>
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => handleFileUpload(e, setLicenseFile)}
                className="block w-full text-sm text-slate-500
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-md file:border-0
                  file:text-sm file:font-semibold
                  file:bg-primary file:text-primary-foreground
                  hover:file:bg-primary/90
                  cursor-pointer"
              />
              {licenseFile && (
                <p className="text-sm text-green-600 dark:text-green-400 mt-2">
                  ✓ {licenseFile.name}
                </p>
              )}
            </div>

            <div className="pt-4">
              <Button
                onClick={mergeAndDownload}
                disabled={!allFilesUploaded || isProcessing}
                size="lg"
                className="w-full"
              >
                {isProcessing ? '통합 중...' : '합치기'}
              </Button>
              {!allFilesUploaded && (
                <p className="text-sm text-muted-foreground text-center mt-2">
                  모든 파일을 업로드해주세요
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {allFilesUploaded && (
        <Card>
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold mb-4">통합 결과 미리보기</h3>
            <div className="space-y-2 text-sm">
              <p>✓ 회원 데이터: <span className="font-mono text-muted-foreground">{memberFile.name}</span></p>
              <p>✓ 면제유예비대상 데이터: <span className="font-mono text-muted-foreground">{exemptionFile.name}</span></p>
              <p>✓ 보수교육(면허신고센터) 데이터: <span className="font-mono text-muted-foreground">{educationCenterFile.name}</span></p>
              <p>✓ 보수교육(회원관리) 데이터: <span className="font-mono text-muted-foreground">{educationMemberFile.name}</span></p>
              <p>✓ 면허신고 데이터: <span className="font-mono text-muted-foreground">{licenseFile.name}</span></p>
            </div>
            <div className="mt-4 p-4 bg-muted rounded-md">
              <p className="text-sm font-semibold mb-2">통합 파일 구조:</p>
              <ul className="text-sm space-y-1 ml-4">
                <li>• 시트 1: 회원 데이터</li>
                <li>• 시트 2~N: 연도별 데이터 (면제유예비대상 + 보수교육(면허신고센터) + 보수교육(회원관리) 합침)</li>
                <li>• 마지막 시트: 면허신고 데이터</li>
              </ul>
              <p className="text-xs text-muted-foreground mt-2">
                * 같은 연도의 시트들이 자동으로 통합됩니다.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
