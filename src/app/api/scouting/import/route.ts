import { NextResponse, NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';

const downloadsDir = 'C:\\Users\\wahid\\Downloads';
const filePaths = {
  playerSummary: path.join(downloadsDir, 'MPL TR PLAYER.csv'),
  teamSummary: path.join(downloadsDir, 'MPL TR TEAM.csv'),
};

/** Try reading local CSV files. Returns null if files are missing (never throws). */
const tryReadLocalFiles = (): { playerSummaryCsv: string; teamSummaryCsv: string; teamRosterCsv: string; mostPlayedHeroCsv: string } | null => {
  try {
    let playerFile = filePaths.playerSummary;
    let teamRosterCsv = '';

    // Prioritize playoff-specific file if it exists
    const playoffPlayerPath = path.join(downloadsDir, 'mpl trkey player.csv');
    if (fs.existsSync(playoffPlayerPath)) {
      playerFile = playoffPlayerPath;
      if (fs.existsSync(filePaths.playerSummary)) {
        teamRosterCsv = fs.readFileSync(filePaths.playerSummary, 'utf-8');
      }
    }

    const playerExists = fs.existsSync(playerFile);
    const teamExists = fs.existsSync(filePaths.teamSummary);

    if (!playerExists || !teamExists) {
      console.warn('[Scouting API] Local CSV files not found. Missing:', [
        !playerExists && path.basename(playerFile),
        !teamExists && 'MPL TR TEAM.csv',
      ].filter(Boolean).join(', '));
      return null;
    }

    return {
      playerSummaryCsv: fs.readFileSync(playerFile, 'utf-8'),
      teamSummaryCsv: fs.readFileSync(filePaths.teamSummary, 'utf-8'),
      teamRosterCsv,
      mostPlayedHeroCsv: '',
    };
  } catch (err) {
    console.error('[Scouting API] Error reading local files:', err);
    return null;
  }
};

/** Empty payload — returned when no data source is available at all. */
const emptyPayload = () => ({
  playerSummaryCsv: '',
  teamSummaryCsv: '',
  teamRosterCsv: '',
  mostPlayedHeroCsv: '',
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const source = searchParams.get('source') || 'google';

    if (source === 'local') {
      // Explicitly requested local files
      const localData = tryReadLocalFiles();
      if (!localData) {
        return NextResponse.json({
          success: true,
          source: 'empty',
          notice: 'Local CSV files not found in Downloads folder. Upload them manually.',
          ...emptyPayload(),
        });
      }
      return NextResponse.json({ success: true, source: 'local', ...localData });
    }

    // source === 'google' path
    console.log('[Scouting API] Google Sheets requested...');

    // 1. Prioritize playoff local file if it already exists
    const playoffPath = path.join(downloadsDir, 'mpl trkey player.csv');
    if (fs.existsSync(playoffPath)) {
      console.log('[Scouting API] Local playoff file detected, using it.');
      const localData = tryReadLocalFiles();
      return NextResponse.json({
        success: true,
        source: 'local-playoff-priority',
        ...(localData ?? emptyPayload()),
      });
    }

    // 2. Try Google Sheets (may be blocked or private)
    try {
      const spreadsheetId = '1n7Owjy63Ta0OoIQoyzOFJPFOd6-yfy4-EydGMwpeSAA';
      const res = await fetch(
        `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=1155608614`,
        { cache: 'no-store' }
      );

      if (!res.ok) {
        throw new Error(`Google Sheets returned HTTP ${res.status}`);
      }

      const playerSummaryCsv = await res.text();
      console.log('[Scouting API] Google Sheets fetch succeeded.');
      return NextResponse.json({
        success: true,
        source: 'google',
        playerSummaryCsv,
        teamSummaryCsv: '',
        teamRosterCsv: '',
        mostPlayedHeroCsv: '',
      });
    } catch (googleErr) {
      console.warn('[Scouting API] Google Sheets unavailable:', (googleErr as Error).message);
    }

    // 3. Try local Downloads fallback
    const localData = tryReadLocalFiles();
    if (localData) {
      console.log('[Scouting API] Serving from local Downloads fallback.');
      return NextResponse.json({ success: true, source: 'local-fallback', ...localData });
    }

    // 4. Nothing available — return empty payload (no crash)
    console.warn('[Scouting API] No data source available. Returning empty payload.');
    return NextResponse.json({
      success: true,
      source: 'empty',
      notice: 'No data source available. Google Sheets is private/blocked and local CSV files are missing. Please upload CSVs manually.',
      ...emptyPayload(),
    });

  } catch (error) {
    console.error('[Scouting Import API Error]:', error);
    // Even for unexpected errors, return a 200 with success:false so the frontend can handle gracefully
    return NextResponse.json({
      success: false,
      error: 'Unexpected server error in scouting import.',
      message: error instanceof Error ? error.message : String(error),
      ...emptyPayload(),
    });
  }
}
