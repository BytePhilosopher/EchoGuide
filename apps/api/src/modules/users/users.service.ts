import { eq } from 'drizzle-orm';
import type { Database } from '../../shared/database/client';
import { userPreferences, users } from '../../shared/database/schema';
import { notFound } from '../../shared/errors';

export type CurrentUser = {
  user_id: string;
  locale: 'am-ET' | 'en-US';
  preferences: { speech_rate: number; wake_word: string };
};

const DEFAULT_PREFERENCES = { speech_rate: 100, wake_word: 'Echo' };

export class UsersService {
  constructor(private readonly db: Database) {}

  /** The profile of exactly the user id given, which callers take from the authenticated principal. */
  async getCurrentUser(userId: string): Promise<CurrentUser> {
    const rows = await this.db
      .select({
        id: users.id,
        locale: users.locale,
        speechRate: userPreferences.speechRate,
        wakeWord: userPreferences.wakeWord,
      })
      .from(users)
      .leftJoin(userPreferences, eq(userPreferences.userId, users.id))
      .where(eq(users.id, userId))
      .limit(1);
    const row = rows[0];
    if (!row) throw notFound('User not found');
    return {
      user_id: row.id,
      locale: row.locale === 'en-US' ? 'en-US' : 'am-ET',
      // Accounts registered before preferences rows existed fall back to the column defaults.
      preferences: {
        speech_rate: row.speechRate ?? DEFAULT_PREFERENCES.speech_rate,
        wake_word: row.wakeWord ?? DEFAULT_PREFERENCES.wake_word,
      },
    };
  }
}
