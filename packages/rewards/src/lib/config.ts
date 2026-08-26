const lowercasedAuthUrl = (process.env.NEXT_PUBLIC_AUTH_URL || '').toLowerCase();

export const IS_PRODUCTION =
  lowercasedAuthUrl === 'https://learn.tg' ||
  lowercasedAuthUrl === 'https://learntg.pdj.app';
