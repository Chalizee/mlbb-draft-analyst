# Load Excel COM Object
$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false

$workbookPath = "C:\Users\wahid\Downloads\MLBB TOOLKIT SCRIM.xlsx"
$workbook = $excel.Workbooks.Open($workbookPath)

$outputPath = "C:\Users\wahid\.gemini\antigravity\scratch\mlbb-draft-analyst\xlsx_metadata.txt"
$log = @()

$log += "========================================="
$log += "MLBB TOOLKIT SCRIM.xlsx Metadata Analysis"
$log += "========================================="
$log += "Total Sheets: $($workbook.Sheets.Count)"

foreach ($sheet in $workbook.Sheets) {
    $log += "`n-----------------------------------------"
    $log += "Sheet Name: $($sheet.Name)"
    
    # Get columns (Row 1)
    $headers = @()
    for ($col = 1; $col -le 100; $col++) {
        $val = $sheet.Cells.Item(1, $col).Value2
        if ($val -eq $null) {
            # Check if there are more columns or if we reached the end
            $nextVal = $sheet.Cells.Item(1, $col + 1).Value2
            if ($nextVal -eq $null -and $col -gt 10) {
                break
            }
            $headers += "[Empty]"
        } else {
            $headers += $val.ToString()
        }
    }
    
    $log += "Columns count: $($headers.Count)"
    $log += "Headers: $($headers -join ' | ')"
    
    # Let's save a CSV of this sheet's first 20 rows
    $csvPath = "C:\Users\wahid\.gemini\antigravity\scratch\mlbb-draft-analyst\sheet_$($sheet.Name).csv"
    $sheet.SaveAs($csvPath, 6) # 6 = xlCSV format
    $log += "Saved first rows to CSV: sheet_$($sheet.Name).csv"
}

# Close excel
$workbook.Close($false)
$excel.Quit()
[System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null

$log | Out-File -FilePath $outputPath
Write-Output "Excel metadata analysis completed!"
