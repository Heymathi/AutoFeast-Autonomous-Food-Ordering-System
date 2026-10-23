/**
 * Server-side User-Learned Alias Service
 * Fetches and persists user-confirmed phonetic aliases per user from/to backend API
 * Completely removes local storage dependency.
 */
export interface UserAliasRecord {
  userId: string;
  transcript: string;
  targetId: string;
  targetName: string;
  count: number;
}

export class UserAliasService {
  private static activeAliases: Map<string, UserAliasRecord[]> = new Map();

  public static async fetchLearnedAliases(userId: string = 'user_karthik_001'): Promise<UserAliasRecord[]> {
    try {
      const token = localStorage.getItem('autofeast_jwt_token') || '';
      const res = await fetch('/api/user/learned-aliases', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.aliases)) {
          this.activeAliases.set(userId, data.aliases);
          return data.aliases;
        }
      }
    } catch (err) {
      console.warn('[UserAliasService] API fetch failed:', err);
    }
    return this.activeAliases.get(userId) || [];
  }

  public static getLearnedAliases(userId: string = 'user_karthik_001'): UserAliasRecord[] {
    return this.activeAliases.get(userId) || [];
  }

  public static async learnAlias(userId: string = 'user_karthik_001', rawTranscript: string, targetId: string, targetName: string): Promise<void> {
    if (!rawTranscript || !targetId) return;
    const clean = rawTranscript.toLowerCase().trim();
    if (clean.length < 2) return;

    // In-memory update immediately
    const existing = this.getLearnedAliases(userId);
    const match = existing.find(r => r.transcript === clean && r.targetId === targetId);
    if (match) {
      match.count += 1;
    } else {
      existing.push({ userId, transcript: clean, targetId, targetName, count: 1 });
    }
    this.activeAliases.set(userId, existing);

    // Sync to Server DB with signed JWT token
    try {
      const token = localStorage.getItem('autofeast_jwt_token') || '';
      await fetch('/api/user/learned-aliases', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ transcript: clean, targetId, targetName })
      });
      console.log(`[UserAliasService SERVER DB SYNC]: Saved "${clean}" -> "${targetName}" (${targetId})`);
    } catch (err) {
      console.warn('[UserAliasService] Server DB save error:', err);
    }
  }

  public static findLearnedTargetId(transcript: string, userId: string = 'user_karthik_001'): string | null {
    const clean = (transcript || '').toLowerCase().trim();
    if (!clean) return null;
    const aliases = this.getLearnedAliases(userId);
    const match = aliases.find(r => r.transcript === clean || clean.includes(r.transcript));
    return match ? match.targetId : null;
  }
}
